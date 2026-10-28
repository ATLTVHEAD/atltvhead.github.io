import {
  advanceAlongSphere,
  makeSurfaceFrame,
  normalize3,
  projectToTangent,
  rotateAroundAxis,
} from './planet-math.js';
import { clampInputAxes } from '../input/actions.js';

export const SKATER_PHYSICS = Object.freeze({
  maxSpeed: 12,
  acceleration: 8,
  braking: 18,
  turnRate: 2.6,
  jumpSpeed: 6,
  gravity: 14,
  maxDeltaSeconds: 0.1,
});

export function integrateSkaterSpeed(speed, input, deltaSeconds, tuning = SKATER_PHYSICS) {
  const throttle = Number.isFinite(input?.throttle) ? Math.max(0, Math.min(1, input.throttle)) : 0;
  const brake = Number.isFinite(input?.brake) ? Math.max(0, Math.min(1, input.brake)) : 0;
  let nextSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0;
  nextSpeed += throttle * tuning.acceleration * deltaSeconds;
  nextSpeed -= brake * tuning.braking * deltaSeconds;
  if (throttle === 0 && brake === 0) {
    nextSpeed -= (tuning.coastingDrag ?? 0) * deltaSeconds;
  }
  return Math.max(0, Math.min(tuning.maxSpeed, nextSpeed));
}

export function turnSkaterForward(forward, normal, steer, deltaSeconds, tuning = SKATER_PHYSICS) {
  const factor = typeof tuning.steeringFactor === 'function'
    ? tuning.steeringFactor(tuning.speed ?? 0)
    : (Number.isFinite(tuning.steeringFactor) ? tuning.steeringFactor : 1);
  const turned = rotateAroundAxis(
    forward,
    normal,
    -(Number.isFinite(steer) ? steer : 0) * tuning.turnRate * factor * deltaSeconds,
  );
  return normalize3(projectToTangent(turned, normal));
}

export function integrateVerticalMotion(height, verticalSpeed, deltaSeconds, gravity) {
  return {
    height: height + verticalSpeed * deltaSeconds - 0.5 * gravity * deltaSeconds * deltaSeconds,
    verticalSpeed: verticalSpeed - gravity * deltaSeconds,
  };
}

export function stepSkater(state, rawInput, deltaSeconds) {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return { ...state };

  const delta = Math.min(deltaSeconds, SKATER_PHYSICS.maxDeltaSeconds);
  const input = clampInputAxes(rawInput);
  const position = Array.isArray(state.position) ? [...state.position] : [0, 1, 0];
  const currentRadius = Math.hypot(...position);
  const up = normalize3(position);
  const surfaceFrame = makeSurfaceFrame(up, state.forward);
  const speed = integrateSkaterSpeed(state.speed, {
    throttle: input.accelerate ? 1 : 0,
    brake: input.brake ? 1 : 0,
  }, delta, SKATER_PHYSICS);
  const forward = turnSkaterForward(
    surfaceFrame.forward,
    up,
    input.steerX,
    delta,
    SKATER_PHYSICS,
  );
  const direction = forward.every((component) => component === 0)
    ? surfaceFrame.forward
    : forward;
  let nextPosition = advanceAlongSphere(position, direction, speed * delta, currentRadius);

  const wasAirborne = Boolean(state.airborne);
  const startsJump = !wasAirborne && input.jumpPressed;
  let airborne = wasAirborne || startsJump;
  let verticalSpeed = Number.isFinite(state.verticalSpeed) ? state.verticalSpeed : 0;
  let groundRadius = Number.isFinite(state.groundRadius) && state.groundRadius > 0
    ? state.groundRadius
    : currentRadius;

  if (startsJump) verticalSpeed = SKATER_PHYSICS.jumpSpeed;
  if (airborne) {
    const height = Math.max(0, currentRadius - groundRadius);
    const verticalMotion = integrateVerticalMotion(height, verticalSpeed, delta, SKATER_PHYSICS.gravity);
    const nextHeight = verticalMotion.height;
    verticalSpeed = verticalMotion.verticalSpeed;

    if (nextHeight <= 0) {
      airborne = false;
      verticalSpeed = 0;
      nextPosition = normalize3(nextPosition).map((component) => component * groundRadius);
    } else {
      const nextRadius = groundRadius + nextHeight;
      nextPosition = normalize3(nextPosition).map((component) => component * nextRadius);
    }
  }

  const nextState = {
    ...state,
    position: nextPosition,
    forward: direction,
    speed,
    airborne,
    verticalSpeed,
  };
  if (airborne) nextState.groundRadius = groundRadius;
  else delete nextState.groundRadius;

  return nextState;
}
