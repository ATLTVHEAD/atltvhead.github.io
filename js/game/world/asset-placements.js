import { advanceAlongSphere, cross3, makeSurfaceFrame, normalize3 } from '../core/planet-math.js';

// The pack uses a consistent scale across building variants; do not stretch each axis.
const BUILDING_SCALE = 3;
const STREET_CLEARANCE = 1.2;

export function placeCityAssets(layout, manifest) {
  const catalog = new Map((manifest?.assets ?? []).map((asset) => [asset.id, asset]));
  const placements = [];
  const buildings = layout.buildings.map((building, index) => {
    const assetId = `building-${'abcdefgh'[index % 8]}`;
    const source = catalog.get(assetId);
    if (!source?.bounds || !['min', 'max'].every((key) => source.bounds[key]?.length === 3
        && source.bounds[key].every(Number.isFinite))) throw new Error(`Missing building bounds: ${assetId}`);
    const size = source.bounds.max.map((value, axis) => (value - source.bounds.min[axis]) * BUILDING_SCALE);
    if (!size.every((value) => value > 0)) throw new Error(`Invalid building bounds: ${assetId}`);
    const nodeIndex = Math.floor(index / 2);
    const node = layout.routeGraph.nodes[nodeIndex];
    const next = layout.routeGraph.nodes[(nodeIndex + 1) % layout.routeGraph.nodes.length];
    const heading = next.position.map((value, axis) => value - node.position[axis]);
    const frame = makeSurfaceFrame(node.normal, heading);
    const halfWidth = Math.max(...layout.surfaces.map((surface) => surface.width)) / 2;
    const footprint = Math.hypot(size[0] / 2, size[2] / 2);
    const offset = halfWidth + footprint + STREET_CLEARANCE;
    const position = advanceAlongSphere(node.position, frame.right, index % 2 === 0 ? -offset : offset, layout.radius);
    const normal = normalize3(position);
    const forward = makeSurfaceFrame(normal, heading).forward;
    const placement = {
      id: building.id, assetId, position, scale: BUILDING_SCALE, size,
      sourceOrigin: [(source.bounds.min[0] + source.bounds.max[0]) / 2,
        source.bounds.min[1], (source.bounds.min[2] + source.bounds.max[2]) / 2],
      axes: [normalize3(cross3(normal, forward)), normal, forward],
    };
    placements.push(placement);
    return { ...building, position, normal, size, placement };
  });
  return { ...layout, buildings, assetPlacements: placements };
}
