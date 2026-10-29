import { nearestImage } from './wrap-math.js';
import { projectSkatePath } from '../world/skate-paths.js';
import { sweepPlanarSkater } from '../world/planar-city-queries.js';
import { SKATE_TUNING } from '../shared/skate-tuning.js';

const dot = (a, b) => a.reduce((sum, value, axis) => sum + value * b[axis], 0);
const subtract = (a, b) => a.map((value, axis) => value - b[axis]);

function markerPoint(marker, reference, world) {
  return [
    nearestImage(marker.point[0], reference[0], world.width),
    marker.point[1],
    nearestImage(marker.point[2], reference[2], world.depth),
  ];
}

function crossesMarker(marker, motion, world) {
  const reference = motion.from.map((value, axis) => (value + motion.to[axis]) / 2);
  const point = markerPoint(marker, reference, world);
  const before = dot(subtract(motion.from, point), marker.normal);
  const after = dot(subtract(motion.to, point), marker.normal);
  const normalTravel = after - before;
  if (normalTravel * marker.direction <= 0) return null;
  if (before * marker.direction > 0 || after * marker.direction < 0) return null;
  const tangentTravel = dot(subtract(motion.to, motion.from), marker.tangent);
  if (tangentTravel * marker.direction <= 0) return null;

  const fraction = Math.max(0, Math.min(1, -before / normalTravel));
  const crossing = motion.from.map((value, axis) => (
    value + (motion.to[axis] - value) * fraction
  ));
  const lateral = [-marker.tangent[2], 0, marker.tangent[0]];
  const offset = subtract(crossing, point);
  if (Math.abs(dot(offset, lateral)) > marker.halfWidth
      || Math.abs(offset[1]) > marker.halfHeight) return null;
  return { point: crossing, fraction };
}

function lockHasCleared(marker, position, world) {
  const path = world.rails?.find((candidate) => candidate.id === marker.supportId);
  if (!path) return true;
  const centerX = (path.bounds.min[0] + path.bounds.max[0]) / 2;
  const centerZ = (path.bounds.min[2] + path.bounds.max[2]) / 2;
  const baseX = nearestImage(centerX, position[0], world.width) - centerX;
  const baseZ = nearestImage(centerZ, position[2], world.depth) - centerZ;
  let closestDistance = Infinity;
  for (let imageX = -1; imageX <= 1; imageX += 1) {
    for (let imageZ = -1; imageZ <= 1; imageZ += 1) {
      const offsetX = baseX + imageX * world.width;
      const offsetZ = baseZ + imageZ * world.depth;
      const imagePath = {
        ...path,
        points: path.points.map((point) => [point[0] + offsetX, point[1], point[2] + offsetZ]),
      };
      const projection = projectSkatePath(imagePath, position, position);
      if (projection) closestDistance = Math.min(closestDistance, projection.distanceToPath);
    }
  }
  return closestDistance > SKATE_TUNING.grindCaptureDistance + 1e-9;
}

function sourcePathForLock(state, world) {
  if (!state.launchLockId) return null;
  const marker = world.launchMarkers?.find((candidate) => candidate.id === state.launchLockId);
  if (!marker) return null;
  return world.rails?.find((path) => path.id === marker.supportId) ?? null;
}

export function stepLaunch(state, input, deltaSeconds, world, motion) {
  const nextState = { ...state, position: [...state.position] };
  if (nextState.launchLockId) {
    const lockedMarker = world.launchMarkers?.find((marker) => marker.id === nextState.launchLockId);
    if (!lockedMarker || lockHasCleared(lockedMarker, motion.to, world)) nextState.launchLockId = null;
  }

  if (motion.priorMode !== 'grounded' || nextState.mode === 'bailed') {
    return { state: nextState, events: [] };
  }

  let crossing = null;
  let crossedMarker = null;
  for (const marker of world.launchMarkers ?? []) {
    const candidate = crossesMarker(marker, motion, world);
    if (!candidate) continue;
    if (!crossedMarker || marker.id < crossedMarker.id) {
      crossing = candidate;
      crossedMarker = marker;
    }
  }
  if (!crossedMarker || nextState.launchLockId === crossedMarker.id) {
    return { state: nextState, events: [] };
  }

  const path = world.rails?.find((candidate) => candidate.id === crossedMarker.supportId);
  if (!path || ![path.id, path.supportSurfaceId].includes(motion.priorSurfaceId)) {
    return { state: nextState, events: [] };
  }

  if (motion.manualJumped) {
    nextState.launchLockId = crossedMarker.id;
    return { state: nextState, events: [] };
  }
  if (nextState.speed < SKATE_TUNING.launchSpeed) return { state: nextState, events: [] };

  nextState.launchLockId = crossedMarker.id;
  nextState.mode = 'airborne';
  nextState.groundHeight = crossing.point[1];
  nextState.verticalSpeed = SKATE_TUNING.launchUpSpeed;
  nextState.supportNormal = [0, 1, 0];
  nextState.coyoteAgeMs = SKATE_TUNING.coyoteTimeMs + 1;

  const remaining = deltaSeconds * (1 - crossing.fraction);
  const target = [
    crossing.point[0] + nextState.forward[0] * nextState.speed * remaining,
    crossing.point[1] + nextState.verticalSpeed * remaining
      - 0.5 * SKATE_TUNING.gravity * remaining * remaining,
    crossing.point[2] + nextState.forward[2] * nextState.speed * remaining,
  ];
  if (remaining > 0) {
    const clearance = sweepPlanarSkater(world, crossing.point, target, SKATE_TUNING.bodyRadius);
    nextState.position = clearance.position;
    if (clearance.blocked) nextState.speed = 0;
  } else {
    nextState.position = [...crossing.point];
  }
  nextState.verticalSpeed -= SKATE_TUNING.gravity * remaining;

  const eventIndex = Number.isSafeInteger(nextState.eventIndex) ? nextState.eventIndex + 1 : 1;
  nextState.eventIndex = eventIndex;
  const event = {
    eventId: `${nextState.sessionId ?? 'local'}:${nextState.tick}:${eventIndex}`,
    eventIndex,
    tick: nextState.tick,
    type: 'launched',
    markerId: crossedMarker.id,
    speed: state.speed,
    verticalSpeed: SKATE_TUNING.launchUpSpeed,
  };
  return { state: nextState, events: [event] };
}

export function getLaunchLockedPath(state, world) {
  return sourcePathForLock(state, world);
}
