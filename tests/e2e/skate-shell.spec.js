import { expect, test } from '@playwright/test';

test('skateShell_hasCanvasAndJoinControls', async ({ page }) => {
  await page.goto('/skate.html');

  await expect(page.getByRole('heading', { name: 'TVHead Skate City' })).toBeVisible();
  await expect(page.locator('#game-canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Join City' })).toBeVisible();
});

test('skateShell_exposesRuntimeCustomizationAndHelp', async ({ page }) => {
  await page.goto('/skate.html');

  await expect(page.getByLabel('Skater color')).toHaveAttribute('type', 'color');
  await expect(page.getByLabel('Cap accessory')).toBeVisible();
  await expect(page.getByText(/WASD.*steer/i)).toBeVisible();
  await expect(page.getByText(/Space.*jump/i)).toBeVisible();
});

test('skateShell_loadsLocalLibrariesWithoutJavascriptErrors', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/skate.html');
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'ready');

  expect(pageErrors).toEqual([]);
});
