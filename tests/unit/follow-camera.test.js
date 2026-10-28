import { describe, expect, it } from 'vitest';
import { normalize3, projectToTangent } from '../../js/game/core/planet-math.js';
import { createCityLayout } from '../../js/game/world/city-layout.js';
import { compileCityWorld } from '../../js/game/world/city-surfaces.js';
import {
  createFollowCameraState,
  updateFollowCamera,
} from '../../js/game/render/follow-camera.js';

const NEUTRAL_CAMERA = { yawDelta: 0, pitchDelta: 0, zoomDelta: 0 };
const OPEN_WORLD = { radius: 16, buildings: [], surfaces: [] };

function skater(position = [16.3, 0, 0], forward = [0, 0, 1], speed = 5) {
  return { position, forward, speed, mode: 'grounded', surfaceId: 'street-0' };
}

function distance(a, b) {
  return Math.hypot(...a.map((value, axis) => value - b[axis]));
}

describe('updateFollowCamera', () => {
  it('followCamera_defaultBoomKeepsTheSkaterAtAnUrbanThirdPersonScale', () => {
    const state = createFollowCameraState(skater(), OPEN_WORLD);

    expect(state.actualBoomLength).toBeGreaterThan(7.5);
  });

  it('followCamera_traversesAConnectedRouteWithoutManualLook', () => {
    const layout = createCityLayout({ radius: 16, seed: 2026 });
    let camera = null;
    let visited = 0;

    for (const surface of layout.surfaces) {
      for (let index = 0; index < surface.centerline.length; index += 1) {
        const position = surface.centerline[index];
        const before = surface.centerline[Math.max(0, index - 1)];
        const after = surface.centerline[Math.min(surface.centerline.length - 1, index + 1)];
        const gravityUp = normalize3(position);
        const forward = normalize3(projectToTangent(after.map((value, axis) => value - before[axis]), gravityUp));
        camera = updateFollowCamera(camera, skater(position, forward, 5), NEUTRAL_CAMERA, OPEN_WORLD, 1 / 60);
        expect(camera.position.every(Number.isFinite)).toBe(true);
        expect(camera.target.every(Number.isFinite)).toBe(true);
        expect(distance(camera.position, position)).toBeGreaterThan(3);
        visited += 1;
      }
    }

    expect(visited).toBeGreaterThan(100);
    expect(camera.followDirection.every(Number.isFinite)).toBe(true);
  });

  it('followCamera_cameraBoomNeverCutsThroughThePlanetAlongTheRoute', () => {
    const world = compileCityWorld(createCityLayout({ radius: 16, seed: 2026 }));
    let camera = null;
    let minimumClearance = Infinity;

    for (const surface of world.surfaces) {
      for (let index = 0; index < surface.centerline.length; index += 1) {
        const position = surface.centerline[index];
        const before = surface.centerline[Math.max(0, index - 1)];
        const after = surface.centerline[Math.min(surface.centerline.length - 1, index + 1)];
        const up = normalize3(position);
        const forward = normalize3(projectToTangent(after.map((value, axis) => value - before[axis]), up));
        camera = updateFollowCamera(camera, {
          ...skater(position, forward, 6),
          surfaceId: surface.id,
        }, NEUTRAL_CAMERA, world, 1 / 60);
        for (let sample = 0; sample <= 20; sample += 1) {
          const progress = sample / 20;
          const point = camera.target.map((value, axis) => (
            value + (camera.position[axis] - value) * progress
          ));
          minimumClearance = Math.min(minimumClearance, Math.hypot(...point) - world.radius);
        }
      }
    }

    expect(minimumClearance).toBeGreaterThan(0);
  });

  it('followCamera_transportsUpContinuouslyAcrossThePole', () => {
    let camera = null;
    let previousUp = null;
    for (let index = 0; index <= 24; index += 1) {
      const angle = (index / 24) * Math.PI;
      const position = [16.3 * Math.sin(angle), 16.3 * Math.cos(angle), 0];
      const forward = [Math.cos(angle), -Math.sin(angle), 0];
      camera = updateFollowCamera(camera, skater(position, forward, 4), NEUTRAL_CAMERA, OPEN_WORLD, 1 / 60);
      const up = normalize3(camera.up);
      if (previousUp) {
        expect(up[0] * previousUp[0] + up[1] * previousUp[1] + up[2] * previousUp[2])
          .toBeGreaterThan(0.98);
      }
      expect(camera.followDirection.reduce((sum, value, axis) => sum + value * up[axis], 0))
        .toBeCloseTo(0, 6);
      previousUp = up;
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
    const blockedWorld = {
      ...OPEN_WORLD,
      buildings: [{
        id: 'camera-wall',
        collision: {
          type: 'capsule',
          start: midpoint,
          end: [midpoint[0], midpoint[1] + 1, midpoint[2]],
          radius: 0.45,
        },
      }],
    };
    const blocked = updateFollowCamera(initial, player, NEUTRAL_CAMERA, blockedWorld, 1 / 60);
    const recovered = updateFollowCamera(blocked, player, NEUTRAL_CAMERA, OPEN_WORLD, 0.1);
    const clearLength = distance(clear.position, clear.target);
    const blockedLength = distance(blocked.position, blocked.target);
    const recoveredLength = distance(recovered.position, recovered.target);

    expect(blockedLength).toBeLessThan(clearLength);
    expect(recoveredLength).toBeGreaterThan(blockedLength);
    expect(recoveredLength).toBeLessThan(clearLength);
    expect(Math.hypot(...blocked.position)).toBeGreaterThan(16.3);
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
});
