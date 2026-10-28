import { createNeutralInputFrame } from './actions.js';
import { normalizeGamepad } from './gamepad-mapping.js';

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
  onInvalidated = () => {},
} = {}) {
  let previousButtons = [];
  let previousAxes = [0, 0, 0, 0];
  let status = null;
  let focused = true;
  let suppressedAxes = [false, false, false, false];
  let suppressedButtons = [];
  let axisArmed = [true, true, true, true];
  let identity = null;
  let disconnectedSinceIdentity = false;
  let disposed = false;
  let selectedIndex = null;
  let mapping = null;

  function selectedRaw() {
    const devices = connectedGamepads(getGamepads);
    return selectedIndex === null
      ? devices.find((pad) => pad.mapping === 'standard') ?? null
      : devices.find((pad) => pad.index === selectedIndex) ?? null;
  }

  function mappedPad(raw) {
    if (!raw) return null;
    if (mapping && mapping.deviceId === raw.id) {
      try {
        return { id: raw.id, index: raw.index, connected: true, mapping: 'standard',
          ...normalizeGamepad(raw, mapping) };
      } catch {
        return null;
      }
    }
    return raw.mapping === 'standard' ? raw : null;
  }

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
    const gamepad = mappedPad(selectedRaw());
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
    const pad = mappedPad(selectedRaw());
    syncBaseline(pad);
    suppressedAxes = previousAxes.map((axis) => Math.abs(axis) > AXIS_DEAD_ZONE);
    suppressedButtons = [...previousButtons];
    axisArmed = previousAxes.map((axis) => Math.abs(axis) < 0.2);
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

  function onDisconnected(event) {
    if (event?.gamepad && identity !== `${event.gamepad.index}:${event.gamepad.id}`) return;
    if (identity !== null && !disconnectedSinceIdentity) {
      disconnectedSinceIdentity = true;
      onInvalidated('gamepad-disconnected');
    }
    reset();
  }

  function currentGamepad() {
    if (disposed || !focused || documentObject?.hidden || !isEnabled()) return null;
    return getGamepad();
  }

  function filteredControls(gamepad) {
    const key = `${gamepad.index}:${gamepad.id}`;
    if (identity !== null && (identity !== key || disconnectedSinceIdentity)) {
      reset();
      onInvalidated('gamepad-replaced');
    }
    identity = key;
    disconnectedSinceIdentity = false;
    const axes = readAxes(gamepad).map((axis, index) => {
      if (suppressedAxes[index] && Math.abs(axis) <= AXIS_DEAD_ZONE) suppressedAxes[index] = false;
      return suppressedAxes[index] ? 0 : axis;
    });
    const buttons = readButtons(gamepad).map((pressed, index) => {
      if (!pressed) suppressedButtons[index] = false;
      return suppressedButtons[index] ? false : pressed;
    });
    return { axes, buttons };
  }

  function sample() {
    const neutral = createNeutralInputFrame();
    const gamepad = currentGamepad();
    if (!gamepad) {
      if (identity !== null && focused && !documentObject?.hidden && isEnabled()) {
        if (!disconnectedSinceIdentity) {
          disconnectedSinceIdentity = true;
          onInvalidated('gamepad-disconnected');
        }
      }
      syncBaseline(null);
      return neutral;
    }

    const { axes, buttons } = filteredControls(gamepad);
    axes.forEach((axis, index) => {
      if (Math.abs(axis) <= AXIS_DEAD_ZONE) axisArmed[index] = true;
      if (axisArmed[index] && Math.abs(axis) >= 0.2) {
        axisArmed[index] = false;
        onIntent(Math.abs(axis));
      }
    });

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
    const { axes } = filteredControls(gamepad);

    const delta = Number.isFinite(deltaSeconds) ? Math.max(0, Math.min(deltaSeconds, 0.1)) : 0;
    const cameraActivity = Math.max(Math.abs(axes[2]), Math.abs(axes[3]));
    const cameraChanged = Math.abs(axes[2] - previousAxes[2]) > 0.05
      || Math.abs(axes[3] - previousAxes[3]) > 0.05;
    if (cameraActivity >= 0.2 && cameraChanged) onIntent(cameraActivity);
    return {
      yawDelta: axes[2] ? -axes[2] * CAMERA_TURN_RATE * delta : 0,
      pitchDelta: axes[3] * CAMERA_TURN_RATE * delta,
      zoomDelta: 0,
    };
  }

  const targetListeners = [
    ['blur', onBlur],
    ['focus', onFocus],
    ['gamepaddisconnected', onDisconnected],
  ];
  for (const [type, listener] of targetListeners) target?.addEventListener?.(type, listener);
  documentObject?.addEventListener?.('visibilitychange', onVisibilityChange);

  return {
    sample,
    sampleCameraInput,
    reset,
    selectGamepad(index) {
      if (index !== null && (!Number.isInteger(index) || index < 0)) {
        throw new RangeError('Gamepad index must be a nonnegative integer or null.');
      }
      selectedIndex = index;
      identity = null;
      reset();
      onInvalidated('gamepad-selection');
    },
    setMapping(nextMapping) {
      const raw = selectedRaw();
      if (nextMapping !== null) normalizeGamepad(raw, nextMapping);
      mapping = nextMapping;
      reset();
      onInvalidated('gamepad-mapping');
    },
    getDiagnostics() {
      const devices = connectedGamepads(getGamepads).map((pad) => ({
        id: pad.id, index: pad.index, mapping: pad.mapping,
        axes: Array.from(pad.axes ?? []), buttons: Array.from(pad.buttons ?? [], (button) => ({
          pressed: Boolean(button?.pressed), value: Number.isFinite(button?.value) ? button.value : 0,
        })),
      }));
      const raw = selectedRaw();
      const normalized = mappedPad(raw);
      const menuBindings = mapping && raw && mapping.deviceId === raw.id
        ? mapping.buttons : { menu: 9, confirm: 0, cancel: 1 };
      return { devices, selectedIndex: raw?.index ?? selectedIndex,
        normalized: normalized ? { axes: [...normalized.axes], buttons: Array.from(normalized.buttons) } : null,
        menuButtons: normalized ? Object.fromEntries(['menu', 'confirm', 'cancel'].map((name) => [
          name, buttonPressed(raw.buttons?.[menuBindings[name]]),
        ])) : null,
        status: devices.length === 0 ? 'disconnected' : normalized ? 'ready' : 'unsupported' };
    },
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
