import { describe, expect, it } from 'vitest';
import { createTouchInput } from '../../js/game/input/touch.js';

function createTarget({ action = null, stick = false } = {}) {
  const listeners = new Map();
  const captures = new Set();
  const releases = [];
  return {
    dataset: {
      ...(action ? { touchAction: action } : {}),
      ...(stick ? { touchStick: '' } : {}),
    },
    style: {},
    captures,
    releases,
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(callback);
    },
    removeEventListener(type, callback) {
      listeners.get(type)?.delete(callback);
    },
    closest(selector) {
      if (selector === '[data-touch-action]' && this.dataset.touchAction) return this;
      if (selector === '[data-touch-stick]' && this.dataset.touchStick !== undefined) return this;
      return null;
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 120, height: 120 };
    },
    setPointerCapture(pointerId) {
      captures.add(pointerId);
    },
    hasPointerCapture(pointerId) {
      return captures.has(pointerId);
    },
    releasePointerCapture(pointerId) {
      captures.delete(pointerId);
      releases.push(pointerId);
    },
    dispatch(type, values = {}) {
      const event = {
        type,
        target: this,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
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

function createTouchFixture({ enabled = true, onIntent = () => {} } = {}) {
  const controlsRoot = createTarget();
  const stickZone = createTarget({ stick: true });
  const stickKnob = createTarget();
  const actions = ['jump', 'spin', 'grab', 'tag', 'emote']
    .map((action) => createTarget({ action }));
  const target = createTarget();
  const documentObject = createTarget();
  controlsRoot.querySelector = (selector) => (
    selector === '[data-touch-stick]' ? stickZone : stickKnob
  );
  const adapter = createTouchInput({
    controlsRoot,
    target,
    documentObject,
    isEnabled: () => enabled,
    onIntent,
  });
  return { controlsRoot, stickZone, stickKnob, actions, target, documentObject, adapter };
}

function control(actions, action) {
  return actions.find((element) => element.dataset.touchAction === action);
}

function pointer(controlsRoot, type, target, pointerId, clientX = 0, clientY = 0) {
  return controlsRoot.dispatch(type, { target, pointerId, clientX, clientY });
}

describe('createTouchInput', () => {
  it('touch_leftStickMapsPointerTravelToSteerThrottleAndBrake', () => {
    const { controlsRoot, stickZone, adapter } = createTouchFixture();

    pointer(controlsRoot, 'pointerdown', stickZone, 7, 60, 60);
    pointer(controlsRoot, 'pointermove', stickZone, 7, 90, 30);
    expect(adapter.sample()).toMatchObject({ steer: 0.5, throttle: 0.5, brake: 0 });

    pointer(controlsRoot, 'pointermove', stickZone, 7, 60, 90);
    expect(adapter.sample()).toMatchObject({ steer: 0, throttle: 0, brake: 0.5 });
    pointer(controlsRoot, 'pointerup', stickZone, 7, 60, 90);
    expect(adapter.sample()).toMatchObject({ steer: 0, throttle: 0, brake: 0 });
    adapter.dispose();
  });

  it('touch_multiplePointersKeepStickAndOneShotActionsIndependent', () => {
    const { controlsRoot, actions, adapter } = createTouchFixture();
    const stickZone = controlsRoot.querySelector('[data-touch-stick]');
    const jump = control(actions, 'jump');

    pointer(controlsRoot, 'pointerdown', stickZone, 10, 60, 60);
    pointer(controlsRoot, 'pointermove', stickZone, 10, 90, 60);
    pointer(controlsRoot, 'pointerdown', jump, 11);
    expect(adapter.sample()).toMatchObject({ steer: 0.5, jumpPressed: true });

    pointer(controlsRoot, 'pointerup', jump, 11);
    expect(adapter.sample()).toMatchObject({ steer: 0.5, jumpPressed: false });
    pointer(controlsRoot, 'pointerup', stickZone, 10);
    expect(adapter.sample()).toMatchObject({ steer: 0, throttle: 0 });
    adapter.dispose();
  });

  it('touch_mapsTricksTagAndEmoteToSingleTickActions', () => {
    const { controlsRoot, actions, adapter } = createTouchFixture();
    pointer(controlsRoot, 'pointerdown', control(actions, 'spin'), 1);
    pointer(controlsRoot, 'pointerdown', control(actions, 'tag'), 2);
    pointer(controlsRoot, 'pointerdown', control(actions, 'emote'), 3);

    expect(adapter.sample()).toMatchObject({
      trickPressed: 'spin',
      tagPressed: true,
      emotePressed: 'wave',
    });
    expect(adapter.sample()).toMatchObject({
      trickPressed: null,
      tagPressed: false,
      emotePressed: null,
    });
    adapter.dispose();
  });

  it('touch_semanticClickActivatesButtonsWithoutAddingPointerClickEdges', () => {
    const { controlsRoot, actions, adapter } = createTouchFixture();
    const click = (action, detail = 0) => controlsRoot.dispatch('click', {
      target: control(actions, action),
      detail,
    });

    click('jump');
    click('spin');
    click('tag');
    click('emote');
    expect(adapter.sample()).toMatchObject({
      jumpPressed: true,
      trickPressed: 'spin',
      tagPressed: true,
      emotePressed: 'wave',
    });

    click('grab', 1);
    expect(adapter.sample().trickPressed).toBeNull();
    adapter.dispose();
  });

  it('touch_pointerGeneratedClickDoesNotRepeatPointerAction', () => {
    const intents = [];
    const { controlsRoot, actions, adapter } = createTouchFixture({
      onIntent: (activity) => intents.push(activity),
    });
    const jump = control(actions, 'jump');
    pointer(controlsRoot, 'pointerdown', jump, 18);
    controlsRoot.dispatch('click', { target: jump, detail: 1 });

    expect(adapter.sample().jumpPressed).toBe(true);
    expect(adapter.sample().jumpPressed).toBe(false);
    expect(intents).toEqual([1]);
    adapter.dispose();
  });

  it('touch_doesNotExposeOrAcceptATask7GrindAction', () => {
    const { controlsRoot, adapter } = createTouchFixture();
    const unsupportedGrind = createTarget({ action: 'grind' });
    pointer(controlsRoot, 'pointerdown', unsupportedGrind, 25);

    expect(adapter.sample().grindHeld).toBe(false);
    adapter.dispose();
  });

  it('touch_cancelLostCaptureAndResizeReleasePointersAndClearInput', () => {
    const { controlsRoot, stickZone, actions, target, adapter } = createTouchFixture();
    const tag = control(actions, 'tag');
    pointer(controlsRoot, 'pointerdown', stickZone, 4, 60, 60);
    pointer(controlsRoot, 'pointermove', stickZone, 4, 110, 60);
    pointer(controlsRoot, 'pointerdown', tag, 5);
    expect(adapter.sample()).toMatchObject({ steer: 0.8333333333333334, tagPressed: true });

    controlsRoot.dispatch('pointercancel', { pointerId: 5, target: tag });
    expect(adapter.sample()).toMatchObject({ steer: 0, tagPressed: false });
    expect(stickZone.releases).toContain(4);
    expect(tag.releases).toContain(5);

    pointer(controlsRoot, 'pointerdown', tag, 9);
    expect(adapter.sample().tagPressed).toBe(true);
    target.dispatch('resize');
    expect(adapter.sample().tagPressed).toBe(false);
    expect(tag.releases).toContain(9);
    adapter.dispose();
  });

  it('touch_disabledPreviewAndDisposeNeverLeakHeldInput', () => {
    const { controlsRoot, actions, adapter } = createTouchFixture({ enabled: false });
    pointer(controlsRoot, 'pointerdown', control(actions, 'jump'), 2);
    expect(adapter.sample()).toMatchObject({ jumpPressed: false, grindHeld: false });
    adapter.dispose();
    expect(adapter.sample()).toMatchObject({ jumpPressed: false, throttle: 0 });
  });
});
