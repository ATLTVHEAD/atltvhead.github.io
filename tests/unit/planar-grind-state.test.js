import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createPlanarSkater } from '../../js/game/core/planar-skater.js';
import { stepGrind } from '../../js/game/core/grind-state.js';
import { stepLaunch } from '../../js/game/core/launch-state.js';
import { createPlanarCityLayout } from '../../js/game/world/planar-city-layout.js';
import { compilePlanarWorld } from '../../js/game/world/planar-city-surfaces.js';
import { sampleSkatePath } from '../../js/game/world/skate-paths.js';
import { createFixedStepState, advanceFixedStep } from '../../js/game/core/fixed-step.js';
import { stepSkaterOnPlanarCity } from '../../js/game/core/planar-skater.js';

const manifest = JSON.parse(readFileSync(new URL('../../assets/game/manifest.json', import.meta.url)));
const world = compilePlanarWorld(createPlanarCityLayout({ assetManifest: manifest }));
const pipe = world.rails.find((path) => path.id === 'line-pipe-capture');
const dt = 1 / 60;

function candidate({ speed = 3, distance = 0.2, alignment = 1, direction = 1,
  cooldownMs = 0, path = pipe, surfaceId = 'ground', launchLockId = null,
  deltaSeconds = dt } = {}) {
  const candidateWorld = { ...world, rails: [path] };
  const sample = sampleSkatePath(path, 0.5 * path.totalLength);
  const dx = direction * speed * deltaSeconds * alignment;
  const dy = speed * deltaSeconds * Math.sqrt(1 - alignment * alignment);
  const offset = [0, distance, 0];
  const center = sample.point.map((value, axis) => value + offset[axis]);
  const motion = {
    from: [center[0] - dx / 2, center[1] - dy / 2, center[2]],
    to: [center[0] + dx / 2, center[1] + dy / 2, center[2]],
    priorMode: 'airborne',
    priorSurfaceId: surfaceId,
  };
  const state = {
    ...createPlanarSkater(candidateWorld),
    mode: 'airborne',
    position: [...motion.to],
    forward: [direction, 0, 0],
    speed,
    verticalSpeed: dy / dt,
    groundHeight: 0,
    surfaceId,
    tick: 41,
    sessionId: 'grind-boundary',
    launchLockId,
    recaptureRemainingMs: cooldownMs,
  };
  return stepGrind(state, {}, deltaSeconds, candidateWorld, motion);
}

describe('planar grind state', () => {
  it('grind_captureBoundariesUseInclusiveSpeedDistanceAndAlignment', () => {
    expect(candidate({ speed: 1.999 }).state.mode).toBe('airborne');
    expect(candidate({ speed: 2 }).state.mode).toBe('grinding');
    expect(candidate({ distance: 0.799 }).state.mode).toBe('grinding');
    expect(candidate({ distance: 0.8 }).state.mode).toBe('grinding');
    expect(candidate({ distance: 0.801 }).state.mode).toBe('airborne');
    expect(candidate({ alignment: 0.649 }).state.mode).toBe('airborne');
    expect(candidate({ alignment: 0.65 }).state.mode).toBe('grinding');
    expect(candidate({ alignment: 0.651 }).state.mode).toBe('grinding');
  });

  it('grind_captureDoesNotTeleportFromDistantOrElevatedApproaches', () => {
    const highPath = {
      ...pipe,
      id: 'high-path',
      points: pipe.points.map(([x, y, z]) => [x, y + 5, z]),
      bounds: {
        min: [pipe.bounds.min[0], pipe.bounds.min[1] + 5, pipe.bounds.min[2]],
        max: [pipe.bounds.max[0], pipe.bounds.max[1] + 5, pipe.bounds.max[2]],
      },
    };

    expect(candidate({ distance: 1.2 }).state.mode).toBe('airborne');
    expect(candidate({ distance: -5, path: highPath }).state.mode).toBe('airborne');
  });

  it('grind_reverseApproachUsesSignedPathDistance', () => {
    const captured = candidate({ direction: -1 });
    const distance = captured.state.railDistance;
    const stepped = stepGrind(captured.state, {}, dt, world, {
      from: [...captured.state.position],
      to: [...captured.state.position],
      priorMode: 'grinding',
      priorSurfaceId: captured.state.surfaceId,
    });

    expect(captured.state.mode).toBe('grinding');
    expect(captured.state.railDirection).toBe(-1);
    expect(stepped.state.railDistance).toBeLessThan(distance);
    expect(stepped.state.position[0]).toBeLessThan(captured.state.position[0]);
  });

  it('grind_outwardEndpointCannotRecaptureAfterCooldown', () => {
    const endpoint = sampleSkatePath(pipe, pipe.totalLength);
    const motion = {
      from: [endpoint.point[0] - 0.02, endpoint.point[1], endpoint.point[2]],
      to: [endpoint.point[0] + 0.02, endpoint.point[1], endpoint.point[2]],
      priorMode: 'airborne',
      priorSurfaceId: 'ground',
    };
    const state = {
      ...createPlanarSkater(world),
      mode: 'airborne',
      position: [...motion.to],
      forward: [1, 0, 0],
      speed: 2.2,
      groundHeight: 0,
      sessionId: 'endpoint-recapture',
      recaptureRemainingMs: 0,
      launchLockId: 'launch-lip-smooth-crest',
    };
    const result = stepGrind(state, {}, dt, world, motion);

    expect(result.state.mode).toBe('airborne');
    expect(result.state.railId).toBeNull();
    expect(result.events).toEqual([]);
  });

  it('grind_cooldownIsExactly150Milliseconds', () => {
    expect(candidate({ cooldownMs: 150, deltaSeconds: 0.149 }).state.mode).toBe('airborne');
    expect(candidate({ cooldownMs: 150, deltaSeconds: 0.15 }).state.mode).toBe('grinding');
  });

  it('grind_launchLockClearsOnlyAfterLeavingTheCaptureNeighborhood', () => {
    const path = {
      ...pipe,
      id: 'locked-source',
      points: [[10, 1, 10], [20, 1, 10]],
      segmentLengths: [10],
      totalLength: 10,
      bounds: { min: [10, 1, 10], max: [20, 1, 10] },
    };
    const marker = {
      id: 'locked-marker',
      supportId: path.id,
      point: [15, 1, 10],
      normal: [1, 0, 0],
      tangent: [1, 0, 0],
      halfWidth: 1,
      halfHeight: 1,
      direction: 1,
    };
    const lockedWorld = { ...world, rails: [path], launchMarkers: [marker] };
    const state = {
      ...createPlanarSkater(lockedWorld),
      mode: 'airborne',
      launchLockId: marker.id,
    };
    const atBoundary = stepLaunch(state, {}, dt, lockedWorld, {
      from: [14.9, 1.8, 10], to: [15.1, 1.8, 10],
      priorMode: 'airborne', priorSurfaceId: 'ground',
    });
    const outside = stepLaunch(state, {}, dt, lockedWorld, {
      from: [14.9, 1.801, 10], to: [15.1, 1.801, 10],
      priorMode: 'airborne', priorSurfaceId: 'ground',
    });

    expect(atBoundary.state.launchLockId).toBe(marker.id);
    expect(outside.state.launchLockId).toBeNull();
  });

  it('grind_balanceFailureDismountsOnceWithFiniteContinuousVelocity', () => {
    const path = { ...pipe, id: 'odd' };
    const balanceWorld = { ...world, rails: [path] };
    const distance = path.totalLength / 2;
    const sample = sampleSkatePath(path, distance);
    const state = {
      ...createPlanarSkater(balanceWorld),
      mode: 'grinding',
      position: [...sample.point],
      forward: [sample.tangent[0], 0, sample.tangent[2]],
      speed: 3,
      verticalSpeed: sample.tangent[1] * 3,
      groundHeight: sample.point[1],
      railId: path.id,
      railDistance: distance,
      railDirection: 1,
      balance: 0.99,
      grindAgeMs: 500,
      sessionId: 'balance-failure',
      eventIndex: 3,
    };
    const result = stepGrind(state, { steer: -1 }, dt, balanceWorld, {
      from: [...state.position], to: [...state.position],
      priorMode: 'grinding', priorSurfaceId: state.surfaceId,
    });

    expect(result.state.mode).toBe('airborne');
    expect(result.state.railId).toBeNull();
    expect(result.state.balance).toBe(0);
    expect(result.state.position.every(Number.isFinite)).toBe(true);
    expect(result.state.speed).toBeGreaterThan(0);
    expect(Number.isFinite(result.state.verticalSpeed)).toBe(true);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      eventId: 'balance-failure:0:4', eventIndex: 4, type: 'grindEnded',
      reason: 'balance-failure', pathId: path.id,
    });
  });

  it('grind_jumpDismountAddsJumpWithoutLosingPathVelocityOrEventOrder', () => {
    const distance = pipe.totalLength / 2;
    const sample = sampleSkatePath(pipe, distance);
    const state = {
      ...createPlanarSkater(world),
      mode: 'grinding',
      position: [...sample.point],
      forward: [sample.tangent[0], 0, sample.tangent[2]],
      speed: 3,
      verticalSpeed: sample.tangent[1] * 3,
      railId: pipe.id,
      railDistance: distance,
      railDirection: 1,
      eventIndex: 4,
      sessionId: 'jump-dismount',
    };
    const result = stepGrind(state, { jumpPressed: true }, dt, world, {
      from: [...state.position], to: [...state.position],
      priorMode: 'grinding', priorSurfaceId: state.surfaceId,
    });
    const outgoing = [
      result.state.forward[0] * result.state.speed,
      result.state.verticalSpeed,
      result.state.forward[2] * result.state.speed,
    ];

    expect(result.state.mode).toBe('airborne');
    expect(result.state.railId).toBeNull();
    expect(outgoing.reduce((sum, value, axis) => sum + value * sample.tangent[axis], 0))
      .toBeCloseTo(3, 8);
    expect(result.state.verticalSpeed).toBeGreaterThan(5);
    expect(result.events.map((event) => event.type)).toEqual(['grindEnded', 'jumped']);
    expect(result.events.map((event) => event.eventIndex)).toEqual([5, 6]);
    expect(result.events.map((event) => event.eventId)).toEqual([
      'jump-dismount:0:5', 'jump-dismount:0:6',
    ]);
  });

  it('grind_balanceAndPathDistanceAreIndependentOfRenderCadence', () => {
    const path = {
      ...pipe,
      id: 'even',
      points: [[10, 1, 10], [240, 1, 10]],
      segmentLengths: [230],
      totalLength: 230,
      bounds: { min: [10, 1, 10], max: [240, 1, 10] },
    };
    const deterministicWorld = { ...world, rails: [path], colliders: [] };
    const initial = {
      ...createPlanarSkater(deterministicWorld),
      mode: 'grinding',
      position: [30, 1, 10],
      forward: [1, 0, 0],
      speed: 4,
      verticalSpeed: 0,
      groundHeight: 1,
      railId: path.id,
      railDistance: 20,
      railDirection: 1,
      balance: 0.2,
      grindAgeMs: 150,
    };
    const input = { steer: 0.1, throttle: 0, brake: 0 };
    const run = (renderHz) => {
      let loop = createFixedStepState(initial, { maxCatchUpSteps: 8 });
      for (let frame = 0; frame < renderHz; frame += 1) {
        loop = advanceFixedStep(loop, 1000 / renderHz, input,
          (state, tickInput, seconds) => stepSkaterOnPlanarCity(
            state, tickInput, seconds, deterministicWorld,
          )).loopState;
      }
      return loop.currentState;
    };
    const at30 = run(30);
    const at60 = run(60);
    const at120 = run(120);

    expect(at30.tick).toBe(60);
    expect(at60.tick).toBe(60);
    expect(at120.tick).toBe(60);
    expect(at30.railDistance).toBeCloseTo(at60.railDistance, 10);
    expect(at30.railDistance).toBeCloseTo(at120.railDistance, 10);
    expect(at30.balance).toBeCloseTo(at60.balance, 10);
    expect(at30.balance).toBeCloseTo(at120.balance, 10);
  });

  it('grind_balanceUsesThePinnedGraceDriftRampAndCorrectionGain', () => {
    const path = {
      ...pipe,
      id: 'even',
      points: [[10, 1, 10], [20, 1, 10]],
      segmentLengths: [10],
      totalLength: 10,
      bounds: { min: [10, 1, 10], max: [20, 1, 10] },
    };
    const balanceWorld = { ...world, rails: [path], colliders: [] };
    const stateAt = (grindAgeMs) => ({
      ...createPlanarSkater(balanceWorld),
      mode: 'grinding',
      position: [15, 1, 10],
      forward: [1, 0, 0],
      speed: 3,
      verticalSpeed: 0,
      groundHeight: 1,
      railId: path.id,
      railDistance: 5,
      railDirection: 1,
      grindAgeMs,
    });
    const motionFor = (state) => ({
      from: [...state.position], to: [...state.position],
      priorMode: 'grinding', priorSurfaceId: state.surfaceId,
    });
    const atGraceEnd = stateAt(199);
    const stillGrace = stepGrind(atGraceEnd, {}, 0.001, balanceWorld, motionFor(atGraceEnd));
    const afterGrace = stateAt(200);
    const firstDrift = stepGrind(afterGrace, {}, 0.001, balanceWorld, motionFor(afterGrace));
    const atRampEnd = stateAt(3999);
    const fullDrift = stepGrind(atRampEnd, {}, 0.001, balanceWorld, motionFor(atRampEnd));
    const corrected = stepGrind(afterGrace, { steer: 1 }, 0.001,
      balanceWorld, motionFor(afterGrace));

    expect(stillGrace.state.balance).toBe(0);
    expect(stillGrace.state.grindAgeMs).toBe(200);
    expect(firstDrift.state.balance).toBeCloseTo(0.000091055, 10);
    expect(fullDrift.state.balance).toBeCloseTo(0.0003, 10);
    expect(corrected.state.balance).toBeCloseTo(-0.001508945, 10);
  });

  it('grind_endpointDismountPreservesThePathVelocity', () => {
    const distance = pipe.totalLength - 0.001;
    const sample = sampleSkatePath(pipe, distance);
    const state = {
      ...createPlanarSkater(world),
      mode: 'grinding',
      position: [...sample.point],
      forward: [sample.tangent[0], 0, sample.tangent[2]],
      speed: 3,
      verticalSpeed: sample.tangent[1] * 3,
      groundHeight: sample.point[1],
      railId: pipe.id,
      railDistance: distance,
      railDirection: 1,
      balance: 0,
      grindAgeMs: 200,
      eventIndex: 4,
      sessionId: 'endpoint-dismount',
    };
    const result = stepGrind(state, {}, dt, world, {
      from: [...state.position], to: [...state.position],
      priorMode: 'grinding', priorSurfaceId: state.surfaceId,
    });
    const end = sampleSkatePath(pipe, pipe.totalLength);
    const expectedSpeed = 3 - 0.6 * dt;
    const outgoing = [
      result.state.forward[0] * result.state.speed,
      result.state.verticalSpeed,
      result.state.forward[2] * result.state.speed,
    ];

    expect(result.state.mode).toBe('airborne');
    expect(result.state.railId).toBeNull();
    expect(result.state.position).toEqual(end.point);
    expect(Math.hypot(...outgoing)).toBeCloseTo(expectedSpeed, 8);
    expect(outgoing.reduce((sum, value, axis) => sum + value * end.tangent[axis], 0))
      .toBeCloseTo(expectedSpeed, 8);
    expect(result.state.recaptureRemainingMs).toBe(150);
    expect(result.remainingSeconds).toBeGreaterThan(0);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      eventId: 'endpoint-dismount:0:5', eventIndex: 5, tick: 0, type: 'grindEnded',
      pathId: pipe.id, reason: 'endpoint', speed: expectedSpeed,
    });
    expect(result.events[0].signedDistanceAdvanced).toBeCloseTo(0.001, 8);
  });

  it('grind_missingPathDismountPreservesStoredVelocity', () => {
    const state = {
      ...createPlanarSkater(world),
      mode: 'grinding',
      position: [140, 2, 80],
      forward: [0.8, 0, 0.6],
      speed: 3,
      verticalSpeed: -1.25,
      railId: pipe.id,
      railDistance: 0.7,
      railDirection: -1,
      sessionId: 'missing-path',
      eventIndex: 8,
    };
    const result = stepGrind(state, {}, dt, { ...world, rails: [] }, {
      from: [...state.position], to: [...state.position],
      priorMode: 'grinding', priorSurfaceId: state.surfaceId,
    });

    expect(result.state.mode).toBe('airborne');
    expect(result.state.speed).toBe(3);
    expect(result.state.verticalSpeed).toBe(-1.25);
    expect(result.state.forward).toEqual([0.8, 0, 0.6]);
    expect(result.events[0]).toMatchObject({
      eventIndex: 9, type: 'grindEnded', pathId: pipe.id, reason: 'missing-path', speed: 3,
    });
    expect(result.remainingSeconds).toBe(dt);
  });

  it('grind_launchSourcePathStaysExcludedUntilTheCaptureNeighborhoodIsCleared', () => {
    const source = world.rails.find((path) => path.id === 'line-smooth-crest-exit');
    const sample = sampleSkatePath(source, 0.5 * source.totalLength);
    const motion = {
      from: [sample.point[0] - 0.02, sample.point[1], sample.point[2]],
      to: [sample.point[0] + 0.02, sample.point[1], sample.point[2]],
      priorMode: 'airborne',
      priorSurfaceId: source.supportSurfaceId,
    };
    const state = {
      ...createPlanarSkater(world),
      mode: 'airborne',
      position: [...motion.to],
      forward: [1, 0, 0],
      speed: 3,
      groundHeight: 0,
      sessionId: 'source-lock',
      launchLockId: 'launch-lip-smooth-crest',
    };
    const result = stepGrind(state, {}, dt, world, motion);

    expect(result.state.mode).toBe('airborne');
    expect(result.state.railId).toBeNull();
    expect(result.state.launchLockId).toBe('launch-lip-smooth-crest');
  });
});
