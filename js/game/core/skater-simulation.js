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

export function stepSkater(state, rawInput, deltaSeconds) {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return { ...state };

  const delta = Math.min(deltaSeconds, SKATER_PHYSICS.maxDeltaSeconds);
  const input = clampInputAxes(rawInput);
  const position = Array.isArray(state.position) ? [...state.position] : [0, 1, 0];
  const currentRadius = Math.hypot(...position);
  const up = normalize3(position);
  const surfaceFrame = makeSurfaceFrame(up, state.forward);
  const speedBeforeInput = Number.isFinite(state.speed) ? Math.max(0, state.speed) : 0;
  const acceleratedSpeed = speedBeforeInput
    + (input.accelerate ? SKATER_PHYSICS.acceleration * delta : 0)
    - (input.brake ? SKATER_PHYSICS.braking * delta : 0);
  const speed = Math.max(0, Math.min(SKATER_PHYSICS.maxSpeed, acceleratedSpeed));
  const turnAngle = -input.steerX * SKATER_PHYSICS.turnRate * delta;
  const turnedForward = rotateAroundAxis(surfaceFrame.forward, up, turnAngle);
  const forward = normalize3(projectToTangent(turnedForward, up));
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
    const nextHeight = height + verticalSpeed * delta
      - 0.5 * SKATER_PHYSICS.gravity * delta * delta;
    verticalSpeed -= SKATER_PHYSICS.gravity * delta;

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
