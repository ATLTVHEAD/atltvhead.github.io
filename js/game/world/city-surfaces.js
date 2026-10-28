import {
  cross3,
  dot3,
  makeSurfaceFrame,
  normalize3,
  projectToTangent,
} from '../core/planet-math.js';
import { WORLD_DESCRIPTOR } from '../shared/world-config.js';

const MAX_WIDTH_SEGMENT = 0.8;
const ROAD_LIFT = 0.025;

function add(a, b) {
  return a.map((value, axis) => value + b[axis]);
}

function subtract(a, b) {
  return a.map((value, axis) => value - b[axis]);
}

function scale(vector, amount) {
  return vector.map((value) => value * amount);
}

function boundsFor(points) {
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

function sampleTangent(centerline, index, normal) {
  const before = centerline[Math.max(0, index - 1)];
  const after = centerline[Math.min(centerline.length - 1, index + 1)];
  return normalize3(projectToTangent(subtract(after, before), normal));
}

function makeTriangle(surfaceId, index, vertexIndices, vertices, tangent) {
  let [aIndex, bIndex, cIndex] = vertexIndices;
  let a = vertices[aIndex];
  let b = vertices[bIndex];
  let c = vertices[cIndex];
  let normal = normalize3(cross3(subtract(b, a), subtract(c, a)));
  const radial = normalize3(add(add(a, b), c));

  if (dot3(normal, radial) < 0) {
    [bIndex, cIndex] = [cIndex, bIndex];
    [b, c] = [c, b];
    normal = normal.map((value) => -value);
  }

  return {
    id: `${surfaceId}:triangle-${index}`,
    surfaceId,
    indices: [aIndex, bIndex, cIndex],
    points: [a, b, c],
    normal,
    tangent: normalize3(projectToTangent(tangent, normal)),
    bounds: boundsFor([a, b, c]),
  };
}

function compileSurface(surface) {
  const centerline = (surface.centerline ?? []).map((point) => [...point]);
  if (centerline.length < 2 || !Number.isFinite(surface.width) || surface.width <= 0) return null;

  let widthSegments = Math.max(2, Math.ceil(surface.width / MAX_WIDTH_SEGMENT));
  if (widthSegments % 2 !== 0) widthSegments += 1;
  const rowWidth = widthSegments + 1;
  const vertices = [];
  const indices = [];
  const tangents = [];

  for (let row = 0; row < centerline.length; row += 1) {
    const center = centerline[row];
    const radial = normalize3(center);
    const tangent = sampleTangent(centerline, row, radial);
    const right = makeSurfaceFrame(radial, tangent).right;
    const centerRadius = Math.hypot(...center) + ROAD_LIFT;
    tangents.push(tangent);

    for (let column = 0; column <= widthSegments; column += 1) {
      const lateralOffset = -surface.width / 2 + (surface.width * column) / widthSegments;
      const angle = lateralOffset / centerRadius;
      const vertex = radial.map((value, axis) => (
        centerRadius * (value * Math.cos(angle) + right[axis] * Math.sin(angle))
      ));
      vertices.push(vertex);
    }
  }

  const triangles = [];
  for (let row = 0; row < centerline.length - 1; row += 1) {
    for (let column = 0; column < widthSegments; column += 1) {
      const a = row * rowWidth + column;
      const b = a + 1;
      const c = a + rowWidth;
      const d = c + 1;
      const tangent = normalize3(add(tangents[row], tangents[row + 1]));
      const first = makeTriangle(surface.id, triangles.length, [a, b, c], vertices, tangent);
      triangles.push(first);
      indices.push(...first.indices);
      const second = makeTriangle(surface.id, triangles.length, [b, d, c], vertices, tangent);
      triangles.push(second);
      indices.push(...second.indices);
    }
  }

  const spawnRow = Math.floor((centerline.length - 1) / 2);
  const spawnVertexIndex = spawnRow * rowWidth + Math.floor(widthSegments / 2);
  const spawnPosition = vertices[spawnVertexIndex];
  const bounds = boundsFor(vertices);
  return {
    id: surface.id,
    routeEdgeId: surface.routeEdgeId ?? null,
    type: surface.type ?? 'street',
    routeKind: surface.routeKind ?? surface.type ?? 'street',
    width: surface.width,
    widthSegments,
    centerline,
    vertices,
    indices,
    triangles,
    bounds,
    spawnPosition: [...spawnPosition],
    spawnForward: [...tangents[spawnRow]],
  };
}

function compileBuilding(building) {
  const [width, height, depth] = building.size ?? [1, 1, 1];
  const normal = normalize3(building.normal ?? building.position);
  const base = [...building.position];
  const top = add(base, scale(normal, height));
  const footprintRadius = Math.hypot(width / 2, depth / 2);
  const capsuleBounds = boundsFor([base, top]);
  for (let axis = 0; axis < 3; axis += 1) {
    capsuleBounds.min[axis] -= footprintRadius;
    capsuleBounds.max[axis] += footprintRadius;
  }
  return {
    id: building.id,
    position: [...building.position],
    normal,
    size: [width, height, depth],
    collision: {
      type: 'capsule',
      start: base,
      end: top,
      radius: footprintRadius,
    },
    bounds: capsuleBounds,
  };
}

function compileRail(rail) {
  const points = (rail.points ?? []).map((point) => [...point]);
  const segmentLengths = [];
  let totalLength = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const length = Math.hypot(...subtract(points[index + 1], points[index]));
    segmentLengths.push(length);
    totalLength += length;
  }
  return {
    ...rail,
    points,
    start: points[0] ?? null,
    end: points.at(-1) ?? null,
    segmentLengths,
    totalLength,
    bounds: boundsFor(points),
  };
}

function sampleCrossSection(surface, row, progress) {
  const columnPosition = progress * surface.widthSegments;
  const lower = Math.floor(columnPosition);
  const upper = Math.min(surface.widthSegments, lower + 1);
  const blend = columnPosition - lower;
  const rowOffset = row * (surface.widthSegments + 1);
  return surface.vertices[rowOffset + lower].map((value, axis) => (
    value * (1 - blend) + surface.vertices[rowOffset + upper][axis] * blend
  ));
}

function connectRouteJoins(layout, surfaces) {
  const byEdge = new Map(surfaces.map((surface) => [surface.routeEdgeId, surface]));
  const edges = layout.routeGraph?.edges ?? [];
  const nodes = layout.routeGraph?.nodes ?? [];
  const joins = [];

  for (const node of nodes) {
    const incoming = edges
      .filter((edge) => edge.to === node.id)
      .map((edge) => byEdge.get(edge.id))
      .filter(Boolean);
    const outgoing = edges
      .filter((edge) => edge.from === node.id)
      .map((edge) => byEdge.get(edge.id))
      .filter(Boolean);

    for (const inSurface of incoming) {
      for (const outSurface of outgoing) {
        if (inSurface === outSurface) continue;
        const segments = Math.max(inSurface.widthSegments, outSurface.widthSegments);
        const inRow = inSurface.centerline.length - 1;
        const outRow = 0;
        const sections = [];
        for (let column = 0; column <= segments; column += 1) {
          const progress = column / segments;
          const incomingPoint = sampleCrossSection(inSurface, inRow, progress);
          const outgoingPoint = sampleCrossSection(outSurface, outRow, progress);
          const inIndex = inSurface.vertices.length;
          inSurface.vertices.push(incomingPoint);
          const outIndex = inSurface.vertices.length;
          inSurface.vertices.push(outgoingPoint);
          sections.push([inIndex, outIndex]);
        }

        const tangent = normalize3(add(inSurface.spawnForward, outSurface.spawnForward));
        for (let column = 0; column < segments; column += 1) {
          const [inA, outA] = sections[column];
          const [inB, outB] = sections[column + 1];
          const first = makeTriangle(
            inSurface.id,
            inSurface.triangles.length,
            [inA, outA, inB],
            inSurface.vertices,
            tangent,
          );
          inSurface.triangles.push(first);
          inSurface.indices.push(...first.indices);
          const second = makeTriangle(
            inSurface.id,
            inSurface.triangles.length,
            [inB, outA, outB],
            inSurface.vertices,
            tangent,
          );
          inSurface.triangles.push(second);
          inSurface.indices.push(...second.indices);
        }
        inSurface.bounds = boundsFor(inSurface.vertices);
        joins.push({ nodeId: node.id, fromSurfaceId: inSurface.id, toSurfaceId: outSurface.id });
      }
    }
  }
  return joins;
}

export function compileCityWorld(layout) {
  if (!layout || !Number.isFinite(layout.planetRadius ?? layout.radius)) {
    throw new TypeError('A city layout with a finite planet radius is required.');
  }
  const radius = layout.planetRadius ?? layout.radius;
  const surfaces = (layout.surfaces ?? []).map(compileSurface).filter(Boolean);
  const joins = connectRouteJoins(layout, surfaces);
  const buildings = (layout.buildings ?? []).map(compileBuilding);
  const rails = (layout.rails ?? []).map(compileRail).filter((rail) => rail.points.length >= 2);
  const spawnPoints = surfaces.map((surface, index) => ({
    id: `spawn-${index}`,
    surfaceId: surface.id,
    position: [...surface.spawnPosition],
    forward: [...surface.spawnForward],
  }));
  let defaultSpawnId = spawnPoints[0]?.id ?? null;
  let greatestPreviewDepth = -Infinity;
  for (const spawn of spawnPoints) {
    const surface = surfaces.find((entry) => entry.id === spawn.surfaceId);
    const midpoint = Math.floor((surface?.centerline.length ?? 0) / 2);
    const depth = surface?.type === 'street' ? surface.centerline[midpoint]?.[2] : -Infinity;
    if (Number.isFinite(depth) && depth > greatestPreviewDepth) {
      greatestPreviewDepth = depth;
      defaultSpawnId = spawn.id;
    }
  }

  return {
    descriptor: Object.freeze({
      ...WORLD_DESCRIPTOR,
      radius,
      seed: Number.isFinite(layout.seed) ? layout.seed : WORLD_DESCRIPTOR.seed,
    }),
    radius,
    seed: Number.isFinite(layout.seed) ? layout.seed : WORLD_DESCRIPTOR.seed,
    surfaces,
    joins,
    buildings,
    rails,
    spawnPoints,
    defaultSpawnId,
  };
}
