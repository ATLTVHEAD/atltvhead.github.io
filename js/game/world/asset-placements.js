import { advanceAlongSphere, cross3, makeSurfaceFrame, normalize3 } from '../core/planet-math.js';

// Human-scale correction (user approved 2026-10-28): the avatar is 2.995 world
// units and represents a 5'10" (1.778 m) adult, so 1 unit ≈ 0.594 m. building-a's
// pedestrian door measures 0.21 native units in the imported GLB (checked by
// tests/unit/asset-placements.test.js), so 17x renders it at 3.57 units ≈ 2.12 m,
// a standard door; building-a's 1.47-unit storeys read as four to five floors.
// The pack's variants share proportions, so one uniform scale is used; do not
// stretch each axis or scale variants individually.
const BUILDING_SCALE = 17;
const STREET_CLEARANCE = 1.2;

export function placeCityAssets(layout, manifest) {
  const catalog = new Map((manifest?.assets ?? []).map((asset) => [asset.id, asset]));
  const placements = [];
  const buildings = layout.buildings.flatMap((building, index) => {
    // Full-scale buildings cannot occupy every small-planet route node without overlap.
    if (Math.floor(index / 2) % 3 !== 0) return [];
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
    return [{ ...building, position, normal, size, placement }];
  });
  return { ...layout, buildings, assetPlacements: placements };
}
