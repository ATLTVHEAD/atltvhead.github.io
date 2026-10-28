import { expect, test } from '@playwright/test';

test('localSkating_joinMovesJumpsAndLeavesWithoutABackend', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/skate.html');
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'ready');

  const start = await page.evaluate(() => window.skateGame.skaterState.position);
  await page.getByRole('button', { name: 'Join City' }).click();
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'playing');
  const playerFrame = await page.evaluate(() => {
    const { THREE, skateGame } = window;
    return {
      boomLength: skateGame.cameraState.actualBoomLength,
      cameraPosition: skateGame.camera.position.toArray(),
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
  }, start);
  await page.waitForFunction((initial) => {
    const camera = window.skateGame.camera.position.toArray();
    return Math.hypot(...camera.map((value, axis) => value - initial[axis])) > 0.2;
  }, playerFrame.cameraPosition);
  await page.waitForFunction(() => window.skateGame.avatar.position.distanceTo(
    new window.THREE.Vector3(...window.skateGame.skaterState.position),
  ) < 1e-4);

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
  expect(await page.evaluate(() => window.skateGame.skaterState.forward)).toEqual(heading);
  await page.screenshot({ path: 'artifacts/skate-progress/task-6-playable-portrait.png' });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForFunction(() => {
    const size = window.skateGame.renderer.getSize(new window.THREE.Vector2());
    return Math.round(size.x) === 1280 && Math.round(size.y) === 800;
  }, null, { timeout: 5_000 });
  expect(await page.evaluate(() => window.skateGame.skaterState.forward)).toEqual(heading);
});

test('localSkating_previewOrbitReturnsToFollowCameraInputWhenPlaying', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/skate.html');
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
    window.ResizeObserver = class FailingResizeObserver {
      constructor() { throw new Error('forced late boot failure'); }
    };
    const { startSkateGame } = await import('/js/game/main.js');
    let failure = null;
    try {
      startSkateGame({ root: document.querySelector('#game-root'), THREE: window.THREE });
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
