import { getTrickAction } from '../shared/catalogs.js';
import { createPlanarSkater, stepSkaterOnPlanarCity } from './planar-skater.js';
import { createComboState, reduceCombo } from './trick-combo.js';
import { stepTrick } from './trick-state.js';

function makeEventId(state, eventIndex) {
  return `${state.sessionId ?? 'local'}:${state.tick}:${eventIndex}`;
}

function restampEvents(state, startIndex, events) {
  let eventIndex = startIndex;
  const stamped = events.map((event) => {
    eventIndex += 1;
    return {
      ...event,
      eventId: makeEventId(state, eventIndex),
      eventIndex,
      tick: state.tick,
    };
  });
  state.eventIndex = eventIndex;
  return stamped;
}

function grindProgressEvent(state, motionResult, deltaSeconds, world) {
  if (state.mode !== 'grinding' || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return null;
  const intervalId = state.combo?.activeGrindIntervalId;
  if (!intervalId) return null;

  const after = motionResult.state;
  let signedDistanceAdvanced = 0;
  let speed = after.speed;
  if (after.mode === 'grinding' && after.railId === state.railId) {
    signedDistanceAdvanced = after.railDistance - state.railDistance;
  } else {
    const end = motionResult.events.find((event) => (
      event.type === 'grindEnded' && event.pathId === state.railId
    ));
    if (!end) return null;
    signedDistanceAdvanced = end.signedDistanceAdvanced;
    speed = end.speed;
  }

  const path = world?.rails?.find((candidate) => candidate.id === state.railId);
  const distance = Math.abs(signedDistanceAdvanced);
  if (!path || !Number.isFinite(path.totalLength) || path.totalLength <= 0
      || !Number.isFinite(distance) || distance <= 1e-9
      || !Number.isFinite(speed) || speed < 2) return null;
  const elapsed = Math.min(deltaSeconds, distance / speed);
  if (elapsed <= 0) return null;
  return {
    type: 'grindProgress',
    intervalId,
    pathId: state.railId,
    signedDistanceAdvanced,
    speed,
    deltaSeconds: elapsed,
  };
}

function updateLastAction(lastAction, event, priorCombo, combo) {
  if (event.type === 'trickCompleted') {
    const action = getTrickAction(event.trickId);
    if (!action) return lastAction;
    return {
      id: action.id,
      label: action.label,
      basePoints: Math.max(0, combo.pendingBase - priorCombo.pendingBase),
      bankedScore: 0,
      eventId: event.eventId,
    };
  }
  if (event.type === 'grindProgress' && !priorCombo.activeGrindScored
      && combo.activeGrindScored) {
    return {
      id: 'grind',
      label: 'Grind',
      basePoints: 0,
      bankedScore: 0,
      eventId: event.eventId,
    };
  }
  if (event.type === 'landed' && combo.bankedScore > priorCombo.bankedScore && lastAction) {
    return {
      ...lastAction,
      bankedScore: combo.bankedScore - priorCombo.bankedScore,
      eventId: event.eventId,
    };
  }
  if (event.type === 'grindEnded' && event.reason === 'balance-failure') {
    return { id: 'balance-failure', label: 'Balance lost', bankedScore: 0, eventId: event.eventId };
  }
  if (event.type === 'bailed') {
    return { id: 'bail', label: 'Bail', bankedScore: 0, eventId: event.eventId };
  }
  return lastAction;
}

export function createLocalPlayState(world, spawnId) {
  return {
    ...createPlanarSkater(world, spawnId),
    combo: createComboState(),
    activeTrick: null,
    lastAction: null,
  };
}

export function stepLocalPlay(state, input, deltaSeconds, world) {
  const motion = stepSkaterOnPlanarCity(state, input, deltaSeconds, world);
  const landingThisTick = motion.events.some((event) => event.type === 'landed');
  const trick = stepTrick(motion.state, { ...input, landingThisTick }, deltaSeconds, world);
  const progress = grindProgressEvent(state, motion, deltaSeconds, world);
  const physicalEvents = motion.events ?? [];
  const composedEvents = [...physicalEvents];
  if (progress) {
    const endIndex = composedEvents.findIndex((event) => (
      event.type === 'grindEnded' && event.pathId === progress.pathId
    ));
    composedEvents.splice(endIndex < 0 ? composedEvents.length : endIndex, 0, progress);
  }
  if (trick.events.length > 0) {
    const landingIndex = composedEvents.findIndex((event) => event.type === 'landed');
    composedEvents.splice(landingIndex < 0 ? composedEvents.length : landingIndex, 0,
      ...trick.events);
  }

  const nextState = {
    ...trick.state,
    combo: state.combo ?? createComboState(),
    activeTrick: trick.state.activeTrick,
    lastAction: state.lastAction ?? null,
  };
  const startIndex = Number.isSafeInteger(state.eventIndex) ? state.eventIndex : 0;
  const events = restampEvents(nextState, startIndex, composedEvents);
  let combo = nextState.combo;
  let lastAction = nextState.lastAction;
  for (const event of events) {
    const priorCombo = combo;
    combo = reduceCombo(combo, event, world);
    lastAction = updateLastAction(lastAction, event, priorCombo, combo);
  }
  nextState.combo = combo;
  nextState.lastAction = lastAction;
  return { state: nextState, events };
}
