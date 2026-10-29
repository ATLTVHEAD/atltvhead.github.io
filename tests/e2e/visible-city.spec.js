import { test, expect } from '@playwright/test';

test('visibleCity_rendersRealKenneyBuildingsAtCanonicalBounds', async ({ page }) => {
  await page.goto('/skate.html');
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'ready');
  const result = await page.evaluate(() => {
    const { skateGame: game, THREE } = window;
    game.city.updateMatrixWorld(true);
    const buildings = game.city.children.filter((object) => object.userData.assetId);
    let maxBoundsGap = 0;
    let meshCount = 0;
    for (const building of buildings) {
      const canonical = game.world.buildings.find((record) => record.id === building.userData.buildingId);
      const actual = new THREE.Box3().setFromObject(building);
      maxBoundsGap = Math.max(maxBoundsGap,
        actual.min.distanceTo(new THREE.Vector3(...canonical.bounds.min)),
        actual.max.distanceTo(new THREE.Vector3(...canonical.bounds.max)));
      building.traverse((object) => { if (object.isMesh) meshCount += 1; });
    }
    return { count: buildings.length, variants: new Set(buildings.map((b) => b.userData.assetId)).size,
      meshCount, maxBoundsGap, radius: game.world.radius, geometry: game.world.descriptor.geometry };
  });
  expect(result.count).toBe(8);
  expect(result.variants).toBe(8);
  expect(result.meshCount).toBeGreaterThanOrEqual(8);
  expect(result.maxBoundsGap).toBeLessThan(0.02);
  expect(result.radius).toBe(32);
  expect(result.geometry).toBe('kenney-industrial-v1');
  await page.screenshot({ path: 'artifacts/skate-progress/visible-kenney-preview.png' });
  await page.getByRole('button', { name: 'Join City' }).click();
  await page.screenshot({ path: 'artifacts/skate-progress/visible-kenney-chase.png' });
});

test('visibleCity_disposeOneScenePreservesSharedAssetPeers', async ({ page }) => {
  await page.goto('/skate.html');
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'ready');
  const result = await page.evaluate(async () => {
    const { createCityScene, disposeCityScene } = await import('/js/game/render/city-scene.js');
    const { skateGame: game, THREE } = window;
    const peer = createCityScene(THREE, game.layout, game.world, game.assets);
    const template = game.assets.get('building-a').scene;
    let prematureDisposals = 0;
    template.traverse((object) => {
      object.geometry?.addEventListener('dispose', () => { prematureDisposals += 1; });
    });
    disposeCityScene(peer, game.assets);
    game.renderer.render(game.scene, game.camera);
    const calls = game.renderer.info.render.calls;
    return { prematureDisposals, calls };
  });
  expect(result.prematureDisposals).toBe(0);
  expect(result.calls).toBeGreaterThan(0);
});

test('visibleCity_capturesAdultDoorScaleComparison', async ({ page }) => {
  await page.goto('/skate.html');
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'ready');
  await page.evaluate(async () => {
    const { skateGame: game, THREE } = window;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#242437');
    scene.add(new THREE.HemisphereLight('#ffffff', '#888899', 2));
    const building = game.assets.retain('building-a');
    const placement = game.layout.assetPlacements.find((item) => item.assetId === 'building-a');
    building.scale.setScalar(placement.scale);
    // Center the measured pedestrian door for an offline visual comparison.
    building.position.set(0.777478 * placement.scale, 0, 0.619 * placement.scale);
    scene.add(building);
    const { createTvheadAvatar } = await import('/js/game/render/avatar.js');
    const avatar = createTvheadAvatar(THREE, { color: '#ff006e' }, new Map());
    avatar.position.set(-2.5, 0, -0.7);
    avatar.quaternion.identity();
    scene.add(avatar);
    const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 200);
    camera.position.set(3, 4.2, -13);
    camera.lookAt(0, 1.6, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(1280, 720);
    renderer.domElement.id = 'scale-comparison';
    document.body.append(renderer.domElement);
    renderer.render(scene, camera);
    game.assets.release(building);
  });
  await page.locator('#scale-comparison').screenshot({ path: 'artifacts/skate-progress/adult-door-scale.png' });
});
