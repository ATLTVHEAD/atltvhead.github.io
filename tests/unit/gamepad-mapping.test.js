import { describe, expect, it } from 'vitest';
import { normalizeGamepad, standardGamepadMapping, createCalibration } from '../../js/game/input/gamepad-mapping.js';

function pad() {
  return { id: 'pad', axes: [0, -0.5, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
}

describe('gamepad mapping', () => {
  it('mapping_preservesHalfThrottle', () => {
    expect(normalizeGamepad(pad(), standardGamepadMapping('pad')).axes[1]).toBe(-0.5);
  });

  it('mapping_unknownRequiresExplicitBindings', () => {
    const mapping = standardGamepadMapping('pad');
    expect(() => normalizeGamepad(pad(), null)).toThrow();
    expect(() => normalizeGamepad(pad(), { ...mapping, axes: {} })).toThrow();
    expect(() => normalizeGamepad(pad(), { ...mapping, axes: {
      ...mapping.axes, steer: { index: 9, invert: false },
    } })).toThrow();
    expect(() => normalizeGamepad(pad(), { ...mapping, axes: {
      ...mapping.axes, cameraPitch: { index: 2, invert: false },
    } })).toThrow();
  });

  it('mapping_appliesExplicitInversionAndButtons', () => {
    const raw = pad();
    raw.buttons[5] = { pressed: true, value: 1 };
    const mapping = standardGamepadMapping('pad');
    mapping.axes.throttleBrake = { index: 1, invert: true };
    mapping.buttons.jump = 5;
    const normalized = normalizeGamepad(raw, mapping);
    expect(normalized.axes[1]).toBe(0.5);
    expect(normalized.buttons[0].pressed).toBe(true);
  });

  it('calibration_requiresNeutralAndReleaseForEachBinding', () => {
    const raw = pad();
    raw.axes[1] = 0;
    const calibration = createCalibration(raw.id);
    raw.axes[0] = 1;
    calibration.sample(raw);
    expect(calibration.getState().step).toBe(0);
    raw.axes[0] = 0;
    calibration.sample(raw);
    raw.axes[0] = -0.9;
    calibration.sample(raw);
    expect(calibration.getState().step).toBe(1);
    expect(calibration.getState().waitingForRelease).toBe(true);
    calibration.sample(raw);
    expect(calibration.getState().step).toBe(1);
  });

  it('calibration_collectsCompleteMappingWithoutImplicitIndices', () => {
    const raw = pad();
    raw.axes[1] = 0;
    const calibration = createCalibration(raw.id);
    for (let i = 0; i < 4; i += 1) {
      calibration.sample(raw);
      raw.axes[i] = i === 1 ? -1 : 1;
      calibration.sample(raw);
      raw.axes[i] = 0;
      calibration.sample(raw);
    }
    for (const index of [5, 2, 3, 1, 12, 15, 13, 14, 9, 5, 1]) {
      raw.buttons[index] = { pressed: true, value: 1 };
      calibration.sample(raw);
      raw.buttons[index] = { pressed: false, value: 0 };
      calibration.sample(raw);
    }
    const mapping = calibration.getState().mapping;
    expect(mapping.buttons.jump).toBe(5);
    expect(mapping.axes.throttleBrake.invert).toBe(false);
    expect(normalizeGamepad(raw, mapping).axes).toEqual([0, 0, 0, 0]);
  });
});
