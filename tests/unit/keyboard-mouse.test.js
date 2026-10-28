import { describe, expect, it, vi } from 'vitest';
import { createKeyboardMouseInput } from '../../js/game/input/keyboard-mouse.js';

function createTarget() {
  const listeners = new Map();
  return {
    activeElement: null,
    hidden: false,
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(callback);
    },
    removeEventListener(type, callback) {
      listeners.get(type)?.delete(callback);
    },
    contains(element) {
      return element === this.input;
    },
    dispatch(type, values = {}) {
      const event = {
        type,
        target: this,
        defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; },
        ...values,
      };
      for (const callback of [...(listeners.get(type) ?? [])]) callback(event);
      return event;
    },
    listenerCount(type) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

function key(target, type, keyValue, values = {}) {
  return target.dispatch(type, {
    key: keyValue,
    code: keyValue === ' ' ? 'Space' : undefined,
    repeat: false,
    ...values,
  });
}

function createInputFixture({ enabled = true } = {}) {
  const target = createTarget();
  const documentObject = createTarget();
  const canvas = createTarget();
  const form = createTarget();
  const inputElement = { tagName: 'INPUT' };
  form.input = inputElement;
  const isEnabled = vi.fn(() => enabled);
  const adapter = createKeyboardMouseInput({
    target,
    canvas,
    form,
    documentObject,
    isEnabled,
  });
  return { target, documentObject, canvas, form, inputElement, adapter, isEnabled };
}

describe('createKeyboardMouseInput', () => {
  it('keyboard_mapsHeldThrottleBrakeSteerAndGrind', () => {
    const { target, adapter } = createInputFixture();
    key(target, 'keydown', 'w');
    key(target, 'keydown', 'a');
    key(target, 'keydown', 'Shift');

    expect(adapter.sample()).toMatchObject({
      steer: -1,
      throttle: 1,
      brake: 0,
      grindHeld: true,
    });

    key(target, 'keyup', 'w');
    key(target, 'keyup', 'a');
    key(target, 'keyup', 'Shift');
    expect(adapter.sample()).toMatchObject({ steer: 0, throttle: 0, brake: 0, grindHeld: false });
  });

  it('keyboard_emitsDiscreteEdgesOnceAndIgnoresKeyRepeat', () => {
    const { target, adapter } = createInputFixture();
    key(target, 'keydown', ' ');
    key(target, 'keydown', 'j');
    key(target, 'keydown', 'f');
    key(target, 'keydown', 'e');
    key(target, 'keydown', 'j', { repeat: true });

    expect(adapter.sample()).toMatchObject({
      jumpPressed: true,
      trickPressed: 'spin',
      tagPressed: true,
      emotePressed: 'wave',
    });
    expect(adapter.sample()).toMatchObject({
      jumpPressed: false,
      trickPressed: null,
      tagPressed: false,
      emotePressed: null,
    });
  });

  it('keyboard_previewAndFormFocusNeverSteerOrPreventTextInput', () => {
    const { target, form, inputElement, adapter, isEnabled } = createInputFixture({ enabled: false });
    const previewKey = key(target, 'keydown', 'w');
    isEnabled.mockReturnValue(true);
    const formKey = key(target, 'keydown', 'w', { target: inputElement });

    expect(adapter.sample().throttle).toBe(0);
    expect(previewKey.defaultPrevented).toBe(false);
    expect(formKey.defaultPrevented).toBe(false);
    expect(form.contains(inputElement)).toBe(true);
  });

  it('keyboard_blurHiddenAndDisposeClearHeldAndQueuedActions', () => {
    const { target, documentObject, adapter } = createInputFixture();
    key(target, 'keydown', 'w');
    key(target, 'keydown', ' ');
    expect(adapter.sample().throttle).toBe(1);
    target.dispatch('blur');
    expect(adapter.sample()).toMatchObject({ throttle: 0, jumpPressed: false });

    key(target, 'keydown', 'w');
    documentObject.hidden = true;
    documentObject.dispatch('visibilitychange');
    expect(adapter.sample().throttle).toBe(0);

    adapter.dispose();
    adapter.dispose();
    expect(target.listenerCount('keydown')).toBe(0);
    key(target, 'keydown', 'w');
    expect(adapter.sample().throttle).toBe(0);
  });

  it('camera_dragWheelAndCancelAreCapturedAndReleased', () => {
    const { canvas, adapter } = createInputFixture();
    canvas.setPointerCapture = vi.fn();
    canvas.releasePointerCapture = vi.fn();
    canvas.hasPointerCapture = vi.fn(() => true);
    canvas.dispatch('pointerdown', { target: canvas, pointerId: 7, button: 0, clientX: 100, clientY: 80 });
    canvas.dispatch('pointermove', { target: canvas, pointerId: 7, clientX: 120, clientY: 90 });
    expect(canvas.setPointerCapture).toHaveBeenCalledWith(7);
    expect(adapter.sampleCameraInput()).toMatchObject({ yawDelta: -0.1, pitchDelta: 0.05 });
    canvas.dispatch('pointercancel', { target: canvas, pointerId: 7 });
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(7);

    const wheel = canvas.dispatch('wheel', { target: canvas, deltaY: 50 });
    expect(wheel.defaultPrevented).toBe(true);
    expect(adapter.sampleCameraInput().zoomDelta).toBeGreaterThan(0);
    adapter.dispose();
  });
});
