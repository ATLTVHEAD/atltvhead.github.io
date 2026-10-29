import { test, expect } from '@playwright/test';

test('planarRender_realAssetsRepeatAcrossNineTilesWithVisibleContacts', async ({ page }) => {
  await page.goto('/skate.html');
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'ready');
  const result = await page.evaluate(async () => {
    const { skateGame: game, THREE } = window;
    const [{ createPlanarCityLayout }, { compilePlanarWorld }, { createPlanarCityScene }] = await Promise.all([
      import('/js/game/world/planar-city-layout.js'),
      import('/js/game/world/planar-city-surfaces.js'),
      import('/js/game/render/planar-city-scene.js'),
    ]);
    const layout = createPlanarCityLayout({ assetManifest: game.assets.manifest });
    const world = compilePlanarWorld(layout);
    const originalRetain = game.assets.retain;
    let retainedAssetInstanceCount = 0;
    game.assets.retain = function retainForMeasurement(assetId) {
      retainedAssetInstanceCount += 1;
      return originalRetain.call(game.assets, assetId);
    };
    let city;
    try {
      city = createPlanarCityScene(THREE, layout, world, game.assets);
    } finally {
      game.assets.retain = originalRetain;
    }
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#22263a');
    scene.add(new THREE.HemisphereLight('#d7e4ff', '#41354b', 2));
    const key = new THREE.DirectionalLight('#fff2dc', 2.2);
    key.position.set(18, 35, 12);
    scene.add(key);
    scene.add(city);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(900, 700);
    renderer.domElement.id = 'planar-city-render';
    document.body.append(renderer.domElement);

    const centralCamera = new THREE.PerspectiveCamera(55, 900 / 700, 0.1, 512);
    centralCamera.position.set(103, 40, 130);
    centralCamera.lookAt(105, 0, 130);
    renderer.render(scene, centralCamera);
    const centralRender = {
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
    };
    const screenshot = renderer.domElement.toDataURL('image/png');

    const seamCamera = new THREE.PerspectiveCamera(70, 900 / 700, 0.1, 80);
    seamCamera.position.set(1, 15, 30);
    seamCamera.lookAt(1, 0, 30);
    renderer.render(scene, seamCamera);
    const seamRender = {
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
    };

    const tiles = city.children.filter((child) => child.userData.tileOffset);
    const assetBatches = tiles.flatMap((tile) => tile.children.filter((child) => (
      child.isMesh && child.userData.cityFeature === 'imported-assets'
    )));
    const sharedGeometry = tiles.every((tile) => {
      const meshes = tile.children.filter((child) => (
        child.isMesh && child.userData.cityFeature === 'imported-assets'
      ));
      const center = tiles.find((candidate) => candidate.userData.tileOffset[0] === 0
        && candidate.userData.tileOffset[1] === 0);
      const canonical = center.children.filter((child) => (
        child.isMesh && child.userData.cityFeature === 'imported-assets'
      ));
      return meshes.length === canonical.length
        && meshes.every((mesh, index) => mesh.geometry === canonical[index].geometry);
    });
    const features = [...new Set(tiles.flatMap((tile) => tile.children
      .map((child) => child.userData.cityFeature).filter(Boolean)))];
    const assetIds = [...new Set(assetBatches.flatMap((mesh) => mesh.userData.assetIds ?? []))];
    let unclassifiedMeshCount = 0;
    city.traverse((object) => {
      if (object.isMesh && !object.userData.cityFeature) unclassifiedMeshCount += 1;
    });
    const building = world.buildings.find((record) => record.placement.assetId === 'building-a');
    const placement = building.placement;
    const model = game.assets.retain(placement.assetId);
    model.scale.setScalar(placement.scale);
    model.position.set(...placement.sourceOrigin.map((value) => -value * placement.scale));
    const placed = new THREE.Group();
    placed.position.set(...placement.position);
    placed.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
      ...placement.axes.map((axis) => new THREE.Vector3(...axis)),
    ));
    placed.add(model);
    placed.updateMatrixWorld(true);
    const canonicalBounds = new THREE.Box3().setFromObject(placed);
    const westCopy = placed.clone(true);
    westCopy.position.x -= 256;
    westCopy.updateMatrixWorld(true);
    const westBounds = new THREE.Box3().setFromObject(westCopy);
    const expectedMin = new THREE.Vector3(...building.bounds.min);
    const expectedMax = new THREE.Vector3(...building.bounds.max);
    game.assets.release(model);

    city.updateMatrixWorld(true);
    const tileOffsets = tiles.map((tile) => tile.userData.tileOffset);
    city.dispose();
    renderer.dispose();
    renderer.domElement.remove();
    return {
      tileOffsets,
      retainedAssetInstanceCount,
      expectedRetainedAssetInstanceCount: (layout.buildings.length + layout.props.length) * 9,
      assetBatchCount: assetBatches.length,
      assetIds,
      sharedGeometry,
      unclassifiedMeshCount,
      features,
      centralRender,
      seamRender,
      canonicalBoundsGap: Math.max(
        canonicalBounds.min.distanceTo(expectedMin),
        canonicalBounds.max.distanceTo(expectedMax),
      ),
      westBoundsGap: Math.max(
        westBounds.min.distanceTo(expectedMin.clone().add(new THREE.Vector3(-256, 0, 0))),
        westBounds.max.distanceTo(expectedMax.clone().add(new THREE.Vector3(-256, 0, 0))),
      ),
      screenshot,
    };
  });

  expect(result.tileOffsets).toHaveLength(9);
  expect(result.retainedAssetInstanceCount).toBe(result.expectedRetainedAssetInstanceCount);
  expect(result.assetBatchCount).toBeGreaterThan(0);
  expect(result.assetIds).toContain('building-a');
  expect(result.assetIds).toContain('shipping-container-a');
  expect(result.sharedGeometry).toBe(true);
  expect(result.unclassifiedMeshCount).toBe(0);
  expect(result.features).toContain('ramp');
  expect(result.features).toContain('rail');
  expect(result.features).toContain('tag-panel');
  expect(result.features).toContain('launch-marker');
  expect(result.canonicalBoundsGap).toBeLessThan(0.02);
  expect(result.westBoundsGap).toBeLessThan(0.02);
  expect(result.centralRender.calls).toBeGreaterThan(0);
  expect(result.centralRender.calls).toBeLessThanOrEqual(150);
  expect(result.centralRender.triangles).toBeGreaterThan(0);
  expect(result.seamRender.calls).toBeGreaterThan(0);
  expect(result.seamRender.triangles).toBeGreaterThan(0);
  console.info('PLANAR_RENDER_METRICS', JSON.stringify({
    retainedAssetInstances: result.retainedAssetInstanceCount,
    assetMeshInstances: result.assetBatchCount,
    central: result.centralRender,
    seam: result.seamRender,
  }));
  await page.evaluate((image) => {
    const output = document.createElement('img');
    output.id = 'planar-city-screenshot';
    output.src = image;
    document.body.append(output);
  }, result.screenshot);
  await page.locator('#planar-city-screenshot').screenshot({
    path: 'artifacts/skate-progress/planar-city-render.png',
  });
});
