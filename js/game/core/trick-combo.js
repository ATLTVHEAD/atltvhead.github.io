import { getTrickAction } from '../shared/catalogs.js';

export const COMBO_TUNING = Object.freeze({
  spinPoints: 100,
  grabPoints: 150,
  repeatPointsNumerator: 1,
  repeatPointsDenominator: 2,
  grindPointsPerSecond: 50,
  grindMinimumSpeed: 2,
  multiplierStart: 1,
  multiplierMaximum: 5,
  linkWindowMs: 1500,
  simulationHz: 60,
  maximumStepSeconds: 0.1,
});

export function createComboState() {
  return {
    pendingBase: 0,
    multiplier: COMBO_TUNING.multiplierStart,
    bankedScore: 0,
    actionCounts: { spin: 0, grab: 0 },
    distinctActionCount: 0,
    lastLinkTick: null,
    lastProcessedEventIndex: 0,
    activeGrindIntervalId: null,
    activeGrindPathId: null,
    activeGrindScored: false,
  };
}

function copyCombo(combo) {
  return {
    ...createComboState(),
    ...(combo ?? {}),
    actionCounts: { ...(combo?.actionCounts ?? {}) },
  };
}

function resetChain(combo, { discardPending = true, preserveGrind = false } = {}) {
  if (discardPending) combo.pendingBase = 0;
  combo.multiplier = COMBO_TUNING.multiplierStart;
  combo.actionCounts = { spin: 0, grab: 0 };
  combo.distinctActionCount = 0;
  combo.lastLinkTick = null;
  if (!preserveGrind) {
    combo.activeGrindIntervalId = null;
    combo.activeGrindPathId = null;
    combo.activeGrindScored = false;
  }
}

function expireLink(combo, tick, tuning) {
  if (!Number.isSafeInteger(combo.lastLinkTick) || !Number.isSafeInteger(tick)) return;
  if (tick < combo.lastLinkTick) {
    resetChain(combo, { discardPending: false, preserveGrind: true });
    return;
  }
  const elapsedMs = ((tick - combo.lastLinkTick) * 1000) / tuning.simulationHz;
  if (elapsedMs > tuning.linkWindowMs) {
    resetChain(combo, { discardPending: false, preserveGrind: true });
  }
}

function addDistinctAction(combo, tuning) {
  if (combo.distinctActionCount > 0) {
    combo.multiplier = Math.min(tuning.multiplierMaximum, combo.multiplier + 1);
  }
  combo.distinctActionCount += 1;
}

function validGrindProgress(event, world, tuning) {
  const path = world?.rails?.find((candidate) => candidate.id === event.pathId);
  const distance = Math.abs(event.signedDistanceAdvanced);
  const duration = event.deltaSeconds;
  return Boolean(path)
    && Number.isFinite(path.totalLength) && path.totalLength > 0
    && Number.isFinite(event.speed) && event.speed >= tuning.grindMinimumSpeed
    && Number.isFinite(distance) && distance > 0
    && Number.isFinite(duration) && duration > 0 && duration <= tuning.maximumStepSeconds
    && distance <= event.speed * duration + 1e-6;
}

function reduceTrick(combo, event, tuning) {
  const action = getTrickAction(event.trickId);
  if (!action) return;
  expireLink(combo, event.tick, tuning);
  const basePoints = Number.isFinite(tuning[`${action.id}Points`])
    ? tuning[`${action.id}Points`]
    : action.basePoints;

  const previousCount = combo.actionCounts[event.trickId] ?? 0;
  if (previousCount === 0) {
    if (combo.distinctActionCount > 0) {
      combo.multiplier = Math.min(tuning.multiplierMaximum, combo.multiplier + 1);
    }
    combo.distinctActionCount += 1;
    combo.actionCounts[event.trickId] = 1;
    combo.pendingBase += basePoints;
  } else if (previousCount === 1) {
    combo.actionCounts[event.trickId] = 2;
    combo.pendingBase += Math.floor(
      (basePoints * tuning.repeatPointsNumerator) / tuning.repeatPointsDenominator,
    );
  }
}

export function reduceCombo(combo, event, world, tuningOverrides = {}) {
  if (!Number.isSafeInteger(event?.eventIndex)
      || event.eventIndex <= (combo?.lastProcessedEventIndex ?? 0)) return combo;

  const tuning = { ...COMBO_TUNING, ...tuningOverrides };
  const next = copyCombo(combo);
  next.lastProcessedEventIndex = event.eventIndex;

  if (event.type === 'trickCompleted') {
    reduceTrick(next, event, tuning);
  } else if (event.type === 'landed') {
    expireLink(next, event.tick, tuning);
    if (next.pendingBase > 0) {
      next.bankedScore += Math.floor(next.pendingBase * next.multiplier);
      next.pendingBase = 0;
      next.lastLinkTick = Number.isSafeInteger(event.tick) ? event.tick : null;
    }
  } else if (event.type === 'grindStarted') {
    const path = world?.rails?.find((candidate) => candidate.id === event.pathId);
    next.activeGrindIntervalId = path && typeof event.eventId === 'string'
      ? event.eventId
      : null;
    next.activeGrindPathId = next.activeGrindIntervalId ? event.pathId : null;
    next.activeGrindScored = false;
  } else if (event.type === 'grindProgress') {
    if (event.intervalId !== next.activeGrindIntervalId
        || event.pathId !== next.activeGrindPathId
        || !validGrindProgress(event, world, tuning)) return next;
    expireLink(next, event.tick, tuning);
    if (!next.activeGrindScored) {
      addDistinctAction(next, tuning);
      next.activeGrindScored = true;
    }
    next.pendingBase += tuning.grindPointsPerSecond * event.deltaSeconds;
  } else if (event.type === 'grindEnded') {
    if (event.reason === 'balance-failure') resetChain(next);
    else {
      next.activeGrindIntervalId = null;
      next.activeGrindPathId = null;
      next.activeGrindScored = false;
    }
  } else if (event.type === 'bailed') {
    resetChain(next);
  }

  return next;
}
