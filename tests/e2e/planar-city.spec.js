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

async function beginCameraWrapTrace(page) {
  return page.evaluate(() => {
    window.__cameraWrapTrace = {
      crossings: 0,
      travelX: 0,
      travelZ: 0,
      maxCameraOffsetJump: 0,
      maxTargetOffsetJump: 0,
    };
    let previous = null;
    const sample = () => {
      const game = window.skateGame;
      const position = game.skaterState.position;
      const camera = game.cameraState;
      const offset = camera.position.map((value, axis) => value - position[axis]);
      const targetOffset = camera.target.map((value, axis) => value - position[axis]);
      if (previous) {
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
      }
      if (previous && (Math.abs(position[0] - previous.position[0]) > 128
          || Math.abs(position[2] - previous.position[2]) > 128)) {
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
  const xStart = await page.evaluate(() => [...window.skateGame.skaterState.position]);
  await beginCameraWrapTrace(page);
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
  const zStart = await page.evaluate(() => [...window.skateGame.skaterState.position]);
  await beginCameraWrapTrace(page);
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
