import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createPlanarCityLayout } from '../../js/game/world/planar-city-layout.js';
import { compilePlanarWorld } from '../../js/game/world/planar-city-surfaces.js';
import { queryPlanarSupport, sweepPlanarSkater } from '../../js/game/world/planar-city-queries.js';

const manifest = JSON.parse(readFileSync(new URL('../../assets/game/manifest.json', import.meta.url)));
const addScaled = (point, direction, amount) => point.map((value, axis) => value + direction[axis] * amount);
const diagonalAxes = [
  [Math.SQRT1_2, 0, -Math.SQRT1_2],
  [0, 1, 0],
  [Math.SQRT1_2, 0, Math.SQRT1_2],
];

function boxLayout(position = [0.5, 0, 0.5], size = [2, 2, 2]) {
  return {
    width: 256,
    depth: 256,
    surfaces: [],
    buildings: [{
      id: 'seam-wall',
      position,
      normal: [0, 1, 0],
      size,
      placement: {
        id: 'seam-wall',
        assetId: 'fixture-box',
        position,
        scale: 1,
        size,
        sourceOrigin: [0, 0, 0],
        axes: diagonalAxes,
      },
    }],
    props: [],
    rails: [],
  };
}

function simpleRoute(id, z = 40) {
  const height = 0.025;
  return {
    id,
    type: 'street',
    routeEdgeId: `route-${id}`,
    sections: [
      { center: [20, height, z], left: [20, height, z + 3], right: [20, height, z - 3] },
      { center: [60, height, z], left: [60, height, z + 3], right: [60, height, z - 3] },
    ],
  };
}

describe('periodic planar city queries', () => {
  it('queries_xZAndCornerSeamsMatchUnwrapped', () => {
    const world = compilePlanarWorld(boxLayout());
    const seamHit = sweepPlanarSkater(world, [-3, 1, 0.5], [3, 1, 0.5], 0.25);
    const translatedHit = sweepPlanarSkater(world, [253, 1, 0.5], [259, 1, 0.5], 0.25);
    const diagonalHit = sweepPlanarSkater(world, [253, 1, 253], [259, 1, 259], 0.25);

    expect(seamHit.blocked).toBe(true);
    expect(translatedHit.blocked).toBe(true);
    expect(seamHit.hitId).toBe('seam-wall');
    expect(seamHit.hitId).toBe(translatedHit.hitId);
    expect(Math.abs(seamHit.position[0] - (translatedHit.position[0] - 256))).toBeLessThan(1e-6);
    expect(diagonalHit.blocked).toBe(true);
    expect(diagonalHit.hitId).toBe('seam-wall');
    expect(diagonalHit.position[0]).toBeGreaterThan(253);
    expect(diagonalHit.position[2]).toBeGreaterThan(253);
    expect(sweepPlanarSkater(world, [253, 1, 10], [259, 1, 10], 0.25).blocked).toBe(false);
    expect(sweepPlanarSkater(world, [20, 1, 20], [20, 1, 20], 0.25).blocked).toBe(false);
    expect(sweepPlanarSkater(world, [20, 1, 20], [20, 1, 20], 0).blocked).toBe(false);
    expect(sweepPlanarSkater(world, [Number.NaN, 1, 20], [20, 1, 20]))
      .toEqual({ position: [0, 0, 0], blocked: false, hitId: null });
    expect(sweepPlanarSkater(world, [20, 1, 20], [Number.NaN, 1, 20]))
      .toEqual({ position: [20, 1, 20], blocked: false, hitId: null });
  });

  it('queries_translationKeepsSurfaceIdentity', () => {
    const world = compilePlanarWorld({
      width: 256,
      depth: 256,
      surfaces: [{
        id: 'seam-road',
        type: 'street',
        routeEdgeId: 'route-seam-road',
        sections: [
          { center: [254, 0, 10], left: [254, 0, 12], right: [254, 0, 8] },
          { center: [258, 0, 10], left: [258, 0, 12], right: [258, 0, 8] },
        ],
      }],
      buildings: [],
      props: [],
      rails: [],
    });
    const canonical = queryPlanarSupport(world, [0, 0.1, 10], {
      maxDrop: 0.2, maxRise: 0.2, previousSurfaceId: 'seam-road',
    });
    const translated = queryPlanarSupport(world, [256, 0.1, 10], {
      maxDrop: 0.2, maxRise: 0.2, previousSurfaceId: 'seam-road',
    });

    expect(canonical?.surfaceId).toBe('seam-road');
    expect(canonical.triangleId).toBe(translated.triangleId);
    expect(canonical.point[0]).toBeCloseTo(translated.point[0] - 256, 8);
    expect(canonical.point[1]).toBeCloseTo(translated.point[1], 8);
    expect(canonical.gravityUp).toEqual([0, 1, 0]);

    const diagonalWorld = compilePlanarWorld({
      width: 256,
      depth: 256,
      surfaces: [{
        id: 'corner-road',
        type: 'street',
        routeEdgeId: 'route-corner-road',
        sections: [
          { center: [254, 0, 254], left: [252.586, 0, 255.414], right: [255.414, 0, 252.586] },
          { center: [258, 0, 258], left: [256.586, 0, 259.414], right: [259.414, 0, 256.586] },
        ],
      }],
      buildings: [],
      props: [],
      rails: [],
    });
    const cornerCanonical = queryPlanarSupport(diagonalWorld, [0, 0.1, 0], {
      maxDrop: 0.2, maxRise: 0.2, previousSurfaceId: 'corner-road',
    });
    const cornerTranslated = queryPlanarSupport(diagonalWorld, [256, 0.1, 256], {
      maxDrop: 0.2, maxRise: 0.2, previousSurfaceId: 'corner-road',
    });
    expect(cornerCanonical?.surfaceId).toBe('corner-road');
    expect(cornerCanonical.triangleId).toBe(cornerTranslated.triangleId);
    expect(cornerCanonical.point[0]).toBeCloseTo(cornerTranslated.point[0] - 256, 8);
    expect(cornerCanonical.point[2]).toBeCloseTo(cornerTranslated.point[2] - 256, 8);
  });

  it('queries_bodyClearsDoglegsAndCanBackAway', () => {
    const world = compilePlanarWorld(createPlanarCityLayout({ assetManifest: manifest }));
    const alley = world.surfaces.find((surface) => surface.id === 'alley-dogleg');
    for (let index = 1; index < alley.centerline.length; index += 1) {
      const before = alley.centerline[index - 1].map((value, axis) => axis === 1 ? 0.5 : value);
      const current = alley.centerline[index].map((value, axis) => axis === 1 ? 0.5 : value);
      const result = sweepPlanarSkater(world, before, current, 0.25);
      expect(result.blocked, `alley segment ${index}`).toBe(false);
    }

    const narrowing = 4;
    const left = alley.vertices[narrowing * 2];
    const right = alley.vertices[narrowing * 2 + 1];
    for (const fraction of [0.2, 0.8]) {
      const point = left.map((value, axis) => value * (1 - fraction) + right[axis] * fraction);
      const support = queryPlanarSupport(world, [point[0], 0.1, point[2]], {
        maxDrop: 0.2, maxRise: 0.2, previousSurfaceId: 'alley-dogleg',
      });
      expect(support?.surfaceId).toBe('alley-dogleg');
    }

    const wall = world.buildings.find((building) => building.id === 'alley-wall-1-left');
    const localZ = wall.collision.axes[2];
    const start = addScaled(wall.collision.center, localZ, -wall.collision.halfExtents[2] + 0.1);
    const away = addScaled(start, localZ, -1);
    const into = addScaled(start, localZ, 1);
    expect(sweepPlanarSkater(world, start, away, 0.25).blocked).toBe(false);
    expect(sweepPlanarSkater(world, start, into, 0.25).blocked).toBe(true);
  });

  it('queries_verticalWallSweepAndLandingSupport', () => {
    const boxWorld = compilePlanarWorld(boxLayout([10, 0, 10], [2, 4, 2]));
    const verticalHit = sweepPlanarSkater(boxWorld, [10, 5, 10], [10, -2, 10], 0);
    const world = compilePlanarWorld(createPlanarCityLayout({ assetManifest: manifest }));
    const rampSupport = queryPlanarSupport(world, [94, 0.45, 166], {
      maxDrop: 0.2, maxRise: 0.2,
    });
    const rail = world.rails[0];
    const railSupport = queryPlanarSupport(world, [rail.points[0][0], 0.9, 172], {
      maxDrop: 0.2, maxRise: 0.2, previousSurfaceId: rail.supportSurfaceId,
    });

    expect(verticalHit.blocked).toBe(true);
    expect(verticalHit.hitId).toBe('seam-wall');
    expect(rampSupport?.surfaceId).toBe('plaza-ramp');
    expect(rampSupport.gravityUp).toEqual([0, 1, 0]);
    expect(Math.hypot(rampSupport.surfaceNormal[0], rampSupport.surfaceNormal[2])).toBeGreaterThan(0.05);
    expect(rampSupport.surfaceNormal[1]).toBeGreaterThan(0);
    expect(railSupport?.surfaceId).toBe(rail.supportSurfaceId);
    expect(railSupport.triangleId).toMatch(/^primary-rail-left:deck:triangle-/);
  });

  it('queries_contactTieKeepsPriorSurface', () => {
    const world = compilePlanarWorld({
      width: 256,
      depth: 256,
      surfaces: [simpleRoute('surface-z'), simpleRoute('surface-a')],
      buildings: [],
      props: [],
      rails: [],
    });
    const previous = queryPlanarSupport(world, [40, 0.025, 40], {
      maxDrop: 0.2, maxRise: 0.2, previousSurfaceId: 'surface-z',
    });
    const stable = queryPlanarSupport(world, [40, 0.025, 40], { maxDrop: 0.2, maxRise: 0.2 });
    const ground = queryPlanarSupport(world, [100, 0.5, 100], { maxDrop: 1, maxRise: 0.2 });
    const cityWorld = compilePlanarWorld(createPlanarCityLayout({ assetManifest: manifest }));
    const roadTie = queryPlanarSupport(cityWorld, [100, 0.5, 30], { maxDrop: 1, maxRise: 1 });

    expect(previous?.surfaceId).toBe('surface-z');
    expect(stable?.surfaceId).toBe('surface-a');
    expect(previous.gravityUp).toEqual([0, 1, 0]);
    expect(ground?.surfaceId).toBe('ground');
    expect(ground?.point).toEqual([100, 0, 100]);
    expect(roadTie?.surfaceId).toBe('street-wrap-x-west');
  });
});
