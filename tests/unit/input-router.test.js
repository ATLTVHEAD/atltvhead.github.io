import { describe, expect, it } from 'vitest';
import { createNeutralInputFrame } from '../../js/game/input/actions.js';
import { createGamepadInput } from '../../js/game/input/gamepad.js';
import { createInputRouter, selectActiveInput } from '../../js/game/input/input-router.js';

function createSource(device, cameraInput = { yawDelta: 0, pitchDelta: 0, zoomDelta: 0 }) {
  let frame = createNeutralInputFrame();
  let camera = { ...cameraInput };
  let router = null;
  let resetCount = 0;
  let disposeCount = 0;
  return {
    sample: () => ({ ...frame }),
    sampleCameraInput: () => ({ ...camera }),
    reset() {
      resetCount += 1;
      frame = createNeutralInputFrame();
      camera = { yawDelta: 0, pitchDelta: 0, zoomDelta: 0 };
    },
    dispose() {
      disposeCount += 1;
      frame = createNeutralInputFrame();
    },
    setFrame(nextFrame) {
      frame = { ...createNeutralInputFrame(), ...nextFrame };
    },
    setCamera(nextCamera) {
      camera = { ...camera, ...nextCamera };
    },
    intent(activity = 1) {
      router?.notifyIntent(device, activity);
    },
    attach(inputRouter) {
      router = inputRouter;
    },
    get resetCount() { return resetCount; },
    get disposeCount() { return disposeCount; },
  };
}

describe('selectActiveInput', () => {
  it('inputRouter_switchesOnlyForEnabledKnownIntentAtThreshold', () => {
    expect(selectActiveInput('keyboard', 'gamepad', 0.19)).toBe('keyboard');
    expect(selectActiveInput('keyboard', 'gamepad', 0.2)).toBe('gamepad');
    expect(selectActiveInput('touch', 'keyboard', 1, false)).toBe('touch');
    expect(selectActiveInput('gamepad', 'mouse', 1)).toBe('gamepad');
  });
});

describe('createInputRouter', () => {
  it('inputRouter_ignoresNeutralGamepadNoiseAndSwitchesWithoutStaleInput', () => {
    const keyboard = createSource('keyboard');
    const gamepad = createSource('gamepad');
    const touch = createSource('touch');
    const router = createInputRouter({ keyboard, gamepad, touch });
    keyboard.attach(router);
    gamepad.attach(router);
    touch.attach(router);

    keyboard.setFrame({ throttle: 1 });
    keyboard.intent();
    expect(router.sample().throttle).toBe(1);

    gamepad.setFrame({ steer: 0.18 });
    expect(router.sample()).toMatchObject({ throttle: 1, steer: 0 });
    expect(router.getActiveDevice()).toBe('keyboard');

    gamepad.setFrame({ steer: 0.7, jumpPressed: true });
    gamepad.intent(0.7);
    expect(keyboard.resetCount).toBe(1);
    expect(router.sample()).toMatchObject({ steer: 0.7, jumpPressed: true });

    keyboard.setFrame({ steer: -1 });
    keyboard.intent();
    expect(gamepad.resetCount).toBe(1);
    expect(router.sample()).toMatchObject({ steer: -1, jumpPressed: false });
    router.dispose();
  });

  it('inputRouter_resetClearsAllSourcesAndCameraComesOnlyFromActiveSource', () => {
    let enabled = true;
    const keyboard = createSource('keyboard', { yawDelta: 0.25, pitchDelta: 0, zoomDelta: 0 });
    const gamepad = createSource('gamepad', { yawDelta: -0.5, pitchDelta: 0.1, zoomDelta: 0 });
    const touch = createSource('touch');
    const router = createInputRouter({
      keyboard,
      gamepad,
      touch,
      isEnabled: () => enabled,
    });
    keyboard.attach(router);
    gamepad.attach(router);
    touch.attach(router);

    expect(router.sampleCameraInput().yawDelta).toBe(0.25);
    gamepad.setFrame({ throttle: 0.5 });
    gamepad.intent();
    expect(router.sampleCameraInput()).toMatchObject({ yawDelta: -0.5, pitchDelta: 0.1 });

    router.reset();
    expect(router.getActiveDevice()).toBe('keyboard');
    expect(router.sample()).toEqual(createNeutralInputFrame());
    expect([keyboard.resetCount, gamepad.resetCount, touch.resetCount]).toEqual([2, 1, 1]);

    enabled = false;
    touch.setFrame({ jumpPressed: true });
    touch.intent();
    expect(router.sample()).toEqual(createNeutralInputFrame());
    expect(router.getActiveDevice()).toBe('keyboard');
    router.dispose();
    expect([keyboard.disposeCount, gamepad.disposeCount, touch.disposeCount]).toEqual([1, 1, 1]);
  });

  it('inputRouter_rightStickAloneSelectsGamepadCameraWithoutAddingMovement', () => {
    const gamepadDevice = {
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0.5, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    };
    const keyboard = createSource('keyboard');
    const touch = createSource('touch');
    let router;
    const gamepad = createGamepadInput({
      getGamepads: () => [gamepadDevice],
      target: null,
      documentObject: null,
      onIntent: (activity) => router?.notifyIntent('gamepad', activity),
    });
    router = createInputRouter({ keyboard, gamepad, touch });

    expect(router.getActiveDevice()).toBe('keyboard');
    expect(router.sample()).toEqual(createNeutralInputFrame());
    expect(router.getActiveDevice()).toBe('gamepad');
    expect(router.sampleCameraInput(1 / 60).yawDelta).toBeLessThan(0);
    router.dispose();
  });
});
