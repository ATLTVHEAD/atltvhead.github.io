import {
  cross3,
  dot3,
  makeSurfaceFrame,
  normalize3,
  projectToTangent,
  rotateAroundAxis,
} from '../core/planet-math.js';
import { wrapDelta } from '../core/wrap-math.js';
import { sweepPlanarSkater } from '../world/planar-city-queries.js';

const UP = Object.freeze([0, 1, 0]);

export const FOLLOW_CAMERA_TUNING = Object.freeze({
  boomLength: 7.5,
  minBoomLength: 3,
  maxBoomLength: 8,
  height: 4.2,
  targetHeight: 1.2,
  shoulderOffset: 0.6,
  mobileShoulderOffset: 0.28,
  maxLookAhead: 1.5,
  maxPitch: 0.55,
  maxYaw: 1.4,
  recenterAfterMs: 1_500,
  followTurnRate: 2.4,
  followSmoothingSeconds: 0.18,
  targetSmoothingSeconds: 0.14,
  boomRestoreSeconds: 0.22,
  collisionRadius: 0.18,
  groundClearance: 0.45,
  maxDeltaSeconds: 0.1,
});

function add(a, b) {
  return a.map((value, axis) => value + b[axis]);
}

function subtract(a, b) {
  return a.map((value, axis) => value - b[axis]);
}

function scale(vector, amount) {
  return vector.map((value) => value * amount);
}

function mix(a, b, amount) {
  return a.map((value, axis) => value * (1 - amount) + b[axis] * amount);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothAlpha(delta, duration) {
  return 1 - Math.exp(-Math.max(0, delta) / Math.max(duration, 1e-4));
}

function finiteVector(value) {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
}

function transportTangent(vector, fromUp, toUp) {
  const axis = cross3(fromUp, toUp);
  const axisLength = Math.hypot(...axis);
  const cosine = clamp(dot3(fromUp, toUp), -1, 1);
  let transported = [...vector];
  if (axisLength > 1e-10) {
    transported = rotateAroundAxis(vector, scale(axis, 1 / axisLength), Math.atan2(axisLength, cosine));
  } else if (cosine < 0) {
    transported = makeSurfaceFrame(toUp, vector).forward;
  }
  return normalize3(projectToTangent(transported, toUp));
}

function rotateToward(current, desired, up, maxAngle) {
  const tangent = normalize3(projectToTangent(desired, up));
  if (tangent.every((value) => value === 0)) return current;
  const cosine = clamp(dot3(current, tangent), -1, 1);
  const sine = dot3(cross3(current, tangent), up);
  const angle = Math.atan2(sine, cosine);
  return normalize3(projectToTangent(rotateAroundAxis(current, up, clamp(angle, -maxAngle, maxAngle)), up));
}

function cameraFraming(skater, up, forward, orbitOffset, boomLength, viewport, lookAhead) {
  const frame = makeSurfaceFrame(up, forward);
  const shoulder = Number.isFinite(viewport?.width) && viewport.width < 600
    ? FOLLOW_CAMERA_TUNING.mobileShoulderOffset
    : FOLLOW_CAMERA_TUNING.shoulderOffset;
  let backward = rotateAroundAxis(scale(forward, -1), up, orbitOffset.yaw);
  backward = normalize3(rotateAroundAxis(backward, frame.right, orbitOffset.pitch));
  const target = add(add(skater.position, scale(up, FOLLOW_CAMERA_TUNING.targetHeight)), scale(forward, lookAhead));
  let position = add(
    add(add(skater.position, scale(backward, boomLength)), scale(up, FOLLOW_CAMERA_TUNING.height)),
    scale(frame.right, shoulder),
  );
  return { position, target, frame };
}

function keepCameraAboveGround(position) {
  return [position[0], Math.max(position[1], FOLLOW_CAMERA_TUNING.groundClearance), position[2]];
}

function initialFollowDirection(skater) {
  const candidate = normalize3(projectToTangent(skater.forward, UP));
  return candidate.every((value) => value === 0) ? [0, 0, 1] : candidate;
}

function tileRebase(previous, position, world) {
  const lastPosition = finiteVector(previous.lastSkaterPosition)
    ? previous.lastSkaterPosition
    : position;
  const width = Number.isFinite(world?.width) && world.width > 0 ? world.width : 256;
  const depth = Number.isFinite(world?.depth) && world.depth > 0 ? world.depth : 256;
  return [
    position[0] - lastPosition[0] - wrapDelta(lastPosition[0], position[0], width),
    0,
    position[2] - lastPosition[2] - wrapDelta(lastPosition[2], position[2], depth),
  ];
}

function collisionSafeBoom(world, target, position) {
  let candidate = keepCameraAboveGround(position);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const collision = sweepPlanarSkater(
      world,
      target,
      candidate,
      FOLLOW_CAMERA_TUNING.collisionRadius,
    );
    if (!collision.blocked) return candidate;
    candidate = keepCameraAboveGround(collision.position);
  }
  return candidate;
}

export function createFollowCameraState(skater, world = null, viewport = null) {
  const up = [...UP];
  const followDirection = initialFollowDirection(skater);
  const framing = cameraFraming(
    skater,
    up,
    followDirection,
    { yaw: 0, pitch: 0 },
    FOLLOW_CAMERA_TUNING.boomLength,
    viewport,
    0,
  );
  const position = collisionSafeBoom(world, framing.target, framing.position);
  return {
    position,
    target: framing.target,
    up,
    gravityUp: up,
    followDirection,
    orbitOffset: { yaw: 0, pitch: 0 },
    manualIdleMs: 0,
    boomLength: FOLLOW_CAMERA_TUNING.boomLength,
    actualBoomLength: Math.hypot(...subtract(position, framing.target)),
    lastSkaterPosition: [...skater.position],
  };
}

export function updateFollowCamera(previous, skater, cameraInput = {}, world = {}, deltaSeconds = 1 / 60, viewport = null) {
  if (!finiteVector(skater?.position) || !finiteVector(skater?.forward)) {
    throw new TypeError('Follow-camera updates need a finite skater pose.');
  }
  const delta = Number.isFinite(deltaSeconds)
    ? clamp(deltaSeconds, 0, FOLLOW_CAMERA_TUNING.maxDeltaSeconds)
    : 0;
  const up = [...UP];
  const initialized = previous && finiteVector(previous.position) && finiteVector(previous.target);
  const prior = initialized ? previous : createFollowCameraState(skater, world, viewport);
  const rebase = initialized ? tileRebase(prior, skater.position, world) : [0, 0, 0];
  const priorPosition = initialized ? add(prior.position, rebase) : null;
  const priorTarget = initialized ? add(prior.target, rebase) : null;
  let followDirection = transportTangent(
    prior.followDirection ?? initialFollowDirection(skater),
    UP,
    up,
  );
  const skaterForward = normalize3(projectToTangent(skater.forward, up));
  if (Number.isFinite(skater.speed) && skater.speed > 0.25) {
    followDirection = rotateToward(
      followDirection,
      skaterForward,
      up,
      FOLLOW_CAMERA_TUNING.followTurnRate * delta,
    );
  }

  const yawDelta = Number.isFinite(cameraInput.yawDelta) ? cameraInput.yawDelta : 0;
  const pitchDelta = Number.isFinite(cameraInput.pitchDelta) ? cameraInput.pitchDelta : 0;
  const zoomDelta = Number.isFinite(cameraInput.zoomDelta) ? cameraInput.zoomDelta : 0;
  const manualLook = Math.abs(yawDelta) + Math.abs(pitchDelta) + Math.abs(zoomDelta) > 1e-8;
  let manualIdleMs = manualLook ? 0 : (prior.manualIdleMs ?? 0) + delta * 1000;
  let orbitOffset = {
    yaw: clamp((prior.orbitOffset?.yaw ?? 0) + yawDelta, -FOLLOW_CAMERA_TUNING.maxYaw, FOLLOW_CAMERA_TUNING.maxYaw),
    pitch: clamp((prior.orbitOffset?.pitch ?? 0) + pitchDelta, -FOLLOW_CAMERA_TUNING.maxPitch, FOLLOW_CAMERA_TUNING.maxPitch),
  };
  if (manualIdleMs >= FOLLOW_CAMERA_TUNING.recenterAfterMs && (skater.speed ?? 0) > 0.2) {
    const recenter = smoothAlpha(delta, 0.65);
    orbitOffset = {
      yaw: orbitOffset.yaw * (1 - recenter),
      pitch: orbitOffset.pitch * (1 - recenter),
    };
  }
  const boomLength = clamp(
    (prior.boomLength ?? FOLLOW_CAMERA_TUNING.boomLength) + zoomDelta,
    FOLLOW_CAMERA_TUNING.minBoomLength,
    FOLLOW_CAMERA_TUNING.maxBoomLength,
  );
  const speedFraction = clamp((skater.speed ?? 0) / 12, 0, 1);
  const lookAhead = FOLLOW_CAMERA_TUNING.maxLookAhead * speedFraction;
  const framing = cameraFraming(skater, up, followDirection, orbitOffset, boomLength, viewport, lookAhead);
  const targetAlpha = initialized ? smoothAlpha(delta, FOLLOW_CAMERA_TUNING.targetSmoothingSeconds) : 1;
  const target = initialized ? mix(priorTarget, framing.target, targetAlpha) : framing.target;
  const positionAlpha = smoothAlpha(delta, FOLLOW_CAMERA_TUNING.followSmoothingSeconds);
  const smoothedPosition = initialized
    ? mix(priorPosition, framing.position, positionAlpha)
    : framing.position;
  const position = collisionSafeBoom(world, target, smoothedPosition);
  const actualBoomLength = Math.hypot(...subtract(position, target));

  return {
    position,
    target,
    up,
    gravityUp: up,
    followDirection,
    orbitOffset,
    manualIdleMs,
    boomLength,
    actualBoomLength,
    lastSkaterPosition: [...skater.position],
  };
}
