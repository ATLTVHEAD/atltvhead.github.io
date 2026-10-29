import { dot3 } from './planet-math.js';
import { integrateSkaterSpeed } from './skater-simulation.js';
import { CITY_SKATER_TUNING } from './city-skater.js';
import { nearestImage } from './wrap-math.js';
import { projectSkatePath, sampleSkatePath } from '../world/skate-paths.js';
import { sweepPlanarSkater } from '../world/planar-city-queries.js';
import { SKATE_TUNING } from '../shared/skate-tuning.js';
import { getLaunchLockedPath } from './launch-state.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const subtract = (a, b) => a.map((value, axis) => value - b[axis]);
const add = (a, b) => a.map((value, axis) => value + b[axis]);
const scale = (vector, amount) => vector.map((value) => value * amount);
const horizontalUnit = (vector, direction = 1) => {
  const length = Math.hypot(vector[0], vector[2]);
  if (length <= 1e-12) return [0, 0, direction];
  return [vector[0] * direction / length, 0, vector[2] * direction / length];
};

function event(state, type, context = {}) {
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

function pathImage(path, reference, world, imageX = 0, imageZ = 0) {
  const centerX = (path.bounds.min[0] + path.bounds.max[0]) / 2;
  const centerZ = (path.bounds.min[2] + path.bounds.max[2]) / 2;
  const offsetX = nearestImage(centerX, reference[0], world.width) - centerX
    + imageX * world.width;
  const offsetZ = nearestImage(centerZ, reference[2], world.depth) - centerZ
    + imageZ * world.depth;
  return {
    path: {
      ...path,
      points: path.points.map((point) => [point[0] + offsetX, point[1], point[2] + offsetZ]),
      bounds: {
        min: [path.bounds.min[0] + offsetX, path.bounds.min[1], path.bounds.min[2] + offsetZ],
        max: [path.bounds.max[0] + offsetX, path.bounds.max[1], path.bounds.max[2] + offsetZ],
      },
    },
    offset: [offsetX, 0, offsetZ],
  };
}

function closestPathProjection(path, from, to, world) {
  const reference = from.map((value, axis) => (value + to[axis]) / 2);
  let best = null;
  for (let imageX = -1; imageX <= 1; imageX += 1) {
    for (let imageZ = -1; imageZ <= 1; imageZ += 1) {
      const image = pathImage(path, reference, world, imageX, imageZ);
      const projection = projectSkatePath(image.path, from, to);
      if (!projection) continue;
      if (!best || projection.distanceToPath < best.projection.distanceToPath - 1e-9
          || (Math.abs(projection.distanceToPath - best.projection.distanceToPath) <= 1e-9
            && (Math.abs(image.offset[0]) + Math.abs(image.offset[2])
              < Math.abs(best.offset[0]) + Math.abs(best.offset[2])))
          || (Math.abs(projection.distanceToPath - best.projection.distanceToPath) <= 1e-9
            && Math.abs(image.offset[0]) + Math.abs(image.offset[2])
              === Math.abs(best.offset[0]) + Math.abs(best.offset[2])
            && (image.offset[0] < best.offset[0]
              || (image.offset[0] === best.offset[0] && image.offset[2] < best.offset[2])))) {
        best = { projection, path: image.path, offset: image.offset };
      }
    }
  }
  return best;
}

function directionForMotion(motion, tangent, deltaSeconds) {
  const velocity = scale(subtract(motion.to, motion.from), 1 / deltaSeconds);
  const speed = Math.hypot(...velocity);
  if (speed <= 1e-9) return { velocity, speed, alignment: 0, direction: 1 };
  const along = dot3(velocity, tangent);
  return {
    velocity,
    speed,
    alignment: Math.abs(along) / speed,
    direction: along < 0 ? -1 : 1,
  };
}

function hasConnectedSupport(path, surfaceId, world) {
  if (!surfaceId) return false;
  return (path.connectedSupportIds ?? []).some((connectedId) => (
    connectedId === surfaceId
      || world.rails?.some((candidate) => candidate.id === connectedId
        && candidate.supportSurfaceId === surfaceId)
  ));
}

function isGroundedCaptureAllowed(path, state, motion, world) {
  return (state.mode === 'grounded' || motion.priorMode === 'grounded')
    && hasConnectedSupport(path, state.surfaceId ?? motion.priorSurfaceId, world);
}

function eventIndexForDismount(nextState, events, reason, signedDistanceAdvanced, pathId, pathSpeed) {
  events.push(event(nextState, 'grindEnded', {
    pathId,
    reason,
    signedDistanceAdvanced,
    speed: pathSpeed,
  }));
}

function dismount(nextState, path, direction, reason, events, signedDistanceAdvanced = 0,
  remainingSeconds = 0) {
  const pathId = nextState.railId;
  const pathSpeed = nextState.speed;
  let tangent = path && Number.isFinite(nextState.railDistance)
    ? sampleSkatePath(path, clamp(nextState.railDistance, 0, path.totalLength))?.tangent
    : null;
  if (tangent) tangent = scale(tangent, direction);
  if (!tangent && Array.isArray(nextState.forward)) {
    tangent = [nextState.forward[0], nextState.verticalSpeed / (nextState.speed || 1), nextState.forward[2]];
  }
  if (!tangent) tangent = [0, 0, direction];

  const tangentLength = Math.hypot(...tangent) || 1;
  const unit = scale(tangent, 1 / tangentLength);
  const scalarSpeed = Math.max(0, nextState.speed);
  nextState.mode = 'airborne';
  nextState.forward = horizontalUnit(unit, 1);
  nextState.speed = scalarSpeed * Math.hypot(unit[0], unit[2]);
  nextState.verticalSpeed = scalarSpeed * unit[1];
  nextState.groundHeight = nextState.position[1];
  nextState.supportNormal = [0, 1, 0];
  nextState.railId = null;
  nextState.railDistance = 0;
  nextState.railDirection = 1;
  nextState.balance = 0;
  nextState.grindAgeMs = 0;
  nextState.recaptureRemainingMs = SKATE_TUNING.grindRecaptureCooldownMs;
  eventIndexForDismount(nextState, events, reason, signedDistanceAdvanced, pathId, pathSpeed);
  return { state: nextState, events, remainingSeconds };
}

function dismountMissingPath(nextState, events, remainingSeconds) {
  const pathId = nextState.railId;
  const pathSpeed = nextState.speed;
  nextState.mode = 'airborne';
  nextState.railId = null;
  nextState.railDistance = 0;
  nextState.railDirection = 1;
  nextState.balance = 0;
  nextState.grindAgeMs = 0;
  nextState.recaptureRemainingMs = SKATE_TUNING.grindRecaptureCooldownMs;
  eventIndexForDismount(nextState, events, 'missing-path', 0, pathId, pathSpeed);
  return { state: nextState, events, remainingSeconds };
}

function straightDriftSign(id) {
  let sum = 0;
  for (const character of String(id)) sum += character.charCodeAt(0);
  return sum % 2 === 0 ? 1 : -1;
}

function segmentTangents(path) {
  return path.segmentLengths.map((length, index) => length > 1e-12
    ? scale(subtract(path.points[index + 1], path.points[index]), 1 / length)
    : [0, 0, 0]);
}

function signedPlanarAngle(from, to) {
  return Math.atan2(from[2] * to[0] - from[0] * to[2], from[0] * to[0] + from[2] * to[2]);
}

function pathCurvature(path, distance, direction) {
  const tangents = segmentTangents(path);
  let offset = 0;
  let index = tangents.length - 1;
  for (let candidate = 0; candidate < path.segmentLengths.length; candidate += 1) {
    const length = path.segmentLengths[candidate];
    if (distance <= offset + length || candidate === path.segmentLengths.length - 1) {
      index = candidate;
      break;
    }
    offset += length;
  }
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= tangents.length) return 0;
  const current = scale(tangents[index], direction);
  const following = scale(tangents[nextIndex], direction);
  const averageLength = (path.segmentLengths[index] + path.segmentLengths[nextIndex]) / 2;
  if (averageLength <= 1e-9) return 0;
  return signedPlanarAngle(current, following) / averageLength;
}

function balanceAfter(nextState, path, direction, input, deltaSeconds) {
  const ageMs = nextState.grindAgeMs + deltaSeconds * 1000;
  let balance = nextState.balance;
  if (ageMs > SKATE_TUNING.balanceEntryGraceMs) {
    const progress = clamp(ageMs / SKATE_TUNING.balanceDriftRampMs, 0, 1);
    const drift = SKATE_TUNING.balanceInitialDrift
      + (SKATE_TUNING.balanceMaximumDrift - SKATE_TUNING.balanceInitialDrift) * progress;
    const directionCurvature = pathCurvature(path, nextState.railDistance, direction);
    const curvature = clamp(
      directionCurvature * nextState.speed,
      -SKATE_TUNING.balanceCurvatureMaximum,
      SKATE_TUNING.balanceCurvatureMaximum,
    );
    balance += (
      straightDriftSign(path.id) * drift
      + curvature
      - input.steer * SKATE_TUNING.balanceCorrectionGain
    ) * deltaSeconds;
  }
  return { balance, ageMs };
}

function initialState(state) {
  return {
    ...state,
    position: [...state.position],
    forward: [...state.forward],
    supportNormal: [...(state.supportNormal ?? [0, 1, 0])],
  };
}

function tryCapture(nextState, input, deltaSeconds, world, motion, events) {
  if (nextState.mode === 'bailed' || nextState.mode === 'grinding') return nextState;
  if (nextState.recaptureRemainingMs > 0) return nextState;
  if (Math.abs(nextState.speed) < SKATE_TUNING.grindSpeed) return nextState;
  const motionDirection = directionForMotion(motion, [1, 0, 0], deltaSeconds);
  if (motionDirection.speed <= 1e-9) return nextState;

  const sourcePath = getLaunchLockedPath(nextState, world);
  const candidates = [];
  for (const path of world.rails ?? []) {
    if (sourcePath?.id === path.id) continue;
    if (nextState.mode === 'grounded' || motion.priorMode === 'grounded') {
      if (!isGroundedCaptureAllowed(path, nextState, motion, world)) continue;
    } else if (nextState.mode !== 'airborne') {
      continue;
    }
    const nearest = closestPathProjection(path, motion.from, motion.to, world);
    if (!nearest || nearest.projection.distanceToPath
      > SKATE_TUNING.grindCaptureDistance + 1e-9) continue;
    const motionDirectionForPath = directionForMotion(motion, nearest.projection.tangent, deltaSeconds);
    if (motionDirectionForPath.alignment + 1e-9 < SKATE_TUNING.grindCaptureAlignment) continue;
    const direction = motionDirectionForPath.direction;
    const remaining = direction > 0
      ? path.totalLength - nearest.projection.distanceAlong
      : nearest.projection.distanceAlong;
    if (remaining <= 1e-6) continue;
    candidates.push({ path, nearest, direction, alignment: motionDirectionForPath.alignment });
  }
  candidates.sort((a, b) => a.nearest.projection.distanceToPath - b.nearest.projection.distanceToPath
    || a.path.id.localeCompare(b.path.id));
  const selected = candidates[0];
  if (!selected) return nextState;

  const { path, nearest, direction } = selected;
  const sampled = sampleSkatePath(nearest.path, nearest.projection.distanceAlong);
  if (!sampled) return nextState;
  nextState.mode = 'grinding';
  nextState.position = [...sampled.point];
  nextState.surfaceId = path.supportSurfaceId ?? nextState.surfaceId;
  nextState.supportNormal = [...sampled.gravityUp];
  nextState.forward = horizontalUnit(sampled.tangent, direction);
  nextState.speed = Math.abs(nextState.speed);
  nextState.verticalSpeed = 0;
  nextState.groundHeight = sampled.point[1];
  nextState.railId = path.id;
  nextState.railDistance = nearest.projection.distanceAlong;
  nextState.railDirection = direction;
  nextState.railImageOffset = [...nearest.offset];
  nextState.balance = 0;
  nextState.grindAgeMs = 0;
  events.push(event(nextState, 'grindStarted', {
    pathId: path.id,
    direction,
    distance: nearest.projection.distanceAlong,
    speed: nextState.speed,
  }));
  return nextState;
}

function stepLockedGrind(nextState, input, deltaSeconds, world, events) {
  const path = world.rails?.find((candidate) => candidate.id === nextState.railId);
  const direction = nextState.railDirection === -1 ? -1 : 1;
  if (!path) {
    return dismountMissingPath(nextState, events, deltaSeconds);
  }
  if (input.jumpPressed) {
    const result = dismount(nextState, path, direction, 'jump', events, 0, deltaSeconds);
    result.state.verticalSpeed += CITY_SKATER_TUNING.jumpSpeed;
    events.push(event(result.state, 'jumped', { pathId: path.id, reason: 'grind-dismount' }));
    return result;
  }

  const speedTuning = { ...CITY_SKATER_TUNING };
  nextState.speed = integrateSkaterSpeed(nextState.speed, input, deltaSeconds, speedTuning);
  const nextDistance = nextState.railDistance + direction * nextState.speed * deltaSeconds;
  const endDistance = direction > 0 ? path.totalLength : 0;
  const remainingDistance = Math.abs(endDistance - nextState.railDistance);
  const endpointSeconds = nextState.speed > 0 ? remainingDistance / nextState.speed : 0;
  const hitsEndpoint = endpointSeconds <= deltaSeconds;
  const usedSeconds = hitsEndpoint ? Math.max(0, endpointSeconds) : deltaSeconds;
  const targetDistance = hitsEndpoint ? endDistance : nextDistance;
  const sampled = sampleSkatePath(path, clamp(targetDistance, 0, path.totalLength));
  if (!sampled) return dismountMissingPath(nextState, events, deltaSeconds);
  const imageOffset = Array.isArray(nextState.railImageOffset) ? nextState.railImageOffset : [0, 0, 0];
  const target = add(sampled.point, imageOffset);
  const collision = sweepPlanarSkater(world, nextState.position, target, SKATE_TUNING.bodyRadius);
  if (collision.blocked) {
    nextState.position = [...collision.position];
    nextState.speed = 0;
    return dismount(nextState, path, direction, 'collision', events,
      direction * (targetDistance - nextState.railDistance), 0);
  }
  nextState.position = target;
  nextState.railDistance = targetDistance;
  nextState.forward = horizontalUnit(sampled.tangent, direction);
  nextState.verticalSpeed = sampled.tangent[1] * nextState.speed * direction;
  nextState.groundHeight = sampled.point[1];
  nextState.supportNormal = [...sampled.gravityUp];
  const balance = balanceAfter(nextState, path, direction, input, usedSeconds);
  nextState.balance = clamp(balance.balance, -SKATE_TUNING.balanceLimit, SKATE_TUNING.balanceLimit);
  nextState.grindAgeMs = balance.ageMs;
  const signedDistanceAdvanced = targetDistance - (nextDistance - direction * nextState.speed * deltaSeconds);

  if (hitsEndpoint) {
    return dismount(nextState, path, direction, 'endpoint', events,
      signedDistanceAdvanced,
      deltaSeconds - usedSeconds);
  }
  if (Math.abs(nextState.balance) >= SKATE_TUNING.balanceLimit) {
    return dismount(nextState, path, direction, 'balance-failure', events, signedDistanceAdvanced, 0);
  }
  if (nextState.speed < SKATE_TUNING.grindSpeed) {
    return dismount(nextState, path, direction, 'slow', events, signedDistanceAdvanced, 0);
  }
  return { state: nextState, events, remainingSeconds: 0 };
}

export function stepGrind(state, rawInput, deltaSeconds, world, motion) {
  const nextState = initialState(state);
  const input = {
    steer: clamp(rawInput?.steer ?? 0, -1, 1),
    throttle: clamp(rawInput?.throttle ?? 0, 0, 1),
    brake: clamp(rawInput?.brake ?? 0, 0, 1),
    jumpPressed: Boolean(rawInput?.jumpPressed),
  };
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return { state: nextState, events: [] };
  const events = [];
  if (nextState.mode === 'grinding') {
    return stepLockedGrind(nextState, input, deltaSeconds, world, events);
  }

  nextState.recaptureRemainingMs = Math.max(
    0,
    (Number.isFinite(nextState.recaptureRemainingMs) ? nextState.recaptureRemainingMs : 0)
      - deltaSeconds * 1000,
  );
  const captured = tryCapture(nextState, input, deltaSeconds, world, motion, events);
  return { state: captured, events };
}
