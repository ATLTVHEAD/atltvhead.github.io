import { createNeutralInputFrame } from './actions.js';

const AXIS_DEAD_ZONE = 0.15;
const BUTTON_THRESHOLD = 0.5;
const CAMERA_TURN_RATE = 2.4;
const ACTION_BUTTON_INDICES = [0, 1, 2, 3, 12, 13, 14, 15];
const EMOTE_BUTTONS = [
  [12, 'wave'],
  [15, 'cheer'],
  [13, 'follow'],
  [14, 'wave'],
];

function clampAxis(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

function deadzone(value) {
  const axis = clampAxis(value);
  return Math.abs(axis) <= AXIS_DEAD_ZONE ? 0 : axis;
}

function buttonPressed(button) {
  return Boolean(button?.pressed) || (Number.isFinite(button?.value)
    && button.value >= BUTTON_THRESHOLD);
}

function readButtons(gamepad) {
  return Array.from({ length: Math.max(17, gamepad.buttons?.length ?? 0) }, (_, index) => (
    buttonPressed(gamepad.buttons?.[index])
  ));
}

function readAxes(gamepad) {
  return Array.from({ length: 4 }, (_, index) => deadzone(gamepad.axes?.[index]));
}

function connectedGamepads(getGamepads) {
  try {
    return Array.from(getGamepads?.() ?? []).filter((gamepad) => gamepad?.connected);
  } catch {
    return [];
  }
}

function latestGamepad(getGamepads) {
  return connectedGamepads(getGamepads)
    .find((gamepad) => gamepad.mapping === 'standard') ?? null;
}

function controlsActive(gamepad, axes = readAxes(gamepad), buttons = readButtons(gamepad)) {
  return axes.some((axis) => Math.abs(axis) > AXIS_DEAD_ZONE)
    || ACTION_BUTTON_INDICES.some((index) => buttons[index]);
}

function neutralCameraInput() {
  return { yawDelta: 0, pitchDelta: 0, zoomDelta: 0 };
}

export function createGamepadInput({
  getGamepads = () => globalThis.navigator?.getGamepads?.() ?? [],
  target = globalThis.window,
  documentObject = globalThis.document,
  isEnabled = () => true,
  onIntent = () => {},
  onStatusChange = () => {},
} = {}) {
  let previousButtons = [];
  let previousAxes = [0, 0, 0, 0];
  let status = null;
  let focused = true;
  let ignoreUntilNeutral = false;
  let disposed = false;

  function setStatus(nextStatus) {
    if (status === nextStatus) return;
    status = nextStatus;
    if (typeof onStatusChange === 'function') onStatusChange(status);
  }

  function getGamepad() {
    const connected = connectedGamepads(getGamepads);
    if (connected.length === 0) {
      setStatus('disconnected');
      return null;
    }
    const gamepad = connected.find((candidate) => candidate.mapping === 'standard');
    if (!gamepad) {
      setStatus('unsupported');
      return null;
    }
    setStatus('ready');
    return gamepad;
  }

  function syncBaseline(gamepad) {
    if (!gamepad || gamepad.mapping !== 'standard') {
      previousButtons = [];
      previousAxes = [0, 0, 0, 0];
      return;
    }
    previousButtons = readButtons(gamepad);
    previousAxes = readAxes(gamepad);
  }

  function reset() {
    syncBaseline(latestGamepad(getGamepads));
    ignoreUntilNeutral = true;
  }

  function onBlur() {
    focused = false;
    reset();
  }

  function onFocus() {
    focused = true;
    reset();
  }

  function onVisibilityChange() {
    if (documentObject?.hidden) reset();
  }

  function currentGamepad() {
    if (disposed || !focused || documentObject?.hidden || !isEnabled()) return null;
    return getGamepad();
  }

  function suppressUntilNeutral(gamepad, axes, buttons) {
    if (!ignoreUntilNeutral) return false;
    syncBaseline(gamepad);
    if (!controlsActive(gamepad, axes, buttons)) ignoreUntilNeutral = false;
    return true;
  }

  function sample() {
    const neutral = createNeutralInputFrame();
    const gamepad = currentGamepad();
    if (!gamepad) {
      syncBaseline(null);
      return neutral;
    }

    const axes = readAxes(gamepad);
    const buttons = readButtons(gamepad);
    if (suppressUntilNeutral(gamepad, axes, buttons)) return neutral;

    const activity = Math.max(...axes.map(Math.abs));
    const axesChanged = axes.some((axis, index) => Math.abs(axis - previousAxes[index]) > 0.05);
    if (activity >= 0.2 && axesChanged) onIntent(activity);

    const rising = (index) => Boolean(buttons[index] && !previousButtons[index]);
    const jumpPressed = rising(0);
    const trickPressed = rising(2) ? 'spin' : rising(3) ? 'grab' : null;
    const tagPressed = rising(1);
    const emotePressed = EMOTE_BUTTONS.find(([index]) => rising(index))?.[1] ?? null;
    if (jumpPressed || trickPressed || tagPressed || emotePressed) {
      onIntent(1);
    }

    previousButtons = buttons;
    previousAxes = axes;
    return {
      ...neutral,
      steer: axes[0],
      throttle: Math.max(0, -axes[1]),
      brake: Math.max(0, axes[1]),
      jumpPressed,
      trickPressed,
      tagPressed,
      emotePressed,
    };
  }

  function sampleCameraInput(deltaSeconds = 1 / 60) {
    const gamepad = currentGamepad();
    if (!gamepad) return neutralCameraInput();
    const axes = readAxes(gamepad);
    const buttons = readButtons(gamepad);
    if (suppressUntilNeutral(gamepad, axes, buttons)) return neutralCameraInput();

    const delta = Number.isFinite(deltaSeconds) ? Math.max(0, Math.min(deltaSeconds, 0.1)) : 0;
    const cameraActivity = Math.max(Math.abs(axes[2]), Math.abs(axes[3]));
    const cameraChanged = Math.abs(axes[2] - previousAxes[2]) > 0.05
      || Math.abs(axes[3] - previousAxes[3]) > 0.05;
    if (cameraActivity >= 0.2 && cameraChanged) onIntent(cameraActivity);
    return {
      yawDelta: -axes[2] * CAMERA_TURN_RATE * delta,
      pitchDelta: axes[3] * CAMERA_TURN_RATE * delta,
      zoomDelta: 0,
    };
  }

  const targetListeners = [
    ['blur', onBlur],
    ['focus', onFocus],
    ['gamepaddisconnected', reset],
  ];
  for (const [type, listener] of targetListeners) target?.addEventListener?.(type, listener);
  documentObject?.addEventListener?.('visibilitychange', onVisibilityChange);

  return {
    sample,
    sampleCameraInput,
    reset,
    getStatus() {
      return status ?? 'disconnected';
    },
    dispose() {
      if (disposed) return;
      reset();
      disposed = true;
      for (const [type, listener] of targetListeners) target?.removeEventListener?.(type, listener);
      documentObject?.removeEventListener?.('visibilitychange', onVisibilityChange);
    },
  };
}
