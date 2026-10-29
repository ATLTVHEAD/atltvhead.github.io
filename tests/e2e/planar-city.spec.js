import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';

mkdirSync('artifacts/skate-progress', { recursive: true });

async function openAndJoin(page, viewport = { width: 1280, height: 800 }) {
  await page.setViewportSize(viewport);
  await page.goto('/skate.html');
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'ready');
  await page.getByRole('button', { name: 'Join City' }).click();
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'playing');
}

async function navigateFromPlazaToNorthRoad(page) {
  await page.evaluate(() => { window.testGamepad.axes[1] = -1; });
  await page.waitForFunction(() => window.skateGame.skaterState.position[0] > 231, null, {
    timeout: 12_000,
  });
  await page.evaluate(() => { window.testGamepad.axes[1] = 1; });
  await page.waitForFunction(() => window.skateGame.skaterState.speed < 1.2, null, {
    timeout: 5_000,
  });
  await page.evaluate(() => { window.testGamepad.axes[1] = 0; });
  await steerToHeading(page, Math.PI / 2);
  await page.evaluate(() => { window.testGamepad.axes[1] = -1; });
  await page.waitForFunction(() => window.skateGame.skaterState.position[2] > 214, null, {
    timeout: 12_000,
  });
  await page.evaluate(() => { window.testGamepad.axes[1] = 0; });
}

async function steerToHeading(page, targetAngle, tolerance = 0.02) {
  await page.evaluate(async ({ target, tolerance }) => {
    const pad = window.testGamepad;
    const headingError = () => {
      const { forward } = window.skateGame.skaterState;
      const heading = Math.atan2(forward[2], forward[0]);
      return Math.atan2(Math.sin(target - heading), Math.cos(target - heading));
    };

    for (let frame = 0; frame < 900; frame += 1) {
      const error = headingError();
      if (Math.abs(error) <= tolerance) {
        pad.axes[0] = 0;
        return;
      }
      const strength = Math.min(1, Math.max(0.16, Math.abs(error) * 0.75));
      pad.axes[0] = Math.sign(error) * strength;
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    pad.axes[0] = 0;
    const state = window.skateGame.skaterState;
    throw new Error(`Could not steer to ${target} radians: ${JSON.stringify(state)}.`);
  }, { target: targetAngle, tolerance });
}

async function trimHeadingForCruise(page, targetAngle) {
  await steerToHeading(page, targetAngle, 0.02);
}

async function installStandardTestGamepad(page) {
  await page.addInitScript(() => {
    window.testGamepad = {
      connected: true,
      id: 'Planar integration test pad',
      index: 0,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    };
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => [window.testGamepad],
    });
  });
}

async function stopTestGamepad(page) {
  await page.evaluate(() => { window.testGamepad.axes[1] = 1; });
  await page.waitForFunction(() => window.skateGame.skaterState.speed < 0.3, null, {
    timeout: 5_000,
  });
  await page.evaluate(() => { window.testGamepad.axes[1] = 0; });
}

async function driveTestGamepadUntil(page, predicate, { timeout = 15_000, throttle = -1 } = {}) {
  await page.evaluate((value) => { window.testGamepad.axes[1] = value; }, throttle);
  try {
    await page.waitForFunction(predicate, null, { timeout });
  } catch (error) {
    const lastState = await page.evaluate(() => ({
      skater: window.skateGame?.skaterState,
      axes: window.testGamepad?.axes,
    }));
    throw new Error(`${error.message}; last state: ${JSON.stringify(lastState)}`);
  }
  await stopTestGamepad(page);
}

async function beginPositionTrace(page, name) {
  await page.evaluate((traceName) => {
    window[traceName] = [];
    const sample = () => {
      const game = window.skateGame;
      if (!game) return;
      if (game.session.getState().mode === 'playing') {
        const state = game.skaterState;
        window[traceName].push({
          position: [...state.position],
          forward: [...state.forward],
          surfaceId: state.surfaceId,
          mode: state.mode,
          speed: state.speed,
        });
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }, name);
}

async function capturePlayCanvasView(page, { path, position, target, up = [0, 1, 0], fov = null }) {
  const image = await page.evaluate(({ cameraPosition, cameraTarget, cameraUp, cameraFov }) => {
    const { skateGame: game, THREE } = window;
    const camera = game.camera;
    const previous = {
      position: camera.position.clone(),
      up: camera.up.clone(),
      quaternion: camera.quaternion.clone(),
      fov: camera.fov,
    };
    camera.position.set(...cameraPosition);
    camera.up.set(...cameraUp);
    if (Number.isFinite(cameraFov)) {
      camera.fov = cameraFov;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(new THREE.Vector3(...cameraTarget));
    game.renderer.render(game.playScene, camera);
    const screenshot = game.renderer.domElement.toDataURL('image/png');
    camera.position.copy(previous.position);
    camera.up.copy(previous.up);
    camera.quaternion.copy(previous.quaternion);
    camera.fov = previous.fov;
    camera.updateProjectionMatrix();
    game.renderer.render(game.playScene, camera);
    return screenshot;
  }, { cameraPosition: position, cameraTarget: target, cameraUp: up, cameraFov: fov });

  await page.evaluate((source) => {
    const imageElement = document.createElement('img');
    imageElement.id = 'planar-review-capture';
    imageElement.src = source;
    document.body.append(imageElement);
  }, image);
  await page.evaluate(() => {
    const selectors = ['.skate-topbar', '.skate-card', '#touch-controls', '#play-controls', '#controls-panel'];
    window.__reviewCaptureHidden = selectors.flatMap((selector) => (
      [...document.querySelectorAll(selector)].map((element) => ({ element, hidden: element.hidden }))
    ));
    for (const { element } of window.__reviewCaptureHidden) element.hidden = true;
  });
  await page.locator('#planar-review-capture').screenshot({ path });
  await page.evaluate(() => {
    for (const { element, hidden } of window.__reviewCaptureHidden ?? []) element.hidden = hidden;
    delete window.__reviewCaptureHidden;
  });
  await page.locator('#planar-review-capture').evaluate((imageElement) => imageElement.remove());
}

async function beginCameraWrapTrace(page) {
  return page.evaluate(() => {
    const game = window.skateGame;
    const position = [...game.skaterState.position];
    const offset = game.cameraState.position.map((value, axis) => value - position[axis]);
    const targetOffset = game.cameraState.target.map((value, axis) => value - position[axis]);
    window.__cameraWrapTrace = {
      crossings: 0,
      travelX: 0,
      travelZ: 0,
      maxCameraOffsetJump: 0,
      maxTargetOffsetJump: 0,
    };
    let previous = { position, offset, targetOffset };
    const sample = () => {
      const game = window.skateGame;
      const position = game.skaterState.position;
      const camera = game.cameraState;
      const offset = camera.position.map((value, axis) => value - position[axis]);
      const targetOffset = camera.target.map((value, axis) => value - position[axis]);
      const wrapDelta = (from, to) => {
        const delta = to - from;
        return ((delta + 128) % 256 + 256) % 256 - 128;
      };
      window.__cameraWrapTrace.travelX += Math.abs(wrapDelta(
        previous.position[0], position[0],
      ));
      window.__cameraWrapTrace.travelZ += Math.abs(wrapDelta(
        previous.position[2], position[2],
      ));
      if (Math.abs(position[0] - previous.position[0]) > 128
          || Math.abs(position[2] - previous.position[2]) > 128) {
        const length = (a, b) => Math.hypot(...a.map((value, axis) => value - b[axis]));
        window.__cameraWrapTrace.crossings += 1;
        window.__cameraWrapTrace.maxCameraOffsetJump = Math.max(
          window.__cameraWrapTrace.maxCameraOffsetJump,
          length(offset, previous.offset),
        );
        window.__cameraWrapTrace.maxTargetOffsetJump = Math.max(
          window.__cameraWrapTrace.maxTargetOffsetJump,
          length(targetOffset, previous.targetOffset),
        );
      }
      previous = { position: [...position], offset, targetOffset };
      if (game.session.getState().mode === 'playing') requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    return position;
  });
}

async function waitForOneLap(page, axis) {
  const axisName = axis === 0 ? 'X' : 'Z';
  await page.waitForFunction(({ axisName }) => {
    const trace = window.__cameraWrapTrace;
    return trace[`travel${axisName}`] >= 256;
  }, { axisName }, { timeout: 40_000 });
  return page.evaluate(() => ({ ...window.skateGame.skaterState }));
}

test('planarCity_joinUsesPlazaAndLeaveRestoresGlobe', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/skate.html');
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'ready');
  await page.screenshot({ path: 'artifacts/skate-progress/planar-city-globe-preview.png' });
  await page.evaluate(() => {
    const game = window.skateGame;
    window.__menuPointers = {
      city: game.city,
      world: game.world,
      layout: game.layout,
      scene: game.scene,
      far: game.camera.far,
    };
  });

  await page.getByRole('button', { name: 'Join City' }).click();
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'playing');
  const play = await page.evaluate(() => {
    const { skateGame: game, THREE } = window;
    const pointers = window.__menuPointers;
    return {
      menuPointersStable: game.city === pointers.city && game.world === pointers.world
        && game.layout === pointers.layout && game.scene === pointers.scene,
      menuDescriptor: game.world.descriptor,
      menuBuildings: game.city.children.filter((child) => child.userData.assetId).length,
      playDescriptor: game.playWorld?.descriptor,
      planarSize: [game.planarLayout?.width, game.planarLayout?.depth],
      tileCount: game.playCity?.children.filter((child) => child.userData.tileOffset).length,
      avatarInPlay: game.avatar.parent === game.playCity,
      mode: game.session.getState().mode,
      skater: game.skaterState,
      cameraUp: game.camera.up.toArray(),
      cameraY: game.camera.position.y,
      playFar: game.camera.far,
      fogNear: game.playScene?.fog?.near,
      fogFar: game.playScene?.fog?.far,
      fogMatchesBackground: game.playScene?.fog?.color.equals(game.playScene?.background ?? new THREE.Color()),
    };
  });

  expect(play.menuPointersStable).toBe(true);
  expect(play.playDescriptor).toMatchObject({
    version: 3,
    geometry: 'planar-kenney-v1',
    topology: 'torus',
    width: 256,
    depth: 256,
    gravityUp: [0, 1, 0],
  });
  expect(play.menuDescriptor).toMatchObject({ version: 3, radius: 32 });
  expect(play.menuBuildings).toBe(8);
  expect(play.planarSize).toEqual([256, 256]);
  expect(play.tileCount).toBe(9);
  expect(play.avatarInPlay).toBe(true);
  expect(play.mode).toBe('playing');
  expect(play.skater).toMatchObject({ position: [202, 0, 130], mode: 'grounded', spawnId: 'spawn-plaza' });
  expect(play.cameraUp).toEqual([0, 1, 0]);
  expect(play.cameraY).toBeGreaterThanOrEqual(0.45);
  expect(play.playFar).toBe(512);
  expect(play.fogNear).toBe(160);
  expect(play.fogFar).toBe(208);
  expect(play.fogMatchesBackground).toBe(true);
  await page.screenshot({ path: 'artifacts/skate-progress/planar-city-plaza.png' });
  await capturePlayCanvasView(page, {
    path: 'artifacts/skate-progress/planar-city-topdown-overview.png',
    position: [128, 90, 128],
    target: [128, 0, 128],
    up: [0, 0, 1],
    fov: 110,
  });
  await capturePlayCanvasView(page, {
    path: 'artifacts/skate-progress/planar-city-ramp-primary-rails.png',
    position: [78, 14, 145],
    target: [94, 0, 172],
  });

  await page.getByRole('button', { name: 'Leave City' }).click();
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'ready');
  const preview = await page.evaluate(() => {
    const game = window.skateGame;
    return {
      menuPointersStable: game.city === window.__menuPointers.city
        && game.world === window.__menuPointers.world
        && game.layout === window.__menuPointers.layout
        && game.scene === window.__menuPointers.scene,
      avatarInMenu: game.avatar.parent === game.city,
      farRestored: game.camera.far === window.__menuPointers.far,
      previewRadius: game.world.radius,
      buildingCount: game.city.children.filter((child) => child.userData.assetId).length,
      mode: game.session.getState().mode,
      up: game.camera.up.toArray(),
    };
  });
  expect(preview).toEqual({
    menuPointersStable: true,
    avatarInMenu: true,
    farRestored: true,
    previewRadius: 32,
    buildingCount: 8,
    mode: 'preview',
    up: [0, 1, 0],
  });
});

test('planarCity_lapsBothAxesWithoutCameraPop', async ({ page }) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => {
    window.testGamepad = {
      connected: true,
      id: 'Planar lap test pad',
      index: 0,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    };
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => [window.testGamepad],
    });
  });
  await openAndJoin(page);
  await navigateFromPlazaToNorthRoad(page);
  const northRoadApproach = await page.evaluate(() => window.skateGame.skaterState);
  expect(Math.abs(northRoadApproach.forward[0])).toBeLessThan(0.04);
  await page.evaluate(() => { window.testGamepad.axes[1] = 1; });
  await page.waitForFunction(() => window.skateGame.skaterState.speed < 1.2, null, {
    timeout: 5_000,
  });
  await page.evaluate(() => { window.testGamepad.axes[1] = 0; });
  await steerToHeading(page, Math.PI);
  await page.evaluate(() => { window.testGamepad.axes[1] = -1; });
  await page.waitForFunction(() => {
    const state = window.skateGame.skaterState;
    return state.surfaceId === 'street-wrap-x-east' && state.position[2] > 214
      && state.position[2] < 226 && state.speed > 11 && state.forward[0] < -0.98;
  }, null, { timeout: 8_000 });
  await trimHeadingForCruise(page, Math.PI);
  const xStart = await beginCameraWrapTrace(page);
  await page.waitForFunction(() => {
    const p = window.skateGame.skaterState.position;
    return Math.min(p[0], 256 - p[0]) < 1;
  }, null, { timeout: 25_000 });
  await page.screenshot({ path: 'artifacts/skate-progress/planar-wrap-x-seam.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => {
    const size = window.skateGame.renderer.getSize(new window.THREE.Vector2());
    return Math.round(size.x) === 390 && Math.round(size.y) === 844;
  }, null, { timeout: 5_000 });
  await page.screenshot({ path: 'artifacts/skate-progress/planar-wrap-x-seam-portrait.png' });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => {
    const size = window.skateGame.renderer.getSize(new window.THREE.Vector2());
    return Math.round(size.x) === 844 && Math.round(size.y) === 390;
  }, null, { timeout: 5_000 });
  await page.screenshot({ path: 'artifacts/skate-progress/planar-wrap-x-seam-landscape.png' });
  await page.setViewportSize({ width: 1280, height: 800 });
  const xEnd = await waitForOneLap(page, 0);
  const xTrace = await page.evaluate(() => ({ ...window.__cameraWrapTrace }));
  expect(Math.abs(xEnd.position[0] - xStart[0])).toBeLessThan(3);
  expect(Math.abs(xEnd.position[2] - xStart[2])).toBeLessThan(8);
  expect(xTrace.travelX).toBeGreaterThanOrEqual(256);
  expect(xTrace.crossings).toBeGreaterThan(0);
  expect(xTrace.maxCameraOffsetJump).toBeLessThan(0.5);
  expect(xTrace.maxTargetOffsetJump).toBeLessThan(0.5);

  await page.evaluate(() => { window.testGamepad.axes[1] = 0; });
  await page.getByRole('button', { name: 'Leave City' }).click();
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'ready');
  await page.getByRole('button', { name: 'Join City' }).click();
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'playing');
  await navigateFromPlazaToNorthRoad(page);
  await page.evaluate(() => { window.testGamepad.axes[1] = -1; });
  await page.waitForFunction(() => {
    const state = window.skateGame.skaterState;
    return state.surfaceId === 'street-wrap-z-north' && state.position[2] > 230
      && state.speed > 11 && state.forward[2] > 0.98;
  }, null, { timeout: 8_000 });
  await trimHeadingForCruise(page, Math.PI / 2);
  const zStart = await beginCameraWrapTrace(page);
  await page.waitForFunction(() => {
    const p = window.skateGame.skaterState.position;
    return Math.min(p[2], 256 - p[2]) < 1;
  }, null, { timeout: 25_000 });
  await page.screenshot({ path: 'artifacts/skate-progress/planar-wrap-z-seam.png' });
  const zEnd = await waitForOneLap(page, 2);
  const zTrace = await page.evaluate(() => ({ ...window.__cameraWrapTrace }));
  expect(Math.abs(zEnd.position[2] - zStart[2])).toBeLessThan(3);
  expect(Math.abs(zEnd.position[0] - zStart[0])).toBeLessThan(8);
  expect(zTrace.travelZ).toBeGreaterThanOrEqual(256);
  expect(zTrace.crossings).toBeGreaterThan(0);
  expect(zTrace.maxCameraOffsetJump).toBeLessThan(0.5);
  expect(zTrace.maxTargetOffsetJump).toBeLessThan(0.5);
  await page.evaluate(() => { window.testGamepad.axes[1] = 0; });

  await page.evaluate(() => {
    const game = window.skateGame;
    game.session.pause();
    game.camera.position.set(-10, 24, -10);
    game.camera.lookAt(20, 0, 30);
    game.renderer.render(game.playScene, game.camera);
    document.querySelector('.skate-topbar').hidden = true;
    document.querySelector('.skate-card').hidden = true;
    document.querySelector('#touch-controls').hidden = true;
    document.querySelector('#controls-panel').hidden = true;
  });
  await page.locator('#game-canvas').screenshot({
    path: 'artifacts/skate-progress/planar-wrap-corner-wide.png',
  });
});

test('planarCity_leaveWhilePausedResetsCorrectWorld', async ({ page }) => {
  await openAndJoin(page);
  await page.keyboard.down('w');
  await page.waitForFunction(() => window.skateGame.skaterState.speed > 2);
  await page.evaluate(() => window.skateGame.session.pause());
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'paused');
  await page.keyboard.up('w');
  await page.getByRole('button', { name: 'Leave City' }).click();
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'ready');
  const reset = await page.evaluate(() => {
    const game = window.skateGame;
    return {
      mode: game.session.getState().mode,
      playWorldRetained: game.playWorld?.descriptor?.topology === 'torus',
      playerRadius: Math.hypot(...game.skaterState.position),
      avatarInMenu: game.avatar.parent === game.city,
    };
  });
  expect(reset.mode).toBe('preview');
  expect(reset.playWorldRetained).toBe(true);
  expect(reset.playerRadius).toBeGreaterThan(32);
  expect(reset.avatarInMenu).toBe(true);
});

test('planarCity_retryDisposesBothScenes', async ({ page }) => {
  let releaseRequest;
  const blockedAsset = new Promise((resolve) => { releaseRequest = resolve; });
  let intercepted = false;
  await page.route('**/assets/game/kenney-industrial/building-a.glb?*', async (route) => {
    if (!intercepted) {
      intercepted = true;
      await blockedAsset;
    }
    await route.continue().catch(() => {});
  });
  await page.goto('/skate.html', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => intercepted).toBe(true);
  await page.waitForFunction(() => Boolean(window.THREE?.BufferGeometryUtils?.mergeBufferGeometries));
  await page.evaluate(() => {
    const THREE = window.THREE;
    const merge = THREE.BufferGeometryUtils.mergeBufferGeometries;
    let failOnce = true;
    window.__planarMergeFailureRemaining = 1;
    THREE.BufferGeometryUtils.mergeBufferGeometries = (...args) => {
      if (failOnce) {
        failOnce = false;
        window.__planarMergeFailureRemaining = 0;
        throw new Error('forced planar-scene construction failure');
      }
      return merge(...args);
    };
    window.__geometryDisposals = 0;
    const dispose = THREE.BufferGeometry.prototype.dispose;
    THREE.BufferGeometry.prototype.dispose = function trackDisposal(...args) {
      window.__geometryDisposals += 1;
      return dispose.apply(this, args);
    };
  });
  releaseRequest();

  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'error');
  const failedBootDisposals = await page.evaluate(() => window.__geometryDisposals);
  expect(await page.evaluate(() => window.__planarMergeFailureRemaining)).toBe(0);
  expect(failedBootDisposals).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'ready');
  const retried = await page.evaluate(() => ({
    hasBothScenes: Boolean(window.skateGame?.city && window.skateGame?.playCity),
    previewBuildings: window.skateGame?.city.children.filter((child) => child.userData.assetId).length,
    playTiles: window.skateGame?.playCity.children.filter((child) => child.userData.tileOffset).length,
  }));
  console.info('PLANAR_SCENE_CLEANUP_METRICS', JSON.stringify({
    failedBootGeometryDisposals: failedBootDisposals,
    hasBothScenesAfterRetry: retried.hasBothScenes,
    previewBuildingsAfterRetry: retried.previewBuildings,
    playTilesAfterRetry: retried.playTiles,
  }));
  expect(retried).toEqual({ hasBothScenes: true, previewBuildings: 8, playTiles: 9 });
});

test('planarCity_outerTilesHiddenAtWideAspect', async ({ page }) => {
  await openAndJoin(page, { width: 1920, height: 600 });
  const view = await page.evaluate(() => {
    const game = window.skateGame;
    const camera = game.camera.position;
    return {
      aspect: game.camera.aspect,
      far: game.camera.far,
      fogNear: game.playScene.fog.near,
      fogFar: game.playScene.fog.far,
      fogMatchesBackground: game.playScene.fog.color.equals(game.playScene.background),
      tileCount: game.playCity.children.filter((child) => child.userData.tileOffset).length,
      nearestOuterBoundary: Math.min(
        Math.abs(camera.x + 256),
        Math.abs(camera.x - 512),
        Math.abs(camera.z + 256),
        Math.abs(camera.z - 512),
      ),
    };
  });
  expect(view.aspect).toBeCloseTo(3.2, 2);
  expect(view.far).toBe(512);
  expect(view.fogNear).toBe(160);
  expect(view.fogFar).toBe(208);
  expect(view.fogMatchesBackground).toBe(true);
  expect(view.tileCount).toBe(9);
  expect(view.nearestOuterBoundary).toBeGreaterThan(view.fogFar);
  await page.screenshot({ path: 'artifacts/skate-progress/planar-city-wide-desktop.png' });
});

test('planarCity_tightAlleyTurnsRemainPlayable', async ({ page }) => {
  test.setTimeout(150_000);
  await installStandardTestGamepad(page);
  await openAndJoin(page);
  await navigateFromPlazaToNorthRoad(page);

  await stopTestGamepad(page);
  await steerToHeading(page, -Math.PI / 2);
  await driveTestGamepadUntil(page, () => window.skateGame.skaterState.position[2] < 36, {
    timeout: 25_000,
  });
  await steerToHeading(page, Math.PI);
  await driveTestGamepadUntil(page, () => window.skateGame.skaterState.position[0] < 66, {
    timeout: 25_000,
  });
  // The long wrap route leaves this integration setup just outside the
  // 2.4-unit alley mouth. Re-center with ordinary movement before the turn.
  await steerToHeading(page, Math.PI);
  await driveTestGamepadUntil(page, () => window.skateGame.skaterState.position[0] < 60.9, {
    timeout: 5_000,
    throttle: -0.25,
  });
  await beginPositionTrace(page, '__alleyTrace');

  // Hold slightly toward the alley center; its narrowest approach is only
  // about two units wide, so the wrap-road's small residual yaw matters.
  await steerToHeading(page, Math.PI / 2 + 0.01, 0.01);
  await driveTestGamepadUntil(page, () => window.skateGame.skaterState.position[2] > 100, {
    timeout: 15_000,
  });
  await driveTestGamepadUntil(page, () => window.skateGame.skaterState.position[2] > 106.8, {
    timeout: 8_000,
    throttle: -0.25,
  });
  await page.screenshot({ path: 'artifacts/skate-progress/planar-city-narrowing-street.png' });

  await steerToHeading(page, Math.PI / 4, 0.01);
  await driveTestGamepadUntil(page, () => {
    const [x, , z] = window.skateGame.skaterState.position;
    return x > 62.5 && z > 109.3;
  }, { timeout: 8_000, throttle: -0.3 });
  await page.screenshot({ path: 'artifacts/skate-progress/planar-city-alley-turn-one.png' });

  await steerToHeading(page, Math.PI / 2, 0.01);
  await driveTestGamepadUntil(page, () => window.skateGame.skaterState.position[2] > 109.5, {
    timeout: 5_000,
    throttle: -0.25,
  });
  // Keep the long narrow eastbound leg on its centerline instead of letting
  // the smallest gamepad yaw step drift onto the far alley edge.
  await steerToHeading(page, -0.01, 0.005);
  await driveTestGamepadUntil(page, () => window.skateGame.skaterState.position[0] > 148, {
    timeout: 20_000,
  });
  await driveTestGamepadUntil(page, () => window.skateGame.skaterState.position[0] > 155, {
    timeout: 8_000,
    throttle: -0.25,
  });

  await steerToHeading(page, Math.PI / 4, 0.01);
  await driveTestGamepadUntil(page, () => {
    const [x, , z] = window.skateGame.skaterState.position;
    return x > 159 && z > 112.5;
  }, { timeout: 8_000, throttle: -0.3 });
  await page.screenshot({ path: 'artifacts/skate-progress/planar-city-alley-turn-two.png' });

  await steerToHeading(page, Math.PI / 2, 0.01);
  await driveTestGamepadUntil(page, () => window.skateGame.skaterState.position[2] > 180, {
    timeout: 15_000,
  });
  await page.screenshot({ path: 'artifacts/skate-progress/planar-city-alley-exit.png' });
  await driveTestGamepadUntil(page, () => window.skateGame.skaterState.position[2] > 216, {
    timeout: 10_000,
  });

  const audit = await page.evaluate(async () => {
    const { queryPlanarSupport, sweepPlanarSkater } = await import('/js/game/world/planar-city-queries.js');
    const { skateGame: game } = window;
    const samples = window.__alleyTrace;
    const inAlley = ({ position: [x, , z] }) => x >= 55 && x <= 166 && z >= 25 && z <= 224;
    const alleySamples = samples.filter(inAlley);
    const supportMismatches = alleySamples
      .filter((sample) => sample.mode === 'grounded')
      .map((sample) => ({
        expected: sample.surfaceId,
        actual: queryPlanarSupport(game.playWorld, sample.position, {
          maxDrop: 0.03,
          maxRise: 0.03,
          previousSurfaceId: sample.surfaceId,
        })?.surfaceId ?? null,
        position: sample.position,
      }))
      .filter((support) => support.actual !== support.expected);
    // Seed the exit query with the connected branch's support: support
    // selection otherwise preserves the fallback ID on equal-height ties.
    const exitSurfaceVisited = alleySamples.some(({ position }) => {
      const [, , z] = position;
      return z >= 190 && z <= 220
        && queryPlanarSupport(game.playWorld, position, {
          maxDrop: 0.03,
          maxRise: 0.03,
          previousSurfaceId: 'alley-dogleg',
        })?.surfaceId === 'street-alley-exit';
    });
    const blockedSweeps = [];
    for (let index = 1; index < alleySamples.length; index += 1) {
      const previous = alleySamples[index - 1];
      const current = alleySamples[index];
      const result = sweepPlanarSkater(game.playWorld, previous.position, current.position, 0.25);
      if (result.blocked) blockedSweeps.push({ hitId: result.hitId, from: previous.position, to: current.position });
    }
    return {
      count: samples.length,
      alleyCount: alleySamples.length,
      supportMismatches,
      blockedSweeps,
      firstTurnVisited: alleySamples.some(({ position: [x, , z] }) => x >= 61 && x <= 67 && z >= 107 && z <= 114),
      secondTurnVisited: alleySamples.some(({ position: [x, , z] }) => x >= 156 && x <= 163 && z >= 110 && z <= 117),
      alleySurfaceVisited: alleySamples.some(({ position }) => (
        position[2] >= 33 && position[2] < 190 && queryPlanarSupport(game.playWorld, position, {
          maxDrop: 0.03,
          maxRise: 0.03,
          previousSurfaceId: 'alley-dogleg',
        })?.surfaceId === 'alley-dogleg'
      )),
      exitSurfaceVisited,
      finalState: game.skaterState,
    };
  });

  expect(audit.count).toBeGreaterThan(100);
  expect(audit.alleyCount).toBeGreaterThan(100);
  expect(audit.supportMismatches).toEqual([]);
  expect(audit.blockedSweeps).toEqual([]);
  expect(audit.firstTurnVisited).toBe(true);
  expect(audit.secondTurnVisited).toBe(true);
  expect(audit.alleySurfaceVisited).toBe(true);
  expect(audit.exitSurfaceVisited).toBe(true);
  expect(audit.finalState.position[2]).toBeGreaterThan(216);
  expect(audit.finalState.mode).toBe('grounded');
});

test('planarCity_leaveFromOpenControlsPreservesCustomizationWithoutStaleJump', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/skate.html');
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'ready');
  await page.locator('#skater-color').evaluate((input) => {
    input.value = '#36a6ff';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.getByLabel('Cap accessory').check();

  await page.getByRole('button', { name: 'Join City' }).click();
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'playing');
  await page.evaluate(() => {
    window.__jumpBufferObserved = false;
    const sample = () => {
      const state = window.skateGame?.skaterState;
      if (state?.mode === 'airborne' && state.jumpBufferAgeMs <= 120) {
        window.__jumpBufferObserved = true;
      }
      if (window.skateGame?.session.getState().mode === 'playing') requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.skateGame.skaterState.mode === 'airborne');
  await page.keyboard.down('Space');
  try {
    await page.waitForFunction(() => window.__jumpBufferObserved === true, null, {
      timeout: 2_000,
      polling: 10,
    });
  } catch (error) {
    const lastState = await page.evaluate(() => window.skateGame.skaterState);
    throw new Error(`${error.message}; last state: ${JSON.stringify(lastState)}`);
  }
  await page.keyboard.up('Space');

  await page.getByRole('button', { name: 'Controls', exact: true }).click();
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'paused');
  await expect(page.getByRole('dialog', { name: 'Controls' })).toBeVisible();
  await page.locator('#leave-city').click();
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'ready');
  await expect(page.getByRole('dialog', { name: 'Controls' })).toBeHidden();
  await page.getByRole('button', { name: 'Join City' }).click();
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'playing');
  await expect(page.getByRole('dialog', { name: 'Controls' })).toBeHidden();
  await page.waitForTimeout(350);

  const rejoined = await page.evaluate(() => ({
    mode: window.skateGame.skaterState.mode,
    appearance: window.skateGame.avatar.userData.appearance,
    capVisible: window.skateGame.avatar.getObjectByName('accessory-cap')?.visible ?? false,
    jumpedEvents: window.skateGame.lastEvents.filter((event) => event.type === 'jumped'),
    jumpBufferAgeMs: window.skateGame.skaterState.jumpBufferAgeMs,
  }));
  expect(rejoined).toEqual({
    mode: 'grounded',
    appearance: { color: '#36A6FF', accessoryIds: ['cap'] },
    capVisible: true,
    jumpedEvents: [],
    jumpBufferAgeMs: expect.any(Number),
  });
  expect(rejoined.jumpBufferAgeMs).toBeGreaterThan(120);
});

test('planarCity_seamSupportAndCameraStayContinuous', async ({ page }) => {
  await installStandardTestGamepad(page);
  await openAndJoin(page);
  await navigateFromPlazaToNorthRoad(page);
  await stopTestGamepad(page);
  await steerToHeading(page, 0);
  await driveTestGamepadUntil(page, () => {
    const state = window.skateGame.skaterState;
    return state.surfaceId === 'street-wrap-x-east' && state.position[0] > 240
      && state.position[2] > 214 && state.position[2] < 226;
  }, { timeout: 8_000 });

  await page.evaluate(() => {
    window.__seamSupportTrace = [];
    const sample = () => {
      const game = window.skateGame;
      if (game?.session.getState().mode === 'playing') {
        const state = game.skaterState;
        const camera = game.cameraState;
        window.__seamSupportTrace.push({
          position: [...state.position],
          surfaceId: state.surfaceId,
          mode: state.mode,
          cameraOffset: camera.position.map((value, axis) => value - state.position[axis]),
          targetOffset: camera.target.map((value, axis) => value - state.position[axis]),
        });
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.evaluate(() => { window.testGamepad.axes[1] = -1; });
  await page.waitForFunction(() => {
    const samples = window.__seamSupportTrace;
    return samples.some((sample, index) => index > 0
      && samples[index - 1].position[0] > 250 && sample.position[0] < 6);
  }, null, { timeout: 10_000 });
  await page.locator('#game-canvas').screenshot({ path: 'artifacts/skate-progress/planar-city-x-seam-review.png' });
  await page.waitForTimeout(150);
  await page.evaluate(() => { window.testGamepad.axes[1] = 0; });

  const crossing = await page.evaluate(async () => {
    const { queryPlanarSupport, sweepPlanarSkater } = await import('/js/game/world/planar-city-queries.js');
    const game = window.skateGame;
    const samples = window.__seamSupportTrace;
    const index = samples.findIndex((sample, sampleIndex) => sampleIndex > 0
      && samples[sampleIndex - 1].position[0] > 250 && sample.position[0] < 6);
    const before = samples[index - 1];
    const after = samples[index];
    const supportFor = (sample) => queryPlanarSupport(game.playWorld, sample.position, {
      maxDrop: 0.03,
      maxRise: 0.03,
      previousSurfaceId: sample.surfaceId,
    })?.surfaceId ?? null;
    const distance = (first, second) => Math.hypot(...first.map((value, axis) => value - second[axis]));
    return {
      before,
      after,
      beforeSupport: supportFor(before),
      afterSupport: supportFor(after),
      sweep: sweepPlanarSkater(game.playWorld, before.position, after.position, 0.25),
      cameraOffsetJump: distance(before.cameraOffset, after.cameraOffset),
      targetOffsetJump: distance(before.targetOffset, after.targetOffset),
      finite: [...before.position, ...after.position, ...before.cameraOffset, ...after.cameraOffset,
        ...before.targetOffset, ...after.targetOffset].every(Number.isFinite),
    };
  });

  expect(crossing.before.position[0]).toBeGreaterThan(250);
  expect(crossing.after.position[0]).toBeLessThan(6);
  expect(crossing.before.surfaceId).toBe('street-wrap-x-east');
  expect(crossing.after.surfaceId).toBe(crossing.before.surfaceId);
  expect(crossing.beforeSupport).toBe(crossing.before.surfaceId);
  expect(crossing.afterSupport).toBe(crossing.after.surfaceId);
  expect(crossing.sweep.blocked).toBe(false);
  expect(crossing.cameraOffsetJump).toBeLessThan(0.5);
  expect(crossing.targetOffsetJump).toBeLessThan(0.5);
  expect(crossing.finite).toBe(true);
});
