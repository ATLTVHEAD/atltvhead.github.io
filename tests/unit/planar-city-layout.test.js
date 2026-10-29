import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createPlanarCityLayout } from '../../js/game/world/planar-city-layout.js';

const manifest = JSON.parse(readFileSync(new URL('../../assets/game/manifest.json', import.meta.url)));
const distance = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const dot2 = (a, b) => a[0] * b[0] + a[2] * b[2];
const sectionWidth = (section) => distance(section.left, section.right);
const widths = (surface) => surface.sections.map(sectionWidth);

function connected(graph) {
  if (!graph?.nodes?.length) return false;
  const reached = new Set([graph.nodes[0].id]);
  const pending = [graph.nodes[0].id];
  while (pending.length) {
    const id = pending.pop();
    for (const edge of graph.edges) {
      const next = edge.from === id ? edge.to : edge.to === id ? edge.from : null;
      if (next && !reached.has(next)) {
        reached.add(next);
        pending.push(next);
      }
    }
  }
  return reached.size === graph.nodes.length;
}

function routeRuns(surface) {
  const segments = surface.sections.slice(1).map((section, index) => {
    const start = surface.sections[index].center;
    const end = section.center;
    const delta = [end[0] - start[0], 0, end[2] - start[2]];
    const length = Math.hypot(delta[0], delta[2]);
    return { start, end, tangent: length ? [delta[0] / length, 0, delta[2] / length] : [0, 0, 0], length };
  });
  const runs = [];
  for (const segment of segments) {
    const last = runs.at(-1);
    if (last && dot2(last.tangent, segment.tangent) > 0.999) {
      last.end = segment.end;
      last.length += segment.length;
      last.segments.push(segment);
    } else {
      runs.push({ ...segment, segments: [segment] });
    }
  }
  return runs;
}

function turnCount(surface) {
  const runs = routeRuns(surface).filter((run) => run.length > 1);
  return runs.slice(1).filter((run, index) => {
    const before = runs.filter((candidate) => candidate.length > 1)[index].tangent;
    return dot2(before, run.tangent) < Math.cos(Math.PI / 4);
  }).length;
}

function projectedHalfExtent(placement, direction) {
  const [axisX, , axisZ] = placement.axes;
  return placement.size[0] / 2 * Math.abs(dot2(axisX, direction))
    + placement.size[2] / 2 * Math.abs(dot2(axisZ, direction));
}

function wallGapAt(buildings, point, tangent, side) {
  const gaps = [[], []];
  for (const building of buildings) {
    const placement = building.placement;
    const offset = [placement.position[0] - point[0], 0, placement.position[2] - point[2]];
    const along = dot2(offset, tangent);
    if (Math.abs(along) > projectedHalfExtent(placement, tangent)) continue;
    const lateral = dot2(offset, side);
    const lateralExtent = projectedHalfExtent(placement, side);
    if (lateral > 0) gaps[0].push(lateral - lateralExtent);
    else gaps[1].push(-lateral - lateralExtent);
  }
  return gaps.map((sideGaps) => Math.min(...sideGaps));
}

function wallsAt(buildings, point, tangent, side) {
  const walls = [[], []];
  for (const building of buildings) {
    const placement = building.placement;
    const offset = [placement.position[0] - point[0], 0, placement.position[2] - point[2]];
    const along = dot2(offset, tangent);
    if (Math.abs(along) > projectedHalfExtent(placement, tangent)) continue;
    const lateral = dot2(offset, side);
    const lateralExtent = projectedHalfExtent(placement, side);
    if (lateral > 0) walls[0].push({ building, gap: lateral - lateralExtent });
    else if (lateral < 0) walls[1].push({ building, gap: -lateral - lateralExtent });
  }
  return walls.map((sideWalls) => sideWalls.sort((a, b) => a.gap - b.gap));
}

function boxesOverlap(first, second, offsetX = 0, offsetZ = 0) {
  const firstPlacement = first.placement;
  const secondPlacement = second.placement;
  const centerDelta = [
    secondPlacement.position[0] + offsetX - firstPlacement.position[0],
    0,
    secondPlacement.position[2] + offsetZ - firstPlacement.position[2],
  ];
  for (const axis of [firstPlacement.axes[0], firstPlacement.axes[2],
    secondPlacement.axes[0], secondPlacement.axes[2]]) {
    const firstRadius = projectedHalfExtent(firstPlacement, axis);
    const secondRadius = projectedHalfExtent(secondPlacement, axis);
    if (Math.abs(dot2(centerDelta, axis)) >= firstRadius + secondRadius - 1e-7) return false;
  }
  return true;
}

function segmentHitsExpandedBuilding(start, end, width, building) {
  const placement = building.placement;
  const offset = (point) => [point[0] - placement.position[0], 0, point[2] - placement.position[2]];
  const localStart = placement.axes.filter((_, index) => index !== 1).map((axis) => dot2(offset(start), axis));
  const localEnd = placement.axes.filter((_, index) => index !== 1).map((axis) => dot2(offset(end), axis));
  const extents = [placement.size[0] / 2 + width / 2 + 0.25, placement.size[2] / 2 + width / 2 + 0.25];
  let enter = 0;
  let exit = 1;
  for (let axis = 0; axis < 2; axis += 1) {
    const delta = localEnd[axis] - localStart[axis];
    if (Math.abs(delta) < 1e-9) {
      if (Math.abs(localStart[axis]) > extents[axis]) return false;
      continue;
    }
    const a = (-extents[axis] - localStart[axis]) / delta;
    const b = (extents[axis] - localStart[axis]) / delta;
    enter = Math.max(enter, Math.min(a, b));
    exit = Math.min(exit, Math.max(a, b));
    if (enter > exit) return false;
  }
  return true;
}

function pointInsideExpandedBuilding(point, building, clearance = 0.25) {
  const placement = building.placement;
  const offset = [point[0] - placement.position[0], 0, point[2] - placement.position[2]];
  return [placement.axes[0], placement.axes[2]].every((axis, index) => (
    Math.abs(dot2(offset, axis)) <= placement.size[index === 0 ? 0 : 2] / 2 + clearance
  ));
}

describe('static planar city layout', () => {
  it('layout_isStaticAcrossSeeds', () => {
    const first = createPlanarCityLayout({ assetManifest: manifest, seed: 1 });
    const second = createPlanarCityLayout({ assetManifest: manifest, seed: 999 });
    expect(first).toEqual(second);
    expect(first.width).toBe(256);
    expect(first.depth).toBe(256);
  });

  it('layout_hasUnequalStreetSpacingAndVaryingWidths', () => {
    const layout = createPlanarCityLayout({ assetManifest: manifest });
    const wrapRoutes = ['street-wrap-x-west', 'street-wrap-x-east', 'street-wrap-z-south', 'street-wrap-z-north']
      .map((id) => layout.surfaces.find((surface) => surface.id === id));
    expect(wrapRoutes.every(Boolean)).toBe(true);
    for (const surface of wrapRoutes) {
      const localWidths = widths(surface);
      expect(Math.min(...localWidths)).toBeGreaterThanOrEqual(5);
      expect(Math.max(...localWidths)).toBeLessThanOrEqual(10);
      expect(Math.max(...localWidths) - Math.min(...localWidths)).toBeGreaterThanOrEqual(0.6);
    }
    const xStreetSpacing = Math.min(220 - 30, 256 - (220 - 30));
    const zStreetSpacing = Math.min(236 - 20, 256 - (236 - 20));
    expect(xStreetSpacing).not.toBe(zStreetSpacing);
    const xIntervals = wrapRoutes.slice(0, 2).flatMap((surface) => surface.sections.slice(1)
      .map((section, index) => distance(surface.sections[index].center, section.center)));
    expect(new Set(xIntervals.map((value) => Math.round(value * 100) / 100)).size).toBeGreaterThan(2);
  });

  it('layout_doglegIsEnclosedByDifferentBuildings', () => {
    const layout = createPlanarCityLayout({ assetManifest: manifest });
    const alley = layout.surfaces.find((surface) => surface.id === 'alley-dogleg');
    const alleyWidths = widths(alley);
    expect(Math.min(...alleyWidths)).toBeGreaterThanOrEqual(1.8);
    expect(Math.max(...alleyWidths)).toBeLessThanOrEqual(3.0);
    expect(Math.max(...alleyWidths) - Math.min(...alleyWidths)).toBeGreaterThanOrEqual(0.6);
    expect(turnCount(alley)).toBeGreaterThanOrEqual(2);

    const straightRuns = routeRuns(alley).filter((run) => run.length >= 18);
    const pairedRuns = straightRuns.map((run) => {
      const center = run.start.map((value, axis) => (value + run.end[axis]) / 2);
      const tangent = run.tangent;
      const side = [-tangent[2], 0, tangent[0]];
      const section = alley.sections.reduce((best, current) => (
        distance(current.center, center) < distance(best.center, center) ? current : best
      ));
      return {
        center,
        tangent,
        side,
        gaps: wallGapAt(layout.buildings, center, tangent, side),
        walls: wallsAt(layout.buildings, center, tangent, side),
        width: sectionWidth(section),
      };
    });

    expect(pairedRuns.length).toBe(3);
    for (const run of pairedRuns) {
      expect(run.gaps[0]).toBeGreaterThanOrEqual(0.25);
      expect(run.gaps[1]).toBeGreaterThanOrEqual(0.25);
      expect(run.walls.every((sideWalls) => sideWalls.length > 0)).toBe(true);
      expect(run.walls[0][0].building.id).not.toBe(run.walls[1][0].building.id);
      const alongPositions = run.walls.map((sideWalls) => {
        const building = sideWalls[0].building;
        const position = building.placement.position;
        return dot2([position[0] - run.center[0], 0, position[2] - run.center[2]], run.tangent);
      });
      expect(Math.abs(alongPositions[0] - alongPositions[1])).toBeGreaterThanOrEqual(5);
      for (const sideWalls of run.walls) {
        const wall = sideWalls[0];
        const anchoredWidth = sectionWidth(alley.sections[wall.building.wall.sectionIndex]);
        expect(Math.abs(wall.gap - anchoredWidth / 2 - 0.6)).toBeLessThan(0.05);
      }
    }
    expect(new Set(pairedRuns.flatMap((run) => run.walls.map((sideWalls) => sideWalls[0].building.id))).size)
      .toBe(6);
    expect(new Set(layout.buildings.filter((building) => building.id.startsWith('alley-wall-'))
      .map((building) => building.placement.assetId)).size).toBeGreaterThanOrEqual(6);

    const blockedAlleySections = [];
    for (let index = 1; index < alley.sections.length; index += 1) {
      const before = alley.sections[index - 1];
      const current = alley.sections[index];
      const width = Math.max(sectionWidth(before), sectionWidth(current));
      for (const building of layout.buildings) {
        if (segmentHitsExpandedBuilding(before.center, current.center, width, building)) {
          blockedAlleySections.push([index, building.id]);
        }
      }
    }
    expect(blockedAlleySections).toEqual([]);
  });

  it('layout_wrappedNeighborsDoNotOverlap', () => {
    const layout = createPlanarCityLayout({ assetManifest: manifest });
    const overlaps = [];
    for (let firstIndex = 0; firstIndex < layout.buildings.length; firstIndex += 1) {
      for (let secondIndex = firstIndex; secondIndex < layout.buildings.length; secondIndex += 1) {
        const first = layout.buildings[firstIndex];
        const second = layout.buildings[secondIndex];
        for (const offsetX of [-256, 0, 256]) for (const offsetZ of [-256, 0, 256]) {
          if (firstIndex === secondIndex && offsetX === 0 && offsetZ === 0) continue;
          if (boxesOverlap(first, second, offsetX, offsetZ)) overlaps.push([first.id, second.id, offsetX, offsetZ]);
        }
      }
    }
    expect(overlaps).toEqual([]);

    const blockedStreetSections = [];
    for (const street of layout.surfaces.filter((surface) => surface.type === 'street')) {
      for (let index = 1; index < street.sections.length; index += 1) {
        const before = street.sections[index - 1];
        const current = street.sections[index];
        const width = Math.max(sectionWidth(before), sectionWidth(current));
        for (const building of layout.buildings) {
          if (segmentHitsExpandedBuilding(before.center, current.center, width, building)) {
            blockedStreetSections.push([street.id, building.id]);
          }
        }
      }
    }
    expect(blockedStreetSections).toEqual([]);
  });

  it('layout_graphAndSafeSpawnsAreConnected', () => {
    const layout = createPlanarCityLayout({ assetManifest: manifest });
    expect(connected(layout.routeGraph)).toBe(true);
    const nodeIds = new Set(layout.routeGraph.nodes.map((node) => node.id));
    const surfaceIds = new Set(layout.surfaces.map((surface) => surface.id));
    expect(layout.routeGraph.edges.every((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to)
      && surfaceIds.has(edge.surfaceId) && edge.tileOffset.length === 2
      && edge.tileOffset.every(Number.isInteger))).toBe(true);
    expect(layout.defaultSpawnId).toBe('spawn-plaza');
    expect(layout.spawnPoints.some((spawn) => spawn.id === 'spawn-wrap-x')).toBe(true);
    expect(layout.spawnPoints.some((spawn) => spawn.id === 'spawn-wrap-z')).toBe(true);
    expect(layout.spawnPoints.every((spawn) => Number.isFinite(spawn.position[0])
      && Number.isFinite(spawn.position[1]) && Number.isFinite(spawn.position[2]))).toBe(true);
    expect(layout.spawnPoints.every((spawn) => layout.buildings.every((building) => (
      !pointInsideExpandedBuilding(spawn.position, building)
    )))).toBe(true);
    const variants = new Set(layout.buildings.map((building) => building.placement.assetId));
    expect([...variants].filter((id) => /^building-[a-h]$/.test(id))).toHaveLength(8);
    for (const building of layout.buildings) {
      const bounds = manifest.assets.find((asset) => asset.id === building.placement.assetId).bounds;
      expect(building.placement.scale).toBe(17);
      expect(building.placement.size).toEqual(bounds.max.map((value, axis) => (
        (value - bounds.min[axis]) * 17
      )));
    }
    expect(layout.props.filter((prop) => prop.placement.assetId === 'shipping-container-a')).toHaveLength(2);
    expect(layout.props.filter((prop) => prop.placement.assetId === 'water-tower')).toHaveLength(1);
    expect(layout.props.filter((prop) => prop.placement.assetId === 'detail-tank')).toHaveLength(1);
    expect(layout.surfaces.filter((surface) => surface.type === 'ramp')).toHaveLength(1);
    expect(layout.rails).toHaveLength(2);
    expect(layout.rails.every((rail) => rail.top === 0.82 && rail.width === 0.9 && rail.length === 24)).toBe(true);
    expect(layout.surfaces.filter((surface) => surface.type === 'plaza')).toHaveLength(1);
    expect(layout.surfaces.filter((surface) => surface.type === 'junction').length).toBeGreaterThanOrEqual(4);
    const plazaProps = layout.props;
    expect(plazaProps.every((prop) => prop.position[0] >= 184 && prop.position[0] <= 220
      && prop.position[2] >= 112 && prop.position[2] <= 146)).toBe(true);
  });

  it('layout_seamCrossSectionsAndExplicitPatchesAreExact', () => {
    const layout = createPlanarCityLayout({ assetManifest: manifest });
    for (const [surfaceId, axis, offset] of [
      ['street-wrap-x-west', 0, [256, 0, 0]],
      ['street-wrap-x-east', 0, [256, 0, 0]],
      ['street-wrap-z-south', 2, [0, 0, 256]],
      ['street-wrap-z-north', 2, [0, 0, 256]],
    ]) {
      const surface = layout.surfaces.find((candidate) => candidate.id === surfaceId);
      const first = surface.sections[0];
      const last = surface.sections.at(-1);
      for (const key of ['center', 'left', 'right']) {
        expect(last[key].map((value, component) => value - offset[component]))
          .toEqual(first[key].map((value) => expect.closeTo(value, 6)));
      }
      expect(Math.abs(sectionWidth(first) - sectionWidth(last))).toBeLessThan(1e-6);
      expect(layout.routeGraph.edges.some((edge) => edge.surfaceId === surfaceId
        && edge.tileOffset[axis === 0 ? 0 : 1] === 1)).toBe(true);
    }

    for (const patch of layout.surfaces.filter((surface) => surface.vertices && surface.indices)) {
      expect(patch.indices.length % 3).toBe(0);
      for (let index = 0; index < patch.indices.length; index += 3) {
        const [a, b, c] = patch.indices.slice(index, index + 3).map((vertexIndex) => patch.vertices[vertexIndex]);
        const area2 = Math.abs((b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]));
        expect(area2).toBeGreaterThan(1e-10);
      }
    }
    const ramp = layout.surfaces.find((surface) => surface.type === 'ramp');
    expect(Math.max(...ramp.sections.map((section) => section.center[1]))).toBeCloseTo(0.745, 8);
    expect(ramp.sections.every((section) => section.left[1] === section.center[1]
      && section.right[1] === section.center[1])).toBe(true);
  });

  it('layout_requiresManifestBoundsForBuildingVariants', () => {
    expect(() => createPlanarCityLayout({ assetManifest: { assets: [] } })).toThrow(/Missing asset bounds:/);
  });
});
