import { wrapDelta } from '../core/wrap-math.js';
import { sweepBox } from './city-queries.js';

const CONTACT_TIE_TOLERANCE = 0.02;

function compareIds(first, second) {
  const a = String(first ?? '');
  const b = String(second ?? '');
  return a < b ? -1 : a > b ? 1 : 0;
}

function isFiniteVector(value) {
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

function closestImageRange(value, min, max, span) {
  return {
    first: Math.ceil((value - max) / span - 1e-12),
    last: Math.floor((value - min) / span + 1e-12),
  };
}

function projectedBarycentric(point, triangle) {
  const [a, b, c] = triangle.points;
  const abX = b[0] - a[0];
  const abZ = b[2] - a[2];
  const acX = c[0] - a[0];
  const acZ = c[2] - a[2];
  const apX = point[0] - a[0];
  const apZ = point[2] - a[2];
  const denominator = abX * acZ - abZ * acX;
  if (Math.abs(denominator) < 1e-12) return null;
  const v = (apX * acZ - apZ * acX) / denominator;
  const w = (abX * apZ - abZ * apX) / denominator;
  const u = 1 - v - w;
  if (u < -1e-8 || v < -1e-8 || w < -1e-8) return null;
  return { u, v, w };
}

function isBetterSupport(candidate, current, previousSurfaceId) {
  if (!current) return true;
  if (candidate.surfaceId === previousSurfaceId && current.surfaceId !== previousSurfaceId
      && candidate.distanceToSurface <= current.distanceToSurface + CONTACT_TIE_TOLERANCE) return true;
  if (current.surfaceId === previousSurfaceId && candidate.surfaceId !== previousSurfaceId
      && current.distanceToSurface <= candidate.distanceToSurface + CONTACT_TIE_TOLERANCE) return false;
  if (candidate.isFallback !== current.isFallback) return !candidate.isFallback;
  if (candidate.distanceToSurface < current.distanceToSurface - 1e-9) return true;
  if (Math.abs(candidate.distanceToSurface - current.distanceToSurface) <= 1e-9) {
    const surfaceOrder = compareIds(candidate.surfaceId, current.surfaceId);
    if (surfaceOrder !== 0) return surfaceOrder < 0;
    return compareIds(candidate.triangleId, current.triangleId) < 0;
  }
  return false;
}

function supportWithinClearance(clearance, maxDrop, maxRise) {
  return clearance <= maxDrop + CONTACT_TIE_TOLERANCE
    && clearance >= -maxRise - CONTACT_TIE_TOLERANCE;
}

function pointTriangleSupport(world, position, triangle) {
  const bounds = triangle.bounds;
  const xImages = closestImageRange(position[0], bounds.min[0], bounds.max[0], world.width);
  const zImages = closestImageRange(position[2], bounds.min[2], bounds.max[2], world.depth);
  let best = null;
  for (let imageX = xImages.first; imageX <= xImages.last; imageX += 1) {
    for (let imageZ = zImages.first; imageZ <= zImages.last; imageZ += 1) {
      const offset = [imageX * world.width, 0, imageZ * world.depth];
      const translated = {
        ...triangle,
        points: triangle.points.map((point) => add(point, offset)),
      };
      const weights = projectedBarycentric(position, translated);
      if (!weights) continue;
      const height = weights.u * translated.points[0][1]
        + weights.v * translated.points[1][1]
        + weights.w * translated.points[2][1];
      const clearance = position[1] - height;
      const candidate = {
        surfaceId: triangle.surfaceId,
        triangleId: triangle.id,
        point: [position[0], height, position[2]],
        gravityUp: [0, 1, 0],
        surfaceNormal: [...triangle.normal],
        tangent: [...triangle.tangent],
        clearance,
        distanceToSurface: Math.abs(clearance),
      };
      if (!best || candidate.distanceToSurface < best.distanceToSurface) best = candidate;
    }
  }
  return best;
}

export function queryPlanarSupport(world, position, options = {}) {
  if (!world || !isFiniteVector(position)
      || !Number.isFinite(world.width) || world.width <= 0
      || !Number.isFinite(world.depth) || world.depth <= 0) return null;
  const settings = options && typeof options === 'object' ? options : {};
  const maxDrop = Number.isFinite(settings.maxDrop) ? Math.max(0, settings.maxDrop) : 2;
  const maxRise = Number.isFinite(settings.maxRise) ? Math.max(0, settings.maxRise) : 2;
  let best = null;

  for (const surface of world.surfaces ?? []) {
    for (const triangle of surface.triangles ?? []) {
      const candidate = pointTriangleSupport(world, position, triangle);
      if (!candidate || !supportWithinClearance(candidate.clearance, maxDrop, maxRise)) continue;
      if (isBetterSupport(candidate, best, settings.previousSurfaceId)) best = candidate;
    }
  }

  const ground = {
    surfaceId: 'ground',
    triangleId: null,
    point: [position[0], 0, position[2]],
    gravityUp: [0, 1, 0],
    surfaceNormal: [0, 1, 0],
    tangent: [0, 0, 1],
    clearance: position[1],
    distanceToSurface: Math.abs(position[1]),
    isFallback: true,
  };
  if (supportWithinClearance(ground.clearance, maxDrop, maxRise)
      && isBetterSupport(ground, best, settings.previousSurfaceId)) best = ground;
  if (!best) return null;
  const { distanceToSurface, isFallback, ...support } = best;
  return support;
}

function translatedBox(box, offset) {
  return { ...box, center: add(box.center, offset) };
}

function imageRangeForSweep(minimum, maximum, boundsMinimum, boundsMaximum, radius, span) {
  return {
    first: Math.ceil((minimum - radius - boundsMaximum) / span - 1e-12),
    last: Math.floor((maximum + radius - boundsMinimum) / span + 1e-12),
  };
}

export function sweepPlanarSkater(world, from, to, radius = 0.25) {
  if (!world || !isFiniteVector(from) || !isFiniteVector(to)
      || !Number.isFinite(world.width) || world.width <= 0
      || !Number.isFinite(world.depth) || world.depth <= 0) {
    return { position: isFiniteVector(from) ? [...from] : [0, 0, 0], blocked: false, hitId: null };
  }
  const bodyRadius = Number.isFinite(radius) ? Math.max(0, radius) : 0;
  const movement = [
    wrapDelta(from[0], to[0], world.width),
    to[1] - from[1],
    wrapDelta(from[2], to[2], world.depth),
  ];
  const localTo = add(from, movement);
  const minimum = [0, 1, 2].map((axis) => Math.min(from[axis], localTo[axis]));
  const maximum = [0, 1, 2].map((axis) => Math.max(from[axis], localTo[axis]));
  let bestHit = null;

  for (const collider of world.colliders ?? [...(world.buildings ?? []), ...(world.props ?? [])]) {
    const box = collider.collision;
    const bounds = collider.bounds;
    if (box?.type !== 'box' || !bounds?.min || !bounds?.max) continue;
    if (bounds.max[1] + bodyRadius < minimum[1] || bounds.min[1] - bodyRadius > maximum[1]) continue;
    const xImages = imageRangeForSweep(minimum[0], maximum[0], bounds.min[0], bounds.max[0], bodyRadius, world.width);
    const zImages = imageRangeForSweep(minimum[2], maximum[2], bounds.min[2], bounds.max[2], bodyRadius, world.depth);
    for (let imageX = xImages.first; imageX <= xImages.last; imageX += 1) {
      for (let imageZ = zImages.first; imageZ <= zImages.last; imageZ += 1) {
        const shifted = translatedBox(box, [imageX * world.width, 0, imageZ * world.depth]);
        const hit = sweepBox(shifted, from, localTo, bodyRadius);
        if (!hit || (bestHit && hit.progress > bestHit.progress + 1e-9)) continue;
        if (bestHit && Math.abs(hit.progress - bestHit.progress) <= 1e-9
            && compareIds(collider.id, bestHit.hitId) >= 0) continue;
        bestHit = { ...hit, hitId: collider.id };
      }
    }
  }

  if (!bestHit) return { position: localTo, blocked: false, hitId: null };
  return {
    position: add(from, scale(movement, bestHit.safeProgress)),
    blocked: true,
    hitId: bestHit.hitId,
  };
}
