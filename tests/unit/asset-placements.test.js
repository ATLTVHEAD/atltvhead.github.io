import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createCityLayout } from '../../js/game/world/city-layout.js';
import { compileCityWorld } from '../../js/game/world/city-surfaces.js';
import { createCityScene } from '../../js/game/render/city-scene.js';
import { sweepSkater } from '../../js/game/world/city-queries.js';
import { createCitySkater, stepSkaterOnCity } from '../../js/game/core/city-skater.js';
import { createNeutralInputFrame } from '../../js/game/input/actions.js';

const manifest = JSON.parse(readFileSync(new URL('../../assets/game/manifest.json', import.meta.url)));

describe('visible asset placement', () => {
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
    expect(layout.assetPlacements).toHaveLength(24);
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
