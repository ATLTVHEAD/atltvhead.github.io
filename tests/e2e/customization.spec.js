import { expect, test } from '@playwright/test';

test('customization_updatesGuestPreviewWithoutPersisting', async ({ page }) => {
  await page.goto('/skate.html');
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'ready');

  const defaults = await page.evaluate(() => (
    window.skateGame.avatar?.userData.appearance ?? null
  ));
  expect(defaults).toEqual({ color: '#FF006E', accessoryIds: [] });
  await page.evaluate(() => {
    const game = window.skateGame;
    const render = game.renderer.render.bind(game.renderer);
    game.formChangeRenderCount = 0;
    game.renderer.render = (scene, camera) => {
      game.formChangeRenderCount += 1;
      return render(scene, camera);
    };
  });

  await page.locator('#skater-color').evaluate((input) => {
    input.value = '#36a6ff';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.getByLabel('Cap accessory').check();
  await expect(page.getByRole('button', { name: 'Join City' })).toBeVisible();

  const preview = await page.evaluate(() => {
    const game = window.skateGame;
    const avatar = game.avatar;
    return {
      appearance: avatar.userData.appearance,
      torsoColor: avatar.getObjectByName('body').material.color.getHexString(),
      capVisible: avatar.getObjectByName('accessory-cap')?.visible ?? false,
      attachedToCity: avatar.parent === game.city,
      screenX: (avatar.position.clone().project(game.camera).x + 1) / 2,
      renderCount: game.formChangeRenderCount,
    };
  });

  expect(preview).toEqual({
    appearance: { color: '#36A6FF', accessoryIds: ['cap'] },
    torsoColor: '36a6ff',
    capVisible: true,
    attachedToCity: true,
    screenX: expect.any(Number),
    renderCount: expect.any(Number),
  });
  expect(preview.screenX).toBeGreaterThan(0.45);
  expect(preview.screenX).toBeLessThan(0.75);
  expect(preview.renderCount).toBeGreaterThan(0);
  await page.screenshot({ path: 'test-results/customization-preview.png' });

  await page.reload();
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'ready');
  const reloaded = await page.evaluate(() => ({
    appearance: window.skateGame.avatar?.userData.appearance ?? null,
    colorInput: document.querySelector('#skater-color').value.toUpperCase(),
    capChecked: document.querySelector('#accessory-cap').checked,
  }));

  expect(reloaded).toEqual({
    appearance: { color: '#FF006E', accessoryIds: [] },
    colorInput: '#FF006E',
    capChecked: false,
  });
});
