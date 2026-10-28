import {
  cross3,
  dot3,
  makeSurfaceFrame,
  normalize3,
  projectToTangent,
  rotateAroundAxis,
} from '../core/planet-math.js';
import { sweepSkater } from '../world/city-queries.js';

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
  planetClearance: 0.45,
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

function keepCameraOutsidePlanet(position, radius) {
  const minimumRadius = radius + FOLLOW_CAMERA_TUNING.planetClearance;
  const currentRadius = Math.hypot(...position);
  if (currentRadius >= minimumRadius) return position;
  const radial = normalize3(position);
  return scale(radial.every((value) => value === 0) ? [0, 1, 0] : radial, minimumRadius);
}

function initialFollowDirection(skater) {
  const up = normalize3(skater.position);
  const candidate = normalize3(projectToTangent(skater.forward, up));
  return candidate.every((value) => value === 0) ? makeSurfaceFrame(up, [0, 0, 1]).forward : candidate;
}

export function createFollowCameraState(skater, world = null, viewport = null) {
  const up = normalize3(skater.position);
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
  const position = keepCameraOutsidePlanet(framing.position, world?.radius ?? 0);
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
  };
}

export function updateFollowCamera(previous, skater, cameraInput = {}, world = {}, deltaSeconds = 1 / 60, viewport = null) {
  if (!finiteVector(skater?.position) || !finiteVector(skater?.forward)) {
    throw new TypeError('Follow-camera updates need a finite skater pose.');
  }
  const delta = Number.isFinite(deltaSeconds)
    ? clamp(deltaSeconds, 0, FOLLOW_CAMERA_TUNING.maxDeltaSeconds)
    : 0;
  const up = normalize3(skater.position);
  const initialized = previous && finiteVector(previous.position) && finiteVector(previous.target);
  const prior = initialized ? previous : createFollowCameraState(skater, world, viewport);
  let followDirection = transportTangent(
    prior.followDirection ?? initialFollowDirection(skater),
    prior.gravityUp ?? up,
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
  const desired = keepCameraOutsidePlanet(framing.position, world?.radius ?? 0);
  const targetAlpha = initialized ? smoothAlpha(delta, FOLLOW_CAMERA_TUNING.targetSmoothingSeconds) : 1;
  const target = initialized ? mix(prior.target, framing.target, targetAlpha) : framing.target;
  const collision = sweepSkater(world, target, desired, FOLLOW_CAMERA_TUNING.collisionRadius);
  const positionAlpha = smoothAlpha(delta, FOLLOW_CAMERA_TUNING.followSmoothingSeconds);
  let position = collision.blocked
    ? collision.position
    : (initialized ? mix(prior.position, collision.position, positionAlpha) : collision.position);
  position = keepCameraOutsidePlanet(position, world?.radius ?? 0);
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
    actualBoomLength: collision.blocked
      ? Math.min(actualBoomLength, prior.actualBoomLength ?? actualBoomLength)
      : actualBoomLength,
  };
}
