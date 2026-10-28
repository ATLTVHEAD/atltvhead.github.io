import {
  advanceAlongSphere,
  dot3,
  makeSurfaceFrame,
  normalize3,
  projectToTangent,
} from '../core/planet-math.js';
import { WORLD_DESCRIPTOR } from '../shared/world-config.js';
import { placeCityAssets } from './asset-placements.js';

const DEFAULT_RADIUS = WORLD_DESCRIPTOR.radius;
const LOOP_NODE_COUNT = 12;
const PATH_SAMPLE_COUNT = 12;
const STREET_WIDTH = 6.4;
const RAMP_WIDTH = 2.8;
const BUILDING_STREET_CLEARANCE = 2.1;

function seedToNumber(seed) {
  if (Number.isFinite(seed)) return seed >>> 0;
  return String(seed ?? 'tvhead-city').split('').reduce(
    (hash, character) => Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0,
    2166136261,
  );
}

function createRandom(seed) {
  let state = seedToNumber(seed);
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function sphericalPoint(longitude, latitude, radius) {
  const cosLatitude = Math.cos(latitude);
  return [
    Math.cos(longitude) * cosLatitude * radius,
    Math.sin(latitude) * radius,
    Math.sin(longitude) * cosLatitude * radius,
  ];
}

function makeArc(start, end, baseRadius, ramp = false) {
  const from = normalize3(start);
  const to = normalize3(end);
  const cosine = Math.max(-1, Math.min(1, dot3(from, to)));
  const angle = Math.acos(cosine);
  const sinAngle = Math.sin(angle);
  const points = [];

  for (let index = 0; index <= PATH_SAMPLE_COUNT; index += 1) {
    const progress = index / PATH_SAMPLE_COUNT;
    let direction;
    if (angle < 1e-8 || Math.abs(sinAngle) < 1e-8) {
      direction = normalize3(from.map((component, axis) => (
        component * (1 - progress) + to[axis] * progress
      )));
    } else {
      const fromWeight = Math.sin((1 - progress) * angle) / sinAngle;
      const toWeight = Math.sin(progress * angle) / sinAngle;
      direction = normalize3(from.map((component, axis) => (
        component * fromWeight + to[axis] * toWeight
      )));
    }

    const rampLift = ramp ? 0.72 * Math.sin(Math.PI * progress) : 0;
    points.push(direction.map((component) => component * (baseRadius + rampLift)));
  }

  return points;
}

function createBuildings(nodes, radius, random, streetWidth) {
  const buildings = [];
  const buildingRadius = radius + 0.26;

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const nextNode = nodes[(index + 1) % nodes.length];
    const heading = nextNode.position.map((component, axis) => component - node.position[axis]);
    const frame = makeSurfaceFrame(node.normal, heading);

    for (const side of [-1, 1]) {
      const basePosition = advanceAlongSphere(
        node.position,
        frame.right,
        side * (streetWidth / 2 + BUILDING_STREET_CLEARANCE + random() * 0.45),
        buildingRadius,
      );
      buildings.push({
        id: `building-${index}-${side < 0 ? 'west' : 'east'}`,
        position: basePosition,
        normal: normalize3(basePosition),
        size: [1.25 + random() * 0.65, 2.2 + random() * 3.4, 1.4 + random() * 0.7],
        color: ['#39425a', '#44516b', '#583e63', '#31515b'][Math.floor(random() * 4)],
      });
    }
  }

  return buildings;
}

function createRail(surface, railId) {
  const startIndex = Math.floor(surface.centerline.length * 0.32);
  const endIndex = Math.floor(surface.centerline.length * 0.68);
  const points = surface.centerline.slice(startIndex, endIndex + 1).map((point) => {
    const radius = Math.hypot(...point) + 0.82;
    return normalize3(point).map((component) => component * radius);
  });

  return {
    id: railId,
    routeEdgeId: surface.routeEdgeId,
    points,
    start: points[0],
    end: points[points.length - 1],
    radius: 0.09,
    captureRadius: 1.15,
  };
}

export function isRouteGraphConnected(graph) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];
  if (nodes.length === 0) return false;

  const knownIds = new Set(nodes.map((node) => node.id));
  const adjacency = new Map(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    if (!knownIds.has(edge.from) || !knownIds.has(edge.to)) continue;
    adjacency.get(edge.from).push(edge.to);
    adjacency.get(edge.to).push(edge.from);
  }

  const visited = new Set();
  const pending = [nodes[0].id];
  while (pending.length > 0) {
    const current = pending.pop();
    if (visited.has(current)) continue;
    visited.add(current);
    pending.push(...adjacency.get(current));
  }

  return visited.size === nodes.length;
}

export function surfaceDistanceToRecord(position, surface) {
  if (!Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite)) return null;
  if (!Array.isArray(surface?.centerline) || surface.centerline.length < 2) return null;

  const segmentLengths = [];
  let totalLength = 0;
  for (let index = 0; index < surface.centerline.length - 1; index += 1) {
    const start = surface.centerline[index];
    const end = surface.centerline[index + 1];
    const length = Math.hypot(
      end[0] - start[0],
      end[1] - start[1],
      end[2] - start[2],
    );
    segmentLengths.push(length);
    totalLength += length;
  }

  let best = null;
  let distanceBeforeSegment = 0;
  for (let index = 0; index < segmentLengths.length; index += 1) {
    const start = surface.centerline[index];
    const end = surface.centerline[index + 1];
    const segmentLength = segmentLengths[index];
    if (segmentLength < 1e-12) continue;

    const segment = end.map((component, axis) => component - start[axis]);
    const offset = position.map((component, axis) => component - start[axis]);
    const t = Math.max(0, Math.min(1, dot3(offset, segment) / (segmentLength * segmentLength)));
    const centerlinePoint = start.map((component, axis) => component + segment[axis] * t);
    const normal = normalize3(centerlinePoint);
    const positionRadius = Math.hypot(...position);
    const surfaceRadius = Math.hypot(...centerlinePoint);
    const positionNormal = normalize3(position);
    const cosine = Math.max(-1, Math.min(1, dot3(positionNormal, normal)));
    const angle = Math.acos(cosine);
    const lateralDistance = angle * surfaceRadius;
    const radialDistance = Math.abs(positionRadius - surfaceRadius);
    const distance = Math.hypot(lateralDistance, radialDistance);
    const tangentDirection = normalize3(projectToTangent(positionNormal, normal));
    const surfacePosition = lateralDistance < 1e-10
      ? centerlinePoint.map((component) => component)
      : advanceAlongSphere(centerlinePoint, tangentDirection, lateralDistance, surfaceRadius);
    const forward = normalize3(projectToTangent(segment, normal));
    const progress = totalLength > 0
      ? (distanceBeforeSegment + segmentLength * t) / totalLength
      : 0;

    if (!best || distance < best.distance - 1e-9) {
      best = {
        distance,
        lateralDistance,
        radialDistance,
        position: surfacePosition,
        normal: normalize3(surfacePosition),
        centerlinePoint,
        forward,
        progress,
      };
    }

    distanceBeforeSegment += segmentLength;
  }

  return best;
}

export function findRideableSurface(layout, position) {
  if (!Array.isArray(layout?.surfaces)) return null;

  let best = null;
  for (const surface of layout.surfaces) {
    if (surface.type !== 'street' && surface.type !== 'ramp') continue;
    const hit = surfaceDistanceToRecord(position, surface);
    if (!hit || hit.distance > surface.width / 2 + 0.25) continue;

    if (!best || hit.distance < best.distance - 1e-9) {
      best = {
        ...hit,
        surfaceId: surface.id,
        routeEdgeId: surface.routeEdgeId,
        type: surface.type,
        width: surface.width,
      };
    }
  }

  return best;
}

export function projectOntoRail(position, rail) {
  if (!Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite)) return null;
  if (!Array.isArray(rail?.points) || rail.points.length < 2) return null;

  const segmentLengths = [];
  let totalLength = 0;
  for (let index = 0; index < rail.points.length - 1; index += 1) {
    const start = rail.points[index];
    const end = rail.points[index + 1];
    const length = Math.hypot(...end.map((component, axis) => component - start[axis]));
    segmentLengths.push(length);
    totalLength += length;
  }

  let best = null;
  let distanceBeforeSegment = 0;
  for (let index = 0; index < segmentLengths.length; index += 1) {
    const start = rail.points[index];
    const end = rail.points[index + 1];
    const segmentLength = segmentLengths[index];
    if (segmentLength < 1e-12) continue;

    const segment = end.map((component, axis) => component - start[axis]);
    const offset = position.map((component, axis) => component - start[axis]);
    const t = Math.max(0, Math.min(1, dot3(offset, segment) / (segmentLength * segmentLength)));
    const point = start.map((component, axis) => component + segment[axis] * t);
    const normal = normalize3(point);
    const positionNormal = normalize3(position);
    const angle = Math.acos(Math.max(-1, Math.min(1, dot3(positionNormal, normal))));
    const lateralDistance = angle * Math.hypot(...point);
    const radialDistance = Math.abs(Math.hypot(...position) - Math.hypot(...point));
    const distance = Math.hypot(lateralDistance, radialDistance);
    const tangent = normalize3(projectToTangent(segment, normal));
    const progress = totalLength > 0
      ? (distanceBeforeSegment + segmentLength * t) / totalLength
      : 0;

    if (!best || distance < best.distance - 1e-9) {
      best = {
        point,
        normal,
        tangent,
        distance,
        progress,
      };
    }

    distanceBeforeSegment += segmentLength;
  }

  return best;
}

export function findGrindRail(layout, position, forward) {
  if (!Array.isArray(layout?.rails)) return null;
  const approach = normalize3(forward);
  if (approach.every((component) => component === 0)) return null;

  let best = null;
  for (const rail of layout.rails) {
    const hit = projectOntoRail(position, rail);
    if (!hit || hit.distance > (rail.captureRadius ?? 1)) continue;

    const tangentApproach = normalize3(projectToTangent(approach, hit.normal));
    const alignment = dot3(tangentApproach, hit.tangent);
    if (Math.abs(alignment) < 0.65) continue;

    if (!best || hit.distance < best.distance - 1e-9) {
      best = {
        ...hit,
        railId: rail.id,
        direction: alignment < 0 ? hit.tangent.map((component) => -component) : hit.tangent,
      };
    }
  }

  return best;
}

export function createCityLayout({ radius = DEFAULT_RADIUS, seed = 1, assetManifest = null } = {}) {
  const planetRadius = Number.isFinite(radius) && radius > 0 ? radius : DEFAULT_RADIUS;
  const random = createRandom(seed);
  const streetRadius = planetRadius + 0.28;
  const nodes = Array.from({ length: LOOP_NODE_COUNT }, (_, index) => {
    const longitude = (index / LOOP_NODE_COUNT) * Math.PI * 2;
    const latitude = Math.sin(longitude * 2 + 0.35) * 0.13 + (random() - 0.5) * 0.035;
    const position = sphericalPoint(longitude, latitude, streetRadius);
    return {
      id: `loop-${index}`,
      position,
      normal: normalize3(position),
    };
  });

  const edges = nodes.map((node, index) => ({
    id: `route-${index}`,
    from: node.id,
    to: nodes[(index + 1) % nodes.length].id,
    kind: index % 4 === 0 ? 'alley' : 'street',
    loop: true,
  }));
  const surfaces = edges.map((edge, index) => ({
    id: `${index === 3 ? 'ramp' : edge.kind}-${index}`,
    routeEdgeId: edge.id,
    routeKind: edge.kind,
    type: index === 3 ? 'ramp' : 'street',
    width: index === 3 ? RAMP_WIDTH : STREET_WIDTH,
    centerline: makeArc(
      nodes[index].position,
      nodes[(index + 1) % nodes.length].position,
      streetRadius,
      index === 3,
    ),
  }));

  const routeGraph = { nodes, edges };
  const buildings = createBuildings(nodes, planetRadius, random, STREET_WIDTH);
  const rails = [
    createRail(surfaces[7], 'rail-0'),
    createRail(surfaces[10], 'rail-1'),
  ];

  const layout = {
    planetRadius,
    radius: planetRadius,
    seed: seedToNumber(seed),
    routeGraph,
    surfaces,
    buildings,
    rails,
  };
  return assetManifest ? placeCityAssets(layout, assetManifest) : layout;
}
