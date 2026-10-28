import {
  advanceAlongSphere,
  cross3,
  dot3,
  makeSurfaceFrame,
  normalize3,
  projectToTangent,
  rotateAroundAxis,
} from './planet-math.js';
import {
  integrateSkaterSpeed,
  integrateVerticalMotion,
  SKATER_PHYSICS,
  turnSkaterForward,
} from './skater-simulation.js';
import { createNeutralInputFrame, normalizeInputFrame } from '../input/actions.js';
import { querySupport, sweepSkater } from '../world/city-queries.js';

export const CITY_SKATER_TUNING = Object.freeze({
  maxSpeed: SKATER_PHYSICS.maxSpeed,
  acceleration: SKATER_PHYSICS.acceleration,
  braking: SKATER_PHYSICS.braking,
  turnRate: SKATER_PHYSICS.turnRate,
  jumpSpeed: SKATER_PHYSICS.jumpSpeed,
  gravity: SKATER_PHYSICS.gravity,
  maxDeltaSeconds: SKATER_PHYSICS.maxDeltaSeconds,
  coastingDrag: 0.6,
  coyoteTimeMs: 100,
  jumpBufferMs: 120,
  bailDurationMs: 500,
  bodyRadius: 0.25,
});

const SKATER_MODES = new Set(['grounded', 'airborne', 'grinding', 'bailed']);
const EMPTY_INPUT = Object.freeze(createNeutralInputFrame());

function finiteVector(value) {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
}

function subtract(a, b) {
  return a.map((value, axis) => value - b[axis]);
}

function add(a, b) {
  return a.map((value, axis) => value + b[axis]);
}

function scale(vector, amount) {
  return vector.map((value) => value * amount);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function transportHeading(forward, oldUp, newUp) {
  const axis = cross3(oldUp, newUp);
  const axisLength = Math.hypot(...axis);
  const cosine = clamp(dot3(oldUp, newUp), -1, 1);
  let transported = [...forward];
  if (axisLength > 1e-10) {
    transported = rotateAroundAxis(forward, scale(axis, 1 / axisLength), Math.atan2(axisLength, cosine));
  } else if (cosine < 0) {
    transported = makeSurfaceFrame(newUp, forward).forward;
  }
  return normalize3(projectToTangent(transported, newUp));
}

function spawnRecords(world) {
  if (Array.isArray(world?.spawnPoints) && world.spawnPoints.length > 0) return world.spawnPoints;
  const radius = Number.isFinite(world?.radius) && world.radius > 0 ? world.radius : 16;
  return [{
    id: 'spawn-fallback',
    surfaceId: 'terrain',
    position: [radius, 0, 0],
    forward: [0, 0, 1],
  }];
}

export function createCitySkater(world, spawnId) {
  const spawns = spawnRecords(world);
  const spawn = spawns.find((entry) => entry.id === spawnId)
    ?? spawns.find((entry) => entry.id === world?.defaultSpawnId)
    ?? spawns[0];
  const support = querySupport(world, spawn.position, {
    maxDrop: 0.1,
    maxRise: 0.1,
    previousSurfaceId: spawn.surfaceId,
  });
  const position = support?.point ?? [...spawn.position];
  const gravityUp = normalize3(position);
  const forward = normalize3(projectToTangent(spawn.forward, gravityUp));
  const safeForward = forward.every((value) => value === 0)
    ? makeSurfaceFrame(gravityUp, [0, 0, 1]).forward
    : forward;
  return {
    spawnId: spawn.id,
    position,
    forward: safeForward,
    speed: 0,
    mode: 'grounded',
    surfaceId: support?.surfaceId ?? spawn.surfaceId ?? 'terrain',
    railId: null,
    railDistance: 0,
    verticalSpeed: 0,
    groundRadius: Math.hypot(...position),
    jumpBufferAgeMs: CITY_SKATER_TUNING.jumpBufferMs + 1,
    coyoteAgeMs: 0,
    bailRemainingMs: 0,
    tick: 0,
    sessionId: 'local',
  };
}

function isUsableState(state) {
  return finiteVector(state?.position)
    && finiteVector(state?.forward)
    && Number.isFinite(state?.speed)
    && Number.isFinite(state?.verticalSpeed)
    && SKATER_MODES.has(state?.mode);
}

function eventRecord(state, type, index, context = {}) {
  return {
    eventId: `${state.sessionId ?? 'local'}:${state.tick}:${index + 1}`,
    tick: state.tick,
    type,
    ...context,
  };
}

function safeRecovery(world, state, nextTick, reason) {
  const recovered = createCitySkater(world, state?.spawnId);
  recovered.tick = nextTick;
  recovered.sessionId = typeof state?.sessionId === 'string' ? state.sessionId : 'local';
  return {
    state: recovered,
    events: [eventRecord(recovered, 'bailed', 0, { reason })],
  };
}

function respawn(world, state, nextTick) {
  const recovered = createCitySkater(world, state.spawnId);
  recovered.tick = nextTick;
  recovered.sessionId = state.sessionId ?? 'local';
  return recovered;
}

function makeJump(state, events, tuning, context = {}) {
  state.mode = 'airborne';
  state.verticalSpeed = tuning.jumpSpeed;
  state.jumpBufferAgeMs = tuning.jumpBufferMs + 1;
  events.push(eventRecord(state, 'jumped', events.length, context));
}

export function stepSkaterOnCity(state, rawInput, deltaSeconds, world, tuningOverrides = {}) {
  const tuning = { ...CITY_SKATER_TUNING, ...tuningOverrides };
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return { state: { ...state }, events: [] };
  const delta = Math.min(deltaSeconds, tuning.maxDeltaSeconds);
  const nextTick = (Number.isSafeInteger(state?.tick) ? state.tick : 0) + 1;
  if (!isUsableState(state)) return safeRecovery(world, state, nextTick, 'invalid-state');

  const nextState = {
    ...state,
    position: [...state.position],
    forward: [...state.forward],
    tick: nextTick,
  };
  const events = [];
  const input = normalizeInputFrame(rawInput ?? EMPTY_INPUT);
  const deltaMs = delta * 1000;

  if (nextState.mode === 'bailed') {
    nextState.bailRemainingMs = Math.max(0, (nextState.bailRemainingMs ?? 0) - deltaMs);
    return {
      state: nextState.bailRemainingMs <= 0 ? respawn(world, nextState, nextTick) : nextState,
      events,
    };
  }

  let jumpBufferAgeMs = input.jumpPressed
    ? 0
    : (Number.isFinite(nextState.jumpBufferAgeMs)
      ? nextState.jumpBufferAgeMs
      : tuning.jumpBufferMs + 1);
  const currentSupport = nextState.mode === 'grounded'
    ? querySupport(world, nextState.position, {
      maxDrop: 0.2,
      maxRise: 0.5,
      previousSurfaceId: nextState.surfaceId,
    })
    : null;
  let grounded = nextState.mode === 'grounded' && currentSupport !== null;
  if (!grounded && nextState.mode === 'grounded') {
    nextState.mode = 'airborne';
    nextState.groundRadius = Math.hypot(...nextState.position);
    nextState.verticalSpeed = 0;
  }

  let coyoteAgeMs = grounded
    ? 0
    : (Number.isFinite(nextState.coyoteAgeMs)
      ? nextState.coyoteAgeMs
      : tuning.coyoteTimeMs + 1);
  const jumpAvailable = grounded || coyoteAgeMs <= tuning.coyoteTimeMs;
  if (jumpBufferAgeMs <= tuning.jumpBufferMs && jumpAvailable) {
    if (grounded && currentSupport) {
      nextState.position = [...currentSupport.point];
      nextState.surfaceId = currentSupport.surfaceId;
      nextState.groundRadius = Math.hypot(...currentSupport.point);
    }
    makeJump(nextState, events, tuning, { surfaceId: nextState.surfaceId });
    grounded = false;
    coyoteAgeMs = tuning.coyoteTimeMs + 1;
  } else {
    nextState.jumpBufferAgeMs = jumpBufferAgeMs + deltaMs;
    if (!grounded) coyoteAgeMs += deltaMs;
  }

  if (input.trickPressed && nextState.mode === 'airborne') {
    events.push(eventRecord(nextState, 'trickCompleted', events.length, {
      trickId: input.trickPressed,
      surfaceId: nextState.surfaceId,
    }));
  }

  const speed = integrateSkaterSpeed(nextState.speed, input, delta, tuning);
  const up = normalize3(nextState.position);
  const steeringFactor = 1 - 0.5 * clamp(speed / tuning.maxSpeed, 0, 1);
  let forward = turnSkaterForward(nextState.forward, up, input.steer, delta, {
    turnRate: tuning.turnRate,
    steeringFactor,
  });
  if (forward.every((value) => value === 0)) forward = makeSurfaceFrame(up, nextState.forward).forward;
  nextState.forward = forward;
  nextState.speed = speed;

  const currentRadius = Math.hypot(...nextState.position);
  const moved = advanceAlongSphere(nextState.position, forward, speed * delta, currentRadius);
  const collision = sweepSkater(world, nextState.position, moved, tuning.bodyRadius);
  if (collision.blocked) {
    nextState.position = collision.position;
    nextState.mode = 'bailed';
    nextState.speed = 0;
    nextState.verticalSpeed = 0;
    nextState.bailRemainingMs = tuning.bailDurationMs;
    events.push(eventRecord(nextState, 'bailed', events.length, { hitId: collision.hitId }));
    return { state: nextState, events };
  }

  if (nextState.mode === 'grounded') {
    const support = querySupport(world, moved, {
      maxDrop: 1.5,
      maxRise: 1.5,
      previousSurfaceId: nextState.surfaceId,
    });
    if (support) {
      nextState.position = support.point;
      nextState.surfaceId = support.surfaceId;
      nextState.mode = 'grounded';
      nextState.groundRadius = Math.hypot(...support.point);
      nextState.verticalSpeed = 0;
      nextState.coyoteAgeMs = 0;
    } else {
      nextState.position = moved;
      nextState.mode = 'airborne';
      nextState.groundRadius = Math.hypot(...nextState.position);
      nextState.verticalSpeed = 0;
      nextState.coyoteAgeMs = 0;
    }
    const newUp = normalize3(nextState.position);
    nextState.forward = transportHeading(forward, up, newUp);
    return { state: nextState, events };
  }

  const groundRadius = Number.isFinite(nextState.groundRadius) && nextState.groundRadius > 0
    ? nextState.groundRadius
    : world.radius;
  const height = currentRadius - groundRadius;
  const verticalSpeed = Number.isFinite(nextState.verticalSpeed) ? nextState.verticalSpeed : 0;
  const verticalMotion = integrateVerticalMotion(height, verticalSpeed, delta, tuning.gravity);
  const nextHeight = verticalMotion.height;
  const nextVerticalSpeed = verticalMotion.verticalSpeed;
  const nextRadius = Math.max(world.radius * 0.5, groundRadius + nextHeight);
  const airbornePosition = normalize3(moved).map((value) => value * nextRadius);
  const landingSupport = querySupport(world, airbornePosition, {
    maxDrop: 4,
    maxRise: 4,
    previousSurfaceId: nextState.surfaceId,
  });
  const crossedSupport = landingSupport
    && nextVerticalSpeed <= 0
    && Math.hypot(...airbornePosition) <= Math.hypot(...landingSupport.point) + 0.02;

  nextState.position = airbornePosition;
  nextState.groundRadius = groundRadius;
  nextState.verticalSpeed = nextVerticalSpeed;
  nextState.coyoteAgeMs = coyoteAgeMs;
  nextState.mode = 'airborne';
  if (crossedSupport) {
    nextState.position = landingSupport.point;
    nextState.surfaceId = landingSupport.surfaceId;
    nextState.mode = 'grounded';
    nextState.groundRadius = Math.hypot(...landingSupport.point);
    nextState.verticalSpeed = 0;
    nextState.coyoteAgeMs = 0;
    events.push(eventRecord(nextState, 'landed', events.length, {
      surfaceId: landingSupport.surfaceId,
    }));
    if (jumpBufferAgeMs <= tuning.jumpBufferMs) {
      makeJump(nextState, events, tuning, { surfaceId: landingSupport.surfaceId });
    }
  }

  const newUp = normalize3(nextState.position);
  nextState.forward = transportHeading(forward, up, newUp);
  return { state: nextState, events };
}
