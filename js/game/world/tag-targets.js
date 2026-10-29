import { cross3, dot3, normalize3 } from '../core/planet-math.js';
import { sweepPlanarSkater } from './planar-city-queries.js';

const EPSILON = 1e-9;
const OCCLUSION_SEARCH_SUBDIVISIONS = 16;
const VISIBILITY_REFINEMENT_ITERATIONS = 24;

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

function compareIds(first, second) {
  const a = String(first ?? '');
  const b = String(second ?? '');
  return a < b ? -1 : a > b ? 1 : 0;
}

function triangleNormal(target, triangle) {
  if (!Array.isArray(triangle?.points) || triangle.points.length !== 3
      || !triangle.points.every(finiteVector)) return null;
  let normal = normalize3(cross3(
    subtract(triangle.points[1], triangle.points[0]),
    subtract(triangle.points[2], triangle.points[0]),
  ));
  if (normal.every((value) => Math.abs(value) < 1e-12)) return null;
  const frameNormal = target?.frame?.normal;
  if (finiteVector(frameNormal) && dot3(normal, frameNormal) < 0) normal = scale(normal, -1);
  return normal;
}

function findTarget(world, targetId) {
  return (world?.tagTargets ?? []).find((target) => target.id === targetId) ?? null;
}

export function resolveTagAnchor(world, anchor) {
  if (!anchor || typeof anchor.targetId !== 'string' || typeof anchor.triangleId !== 'string'
      || !Array.isArray(anchor.barycentric) || anchor.barycentric.length !== 3
      || !anchor.barycentric.every((weight) => Number.isFinite(weight) && weight >= 0)
      || Math.abs(anchor.barycentric.reduce((sum, weight) => sum + weight, 0) - 1) > 1e-6) {
    return null;
  }
  const target = findTarget(world, anchor.targetId);
  const triangle = target?.triangles?.find((entry) => entry.id === anchor.triangleId);
  const normal = triangleNormal(target, triangle);
  if (!normal) return null;
  const point = [0, 1, 2].map((axis) => anchor.barycentric.reduce((sum, weight, index) => (
    sum + triangle.points[index][axis] * weight
  ), 0));
  return { point, normal };
}

function closestPointOnTriangle(point, [a, b, c]) {
  const ab = subtract(b, a);
  const ac = subtract(c, a);
  const ap = subtract(point, a);
  const d1 = dot3(ab, ap);
  const d2 = dot3(ac, ap);
  if (d1 <= 0 && d2 <= 0) return { point: [...a], barycentric: [1, 0, 0] };

  const bp = subtract(point, b);
  const d3 = dot3(ab, bp);
  const d4 = dot3(ac, bp);
  if (d3 >= 0 && d4 <= d3) return { point: [...b], barycentric: [0, 1, 0] };

  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    return { point: add(a, scale(ab, v)), barycentric: [1 - v, v, 0] };
  }

  const cp = subtract(point, c);
  const d5 = dot3(ab, cp);
  const d6 = dot3(ac, cp);
  if (d6 >= 0 && d5 <= d6) return { point: [...c], barycentric: [0, 0, 1] };

  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    return { point: add(a, scale(ac, w)), barycentric: [1 - w, 0, w] };
  }

  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const edge = subtract(c, b);
    const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
    return { point: add(b, scale(edge, w)), barycentric: [0, 1 - w, w] };
  }

  const denominator = 1 / (va + vb + vc);
  const v = vb * denominator;
  const w = vc * denominator;
  return { point: add(a, add(scale(ab, v), scale(ac, w))), barycentric: [1 - v - w, v, w] };
}

function triangleBounds(triangle) {
  if (triangle.bounds?.min && triangle.bounds?.max) return triangle.bounds;
  const points = triangle.points;
  return {
    min: [0, 1, 2].map((axis) => Math.min(...points.map((point) => point[axis]))),
    max: [0, 1, 2].map((axis) => Math.max(...points.map((point) => point[axis]))),
  };
}

function rayIntersectsTriangle(from, to, points) {
  const direction = subtract(to, from);
  const edge1 = subtract(points[1], points[0]);
  const edge2 = subtract(points[2], points[0]);
  const p = cross3(direction, edge2);
  const determinant = dot3(edge1, p);
  if (Math.abs(determinant) < 1e-10) return false;
  const inverse = 1 / determinant;
  const offset = subtract(from, points[0]);
  const u = dot3(offset, p) * inverse;
  if (u < -EPSILON || u > 1 + EPSILON) return false;
  const q = cross3(offset, edge1);
  const v = dot3(direction, q) * inverse;
  if (v < -EPSILON || u + v > 1 + EPSILON) return false;
  const distance = dot3(edge2, q) * inverse;
  return distance > 1e-5 && distance < 1 - 1e-5;
}

function imageRange(minimum, maximum, boundsMinimum, boundsMaximum, span) {
  return {
    first: Math.ceil((minimum - boundsMaximum) / span - 1e-12),
    last: Math.floor((maximum - boundsMinimum) / span + 1e-12),
  };
}

function trianglesOcclude(world, from, to) {
  if (!Number.isFinite(world?.width) || world.width <= 0
      || !Number.isFinite(world?.depth) || world.depth <= 0) return false;
  const minimum = [0, 1, 2].map((axis) => Math.min(from[axis], to[axis]));
  const maximum = [0, 1, 2].map((axis) => Math.max(from[axis], to[axis]));
  const triangles = [
    ...(world.surfaces ?? []).flatMap((surface) => surface.triangles ?? []),
    ...(world.tagTargets ?? []).flatMap((target) => target.triangles ?? []),
  ];
  for (const triangle of triangles) {
    if (!Array.isArray(triangle.points) || triangle.points.length !== 3
        || !triangle.points.every(finiteVector)) continue;
    const bounds = triangleBounds(triangle);
    const xImages = imageRange(minimum[0], maximum[0], bounds.min[0], bounds.max[0], world.width);
    const zImages = imageRange(minimum[2], maximum[2], bounds.min[2], bounds.max[2], world.depth);
    for (let ix = xImages.first; ix <= xImages.last; ix += 1) {
      for (let iz = zImages.first; iz <= zImages.last; iz += 1) {
        const offset = [ix * world.width, 0, iz * world.depth];
        const points = triangle.points.map((point) => add(point, offset));
        if (rayIntersectsTriangle(from, to, points)) return true;
      }
    }
  }
  return false;
}

function isVisible(world, from, point, normal) {
  const end = add(point, scale(normal, 0.01));
  if (sweepPlanarSkater(world, from, end, 0).blocked) return false;
  return !trianglesOcclude(world, from, end);
}

function nearestImageTriangle(world, triangle, position) {
  const center = [0, 1, 2].map((axis) => (
    triangle.points.reduce((sum, point) => sum + point[axis], 0) / 3
  ));
  const imageX = Math.round((position[0] - center[0]) / world.width);
  const imageZ = Math.round((position[2] - center[2]) / world.depth);
  const offset = [imageX * world.width, 0, imageZ * world.depth];
  return {
    offset,
    points: triangle.points.map((point) => add(point, offset)),
  };
}

function pointFromBarycentric(points, barycentric) {
  return [0, 1, 2].map((axis) => barycentric.reduce((sum, weight, index) => (
    sum + points[index][axis] * weight
  ), 0));
}

function mixBarycentric(first, second, amount) {
  return first.map((weight, index) => weight + (second[index] - weight) * amount);
}

function nearestVisiblePointOnTriangle(world, position, points, normal, maxReach) {
  const closest = closestPointOnTriangle(position, points);
  const closestDistance = Math.hypot(...subtract(closest.point, position));
  if (closestDistance > maxReach + EPSILON
      || dot3(normal, subtract(position, closest.point)) <= EPSILON) return null;
  if (isVisible(world, position, closest.point, normal)) {
    return { point: closest.point, barycentric: closest.barycentric, distance: closestDistance };
  }

  // The exact nearest point can be shadowed while another part of this same
  // triangle remains visible. Probe a small barycentric lattice only in that
  // case, then refine each visible sample back toward the blocked minimum.
  const samples = [];
  for (let first = 0; first <= OCCLUSION_SEARCH_SUBDIVISIONS; first += 1) {
    for (let second = 0; second <= OCCLUSION_SEARCH_SUBDIVISIONS - first; second += 1) {
      const barycentric = [
        first / OCCLUSION_SEARCH_SUBDIVISIONS,
        second / OCCLUSION_SEARCH_SUBDIVISIONS,
        1 - (first + second) / OCCLUSION_SEARCH_SUBDIVISIONS,
      ];
      const point = pointFromBarycentric(points, barycentric);
      const distance = Math.hypot(...subtract(point, position));
      if (distance <= maxReach + EPSILON) samples.push({ point, barycentric, distance });
    }
  }
  samples.sort((first, second) => first.distance - second.distance);

  let best = null;
  for (const sample of samples) {
    if (!isVisible(world, position, sample.point, normal)) continue;

    let hidden = closest.barycentric;
    let visible = sample.barycentric;
    for (let iteration = 0; iteration < VISIBILITY_REFINEMENT_ITERATIONS; iteration += 1) {
      const midpoint = mixBarycentric(hidden, visible, 0.5);
      const midpointPoint = pointFromBarycentric(points, midpoint);
      if (isVisible(world, position, midpointPoint, normal)) visible = midpoint;
      else hidden = midpoint;
    }
    const point = pointFromBarycentric(points, visible);
    const distance = Math.hypot(...subtract(point, position));
    if (!best || distance < best.distance - EPSILON) {
      best = { point, barycentric: visible, distance };
    }
  }
  return best;
}

export function findTagTarget(world, skater, { maxReach = 2 } = {}) {
  if (!world || !finiteVector(skater?.position)
      || !Number.isFinite(world.width) || world.width <= 0
      || !Number.isFinite(world.depth) || world.depth <= 0) return null;
  const reach = Number.isFinite(maxReach) ? Math.max(0, maxReach) : 2;
  let best = null;

  for (const target of world.tagTargets ?? []) {
    for (const triangle of target.triangles ?? []) {
      const normal = triangleNormal(target, triangle);
      if (!normal) continue;
      const image = nearestImageTriangle(world, triangle, skater.position);
      const closestVisible = nearestVisiblePointOnTriangle(
        world,
        skater.position,
        image.points,
        normal,
        reach,
      );
      if (!closestVisible) continue;

      const candidate = {
        anchor: {
          targetId: target.id,
          triangleId: triangle.id,
          barycentric: closestVisible.barycentric,
        },
        point: closestVisible.point,
        normal,
        distance: closestVisible.distance,
      };
      if (!best || candidate.distance < best.distance - EPSILON
          || (Math.abs(candidate.distance - best.distance) <= EPSILON
            && (compareIds(candidate.anchor.targetId, best.anchor.targetId) < 0
              || (candidate.anchor.targetId === best.anchor.targetId
                && compareIds(candidate.anchor.triangleId, best.anchor.triangleId) < 0)))) {
        best = candidate;
      }
    }
  }
  if (!best) return null;
  const { distance, ...result } = best;
  return result;
}
