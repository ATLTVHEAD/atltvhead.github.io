import { test, expect } from '@playwright/test';

test('controls_playKeepsHintsAndHelpVisible', async ({ page }) => {
  await page.goto('/skate.html');
  await page.getByRole('button', { name: 'Join City' }).click();
  await expect(page.getByRole('button', { name: 'Controls', exact: true })).toBeVisible();
  await expect(page.locator('[data-active-device]')).toBeVisible();
  await page.getByRole('button', { name: 'Controls', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Controls' })).toBeVisible();
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'paused');
  await expect(page.locator('[data-controller-diagnostics]')).toContainText('No gamepad');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Controls' })).toBeHidden();
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'playing');
});

test('controls_confirmCloseDoesNotJump', async ({ page }) => {
  await page.addInitScript(() => {
    window.testGamepad = { connected: true, id: 'Menu Pad', index: 0, mapping: 'standard',
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [window.testGamepad] });
  });
  await page.goto('/skate.html');
  await page.getByRole('button', { name: 'Join City' }).click();
  await page.getByRole('button', { name: 'Controls', exact: true }).click();
  await page.evaluate(() => { window.testGamepad.buttons[0] = { pressed: true, value: 1 }; });
  await expect(page.getByRole('dialog', { name: 'Controls' })).toBeHidden();
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.skateGame.lastEvents.filter((e) => e.type === 'jumped'))).toEqual([]);
});

test('controls_focusStaysInsideDialogUntilClosed', async ({ page }) => {
  await page.goto('/skate.html');
  await page.getByRole('button', { name: 'Join City' }).click();
  await page.getByRole('button', { name: 'Controls', exact: true }).click();
  for (let i = 0; i < 5; i += 1) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.querySelector('#controls-panel').contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('#game-canvas')).toBeFocused();
});

test('controls_nonstandardCalibrationDrivesJump', async ({ page }) => {
  await page.addInitScript(() => {
    window.testGamepad = { connected: true, id: 'Unknown Pad', index: 0, mapping: '',
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [window.testGamepad] });
  });
  await page.goto('/skate.html');
  await page.getByRole('button', { name: 'Join City' }).click();
  await page.getByRole('button', { name: 'Controls', exact: true }).click();
  await page.getByLabel('Controller').selectOption('0');
  await page.getByRole('button', { name: 'Calibrate' }).click();
  const prompt = page.locator('[data-calibration-status]');
  await expect(prompt).not.toContainText('Release controls');
  const axes = [1, -1, 1, 1];
  const labels = ['Move steering right', 'Move throttle forward', 'Move camera right', 'Move camera down'];
  for (let i = 0; i < axes.length; i += 1) {
    await expect(prompt).toContainText(labels[i]);
    await page.evaluate(({ i, value }) => { window.testGamepad.axes[i] = value; }, { i, value: axes[i] });
    await expect(prompt).toContainText('Release controls');
    await page.evaluate((index) => { window.testGamepad.axes[index] = 0; }, i);
    await expect(prompt).not.toContainText('Release controls');
  }
  const buttons = [5, 2, 3, 1, 12, 15, 13, 14, 9, 5, 1];
  for (const [position, index] of buttons.entries()) {
    await page.evaluate((i) => { window.testGamepad.buttons[i] = { pressed: true, value: 1 }; }, index);
    if (position < buttons.length - 1) {
      await expect(prompt).toContainText('Release controls');
    } else {
      await expect(prompt).toContainText('Calibration complete');
    }
    await page.evaluate((i) => { window.testGamepad.buttons[i] = { pressed: false, value: 0 }; }, index);
    await expect(prompt).not.toContainText('Release controls');
  }
  await expect(prompt).toContainText('Calibration complete');
  await page.getByRole('button', { name: 'Return to play' }).click();
  await page.evaluate(() => { window.testGamepad.buttons[5] = { pressed: true, value: 1 }; });
  await page.waitForFunction(() => window.skateGame.lastEvents.some((event) => event.type === 'jumped'));
});

test('controls_gamepadDpadNavigatesDialog', async ({ page }) => {
  await page.addInitScript(() => {
    window.testGamepad = { connected: true, id: 'Menu Pad', index: 0, mapping: 'standard',
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [window.testGamepad] });
  });
  await page.goto('/skate.html');
  await page.getByRole('button', { name: 'Join City' }).click();
  await page.getByRole('button', { name: 'Controls', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Return to play' })).toBeFocused();
  await page.evaluate(() => { window.testGamepad.buttons[13] = { pressed: true, value: 1 }; });
  await page.waitForFunction(() => document.activeElement?.tagName === 'SUMMARY');
  await page.waitForTimeout(250);
  await expect(page.locator('summary')).toBeFocused();
  await page.evaluate(() => { window.testGamepad.buttons[13] = { pressed: false, value: 0 }; });
  await page.waitForTimeout(100);
  await page.evaluate(() => { window.testGamepad.buttons[0] = { pressed: true, value: 1 }; });
  await expect(page.locator('details')).not.toHaveAttribute('open');
  await expect(page.getByRole('dialog', { name: 'Controls' })).toBeVisible();
});

test('controls_diagnosticsReadWhilePaused', async ({ page }) => {
  await page.addInitScript(() => {
    window.testGamepad = { connected: true, id: 'Diagnostic Pad', index: 0, mapping: 'standard',
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [window.testGamepad] });
  });
  await page.goto('/skate.html');
  await page.getByRole('button', { name: 'Join City' }).click();
  await page.getByRole('button', { name: 'Controls', exact: true }).click();
  const tick = await page.evaluate(() => window.skateGame.session.getState().tick);
  await page.evaluate(() => {
    window.testGamepad.axes[1] = -0.5;
    window.testGamepad.buttons[2] = { pressed: true, value: 1 };
  });
  const diagnostics = page.locator('[data-controller-diagnostics]');
  await expect(diagnostics).toContainText('Normalized axes: 0.00, -0.50');
  await expect(diagnostics).toContainText('Normalized buttons: 0.00, 0.00, 1.00');
  expect(await page.evaluate(() => window.skateGame.session.getState().tick)).toBe(tick);
});

test('controls_contextLossWhileOpenCannotResume', async ({ page }) => {
  await page.goto('/skate.html');
  await page.getByRole('button', { name: 'Join City' }).click();
  await page.getByRole('button', { name: 'Controls', exact: true }).click();
  await page.locator('#game-canvas').evaluate((canvas) => canvas.dispatchEvent(
    new Event('webglcontextlost', { cancelable: true }),
  ));
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Controls' })).toBeHidden();
  expect(await page.evaluate(() => window.skateGame.session.getState().mode)).toBe('paused');
});
