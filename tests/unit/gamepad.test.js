import { describe, expect, it } from 'vitest';
import { createGamepadInput } from '../../js/game/input/gamepad.js';

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
    dispatch(type) {
      for (const callback of [...(listeners.get(type) ?? [])]) callback({ type });
    },
    listenerCount(type) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

describe('createGamepadInput', () => {
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
