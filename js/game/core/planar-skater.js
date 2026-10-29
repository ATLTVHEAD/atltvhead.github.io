import { normalize3 } from './planet-math.js';
import {
  integrateSkaterSpeed,
  integrateVerticalMotion,
  turnSkaterForward,
} from './skater-simulation.js';
import { CITY_SKATER_TUNING } from './city-skater.js';
import { normalizeInputFrame } from '../input/actions.js';
import { wrapPosition } from './wrap-math.js';
import { queryPlanarSupport, sweepPlanarSkater } from '../world/planar-city-queries.js';
import { stepLaunch } from './launch-state.js';
import { stepGrind } from './grind-state.js';
import { SKATE_TUNING } from '../shared/skate-tuning.js';

const UP = Object.freeze([0, 1, 0]);
const MODES = new Set(['grounded', 'airborne', 'grinding', 'bailed']);
const EMPTY_INPUT = Object.freeze(normalizeInputFrame());

function finiteVector(value) {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
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

function planarForward(value) {
  if (!finiteVector(value)) return [0, 0, 1];
  const forward = normalize3([value[0], 0, value[2]]);
  return forward.every((component) => component === 0) ? [0, 0, 1] : forward;
}

function spawnRecords(world) {
  if (Array.isArray(world?.spawnPoints) && world.spawnPoints.length > 0) return world.spawnPoints;
  const width = Number.isFinite(world?.width) && world.width > 0 ? world.width : 256;
  const depth = Number.isFinite(world?.depth) && world.depth > 0 ? world.depth : 256;
  return [{
    id: 'spawn-fallback',
    surfaceId: 'ground',
    position: [width / 2, 0, depth / 2],
    forward: [0, 0, 1],
  }];
}

function dimensions(world) {
  return { width: world.width, depth: world.depth };
}

export function createPlanarSkater(world, spawnId) {
  const spawns = spawnRecords(world);
  const spawn = spawns.find((entry) => entry.id === spawnId)
    ?? spawns.find((entry) => entry.id === world?.defaultSpawnId)
    ?? spawns[0];
  const support = queryPlanarSupport(world, spawn.position, {
    maxDrop: 0.1,
    maxRise: 0.1,
    previousSurfaceId: spawn.surfaceId,
  });
  const position = wrapPosition(support?.point ?? [...spawn.position], dimensions(world));
  const forward = planarForward(spawn.forward);
  return {
    spawnId: spawn.id,
    position,
    forward,
    supportNormal: [...(support?.surfaceNormal ?? UP)],
    gravityUp: [...UP],
    speed: 0,
    mode: 'grounded',
    surfaceId: support?.surfaceId ?? spawn.surfaceId ?? 'ground',
    railId: null,
    railDistance: 0,
    verticalSpeed: 0,
    groundHeight: position[1],
    jumpBufferAgeMs: CITY_SKATER_TUNING.jumpBufferMs + 1,
    coyoteAgeMs: 0,
    bailRemainingMs: 0,
    tick: 0,
    sessionId: 'local',
    eventIndex: 0,
    launchLockId: null,
    railDirection: 1,
    balance: 0,
    grindAgeMs: 0,
    recaptureRemainingMs: 0,
    activeTrick: null,
  };
}

function isUsableState(state) {
  return finiteVector(state?.position)
    && finiteVector(state?.forward)
    && Number.isFinite(state?.speed)
    && Number.isFinite(state?.verticalSpeed)
    && Number.isFinite(state?.groundHeight)
    && MODES.has(state?.mode);
}

function cloneState(state) {
  return {
    ...state,
    position: finiteVector(state?.position) ? [...state.position] : state?.position,
    forward: finiteVector(state?.forward) ? [...state.forward] : state?.forward,
    supportNormal: finiteVector(state?.supportNormal) ? [...state.supportNormal] : [...UP],
    gravityUp: finiteVector(state?.gravityUp) ? [...state.gravityUp] : [...UP],
  };
}

function eventRecord(state, type, index, context = {}) {
  const eventIndex = Number.isSafeInteger(state.eventIndex) ? state.eventIndex + 1 : 1;
  state.eventIndex = eventIndex;
  return {
    eventId: `${state.sessionId ?? 'local'}:${state.tick}:${eventIndex}`,
    eventIndex,
    tick: state.tick,
    type,
    ...context,
  };
}

function safeRecovery(world, state, nextTick, reason) {
  const recovered = createPlanarSkater(world, state?.spawnId);
  recovered.tick = nextTick;
  recovered.sessionId = typeof state?.sessionId === 'string' ? state.sessionId : 'local';
  recovered.eventIndex = Number.isSafeInteger(state?.eventIndex) ? state.eventIndex : 0;
  return {
    state: recovered,
    events: [eventRecord(recovered, 'bailed', 0, { reason })],
  };
}

function respawn(world, state, nextTick) {
  const recovered = createPlanarSkater(world, state.spawnId);
  recovered.tick = nextTick;
  recovered.sessionId = state.sessionId ?? 'local';
  recovered.eventIndex = Number.isSafeInteger(state.eventIndex) ? state.eventIndex : 0;
  return recovered;
}

function makeJump(state, events, tuning, context = {}) {
  state.mode = 'airborne';
  state.verticalSpeed = tuning.jumpSpeed;
  state.jumpBufferAgeMs = tuning.jumpBufferMs + 1;
  state.supportNormal = [...UP];
  events.push(eventRecord(state, 'jumped', events.length, context));
}

function wrapStatePosition(state, world) {
  state.position = wrapPosition(state.position, dimensions(world));
  state.gravityUp = [...UP];
  return state;
}

function advanceDismounted(state, deltaSeconds, world, tuning, events) {
  if (deltaSeconds <= 0) return state;
  const height = Math.max(0, state.position[1] - state.groundHeight);
  const vertical = integrateVerticalMotion(height, state.verticalSpeed, deltaSeconds, tuning.gravity);
  const targetY = state.groundHeight + vertical.height;
  const moved = [
    state.position[0] + state.forward[0] * state.speed * deltaSeconds,
    targetY,
    state.position[2] + state.forward[2] * state.speed * deltaSeconds,
  ];
  const collision = sweepPlanarSkater(world, state.position, moved, tuning.bodyRadius);
  const resolved = collision.blocked
    ? [collision.position[0], targetY, collision.position[2]]
    : collision.position;
  const support = queryPlanarSupport(world, resolved, {
    maxDrop: 4,
    maxRise: 4,
    previousSurfaceId: state.surfaceId,
  });
  const crossedSupport = support && vertical.verticalSpeed <= 0
    && resolved[1] <= support.point[1] + 0.02;
  state.position = crossedSupport ? [...support.point] : resolved;
  state.verticalSpeed = crossedSupport ? 0 : vertical.verticalSpeed;
  state.mode = crossedSupport ? 'grounded' : 'airborne';
  state.supportNormal = crossedSupport ? [...support.surfaceNormal] : [...UP];
  if (crossedSupport) {
    state.surfaceId = support.surfaceId;
    state.groundHeight = support.point[1];
    state.coyoteAgeMs = 0;
    events.push(eventRecord(state, 'landed', events.length, {
      surfaceId: support.surfaceId,
    }));
  }
  return state;
}

export function stepSkaterOnPlanarCity(state, rawInput, deltaSeconds, world, tuningOverrides = {}) {
  const tuning = { ...CITY_SKATER_TUNING, ...SKATE_TUNING, ...tuningOverrides };
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
    return { state: cloneState(state), events: [] };
  }
  const maxDelta = Number.isFinite(tuning.maxDeltaSeconds) && tuning.maxDeltaSeconds > 0
    ? tuning.maxDeltaSeconds
    : CITY_SKATER_TUNING.maxDeltaSeconds;
  const delta = Math.min(deltaSeconds, maxDelta);
  const nextTick = (Number.isSafeInteger(state?.tick) ? state.tick : 0) + 1;
  if (!isUsableState(state)) return safeRecovery(world, state, nextTick, 'invalid-state');

  const nextState = cloneState(state);
  const priorMode = nextState.mode;
  const priorSurfaceId = nextState.surfaceId;
  const motionFrom = [...nextState.position];
  nextState.tick = nextTick;
  nextState.gravityUp = [...UP];
  if (!finiteVector(nextState.supportNormal)) nextState.supportNormal = [...UP];
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

  if (nextState.mode === 'grinding') {
    const grind = stepGrind(nextState, input, delta, world, {
      from: motionFrom,
      to: [...motionFrom],
      priorMode,
      priorSurfaceId,
    });
    events.push(...grind.events);
    let finalState = grind.state;
    if (finalState.mode === 'airborne' && grind.remainingSeconds > 0) {
      finalState = advanceDismounted(finalState, grind.remainingSeconds, world, tuning, events);
    }
    wrapStatePosition(finalState, world);
    return { state: finalState, events };
  }

  let jumpBufferAgeMs = input.jumpPressed
    ? 0
    : (Number.isFinite(nextState.jumpBufferAgeMs)
      ? nextState.jumpBufferAgeMs
      : tuning.jumpBufferMs + 1);
  const currentSupport = nextState.mode === 'grounded'
    ? queryPlanarSupport(world, nextState.position, {
      maxDrop: 0.2,
      maxRise: 0.5,
      previousSurfaceId: nextState.surfaceId,
    })
    : null;
  let grounded = nextState.mode === 'grounded' && currentSupport !== null;
  if (!grounded && nextState.mode === 'grounded') {
    nextState.mode = 'airborne';
    nextState.groundHeight = Number.isFinite(nextState.groundHeight)
      ? nextState.groundHeight
      : nextState.position[1];
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
      nextState.supportNormal = [...currentSupport.surfaceNormal];
      nextState.groundHeight = currentSupport.point[1];
    }
    makeJump(nextState, events, tuning, { surfaceId: nextState.surfaceId });
    grounded = false;
    coyoteAgeMs = tuning.coyoteTimeMs + 1;
  } else {
    nextState.jumpBufferAgeMs = jumpBufferAgeMs + deltaMs;
    if (!grounded) coyoteAgeMs += deltaMs;
  }

  const speed = integrateSkaterSpeed(nextState.speed, input, delta, tuning);
  const steeringFactor = 1 - 0.5 * clamp(speed / tuning.maxSpeed, 0, 1);
  let forward = turnSkaterForward(nextState.forward, UP, input.steer, delta, {
    turnRate: tuning.turnRate,
    steeringFactor,
  });
  if (forward.every((component) => component === 0)) forward = planarForward(nextState.forward);
  nextState.forward = forward;
  nextState.speed = speed;

  let targetY = nextState.position[1];
  let nextVerticalSpeed = nextState.verticalSpeed;
  if (nextState.mode !== 'grounded') {
    const height = Math.max(0, nextState.position[1] - nextState.groundHeight);
    const verticalMotion = integrateVerticalMotion(height, nextVerticalSpeed, delta, tuning.gravity);
    targetY = nextState.groundHeight + verticalMotion.height;
    nextVerticalSpeed = verticalMotion.verticalSpeed;
  }
  const horizontalDistance = speed * delta;
  const moved = [
    nextState.position[0] + forward[0] * horizontalDistance,
    targetY,
    nextState.position[2] + forward[2] * horizontalDistance,
  ];
  const collision = sweepPlanarSkater(world, nextState.position, moved, tuning.bodyRadius);
  let locallyResolved = collision.position;
  if (collision.blocked) {
    nextState.speed = 0;
    if (tuning.collisionResponse === 'bail') {
      nextState.mode = 'bailed';
      nextState.bailRemainingMs = tuning.bailDurationMs;
      nextState.position = [...collision.position];
      wrapStatePosition(nextState, world);
      events.push(eventRecord(nextState, 'bailed', events.length, { hitId: collision.hitId }));
      nextState.verticalSpeed = 0;
      return { state: nextState, events };
    }
    locallyResolved = [collision.position[0], targetY, collision.position[2]];
  }

  if (nextState.mode === 'grounded') {
    const support = queryPlanarSupport(world, locallyResolved, {
      maxDrop: 1.5,
      maxRise: 0.5,
      previousSurfaceId: nextState.surfaceId,
    });
    if (support) {
      nextState.position = [...support.point];
      nextState.surfaceId = support.surfaceId;
      nextState.supportNormal = [...support.surfaceNormal];
      nextState.mode = 'grounded';
      nextState.groundHeight = support.point[1];
      nextState.verticalSpeed = 0;
      nextState.coyoteAgeMs = 0;
    } else {
      nextState.position = locallyResolved;
      nextState.mode = 'airborne';
      nextState.groundHeight = nextState.position[1];
      nextState.verticalSpeed = 0;
      nextState.supportNormal = [...UP];
      nextState.coyoteAgeMs = 0;
    }
  } else {
    const landingSupport = queryPlanarSupport(world, locallyResolved, {
      maxDrop: 4,
      maxRise: 4,
      previousSurfaceId: nextState.surfaceId,
    });
    const crossedSupport = landingSupport
      && nextVerticalSpeed <= 0
      && locallyResolved[1] <= landingSupport.point[1] + 0.02;
    nextState.position = locallyResolved;
    nextState.groundHeight = Number.isFinite(nextState.groundHeight)
      ? nextState.groundHeight
      : (landingSupport?.point[1] ?? 0);
    nextState.verticalSpeed = nextVerticalSpeed;
    nextState.coyoteAgeMs = coyoteAgeMs;
    nextState.mode = 'airborne';
    nextState.supportNormal = [...UP];
    if (crossedSupport) {
      nextState.position = [...landingSupport.point];
      nextState.surfaceId = landingSupport.surfaceId;
      nextState.supportNormal = [...landingSupport.surfaceNormal];
      nextState.mode = 'grounded';
      nextState.groundHeight = landingSupport.point[1];
      nextState.verticalSpeed = 0;
      nextState.coyoteAgeMs = 0;
      events.push(eventRecord(nextState, 'landed', events.length, {
        surfaceId: landingSupport.surfaceId,
      }));
      if (jumpBufferAgeMs <= tuning.jumpBufferMs) {
        makeJump(nextState, events, tuning, { surfaceId: landingSupport.surfaceId });
      }
    }
  }

  const motion = {
    from: motionFrom,
    to: [...nextState.position],
    priorMode,
    priorSurfaceId,
    manualJumped: events.some((event) => event.type === 'jumped'),
  };
  const launch = stepLaunch(nextState, input, delta, world, motion);
  events.push(...launch.events);
  const grind = stepGrind(launch.state, input, delta, world, motion);
  events.push(...grind.events);
  wrapStatePosition(grind.state, world);
  return { state: grind.state, events };
}
