import { describe, expect, it } from 'vitest';
import { createGamepadInput } from '../../js/game/input/gamepad.js';
import { createInputRouter } from '../../js/game/input/input-router.js';

function createGamepad({ axes = [0, 0, 0, 0], mapping = 'standard' } = {}) {
  return {
    connected: true,
    index: 0,
    id: 'Test Controller',
    mapping,
    axes: [...axes],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
}

function setButton(gamepad, index, pressed, value = Number(pressed)) {
  gamepad.buttons[index] = { pressed, value };
}

function createTarget() {
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
    dispatch(type, details = {}) {
      for (const callback of [...(listeners.get(type) ?? [])]) callback({ type, ...details });
    },
    listenerCount(type) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

describe('createGamepadInput', () => {
  it('gamepad_otherControllerDisconnectDoesNotInvalidateActivePad', () => {
    const active = createGamepad({ axes: [0, -0.7, 0, 0] });
    const other = { ...createGamepad(), id: 'Other pad', index: 1 };
    const target = createTarget();
    const invalidations = [];
    const input = createGamepadInput({ target, getGamepads: () => [active, other],
      onInvalidated: (reason) => invalidations.push(reason) });
    input.sample();
    target.dispatch('gamepaddisconnected', { gamepad: other });
    expect(invalidations).toEqual([]);
    expect(input.sample().throttle).toBe(0.7);
    input.dispose();
  });
  it('gamepad_missingPollInvalidatesQueuedInputImmediatelyOnce', () => {
    let pad = createGamepad();
    const invalidations = [];
    const input = createGamepadInput({ getGamepads: () => pad ? [pad] : [],
      onInvalidated: (reason) => invalidations.push(reason) });
    input.sample();
    pad = null;
    input.sample();
    input.sample();
    expect(invalidations).toEqual(['gamepad-disconnected']);
    input.dispose();
  });
  it('gamepad_gradualStickAcquiresOwnership', () => {
    const pad = createGamepad();
    let router;
    const input = createGamepadInput({
      getGamepads: () => [pad],
      onIntent: (activity) => router.notifyIntent('gamepad', activity),
    });
    router = createInputRouter({ gamepad: input });
    router.sample();
    for (let index = 1; index <= 70; index += 1) {
      pad.axes[1] = -index / 100;
      router.sample();
    }
    expect(router.getActiveDevice()).toBe('gamepad');
    expect(router.sample().throttle).toBe(0.7);
    router.dispose();
  });

  it('gamepad_newJumpWorksWhileOtherControlIsSuppressed', () => {
    const pad = createGamepad({ axes: [0, -0.7, 0, 0.18] });
    const input = createGamepadInput({ getGamepads: () => [pad] });
    input.reset();
    setButton(pad, 0, true);
    expect(input.sample()).toMatchObject({ jumpPressed: true, throttle: 0 });
    expect(input.sample().jumpPressed).toBe(false);
    pad.axes[1] = 0;
    input.sample();
    pad.axes[1] = -0.5;
    expect(input.sample().throttle).toBe(0.5);
    input.dispose();
  });

  it('gamepad_replacementDoesNotReuseEdges', () => {
    let pad = createGamepad();
    const input = createGamepadInput({ getGamepads: () => [pad] });
    input.sample();
    pad = { ...createGamepad(), id: 'Replacement pad' };
    setButton(pad, 0, true);
    expect(input.sample().jumpPressed).toBe(false);
    setButton(pad, 0, false);
    input.sample();
    setButton(pad, 0, true);
    expect(input.sample().jumpPressed).toBe(true);
    input.dispose();
  });

  it('gamepad_sameIdentityReconnectSuppressesHeldControls', () => {
    let pad = createGamepad();
    const input = createGamepadInput({ getGamepads: () => pad ? [pad] : [] });
    input.sample();
    pad = null;
    input.sample();
    pad = createGamepad({ axes: [0, -0.8, 0, 0] });
    setButton(pad, 0, true);
    expect(input.sample()).toMatchObject({ throttle: 0, jumpPressed: false });
    setButton(pad, 0, false);
    pad.axes[1] = 0;
    input.sample();
    setButton(pad, 0, true);
    expect(input.sample().jumpPressed).toBe(true);
    input.dispose();
  });

  it('gamepad_disconnectEventInvalidatesSameIdentityWithoutAnEmptyPoll', () => {
    let pad = createGamepad();
    const target = createTarget();
    const invalidations = [];
    const input = createGamepadInput({ target, getGamepads: () => [pad],
      onInvalidated: (reason) => invalidations.push(reason) });
    input.sample();
    target.dispatch('gamepaddisconnected');
    pad = createGamepad();
    setButton(pad, 0, true);
    expect(input.sample().jumpPressed).toBe(false);
    expect(invalidations).toContain('gamepad-replaced');
    input.dispose();
  });

  it('gamepad_deadzoneNeutralizesSmallAxesAndPreservesAnalogThrottle', () => {
    const gamepad = createGamepad({ axes: [0.14, -0.15, 0, 0] });
    const input = createGamepadInput({ getGamepads: () => [gamepad] });

    expect(input.sample()).toMatchObject({ steer: 0, throttle: 0, brake: 0 });

    gamepad.axes[0] = 0.5;
    gamepad.axes[1] = -0.5;
    expect(input.sample()).toMatchObject({ steer: 0.5, throttle: 0.5, brake: 0 });
    input.dispose();
  });

  it('gamepad_clampsStickAxesAndSplitsThrottleFromBrake', () => {
    const gamepad = createGamepad({ axes: [1.4, -1.2, 0, 0] });
    const input = createGamepadInput({ getGamepads: () => [gamepad] });

    expect(input.sample()).toMatchObject({ steer: 1, throttle: 1, brake: 0 });

    gamepad.axes[1] = 0.7;
    expect(input.sample()).toMatchObject({ throttle: 0, brake: 0.7 });
    input.dispose();
  });

  it('gamepad_mapsStandardButtonsToOneShotActions', () => {
    const gamepad = createGamepad();
    const input = createGamepadInput({ getGamepads: () => [gamepad] });

    setButton(gamepad, 0, true);
    setButton(gamepad, 2, true);
    setButton(gamepad, 1, true);
    setButton(gamepad, 12, true);
    expect(input.sample()).toMatchObject({
      jumpPressed: true,
      trickPressed: 'spin',
      tagPressed: true,
      emotePressed: 'wave',
    });

    expect(input.sample()).toMatchObject({
      jumpPressed: false,
      trickPressed: null,
      tagPressed: false,
      emotePressed: null,
    });

    setButton(gamepad, 0, false);
    setButton(gamepad, 2, false);
    setButton(gamepad, 1, false);
    setButton(gamepad, 12, false);
    setButton(gamepad, 3, true);
    setButton(gamepad, 15, true);
    expect(input.sample()).toMatchObject({
      trickPressed: 'grab',
      emotePressed: 'cheer',
    });

    setButton(gamepad, 3, false);
    setButton(gamepad, 15, false);
    setButton(gamepad, 13, true);
    expect(input.sample().emotePressed).toBe('follow');
    input.dispose();
  });

  it('gamepad_task7DoesNotBindTheGrindTrigger', () => {
    const gamepad = createGamepad();
    const intents = [];
    const input = createGamepadInput({
      getGamepads: () => [gamepad],
      onIntent: (activity) => intents.push(activity),
    });
    setButton(gamepad, 6, true, 0.8);

    expect(input.sample().grindHeld).toBe(false);
    expect(intents).toEqual([]);
    input.dispose();
  });

  it('gamepad_usesALaterStandardControllerWhenAnUnsupportedPadIsFirst', () => {
    const unsupported = createGamepad({ mapping: '' });
    const supported = createGamepad({ axes: [0.45, -0.6, 0, 0] });
    const statuses = [];
    const input = createGamepadInput({
      getGamepads: () => [unsupported, supported],
      onStatusChange: (status) => statuses.push(status),
    });

    expect(input.sample()).toMatchObject({ steer: 0.45, throttle: 0.6, brake: 0 });
    expect(statuses.at(-1)).toBe('ready');
    input.dispose();
  });

  it('gamepad_disconnectAndUnsupportedMappingClearInputAndReportFallback', () => {
    let gamepads = [createGamepad({ mapping: '' })];
    const statuses = [];
    const input = createGamepadInput({
      getGamepads: () => gamepads,
      onStatusChange: (status) => statuses.push(status),
    });

    setButton(gamepads[0], 0, true);
    expect(input.sample().jumpPressed).toBe(false);
    expect(statuses).toContain('unsupported');

    gamepads = [];
    expect(input.sample()).toMatchObject({
      steer: 0,
      throttle: 0,
      jumpPressed: false,
      grindHeld: false,
    });
    expect(statuses.at(-1)).toBe('disconnected');

    gamepads = [createGamepad()];
    expect(input.sample()).toMatchObject({ jumpPressed: false, grindHeld: false });
    input.dispose();
  });

  it('gamepad_rightStickMovesCameraAndResetClearsHeldCameraInput', () => {
    const gamepad = createGamepad({ axes: [0, 0, 0.5, -0.5] });
    const input = createGamepadInput({ getGamepads: () => [gamepad] });
    const camera = input.sampleCameraInput(1 / 60);

    expect(camera.yawDelta).toBeLessThan(0);
    expect(camera.pitchDelta).toBeLessThan(0);

    input.reset();
    expect(input.sampleCameraInput(1 / 60)).toEqual({
      yawDelta: 0,
      pitchDelta: 0,
      zoomDelta: 0,
    });

    gamepad.axes[2] = 0;
    gamepad.axes[3] = 0;
    input.sample();
    gamepad.axes[2] = 0.5;
    gamepad.axes[3] = -0.5;
    expect(input.sampleCameraInput(1 / 60).yawDelta).toBeLessThan(0);
    input.dispose();
  });

  it('gamepad_blurAndHiddenClearControlsUntilNeutralAndDisposeRemovesListeners', () => {
    const gamepad = createGamepad({ axes: [0, -0.5, 0, 0] });
    const target = createTarget();
    const documentObject = createTarget();
    const input = createGamepadInput({
      getGamepads: () => [gamepad],
      target,
      documentObject,
    });

    expect(input.sample().throttle).toBe(0.5);
    target.dispatch('blur');
    expect(input.sample().throttle).toBe(0);
    target.dispatch('focus');
    expect(input.sample().throttle).toBe(0);

    gamepad.axes[1] = 0;
    input.sample();
    gamepad.axes[1] = -0.5;
    expect(input.sample().throttle).toBe(0.5);

    documentObject.hidden = true;
    documentObject.dispatch('visibilitychange');
    expect(input.sample().throttle).toBe(0);
    input.dispose();
    expect(target.listenerCount('blur')).toBe(0);
    expect(target.listenerCount('focus')).toBe(0);
    expect(target.listenerCount('gamepaddisconnected')).toBe(0);
    expect(documentObject.listenerCount('visibilitychange')).toBe(0);
    expect(input.sample().throttle).toBe(0);
  });
});
