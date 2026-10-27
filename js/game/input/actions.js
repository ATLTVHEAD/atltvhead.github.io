function clampAxis(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
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
