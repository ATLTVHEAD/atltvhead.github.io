import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';

mkdirSync('artifacts/skate-progress', { recursive: true });

test('localSkating_joinMovesJumpsAndLeavesWithoutABackend', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/skate.html');
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'ready');

  await page.getByRole('button', { name: 'Join City' }).click();
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'playing');
  const playerFrame = await page.evaluate(() => {
    const { THREE, skateGame } = window;
    return {
      boomLength: skateGame.cameraState.actualBoomLength,
      cameraPosition: skateGame.camera.position.toArray(),
      start: [...skateGame.skaterState.position],
    };
  });
  expect(playerFrame.boomLength).toBeGreaterThan(7.5);
  await page.keyboard.down('w');
  await page.waitForFunction(() => window.skateGame.skaterState.speed >= 4);
  await page.waitForTimeout(500);
  await page.keyboard.up('w');
  await page.waitForFunction((initial) => {
    const current = window.skateGame.skaterState.position;
    return Math.hypot(...current.map((value, axis) => value - initial[axis])) > 0.5;
  }, playerFrame.start);
  await page.waitForFunction((initial) => {
    const camera = window.skateGame.camera.position.toArray();
    return Math.hypot(...camera.map((value, axis) => value - initial[axis])) > 0.2;
  }, playerFrame.cameraPosition);
  await page.waitForFunction(() => {
    const { THREE, skateGame } = window;
    const state = skateGame.skaterState;
    if (state.mode !== 'grounded') return false;
    const supportNormal = new THREE.Vector3(...state.supportNormal).normalize();
    const expectedPosition = new THREE.Vector3(...state.position)
      .addScaledVector(supportNormal, skateGame.avatar.userData.supportOffset);
    return skateGame.avatar.position.distanceTo(expectedPosition) < 1e-4;
  });

  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.skateGame.lastEvents.some((event) => event.type === 'jumped'));
  await page.waitForFunction(() => window.skateGame.lastEvents.some((event) => event.type === 'landed'));
  await expect(page.locator('#connection-state')).toContainText(/local.*offline/i);

  await page.screenshot({ path: 'artifacts/skate-progress/task-6-playable-desktop.png' });
  await page.getByRole('button', { name: 'Leave City' }).click();
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'ready');
  await expect(page.getByRole('button', { name: 'Join City' })).toBeVisible();
});

test('localSkating_cameraResizePreservesHeadingInPortraitAndLandscape', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/skate.html');
  await page.getByRole('button', { name: 'Join City' }).click();
  const heading = await page.evaluate(() => window.skateGame.skaterState.forward);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => {
    const size = window.skateGame.renderer.getSize(new window.THREE.Vector2());
    return Math.round(size.x) === 390 && Math.round(size.y) === 844;
  }, null, { timeout: 5_000 });
  await page.waitForFunction(() => {
    const { THREE, skateGame } = window;
    const avatarCenter = skateGame.avatar.position.clone().add(
      new THREE.Vector3(0, 2.1, 0).applyQuaternion(skateGame.avatar.quaternion),
    );
    const projected = avatarCenter.project(skateGame.camera);
    return Math.abs(projected.x) < 0.95 && Math.abs(projected.y) < 0.95
      && projected.z >= -1 && projected.z <= 1;
  }, null, { timeout: 5_000 });
  expect(await page.evaluate(() => window.skateGame.skaterState.forward)).toEqual(heading);
  await page.screenshot({ path: 'artifacts/skate-progress/task-6-playable-portrait.png' });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForFunction(() => {
    const size = window.skateGame.renderer.getSize(new window.THREE.Vector2());
    return Math.round(size.x) === 1280 && Math.round(size.y) === 800;
  }, null, { timeout: 5_000 });
  await page.waitForFunction(() => {
    const { THREE, skateGame } = window;
    const avatarCenter = skateGame.avatar.position.clone().add(
      new THREE.Vector3(0, 2.1, 0).applyQuaternion(skateGame.avatar.quaternion),
    );
    const projected = avatarCenter.project(skateGame.camera);
    return Math.abs(projected.x) < 0.95 && Math.abs(projected.y) < 0.95
      && projected.z >= -1 && projected.z <= 1;
  }, null, { timeout: 5_000 });
  expect(await page.evaluate(() => window.skateGame.skaterState.forward)).toEqual(heading);
});

test('localSkating_followCameraFramesThePlanarRouteWithoutBuildingOcclusion', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/skate.html');
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'ready');
  const routeVisibility = await page.evaluate(async () => {
    const { createFollowCameraState } = await import('/js/game/render/follow-camera.js');
    const { queryPlanarSupport, sweepPlanarSkater } = await import('/js/game/world/planar-city-queries.js');
    const world = window.skateGame.playWorld;
    const camera = new window.THREE.PerspectiveCamera(
      44,
      1280 / 800,
      0.1,
      512,
    );
    let visibleSamples = 0;
    let outOfFrameSamples = 0;
    let buildingOcclusions = 0;
    let routeSamples = 0;

    for (const surface of world.surfaces) {
      if (!surface.centerline?.length) continue;
      for (let index = 0; index < surface.centerline.length; index += 1) {
        routeSamples += 1;
        const position = surface.centerline[index];
        const before = surface.centerline[Math.max(0, index - 1)];
        const after = surface.centerline[Math.min(surface.centerline.length - 1, index + 1)];
        const support = queryPlanarSupport(world, position, {
          maxDrop: 1,
          maxRise: 1,
          previousSurfaceId: surface.id,
        });
        const contactPoint = support?.point ?? position;
        const supportUp = support?.surfaceNormal ?? [0, 1, 0];
        const forwardDelta = [after[0] - before[0], 0, after[2] - before[2]];
        const forwardLength = Math.hypot(...forwardDelta);
        const forward = forwardLength > 1e-9
          ? forwardDelta.map((value) => value / forwardLength)
          : [0, 0, 1];
        const cameraState = createFollowCameraState({
          position: contactPoint,
          forward,
          speed: 6,
          mode: 'grounded',
          surfaceId: surface.id,
          supportNormal: supportUp,
          gravityUp: [0, 1, 0],
        }, world, { width: 1280, height: 800 });
        camera.position.set(...cameraState.position);
        camera.up.set(...cameraState.up);
        camera.lookAt(new window.THREE.Vector3(...cameraState.target));
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);

        const skaterCenter = new window.THREE.Vector3(...contactPoint)
          .add(new window.THREE.Vector3(...supportUp).multiplyScalar(2.1));
        const projected = skaterCenter.project(camera);
        const visible = projected.z >= -1 && projected.z <= 1
          && Math.abs(projected.x) < 0.95
          && Math.abs(projected.y) < 0.95;
        visibleSamples += Number(visible);
        outOfFrameSamples += Number(!visible);
        buildingOcclusions += Number(sweepPlanarSkater(
          world,
          cameraState.target,
          cameraState.position,
          0.18,
        ).blocked);
      }
    }

    return { routeSamples, visibleSamples, outOfFrameSamples, buildingOcclusions };
  });

  expect(routeVisibility.routeSamples).toBeGreaterThan(0);
  expect(routeVisibility.visibleSamples).toBe(routeVisibility.routeSamples);
  expect(routeVisibility.outOfFrameSamples).toBe(0);
  expect(routeVisibility.buildingOcclusions).toBe(0);
});

test('localSkating_previewOrbitReturnsToFollowCameraInputWhenPlaying', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/skate.html');
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'ready');
  const previewCamera = await page.evaluate(() => window.skateGame.camera.position.toArray());
  await page.mouse.move(820, 350);
  await page.mouse.down();
  await page.mouse.move(875, 370, { steps: 3 });
  await page.mouse.up();
  await page.waitForFunction((initial) => {
    const current = window.skateGame.camera.position.toArray();
    return Math.hypot(...current.map((value, axis) => value - initial[axis])) > 0.5;
  }, previewCamera);

  await page.getByRole('button', { name: 'Join City' }).click();
  await page.mouse.move(820, 350);
  await page.mouse.down();
  await page.mouse.move(850, 360, { steps: 2 });
  await page.mouse.up();
  await page.waitForFunction(() => Math.abs(window.skateGame.cameraState.orbitOffset.yaw) > 0.02);
  expect(await page.evaluate(() => window.skateGame.session.getState().mode)).toBe('playing');
});

test('localSkating_webglFailureShowsVisibleRecoveryHelp', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContextWithoutWebGL(type, ...args) {
      if (typeof type === 'string' && type.toLowerCase().includes('webgl')) return null;
      return getContext.call(this, type, ...args);
    };
  });
  await page.goto('/skate.html');

  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'error');
  await expect(page.getByRole('alert')).toBeVisible();
  const retry = page.getByRole('button', { name: 'Retry' });
  await expect(retry).toBeVisible();
  await retry.click();
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'error');
  await expect(page.getByRole('alert')).toBeVisible();
});

test('localSkating_disposeReleasesDetachedAccessoryGeometry', async ({ page }) => {
  await page.goto('/skate.html');
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'ready');
  const cap = page.getByLabel('Cap accessory');
  await cap.check();
  await cap.uncheck();
  const disposed = await page.evaluate(() => {
    const game = window.skateGame;
    const detachedGeometry = game.geometryCache.get('accessory-cap-crown');
    let emittedDispose = false;
    detachedGeometry.addEventListener('dispose', () => { emittedDispose = true; });
    game.dispose();
    return emittedDispose;
  });

  expect(disposed).toBe(true);
});

test('localSkating_failedLateBootRollsBackAlreadyCreatedRenderer', async ({ page }) => {
  await page.goto('/skate.html');
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'ready');
  const diagnostics = await page.evaluate(async () => {
    const game = window.skateGame;
    game.dispose();
    let disposed = false;
    let created = false;
    const BaseRenderer = window.THREE.WebGLRenderer;
    window.THREE.WebGLRenderer = class TrackingRenderer extends BaseRenderer {
      constructor(...args) {
        super(...args);
        created = true;
        const dispose = this.dispose.bind(this);
        this.dispose = () => {
          disposed = true;
          dispose();
        };
      }
    };
    const previousResizeObserver = window.ResizeObserver;
    const { loadGameAssets } = await import('/js/game/render/game-assets.js');
    const manifest = await (await fetch('/assets/game/manifest.json')).json();
    const assets = await loadGameAssets({ THREE: window.THREE, manifest });
    window.ResizeObserver = class FailingResizeObserver {
      constructor() { throw new Error('forced late boot failure'); }
    };
    const { startSkateGame } = await import('/js/game/main.js');
    let failure = null;
    try {
      startSkateGame({ root: document.querySelector('#game-root'), THREE: window.THREE, assets });
    } catch (error) {
      failure = error.message;
      // The browser bootstrap presents this error; this test checks its rollback.
    } finally {
      window.THREE.WebGLRenderer = BaseRenderer;
      window.ResizeObserver = previousResizeObserver;
    }
    return { disposed, created, failure };
  });

  expect(diagnostics.created).toBe(true);
  expect(diagnostics.failure).toContain('forced late boot failure');
  expect(diagnostics.disposed).toBe(true);
});

test('localSkating_disposeStopsFramesAndDisconnectsResizeObserver', async ({ page }) => {
  await page.addInitScript(() => {
    const BaseObserver = window.ResizeObserver;
    window.__skateObserverDisconnects = 0;
    window.ResizeObserver = class TrackingResizeObserver extends BaseObserver {
      disconnect() {
        window.__skateObserverDisconnects += 1;
        return super.disconnect();
      }
    };
  });
  await page.goto('/skate.html');
  await page.getByRole('button', { name: 'Join City' }).click();
  await page.waitForFunction(() => window.skateGame.skaterState.tick > 0);
  const disposed = await page.evaluate(() => {
    const game = window.skateGame;
    let rendersAfterDispose = 0;
    const render = game.renderer.render.bind(game.renderer);
    game.renderer.render = (...args) => {
      rendersAfterDispose += 1;
      return render(...args);
    };
    const tickAtDispose = game.skaterState.tick;
    game.dispose();
    return {
      tickAtDispose,
      gameMode: game.session.getState().mode,
      rootState: document.querySelector('#game-root').dataset.gameState,
      observerDisconnects: window.__skateObserverDisconnects,
      rendersAfterDispose,
    };
  });

  await page.setViewportSize({ width: 980, height: 720 });
  await page.waitForTimeout(150);
  const afterDelay = await page.evaluate(() => ({
    tick: window.skateGame.skaterState.tick,
    gameMode: window.skateGame.session.getState().mode,
    observerDisconnects: window.__skateObserverDisconnects,
  }));

  expect(disposed).toMatchObject({
    gameMode: 'disposed',
    rootState: 'disposed',
    observerDisconnects: 1,
    rendersAfterDispose: 0,
  });
  expect(afterDelay.tick).toBe(disposed.tickAtDispose);
  expect(afterDelay.gameMode).toBe('disposed');
  expect(afterDelay.observerDisconnects).toBe(1);
});
