import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyAvatarPose } from '../../js/game/render/avatar-pose.js';
import { createTvheadAvatar } from '../../js/game/render/avatar.js';

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
});
