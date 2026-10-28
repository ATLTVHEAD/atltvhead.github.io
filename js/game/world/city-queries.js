import {
  cross3,
  dot3,
  makeSurfaceFrame,
  normalize3,
} from '../core/planet-math.js';

const CONTACT_TIE_TOLERANCE = 0.02;

function subtract(a, b) {
  return a.map((value, axis) => value - b[axis]);
}

function add(a, b) {
  return a.map((value, axis) => value + b[axis]);
}

function scale(vector, amount) {
  return vector.map((value) => value * amount);
}

function isFiniteVec3(value) {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
}

function barycentricContains(point, [a, b, c]) {
  const v0 = subtract(b, a);
  const v1 = subtract(c, a);
  const v2 = subtract(point, a);
  const d00 = dot3(v0, v0);
  const d01 = dot3(v0, v1);
  const d11 = dot3(v1, v1);
  const d20 = dot3(v2, v0);
  const d21 = dot3(v2, v1);
  const denominator = d00 * d11 - d01 * d01;
  if (Math.abs(denominator) < 1e-14) return false;
  const v = (d11 * d20 - d01 * d21) / denominator;
  const w = (d00 * d21 - d01 * d20) / denominator;
  const u = 1 - v - w;
  return u >= -1e-8 && v >= -1e-8 && w >= -1e-8;
}

function radialTriangleHit(direction, triangle) {
  const [a, b, c] = triangle.points;
  const denominator = dot3(triangle.normal, direction);
  if (Math.abs(denominator) < 1e-10) return null;
  const distance = dot3(triangle.normal, a) / denominator;
  if (distance <= 0) return null;
  const point = scale(direction, distance);
  return barycentricContains(point, triangle.points) ? { point, distance } : null;
}

function isBetterSurface(candidate, current, previousSurfaceId) {
  if (!current) return true;
  if (candidate.surfaceId === previousSurfaceId && current.surfaceId !== previousSurfaceId
    && candidate.distanceToSurface <= current.distanceToSurface + CONTACT_TIE_TOLERANCE) return true;
  if (current.surfaceId === previousSurfaceId && candidate.surfaceId !== previousSurfaceId
    && current.distanceToSurface <= candidate.distanceToSurface + CONTACT_TIE_TOLERANCE) return false;
  if (candidate.distanceToSurface < current.distanceToSurface - 1e-9) return true;
  if (Math.abs(candidate.distanceToSurface - current.distanceToSurface) <= 1e-9) {
    return candidate.surfaceId.localeCompare(current.surfaceId) < 0;
  }
  return false;
}

function supportWithinClearance(clearance, maxDrop, maxRise) {
  return clearance <= maxDrop + CONTACT_TIE_TOLERANCE
    && clearance >= -maxRise - CONTACT_TIE_TOLERANCE;
}

export function querySupport(world, position, options = {}) {
  if (!world || !isFiniteVec3(position)) return null;
  const radialPosition = Math.hypot(...position);
  if (radialPosition < 1e-9) return null;
  const gravityUp = normalize3(position);
  const maxDrop = Number.isFinite(options.maxDrop) ? Math.max(0, options.maxDrop) : 2;
  const maxRise = Number.isFinite(options.maxRise) ? Math.max(0, options.maxRise) : 2;
  let best = null;

  for (const surface of world.surfaces ?? []) {
    for (const triangle of surface.triangles ?? []) {
      const hit = radialTriangleHit(gravityUp, triangle);
      if (!hit) continue;
      const clearance = radialPosition - hit.distance;
      if (!supportWithinClearance(clearance, maxDrop, maxRise)) continue;
      const candidate = {
        surfaceId: surface.id,
        triangleId: triangle.id,
        point: hit.point,
        gravityUp,
        surfaceNormal: triangle.normal,
        tangent: triangle.tangent,
        clearance,
        distanceToSurface: Math.abs(clearance),
      };
      if (isBetterSurface(candidate, best, options.previousSurfaceId)) best = candidate;
    }
  }

  const terrainClearance = radialPosition - world.radius;
  if (supportWithinClearance(terrainClearance, maxDrop, maxRise)) {
    const terrain = {
      surfaceId: 'terrain',
      triangleId: null,
      point: scale(gravityUp, world.radius),
      gravityUp,
      surfaceNormal: gravityUp,
      tangent: makeSurfaceFrame(gravityUp, [0, 0, 1]).forward,
      clearance: terrainClearance,
      distanceToSurface: Math.abs(terrainClearance),
    };
    if (isBetterSurface(terrain, best, options.previousSurfaceId)) best = terrain;
  }

  if (!best) return null;
  const { distanceToSurface, ...support } = best;
  return support;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function closestSegments(a0, a1, b0, b1) {
  const u = subtract(a1, a0);
  const v = subtract(b1, b0);
  const w = subtract(a0, b0);
  const a = dot3(u, u);
  const b = dot3(u, v);
  const c = dot3(v, v);
  const d = dot3(u, w);
  const e = dot3(v, w);
  const denominator = a * c - b * b;
  let s = denominator < 1e-12 ? 0 : clamp((b * e - c * d) / denominator, 0, 1);
  let t = c < 1e-12 ? 0 : (b * s + e) / c;
  if (t < 0) {
    t = 0;
    s = a < 1e-12 ? 0 : clamp(-d / a, 0, 1);
  } else if (t > 1) {
    t = 1;
    s = a < 1e-12 ? 0 : clamp((b - d) / a, 0, 1);
  }
  const pointA = add(a0, scale(u, s));
  const pointB = add(b0, scale(v, t));
  return { s, distance: Math.hypot(...subtract(pointA, pointB)) };
}

function sweepBox(box, from, to, radius) {
  const start = box.axes.map((axis) => dot3(subtract(from, box.center), axis));
  const end = box.axes.map((axis) => dot3(subtract(to, box.center), axis));
  const extents = box.halfExtents.map((value) => value + Math.max(0, radius));
  const gaps = start.map((value, axis) => Math.abs(value) - extents[axis]);
  if (gaps.every((gap) => gap <= 0)) {
    const nearestGap = Math.max(...gaps);
    const separating = gaps.some((gap, axis) => gap >= nearestGap - 1e-9
      && (end[axis] - start[axis]) * (Math.sign(start[axis]) || 1) > 1e-9);
    if (separating) return null;
    return { progress: 0, safeProgress: 0 };
  }
  let enter = 0;
  let exit = 1;
  for (let axis = 0; axis < 3; axis += 1) {
    const direction = end[axis] - start[axis];
    if (Math.abs(direction) < 1e-12) {
      if (Math.abs(start[axis]) > extents[axis]) return null;
      continue;
    }
    const first = (-extents[axis] - start[axis]) / direction;
    const second = (extents[axis] - start[axis]) / direction;
    enter = Math.max(enter, Math.min(first, second));
    exit = Math.min(exit, Math.max(first, second));
    if (enter > exit) return null;
  }
  const length = Math.hypot(...subtract(to, from));
  return { progress: enter, safeProgress: Math.max(0, enter - 1e-4 / Math.max(length, 1e-9)) };
}

export function sweepSkater(world, from, to, radius = 0.25) {
  if (!world || !isFiniteVec3(from) || !isFiniteVec3(to)) {
    return { position: isFiniteVec3(from) ? [...from] : [0, 0, 0], blocked: false, hitId: null };
  }
  const movementLength = Math.hypot(...subtract(to, from));
  let bestHit = null;

  for (const building of world.buildings ?? []) {
    const capsule = building.collision;
    if (capsule?.type === 'box') {
      const hit = sweepBox(capsule, from, to, radius);
      if (hit && (!bestHit || hit.progress < bestHit.progress - 1e-9
          || (Math.abs(hit.progress - bestHit.progress) <= 1e-9 && building.id < bestHit.hitId))) {
        bestHit = { ...hit, hitId: building.id };
      }
      continue;
    }
    if (capsule?.type !== 'capsule') continue;
    const closest = closestSegments(from, to, capsule.start, capsule.end);
    const combinedRadius = Math.max(0, radius) + capsule.radius;
    if (closest.distance > combinedRadius) continue;
    const startDistance = closestSegments(from, from, capsule.start, capsule.end).distance;
    const endDistance = closestSegments(to, to, capsule.start, capsule.end).distance;
    // Existing contact must not trap a skater who is moving away from the wall.
    if (startDistance <= combinedRadius && endDistance > startDistance + 1e-9
        && closest.distance >= startDistance - 1e-9) continue;
    if (!bestHit || closest.s < bestHit.progress - 1e-9
      || (Math.abs(closest.s - bestHit.progress) <= 1e-9 && building.id < bestHit.hitId)) {
      bestHit = {
        progress: closest.s,
        safeProgress: movementLength > 1e-9
          ? Math.max(0, closest.s - combinedRadius / movementLength)
          : 0,
        hitId: building.id,
      };
    }
  }

  if (!bestHit) return { position: [...to], blocked: false, hitId: null };
  return {
    position: add(from, scale(subtract(to, from), bestHit.safeProgress)),
    blocked: true,
    hitId: bestHit.hitId,
  };
}
