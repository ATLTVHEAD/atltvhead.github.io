import { describe, expect, it } from 'vitest';
import {
  chooseFallbackTangent,
  cross3,
  dot3,
  advanceAlongSphere,
  makeSurfaceFrame,
  normalize3,
  projectToTangent,
  rotateAroundAxis,
} from '../../js/game/core/planet-math.js';

describe('projectToTangent', () => {
  it('projectToTangent_removesNormalComponent', () => {
    const result = projectToTangent([1, 2, 3], [0, 1, 0]);

    expect(result).toEqual([1, 0, 3]);
    expect(dot3(result, [0, 1, 0])).toBe(0);
  });

  it('projectToTangent_parallelInputReturnsZero', () => {
    expect(projectToTangent([0, 5, 0], [0, 1, 0])).toEqual([0, 0, 0]);
  });
});

describe('planet vector helpers', () => {
  it('dot3_returnsTheThreeDimensionalDotProduct', () => {
    expect(dot3([1, 2, 3], [4, -2, 1])).toBe(3);
  });

  it('normalize3_returnsUnitVectorsAndSafeZeroForInvalidVectors', () => {
    expect(normalize3([0, 3, 4])).toEqual([0, 0.6, 0.8]);
    expect(normalize3([0, 0, 0])).toEqual([0, 0, 0]);
    expect(normalize3([Number.NaN, 1, 0])).toEqual([0, 0, 0]);
  });
});

describe('makeSurfaceFrame', () => {
  it('makeSurfaceFrame_returnsOrthonormalBasis', () => {
    const frame = makeSurfaceFrame([0, 1, 0], [0, 0, -1]);

    expect(frame.up).toEqual([0, 1, 0]);
    expect(frame.forward).toEqual([0, 0, -1]);
    expect(frame.right).toEqual([1, 0, 0]);
    expect(dot3(frame.up, frame.forward)).toBeCloseTo(0);
    expect(dot3(frame.up, frame.right)).toBeCloseTo(0);
    expect(dot3(frame.forward, frame.right)).toBeCloseTo(0);
    expect(Math.hypot(...frame.up)).toBeCloseTo(1);
    expect(Math.hypot(...frame.forward)).toBeCloseTo(1);
    expect(Math.hypot(...frame.right)).toBeCloseTo(1);
  });

  it('makeSurfaceFrame_handlesPoleAndSeam', () => {
    const frames = [
      makeSurfaceFrame([1e-8, 1, 0], [0, 0, -1]),
      makeSurfaceFrame([0, 1, 1e-8], [0, 0, -1]),
      makeSurfaceFrame([-1e-8, 1, 0], [0, 0, -1]),
      makeSurfaceFrame([0, -1, 0], [0, 0, -1]),
      makeSurfaceFrame([-1, 0, 1e-8], [0, 1, 0]),
      makeSurfaceFrame([-1, 0, -1e-8], [0, 1, 0]),
    ];

    for (const frame of frames) {
      for (const axis of [frame.up, frame.forward, frame.right]) {
        expect(axis.every(Number.isFinite)).toBe(true);
        expect(Math.hypot(...axis)).toBeCloseTo(1);
      }
      expect(dot3(frame.up, frame.forward)).toBeCloseTo(0);
      expect(dot3(frame.up, frame.right)).toBeCloseTo(0);
      expect(dot3(frame.forward, frame.right)).toBeCloseTo(0);
    }
  });
});

describe('surface frame vector helpers', () => {
  it('cross3_returnsRightHandedProductAndZeroForParallelInputs', () => {
    expect(cross3([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
    expect(cross3([0, 1, 0], [0, 2, 0])).toEqual([0, 0, 0]);
  });

  it('chooseFallbackTangent_handlesParallelAndNearZeroHeadings', () => {
    const tangent = chooseFallbackTangent([0, 1, 0], [0, 2, 0]);
    const nearZero = chooseFallbackTangent([0, 1, 0], [1e-14, 0, 0]);

    expect(Math.hypot(...tangent)).toBeCloseTo(1);
    expect(dot3(tangent, [0, 1, 0])).toBeCloseTo(0);
    expect(Math.hypot(...nearZero)).toBeCloseTo(1);
    expect(dot3(nearZero, [0, 1, 0])).toBeCloseTo(0);
  });
});

describe('advanceAlongSphere', () => {
  it('advanceAlongSphere_preservesRadiusAcrossLargeTurn', () => {
    const position = advanceAlongSphere([10, 0, 0], [0, 0, -1], 100, 10);

    expect(Math.hypot(...position)).toBeCloseTo(10);
    expect(position[0]).toBeCloseTo(10 * Math.cos(10));
    expect(position[2]).toBeCloseTo(-10 * Math.sin(10));
  });

  it('advanceAlongSphere_zeroDistanceIsNoop', () => {
    expect(advanceAlongSphere([0, 7, 0], [1, 0, 0], 0, 7)).toEqual([0, 7, 0]);
  });
});

describe('rotateAroundAxis', () => {
  it('rotateAroundAxis_rotatesAroundNormalizedAxis', () => {
    expect(rotateAroundAxis([1, 0, 0], [0, 0, 1], Math.PI / 2))
      .toEqual([0, 1, 0]);
    expect(rotateAroundAxis([1, 0, 0], [0, 0, 2], Math.PI / 2))
      .toEqual([0, 1, 0]);
  });

  it('rotateAroundAxis_zeroAxisIsNoop', () => {
    expect(rotateAroundAxis([1, 2, 3], [0, 0, 0], Math.PI / 2))
      .toEqual([1, 2, 3]);
  });
});
