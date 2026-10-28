import { createNeutralInputFrame } from '../input/actions.js';
import { advanceFixedStep, createFixedStepState } from '../core/fixed-step.js';

function emptyInput() {
  return {
    sample: createNeutralInputFrame,
    sampleCameraInput: () => ({ yawDelta: 0, pitchDelta: 0, zoomDelta: 0 }),
    reset() {},
    dispose() {},
  };
}

export function createGameSession({
  initialState,
  resetState = () => initialState,
  step,
  input = emptyInput(),
  onFrame = () => {},
  onEvents = () => {},
  onModeChange = () => {},
  documentObject = globalThis.document,
  requestAnimationFrame = globalThis.requestAnimationFrame?.bind(globalThis),
  cancelAnimationFrame = globalThis.cancelAnimationFrame?.bind(globalThis),
} = {}) {
  if (typeof step !== 'function') throw new TypeError('A city-skater step function is required.');
  if (typeof requestAnimationFrame !== 'function' || typeof cancelAnimationFrame !== 'function') {
    throw new TypeError('Animation-frame scheduling functions are required.');
  }

  let mode = 'preview';
  let fixedStep = createFixedStepState(initialState);
  let lastTimestamp = null;
  let frameHandle = null;
  let disposed = false;
  let recentEvents = [];

  const cancelFrame = () => {
    if (frameHandle === null) return;
    cancelAnimationFrame(frameHandle);
    frameHandle = null;
  };

  const scheduleFrame = () => {
    if (mode !== 'playing' || frameHandle !== null) return;
    frameHandle = requestAnimationFrame(onAnimationFrame);
  };

  function publishFrame(result = { alpha: 0, outputs: [], steps: 0 }, elapsedMs = 0) {
    const events = result.outputs.flatMap((output) => output?.events ?? []);
    if (events.length > 0) {
      recentEvents = [...recentEvents, ...events].slice(-16);
      onEvents(events);
    }
    onFrame({
      mode,
      loopState: fixedStep,
      skaterState: fixedStep.currentState,
      alpha: result.alpha,
      steps: result.steps,
      elapsedMs,
      events,
      recentEvents: [...recentEvents],
    });
  }

  function onAnimationFrame(timestamp) {
    frameHandle = null;
    if (mode !== 'playing' || disposed) return;
    if (documentObject?.hidden) {
      fixedStep = advanceFixedStep(
        fixedStep,
        0,
        createNeutralInputFrame(),
        step,
        { hidden: true },
      ).loopState;
      lastTimestamp = null;
      input.reset?.();
      return;
    }

    if (lastTimestamp === null) {
      lastTimestamp = timestamp;
      const initialFrame = advanceFixedStep(fixedStep, 0, input.sample(), step);
      fixedStep = initialFrame.loopState;
      publishFrame(initialFrame, 0);
      scheduleFrame();
      return;
    }

    const elapsedMs = Math.max(0, timestamp - lastTimestamp);
    lastTimestamp = timestamp;
    const result = advanceFixedStep(fixedStep, elapsedMs, input.sample(), step);
    fixedStep = result.loopState;
    publishFrame(result, elapsedMs);
    scheduleFrame();
  }

  function onVisibilityChange() {
    if (mode !== 'playing' || disposed) return;
    if (documentObject?.hidden) {
      cancelFrame();
      fixedStep = advanceFixedStep(
        fixedStep,
        0,
        createNeutralInputFrame(),
        step,
        { hidden: true },
      ).loopState;
      lastTimestamp = null;
      input.reset?.();
    } else {
      lastTimestamp = null;
      scheduleFrame();
    }
  }

  documentObject?.addEventListener?.('visibilitychange', onVisibilityChange);

  return {
    joinLocal() {
      if (disposed || mode !== 'preview') return false;
      input.reset?.();
      recentEvents = [];
      fixedStep = createFixedStepState(resetState());
      lastTimestamp = null;
      mode = 'playing';
      onModeChange(mode);
      scheduleFrame();
      return true;
    },
    pause() {
      if (mode !== 'playing') return false;
      mode = 'paused';
      cancelFrame();
      lastTimestamp = null;
      input.reset?.();
      onModeChange(mode);
      return true;
    },
    resume() {
      if (disposed || mode !== 'paused') return false;
      input.reset?.();
      lastTimestamp = null;
      mode = 'playing';
      onModeChange(mode);
      scheduleFrame();
      return true;
    },
    leave() {
      if (disposed || mode === 'preview') return false;
      cancelFrame();
      input.reset?.();
      lastTimestamp = null;
      recentEvents = [];
      fixedStep = createFixedStepState(resetState());
      mode = 'preview';
      onModeChange(mode);
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelFrame();
      input.reset?.();
      input.dispose?.();
      documentObject?.removeEventListener?.('visibilitychange', onVisibilityChange);
      mode = 'disposed';
      onModeChange(mode);
    },
    getState() {
      return {
        mode,
        skaterState: fixedStep.currentState,
        previousSkaterState: fixedStep.previousState,
        tick: fixedStep.tick,
        alpha: fixedStep.accumulatorMs / fixedStep.stepMs,
        recentEvents: [...recentEvents],
      };
    },
  };
}
