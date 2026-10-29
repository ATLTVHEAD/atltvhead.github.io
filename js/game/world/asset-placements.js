import { advanceAlongSphere, cross3, makeSurfaceFrame, normalize3 } from '../core/planet-math.js';

// Human-scale correction (user approved 2026-10-28): the avatar is 2.995 world
// units and represents a 5'10" (1.778 m) adult, so 1 unit ≈ 0.594 m. building-a's
// pedestrian door measures 0.21 native units in the imported GLB (checked by
// tests/unit/asset-placements.test.js), so 17x renders it at 3.57 units ≈ 2.12 m,
// a standard door; building-a's 1.47-unit storeys read as four to five floors.
// The pack's variants share proportions, so one uniform scale is used; do not
// stretch each axis or scale variants individually.
export const BUILDING_SCALE = 17;
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

function isFiniteVector(value) {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
}

function planarForward(value) {
  if (!isFiniteVector(value)) return null;
  const horizontal = [value[0], 0, value[2]];
  const length = Math.hypot(horizontal[0], horizontal[2]);
  if (length < 1e-12) return null;
  return horizontal.map((component) => component / length);
}

function sectionHeading(surface, sectionIndex) {
  const sections = surface?.sections;
  if (!Array.isArray(sections) || sections.length < 2 || !Number.isInteger(sectionIndex)
      || sectionIndex < 0 || sectionIndex >= sections.length) return null;
  const before = sections[Math.max(0, sectionIndex - 1)].center;
  const after = sections[Math.min(sections.length - 1, sectionIndex + 1)].center;
  return planarForward(after.map((value, axis) => value - before[axis]));
}

function addScaled(a, b, amount) {
  return a.map((value, axis) => value + b[axis] * amount);
}

function dot(a, b) {
  return a.reduce((sum, value, axis) => sum + value * b[axis], 0);
}

export function placePlanarCityAssets(layout, manifest) {
  if (!layout || !Array.isArray(layout.buildings)) {
    throw new TypeError('A planar city layout with building records is required.');
  }
  const catalog = new Map((manifest?.assets ?? []).map((asset) => [asset.id, asset]));
  const surfaces = new Map((layout.surfaces ?? []).map((surface) => [surface.id, surface]));
  const placements = [];

  function place(record, category) {
    const source = catalog.get(record?.assetId);
    if (!source?.bounds || !['min', 'max'].every((key) => (
      source.bounds[key]?.length === 3 && source.bounds[key].every(Number.isFinite)
    ))) throw new Error(`Missing asset bounds: ${record?.assetId ?? 'unknown'}`);
    if (!record?.id || (!record.wall && !isFiniteVector(record.position))) {
      throw new Error(`Asset ${record?.id ?? 'unknown'} needs a finite planar position and nonzero heading.`);
    }
    const routeHeading = record.wall
      ? sectionHeading(surfaces.get(record.wall.surfaceId), record.wall.sectionIndex)
      : null;
    const routeLeft = routeHeading ? normalize3(cross3(routeHeading, [0, 1, 0])) : null;
    const forward = record.wall
      ? record.wall.alongAxis === 'x' ? routeLeft : routeHeading
      : planarForward(record.forward);
    if (!forward) throw new Error(`Asset ${record.id} needs a finite planar position and nonzero heading.`);

    const scaleFactor = category === 'building' ? BUILDING_SCALE : (record.scale ?? 1);
    if (!Number.isFinite(scaleFactor) || scaleFactor <= 0) throw new Error(`Invalid asset scale: ${record.id}`);
    const size = source.bounds.max.map((value, axis) => (value - source.bounds.min[axis]) * scaleFactor);
    if (!size.every((value) => Number.isFinite(value) && value > 0)) {
      throw new Error(`Invalid asset bounds: ${record.assetId}`);
    }

    const normal = [0, 1, 0];
    const right = normalize3(cross3(normal, forward));
    let position = record.position ? [...record.position] : null;
    if (record.wall) {
      const surface = surfaces.get(record.wall.surfaceId);
      const section = surface?.sections?.[record.wall.sectionIndex];
      if (!section || !['left', 'right'].includes(record.wall.side)) {
        throw new Error(`Invalid wall anchor: ${record.id}`);
      }
      const side = normalize3(record.wall.side === 'left'
        ? section.left.map((value, axis) => value - section.center[axis])
        : section.right.map((value, axis) => value - section.center[axis]));
      const halfRouteWidth = Math.hypot(...section.left.map((value, axis) => value - section.right[axis])) / 2;
      const facadeGap = Number.isFinite(record.wall.facadeGap) ? record.wall.facadeGap : 0;
      if (facadeGap < 0) throw new Error(`Invalid wall facade gap: ${record.id}`);
      const lateralHalfExtent = size[0] / 2 * Math.abs(dot(right, side))
        + size[2] / 2 * Math.abs(dot(forward, side));
      position = addScaled(section.center, side, halfRouteWidth + lateralHalfExtent + facadeGap);
      position[1] = 0;
    }
    if (!isFiniteVector(position)) {
      throw new Error(`Asset ${record.id} needs a finite planar position and nonzero heading.`);
    }
    const placement = {
      id: record.id,
      assetId: record.assetId,
      position,
      scale: scaleFactor,
      size,
      sourceOrigin: [
        (source.bounds.min[0] + source.bounds.max[0]) / 2,
        source.bounds.min[1],
        (source.bounds.min[2] + source.bounds.max[2]) / 2,
      ],
      axes: [right, normal, forward],
    };
    placements.push(placement);
    return category === 'building'
      ? { ...record, position, forward, normal, size, placement }
      : { ...record, position, forward, placement };
  }

  const buildings = layout.buildings.map((building) => place(building, 'building'));
  const props = (layout.props ?? []).map((prop) => place(prop, 'prop'));
  return { ...layout, buildings, props, assetPlacements: placements };
}
