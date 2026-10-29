import { expect, test } from '@playwright/test';

async function openLineSpawn(page) {
  await page.goto('/skate.html?testSpawnId=spawn-skate-line');
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'ready');
  await page.getByRole('button', { name: 'Join City' }).click();
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'playing');
  await page.waitForFunction(() => window.skateGame.skaterState.spawnId === 'spawn-skate-line',
    null, { timeout: 5_000 });
  await page.evaluate(() => {
    window.__lineTraversal = { events: [], positions: [] };
    const seen = new Set();
    const sample = () => {
      const game = window.skateGame;
      if (game?.session.getState().mode === 'playing') {
        const state = game.skaterState;
        window.__lineTraversal.positions.push([...state.position]);
        for (const event of game.lastEvents) {
          if (!seen.has(event.eventId)) {
            seen.add(event.eventId);
            window.__lineTraversal.events.push({ ...event });
          }
        }
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

async function waitForLineCompletion(page) {
  await page.waitForFunction(() => {
    const types = new Set(window.__lineTraversal?.events.map((event) => event.type));
    return ['launched', 'grindStarted', 'grindEnded', 'landed'].every((type) => types.has(type));
  }, null, { timeout: 30_000 });
}

async function verifyLineCompletion(page) {
  const result = await page.evaluate(() => ({
    events: window.__lineTraversal.events,
    positions: window.__lineTraversal.positions,
    state: window.skateGame.skaterState,
    cameraUp: window.skateGame.camera.up.toArray(),
    tuningVersion: window.skateGame.playWorld.descriptor.tuningVersion,
  }));
  expect(result.tuningVersion).toBe(2);
  expect(result.events.map((event) => event.type)).toEqual([
    'launched', 'grindStarted', 'grindEnded', 'landed',
  ]);
  expect(result.events.map((event) => event.eventIndex)).toEqual([1, 2, 3, 4]);
  expect(new Set(result.events.map((event) => event.eventId)).size).toBe(4);
  expect(result.events[0]).toMatchObject({ markerId: 'launch-lip-smooth-crest', verticalSpeed: 4 });
  expect(result.events[0].speed).toBeGreaterThanOrEqual(3);
  expect(result.events[1]).toMatchObject({ pathId: 'line-pipe-capture', direction: 1 });
  expect(result.events[2]).toMatchObject({ pathId: 'line-pipe-capture', reason: 'endpoint' });
  expect(result.events[3].surfaceId).toBeTruthy();
  expect(Math.max(...result.positions.map((position) => position[0]))).toBeGreaterThan(150);
  expect(result.state.mode).toBe('grounded');
  expect(result.cameraUp).toEqual([0, 1, 0]);
}

test('traversal_keyboardCompletesTheAuthoredLineWithoutCameraInput', async ({ page }) => {
  await openLineSpawn(page);
  await page.keyboard.down('w');
  try {
    await waitForLineCompletion(page);
  } finally {
    await page.keyboard.up('w');
  }
  await verifyLineCompletion(page);
});

test('traversal_gamepadCompletesTheAuthoredLineWithoutCameraInput', async ({ page }) => {
  await page.addInitScript(() => {
    window.testGamepad = {
      connected: true,
      id: 'Planar traversal test pad',
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
  await openLineSpawn(page);
  await page.evaluate(() => { window.testGamepad.axes[1] = -1; });
  try {
    await waitForLineCompletion(page);
  } finally {
    await page.evaluate(() => { window.testGamepad.axes[1] = 0; });
  }
  await verifyLineCompletion(page);
});

test.describe('touch traversal', () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });

  test('traversal_touchCompletesTheAuthoredLineWithoutCameraInput', async ({ page }) => {
    await openLineSpawn(page);
    const stick = page.locator('[data-touch-stick]');
    await expect(stick).toBeVisible();
    await page.evaluate(() => {
      const zone = document.querySelector('[data-touch-stick]');
      const bounds = zone.getBoundingClientRect();
      const x = bounds.left + bounds.width / 2;
      const y = bounds.top + bounds.height / 2;
      const common = { bubbles: true, pointerId: 7, pointerType: 'touch', isPrimary: true };
      zone.dispatchEvent(new PointerEvent('pointerdown', { ...common, clientX: x, clientY: y }));
      zone.dispatchEvent(new PointerEvent('pointermove', {
        ...common, clientX: x, clientY: y - Math.max(1, bounds.height * 0.45),
      }));
    });
    try {
      await waitForLineCompletion(page);
    } finally {
      await page.evaluate(() => {
        const zone = document.querySelector('[data-touch-stick]');
        zone?.dispatchEvent(new PointerEvent('pointerup', {
          bubbles: true, pointerId: 7, pointerType: 'touch', isPrimary: true,
        }));
      });
    }
    await verifyLineCompletion(page);
  });
});
