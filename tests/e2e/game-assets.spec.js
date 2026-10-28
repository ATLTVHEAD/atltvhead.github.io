import { test, expect } from '@playwright/test';

test('assets_failedTextureOffersRetry', async ({ page }) => {
  let fail = true;
  await page.route('**/assets/game/kenney-industrial/Textures/colormap.png', async (route) => {
    if (fail) await route.abort();
    else await route.continue();
  });
  await page.goto('/skate.html');
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'error');
  await expect(page.locator('#game-error-message')).toContainText(/asset/i);
  fail = false;
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'ready');
  await expect(page.getByRole('button', { name: 'Join City' })).toBeEnabled();
  expect(await page.locator('#game-canvas').count()).toBe(1);
});

test('assets_lateLoadAfterRetryDoesNotMountOldScene', async ({ page }) => {
  let release;
  const blocked = new Promise((resolve) => { release = resolve; });
  let seen = false;
  await page.route('**/assets/game/kenney-industrial/building-a.glb?*', async (route) => {
    if (!seen) { seen = true; await blocked; }
    await route.continue().catch(() => {});
  });
  await page.goto('/skate.html');
  await expect.poll(() => seen).toBe(true);
  await page.locator('#retry-game').evaluate((button) => button.click());
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'ready');
  const first = await page.evaluate(() => Boolean(window.skateGame));
  expect(first).toBeTruthy();
  await page.evaluate(() => { window.__mountedAfterRetry = window.skateGame; });
  release();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.skateGame === window.__mountedAfterRetry)).toBe(true);
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'ready');
  expect(await page.locator('#game-canvas').count()).toBe(1);
});

test('assets_rejectsTamperedModel', async ({ page }) => {
  await page.route('**/assets/game/kenney-industrial/building-a.glb?*', async (route) => {
    await route.fulfill({ status: 200, body: 'tampered asset' });
  });
  await page.goto('/skate.html');
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'error');
  await expect(page.getByRole('button', { name: 'Join City' })).toBeDisabled();
});
