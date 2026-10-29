import { cross3, dot3, normalize3 } from '../core/planet-math.js';
import { WORLD_DESCRIPTOR } from '../shared/world-config.js';
import { compileSkatePath } from './skate-paths.js';

const UP = [0, 1, 0];

function subtract(a, b) {
  return a.map((value, axis) => value - b[axis]);
}

function add(a, b) {
  return a.map((value, axis) => value + b[axis]);
}

function scale(vector, amount) {
  return vector.map((value) => value * amount);
}

function isFiniteVector(value) {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
}

function boundsFor(points) {
  if (!Array.isArray(points) || points.length === 0) {
    return { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  }
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const point of points) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], point[axis]);
      max[axis] = Math.max(max[axis], point[axis]);
    }
  }
  return { min, max };
}

function projectTangent(tangent, normal) {
  return normalize3(subtract(tangent, scale(normal, dot3(tangent, normal))));
}

function makeTriangle(surfaceId, triangleIndex, indices, vertices, tangent) {
  let [aIndex, bIndex, cIndex] = indices;
  let a = vertices[aIndex];
  let b = vertices[bIndex];
  let c = vertices[cIndex];
  let normal = normalize3(cross3(subtract(b, a), subtract(c, a)));

  if (normal[1] < 0) {
    [bIndex, cIndex] = [cIndex, bIndex];
    [b, c] = [c, b];
    normal = scale(normal, -1);
  }

  const surfaceTangent = projectTangent(tangent, normal);
  return {
    id: `${surfaceId}:triangle-${triangleIndex}`,
    surfaceId,
    indices: [aIndex, bIndex, cIndex],
    points: [a, b, c],
    normal,
    tangent: surfaceTangent.every((value) => Math.abs(value) < 1e-12)
      ? normalize3(subtract(b, a))
      : surfaceTangent,
    bounds: boundsFor([a, b, c]),
  };
}

function makeMeshSurface(record, vertices, indices, centerline = null, widths = null) {
  const triangles = [];
  const compiledIndices = [];
  for (let index = 0; index < indices.length; index += 3) {
    const triangleIndices = indices.slice(index, index + 3);
    if (triangleIndices.length !== 3 || triangleIndices.some((vertexIndex) => (
      !Number.isInteger(vertexIndex) || vertexIndex < 0 || vertexIndex >= vertices.length
    ))) throw new RangeError(`Surface ${record.id} has invalid triangle indices.`);
    const [a, b] = triangleIndices.map((vertexIndex) => vertices[vertexIndex]);
    const tangent = centerline && centerline.length > 1
      ? subtract(centerline[Math.min(centerline.length - 1, Math.floor(index / 6) + 1)],
        centerline[Math.floor(index / 6)])
      : subtract(b, a);
    const triangle = makeTriangle(record.id, triangles.length, triangleIndices, vertices, tangent);
    triangles.push(triangle);
    compiledIndices.push(...triangle.indices);
  }
  return {
    id: record.id,
    type: record.type ?? 'street',
    routeEdgeId: record.routeEdgeId ?? null,
    ...(Number.isFinite(record.width) ? { width: record.width } : {}),
    vertices,
    indices: compiledIndices,
    triangles,
    bounds: boundsFor(vertices),
    ...(centerline ? { centerline, widths } : {}),
  };
}

function compileRouteSurface(record) {
  if (!Array.isArray(record.sections) || record.sections.length < 2
      || !record.sections.every((section) => [section.center, section.left, section.right].every(isFiniteVector))) {
    throw new TypeError(`Route surface ${record.id} needs at least two finite cross-sections.`);
  }
  const vertices = [];
  const centerline = [];
  const widths = [];
  for (const section of record.sections) {
    centerline.push([...section.center]);
    vertices.push([...section.left], [...section.right]);
    widths.push({
      left: Math.hypot(...subtract(section.left, section.center)),
      right: Math.hypot(...subtract(section.right, section.center)),
    });
  }

  const indices = [];
  for (let sectionIndex = 0; sectionIndex < record.sections.length - 1; sectionIndex += 1) {
    const leftBefore = sectionIndex * 2;
    const rightBefore = leftBefore + 1;
    const leftAfter = leftBefore + 2;
    const rightAfter = leftBefore + 3;
    indices.push(leftBefore, leftAfter, rightBefore, leftAfter, rightAfter, rightBefore);
  }
  return makeMeshSurface(record, vertices, indices, centerline, widths);
}

function compilePatchSurface(record) {
  if (!Array.isArray(record.vertices) || !Array.isArray(record.indices)
      || record.indices.length < 3 || record.indices.length % 3 !== 0
      || !record.vertices.every(isFiniteVector)) {
    throw new TypeError(`Patch surface ${record.id} needs finite vertices and explicit triangles.`);
  }
  return makeMeshSurface(record, record.vertices.map((point) => [...point]), [...record.indices]);
}

function compileSurface(record) {
  if (!record?.id) throw new TypeError('Every planar surface needs a stable ID.');
  if (Array.isArray(record.sections)) return compileRouteSurface(record);
  return compilePatchSurface(record);
}

function compileBox(record) {
  const placement = record?.placement;
  if (!record?.id || !placement || !isFiniteVector(placement.position)
      || !Array.isArray(placement.axes) || placement.axes.length !== 3
      || !placement.axes.every(isFiniteVector) || !isFiniteVector(placement.size)
      || placement.size.some((value) => value <= 0)) {
    throw new TypeError(`Planar collider ${record?.id ?? 'unknown'} needs a valid asset placement.`);
  }
  const axes = placement.axes.map((axis) => [...axis]);
  const size = [...placement.size];
  const position = [...placement.position];
  const halfExtents = size.map((value) => value / 2);
  const center = add(position, scale(axes[1], halfExtents[1]));
  const corners = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    corners.push([0, 1, 2].map((axis) => center[axis]
      + x * axes[0][axis] * halfExtents[0]
      + y * axes[1][axis] * halfExtents[1]
      + z * axes[2][axis] * halfExtents[2]));
  }
  return {
    ...record,
    position,
    size,
    placement: { ...placement, position, size, axes },
    collision: { type: 'box', center, axes, halfExtents },
    bounds: boundsFor(corners),
  };
}

function pointInTriangleXZ(point, triangle) {
  const [a, b, c] = triangle.points;
  const ab = [b[0] - a[0], b[2] - a[2]];
  const ac = [c[0] - a[0], c[2] - a[2]];
  const ap = [point[0] - a[0], point[2] - a[2]];
  const denominator = ab[0] * ac[1] - ab[1] * ac[0];
  if (Math.abs(denominator) < 1e-12) return false;
  const v = (ap[0] * ac[1] - ap[1] * ac[0]) / denominator;
  const w = (ab[0] * ap[1] - ab[1] * ap[0]) / denominator;
  const u = 1 - v - w;
  return u >= -1e-8 && v >= -1e-8 && w >= -1e-8;
}

function routeJoins(routeGraph, surfaces) {
  const nodes = routeGraph?.nodes ?? [];
  const edges = routeGraph?.edges ?? [];
  return nodes.flatMap((node) => {
    const routeSurfaceIds = edges
      .filter((edge) => edge.from === node.id || edge.to === node.id)
      .map((edge) => edge.surfaceId);
    const patchSurfaceIds = surfaces
      .filter((surface) => ['junction', 'plaza'].includes(surface.type)
        && surface.triangles.some((triangle) => pointInTriangleXZ(node.position, triangle)))
      .map((surface) => surface.id);
    const surfaceIds = [...new Set([...routeSurfaceIds, ...patchSurfaceIds])];
    if (surfaceIds.length < 2) return [];
    return [{ id: `join-${node.id}`, nodeId: node.id, position: [...node.position], surfaceIds }];
  });
}

function makeRailDeck(rail) {
  const points = rail.points.map((point) => [...point]);
  const width = rail.width;
  const vertices = [];
  for (let index = 0; index < points.length; index += 1) {
    const before = points[Math.max(0, index - 1)];
    const after = points[Math.min(points.length - 1, index + 1)];
    const tangent = normalize3(subtract(after, before));
    const side = normalize3(cross3(tangent, UP));
    vertices.push(
      points[index].map((value, axis) => value + side[axis] * width / 2),
      points[index].map((value, axis) => value - side[axis] * width / 2),
    );
  }
  const indices = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const leftBefore = index * 2;
    const rightBefore = leftBefore + 1;
    const leftAfter = leftBefore + 2;
    const rightAfter = leftBefore + 3;
    indices.push(leftBefore, leftAfter, rightBefore, leftAfter, rightAfter, rightBefore);
  }
  const record = {
    id: `${rail.id}:deck`,
    type: rail.type === 'ledge' ? 'ledge-deck' : 'rail-deck',
    routeEdgeId: rail.routeEdgeId ?? null,
    width,
  };
  return makeMeshSurface(record, vertices, indices, points,
    points.map(() => ({ left: width / 2, right: width / 2 })));
}

function compileRail(record) {
  if (!Number.isFinite(record?.width) || record.width <= 0
      || (record.top !== undefined && !Number.isFinite(record.top))
      || !Array.isArray(record.points)) {
    throw new TypeError(`Skate path ${record?.id ?? 'unknown'} needs a positive width and finite path.`);
  }
  const type = record.type ?? 'rail';
  if (!['rail', 'pipe', 'ledge'].includes(type)) {
    throw new TypeError(`Skate path ${record?.id ?? 'unknown'} has an unsupported type.`);
  }
  const radius = record.radius ?? (type === 'pipe' ? 0.09 : 0.12);
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new RangeError(`Skate path ${record.id} needs a positive radius.`);
  }
  const path = compileSkatePath(record);
  const supportSurfaceId = `${record.id}:deck`;
  return {
    ...path,
    type,
    radius,
    ...(Array.isArray(record.connectedSupportIds)
      ? { connectedSupportIds: [...record.connectedSupportIds] }
      : {}),
    supportDeck: record.supportDeck !== false,
    start: [...path.points[0]],
    end: [...path.points.at(-1)],
    supportSurfaceId,
  };
}

function compileLaunchMarker(record) {
  if (!record?.id || !record.supportId || !isFiniteVector(record.point)
      || !isFiniteVector(record.normal) || !isFiniteVector(record.tangent)
      || !Number.isFinite(record.halfWidth) || record.halfWidth <= 0
      || !Number.isFinite(record.halfHeight) || record.halfHeight <= 0
      || ![-1, 1].includes(record.direction)) {
    throw new TypeError(`Launch marker ${record?.id ?? 'unknown'} is malformed.`);
  }
  const normal = normalize3(record.normal);
  const tangent = normalize3(record.tangent);
  if (normal.every((value) => Math.abs(value) < 1e-12)
      || tangent.every((value) => Math.abs(value) < 1e-12)) {
    throw new RangeError(`Launch marker ${record.id} needs nonzero normal and tangent vectors.`);
  }
  return { ...record, point: [...record.point], normal, tangent };
}

function compileTagTarget(record) {
  if (!record?.id || !Array.isArray(record.triangles) || record.triangles.length === 0
      || !Array.isArray(record.polygon) || record.polygon.length < 3
      || !record.polygon.every((point) => Array.isArray(point) && point.length === 2
        && point.every(Number.isFinite))
      || !record.frame || !['origin', 'right', 'up', 'normal']
        .every((key) => isFiniteVector(record.frame[key]))) {
    throw new TypeError(`Tag target ${record?.id ?? 'unknown'} is malformed.`);
  }
  const frame = Object.fromEntries(['origin', 'right', 'up', 'normal'].map((key) => (
    [key, [...record.frame[key]]]
  )));
  frame.right = normalize3(frame.right);
  frame.up = normalize3(frame.up);
  frame.normal = normalize3(frame.normal);
  if ([frame.right, frame.up, frame.normal].some((axis) => (
    axis.every((value) => Math.abs(value) < 1e-12)
  ))) throw new RangeError(`Tag target ${record.id} has a zero frame axis.`);

  const triangleIds = new Set();
  const triangles = record.triangles.map((triangle, index) => {
    if (!triangle?.id || triangleIds.has(triangle.id) || !Array.isArray(triangle.points)
        || triangle.points.length !== 3 || !triangle.points.every(isFiniteVector)) {
      throw new TypeError(`Tag target ${record.id} has a malformed triangle.`);
    }
    triangleIds.add(triangle.id);
    const points = triangle.points.map((point) => [...point]);
    let normal = normalize3(cross3(subtract(points[1], points[0]), subtract(points[2], points[0])));
    if (normal.every((value) => Math.abs(value) < 1e-12)) {
      throw new RangeError(`Tag target ${record.id} has a degenerate triangle.`);
    }
    if (dot3(normal, frame.normal) < 0) normal = scale(normal, -1);
    return {
      id: triangle.id ?? `${record.id}:triangle-${index}`,
      points,
      normal,
      bounds: boundsFor(points),
    };
  });
  return { ...record, frame, polygon: record.polygon.map((point) => [...point]), triangles };
}

export function compilePlanarWorld(layout) {
  if (!layout || !Number.isFinite(layout.width) || layout.width <= 0
      || !Number.isFinite(layout.depth) || layout.depth <= 0) {
    throw new TypeError('A planar city layout with positive finite width and depth is required.');
  }
  const surfaces = (layout.surfaces ?? []).map(compileSurface);
  const buildings = (layout.buildings ?? []).map(compileBox);
  const props = (layout.props ?? []).map(compileBox);
  const rails = [...(layout.rails ?? []), ...(layout.skatePaths ?? [])].map(compileRail);
  for (const rail of rails) {
    if (rail.supportDeck) surfaces.push(makeRailDeck(rail));
  }
  const descriptor = Object.freeze({
    version: WORLD_DESCRIPTOR.version,
    seed: WORLD_DESCRIPTOR.seed,
    tuningVersion: WORLD_DESCRIPTOR.tuningVersion,
    geometry: layout.assetPlacements?.length ? 'planar-kenney-v1' : 'planar-blockout-v1',
    topology: 'torus',
    width: layout.width,
    depth: layout.depth,
    gravityUp: Object.freeze([...UP]),
  });
  return {
    descriptor,
    width: layout.width,
    depth: layout.depth,
    surfaces,
    joins: routeJoins(layout.routeGraph, surfaces),
    buildings,
    props,
    rails,
    colliders: [...buildings, ...props],
    spawnPoints: (layout.spawnPoints ?? []).map((spawn) => ({ ...spawn,
      position: [...spawn.position], forward: [...spawn.forward] })),
    defaultSpawnId: layout.defaultSpawnId ?? null,
    launchMarkers: (layout.launchMarkers ?? []).map(compileLaunchMarker),
    tagTargets: (layout.tagTargets ?? []).map(compileTagTarget),
    routeGraph: layout.routeGraph ?? { nodes: [], edges: [] },
  };
}
