import { cross3, normalize3 } from '../core/planet-math.js';
import { placePlanarCityAssets } from './asset-placements.js';

const CITY_SPAN = 256;
const UP = [0, 1, 0];

function makeSection(point, width, heading) {
  const center = [...point];
  const left = normalize3(cross3(heading, UP));
  return {
    center,
    left: center.map((value, axis) => value + left[axis] * width / 2),
    right: center.map((value, axis) => value - left[axis] * width / 2),
  };
}

function makeRouteSurface({ id, type = 'street', routeEdgeId = id, points, widths }) {
  const sections = points.map((point, index) => {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const incoming = [point[0] - previous[0], point[1] - previous[1], point[2] - previous[2]];
    const outgoing = [next[0] - point[0], next[1] - point[1], next[2] - point[2]];
    const sum = incoming.map((value, axis) => value + outgoing[axis]);
    const tangent = normalize3(Math.hypot(...sum) > 1e-10 ? sum : outgoing);
    return makeSection(point, widths[index], tangent);
  });
  return { id, type, routeEdgeId, sections };
}

function makePatch({ id, type, points }) {
  return {
    id,
    type,
    vertices: points.map(([x, z]) => [x, 0, z]),
    indices: points.slice(2).flatMap((_, index) => [0, index + 1, index + 2]),
  };
}

function makeWrapStreet({ id, axis, fixed, samples, widths }) {
  const points = samples.map((position) => (axis === 'x'
    ? [position, 0, fixed]
    : [fixed, 0, position]));
  return makeRouteSurface({ id, points, widths, routeEdgeId: `route-${id}` });
}

function makeNodes() {
  return [
    { id: 'junction-west-south', position: [20, 0, 30] },
    { id: 'junction-west-north', position: [236, 0, 30] },
    { id: 'junction-east-south', position: [20, 0, 220] },
    { id: 'junction-east-north', position: [236, 0, 220] },
    { id: 'alley-start', position: [60, 0, 30] },
    { id: 'alley-turn-one', position: [61.5, 0, 108.5] },
    { id: 'alley-turn-two', position: [158.5, 0, 111.5] },
    { id: 'alley-end', position: [160, 0, 190] },
    { id: 'plaza-node', position: [202, 0, 128] },
    { id: 'north-plaza-link', position: [236, 0, 128] },
  ];
}

function makeEdge(id, from, to, surfaceId, tileOffset = [0, 0]) {
  return { id, from, to, surfaceId, tileOffset };
}

function makeRouteGraph() {
  return {
    nodes: makeNodes(),
    edges: [
      makeEdge('west-south-to-alley', 'junction-west-south', 'alley-start', 'street-wrap-x-west'),
      makeEdge('alley-to-west-north', 'alley-start', 'junction-west-north', 'street-wrap-x-west'),
      makeEdge('west-x-seam', 'junction-west-north', 'junction-west-south', 'street-wrap-x-west', [1, 0]),
      makeEdge('east-south-to-east-north', 'junction-east-south', 'junction-east-north', 'street-wrap-x-east'),
      makeEdge('east-x-seam', 'junction-east-north', 'junction-east-south', 'street-wrap-x-east', [1, 0]),
      makeEdge('south-west-to-south-east', 'junction-west-south', 'junction-east-south', 'street-wrap-z-south'),
      makeEdge('south-z-seam', 'junction-east-south', 'junction-west-south', 'street-wrap-z-south', [0, 1]),
      makeEdge('north-west-to-plaza-link', 'junction-west-north', 'north-plaza-link', 'street-wrap-z-north'),
      makeEdge('north-plaza-to-east', 'north-plaza-link', 'junction-east-north', 'street-wrap-z-north'),
      makeEdge('north-z-seam', 'junction-east-north', 'junction-west-north', 'street-wrap-z-north', [0, 1]),
      makeEdge('alley-turn-one', 'alley-start', 'alley-turn-one', 'alley-dogleg'),
      makeEdge('alley-turn-two', 'alley-turn-one', 'alley-turn-two', 'alley-dogleg'),
      makeEdge('alley-exit', 'alley-turn-two', 'alley-end', 'alley-dogleg'),
      makeEdge('plaza-connector', 'plaza-node', 'north-plaza-link', 'street-plaza-connector'),
    ],
  };
}

function makeDogleg() {
  const points = [
    [60, 0, 30], [60, 0, 50], [60, 0, 55], [60, 0, 70], [60, 0, 90], [60, 0, 107],
    [63, 0, 110], [80, 0, 110], [100, 0, 110], [110, 0, 110], [130, 0, 110], [157, 0, 110],
    [160, 0, 113], [160, 0, 130], [160, 0, 150], [160, 0, 160], [160, 0, 170], [160, 0, 190],
  ];
  return makeRouteSurface({
    id: 'alley-dogleg',
    type: 'alley',
    routeEdgeId: 'route-alley-dogleg',
    points,
    widths: [2.4, 2.5, 2.45, 2.2, 1.9, 2.1, 2.2, 2.3, 2.4, 2.4, 2.8, 2.7, 2.6, 2.5, 2.1, 2.05, 2.0, 2.4],
  });
}

function makeBuildings() {
  const wall = (sectionIndex, side) => ({
    surfaceId: 'alley-dogleg',
    sectionIndex,
    side,
    alongAxis: 'x',
    facadeGap: 0.6,
  });
  const walls = [
    ['alley-wall-1-left', 'building-a', 3, 'left'],
    ['alley-wall-1-right', 'building-b', 2, 'right'],
    ['alley-wall-2-left', 'building-c', 8, 'left'],
    ['alley-wall-2-right', 'building-d', 9, 'right'],
    ['alley-wall-3-left', 'building-e', 14, 'left'],
    ['alley-wall-3-right', 'building-f', 15, 'right'],
  ].map(([id, assetId, sectionIndex, side]) => ({ id, assetId, wall: wall(sectionIndex, side) }));

  return [
    ...walls,
    { id: 'yard-building-west', assetId: 'building-g', position: [200, 0, 86], forward: [1, 0, 0] },
    { id: 'yard-building-east', assetId: 'building-h', position: [200, 0, 178], forward: [1, 0, 0] },
  ];
}

function makeProps() {
  return [
    { id: 'plaza-container-west', assetId: 'shipping-container-a', position: [190, 0, 120], forward: [1, 0, 0], scale: 3 },
    { id: 'plaza-container-east', assetId: 'shipping-container-a', position: [205, 0, 120], forward: [1, 0, 0], scale: 3 },
    { id: 'plaza-water-tower', assetId: 'water-tower', position: [190, 0, 139], forward: [0, 0, 1] },
    { id: 'plaza-detail-tank', assetId: 'detail-tank', position: [207, 0, 139], forward: [0, 0, 1] },
  ];
}

function makeRampAndRails(surfaces) {
  const ramp = makeRouteSurface({
    id: 'plaza-ramp',
    type: 'ramp',
    routeEdgeId: 'route-plaza-ramp',
    points: [[94, 0, 160], [94, 0.745, 172], [94, 0, 184]],
    widths: [4.2, 4.2, 4.2],
  });
  surfaces.push(ramp);
  return [
    {
      id: 'primary-rail-left', routeEdgeId: ramp.routeEdgeId, top: 0.82, width: 0.9, length: 24,
      points: [[92.35, 0.82, 160], [92.35, 0.82, 184]],
      start: [92.35, 0.82, 160], end: [92.35, 0.82, 184], radius: 0.09, captureRadius: 1.15,
    },
    {
      id: 'primary-rail-right', routeEdgeId: ramp.routeEdgeId, top: 0.82, width: 0.9, length: 24,
      points: [[95.65, 0.82, 160], [95.65, 0.82, 184]],
      start: [95.65, 0.82, 160], end: [95.65, 0.82, 184], radius: 0.09, captureRadius: 1.15,
    },
  ];
}

function makeSurfaces() {
  const surfaces = [
    makeWrapStreet({
      id: 'street-wrap-x-west', axis: 'x', fixed: 30,
      samples: [0, 20, 60, 100, 150, 200, 236, 256],
      widths: [7.0, 6.2, 5.8, 7.2, 8.1, 6.5, 6.0, 7.0],
    }),
    makeWrapStreet({
      id: 'street-wrap-x-east', axis: 'x', fixed: 220,
      samples: [0, 20, 70, 120, 180, 220, 236, 256],
      widths: [8.4, 7.6, 6.1, 7.4, 8.7, 7.8, 7.2, 8.4],
    }),
    makeWrapStreet({
      id: 'street-wrap-z-south', axis: 'z', fixed: 20,
      samples: [0, 30, 80, 130, 180, 220, 256],
      widths: [6.4, 5.7, 6.8, 7.9, 6.5, 5.9, 6.4],
    }),
    makeWrapStreet({
      id: 'street-wrap-z-north', axis: 'z', fixed: 236,
      samples: [0, 30, 75, 128, 175, 220, 256],
      widths: [8.2, 7.5, 6.4, 8.0, 8.9, 7.1, 8.2],
    }),
    makeDogleg(),
    makeRouteSurface({
      id: 'street-plaza-connector',
      type: 'street',
      routeEdgeId: 'route-street-plaza-connector',
      points: [[202, 0, 128], [236, 0, 128]],
      widths: [6.0, 6.0],
    }),
    makePatch({
      id: 'plaza-central', type: 'plaza',
      points: [[184, 112], [220, 112], [220, 146], [184, 146]],
    }),
    makePatch({
      id: 'yard-west', type: 'yard',
      points: [[186, 74], [222, 74], [219, 98], [190, 100]],
    }),
    makePatch({
      id: 'yard-east', type: 'yard',
      points: [[186, 160], [222, 162], [220, 194], [188, 192]],
    }),
  ];
  for (const [x, z, id] of [
    [20, 30, 'west-south'], [236, 30, 'west-north'],
    [20, 220, 'east-south'], [236, 220, 'east-north'],
    [60, 30, 'alley-entry'],
  ]) {
    surfaces.push(makePatch({
      id: `junction-${id}`,
      type: 'junction',
      points: [[x - 6, z - 6], [x + 6, z - 6], [x + 6, z + 6], [x - 6, z + 6]],
    }));
  }
  return surfaces;
}

export function createPlanarCityLayout({ assetManifest } = {}) {
  const surfaces = makeSurfaces();
  const rails = makeRampAndRails(surfaces);
  const layout = {
    width: CITY_SPAN,
    depth: CITY_SPAN,
    surfaces,
    routeGraph: makeRouteGraph(),
    buildings: makeBuildings(),
    props: makeProps(),
    assetPlacements: [],
    rails,
    spawnPoints: [
      { id: 'spawn-plaza', surfaceId: 'plaza-central', position: [202, 0, 130], forward: [1, 0, 0], routeId: 'route-plaza-connector' },
      { id: 'spawn-wrap-x', surfaceId: 'street-wrap-x-west', position: [224, 0, 30], forward: [1, 0, 0], routeId: 'route-street-wrap-x-west' },
      { id: 'spawn-wrap-z', surfaceId: 'street-wrap-z-south', position: [20, 0, 248], forward: [0, 0, 1], routeId: 'route-street-wrap-z-south' },
    ],
    defaultSpawnId: 'spawn-plaza',
    landmarks: [{ id: 'landmark-central-plaza', position: [202, 0, 128] }],
    launchMarkers: [],
    tagTargets: [],
  };
  return placePlanarCityAssets(layout, assetManifest);
}
