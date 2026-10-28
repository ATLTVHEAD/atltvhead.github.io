function clampAxis(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

function clampUnit(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function createNeutralInputFrame() {
  return {
    steer: 0,
    throttle: 0,
    brake: 0,
    grindHeld: false,
    jumpPressed: false,
    trickPressed: null,
    tagPressed: false,
    emotePressed: null,
  };
}

export function normalizeInputFrame(input = {}) {
  const frame = input ?? {};
  return {
    steer: clampAxis(frame.steer),
    throttle: clampUnit(frame.throttle),
    brake: clampUnit(frame.brake),
    grindHeld: Boolean(frame.grindHeld),
    jumpPressed: Boolean(frame.jumpPressed),
    trickPressed: typeof frame.trickPressed === 'string' && frame.trickPressed
      ? frame.trickPressed
      : null,
    tagPressed: Boolean(frame.tagPressed),
    emotePressed: typeof frame.emotePressed === 'string' && frame.emotePressed
      ? frame.emotePressed
      : null,
  };
}

export function inputFrameFromLegacy(input = {}) {
  const legacy = clampInputAxes(input);
  const stickThrottle = Math.max(0, legacy.steerY);
  const stickBrake = Math.max(0, -legacy.steerY);
  return normalizeInputFrame({
    steer: legacy.steerX,
    throttle: legacy.accelerate ? 1 : stickThrottle,
    brake: legacy.brake ? 1 : stickBrake,
    grindHeld: legacy.grind,
    jumpPressed: legacy.jumpPressed,
    trickPressed: legacy.trickId,
    tagPressed: legacy.tagPressed,
    emotePressed: legacy.emoteId,
  });
}

export function createNeutralInput() {
  return {
    steerX: 0,
    steerY: 0,
    accelerate: false,
    brake: false,
    jumpPressed: false,
    trickId: null,
    grind: false,
    tagPressed: false,
    emoteId: null,
  };
}

export function clampInputAxes(input = {}) {
  return {
    ...createNeutralInput(),
    ...input,
    steerX: clampAxis(input.steerX),
    steerY: clampAxis(input.steerY),
  };
}
