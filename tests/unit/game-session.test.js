import { describe, expect, it, vi } from 'vitest';
import { createNeutralInputFrame } from '../../js/game/input/actions.js';
import { createGameSession } from '../../js/game/runtime/game-session.js';

function createDocument() {
  const listeners = new Map();
  return {
    hidden: false,
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(callback);
    },
    removeEventListener(type, callback) {
      listeners.get(type)?.delete(callback);
    },
    dispatch(type) {
      for (const callback of [...(listeners.get(type) ?? [])]) callback();
    },
    listenerCount(type) { return listeners.get(type)?.size ?? 0; },
  };
}

function createRaf() {
  let id = 0;
  const callbacks = new Map();
  return {
    request: vi.fn((callback) => {
      id += 1;
      callbacks.set(id, callback);
      return id;
    }),
    cancel: vi.fn((handle) => callbacks.delete(handle)),
    tick(timestamp) {
      const pending = [...callbacks.values()];
      callbacks.clear();
      pending.forEach((callback) => callback(timestamp));
    },
    get size() { return callbacks.size; },
  };
}

function createFixture() {
  const raf = createRaf();
  const documentObject = createDocument();
  const input = {
    sample: vi.fn(() => createNeutralInputFrame()),
    reset: vi.fn(),
    dispose: vi.fn(),
  };
  const onEvents = vi.fn();
  const onFrame = vi.fn();
  const session = createGameSession({
    initialState: { ticks: 0 },
    resetState: () => ({ ticks: 0 }),
    input,
    step: (state, frame) => ({
      state: { ticks: state.ticks + 1 },
      events: frame.jumpPressed ? [{ type: 'jumped' }] : [],
    }),
    onEvents,
    onFrame,
    documentObject,
    requestAnimationFrame: raf.request,
    cancelAnimationFrame: raf.cancel,
  });
  return { raf, documentObject, input, onEvents, onFrame, session };
}

describe('createGameSession', () => {
  it('session_suspensionDiscardsPartialAccumulatedTime', () => {
    const { session, raf } = createFixture();
    session.joinLocal();
    raf.tick(0);
    raf.tick(10);
    session.suspend('blur');
    session.restore('blur');
    raf.tick(1_000);
    raf.tick(1_007);
    expect(session.getState().tick).toBe(0);
    session.dispose();
  });
  it('session_invalidationDuringSamplingClearsPreviouslyQueuedEdge', () => {
    const { session, raf, input, onEvents } = createFixture();
    session.joinLocal();
    input.sample.mockReturnValueOnce({ ...createNeutralInputFrame(), jumpPressed: true });
    raf.tick(0);
    input.sample.mockImplementationOnce(() => {
      session.invalidateInput();
      return createNeutralInputFrame();
    });
    raf.tick(20);
    expect(onEvents).not.toHaveBeenCalled();
    session.dispose();
  });
  it('session_leaveClearsSuspensionReasonsBeforeRejoin', () => {
    const { session } = createFixture();
    session.joinLocal();
    session.suspend('context-lost');
    session.leave();
    session.joinLocal();
    session.suspend('controls');
    session.restore('controls');
    expect(session.getState().mode).toBe('playing');
    session.dispose();
  });
  it('session_modalCloseCannotResumeContextLoss', () => {
    const { session, raf } = createFixture();
    session.joinLocal();
    raf.tick(0);
    raf.tick(100);
    const before = session.getState().elapsedPlayMs;
    expect(before).toBeCloseTo(100);
    session.suspend('controls');
    session.suspend('context-lost');
    session.restore('controls');
    raf.tick(1_000);
    expect(session.getState().mode).toBe('paused');
    expect(session.getState().elapsedPlayMs).toBe(before);
    session.restore('context-lost');
    raf.tick(2_000);
    expect(session.getState().elapsedPlayMs).toBe(before);
    session.dispose();
  });

  it('session_invalidateDropsActionsQueuedBeforeATick', () => {
    const { session, raf, input, onEvents } = createFixture();
    session.joinLocal();
    input.sample.mockReturnValueOnce({ ...createNeutralInputFrame(), jumpPressed: true });
    raf.tick(0);
    session.invalidateInput();
    raf.tick(20);
    expect(onEvents).not.toHaveBeenCalled();
    session.dispose();
  });
  it('gameSession_joinRunsFixedLocalTicksAndForwardsOneEdge', () => {
    const fixture = createFixture();
    fixture.input.sample.mockReturnValueOnce({ ...createNeutralInputFrame(), jumpPressed: true });

    expect(fixture.session.getState().mode).toBe('preview');
    expect(fixture.session.joinLocal()).toBe(true);
    fixture.raf.tick(0);
    fixture.raf.tick(100);

    expect(fixture.session.getState().skaterState.ticks).toBe(6);
    expect(fixture.onEvents).toHaveBeenCalledWith([{ type: 'jumped' }]);
    expect(fixture.raf.size).toBe(1);
  });

  it('gameSession_leaveAndDisposeCancelFramesAndAreIdempotent', () => {
    const fixture = createFixture();
    fixture.session.joinLocal();
    fixture.raf.tick(0);
    expect(fixture.raf.size).toBe(1);
    fixture.session.leave();
    fixture.session.leave();
    expect(fixture.session.getState().mode).toBe('preview');
    expect(fixture.session.getState().skaterState.ticks).toBe(0);
    expect(fixture.raf.size).toBe(0);

    fixture.session.joinLocal();
    fixture.session.dispose();
    fixture.session.dispose();
    fixture.raf.tick(1_000);
    expect(fixture.session.getState().mode).toBe('disposed');
    expect(fixture.raf.size).toBe(0);
    expect(fixture.input.dispose).toHaveBeenCalledTimes(1);
    expect(fixture.documentObject.listenerCount('visibilitychange')).toBe(0);
  });

  it('gameSession_visibilityResumeDoesNotAccumulateHiddenTime', () => {
    const fixture = createFixture();
    fixture.session.joinLocal();
    fixture.raf.tick(0);
    fixture.documentObject.hidden = true;
    fixture.documentObject.dispatch('visibilitychange');
    expect(fixture.raf.size).toBe(0);
    fixture.documentObject.hidden = false;
    fixture.documentObject.dispatch('visibilitychange');
    fixture.raf.tick(5_000);
    expect(fixture.session.getState().skaterState.ticks).toBe(0);
    fixture.raf.tick(5_017);
    expect(fixture.session.getState().skaterState.ticks).toBe(1);
  });

  it('gameSession_comboIsAReadAliasOfTheAuthoritativeSkaterState', () => {
    const raf = createRaf();
    const initialState = { ticks: 0, combo: { pendingBase: 20, multiplier: 1, bankedScore: 0 } };
    const resetCombo = { pendingBase: 0, multiplier: 1, bankedScore: 0 };
    const onFrame = vi.fn();
    const session = createGameSession({
      initialState,
      resetState: () => ({ ticks: 0, combo: resetCombo }),
      step: (state) => ({ state: { ...state, ticks: state.ticks + 1 }, events: [] }),
      onFrame,
      documentObject: createDocument(),
      requestAnimationFrame: raf.request,
      cancelAnimationFrame: raf.cancel,
    });

    session.joinLocal();
    raf.tick(0);
    expect(session.getState().combo).toBe(resetCombo);
    expect(session.getState().skaterState.combo).toBe(resetCombo);
    expect(onFrame.mock.calls.at(-1)[0].combo).toBe(resetCombo);

    session.leave();
    expect(session.getState().combo).toBe(session.getState().skaterState.combo);
    expect(session.getState().combo.bankedScore).toBe(0);
    session.dispose();
  });

  it('gameSession_pauseResumeAndRepeatedJoinRemainBounded', () => {
    const fixture = createFixture();
    expect(fixture.session.joinLocal()).toBe(true);
    expect(fixture.session.joinLocal()).toBe(false);
    fixture.session.pause();
    expect(fixture.session.getState().mode).toBe('paused');
    expect(fixture.raf.size).toBe(0);
    fixture.session.resume();
    fixture.raf.tick(100);
    fixture.raf.tick(117);
    expect(fixture.session.getState().skaterState.ticks).toBe(1);
  });
});
