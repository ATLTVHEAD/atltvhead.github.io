import { describe, expect, it } from 'vitest';
import { bindInputLifecycle } from '../../js/game/runtime/input-lifecycle.js';
import { createGameSession } from '../../js/game/runtime/game-session.js';

function target() {
  const listeners = new Map();
  return {
    hidden: false, activeElement: null,
    addEventListener(name, fn) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
    },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
    dispatch(name, element) { for (const fn of listeners.get(name) ?? []) fn({ target: element }); },
  };
}

describe('input lifecycle', () => {
  it('inputLifecycle_joinWhileHiddenResumesWhenVisible', () => {
    const win = target();
    const doc = target();
    doc.hidden = true;
    let callback;
    const session = createGameSession({ initialState: {}, step: (s) => s,
      documentObject: doc, requestAnimationFrame: (fn) => { callback = fn; return 1; },
      cancelAnimationFrame() {} });
    const binding = bindInputLifecycle({ target: win, documentObject: doc, session });
    session.joinLocal();
    callback(0);
    expect(session.getState().mode).toBe('paused');
    doc.hidden = false;
    doc.dispatch('visibilitychange');
    expect(session.getState().mode).toBe('playing');
    binding.dispose();
    session.dispose();
  });
  it('inputLifecycle_detectsEditableFocusWithoutFocusEventBeforeSampling', () => {
    const win = target();
    const doc = target();
    let callback;
    let samples = 0;
    const session = createGameSession({ initialState: {}, step: (s) => s, documentObject: doc,
      input: { sample() { samples += 1; return {}; }, reset() {} },
      requestAnimationFrame: (fn) => { callback = fn; return 1; }, cancelAnimationFrame() {} });
    const binding = bindInputLifecycle({ target: win, documentObject: doc, session });
    session.joinLocal();
    doc.activeElement = { tagName: 'INPUT' };
    callback(0);
    expect(session.getState().mode).toBe('paused');
    expect(samples).toBe(0);
    binding.dispose();
    session.dispose();
  });
  it('inputLifecycle_editableOutsideFormBlocksGameUntilCanvasFocused', () => {
    const win = target();
    const doc = target();
    const canvas = {};
    const field = { tagName: 'TEXTAREA' };
    const session = createGameSession({ initialState: {}, step: (s) => s,
      documentObject: doc, requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
    const binding = bindInputLifecycle({ target: win, documentObject: doc, canvas, session });
    session.joinLocal();
    doc.activeElement = field;
    win.dispatch('focusin', field);
    expect(session.getState().mode).toBe('paused');
    doc.activeElement = canvas;
    win.dispatch('focusin', canvas);
    expect(session.getState().mode).toBe('playing');
    binding.dispose();
    session.dispose();
  });
  it('inputLifecycle_hiddenWhilePausedPreventsEarlyResume', () => {
    const win = target();
    const doc = target();
    const session = createGameSession({ initialState: {}, step: (s) => s,
      documentObject: doc, requestAnimationFrame: () => 1, cancelAnimationFrame() {} });
    const binding = bindInputLifecycle({ target: win, documentObject: doc, session });
    session.joinLocal();
    session.suspend('controls');
    doc.hidden = true;
    doc.dispatch('visibilitychange');
    session.restore('controls');
    expect(session.getState().mode).toBe('paused');
    doc.hidden = false;
    doc.dispatch('visibilitychange');
    expect(session.getState().mode).toBe('playing');
    binding.dispose();
    session.dispose();
  });
  it('inputLifecycle_formBlocksEveryDevice', () => {
    const windowTarget = target();
    const doc = target();
    const canvas = {};
    const field = { tagName: 'INPUT' };
    const session = createGameSession({
      initialState: {}, step: (s) => s, documentObject: doc,
      requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    });
    const binding = bindInputLifecycle({ target: windowTarget, documentObject: doc,
      form: { contains: (el) => el === field }, canvas, session });
    session.joinLocal();
    doc.activeElement = field;
    windowTarget.dispatch('focusin', field);
    expect(session.getState().mode).toBe('paused');
    windowTarget.dispatch('focusout', field);
    expect(session.getState().mode).toBe('paused');
    doc.activeElement = canvas;
    windowTarget.dispatch('focusin', canvas);
    expect(session.getState().mode).toBe('playing');
    windowTarget.dispatch('blur');
    expect(session.getState().mode).toBe('paused');
    windowTarget.dispatch('focus');
    expect(session.getState().mode).toBe('playing');
    binding.dispose();
    session.dispose();
  });
});
