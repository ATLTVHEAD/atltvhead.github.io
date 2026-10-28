import { expect, test } from '@playwright/test';

test('inputDevices_standardGamepadMovesAndJumpsInTheLocalLoop', async ({ page }) => {
  await page.addInitScript(() => {
    const gamepad = {
      connected: true,
      id: 'TVHead Test Pad',
      index: 0,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    };
    window.testGamepad = gamepad;
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => [window.testGamepad],
    });
  });

  await page.goto('/skate.html');
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'ready');
  await page.getByRole('button', { name: 'Join City' }).click();

  await page.evaluate(() => { window.testGamepad.axes[1] = -1; });
  await page.waitForFunction(() => window.skateGame.skaterState.speed >= 4, null, { timeout: 5_000 });
  await page.evaluate(() => {
    window.testGamepad.axes[1] = 0;
    window.testGamepad.buttons[0] = { pressed: true, value: 1 };
  });
  await page.waitForFunction(
    () => window.skateGame.lastEvents.some((event) => event.type === 'jumped'),
    null,
    { timeout: 5_000 },
  );
});

test('inputDevices_unsupportedGamepadShowsKeyboardAndTouchFallback', async ({ page }) => {
  await page.addInitScript(() => {
    window.testGamepad = {
      connected: true,
      id: 'Unsupported Test Pad',
      index: 0,
      mapping: '',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    };
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => [window.testGamepad],
    });
  });

  await page.goto('/skate.html');
  await page.getByRole('button', { name: 'Join City' }).click();
  await expect(page.locator('#input-status'))
    .toContainText(/unsupported.*keyboard.*touch/i, { timeout: 5_000 });
  await expect(page.locator('#input-status')).toBeVisible();

  await page.getByRole('button', { name: 'Leave City' }).click();
  await expect(page.locator('#input-status')).toBeHidden();
  await page.getByRole('button', { name: 'Join City' }).click();
  await expect(page.locator('#input-status')).toBeVisible();
});

test('inputDevices_touchStickAndButtonsDrivePlayOnMobile', async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:8000',
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  await page.goto('/skate.html');
  await page.getByRole('button', { name: 'Join City' }).click();
  const touchControls = page.locator('#touch-controls');
  await expect(touchControls).toBeVisible();
  await expect(page.locator('[data-touch-action="grind"]')).toHaveCount(0);
  const portraitLayout = await page.evaluate(() => {
    const { THREE, skateGame } = window;
    const card = document.querySelector('.skate-card').getBoundingClientRect();
    const controls = [
      document.querySelector('[data-touch-stick]').getBoundingClientRect(),
      document.querySelector('.touch-action-group').getBoundingClientRect(),
    ];
    const center = skateGame.avatar.position.clone().add(
      new THREE.Vector3(0, 2.1, 0).applyQuaternion(skateGame.avatar.quaternion),
    ).project(skateGame.camera);
    const player = {
      left: (center.x + 1) * innerWidth / 2 - 12,
      right: (center.x + 1) * innerWidth / 2 + 12,
      top: (1 - center.y) * innerHeight / 2 - 20,
      bottom: (1 - center.y) * innerHeight / 2 + 20,
    };
    const overlaps = (a, b) => a.left < b.right && a.right > b.left
      && a.top < b.bottom && a.bottom > b.top;
    return {
      playerVisible: center.z >= -1 && center.z <= 1
        && player.left >= 0 && player.right <= innerWidth
        && player.top >= 0 && player.bottom <= innerHeight,
      playerCovered: overlaps(player, card) || controls.some((control) => overlaps(player, control)),
      cardOverlapsControls: controls.some((control) => overlaps(card, control)),
    };
  });
  expect(portraitLayout.playerVisible).toBe(true);
  expect(portraitLayout.playerCovered).toBe(false);
  expect(portraitLayout.cardOverlapsControls).toBe(false);
  const jumpButton = page.locator('[data-touch-action="jump"]');
  const jumpSize = await jumpButton.evaluate((button) => {
    const bounds = button.getBoundingClientRect();
    return { width: bounds.width, height: bounds.height };
  });
  expect(jumpSize.width).toBeGreaterThanOrEqual(44);
  expect(jumpSize.height).toBeGreaterThanOrEqual(44);

  await page.evaluate(() => {
    const root = document.querySelector('#touch-controls');
    const stick = root.querySelector('[data-touch-stick]');
    const bounds = stick.getBoundingClientRect();
    const send = (target, type, pointerId, x, y) => target.dispatchEvent(new PointerEvent(type, {
      bubbles: true,
      pointerId,
      pointerType: 'touch',
      clientX: x,
      clientY: y,
      button: 0,
    }));
    send(stick, 'pointerdown', 501, bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
    send(root, 'pointermove', 501, bounds.left + bounds.width / 2, bounds.top + 12);
  });
  await page.waitForFunction(() => window.skateGame.skaterState.speed >= 4, null, { timeout: 5_000 });

  await page.evaluate(() => {
    const root = document.querySelector('#touch-controls');
    const jump = root.querySelector('[data-touch-action="jump"]');
    jump.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      pointerId: 502,
      pointerType: 'touch',
      clientX: 300,
      clientY: 700,
      button: 0,
    }));
  });
  await page.waitForFunction(
    () => window.skateGame.lastEvents.some((event) => event.type === 'jumped'),
    null,
    { timeout: 5_000 },
  );

  await page.waitForFunction(() => window.skateGame.skaterState.mode === 'grounded');
  const firstJumpTick = await page.evaluate(() => Math.max(
    ...window.skateGame.lastEvents
      .filter((event) => event.type === 'jumped')
      .map((event) => event.tick),
  ));
  await jumpButton.focus();
  await page.keyboard.press('Space');
  await page.waitForFunction((tick) => window.skateGame.lastEvents.some(
    (event) => event.type === 'jumped' && event.tick > tick,
  ), firstJumpTick, { timeout: 5_000 });
  await page.waitForFunction(() => window.skateGame.skaterState.mode === 'grounded');

  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => {
    const size = window.skateGame.renderer.getSize(new window.THREE.Vector2());
    return Math.round(size.x) === 844 && Math.round(size.y) === 390;
  }, null, { timeout: 5_000 });
  await expect(touchControls).toBeVisible();

  const landscapeLayout = await page.evaluate(() => {
    const { THREE, skateGame } = window;
    const card = document.querySelector('.skate-card').getBoundingClientRect();
    const stick = document.querySelector('[data-touch-stick]').getBoundingClientRect();
    const actions = document.querySelector('.touch-action-group').getBoundingClientRect();
    const jump = document.querySelector('[data-touch-action="jump"]').getBoundingClientRect();
    const center = skateGame.avatar.position.clone().add(
      new THREE.Vector3(0, 2.1, 0).applyQuaternion(skateGame.avatar.quaternion),
    ).project(skateGame.camera);
    const player = {
      left: (center.x + 1) * innerWidth / 2 - 12,
      right: (center.x + 1) * innerWidth / 2 + 12,
      top: (1 - center.y) * innerHeight / 2 - 20,
      bottom: (1 - center.y) * innerHeight / 2 + 20,
    };
    const overlaps = (a, b) => a.left < b.right && a.right > b.left
      && a.top < b.bottom && a.bottom > b.top;
    return {
      card: { left: card.left, right: card.right, top: card.top, bottom: card.bottom },
      controls: [stick, actions].map((control) => ({
        left: control.left,
        right: control.right,
        top: control.top,
        bottom: control.bottom,
      })),
      jump: { width: jump.width, height: jump.height },
      playerVisible: center.z >= -1 && center.z <= 1
        && player.left >= 0 && player.right <= innerWidth
        && player.top >= 0 && player.bottom <= innerHeight,
      playerCoveredByCard: overlaps(player, card),
      playerCoveredByControls: [stick, actions].some((control) => overlaps(player, control)),
      cardOverlapsControls: [stick, actions].some((control) => overlaps(card, control)),
    };
  });
  expect(landscapeLayout.playerVisible).toBe(true);
  expect(landscapeLayout.playerCoveredByCard).toBe(false);
  expect(landscapeLayout.playerCoveredByControls).toBe(false);
  expect(landscapeLayout.cardOverlapsControls, JSON.stringify(landscapeLayout)).toBe(false);
  expect(landscapeLayout.jump.width).toBeGreaterThanOrEqual(44);
  expect(landscapeLayout.jump.height).toBeGreaterThanOrEqual(44);

  const previousJumpTick = await page.evaluate(() => Math.max(
    ...window.skateGame.lastEvents
      .filter((event) => event.type === 'jumped')
      .map((event) => event.tick),
  ));
  await page.evaluate(() => {
    const root = document.querySelector('#touch-controls');
    const jump = root.querySelector('[data-touch-action="jump"]');
    jump.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      pointerId: 503,
      pointerType: 'touch',
      clientX: 790,
      clientY: 350,
      button: 0,
    }));
  });
  await page.waitForFunction((tick) => window.skateGame.lastEvents.some(
    (event) => event.type === 'jumped' && event.tick > tick,
  ), previousJumpTick, { timeout: 5_000 });
  await context.close();
});
