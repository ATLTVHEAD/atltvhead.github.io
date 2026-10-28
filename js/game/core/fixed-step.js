import { createNeutralInputFrame, normalizeInputFrame } from '../input/actions.js';

const DISCRETE_INPUT_FIELDS = Object.freeze([
  'jumpPressed',
  'trickPressed',
  'tagPressed',
  'emotePressed',
]);

function emptyEdges() {
  return {
    jumpPressed: false,
    trickPressed: null,
    tagPressed: false,
    emotePressed: null,
  };
}

function holdOnly(input) {
  return {
    ...input,
    jumpPressed: false,
    trickPressed: null,
    tagPressed: false,
    emotePressed: null,
  };
}

function mergeEdges(pending, input) {
  const merged = { ...pending };
  for (const field of DISCRETE_INPUT_FIELDS) {
    if (field === 'trickPressed' || field === 'emotePressed') {
      if (input[field]) merged[field] = input[field];
    } else {
      merged[field] ||= input[field];
    }
  }
  return merged;
}

export function createFixedStepState(initialState, options = {}) {
  const stepMs = Number.isFinite(options.stepMs) && options.stepMs > 0
    ? options.stepMs
    : 1000 / 60;
  const maxCatchUpSteps = Number.isSafeInteger(options.maxCatchUpSteps) && options.maxCatchUpSteps > 0
    ? options.maxCatchUpSteps
    : 6;
  const maxFrameMs = Number.isFinite(options.maxFrameMs) && options.maxFrameMs > 0
    ? options.maxFrameMs
    : 100;
  return {
    stepMs,
    maxCatchUpSteps,
    maxFrameMs,
    accumulatorMs: 0,
    previousState: initialState,
    currentState: initialState,
    tick: 0,
    pendingEdges: emptyEdges(),
    hidden: false,
  };
}

export function clearPendingInput(loopState) {
  return { ...loopState, pendingEdges: emptyEdges() };
}

export function advanceFixedStep(loopState, elapsedMs, rawInput, step, options = {}) {
  if (typeof step !== 'function') throw new TypeError('A fixed-step callback is required.');
  const input = normalizeInputFrame(rawInput ?? createNeutralInputFrame());
  const hidden = options.hidden === true;
  if (hidden) {
    const next = {
      ...loopState,
      accumulatorMs: 0,
      pendingEdges: emptyEdges(),
      hidden: true,
    };
    return { loopState: next, alpha: 0, steps: 0, outputs: [] };
  }

  const resumed = loopState.hidden;
  const next = {
    ...loopState,
    accumulatorMs: resumed ? 0 : loopState.accumulatorMs,
    pendingEdges: resumed ? emptyEdges() : mergeEdges(loopState.pendingEdges, input),
    hidden: false,
  };
  const frameMs = resumed || !Number.isFinite(elapsedMs)
    ? 0
    : Math.max(0, Math.min(next.maxFrameMs, elapsedMs));
  next.accumulatorMs += frameMs;

  const heldInput = holdOnly(input);
  const outputs = [];
  let steps = 0;
  while (next.accumulatorMs + 1e-8 >= next.stepMs && steps < next.maxCatchUpSteps) {
    const frame = { ...heldInput, ...next.pendingEdges };
    next.pendingEdges = emptyEdges();
    const output = step(next.currentState, frame, next.stepMs / 1000);
    const newState = output && typeof output === 'object' && Object.hasOwn(output, 'state')
      ? output.state
      : output;
    next.previousState = next.currentState;
    next.currentState = newState;
    next.tick += 1;
    outputs.push(output);
    next.accumulatorMs -= next.stepMs;
    if (Math.abs(next.accumulatorMs) < 1e-8) next.accumulatorMs = 0;
    steps += 1;
  }

  if (steps === next.maxCatchUpSteps && next.accumulatorMs >= next.stepMs) {
    next.accumulatorMs %= next.stepMs;
  }
  return {
    loopState: next,
    alpha: Math.max(0, Math.min(1, next.accumulatorMs / next.stepMs)),
    steps,
    outputs,
  };
}
