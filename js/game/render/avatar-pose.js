import { makeSurfaceFrame, normalize3 } from '../core/planet-math.js';

export function applyAvatarPose(avatar, state, renderTime = 0) {
  if (!avatar?.isGroup || !avatar.userData?.THREE) {
    throw new TypeError('A TVHead avatar created by createTvheadAvatar is required.');
  }
  if (!Array.isArray(state?.position) || !Array.isArray(state?.forward)) {
    throw new TypeError('An avatar simulation pose is required.');
  }
  const THREE = avatar.userData.THREE;
  const up = normalize3(state.position);
  const frame = makeSurfaceFrame(up, state.forward);
  const right = new THREE.Vector3(...frame.right).negate();
  const modelUp = new THREE.Vector3(...frame.up);
  const forward = new THREE.Vector3(...frame.forward);
  avatar.position.set(...state.position);
  avatar.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, modelUp, forward));
  avatar.userData.simulationPose = {
    mode: state.mode,
    speed: state.speed,
    renderTime: Number.isFinite(renderTime) ? renderTime : 0,
  };
}
