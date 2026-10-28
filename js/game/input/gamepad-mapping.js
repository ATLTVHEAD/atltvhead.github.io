const AXES = ['steer', 'throttleBrake', 'cameraYaw', 'cameraPitch'];
const BUTTONS = {
  confirm: 0, cancel: 1, menu: 9,
  jump: 0, tag: 1, spin: 2, grab: 3,
  emoteUp: 12, emoteDown: 13, emoteLeft: 14, emoteRight: 15,
};
const CALIBRATION_AXES = [
  ['steer', 'Move steering right', 1],
  ['throttleBrake', 'Move throttle forward', -1],
  ['cameraYaw', 'Move camera right', 1],
  ['cameraPitch', 'Move camera down', 1],
];
const CALIBRATION_BUTTONS = [
  ['jump', 'Press Jump'], ['spin', 'Press Spin'], ['grab', 'Press Grab'],
  ['tag', 'Press Tag'], ['emoteUp', 'Press emote up'], ['emoteRight', 'Press emote right'],
  ['emoteDown', 'Press emote down'], ['emoteLeft', 'Press emote left'],
  ['menu', 'Press Menu'], ['confirm', 'Press Confirm'], ['cancel', 'Press Cancel'],
];

export function createCalibration(deviceId) {
  const mapping = { deviceId, axes: {}, buttons: {} };
  let step = 0;
  let waitingForRelease = true;
  function sample(raw) {
    if (!raw || raw.id !== deviceId || step >= CALIBRATION_AXES.length + CALIBRATION_BUTTONS.length) return;
    const axes = Array.from(raw.axes ?? []);
    const buttons = Array.from(raw.buttons ?? []);
    if (waitingForRelease) {
      if (axes.every((value) => Number.isFinite(value) && Math.abs(value) <= 0.15)
          && buttons.every((button) => !button?.pressed && !(button?.value >= 0.5))) waitingForRelease = false;
      return;
    }
    if (step < CALIBRATION_AXES.length) {
      const [name, , expectedDirection] = CALIBRATION_AXES[step];
      const used = Object.values(mapping.axes).map((binding) => binding.index);
      const index = axes.findIndex((value, candidate) => Number.isFinite(value)
        && Math.abs(value) >= 0.65 && !used.includes(candidate));
      if (index < 0) return;
      mapping.axes[name] = { index, invert: Math.sign(axes[index]) !== expectedDirection };
    } else {
      const [name] = CALIBRATION_BUTTONS[step - CALIBRATION_AXES.length];
      const index = buttons.findIndex((button) => button?.pressed || button?.value >= 0.5);
      if (index < 0) return;
      mapping.buttons[name] = index;
    }
    step += 1;
    waitingForRelease = true;
  }
  return {
    sample,
    getState() {
      const total = CALIBRATION_AXES.length + CALIBRATION_BUTTONS.length;
      const current = step < CALIBRATION_AXES.length ? CALIBRATION_AXES[step]
        : CALIBRATION_BUTTONS[step - CALIBRATION_AXES.length];
      return { step, total, waitingForRelease, prompt: current?.[1] ?? 'Calibration complete',
        mapping: step === total ? structuredClone(mapping) : null };
    },
  };
}

export function standardGamepadMapping(deviceId) {
  return {
    deviceId,
    axes: Object.fromEntries(AXES.map((name, index) => [name, { index, invert: false }])),
    buttons: { jump: 0, spin: 2, grab: 3, tag: 1, emoteUp: 12, emoteRight: 15,
      emoteDown: 13, emoteLeft: 14, menu: 9, confirm: 0, cancel: 1 },
  };
}

export function normalizeGamepad(raw, mapping) {
  if (!raw || !mapping || mapping.deviceId !== raw.id || !Array.isArray(raw.axes)
      || !raw.buttons || !mapping.axes || !mapping.buttons) {
    throw new TypeError('A complete mapping for this gamepad is required.');
  }
  const usedAxes = new Set();
  const axes = AXES.map((name) => {
    const binding = mapping.axes[name];
    if (!binding || !Number.isInteger(binding.index) || binding.index < 0
        || binding.index >= raw.axes.length || typeof binding.invert !== 'boolean'
        || (usedAxes.has(binding.index) && !mapping.allowAxisAliases)) {
      throw new RangeError(`Invalid axis binding: ${name}`);
    }
    usedAxes.add(binding.index);
    const value = raw.axes[binding.index];
    const bounded = Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
    return binding.invert ? -bounded : bounded;
  });
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
  for (const [name, outputIndex] of Object.entries(BUTTONS)) {
    const index = mapping.buttons[name];
    if (!Number.isInteger(index) || index < 0 || index >= raw.buttons.length) {
      throw new RangeError(`Invalid button binding: ${name}`);
    }
    const button = raw.buttons[index];
    buttons[outputIndex] = { pressed: Boolean(button?.pressed),
      value: Number.isFinite(button?.value) ? Math.max(0, Math.min(1, button.value)) : 0 };
  }
  return { axes, buttons };
}
