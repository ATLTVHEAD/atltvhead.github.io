import { makeSurfaceFrame, normalize3 } from '../core/planet-math.js';

function finiteVector(value) {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
}

export function applyAvatarPose(avatar, state, renderTime = 0, surfaceNormal = null) {
  if (!avatar?.isGroup || !avatar.userData?.THREE) {
    throw new TypeError('A TVHead avatar created by createTvheadAvatar is required.');
  }
  if (!Array.isArray(state?.position) || !Array.isArray(state?.forward)) {
    throw new TypeError('An avatar simulation pose is required.');
  }
  const THREE = avatar.userData.THREE;
  const gravityUp = normalize3(state.position);
  const contactNormal = finiteVector(surfaceNormal) ? surfaceNormal : state.supportNormal;
  const candidateSupportUp = state.mode === 'grounded' && finiteVector(contactNormal)
    ? normalize3(contactNormal)
    : [0, 0, 0];
  const hasSupportFrame = !candidateSupportUp.every((value) => value === 0);
  const up = hasSupportFrame ? candidateSupportUp : gravityUp;
  const frame = makeSurfaceFrame(up, state.forward);
  const right = new THREE.Vector3(...frame.right).negate();
  const modelUp = new THREE.Vector3(...frame.up);
  const forward = new THREE.Vector3(...frame.forward);
  avatar.position.set(...state.position);
  if (hasSupportFrame) avatar.position.addScaledVector(modelUp, avatar.userData.supportOffset ?? 0);
  avatar.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, modelUp, forward));
  avatar.userData.simulationPose = {
    mode: state.mode,
    speed: state.speed,
    renderTime: Number.isFinite(renderTime) ? renderTime : 0,
  };
}
