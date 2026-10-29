import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREEBase from 'three';
import { readFileSync } from 'node:fs';
import { createPlanarCityLayout } from '../../js/game/world/planar-city-layout.js';
import { compilePlanarWorld } from '../../js/game/world/planar-city-surfaces.js';
import { createPlanarCityScene } from '../../js/game/render/planar-city-scene.js';

const THREE = { ...THREEBase };
globalThis.THREE = THREE;
await import('../../lib/game/BufferGeometryUtils.js?planar-city-scene-unit');

const manifest = JSON.parse(readFileSync(new URL('../../assets/game/manifest.json', import.meta.url)));
const layout = createPlanarCityLayout({ assetManifest: manifest });
const world = compilePlanarWorld(layout);

function fakeAssets({ failAt = Infinity } = {}) {
  const templates = new Map();
  const retained = new Set();
  const released = [];
  const sourceDisposals = { geometries: 0, materials: 0 };
  let retainCalls = 0;

  for (const asset of manifest.assets) {
    const { min, max } = asset.bounds;
    const size = max.map((value, axis) => value - min[axis]);
    const geometry = new THREE.BoxGeometry(...size);
    const material = new THREE.MeshStandardMaterial({ color: '#9aa3b7' });
    geometry.addEventListener('dispose', () => { sourceDisposals.geometries += 1; });
    material.addEventListener('dispose', () => { sourceDisposals.materials += 1; });
    const model = new THREE.Group();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(
      (min[0] + max[0]) / 2,
      (min[1] + max[1]) / 2,
      (min[2] + max[2]) / 2,
    );
    model.add(mesh);
    templates.set(asset.id, model);
  }

  return {
    manifest,
    retain(id) {
      retainCalls += 1;
      if (retainCalls === failAt) throw new Error(`retain failed at ${id}`);
      const template = templates.get(id);
      if (!template) throw new Error(`unknown fixture asset ${id}`);
      const instance = template.clone(true);
      retained.add(instance);
      return instance;
    },
    release(instance) {
      if (retained.delete(instance)) released.push(instance);
    },
    get retainedCount() { return retained.size; },
    get retainCalls() { return retainCalls; },
    released,
    sourceDisposals,
    templates,
  };
}

function tileGroups(scene) {
  return scene.children.filter((child) => child.userData?.tileOffset);
}

function batchMeshes(tile) {
  return tile.children.filter((child) => child.isMesh && child.userData.cityFeature === 'imported-assets');
}

function placedBounds(assets, record, tileOffset = [0, 0, 0]) {
  const placement = record.placement;
  const model = assets.retain(placement.assetId);
  model.scale.setScalar(placement.scale);
  model.position.set(...placement.sourceOrigin.map((value) => -value * placement.scale));
  const root = new THREE.Group();
  root.position.set(...placement.position.map((value, axis) => value + tileOffset[axis]));
  root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    ...placement.axes.map((axis) => new THREE.Vector3(...axis)),
  ));
  root.add(model);
  root.updateMatrixWorld(true);
  return { bounds: new THREE.Box3().setFromObject(root), model };
}

afterEach(() => vi.restoreAllMocks());

describe('planar city rendering and ownership', () => {
  it('scene_nineTilesShareGeometryAndUseCanonicalTransforms', () => {
    const assets = fakeAssets();
    const city = createPlanarCityScene(THREE, layout, world, assets);
    const tiles = tileGroups(city);
    const offsets = tiles.map((tile) => [...tile.userData.tileOffset]).sort((a, b) => (
      a[0] - b[0] || a[1] - b[1]
    ));
    const expectedOffsets = [-1, 0, 1].flatMap((ix) => [-1, 0, 1].map((iz) => [ix, iz]))
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const central = tiles.find((tile) => tile.userData.tileOffset[0] === 0
      && tile.userData.tileOffset[1] === 0);
    const western = tiles.find((tile) => tile.userData.tileOffset[0] === -1
      && tile.userData.tileOffset[1] === 0);
    const centerBatches = batchMeshes(central);
    const westBatches = batchMeshes(western);

    expect(tiles).toHaveLength(9);
    expect(offsets).toEqual(expectedOffsets);
    for (const tile of tiles) {
      const [ix, iz] = tile.userData.tileOffset;
      expect(tile.position.toArray()).toEqual([ix * 256, 0, iz * 256]);
      expect(tile.children.some((child) => child.userData.cityFeature === 'surface')).toBe(true);
      expect(tile.children.some((child) => child.userData.cityFeature === 'ramp')).toBe(true);
      expect(tile.children.some((child) => child.userData.cityFeature === 'rail')).toBe(true);
    }
    expect(centerBatches.length).toBeGreaterThan(0);
    expect(westBatches).toHaveLength(centerBatches.length);
    for (let index = 0; index < centerBatches.length; index += 1) {
      expect(westBatches[index].geometry).toBe(centerBatches[index].geometry);
      expect(westBatches[index].material).toBe(centerBatches[index].material);
      expect(centerBatches[index].userData.assetIds.length).toBeGreaterThan(0);
    }
    expect(assets.retainedCount).toBe((layout.buildings.length + layout.props.length) * 9);

    const building = world.buildings.find((record) => record.placement.assetId === 'building-a');
    const actualCenter = placedBounds(assets, building);
    const actualWest = placedBounds(assets, building, [-256, 0, 0]);
    const expectedMin = new THREE.Vector3(...building.bounds.min);
    const expectedMax = new THREE.Vector3(...building.bounds.max);
    expect(actualCenter.bounds.min.distanceTo(expectedMin)).toBeLessThan(0.02);
    expect(actualCenter.bounds.max.distanceTo(expectedMax)).toBeLessThan(0.02);
    expect(actualWest.bounds.min.distanceTo(expectedMin.clone().add(new THREE.Vector3(-256, 0, 0))))
      .toBeLessThan(0.02);
    expect(actualWest.bounds.max.distanceTo(expectedMax.clone().add(new THREE.Vector3(-256, 0, 0))))
      .toBeLessThan(0.02);
    assets.release(actualCenter.model);
    assets.release(actualWest.model);
    city.dispose();
  });

  it('scene_attachmentSeamCopiesAreIdempotent', () => {
    const assets = fakeAssets();
    const city = createPlanarCityScene(THREE, layout, world, assets);
    const source = new THREE.Group();
    source.name = 'seam-marker';
    source.position.set(255.8, 1, 30);
    source.rotation.y = Math.PI / 5;
    source.scale.set(1.1, 0.9, 1.2);
    source.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2),
      new THREE.MeshBasicMaterial({ color: '#ff00ff' })));
    const attachedGeometry = source.children[0].geometry;
    const attachedMaterial = source.children[0].material;
    let attachedDisposals = 0;
    attachedGeometry.addEventListener('dispose', () => { attachedDisposals += 1; });
    attachedMaterial.addEventListener('dispose', () => { attachedDisposals += 1; });

    expect(city.attach(source)).toBe(source);
    const tiles = tileGroups(city);
    const firstCopies = tiles.map((tile) => tile.children.find((child) => (
      child.userData.replicatedSourceId === source.uuid
    )));
    expect(firstCopies.every(Boolean)).toBe(true);
    expect(firstCopies.every((copy) => copy.children[0].geometry === attachedGeometry)).toBe(true);
    expect(firstCopies.every((copy) => copy.children[0].material === attachedMaterial)).toBe(true);
    source.updateWorldMatrix(true, true);
    city.updateMatrixWorld(true);
    for (let index = 0; index < tiles.length; index += 1) {
      const expectedMatrix = tiles[index].matrixWorld.clone().multiply(source.matrixWorld);
      expect(firstCopies[index].matrixWorld.elements.every((value, matrixIndex) => (
        Math.abs(value - expectedMatrix.elements[matrixIndex]) < 1e-8
      ))).toBe(true);
    }
    city.attach(source);
    expect(tiles.map((tile) => tile.children.find((child) => (
      child.userData.replicatedSourceId === source.uuid
    )))).toEqual(firstCopies);

    source.position.x = 2;
    source.add(new THREE.Mesh(new THREE.SphereGeometry(0.1), attachedMaterial));
    city.attach(source);
    const refreshed = tiles.map((tile) => tile.children.find((child) => (
      child.userData.replicatedSourceId === source.uuid
    )));
    expect(refreshed.every((copy, index) => copy && copy !== firstCopies[index])).toBe(true);
    expect(refreshed.every((copy) => copy.children.length === 2)).toBe(true);
    source.remove(source.children[1]);
    city.attach(source);
    expect(tiles.every((tile) => tile.children.find((child) => (
      child.userData.replicatedSourceId === source.uuid
    ))?.children.length === 1)).toBe(true);

    city.detach(source);
    expect(tiles.every((tile) => tile.children.every((child) => (
      child.userData.replicatedSourceId !== source.uuid
    )))).toBe(true);
    expect(attachedDisposals).toBe(0);
    city.dispose();
    expect(attachedDisposals).toBe(0);
  });

  it('scene_disposalReleasesEveryRetainExactlyOnce', () => {
    const assets = fakeAssets();
    const city = createPlanarCityScene(THREE, layout, world, assets);
    const allMeshes = tileGroups(city).flatMap((tile) => tile.children.filter((child) => child.isMesh));
    const ownedGeometry = new Set(allMeshes.map((mesh) => mesh.geometry));
    const ownedMaterials = new Set(allMeshes
      .filter((mesh) => ['surface', 'ramp', 'rail'].includes(mesh.userData.cityFeature))
      .flatMap((mesh) => Array.isArray(mesh.material) ? mesh.material : [mesh.material]));
    const geometryDisposals = new Map([...ownedGeometry].map((geometry) => {
      let count = 0;
      geometry.addEventListener('dispose', () => { count += 1; });
      return [geometry, () => count];
    }));
    const materialDisposals = new Map([...ownedMaterials].map((material) => {
      let count = 0;
      material.addEventListener('dispose', () => { count += 1; });
      return [material, () => count];
    }));

    city.dispose();
    city.dispose();

    expect(assets.retainedCount).toBe(0);
    expect(assets.released).toHaveLength((layout.buildings.length + layout.props.length) * 9);
    expect(new Set(assets.released).size).toBe(assets.released.length);
    expect([...geometryDisposals.values()].every((count) => count() === 1)).toBe(true);
    expect([...materialDisposals.values()].every((count) => count() === 1)).toBe(true);
    expect(assets.sourceDisposals).toEqual({ geometries: 0, materials: 0 });
    expect(tileGroups(city)).toHaveLength(0);
  });

  it('scene_partialBuildFailureDoesNotLeak', () => {
    const assets = fakeAssets({ failAt: 10 });
    const geometryDispose = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
    const materialDispose = vi.spyOn(THREE.Material.prototype, 'dispose');

    expect(() => createPlanarCityScene(THREE, layout, world, assets)).toThrow(/retain failed/);
    expect(assets.retainCalls).toBe(10);
    expect(assets.retainedCount).toBe(0);
    expect(assets.released).toHaveLength(9);
    expect(geometryDispose).toHaveBeenCalledTimes(2);
    expect(materialDispose).toHaveBeenCalled();
    expect(assets.sourceDisposals).toEqual({ geometries: 0, materials: 0 });
  });
});
