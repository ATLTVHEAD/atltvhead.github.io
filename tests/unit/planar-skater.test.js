import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createPlanarSkater, stepSkaterOnPlanarCity } from '../../js/game/core/planar-skater.js';
import { createPlanarCityLayout } from '../../js/game/world/planar-city-layout.js';
import { compilePlanarWorld } from '../../js/game/world/planar-city-surfaces.js';
import { queryPlanarSupport, sweepPlanarSkater } from '../../js/game/world/planar-city-queries.js';
import { compileSkatePath } from '../../js/game/world/skate-paths.js';

const manifest = JSON.parse(readFileSync(new URL('../../assets/game/manifest.json', import.meta.url)));
const world = compilePlanarWorld(createPlanarCityLayout({ assetManifest: manifest }));
const NEUTRAL = Object.freeze({
  steer: 0,
  throttle: 0,
  brake: 0,
  grindHeld: false,
  jumpPressed: false,
  trickPressed: null,
  tagPressed: false,
  emotePressed: null,
});

function deepFreeze(value, visited = new Set()) {
  if (!value || typeof value !== 'object' || visited.has(value)) return value;
  visited.add(value);
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child, visited);
  return value;
}

function planarState(position, forward, overrides = {}) {
  const support = queryPlanarSupport(world, position, {
    maxDrop: 0.5,
    maxRise: 0.5,
    previousSurfaceId: overrides.surfaceId,
  });
  return {
    ...createPlanarSkater(world),
    position: support?.point ?? [...position],
    forward: [...forward],
    supportNormal: support?.surfaceNormal ?? [0, 1, 0],
    gravityUp: [0, 1, 0],
    speed: 0,
    mode: 'grounded',
    surfaceId: support?.surfaceId ?? 'ground',
    groundHeight: support?.point[1] ?? 0,
    verticalSpeed: 0,
    ...overrides,
  };
}

function wallApproach(buildingId, y = 3) {
  const building = world.buildings.find((entry) => entry.id === buildingId);
  const axis = building.collision.axes[2];
  const distance = building.collision.halfExtents[2] + 0.3;
  return {
    building,
    position: [
      building.collision.center[0] + axis[0] * distance,
      y,
      building.collision.center[2] + axis[2] * distance,
    ],
    forward: [-axis[0], 0, -axis[2]],
    away: [...axis],
  };
}

function unitState(state) {
  return [
    ...state.position,
    ...state.forward,
    ...state.supportNormal,
    ...state.gravityUp,
    state.speed,
    state.verticalSpeed,
    state.groundHeight,
  ].every(Number.isFinite);
}

describe('planar city skater', () => {
  it('skater_planarDescriptorAdvertisesTuningVersionTwo', () => {
    expect(world.descriptor.tuningVersion).toBe(2);
  });

  it('skater_planarOriginAndAirborneAreFinite', () => {
    const created = createPlanarSkater(world);
    const origin = {
      ...created,
      position: [0, 0.2, 0],
      forward: [0, 0, 1],
      supportNormal: [0, 1, 0],
      gravityUp: [0, 1, 0],
      groundHeight: 0,
      mode: 'airborne',
      speed: 3,
      verticalSpeed: 0,
    };
    const result = stepSkaterOnPlanarCity(origin, { throttle: 1 }, 1 / 60, world);

    expect(created.spawnId).toBe('spawn-plaza');
    expect(created.mode).toBe('grounded');
    expect(created.position).toEqual([202, 0, 130]);
    expect(created.groundHeight).toBe(0);
    expect(created.gravityUp).toEqual([0, 1, 0]);
    expect(unitState(result.state)).toBe(true);
    expect(result.state.position[0]).toBeCloseTo(0, 8);
    expect(result.state.position[2]).toBeGreaterThan(0);
    expect(result.state.gravityUp).toEqual([0, 1, 0]);
    expect(result.state.supportNormal).toEqual([0, 1, 0]);
  });

  it('skater_authoredLineSpawnStartsOnItsConnectedLaunchDeck', () => {
    const lineSpawn = createPlanarSkater(world, 'spawn-skate-line');

    expect(lineSpawn.position).toEqual([124, 0, 80]);
    expect(lineSpawn.surfaceId).toBe('line-smooth-crest-exit:deck');
    expect(lineSpawn.mode).toBe('grounded');
  });

  it('skater_lapReturnsOnBothAxesAndDirections', () => {
    const laps = [
      { axis: 'x', direction: 1, start: [128, 0, 30], forward: [1, 0, 0], surfaceId: 'street-wrap-x-west' },
      { axis: 'x', direction: -1, start: [128, 0, 30], forward: [-1, 0, 0], surfaceId: 'street-wrap-x-west' },
      { axis: 'z', direction: 1, start: [20, 0, 128], forward: [0, 0, 1], surfaceId: 'street-wrap-z-south' },
      { axis: 'z', direction: -1, start: [20, 0, 128], forward: [0, 0, -1], surfaceId: 'street-wrap-z-south' },
    ];

    for (const lap of laps) {
      const state = planarState(lap.start, lap.forward, {
        surfaceId: lap.surfaceId,
        speed: 12,
        spawnId: lap.axis === 'x' ? 'spawn-wrap-x' : 'spawn-wrap-z',
      });
      const start = [...state.position];
      let current = state;
      for (let step = 0; step < 1280; step += 1) {
        current = stepSkaterOnPlanarCity(current, { throttle: 1 }, 1 / 60, world).state;
      }
      const axis = lap.axis === 'x' ? 0 : 2;
      const crossAxis = lap.axis === 'x' ? 2 : 0;
      expect(current.position[axis], `${lap.axis} direction ${lap.direction}`).toBeCloseTo(start[axis], 2);
      expect(current.position[crossAxis], `${lap.axis} cross-axis ${lap.direction}`).toBeCloseTo(start[crossAxis], 2);
      expect(current.speed).toBe(12);
      expect(current.tick).toBe(1280);
      expect(current.position[0]).toBeGreaterThanOrEqual(0);
      expect(current.position[0]).toBeLessThan(256);
      expect(current.position[2]).toBeGreaterThanOrEqual(0);
      expect(current.position[2]).toBeLessThan(256);
    }
  });

  it('skater_wallStopStillFallsAndCanEscape', () => {
    const wall = wallApproach('alley-wall-1-left');
    const state = planarState(wall.position, wall.forward, {
      mode: 'airborne',
      groundHeight: 0,
      speed: 12,
      verticalSpeed: 0,
      tick: 17,
      sessionId: 'wall-session',
    });
    const impact = stepSkaterOnPlanarCity(state, { throttle: 1 }, 0.05, world);

    expect(impact.state.speed).toBe(0);
    expect(impact.state.mode).toBe('airborne');
    expect(impact.state.position[1]).toBeLessThan(state.position[1]);
    expect(impact.state.verticalSpeed).toBeLessThan(0);
    expect(impact.events).toEqual([]);

    const escaped = stepSkaterOnPlanarCity({
      ...impact.state,
      forward: wall.away,
      speed: 1,
    }, { throttle: 0.5 }, 0.05, world);
    const awayBefore = (impact.state.position[0] - wall.building.collision.center[0]) * wall.away[0]
      + (impact.state.position[2] - wall.building.collision.center[2]) * wall.away[2];
    const awayAfter = (escaped.state.position[0] - wall.building.collision.center[0]) * wall.away[0]
      + (escaped.state.position[2] - wall.building.collision.center[2]) * wall.away[2];
    expect(awayAfter).toBeGreaterThan(awayBefore);
    expect(escaped.state.speed).toBeGreaterThan(0);

    const bail = stepSkaterOnPlanarCity(state, { throttle: 1 }, 0.05, world, {
      collisionResponse: 'bail',
      bailDurationMs: 500,
    });
    expect(bail.state.mode).toBe('bailed');
    expect(bail.state.bailRemainingMs).toBe(500);
    expect(bail.events).toEqual([{
      eventId: 'wall-session:18:1', eventIndex: 1, tick: 18, type: 'bailed', hitId: wall.building.id,
    }]);
    let bailed = bail.state;
    for (let index = 0; index < 4; index += 1) {
      bailed = stepSkaterOnPlanarCity(bailed, NEUTRAL, 0.1, world).state;
    }
    expect(bailed.mode).toBe('bailed');
    expect(bailed.bailRemainingMs).toBeCloseTo(100, 8);
    const respawned = stepSkaterOnPlanarCity(bailed, NEUTRAL, 0.1, world).state;
    expect(respawned.mode).toBe('grounded');
    expect(respawned.spawnId).toBe(state.spawnId);
    expect(respawned.position).toEqual(createPlanarSkater(world, state.spawnId).position);
    expect(respawned.eventIndex).toBe(1);
  });

  it('skater_rampJumpBufferAndCoyoteBoundaries', () => {
    const rampState = planarState([94, 0, 161], [0, 0, 1], {
      surfaceId: 'plaza-ramp',
      speed: 0,
      tick: 10,
      sessionId: 'ramp-session',
    });
    const jumped = stepSkaterOnPlanarCity(rampState, { jumpPressed: true }, 0.1, world);
    expect(jumped.state.mode).toBe('airborne');
    expect(jumped.state.groundHeight).toBeGreaterThan(0);
    expect(jumped.state.position[1]).toBeCloseTo(jumped.state.groundHeight + 0.53, 8);
    expect(jumped.state.verticalSpeed).toBeCloseTo(4.6, 8);
    expect(jumped.events).toEqual([{
      eventId: 'ramp-session:11:1', eventIndex: 1, tick: 11, type: 'jumped',
      surfaceId: 'plaza-ramp',
    }]);
    expect(jumped.state.gravityUp).toEqual([0, 1, 0]);
    expect(jumped.state.supportNormal).toEqual([0, 1, 0]);

    for (const [age, shouldJump] of [[120, true], [121, false]]) {
      const falling = planarState([100, 0.01, 100], [0, 0, 1], {
        mode: 'airborne',
        groundHeight: 0,
        verticalSpeed: -1,
        coyoteAgeMs: 500,
        jumpBufferAgeMs: age,
        speed: 0,
      });
      const result = stepSkaterOnPlanarCity(falling, NEUTRAL, 0.016, world);
      expect(result.events.some((event) => event.type === 'landed')).toBe(true);
      expect(result.events.some((event) => event.type === 'jumped')).toBe(shouldJump);
      expect(result.state.mode).toBe(shouldJump ? 'airborne' : 'grounded');
    }

    for (const [age, shouldJump] of [[100, true], [101, false]]) {
      const justLeft = planarState([100, 3, 100], [0, 0, 1], {
        mode: 'airborne',
        groundHeight: 0,
        verticalSpeed: 0,
        coyoteAgeMs: age,
        jumpBufferAgeMs: 121,
        speed: 0,
      });
      const result = stepSkaterOnPlanarCity(justLeft, { jumpPressed: true }, 0.016, world);
      expect(result.events.some((event) => event.type === 'jumped')).toBe(shouldJump);
      if (shouldJump) expect(result.state.verticalSpeed).toBeCloseTo(5.776, 8);
    }
  });

  it('launch_crossingAt3GetsUpwardSpeed4OnceWithoutCapturingItsSourcePath', () => {
    const approach = planarState([131.95, 1.2, 80], [1, 0, 0], {
      surfaceId: 'line-smooth-crest-exit:deck',
      spawnId: 'spawn-skate-line',
      speed: 3,
      tick: 8,
      sessionId: 'launch-boundary',
    });
    const result = stepSkaterOnPlanarCity(approach, NEUTRAL, 1 / 60, world, {
      coastingDrag: 0,
    });

    expect(result.state.mode).toBe('airborne');
    expect(result.state.verticalSpeed).toBe(4);
    expect(result.state.speed).toBe(3);
    expect(result.state.railId).toBeNull();
    expect(result.state.launchLockId).toBe('launch-lip-smooth-crest');
    expect(result.state.eventIndex).toBe(1);
    expect(result.events).toEqual([{
      eventId: 'launch-boundary:9:1',
      eventIndex: 1,
      tick: 9,
      type: 'launched',
      markerId: 'launch-lip-smooth-crest',
      speed: 3,
      verticalSpeed: 4,
    }]);
  });

  it('launch_manualJumpWinsAndConsumesTheLipCrossing', () => {
    const approach = planarState([131.95, 1.2, 80], [1, 0, 0], {
      surfaceId: 'line-smooth-crest-exit:deck',
      spawnId: 'spawn-skate-line',
      speed: 3,
      tick: 14,
      sessionId: 'manual-lip',
    });
    const result = stepSkaterOnPlanarCity({ ...approach, eventIndex: 6 }, {
      ...NEUTRAL,
      jumpPressed: true,
    }, 1 / 60, world, { coastingDrag: 0 });

    expect(result.state.mode).toBe('airborne');
    expect(result.state.verticalSpeed).toBeCloseTo(6 - 14 / 60, 8);
    expect(result.state.launchLockId).toBe('launch-lip-smooth-crest');
    expect(result.state.eventIndex).toBe(7);
    expect(result.events.map((event) => event.type)).toEqual(['jumped']);
    expect(result.events[0].eventIndex).toBe(7);
  });

  it('launch_rejectsSpeedBelowThree', () => {
    const approach = planarState([131.95, 1.2, 80], [1, 0, 0], {
      surfaceId: 'line-smooth-crest-exit:deck',
      spawnId: 'spawn-skate-line',
      speed: 2.999,
    });
    const result = stepSkaterOnPlanarCity(approach, NEUTRAL, 1 / 60, world, {
      coastingDrag: 0,
    });

    expect(result.state.mode).toBe('grounded');
    expect(result.events.some((event) => event.type === 'launched')).toBe(false);
  });

  it('launch_requiresAnAuthoredMarker', () => {
    const approach = planarState([131.95, 1.2, 80], [1, 0, 0], {
      surfaceId: 'line-smooth-crest-exit:deck',
      spawnId: 'spawn-skate-line',
      speed: 3,
    });
    const unmarkedWorld = { ...world, launchMarkers: [] };
    const result = stepSkaterOnPlanarCity(approach, NEUTRAL, 1 / 60, unmarkedWorld, {
      coastingDrag: 0,
    });

    expect(result.state.mode).toBe('grounded');
    expect(result.state.launchLockId).toBeNull();
    expect(result.events.some((event) => event.type === 'launched')).toBe(false);
  });

  it('launch_reverseCrossingDoesNotFire', () => {
    const approach = planarState([132.05, 1.2, 80], [-1, 0, 0], {
      surfaceId: 'line-smooth-crest-exit:deck',
      spawnId: 'spawn-skate-line',
      speed: 3,
    });
    const result = stepSkaterOnPlanarCity(approach, NEUTRAL, 1 / 60, world, {
      coastingDrag: 0,
    });

    expect(result.state.mode).toBe('grounded');
    expect(result.state.launchLockId).toBeNull();
    expect(result.events.some((event) => event.type === 'launched')).toBe(false);
  });

  it('launch_markerImageFiresOnlyOnceAcrossTheSeam', () => {
    const marker = world.launchMarkers.find((entry) => entry.id === 'launch-lip-smooth-crest');
    const seamWorld = {
      ...world,
      launchMarkers: [{ ...marker, point: [0, marker.point[1], marker.point[2]] }],
    };
    const approach = {
      ...createPlanarSkater(seamWorld, 'spawn-skate-line'),
      position: [255.95, 1.2, 80],
      forward: [1, 0, 0],
      speed: 3,
      mode: 'grounded',
      surfaceId: 'line-smooth-crest-exit:deck',
      groundHeight: 1.2,
      tick: 31,
      sessionId: 'seam-lip',
    };
    const result = stepSkaterOnPlanarCity(approach, NEUTRAL, 1 / 60, seamWorld, {
      coastingDrag: 0,
    });

    expect(result.events.filter((event) => event.type === 'launched')).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      eventId: 'seam-lip:32:1',
      eventIndex: 1,
      markerId: 'launch-lip-smooth-crest',
    });
    expect(result.state.launchLockId).toBe('launch-lip-smooth-crest');
  });

  it('grind_captureUsesTheActualAirborneMotionSweep', () => {
    const approach = {
      ...createPlanarSkater(world, 'spawn-skate-line'),
      position: [133.49, 2.1, 80],
      forward: [1, 0, 0],
      speed: 3,
      mode: 'airborne',
      groundHeight: 0,
      verticalSpeed: 0,
      coyoteAgeMs: 101,
      tick: 20,
      sessionId: 'air-capture',
    };
    const result = stepSkaterOnPlanarCity(approach, NEUTRAL, 1 / 60, world);

    expect(result.state.mode).toBe('grinding');
    expect(result.state.railId).toBe('line-pipe-capture');
    expect(result.state.railDirection).toBe(1);
    expect(result.events.map((event) => event.type)).toEqual(['grindStarted']);
    expect(result.events[0]).toMatchObject({
      eventId: 'air-capture:21:1',
      eventIndex: 1,
      pathId: 'line-pipe-capture',
      direction: 1,
    });
  });

  it('grind_planarUpAndSeamAdjacentSweepRemainContinuous', () => {
    const path = compileSkatePath({
      id: 'seam-line',
      type: 'rail',
      gravityUp: [0, 1, 0],
      points: [[255.8, 1.2, 80], [256.2, 1.2, 80]],
    });
    const seamWorld = { ...world, rails: [path] };
    const approach = {
      ...createPlanarSkater(seamWorld),
      position: [255.95, 1.2, 80],
      forward: [1, 0, 0],
      speed: 3,
      mode: 'airborne',
      groundHeight: 1.2,
      verticalSpeed: 0,
      coyoteAgeMs: 101,
      tick: 10,
      sessionId: 'seam-grind',
    };
    const captured = stepSkaterOnPlanarCity(approach, NEUTRAL, 0.02, seamWorld);
    const crossed = stepSkaterOnPlanarCity(captured.state, NEUTRAL, 0.02, seamWorld);
    const continued = stepSkaterOnPlanarCity(crossed.state, NEUTRAL, 0.02, seamWorld);
    const wrappedDistance = (first, second) => {
      const distance = Math.abs(first - second);
      return Math.min(distance, 256 - distance);
    };

    expect(captured.state.mode).toBe('grinding');
    expect(captured.state.railId).toBe('seam-line');
    expect(crossed.state.mode).toBe('grinding');
    expect(crossed.state.position[0]).toBeGreaterThanOrEqual(0);
    expect(crossed.state.position[0]).toBeLessThan(0.1);
    expect(wrappedDistance(crossed.state.position[0], captured.state.position[0]))
      .toBeLessThan(0.1);
    expect(continued.state.mode).toBe('grinding');
    expect(wrappedDistance(continued.state.position[0], crossed.state.position[0])).toBeLessThan(0.1);
    expect(continued.state.railDistance - crossed.state.railDistance).toBeCloseTo(0.05928, 8);
    expect([captured.state.position[1], crossed.state.position[1], continued.state.position[1]])
      .toEqual([1.2, 1.2, 1.2]);
  });

  it('skater_doglegTraversalUsesRealQueries', () => {
    let current = planarState([60, 0, 33], [0, 0, 1], {
      surfaceId: 'alley-dogleg',
      speed: 0,
      spawnId: 'spawn-wrap-x',
    });
    const visited = new Set([current.surfaceId]);
    let collisions = 0;
    for (let step = 0; step < 3000 && current.position[2] < 190; step += 1) {
      let steer = 0;
      const headingAngle = Math.atan2(current.forward[0], current.forward[2]);
      const steeringFactor = 1 - 0.5 * Math.min(1, current.speed / 12);
      const maxTurnThisStep = 2.6 * steeringFactor / 30;
      if (current.position[2] > 107.3 && current.position[0] < 70 && headingAngle < Math.PI / 2) {
        steer = -Math.min(0.7, (Math.PI / 2 - headingAngle) / maxTurnThisStep);
      } else if (current.position[0] > 157.3 && current.position[2] < 130 && headingAngle > 0) {
        steer = Math.min(0.7, headingAngle / maxTurnThisStep);
      }
      let input = { throttle: 0.65, brake: 0, steer };
      if (current.speed > 4) input = { ...input, throttle: 0.15, brake: 0.25 };
      const previous = current;
      current = stepSkaterOnPlanarCity(current, input, 1 / 30, world).state;
      visited.add(current.surfaceId);
      const sweep = sweepPlanarSkater(world, previous.position, current.position, 0.25);
      if (sweep.blocked) collisions += 1;
      expect(unitState(current)).toBe(true);
      expect(current.mode).toBe('grounded');
    }

    expect(current.position[2]).toBeGreaterThan(185);
    expect(current.position[0]).toBeGreaterThan(155);
    expect(visited.has('alley-dogleg')).toBe(true);
    expect(collisions).toBe(0);
  });

  it('skater_groundApproachCannotSnapToUnconnectedRail', () => {
    const approach = planarState([90, 0, 170], [1, 0, 0], {
      surfaceId: 'ground',
      speed: 12,
    });
    const first = stepSkaterOnPlanarCity(approach, { throttle: 1 }, 0.1, world).state;
    const crossedRail = stepSkaterOnPlanarCity(first, { throttle: 1 }, 0.1, world).state;

    expect(first.surfaceId).toBe('ground');
    expect(crossedRail.surfaceId).toBe('ground');
    expect(crossedRail.position[1]).toBe(0);
    expect(crossedRail.groundHeight).toBe(0);
  });

  it('skater_invalidStateRecoversAtSafeSpawn', () => {
    const invalid = {
      ...createPlanarSkater(world, 'spawn-wrap-x'),
      position: [Number.NaN, 0, 30],
      tick: 22,
      sessionId: 'recovery-session',
    };
    const result = stepSkaterOnPlanarCity(invalid, NEUTRAL, 1 / 60, world);

    expect(result.state.mode).toBe('grounded');
    expect(result.state.spawnId).toBe('spawn-wrap-x');
    expect(result.state.position).toEqual(createPlanarSkater(world, 'spawn-wrap-x').position);
    expect(result.state.tick).toBe(23);
    expect(result.state.sessionId).toBe('recovery-session');
    expect(result.events).toEqual([{
      eventId: 'recovery-session:23:1', eventIndex: 1, tick: 23, type: 'bailed', reason: 'invalid-state',
    }]);
  });

  it('skater_invalidDeltasAreNoOpsAndLargeDeltasAreCappedWithoutMutation', () => {
    const original = planarState([224, 0, 30], [1, 0, 0], {
      spawnId: 'spawn-wrap-x',
      surfaceId: 'street-wrap-x-west',
      speed: 12,
      tick: 4,
    });
    const frozenState = deepFreeze(structuredClone(original));
    const frozenWorld = deepFreeze(world);
    const frozenInput = deepFreeze({ throttle: 1, steer: 0 });

    for (const delta of [0, Number.NaN, -0.01]) {
      const result = stepSkaterOnPlanarCity(frozenState, frozenInput, delta, frozenWorld);
      expect(result.events).toEqual([]);
      expect(result.state).toEqual(original);
      expect(result.state).not.toBe(frozenState);
    }
    const capped = stepSkaterOnPlanarCity(frozenState, frozenInput, 0.5, frozenWorld);
    expect(capped.state.position[0]).toBeCloseTo(225.2, 8);
    expect(capped.state.position[2]).toBe(30);
    expect(capped.state.tick).toBe(5);
    expect(frozenState).toEqual(original);
    expect(frozenInput).toEqual({ throttle: 1, steer: 0 });
    expect(world.width).toBe(256);
  });
});
