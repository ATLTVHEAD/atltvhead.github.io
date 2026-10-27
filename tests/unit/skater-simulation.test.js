import { describe, expect, it } from 'vitest';
import { clampInputAxes } from '../../js/game/input/actions.js';
import { stepSkater } from '../../js/game/core/skater-simulation.js';

const initialState = {
  position: [10, 0, 0],
  forward: [0, 0, -1],
  speed: 0,
  airborne: false,
  verticalSpeed: 0,
};

const neutralInput = {
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

describe('stepSkater', () => {
  it('stepSkater_neutralInputKeepsState', () => {
    expect(stepSkater(initialState, neutralInput, 0.1)).toEqual(initialState);
  });

  it('stepSkater_clampsSpeedAndPreservesGroundRadius', () => {
    const fast = stepSkater(
      { ...initialState, speed: 11.9 },
      { ...neutralInput, accelerate: true },
      0.25,
    );
    const braked = stepSkater(
      { ...initialState, speed: 0.1 },
      { ...neutralInput, brake: true },
      0.25,
    );

    expect(fast.speed).toBeLessThanOrEqual(12);
    expect(braked.speed).toBeGreaterThanOrEqual(0);
    expect(Math.hypot(...fast.position)).toBeCloseTo(10);
  });

  it('stepSkater_positiveSteeringTurnsRight', () => {
    const result = stepSkater(
      { ...initialState, position: [0, 10, 0], speed: 5 },
      { ...neutralInput, steerX: 1 },
      0.1,
    );

    expect(result.forward[0]).toBeGreaterThan(0);
  });

  it('stepSkater_jumpTransitionsToAirborne', () => {
    const result = stepSkater(
      initialState,
      { ...neutralInput, jumpPressed: true },
      0.1,
    );

    expect(result.airborne).toBe(true);
    expect(result.verticalSpeed).toBeGreaterThan(0);
    expect(result.groundRadius).toBeCloseTo(10);
    expect(Math.hypot(...result.position)).toBeGreaterThan(10);
  });

  it('stepSkater_zeroOrNegativeDeltaDoesNotMove', () => {
    const moving = { ...initialState, speed: 5 };

    expect(stepSkater(moving, neutralInput, 0)).toEqual(moving);
    expect(stepSkater(moving, neutralInput, -1)).toEqual(moving);
  });
});

describe('clampInputAxes', () => {
  it('clampInputAxes_boundsAxesAndReplacesNonFiniteValues', () => {
    expect(clampInputAxes({ steerX: 2, steerY: -2 })).toMatchObject({
      steerX: 1,
      steerY: -1,
    });
    expect(clampInputAxes({ steerX: Number.NaN, steerY: Number.POSITIVE_INFINITY }))
      .toMatchObject({ steerX: 0, steerY: 0 });
  });
});
