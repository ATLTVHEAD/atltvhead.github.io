import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createCityLayout } from '../../js/game/world/city-layout.js';
import { compileCityWorld } from '../../js/game/world/city-surfaces.js';
import { querySupport, sweepSkater } from '../../js/game/world/city-queries.js';
import { createCityScene } from '../../js/game/render/city-scene.js';
import {
  advanceAlongSphere,
  makeSurfaceFrame,
  normalize3,
} from '../../js/game/core/planet-math.js';

function vectorFromVertex(vertices, index) {
  return new THREE.Vector3(...vertices[index]);
}

function customLayeredLayout() {
  const centerline = (radius) => [-0.12, 0, 0.12].map((angle) => [
    Math.cos(angle) * radius,
    0,
    Math.sin(angle) * radius,
  ]);
  return {
    radius: 16,
    planetRadius: 16,
    seed: 9,
    surfaces: [
      { id: 'lower', type: 'street', width: 2.4, centerline: centerline(16.28) },
      { id: 'upper', type: 'ramp', width: 2.4, centerline: centerline(16.78) },
    ],
    buildings: [],
    rails: [],
  };
}

describe('compileCityWorld', () => {
  it('support_matchesRenderedTriangles', () => {
    for (const seed of [31, 107, 2026]) {
      const layout = createCityLayout({ radius: 16, seed });
      const world = compileCityWorld(layout);
      const scene = createCityScene(THREE, layout, world);
      scene.updateMatrixWorld(true);
      const raycaster = new THREE.Raycaster();

      for (const type of ['street', 'ramp']) {
        const surface = world.surfaces.find((entry) => entry.type === type);
        const mesh = scene.getObjectByName(`${type}-${surface.id}`);
        const triangleIndex = type === 'ramp'
          ? Math.floor(surface.triangles.length / 2)
          : 0;
        const triangle = surface.triangles[triangleIndex];
        const [aIndex, bIndex, cIndex] = triangle.indices;
        const centroid = vectorFromVertex(surface.vertices, aIndex)
          .add(vectorFromVertex(surface.vertices, bIndex))
          .add(vectorFromVertex(surface.vertices, cIndex))
          .multiplyScalar(1 / 3);
        const gravityUp = centroid.clone().normalize();
        const origin = centroid.clone().addScaledVector(gravityUp, 0.2);
        raycaster.set(origin, gravityUp.clone().negate());
        const renderedHit = raycaster.intersectObject(mesh, false)[0];
        const support = querySupport(world, origin.toArray(), {
          maxDrop: 0.5,
          maxRise: 0.5,
          previousSurfaceId: surface.id,
        });

        expect(renderedHit, `${type} triangle seed ${seed} should be rendered`).toBeDefined();
        expect(support?.surfaceId).toBe(surface.id);
        expect(new THREE.Vector3(...support.point).distanceTo(renderedHit.point)).toBeLessThan(0.02);
        expect(new THREE.Vector3(...support.surfaceNormal).dot(renderedHit.face.normal)).toBeGreaterThan(0.999);
        if (type === 'ramp') {
          expect(new THREE.Vector3(...support.surfaceNormal).dot(new THREE.Vector3(...gravityUp)))
            .toBeLessThan(0.9999);
        }
      }
      scene.traverse((object) => {
        object.geometry?.dispose();
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
        else object.material?.dispose();
      });
    }
  });

  it('compileCityWorld_subdividesRoadWidthAndCachesRailBounds', () => {
    const world = compileCityWorld(createCityLayout({ radius: 16, seed: 22 }));
    const street = world.surfaces.find((surface) => surface.type === 'street');

    expect(street.widthSegments).toBeGreaterThanOrEqual(3);
    expect(street.vertices.length).toBeGreaterThan(street.centerline.length * 2);
    expect(street.indices.length).toBeGreaterThan(0);
    expect(world.rails.every((rail) => rail.totalLength > 0 && rail.bounds.min && rail.bounds.max)).toBe(true);
    expect(world.buildings.every((building) => building.collision.type === 'capsule')).toBe(true);
  });

  it('compileCityWorld_handlesPoleOrientedRouteFrames', () => {
    const layout = {
      radius: 16,
      planetRadius: 16,
      seed: 1,
      surfaces: [{
        id: 'pole-street',
        type: 'street',
        width: 2.4,
        centerline: [
          [0, 16.28, 0],
          [0.12, 16.28, 0],
          [0.24, 16.28, 0],
        ],
      }],
      buildings: [],
      rails: [],
    };
    const world = compileCityWorld(layout);

    expect(world.surfaces[0].vertices.flat().every(Number.isFinite)).toBe(true);
    expect(world.surfaces[0].triangles.length).toBeGreaterThan(0);
  });
});

describe('city contact queries', () => {
  it('sweepSkater_allowsSeparatingFromEitherOverlappingBoxCornerFace', () => {
    const world = compileCityWorld({ radius: 32, surfaces: [], rails: [],
      buildings: [{ id: 'wall', position: [0, 32, 0], normal: [0, 1, 0], size: [2, 5, 2],
        placement: { axes: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] } }] });
    expect(sweepSkater(world, [1.2, 34, 1.2], [1.2, 34, 1.4], 0.25).blocked).toBe(false);
    expect(sweepSkater(world, [1.2, 34, 1.2], [1.4, 34, 1.2], 0.25).blocked).toBe(false);
    expect(sweepSkater(world, [1.2, 34, 1.2], [1.1, 34, 1.1], 0.25).blocked).toBe(true);
  });
  it('sweepSkater_allowsMovingOutOfExistingWallContact', () => {
    const world = compileCityWorld({ radius: 32, surfaces: [], rails: [],
      buildings: [{ id: 'wall', position: [0, 32, 0], normal: [0, 1, 0], size: [2, 5, 2] }] });
    expect(sweepSkater(world, [1.6, 34, 0], [2, 34, 0], 0.25).blocked).toBe(false);
    expect(sweepSkater(world, [1.6, 34, 0], [1.4, 34, 0], 0.25).blocked).toBe(true);
  });
  it('querySupport_prefersNearestVerticallySeparatedSurface', () => {
    const world = compileCityWorld(customLayeredLayout());
    const position = [16.92, 0, 0];
    const hit = querySupport(world, position, { maxDrop: 1, maxRise: 1 });

    expect(hit.surfaceId).toBe('upper');
    expect(hit.clearance).toBeCloseTo(16.92 - 16.805, 1);
  });

  it('querySupport_keepsPreviousSurfaceAtRouteJoinTie', () => {
    const world = compileCityWorld(createCityLayout({ radius: 16, seed: 10 }));
    const previous = world.surfaces[0];
    const position = previous.centerline[0].map((value, axis) => (
      value + value / Math.hypot(...previous.centerline[0]) * 0.1
    ));
    const hit = querySupport(world, position, {
      maxDrop: 1,
      maxRise: 1,
      previousSurfaceId: 'street-11',
    });

    expect(hit.surfaceId).toBe('street-11');
  });

  it('querySupport_hasNoWalkableGapAcrossAConnectedRoadJoin', () => {
    const layout = createCityLayout({ radius: 16, seed: 31 });
    const world = compileCityWorld(layout);
    const incoming = layout.surfaces[0];
    const outgoing = layout.surfaces[1];
    const join = outgoing.centerline[0];
    const previous = incoming.centerline.at(-2);
    const next = outgoing.centerline[1];
    const incomingForward = normalize3(previous.map((value, axis) => join[axis] - value));
    const outgoingForward = normalize3(next.map((value, axis) => value - join[axis]));
    const normal = normalize3(join);
    const incomingRight = makeSurfaceFrame(normal, incomingForward).right;
    const outgoingRight = makeSurfaceFrame(normal, outgoingForward).right;
    const bisector = normalize3(incomingRight.map((value, axis) => value + outgoingRight[axis]));
    const roadRadius = Math.hypot(...join) + 0.025;

    for (const lateral of [-1.3, -0.65, 0, 0.65, 1.3]) {
      const point = advanceAlongSphere(join, bisector, lateral, roadRadius);
      const pointUp = normalize3(point);
      const query = point.map((value, axis) => value + pointUp[axis] * 0.1);
      const support = querySupport(world, query, { maxDrop: 0.2, maxRise: 0.2 });
      expect(support?.surfaceId).not.toBe('terrain');
      expect(Math.abs(support.clearance - 0.1)).toBeLessThan(0.02);
    }
  });

  it('querySupport_usesSafeSphereTerrainOutsideRoadsAndBuildings', () => {
    const world = compileCityWorld(createCityLayout({ radius: 16, seed: 8 }));
    const building = world.buildings[4];
    const buildingFoot = building.position.map((value, axis) => value + building.normal[axis] * 0.1);
    const buildingHit = querySupport(world, buildingFoot, {
      maxDrop: 0.5,
      maxRise: 1,
    });
    const poleHit = querySupport(world, [0, 18, 0], { maxDrop: 4, maxRise: 1 });

    expect(buildingHit.surfaceId).toBe('terrain');
    expect(sweepSkater(world, buildingFoot, buildingFoot, 0.25).blocked).toBe(true);
    expect(poleHit.surfaceId).toBe('terrain');
    expect(poleHit.point).toEqual([0, 16, 0]);
  });

  it('sweepSkater_detectsAnInflatedBuildingCrossedInOneTick', () => {
    const world = compileCityWorld(createCityLayout({ radius: 16, seed: 14 }));
    const building = world.buildings[3];
    const normal = building.normal;
    const tangent = [normal[2], 0, -normal[0]];
    const tangentLength = Math.hypot(...tangent);
    const direction = tangent.map((value) => value / tangentLength);
    const from = building.position.map((value, axis) => value - direction[axis] * 4);
    const to = building.position.map((value, axis) => value + direction[axis] * 4);
    const result = sweepSkater(world, from, to, 0.25);

    expect(result.blocked).toBe(true);
    expect(result.hitId).toBe(building.id);
    expect(result.position).not.toEqual(to);
  });
});
