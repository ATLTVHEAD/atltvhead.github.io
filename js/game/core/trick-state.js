import { getTrickAction } from '../shared/catalogs.js';

export const TRICK_DURATION_MS = 300;

function makeEvent(state, type, trickId, context = {}) {
  const eventIndex = Number.isSafeInteger(state.eventIndex) ? state.eventIndex + 1 : 1;
  state.eventIndex = eventIndex;
  return {
    eventId: `${state.sessionId ?? 'local'}:${state.tick}:${eventIndex}`,
    eventIndex,
    tick: state.tick,
    type,
    trickId,
    ...context,
  };
}

function copyState(state) {
  return {
    ...state,
    position: Array.isArray(state?.position) ? [...state.position] : state?.position,
    forward: Array.isArray(state?.forward) ? [...state.forward] : state?.forward,
    activeTrick: state?.activeTrick ? { ...state.activeTrick } : null,
  };
}

export function stepTrick(state, input, deltaSeconds, world) {
  const nextState = copyState(state);
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return { state: nextState, events: [] };

  const events = [];
  const active = nextState.activeTrick;
  if (active) {
    if (!getTrickAction(active.id)) {
      nextState.activeTrick = null;
      events.push(makeEvent(nextState, 'trickCanceled', active.id, { reason: 'unknown-action' }));
      return { state: nextState, events };
    }
    if (nextState.mode === 'bailed') {
      nextState.activeTrick = null;
      events.push(makeEvent(nextState, 'trickCanceled', active.id, { reason: 'bail' }));
      return { state: nextState, events };
    }

    const elapsedMs = (Number.isFinite(active.elapsedMs) ? active.elapsedMs : 0)
      + deltaSeconds * 1000;
    if (elapsedMs + 1e-9 >= TRICK_DURATION_MS) {
      nextState.activeTrick = null;
      events.push(makeEvent(nextState, 'trickCompleted', active.id, {
        startedTick: active.startedTick,
        elapsedMs,
      }));
    } else if (input?.landingThisTick || nextState.mode !== 'airborne') {
      nextState.activeTrick = null;
      events.push(makeEvent(nextState, 'trickCanceled', active.id, {
        reason: input?.landingThisTick || nextState.mode === 'grounded'
          ? 'landing'
          : 'mode-transition',
        elapsedMs,
      }));
    } else {
      nextState.activeTrick = { ...active, elapsedMs };
    }
    return { state: nextState, events };
  }

  const trickId = input?.trickPressed;
  if (input?.landingThisTick || nextState.mode !== 'airborne' || !getTrickAction(trickId)) {
    return { state: nextState, events };
  }

  nextState.activeTrick = {
    id: trickId,
    startedTick: Number.isSafeInteger(nextState.tick) ? nextState.tick : 0,
    elapsedMs: 0,
  };
  events.push(makeEvent(nextState, 'trickStarted', trickId));
  return { state: nextState, events };
}
