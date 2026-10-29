import { describe, expect, it } from 'vitest';
import { renderPlayFeedback } from '../../js/game/ui/play-feedback.js';

function makeFeedbackRoot() {
  const selectors = [
    '[data-pending-score]', '[data-banked-score]', '[data-multiplier]',
    '[data-balance-meter]', '[data-balance-value]', '[data-last-action]',
    '[data-feedback-announcement]',
  ];
  const elements = new Map(selectors.map((selector) => [selector, {
    textContent: '',
    value: 0,
    dataset: {},
  }]));
  const panel = { querySelector: (selector) => elements.get(selector) ?? null };
  const root = { querySelector: (selector) => selector === '#play-feedback' ? panel : null };
  return { root, elements };
}

describe('play feedback HUD', () => {
  it('playFeedback_displaysResetMultiplierAfterTheInclusiveLinkWindow', () => {
    const { root, elements } = makeFeedbackRoot();
    const view = (tick) => renderPlayFeedback(root, {
      skater: { mode: 'grounded', tick },
      combo: {
        pendingBase: 150,
        multiplier: 2,
        bankedScore: 100,
        lastLinkTick: 10,
      },
    });

    view(100);
    expect(elements.get('[data-multiplier]').textContent).toBe('×2');
    expect(elements.get('[data-pending-score]').textContent).toBe('300');

    view(101);
    expect(elements.get('[data-multiplier]').textContent).toBe('×1');
    expect(elements.get('[data-pending-score]').textContent).toBe('150');
  });
});
