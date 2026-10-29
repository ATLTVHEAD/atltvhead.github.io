import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createPlanarCityLayout } from '../../js/game/world/planar-city-layout.js';
import { compilePlanarWorld } from '../../js/game/world/planar-city-surfaces.js';

const manifest = JSON.parse(readFileSync(new URL('../../assets/game/manifest.json', import.meta.url)));
const subtract = (a, b) => a.map((value, axis) => value - b[axis]);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

function surfaceTriangleArea(triangle) {
  return Math.hypot(...cross(subtract(triangle.points[1], triangle.points[0]),
    subtract(triangle.points[2], triangle.points[0]))) / 2;
}

function expectedBounds(center, axes, halfExtents) {
  const corners = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    corners.push([0, 1, 2].map((axis) => center[axis]
      + x * axes[0][axis] * halfExtents[0]
      + y * axes[1][axis] * halfExtents[1]
      + z * axes[2][axis] * halfExtents[2]));
  }
  return {
    min: [0, 1, 2].map((axis) => Math.min(...corners.map((point) => point[axis]))),
    max: [0, 1, 2].map((axis) => Math.max(...corners.map((point) => point[axis]))),
  };
}

describe('compilePlanarWorld surfaces', () => {
  it('surfaces_variableWidthsAndJunctionsHaveNoGaps', () => {
    const layout = createPlanarCityLayout({ assetManifest: manifest });
    const world = compilePlanarWorld(layout);
    const street = world.surfaces.find((surface) => surface.id === 'street-wrap-x-west');
    const sourceStreet = layout.surfaces.find((surface) => surface.id === street.id);
    const alley = world.surfaces.find((surface) => surface.id === 'alley-dogleg');
    const plaza = world.surfaces.find((surface) => surface.id === 'plaza-central');

    expect(world.width).toBe(256);
    expect(world.depth).toBe(256);
    expect(world.descriptor.topology).toBe('torus');
    expect(world.descriptor.width).toBe(256);
    expect(world.descriptor.depth).toBe(256);
    expect(Object.hasOwn(world.descriptor, 'radius')).toBe(false);
    expect(street.routeEdgeId).toBe(sourceStreet.routeEdgeId);
    expect(street.centerline).toEqual(sourceStreet.sections.map((section) => section.center));
    expect(street.widths).toHaveLength(sourceStreet.sections.length);
    expect(Math.max(...alley.widths.map((width) => width.left + width.right))
      - Math.min(...alley.widths.map((width) => width.left + width.right))).toBeGreaterThanOrEqual(0.6);
    for (const [index, section] of sourceStreet.sections.entries()) {
      expect(street.vertices[index * 2]).toEqual(section.left);
      expect(street.vertices[index * 2 + 1]).toEqual(section.right);
    }
    expect(street.triangles.length).toBeGreaterThan(0);
    expect(plaza.triangles).toHaveLength(2);
    expect(world.surfaces.some((surface) => surface.id === 'junction-alley-entry')).toBe(true);
    expect(world.joins.some((join) => join.nodeId === 'alley-start'
      && join.surfaceIds.includes('street-wrap-x-west')
      && join.surfaceIds.includes('alley-dogleg'))).toBe(true);
    expect(world.joins.some((join) => join.nodeId === 'plaza-node'
      && join.surfaceIds.includes('street-plaza-connector'))).toBe(true);
    expect(world.surfaces.flatMap((surface) => surface.triangles)
      .every((triangle) => surfaceTriangleArea(triangle) > 1e-10)).toBe(true);
    expect(world.surfaces.flatMap((surface) => surface.triangles)
      .every((triangle) => triangle.normal.every(Number.isFinite)
        && triangle.tangent.every(Number.isFinite))).toBe(true);
  });

  it('surfaces_rampNormalsMatchSlope', () => {
    const world = compilePlanarWorld(createPlanarCityLayout({ assetManifest: manifest }));
    const ramp = world.surfaces.find((surface) => surface.id === 'plaza-ramp');
    const rampNormals = ramp.triangles.map((triangle) => triangle.normal);

    expect(ramp.triangles.length).toBeGreaterThan(0);
    expect(rampNormals.every((normal) => normal[1] > 0)).toBe(true);
    expect(rampNormals.some((normal) => Math.hypot(normal[0], normal[2]) > 0.05)).toBe(true);
    expect(Math.max(...ramp.centerline.map((point) => point[1]))).toBeCloseTo(0.745, 8);
  });

  it('surfaces_collisionAndManifestTransformsAgree', () => {
    const layout = createPlanarCityLayout({ assetManifest: manifest });
    const world = compilePlanarWorld(layout);
    const objects = [...world.buildings, ...world.props];
    let maxBoundsDifference = 0;

    for (const object of objects) {
      const placement = object.placement;
      const expectedCenter = placement.position.map((value, axis) => (
        value + placement.axes[1][axis] * placement.size[1] / 2
      ));
      const expectedHalfExtents = placement.size.map((value) => value / 2);
      expect(object.collision.type).toBe('box');
      expect(object.collision.center).toEqual(expectedCenter);
      expect(object.collision.axes).toEqual(placement.axes);
      expect(object.collision.halfExtents).toEqual(expectedHalfExtents);
      const bounds = expectedBounds(expectedCenter, placement.axes, expectedHalfExtents);
      for (const axis of [0, 1, 2]) {
        maxBoundsDifference = Math.max(maxBoundsDifference,
          Math.abs(bounds.min[axis] - object.bounds.min[axis]),
          Math.abs(bounds.max[axis] - object.bounds.max[axis]));
      }
    }

    expect(maxBoundsDifference).toBeLessThan(0.02);
    expect(world.buildings).toHaveLength(layout.buildings.length);
    expect(world.props).toHaveLength(layout.props.length);
    expect(world.routeGraph).toEqual(layout.routeGraph);
    expect(world.spawnPoints).toEqual(layout.spawnPoints);
    expect(world.defaultSpawnId).toBe('spawn-plaza');

    const decks = world.surfaces.filter((surface) => surface.type === 'rail-deck');
    expect(decks).toHaveLength(2);
    expect(decks.every((deck) => deck.width === 0.9
      && deck.vertices.every((point) => point[1] === 0.82)
      && deck.routeEdgeId === 'route-plaza-ramp')).toBe(true);
    expect(world.rails.every((rail) => rail.totalLength === 24 && rail.supportSurfaceId)).toBe(true);
  });
});
