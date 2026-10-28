import { createNeutralInputFrame } from '../input/actions.js';
import { advanceFixedStep, clearPendingInput, createFixedStepState } from '../core/fixed-step.js';

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
  let beforeSample = () => {};
  const suspensions = new Set();

  function invalidateInput() {
    fixedStep = clearPendingInput(fixedStep);
  }

  function suspend(reason) {
    if (disposed || mode === 'preview') return false;
    suspensions.add(reason);
    invalidateInput();
    fixedStep = { ...fixedStep, accumulatorMs: 0 };
    input.reset?.();
    if (mode === 'playing') {
      mode = 'paused';
      cancelFrame();
      lastTimestamp = null;
      onModeChange(mode);
    }
    return true;
  }

  function restore(reason) {
    if (disposed || !suspensions.delete(reason)) return false;
    if (mode === 'paused' && suspensions.size === 0) {
      input.reset?.();
      lastTimestamp = null;
      mode = 'playing';
      onModeChange(mode);
      scheduleFrame();
    }
    return true;
  }

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
      elapsedPlayMs: fixedStep.tick * fixedStep.stepMs,
      events,
      recentEvents: [...recentEvents],
    });
  }

  function onAnimationFrame(timestamp) {
    frameHandle = null;
    if (mode !== 'playing' || disposed) return;
    beforeSample();
    if (mode !== 'playing') return;
    if (documentObject?.hidden) {
      suspend('visibility');
      return;
    }

    if (lastTimestamp === null) {
      lastTimestamp = timestamp;
      const sampledInput = input.sample();
      const initialFrame = advanceFixedStep(fixedStep, 0, sampledInput, step);
      fixedStep = initialFrame.loopState;
      publishFrame(initialFrame, 0);
      scheduleFrame();
      return;
    }

    const elapsedMs = Math.max(0, timestamp - lastTimestamp);
    lastTimestamp = timestamp;
    const sampledInput = input.sample();
    const result = advanceFixedStep(fixedStep, elapsedMs, sampledInput, step);
    fixedStep = result.loopState;
    publishFrame(result, elapsedMs);
    scheduleFrame();
  }

  function onVisibilityChange() {
    if (disposed || mode === 'preview') return;
    if (documentObject?.hidden) {
      suspend('visibility');
    } else {
      restore('visibility');
    }
  }

  documentObject?.addEventListener?.('visibilitychange', onVisibilityChange);

  return {
    setBeforeSample(callback) { beforeSample = callback ?? (() => {}); },
    invalidateInput,
    suspend,
    restore,
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
      return suspend('manual');
    },
    resume() {
      return restore('manual');
    },
    leave() {
      if (disposed || mode === 'preview') return false;
      cancelFrame();
      input.reset?.();
      lastTimestamp = null;
      recentEvents = [];
      suspensions.clear();
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
        elapsedPlayMs: fixedStep.tick * fixedStep.stepMs,
        alpha: fixedStep.accumulatorMs / fixedStep.stepMs,
        recentEvents: [...recentEvents],
      };
    },
  };
}
