import { describe, expect, it } from 'vitest';
import { normalize3 } from '../../js/game/core/planet-math.js';
import { createCityLayout } from '../../js/game/world/city-layout.js';
import { compileCityWorld } from '../../js/game/world/city-surfaces.js';
import { querySupport, sweepSkater } from '../../js/game/world/city-queries.js';
import { createNeutralInputFrame } from '../../js/game/input/actions.js';
import { createCitySkater, stepSkaterOnCity } from '../../js/game/core/city-skater.js';

const world = compileCityWorld(createCityLayout({ radius: 16, seed: 71 }));

function multiply(vector, amount) {
  return vector.map((value) => value * amount);
}

function finiteState(state) {
  return [...state.position, ...state.forward, ...state.supportNormal, state.speed, state.verticalSpeed]
    .every(Number.isFinite);
}

describe('createCitySkater', () => {
  it('createCitySkater_usesTheCompiledPreviewDefaultSpawn', () => {
    const previewWorld = compileCityWorld(createCityLayout({ radius: 16, seed: 2026 }));
    const skater = createCitySkater(previewWorld);

    expect(previewWorld.defaultSpawnId).toBe('spawn-2');
    expect(skater.surfaceId).toBe('street-2');
    expect(skater.position[2]).toBeGreaterThan(15);
  });

  it('createCitySkater_initializesSupportedNeutralStateAndFallsBackForUnknownSpawn', () => {
    const defaultSkater = createCitySkater(world);
    const requested = createCitySkater(world, world.spawnPoints.at(-1).id);
    const fallback = createCitySkater(world, 'missing-spawn');
    const support = querySupport(world, defaultSkater.position, {
      maxDrop: 0.02,
      maxRise: 0.02,
      previousSurfaceId: defaultSkater.surfaceId,
    });

    expect(defaultSkater.position.every(Number.isFinite)).toBe(true);
    expect(defaultSkater.mode).toBe('grounded');
    expect(defaultSkater.speed).toBe(0);
    expect(defaultSkater.surfaceId).toBe(support.surfaceId);
    expect(defaultSkater.supportNormal).toEqual(support.surfaceNormal);
    expect(Math.abs(support.clearance)).toBeLessThanOrEqual(0.02);
    expect(requested.surfaceId).toBe(world.spawnPoints.at(-1).surfaceId);
    expect(fallback.surfaceId).toBe(defaultSkater.surfaceId);
    expect(sweepSkater(world, defaultSkater.position, defaultSkater.position, 0.25).blocked)
      .toBe(false);
  });
});

describe('stepSkaterOnCity', () => {
  it.each([
    ['side', (point) => point, false],
    ['pole', ([x, y, z]) => [y, z, x], false],
    ['underside', ([x, y, z]) => [x, -y, -z], false],
    ['imported-box', (point) => point, true],
  ])('citySkater_airborneWallContactKeepsFallingAndLandsWithoutRespawn_%s', (_, transform, box) => {
    const contactWorld = compileCityWorld({ radius: 32, planetRadius: 32,
      surfaces: [], rails: [], buildings: [{ id: 'wall', position: transform([0, 32, 0]),
        normal: transform([0, 1, 0]), size: [2, 5, 2],
        ...(box ? { placement: { axes: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] } } : {}) }] });
    let state = { ...createCitySkater(contactWorld), position: transform([box ? 1.2 : 1.6, 34, 0]),
      forward: transform([-1, 0, 0]), mode: 'airborne', verticalSpeed: -1,
      groundRadius: 32, speed: 4, coyoteAgeMs: 101 };
    const initialRadius = Math.hypot(...state.position);
    const events = [];
    const first = stepSkaterOnCity(state, createNeutralInputFrame(), 1 / 60, contactWorld);
    expect(first.state.verticalSpeed).toBeLessThan(-1);
    expect(Math.hypot(...first.state.position)).toBeLessThan(initialRadius);
    state = first.state;
    for (let tick = 0; tick < 120; tick += 1) {
      const result = stepSkaterOnCity(state, createNeutralInputFrame(), 1 / 60, contactWorld);
      state = result.state;
      events.push(...result.events);
    }
    expect(state.mode).toBe('grounded');
    expect(Math.hypot(...state.position)).toBeCloseTo(32, 6);
    expect(events.filter((event) => event.type === 'landed')).toHaveLength(1);
    expect(events.some((event) => event.type === 'bailed')).toBe(false);
    expect(state.position.reduce((sum, value, axis) => sum + value * transform([1, 0, 0])[axis], 0)).toBeGreaterThan(1);
    const landedAt = [...state.position];
    state.forward = transform([1, 0, 0]);
    for (let tick = 0; tick < 60; tick += 1) {
      state = stepSkaterOnCity(state, { ...createNeutralInputFrame(), throttle: 1 }, 1 / 60, contactWorld).state;
    }
    expect(Math.hypot(...state.position.map((value, axis) => value - landedAt[axis]))).toBeGreaterThan(1);
    expect(state.mode).toBe('grounded');
  });
  it('citySkater_transportsHeadingToTheNewRadialTangentPlane', () => {
    const initial = { ...createCitySkater(world), forward: [0, 0, -1], speed: 8 };
    const result = stepSkaterOnCity(initial, createNeutralInputFrame(), 1 / 30, world);
    const gravityUp = normalize3(result.state.position);

    expect(result.state.mode).toBe('grounded');
    expect(Math.abs(result.state.forward.reduce((sum, value, axis) => (
      sum + value * gravityUp[axis]
    ), 0))).toBeLessThan(1e-6);
  });

  it('citySkater_landsOnCurrentRampHeight', () => {
    const ramp = world.surfaces.find((surface) => surface.type === 'ramp');
    const sample = ramp.centerline[Math.floor(ramp.centerline.length / 2)];
    const up = normalize3(sample);
    const support = querySupport(world, multiply(up, Math.hypot(...sample) + 0.3), {
      maxDrop: 1,
      maxRise: 1,
      previousSurfaceId: ramp.id,
    });
    const airborne = {
      ...createCitySkater(world),
      position: multiply(up, Math.hypot(...support.point) + 0.04),
      forward: support.tangent,
      mode: 'airborne',
      surfaceId: null,
      groundRadius: Math.hypot(...support.point),
      verticalSpeed: -4,
      coyoteAgeMs: 101,
    };
    const result = stepSkaterOnCity(airborne, createNeutralInputFrame(), 0.02, world);

    expect(result.state.mode).toBe('grounded');
    expect(result.state.surfaceId).toBe(ramp.id);
    expect(Math.hypot(...result.state.position)).toBeCloseTo(Math.hypot(...support.point), 2);
    expect(result.events.map(({ type }) => type)).toContain('landed');
  });

  it('citySkater_tracksTheCurrentRenderedSupportNormal', () => {
    const ramp = world.surfaces.find((surface) => surface.type === 'ramp');
    const support = querySupport(world, ramp.centerline[Math.floor(ramp.centerline.length / 2)], {
      maxDrop: 1,
      maxRise: 1,
      previousSurfaceId: ramp.id,
    });
    const state = {
      ...createCitySkater(world),
      position: support.point,
      forward: support.tangent,
      speed: 0,
      mode: 'grounded',
      surfaceId: ramp.id,
      supportNormal: [0, 1, 0],
    };
    const result = stepSkaterOnCity(state, createNeutralInputFrame(), 1 / 60, world);
    const currentSupport = querySupport(world, result.state.position, {
      maxDrop: 0.02,
      maxRise: 0.02,
      previousSurfaceId: ramp.id,
    });

    expect(currentSupport.surfaceId).toBe(ramp.id);
    expect(result.state.supportNormal).toEqual(currentSupport.surfaceNormal);
  });

  it('citySkater_doesNotJumpAgainWithoutGroundOrCoyoteTime', () => {
    const grounded = createCitySkater(world);
    const state = {
      ...grounded,
      mode: 'airborne',
      position: multiply(normalize3(grounded.position), 17),
      groundRadius: 16.3,
      verticalSpeed: 0,
      coyoteAgeMs: 101,
    };
    const result = stepSkaterOnCity(state, { ...createNeutralInputFrame(), jumpPressed: true }, 0.001, world);

    expect(result.events.some(({ type }) => type === 'jumped')).toBe(false);
    expect(result.state.verticalSpeed).toBeLessThan(0);
  });

  it.each([
    [99, true],
    [100, true],
    [101, false],
  ])('citySkater_coyoteJumpBoundary_%ims', (age, expected) => {
    const grounded = createCitySkater(world);
    const state = {
      ...grounded,
      mode: 'airborne',
      position: multiply(normalize3(grounded.position), Math.hypot(...grounded.position) + 0.5),
      groundRadius: Math.hypot(...grounded.position),
      verticalSpeed: 0,
      coyoteAgeMs: age,
    };
    const result = stepSkaterOnCity(state, { ...createNeutralInputFrame(), jumpPressed: true }, 0.001, world);

    expect(result.events.some(({ type }) => type === 'jumped')).toBe(expected);
  });

  it.each([
    [119, true],
    [120, true],
    [121, false],
  ])('citySkater_jumpBufferBoundary_%ims', (age, expected) => {
    const state = {
      ...createCitySkater(world),
      jumpBufferAgeMs: age,
    };
    const result = stepSkaterOnCity(state, createNeutralInputFrame(), 0.001, world);

    expect(result.events.some(({ type }) => type === 'jumped')).toBe(expected);
  });

  it('citySkater_traversesRampAscentAndDescentWithoutRadiusDrift', () => {
    const ramp = world.surfaces.find((surface) => surface.type === 'ramp');
    const skater = createCitySkater(world, `spawn-${world.surfaces.indexOf(ramp)}`);
    const rampStart = ramp.centerline[0];
    const support = querySupport(world, rampStart, {
      maxDrop: 0.1,
      maxRise: 0.1,
      previousSurfaceId: ramp.id,
    });
    const initialRadius = Math.hypot(...support.point);
    let state = {
      ...skater,
      position: support.point,
      forward: support.tangent,
      surfaceId: ramp.id,
      groundRadius: initialRadius,
      speed: 5,
    };
    let highestRadius = initialRadius;
    const input = { ...createNeutralInputFrame(), throttle: 0.4 };

    for (let tick = 0; tick < 90; tick += 1) {
      state = stepSkaterOnCity(state, input, 1 / 30, world).state;
      highestRadius = Math.max(highestRadius, Math.hypot(...state.position));
    }

    expect(highestRadius).toBeGreaterThan(initialRadius + 0.35);
    expect(Math.hypot(...state.position)).toBeLessThan(initialRadius + 0.2);
    expect(finiteState(state)).toBe(true);
  });

  it('citySkater_buildingCollisionStopsWithoutBailingOrRespawning', () => {
    const building = world.buildings[2];
    const normal = building.normal;
    const tangent = normalize3([normal[2], 0, -normal[0]]);
    const collisionRadius = building.collision.radius + 0.25;
    const nearWall = building.position.map((value, axis) => (
      value + normal[axis] * 0.2 + tangent[axis] * (collisionRadius + 0.1)
    ));
    const position = multiply(normalize3(nearWall), world.radius);
    const state = {
      ...createCitySkater(world),
      position,
      forward: tangent.map((value) => -value),
      speed: 12,
      mode: 'grounded',
    };
    const result = stepSkaterOnCity(state, createNeutralInputFrame(), 0.1, world);

    expect(result.state.mode).not.toBe('bailed');
    expect(result.state.mode).toBe('grounded');
    expect(result.state.speed).toBe(0);
    expect(result.state.verticalSpeed).toBe(0);
    expect(result.events.filter(({ type }) => type === 'bailed')).toHaveLength(0);

    let stopped = result;
    for (let tick = 0; tick < 6; tick += 1) {
      stopped = stepSkaterOnCity(stopped.state, createNeutralInputFrame(), 0.1, world);
    }
    expect(stopped.state.mode).not.toBe('bailed');
    expect(stopped.state.speed).toBe(0);
    expect(stopped.state.position).not.toEqual(createCitySkater(world).position);
    expect(stopped.events.filter(({ type }) => type === 'bailed')).toHaveLength(0);
  });

  it('citySkater_explicitContestCollisionResponseBailsAndRespawns', () => {
    const building = world.buildings[2];
    const normal = building.normal;
    const tangent = normalize3([normal[2], 0, -normal[0]]);
    const collisionRadius = building.collision.radius + 0.25;
    const position = building.position.map((value, axis) => (
      value + normal[axis] * 0.2 + tangent[axis] * (collisionRadius + 0.1)
    ));
    const state = {
      ...createCitySkater(world),
      position,
      forward: tangent.map((value) => -value),
      speed: 12,
      mode: 'grounded',
    };
    const result = stepSkaterOnCity(
      state,
      createNeutralInputFrame(),
      0.1,
      world,
      { collisionResponse: 'bail' },
    );

    expect(result.state.mode).toBe('bailed');
    expect(result.events.filter(({ type }) => type === 'bailed')).toHaveLength(1);

    let waiting = result;
    for (let tick = 0; tick < 4; tick += 1) {
      waiting = stepSkaterOnCity(waiting.state, createNeutralInputFrame(), 0.1, world);
    }
    waiting = stepSkaterOnCity(waiting.state, createNeutralInputFrame(), 0.099, world);
    const respawned = stepSkaterOnCity(waiting.state, createNeutralInputFrame(), 0.002, world);
    expect(waiting.state.mode).toBe('bailed');
    expect(respawned.state.mode).toBe('grounded');
    expect(respawned.events).toEqual([]);
  });

  it('citySkater_recoversFromNonfiniteStateWithoutPropagatingNaN', () => {
    const invalid = { ...createCitySkater(world), position: [Number.NaN, 0, 0] };
    const result = stepSkaterOnCity(invalid, createNeutralInputFrame(), 1 / 60, world);

    expect(finiteState(result.state)).toBe(true);
    expect(result.state.mode).toBe('grounded');
    expect(result.events.filter(({ type }) => type === 'bailed')).toHaveLength(1);
  });
});
