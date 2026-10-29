import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createPlanarCityLayout } from '../../js/game/world/planar-city-layout.js';
import { compilePlanarWorld } from '../../js/game/world/planar-city-surfaces.js';
import { sweepPlanarSkater } from '../../js/game/world/planar-city-queries.js';
import {
  createFollowCameraState,
  updateFollowCamera,
} from '../../js/game/render/follow-camera.js';

const NEUTRAL_CAMERA = { yawDelta: 0, pitchDelta: 0, zoomDelta: 0 };
const manifest = JSON.parse(readFileSync(new URL('../../assets/game/manifest.json', import.meta.url)));
const PLANAR_WORLD = compilePlanarWorld(createPlanarCityLayout({ assetManifest: manifest }));
const OPEN_PLANAR_WORLD = { width: 256, depth: 256, buildings: [], colliders: [], surfaces: [] };
const OPEN_WORLD = OPEN_PLANAR_WORLD;

function skater(position = [100, 0, 100], forward = [0, 0, 1], speed = 5) {
  return planarSkater(position, forward, speed);
}

function distance(a, b) {
  return Math.hypot(...a.map((value, axis) => value - b[axis]));
}

function planarSkater(position, forward = [1, 0, 0], speed = 5) {
  return {
    position: [...position],
    forward: [...forward],
    speed,
    mode: 'grounded',
    supportNormal: [0, 1, 0],
    gravityUp: [0, 1, 0],
    surfaceId: 'ground',
  };
}

function forEachInterpolatedCenterline(surface, visit) {
  const points = surface.centerline ?? [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const delta = [end[0] - start[0], end[1] - start[1], end[2] - start[2]];
    const horizontalLength = Math.hypot(delta[0], delta[2]);
    const steps = Math.max(1, Math.ceil(Math.hypot(...delta) / 0.5));
    const forward = horizontalLength > 1e-9
      ? [delta[0] / horizontalLength, 0, delta[2] / horizontalLength]
      : [0, 0, 1];
    for (let step = 1; step <= steps; step += 1) {
      const progress = step / steps;
      visit(start.map((value, axis) => value + delta[axis] * progress), forward);
    }
  }
}

describe('updateFollowCamera', () => {
  it('followCamera_defaultBoomKeepsTheSkaterAtAnUrbanThirdPersonScale', () => {
    const state = createFollowCameraState(skater(), OPEN_WORLD);

    expect(state.actualBoomLength).toBeGreaterThan(7.5);
  });

  it('followCamera_traversesAConnectedRouteWithoutManualLook', () => {
    let camera = null;
    let visited = 0;

    for (const surface of PLANAR_WORLD.surfaces) {
      if (!surface.centerline?.length) continue;
      for (let index = 0; index < surface.centerline.length; index += 1) {
        const position = surface.centerline[index];
        const before = surface.centerline[Math.max(0, index - 1)];
        const after = surface.centerline[Math.min(surface.centerline.length - 1, index + 1)];
        const forwardDelta = [after[0] - before[0], 0, after[2] - before[2]];
        const forwardLength = Math.hypot(...forwardDelta);
        const forward = forwardLength > 1e-9
          ? forwardDelta.map((value) => value / forwardLength)
          : [0, 0, 1];
        camera = updateFollowCamera(
          camera, skater(position, forward, 5), NEUTRAL_CAMERA, OPEN_WORLD, 1 / 60,
        );
        expect(camera.position.every(Number.isFinite)).toBe(true);
        expect(camera.target.every(Number.isFinite)).toBe(true);
        expect(distance(camera.position, position)).toBeGreaterThan(3);
        visited += 1;
      }
    }

    expect(visited).toBeGreaterThan(50);
    expect(camera.followDirection.every(Number.isFinite)).toBe(true);
  });

  it('followCamera_cameraBoomStaysAboveGroundAndOutsideBuildingsAlongTheRoute', () => {
    const world = PLANAR_WORLD;
    let camera = null;
    let visited = 0;

    for (const surface of world.surfaces) {
      if (!surface.centerline?.length) continue;
      camera = null;
      forEachInterpolatedCenterline(surface, (position, forward) => {
        camera = updateFollowCamera(camera, {
          ...planarSkater(position, forward, 10),
          surfaceId: surface.id,
        }, NEUTRAL_CAMERA, world, 0.05);
        expect(camera.position[1]).toBeGreaterThanOrEqual(0.45);
        expect(sweepPlanarSkater(world, camera.target, camera.position, 0.18).blocked).toBe(false);
        visited += 1;
      });
    }

    expect(visited).toBeGreaterThan(100);
  });

  it('followCamera_usesConstantUpAcrossTheCity', () => {
    let camera = null;
    for (const surface of PLANAR_WORLD.surfaces) {
      if (!surface.centerline?.length) continue;
      const position = surface.centerline[Math.floor(surface.centerline.length / 2)];
      camera = updateFollowCamera(
        camera,
        planarSkater(position, [1, 0, 0], 4),
        NEUTRAL_CAMERA,
        OPEN_WORLD,
        1 / 60,
      );
      expect(camera.up).toEqual([0, 1, 0]);
      expect(camera.followDirection[1]).toBeCloseTo(0, 6);
    }
  });

  it('followCamera_stopReverseAndTricksDoNotSnap', () => {
    const moving = skater();
    const initial = createFollowCameraState(moving);
    const stopped = updateFollowCamera(initial, {
      ...moving,
      speed: 0,
      forward: [0, 0, -1],
      trickId: 'spin',
    }, NEUTRAL_CAMERA, OPEN_WORLD, 1 / 60);
    const reversing = updateFollowCamera(stopped, {
      ...moving,
      forward: [0, 0, -1],
      animationId: 'spin',
    }, NEUTRAL_CAMERA, OPEN_WORLD, 1 / 60);

    expect(stopped.followDirection[2]).toBeGreaterThan(0.99);
    expect(distance(initial.position, stopped.position)).toBeLessThan(0.3);
    expect(reversing.followDirection[2]).toBeGreaterThan(0.95);
    expect(distance(stopped.position, reversing.position)).toBeLessThan(0.5);
  });

  it('followCamera_collisionShortensTheBoomAndRecoversSmoothly', () => {
    const player = skater();
    const initial = createFollowCameraState(player);
    const clear = updateFollowCamera(initial, player, NEUTRAL_CAMERA, OPEN_WORLD, 1 / 60);
    const midpoint = clear.target.map((value, axis) => (value + clear.position[axis]) / 2);
    const halfExtents = [0.45, 0.45, 0.45];
    const wall = {
      id: 'camera-wall',
      collision: {
        type: 'box',
        center: midpoint,
        axes: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
        halfExtents,
      },
      bounds: {
        min: midpoint.map((value, axis) => value - halfExtents[axis]),
        max: midpoint.map((value, axis) => value + halfExtents[axis]),
      },
    };
    const blockedWorld = {
      ...OPEN_WORLD,
      buildings: [wall],
      colliders: [wall],
    };
    const blocked = updateFollowCamera(initial, player, NEUTRAL_CAMERA, blockedWorld, 1 / 60);
    const recovered = updateFollowCamera(blocked, player, NEUTRAL_CAMERA, OPEN_WORLD, 0.1);
    const clearLength = distance(clear.position, clear.target);
    const blockedLength = distance(blocked.position, blocked.target);
    const recoveredLength = distance(recovered.position, recovered.target);

    expect(blockedLength).toBeLessThan(clearLength);
    expect(recoveredLength).toBeGreaterThan(blockedLength);
    expect(recoveredLength).toBeLessThan(clearLength);
    expect(blocked.position[1]).toBeGreaterThanOrEqual(0.45);
  });

  it('followCamera_manualReleaseRecentersOnlyAfter1500msAndOnlyWhileMoving', () => {
    const player = skater();
    const initial = {
      ...createFollowCameraState(player),
      orbitOffset: { yaw: 0.8, pitch: 0.2 },
      manualIdleMs: 1498,
    };
    const beforeBoundary = updateFollowCamera(initial, { ...player, speed: 0 }, NEUTRAL_CAMERA, OPEN_WORLD, 0.001);
    const stationary = updateFollowCamera(beforeBoundary, { ...player, speed: 0 }, NEUTRAL_CAMERA, OPEN_WORLD, 0.01);
    const moving = updateFollowCamera(beforeBoundary, player, NEUTRAL_CAMERA, OPEN_WORLD, 0.01);

    expect(beforeBoundary.manualIdleMs).toBeCloseTo(1499);
    expect(beforeBoundary.orbitOffset.yaw).toBeCloseTo(0.8);
    expect(stationary.orbitOffset.yaw).toBeCloseTo(0.8);
    expect(moving.orbitOffset.yaw).toBeLessThan(0.8);
    expect(moving.manualIdleMs).toBeGreaterThanOrEqual(1500);
  });

  it('followCamera_appliesUserLookAndClampsZoomToThreeThroughEight', () => {
    const player = skater();
    const initial = createFollowCameraState(player);
    const zoomedIn = updateFollowCamera(initial, player, {
      yawDelta: 0.3,
      pitchDelta: 0.2,
      zoomDelta: -100,
    }, OPEN_WORLD, 1 / 60);
    const zoomedOut = updateFollowCamera(zoomedIn, player, {
      ...NEUTRAL_CAMERA,
      zoomDelta: 100,
    }, OPEN_WORLD, 1 / 60);

    expect(zoomedIn.orbitOffset.yaw).toBeCloseTo(0.3);
    expect(zoomedIn.orbitOffset.pitch).toBeCloseTo(0.2);
    expect(zoomedIn.boomLength).toBe(3);
    expect(zoomedOut.boomLength).toBe(8);
  });

  it('camera_wrapRebasePreservesRelativePose', () => {
    const seamCrossings = [
      { from: [255.9, 0, 30], to: [0.1, 0, 30] },
      { from: [0.1, 0, 30], to: [255.9, 0, 30] },
      { from: [255.9, 0, 255.9], to: [0.1, 0, 0.1] },
    ];

    for (const { from, to } of seamCrossings) {
      let previous = createFollowCameraState(planarSkater(from), OPEN_PLANAR_WORLD);
      const next = updateFollowCamera(
        previous, planarSkater(to), NEUTRAL_CAMERA, OPEN_PLANAR_WORLD, 1 / 60,
      );
      const previousCameraOffset = previous.position.map((value, axis) => value - from[axis]);
      const nextCameraOffset = next.position.map((value, axis) => value - to[axis]);
      const previousTargetOffset = previous.target.map((value, axis) => value - from[axis]);
      const nextTargetOffset = next.target.map((value, axis) => value - to[axis]);

      expect(distance(previousCameraOffset, nextCameraOffset)).toBeLessThan(0.5);
      expect(distance(previousTargetOffset, nextTargetOffset)).toBeLessThan(0.5);
      expect(next.lastSkaterPosition).toEqual(to);
      expect(next.up).toEqual([0, 1, 0]);
      expect(next.position[1]).toBeGreaterThanOrEqual(0.45);
      previous = next;
      expect(previous.lastSkaterPosition).toEqual(to);
    }
  });

  it('camera_collisionChecksSmoothedBoomInTightTurn', () => {
    const wall = {
      id: 'tight-turn-wall',
      collision: {
        type: 'box',
        center: [105, 3, 97],
        axes: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
        halfExtents: [0.35, 3, 1.6],
      },
      bounds: { min: [104.65, 0, 95.4], max: [105.35, 6, 98.6] },
    };
    const world = { ...OPEN_PLANAR_WORLD, buildings: [wall], colliders: [wall] };
    const player = planarSkater([100, 0, 100], [0, 0, 1], 0);
    const prior = createFollowCameraState(player, OPEN_PLANAR_WORLD);
    prior.position = [110.6, 4.2, 92.5];
    prior.actualBoomLength = distance(prior.position, prior.target);

    expect(sweepPlanarSkater(world, [100, 1.2, 100], [99.4, 4.2, 92.5], 0.18).blocked)
      .toBe(false);
    const camera = updateFollowCamera(prior, player, NEUTRAL_CAMERA, world, 1 / 60);

    expect(camera.position[1]).toBeGreaterThanOrEqual(0.45);
    expect(sweepPlanarSkater(world, camera.target, camera.position, 0.18).blocked).toBe(false);
    expect(camera.position[0]).toBeLessThan(105.35);
  });

  it('camera_clearsBothSeamsAndGround', () => {
    const crossings = [
      [[255.9, 0, 30], [0.1, 0, 30]],
      [[30, 0, 255.9], [30, 0, 0.1]],
      [[255.9, 0, 255.9], [0.1, 0, 0.1]],
      [[0.1, 0, 0.1], [255.9, 0, 255.9]],
    ];
    let camera = null;

    for (const [from, to] of crossings) {
      camera = createFollowCameraState(planarSkater(from), PLANAR_WORLD);
      camera = updateFollowCamera(camera, planarSkater(to), {
        ...NEUTRAL_CAMERA,
        zoomDelta: 100,
      }, PLANAR_WORLD, 1 / 60);
      expect(camera.position.every(Number.isFinite)).toBe(true);
      expect(camera.target.every(Number.isFinite)).toBe(true);
      expect(camera.position[1]).toBeGreaterThanOrEqual(0.45);
      expect(camera.up).toEqual([0, 1, 0]);
      expect(sweepPlanarSkater(PLANAR_WORLD, camera.target, camera.position, 0.18).blocked)
        .toBe(false);
      expect(camera.boomLength).toBe(8);
    }
  });
});
