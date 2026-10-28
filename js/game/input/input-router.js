import { createNeutralInputFrame, normalizeInputFrame } from './actions.js';

const INPUT_DEVICES = new Set(['keyboard', 'gamepad', 'touch']);
const INPUT_ACTIVATION_THRESHOLD = 0.2;
const DEVICE_ORDER = ['keyboard', 'gamepad', 'touch'];

function neutralCameraInput() {
  return { yawDelta: 0, pitchDelta: 0, zoomDelta: 0 };
}

function normalizeCameraInput(input) {
  const camera = input ?? {};
  return {
    yawDelta: Number.isFinite(camera.yawDelta) ? camera.yawDelta : 0,
    pitchDelta: Number.isFinite(camera.pitchDelta) ? camera.pitchDelta : 0,
    zoomDelta: Number.isFinite(camera.zoomDelta) ? camera.zoomDelta : 0,
  };
}

export function selectActiveInput(currentDevice, requestedDevice, activity, enabled = true) {
  if (!enabled || !INPUT_DEVICES.has(requestedDevice) || !Number.isFinite(activity)
    || activity < INPUT_ACTIVATION_THRESHOLD) {
    return currentDevice;
  }
  return requestedDevice;
}

export function createInputRouter({
  keyboard,
  gamepad,
  touch,
  isEnabled = () => true,
  onInvalidated = () => {},
} = {}) {
  const adapters = { keyboard, gamepad, touch };
  let activeDevice = 'keyboard';
  let disposed = false;

  function notifyIntent(device, activity = 1) {
    if (disposed) return false;
    const nextDevice = selectActiveInput(activeDevice, device, activity, isEnabled());
    if (nextDevice === activeDevice) return false;
    onInvalidated('ownership');
    adapters[activeDevice]?.reset?.();
    activeDevice = nextDevice;
    return true;
  }

  function reset() {
    for (const device of DEVICE_ORDER) adapters[device]?.reset?.();
    activeDevice = 'keyboard';
  }

  function sample() {
    if (disposed) return createNeutralInputFrame();
    if (!isEnabled()) {
      reset();
      return createNeutralInputFrame();
    }

    const frames = {};
    for (const device of DEVICE_ORDER) {
      frames[device] = normalizeInputFrame(adapters[device]?.sample?.() ?? createNeutralInputFrame());
    }
    return normalizeInputFrame(frames[activeDevice] ?? createNeutralInputFrame());
  }

  function sampleCameraInput(deltaSeconds) {
    if (disposed) return neutralCameraInput();
    if (!isEnabled()) {
      reset();
      return neutralCameraInput();
    }
    return normalizeCameraInput(adapters[activeDevice]?.sampleCameraInput?.(deltaSeconds));
  }

  return {
    sample,
    sampleCameraInput,
    reset,
    notifyIntent,
    getActiveDevice() {
      return activeDevice;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const device of DEVICE_ORDER) adapters[device]?.dispose?.();
      activeDevice = 'keyboard';
    },
  };
}
