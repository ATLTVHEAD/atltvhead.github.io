import { describe, expect, it } from 'vitest';
import {
  nearestImage,
  wrapDelta,
  wrapPosition,
  wrapScalar,
} from '../../js/game/core/wrap-math.js';

describe('periodic world coordinates', () => {
  it('wrap_exactNegativeAndMultipleSpans', () => {
    expect(wrapScalar(-1, 256)).toBe(255);
    expect(wrapScalar(512, 256)).toBe(0);
    expect(wrapScalar(-512, 256)).toBe(0);
    expect(wrapScalar(256, 256)).toBe(0);
  });

  it('wrap_shortestDeltaAndHalfSpanTie', () => {
    expect(wrapDelta(255.8, 0.2, 256)).toBeCloseTo(0.4);
    expect(wrapDelta(0.2, 255.8, 256)).toBeCloseTo(-0.4);
    expect(wrapDelta(0, 128, 256)).toBe(-128);
    expect(wrapDelta(128, 0, 256)).toBe(-128);
    expect(nearestImage(1, 255, 256)).toBe(257);
    expect(nearestImage(255, 1, 256)).toBe(-1);
  });

  it('wrap_positionPreservesHeightAndInputs', () => {
    const input = [-1, 7, 257];
    expect(wrapPosition(input, { width: 256, depth: 256 })).toEqual([255, 7, 1]);
    expect(input).toEqual([-1, 7, 257]);
  });

  it('wrap_rejectsInvalidDimensions', () => {
    expect(() => wrapScalar(1, 0)).toThrow(RangeError);
    expect(() => wrapScalar(Number.NaN, 256)).toThrow(RangeError);
    expect(() => wrapDelta(0, Number.POSITIVE_INFINITY, 256)).toThrow(RangeError);
    expect(() => nearestImage(1, 2, -1)).toThrow(RangeError);
    expect(() => wrapPosition([1, 2], { width: 256, depth: 256 })).toThrow(RangeError);
    expect(() => wrapPosition([1, 2, 3], null)).toThrow(RangeError);
    expect(() => wrapPosition([Number.NaN, 2, 3], { width: 256, depth: 256 })).toThrow(RangeError);
    expect(() => wrapPosition([1, 2, 3], { width: 256, depth: Number.NaN })).toThrow(RangeError);
  });
});
