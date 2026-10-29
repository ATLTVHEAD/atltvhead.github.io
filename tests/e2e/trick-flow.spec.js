import { expect, test } from '@playwright/test';

test('trickFlow_actualOfflineSpinGrabBanksChainAndLeaveResetsIt', async ({ page }) => {
  await page.goto('/skate.html');
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'ready');
  await page.getByRole('button', { name: 'Join City' }).click();
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'playing');
  const pending = page.locator('[data-pending-score]');
  const banked = page.locator('[data-banked-score]');

  await expect(pending).toHaveText('0');
  await expect(banked).toHaveText('0');
  await page.keyboard.down('Space');
  await page.keyboard.down('j');
  await page.waitForFunction(() => window.skateGame.skaterState.activeTrick?.id === 'spin');
  await page.keyboard.up('Space');
  await page.keyboard.up('j');
  await expect(banked).toHaveText('100', { timeout: 2_000 });
  await page.evaluate(() => {
    window.__pendingScoreHistory = [];
    const score = document.querySelector('[data-pending-score]');
    window.__pendingScoreObserver = new MutationObserver(() => {
      window.__pendingScoreHistory.push(score.textContent);
    });
    window.__pendingScoreObserver.observe(score, { childList: true, characterData: true, subtree: true });
  });
  await page.keyboard.down('Space');
  await page.keyboard.down('k');
  await page.waitForFunction(() => window.skateGame.skaterState.activeTrick?.id === 'grab', null, {
    timeout: 1_000,
  });
  await page.keyboard.up('Space');
  await page.keyboard.up('k');
  await expect(banked).toHaveText('400', { timeout: 3_000 });
  const pendingHistory = await page.evaluate(() => {
    window.__pendingScoreObserver.disconnect();
    return window.__pendingScoreHistory;
  });
  expect(pendingHistory).toContain('300');

  const result = await page.evaluate(() => ({
    mode: window.skateGame.skaterState.mode,
    banked: window.skateGame.session.getState().combo.bankedScore,
    pending: window.skateGame.session.getState().combo.pendingBase,
    lastAction: document.querySelector('[data-last-action]').textContent,
    announcement: document.querySelector('[data-feedback-announcement]').textContent,
  }));
  expect(result.mode).toBe('grounded');
  expect(result.banked).toBe(400);
  expect(result.pending).toBe(0);
  expect(result.lastAction).toContain('Grab');
  expect(result.announcement).toContain('300');

  await page.getByRole('button', { name: 'Leave City' }).click();
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'ready');
  await page.getByRole('button', { name: 'Join City' }).click();
  await expect(banked).toHaveText('0');
});

test('trickFlow_feedbackAndTouchControlsStayClearAtMobileSizes', async ({ browser }) => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    try {
      await page.goto('/skate.html');
      await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'ready');
      await page.getByRole('button', { name: 'Join City' }).click();
      await expect(page.locator('#touch-controls')).toBeVisible();
      await expect(page.locator('#play-feedback')).toBeVisible();

      const geometry = await page.evaluate(() => {
        const box = (selector) => {
          const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect();
          return { left: x, top: y, right: x + width, bottom: y + height };
        };
        const game = window.skateGame;
        game.avatar.updateMatrixWorld(true);
        game.camera.updateMatrixWorld(true);
        const bounds = new window.THREE.Box3().setFromObject(game.avatar);
        const projected = [];
        for (const x of [bounds.min.x, bounds.max.x]) {
          for (const y of [bounds.min.y, bounds.max.y]) {
            for (const z of [bounds.min.z, bounds.max.z]) {
              const point = new window.THREE.Vector3(x, y, z).project(game.camera);
              if (point.z >= -1 && point.z <= 1) projected.push(point);
            }
          }
        }
        const player = projected.length > 0 ? {
          left: Math.min(...projected.map((point) => (point.x + 1) * window.innerWidth / 2)),
          right: Math.max(...projected.map((point) => (point.x + 1) * window.innerWidth / 2)),
          top: Math.min(...projected.map((point) => (1 - point.y) * window.innerHeight / 2)),
          bottom: Math.max(...projected.map((point) => (1 - point.y) * window.innerHeight / 2)),
          visible: true,
        } : { left: 0, right: 0, top: 0, bottom: 0, visible: false };
        return {
          card: box('.skate-card'),
          feedback: box('#play-feedback'),
          touch: box('#touch-controls'),
          player,
        };
      });
      expect(geometry.feedback.top).toBeGreaterThanOrEqual(geometry.card.top);
      expect(geometry.feedback.bottom).toBeLessThanOrEqual(geometry.card.bottom);
      expect(geometry.card.bottom + 8).toBeLessThan(geometry.touch.top);
      expect(geometry.player.visible).toBe(true);
      const overlaps = (first, second) => first.left < second.right && first.right > second.left
        && first.top < second.bottom && first.bottom > second.top;
      expect(overlaps(geometry.player, geometry.card), JSON.stringify({ viewport, geometry }))
        .toBe(false);
      expect(overlaps(geometry.player, geometry.touch), JSON.stringify({ viewport, geometry }))
        .toBe(false);
    } finally {
      await context.close();
    }
  }
});

test('trickFlow_realLineGrindUpdatesBalanceAndScoreFeedbackOffline', async ({ page }) => {
  await page.goto('/skate.html?testSpawnId=spawn-skate-line');
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'ready');
  await page.getByRole('button', { name: 'Join City' }).click();
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'playing');
  await page.evaluate(() => {
    window.__grindFeedbackSamples = [];
    const sample = () => {
      const state = window.skateGame?.skaterState;
      const label = document.querySelector('[data-balance-value]')?.textContent ?? '';
      if (state?.mode === 'grinding' && label.startsWith('Balance')) {
        window.__grindFeedbackSamples.push({
          balance: state.balance,
          meter: Number(document.querySelector('[data-balance-meter]').value),
          label,
        });
      }
      if (window.skateGame?.session.getState().mode === 'playing') requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.keyboard.down('w');
  try {
    await page.waitForFunction(() => window.__grindFeedbackSamples.length > 0, null, {
      timeout: 5_000,
    });
    const balanceFeedback = await page.evaluate(() => window.__grindFeedbackSamples[0]);
    expect(balanceFeedback.label).toContain('Balance');
    expect(balanceFeedback.meter).toBeCloseTo(balanceFeedback.balance, 2);

    await page.waitForFunction(() => {
      const pending = Number(document.querySelector('[data-pending-score]').textContent);
      const banked = Number(document.querySelector('[data-banked-score]').textContent);
      return pending > 0 || banked > 0;
    }, null, { timeout: 5_000 });

    const feedback = await page.evaluate(() => ({
      pending: Number(document.querySelector('[data-pending-score]').textContent),
      banked: Number(document.querySelector('[data-banked-score]').textContent),
      status: document.querySelector('#connection-state').textContent,
    }));
    expect(feedback.pending + feedback.banked).toBeGreaterThan(0);
    expect(feedback.status).toContain('offline');
  } finally {
    await page.keyboard.up('w');
  }
});

test('combo_wrapCrossingDoesNotDuplicateOrResetActions', async ({ page }) => {
  await page.goto('/skate.html?testSpawnId=spawn-wrap-x');
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'ready');
  await page.getByRole('button', { name: 'Join City' }).click();
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'playing');
  await page.evaluate(() => {
    window.__seamCombo = { crossed: false, events: [] };
    let previousX = null;
    const seen = new Set();
    const sample = () => {
      const game = window.skateGame;
      const state = game?.skaterState;
      if (state) {
        const x = state.position[0];
        if (previousX !== null && previousX > 250 && x < 8) window.__seamCombo.crossed = true;
        previousX = x;
        for (const event of game.lastEvents) {
          if (!seen.has(event.eventId)) {
            seen.add(event.eventId);
            window.__seamCombo.events.push({ ...event });
          }
        }
      }
      if (game?.session.getState().mode === 'playing') requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });

  await page.keyboard.down('w');
  try {
    await page.waitForFunction(() => {
      const state = window.skateGame.skaterState;
      return state.mode === 'grounded' && state.position[0] > 252 && state.speed >= 3;
    }, null, { timeout: 10_000 });
    await page.keyboard.down('Space');
    await page.keyboard.down('j');
    await page.waitForFunction(() => window.skateGame.skaterState.activeTrick?.id === 'spin');
    await page.keyboard.up('Space');
    await page.keyboard.up('j');

    await page.waitForFunction(() => window.__seamCombo.crossed
      && window.skateGame.skaterState.combo.pendingBase === 100, null, { timeout: 3_000 });
    await page.waitForFunction(() => window.skateGame.skaterState.mode === 'grounded'
      && window.skateGame.session.getState().combo.bankedScore === 100, null, {
      timeout: 3_000,
    });
  } finally {
    await page.keyboard.up('w');
    await page.keyboard.up('Space');
    await page.keyboard.up('j');
  }

  const result = await page.evaluate(() => ({
    state: window.skateGame.skaterState,
    comboAlias: window.skateGame.session.getState().combo,
    events: window.__seamCombo.events,
    crossed: window.__seamCombo.crossed,
  }));
  expect(result.crossed).toBe(true);
  expect(result.state.combo).toBe(result.comboAlias);
  expect(result.state.combo.bankedScore).toBe(100);
  expect(result.state.combo.pendingBase).toBe(0);
  expect(result.state.combo.actionCounts.spin).toBe(1);
  expect(new Set(result.events.map((event) => event.eventId)).size).toBe(result.events.length);
  expect(result.events.filter((event) => event.type === 'trickCompleted')).toHaveLength(1);
});
