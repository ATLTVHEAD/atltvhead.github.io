import { expect, test } from '@playwright/test';

test('cityWorld_rendersCurvedStreetsRampsAndRails', async ({ page }) => {
  await page.goto('/skate.html');

  const result = await page.evaluate(async () => {
    const { createCityLayout } = await import('/js/game/world/city-layout.js');
    const { createCityScene } = await import('/js/game/render/city-scene.js');
    const layout = createCityLayout({ radius: 16, seed: 21 });
    const city = createCityScene(window.THREE, layout);
    const counts = {};

    city.traverse((object) => {
      const feature = object.userData.cityFeature;
      if (feature) counts[feature] = (counts[feature] ?? 0) + 1;
    });

    const street = city.children.find((object) => object.userData.cityFeature === 'street');
    const ramp = city.children.find((object) => object.userData.cityFeature === 'ramp');
    const building = city.children.find((object) => object.userData.cityFeature === 'building');
    const rail = city.children.find((object) => object.userData.cityFeature === 'rail');
    const roadVertex = street.geometry.attributes.position;
    const buildingNormal = new window.THREE.Vector3(...building.userData.surfaceNormal).normalize();
    const buildingPosition = new window.THREE.Vector3(...building.userData.basePosition).normalize();

    const canvas = document.querySelector('#game-canvas');
    const renderer = new window.THREE.WebGLRenderer({ canvas, antialias: false });
    renderer.setSize(640, 480, false);
    const scene = new window.THREE.Scene();
    scene.background = new window.THREE.Color('#11111c');
    scene.add(city);

    const camera = new window.THREE.PerspectiveCamera(48, 640 / 480, 0.1, 120);
    camera.position.set(0, 0, 38);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    const firstViewTriangles = renderer.info.render.triangles;

    camera.position.set(-38, 0, 0);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    const secondViewTriangles = renderer.info.render.triangles;
    renderer.dispose();

    return {
      counts,
      firstViewTriangles,
      secondViewTriangles,
      planetRadius: layout.planetRadius,
      surfaceRadius: Math.hypot(...layout.surfaces[0].centerline[5]),
      streetMeshRadius: Math.hypot(roadVertex.getX(0), roadVertex.getY(0), roadVertex.getZ(0)),
      rampPeakRadius: Math.max(...ramp.userData.centerline.map((point) => Math.hypot(...point))),
      buildingBaseRadius: Math.hypot(...building.userData.basePosition),
      buildingNormalAlignment: buildingNormal.dot(buildingPosition),
      railRadius: Math.hypot(...rail.userData.points[0]),
    };
  });

  expect(result.counts.planet).toBe(1);
  expect(result.counts.street).toBeGreaterThan(0);
  expect(result.counts.ramp).toBeGreaterThan(0);
  expect(result.counts.building).toBeGreaterThan(0);
  expect(result.counts.rail).toBeGreaterThan(0);
  expect(result.firstViewTriangles).toBeGreaterThan(0);
  expect(result.secondViewTriangles).toBeGreaterThan(0);
  expect(result.surfaceRadius).toBeGreaterThan(result.planetRadius);
  expect(result.streetMeshRadius).toBeGreaterThan(result.planetRadius);
  expect(result.rampPeakRadius).toBeGreaterThan(result.surfaceRadius);
  expect(result.buildingBaseRadius).toBeGreaterThan(result.planetRadius);
  expect(result.buildingNormalAlignment).toBeGreaterThan(0.999);
  expect(result.railRadius).toBeGreaterThan(result.surfaceRadius);

  await page.screenshot({ path: 'test-results/city-world.png' });
});

test('cityWorld_isMountedAndRenderedOnGamePage', async ({ page }) => {
  await page.goto('/skate.html');

  const result = await page.evaluate(() => {
    const game = window.skateGame;
    if (!game?.city || !game?.renderer || !game?.scene || !game?.camera) {
      return { mounted: false };
    }

    game.renderer.render(game.scene, game.camera);
    const cityPoints = [
      ...game.layout.surfaces.flatMap((surface) => surface.centerline),
      ...game.layout.buildings.map((building) => building.position),
      ...game.layout.rails.flatMap((rail) => rail.points),
    ];
    const planetViewUp = new window.THREE.Vector3(0, 1, 0)
      .applyQuaternion(game.camera.quaternion)
      .normalize();
    cityPoints.push(
      planetViewUp.clone().multiplyScalar(game.layout.planetRadius).toArray(),
      planetViewUp.clone().multiplyScalar(-game.layout.planetRadius).toArray(),
    );
    return {
      mounted: true,
      triangleCount: game.renderer.info.render.triangles,
      worldDescriptor: game.world?.descriptor,
      skaterMode: game.skaterState?.mode,
      skaterRadius: game.skaterState?.position && Math.hypot(...game.skaterState.position),
      avatarSkaterDistance: game.skaterState?.position
        ? game.avatar.position.distanceTo(new window.THREE.Vector3(...game.skaterState.position))
        : null,
      firstStreetVertexCount: game.world?.surfaces[0].vertices.length,
      renderedStreetVertexCount: game.city.getObjectByName(`street-${game.world?.surfaces[0].id}`)
        ?.geometry.attributes.position.count,
      readyState: document.querySelector('#game-root').dataset.gameState,
      canvasWidth: game.renderer.domElement.width,
      canvasHeight: game.renderer.domElement.height,
      cityCenterScreenX: (
        new window.THREE.Vector3(0, 0, 0).project(game.camera).x + 1
      ) / 2,
      cityVerticalExtentNdc: Math.max(...cityPoints.map((point) => Math.abs(
        new window.THREE.Vector3(...point).project(game.camera).y,
      ))),
    };
  });

  expect(result.mounted).toBe(true);
  expect(result.triangleCount).toBeGreaterThan(0);
  expect(result.readyState).toBe('ready');
  expect(result.worldDescriptor).toMatchObject({ version: 1, radius: 16, tuningVersion: 1 });
  expect(result.skaterMode).toBe('grounded');
  expect(result.skaterRadius).toBeGreaterThan(16);
  expect(result.avatarSkaterDistance).toBeLessThan(1e-6);
  expect(result.renderedStreetVertexCount).toBe(result.firstStreetVertexCount);
  expect(result.canvasWidth).toBeGreaterThan(0);
  expect(result.canvasHeight).toBeGreaterThan(0);
  expect(result.cityCenterScreenX).toBeGreaterThan(0.55);
  expect(result.cityVerticalExtentNdc).toBeLessThan(0.75);

  await page.screenshot({ path: 'test-results/city-world-mounted.png' });

  const cleanup = await page.evaluate(() => {
    const game = window.skateGame;
    let rendererDisposed = false;
    const disposeRenderer = game.renderer.dispose.bind(game.renderer);
    game.renderer.dispose = () => {
      rendererDisposed = true;
      disposeRenderer();
    };
    game.dispose();

    return {
      disposedState: document.querySelector('#game-root').dataset.gameState,
      rendererDisposed,
    };
  });

  expect(cleanup.disposedState).toBe('disposed');
  expect(cleanup.rendererDisposed).toBe(true);
});
