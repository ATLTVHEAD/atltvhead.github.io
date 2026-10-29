import { COMBO_TUNING } from '../core/trick-combo.js';

function setText(element, value) {
  if (element && element.textContent !== value) element.textContent = value;
}

function finiteScore(value) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function announcementFor(lastAction) {
  if (!lastAction) return '';
  if (finiteScore(lastAction.bankedScore) > 0) {
    return `${lastAction.label} landed. ${Math.floor(lastAction.bankedScore)} points banked.`;
  }
  if (finiteScore(lastAction.basePoints) > 0) {
    return `${lastAction.label} completed. ${Math.floor(lastAction.basePoints)} base points pending.`;
  }
  return lastAction.label ?? '';
}

export function renderPlayFeedback(root, {
  skater,
  combo,
  lastAction,
  socialStatus,
  quality,
} = {}) {
  void socialStatus;
  void quality;
  const panel = root?.querySelector?.('#play-feedback');
  if (!panel) return;

  const base = finiteScore(combo?.pendingBase);
  const hasLink = Number.isSafeInteger(combo?.lastLinkTick)
    && Number.isSafeInteger(skater?.tick);
  const elapsedLinkMs = hasLink
    ? ((skater.tick - combo.lastLinkTick) * 1000) / COMBO_TUNING.simulationHz
    : 0;
  const linkExpired = hasLink
    && (elapsedLinkMs < 0 || elapsedLinkMs > COMBO_TUNING.linkWindowMs);
  const multiplier = !linkExpired && Number.isFinite(combo?.multiplier) && combo.multiplier >= 1
    ? combo.multiplier
    : COMBO_TUNING.multiplierStart;
  const projected = Math.floor(base * multiplier);
  const banked = Math.floor(finiteScore(combo?.bankedScore));
  setText(panel.querySelector('[data-pending-score]'), String(projected));
  setText(panel.querySelector('[data-banked-score]'), String(banked));
  setText(panel.querySelector('[data-multiplier]'), `×${multiplier}`);

  const balance = Number.isFinite(skater?.balance)
    ? Math.max(-1, Math.min(1, skater.balance))
    : 0;
  const balanceMeter = panel.querySelector('[data-balance-meter]');
  if (balanceMeter) balanceMeter.value = balance;
  const balanceLabel = skater?.mode === 'grinding'
    ? `Balance ${balance > 0 ? '+' : ''}${balance.toFixed(2)}`
    : skater?.mode === 'airborne'
      ? 'Airborne'
      : 'Ready';
  setText(panel.querySelector('[data-balance-value]'), balanceLabel);

  const actionText = lastAction
    ? `${lastAction.label}${finiteScore(lastAction.bankedScore) > 0
      ? ` · banked ${Math.floor(lastAction.bankedScore)}`
      : finiteScore(lastAction.basePoints) > 0
        ? ` · +${Math.floor(lastAction.basePoints)}`
        : ''}`
    : 'No trick yet';
  setText(panel.querySelector('[data-last-action]'), actionText);

  const announcement = panel.querySelector('[data-feedback-announcement]');
  if (!lastAction?.eventId) {
    if (announcement) announcement.dataset.eventId = '';
    setText(announcement, '');
  } else if (announcement?.dataset.eventId !== lastAction.eventId) {
    announcement.dataset.eventId = lastAction.eventId;
    setText(announcement, announcementFor(lastAction));
  }
}
