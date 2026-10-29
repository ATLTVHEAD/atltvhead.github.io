import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createCityLayout } from '../../js/game/world/city-layout.js';
import { compileCityWorld } from '../../js/game/world/city-surfaces.js';
import { createCityScene } from '../../js/game/render/city-scene.js';
import { sweepSkater } from '../../js/game/world/city-queries.js';
import { createCitySkater, stepSkaterOnCity } from '../../js/game/core/city-skater.js';
import { createNeutralInputFrame } from '../../js/game/input/actions.js';
import { createTvheadAvatar } from '../../js/game/render/avatar.js';
import { BUILDING_SCALE, placePlanarCityAssets } from '../../js/game/world/asset-placements.js';

const manifest = JSON.parse(readFileSync(new URL('../../assets/game/manifest.json', import.meta.url)));

describe('visible asset placement', () => {
  it('placements_representativeDoorIsTallerThanAdultAvatar', () => {
    // building-a's front pedestrian door trim: checked against the imported GLB mesh,
    // not the building's overall bounding box. Coordinates are native glTF Y-up.
    const bytes = readFileSync(new URL('../../assets/game/kenney-industrial/building-a.glb', import.meta.url));
    const jsonLength = bytes.readUInt32LE(12);
    const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
    const binaryOffset = 20 + jsonLength + 8;
    const accessor = gltf.accessors[gltf.meshes[0].primitives[0].attributes.POSITION];
    const view = gltf.bufferViews[accessor.bufferView];
    const start = binaryOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const stride = view.byteStride ?? 12;
    const doorVertices = [];
    for (let i = 0; i < accessor.count; i += 1) {
      const x = bytes.readFloatLE(start + i * stride);
      const y = bytes.readFloatLE(start + i * stride + 4);
      const z = bytes.readFloatLE(start + i * stride + 8);
      if (x > -0.82 && x < -0.73 && y >= 0.029 && y <= 0.241 && z < -0.578 && z > -0.580) {
        doorVertices.push(y);
      }
    }
    expect(doorVertices.length).toBeGreaterThan(4);
    const nativeDoorHeight = Math.max(...doorVertices) - Math.min(...doorVertices);
    expect(nativeDoorHeight).toBeCloseTo(0.21, 2);
    const layout = createCityLayout({ seed: 2026, assetManifest: manifest });
    const placement = layout.assetPlacements.find((item) => item.assetId === 'building-a');
    const avatar = new THREE.Box3().setFromObject(createTvheadAvatar(THREE, { color: '#ff006e' }, new Map()));
    const avatarHeight = avatar.max.y - avatar.min.y;
    expect(nativeDoorHeight * placement.scale).toBeGreaterThan(avatarHeight * 1.08);
  });
  it('skater_canEscapeAnImportedBuildingCorner', () => {
    const layout = createCityLayout({ seed: 2026, assetManifest: manifest });
    const world = compileCityWorld(layout);
    const building = world.buildings.find((entry) => entry.id === 'building-3-east');
    const { axes, halfExtents } = building.collision;
    const position = building.position.map((value, i) => value
      + axes[0][i] * (halfExtents[0] + 0.2) + axes[2][i] * (halfExtents[2] + 0.2));
    const radial = new THREE.Vector3(...position).normalize().multiplyScalar(world.radius).toArray();
    let state = { ...createCitySkater(world), position: radial,
      forward: [...axes[2]], mode: 'grounded', surfaceId: 'terrain', groundRadius: world.radius };
    const start = [...state.position];
    for (let tick = 0; tick < 120; tick += 1) {
      state = stepSkaterOnCity(state, { ...createNeutralInputFrame(), throttle: 1 }, 1 / 60, world).state;
    }
    expect(Math.hypot(...state.position.map((value, axis) => value - start[axis]))).toBeGreaterThan(1);
    expect(state.mode).toBe('grounded');
  });
  it('placements_fitCanonicalBuildingBoundsAndKeepRoadsClear', () => {
    const layout = createCityLayout({ seed: 2026, assetManifest: manifest });
    const world = compileCityWorld(layout);
    expect(layout.assetPlacements).toHaveLength(8);
    expect(new Set(layout.assetPlacements.map((placement) => placement.assetId)).size).toBe(8);
    const assets = {
      retain(id) {
        const record = manifest.assets.find((asset) => asset.id === id);
        const size = record.bounds.max.map((value, axis) => value - record.bounds.min[axis]);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial());
        mesh.position.set(...record.bounds.min.map((value, axis) => (value + record.bounds.max[axis]) / 2));
        const group = new THREE.Group(); group.add(mesh); return group;
      },
      release() {},
    };
    const city = createCityScene(THREE, layout, world, assets);
    city.updateMatrixWorld(true);
    for (const building of world.buildings) {
      const renderedBounds = new THREE.Box3().setFromObject(city.getObjectByName(building.id));
      expect(renderedBounds.min.distanceTo(new THREE.Vector3(...building.bounds.min))).toBeLessThan(0.02);
      expect(renderedBounds.max.distanceTo(new THREE.Vector3(...building.bounds.max))).toBeLessThan(0.02);
      expect(building.collision.type).toBe('box');
      const { center, axes, halfExtents } = building.collision;
      const local = (x) => center.map((value, axis) => value + x * axes[0][axis]);
      const hit = sweepSkater(world, local(halfExtents[0] + 1), local(halfExtents[0] - 0.5), 0.25);
      expect(hit.blocked).toBe(true);
      expect(hit.hitId).toBe(building.id);
      const outside = local(halfExtents[0] + 0.3);
      expect(sweepSkater(world, outside, outside, 0.25).blocked).toBe(false);
      const overlap = local(halfExtents[0] + 0.2);
      expect(sweepSkater(world, overlap, outside, 0.25).blocked).toBe(false);
    }
    for (const surface of world.surfaces) {
      for (let index = 0; index < surface.vertices.length; index += 1) {
        const point = surface.vertices[index];
        expect(sweepSkater(world, point, point, 0.25).blocked, `${surface.id} vertex ${index}`).toBe(false);
      }
    }
    expect(world.radius).toBe(32);
  });
});

describe('planar asset placement', () => {
  it('planarPlacements_useHumanScaleBoundsAndConstantUp', () => {
    const layout = placePlanarCityAssets({
      width: 256,
      depth: 256,
      buildings: [{ id: 'facade-a', assetId: 'building-c', position: [10, 0, 20], forward: [1, 0, 0] }],
      props: [{ id: 'container', assetId: 'shipping-container-a', position: [40, 0, 50], forward: [0, 0, 1], scale: 3 }],
    }, manifest);
    const building = layout.buildings[0];
    const prop = layout.props[0];
    const buildingBounds = manifest.assets.find((asset) => asset.id === 'building-c').bounds;

    expect(BUILDING_SCALE).toBe(17);
    expect(building.normal).toEqual([0, 1, 0]);
    expect(building.placement.size).toEqual(buildingBounds.max.map((value, axis) => (
      (value - buildingBounds.min[axis]) * 17
    )));
    expect(building.placement.position).toEqual([10, 0, 20]);
    expect(building.placement.sourceOrigin).toEqual([
      (buildingBounds.min[0] + buildingBounds.max[0]) / 2,
      buildingBounds.min[1],
      (buildingBounds.min[2] + buildingBounds.max[2]) / 2,
    ]);
    expect(building.placement.axes).toEqual([[0, 0, -1], [0, 1, 0], [1, 0, 0]]);
    expect(prop.placement.scale).toBe(3);
    expect(layout.assetPlacements).toHaveLength(2);
  });

  it('planarPlacements_rejectMissingBoundsAndInvalidHeading', () => {
    expect(() => placePlanarCityAssets({ buildings: [{ id: 'bad', assetId: 'missing', position: [0, 0, 0], forward: [0, 0, 1] }] }, manifest))
      .toThrow(/Missing asset bounds: missing/);
    expect(() => placePlanarCityAssets({ buildings: [{ id: 'bad', assetId: 'building-a', position: [0, 0, 0], forward: [0, 0, 0] }] }, manifest))
      .toThrow(/finite planar position and nonzero heading/);
  });

  it('planarPlacements_anchorsFacadeByTrueFootprintToRouteWall', () => {
    const layout = placePlanarCityAssets({
      width: 256,
      depth: 256,
      surfaces: [{
        id: 'alley',
        sections: [
          { center: [0, 0, 0], left: [0, 0, 1], right: [0, 0, -1] },
          { center: [10, 0, 0], left: [10, 0, 1], right: [10, 0, -1] },
        ],
      }],
      buildings: [{ id: 'facade', assetId: 'building-d', wall: {
        surfaceId: 'alley', sectionIndex: 0, side: 'left', alongAxis: 'x', facadeGap: 0.3,
      } }],
    }, manifest);
    const building = layout.buildings[0];

    expect(building.placement.axes[0]).toEqual([1, 0, 0]);
    expect(building.placement.position[1]).toBe(0);
    expect(building.placement.position[2]).toBeCloseTo(1 + building.placement.size[2] / 2 + 0.3);
  });
});
