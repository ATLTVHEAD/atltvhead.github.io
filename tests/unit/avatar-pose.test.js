import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { dot3, normalize3 } from '../../js/game/core/planet-math.js';
import { applyAvatarPose } from '../../js/game/render/avatar-pose.js';
import { createTvheadAvatar } from '../../js/game/render/avatar.js';
import { createCityLayout } from '../../js/game/world/city-layout.js';
import { compileCityWorld } from '../../js/game/world/city-surfaces.js';
import { querySupport } from '../../js/game/world/city-queries.js';

describe('applyAvatarPose', () => {
  it('avatarPose_mapsModelUpAndForwardToTheSphericalContactFrame', () => {
    const avatar = createTvheadAvatar(THREE, { color: '#ff006e', accessoryIds: [] });
    const state = {
      position: [0, 16.3, 0],
      forward: [0, 0, -1],
      speed: 3,
      mode: 'grounded',
    };

    applyAvatarPose(avatar, state, 0);
    const modelUp = new THREE.Vector3(0, 1, 0).applyQuaternion(avatar.quaternion).normalize();
    const modelForward = new THREE.Vector3(0, 0, 1).applyQuaternion(avatar.quaternion).normalize();

    expect(avatar.position.toArray()).toEqual(state.position);
    expect(modelUp.toArray()).toEqual([0, 1, 0]);
    expect(modelForward.dot(new THREE.Vector3(...state.forward))).toBeGreaterThan(0.999);
  });

  it('avatarPose_keepsFeetAtTheCanonicalSupportPointWithoutMutatingSimulation', () => {
    const avatar = createTvheadAvatar(THREE, { color: '#36a6ff', accessoryIds: [] });
    const state = {
      position: [12, 10, 4],
      forward: [-0.5, 0.8, 0.2],
      speed: 5,
      mode: 'airborne',
      verticalSpeed: 2,
    };
    const before = structuredClone(state);

    applyAvatarPose(avatar, state, 1.25);

    expect(avatar.position.toArray()).toEqual(state.position);
    expect(state).toEqual(before);
    expect(avatar.userData.simulationPose).toMatchObject({ mode: 'airborne', speed: 5 });
  });

  it('avatar_planarAirUsesExplicitUpWithoutChangingSphericalAir', () => {
    const avatar = createTvheadAvatar(THREE, { color: '#ff006e', accessoryIds: [] });
    const planarState = {
      position: [200, 3, 40],
      forward: [0, 0, 1],
      supportNormal: [0, 1, 0],
      gravityUp: [0, 1, 0],
      speed: 4,
      mode: 'airborne',
    };

    applyAvatarPose(avatar, planarState);
    const planarUp = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(avatar.quaternion).normalize();
    expect(planarUp.dot(new THREE.Vector3(0, 1, 0))).toBeGreaterThan(0.999);

    const sphericalPosition = [12, 10, 4];
    const sphericalState = {
      position: sphericalPosition,
      forward: [0, 0, -1],
      supportNormal: [0, 1, 0],
      speed: 4,
      mode: 'airborne',
    };
    applyAvatarPose(avatar, sphericalState);
    const sphericalUp = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(avatar.quaternion).normalize();
    expect(sphericalUp.dot(new THREE.Vector3(...normalize3(sphericalPosition)))).toBeGreaterThan(0.999);
  });

  it('avatarPose_alignsWheelsToTheRenderedRampSupportPlane', () => {
    const world = compileCityWorld(createCityLayout({ radius: 16, seed: 2026 }));
    const ramp = world.surfaces.find((surface) => surface.type === 'ramp');
    let support = null;
    let greatestNormalAngle = -Infinity;

    for (const point of ramp.centerline) {
      const candidate = querySupport(world, point, {
        maxDrop: 1,
        maxRise: 1,
        previousSurfaceId: ramp.id,
      });
      if (!candidate || candidate.surfaceId !== ramp.id) continue;
      const angle = Math.acos(Math.max(-1, Math.min(1, dot3(
        normalize3(candidate.point),
        candidate.surfaceNormal,
      ))));
      if (angle > greatestNormalAngle) {
        greatestNormalAngle = angle;
        support = candidate;
      }
    }

    expect(support).not.toBeNull();
    const avatar = createTvheadAvatar(THREE, { color: '#ff006e', accessoryIds: [] });
    const state = {
      position: support.point,
      forward: support.tangent,
      speed: 4,
      mode: 'grounded',
      supportNormal: support.surfaceNormal,
    };
    applyAvatarPose(avatar, state);
    avatar.updateMatrixWorld(true);

    const avatarUp = new THREE.Vector3(0, 1, 0).applyQuaternion(avatar.quaternion).normalize();
    const supportNormal = new THREE.Vector3(...support.surfaceNormal).normalize();
    const supportPoint = new THREE.Vector3(...support.point);
    let minimumGap = Infinity;
    avatar.traverse((object) => {
      const positions = object.geometry?.attributes?.position;
      if (!object.isMesh || !positions) return;
      const vertex = new THREE.Vector3();
      for (let index = 0; index < positions.count; index += 1) {
        vertex.fromBufferAttribute(positions, index).applyMatrix4(object.matrixWorld);
        minimumGap = Math.min(minimumGap, vertex.sub(supportPoint).dot(supportNormal));
      }
    });

    expect(greatestNormalAngle).toBeGreaterThan(0.1);
    expect(avatarUp.dot(supportNormal)).toBeGreaterThan(0.999);
    expect(minimumGap).toBeGreaterThan(-0.001);
    expect(minimumGap).toBeLessThan(0.01);
  });
});
