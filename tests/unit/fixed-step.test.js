import { describe, expect, it } from 'vitest';
import { createNeutralInputFrame } from '../../js/game/input/actions.js';
import {
  advanceFixedStep,
  clearPendingInput,
  createFixedStepState,
} from '../../js/game/core/fixed-step.js';

function simulateAtFramesPerSecond(framesPerSecond) {
  let state = createFixedStepState({ distance: 0, ticks: 0 });
  const frameMs = 1000 / framesPerSecond;
  const step = (current, input, deltaSeconds) => ({
    distance: current.distance + (input.throttle * 12 * deltaSeconds),
    ticks: current.ticks + 1,
  });

  for (let frame = 0; frame < framesPerSecond; frame += 1) {
    state = advanceFixedStep(state, frameMs, {
      ...createNeutralInputFrame(),
      throttle: 1,
    }, step).loopState;
  }
  return state.currentState;
}

describe('advanceFixedStep', () => {
  it('fixedStep_clearPendingPreservesPoseAndTick', () => {
    const pose = { ticks: 0 };
    const pending = advanceFixedStep(createFixedStepState(pose), 8, {
      ...createNeutralInputFrame(), jumpPressed: true, tagPressed: true,
    }, (state) => state).loopState;
    const cleared = clearPendingInput(pending);
    const inputs = [];
    const result = advanceFixedStep(cleared, 20, createNeutralInputFrame(), (state, input) => {
      inputs.push(input);
      return state;
    });
    expect(cleared.currentState).toBe(pose);
    expect(cleared.tick).toBe(0);
    expect(pending.pendingEdges.jumpPressed).toBe(true);
    expect(result.steps).toBeGreaterThan(0);
    expect(inputs.every((input) => !input.jumpPressed && !input.tagPressed)).toBe(true);
  });
  it('advanceFixedStep_30_60_120RenderSchedulesProduceTheSame60Ticks', () => {
    const at30 = simulateAtFramesPerSecond(30);
    const at60 = simulateAtFramesPerSecond(60);
    const at120 = simulateAtFramesPerSecond(120);

    expect(at30.ticks).toBe(60);
    expect(at60.ticks).toBe(60);
    expect(at120.ticks).toBe(60);
    expect(Math.abs(at30.distance - at120.distance)).toBeLessThan(0.02);
    expect(Math.abs(at60.distance - at120.distance)).toBeLessThan(0.02);
  });

  it('advanceFixedStep_consumesOneJumpEdgeAcrossCatchupTicks', () => {
    let jumps = 0;
    const result = advanceFixedStep(
      createFixedStepState({}),
      100,
      { ...createNeutralInputFrame(), jumpPressed: true },
      (state, input) => {
        if (input.jumpPressed) jumps += 1;
        return state;
      },
    );

    expect(result.steps).toBe(6);
    expect(jumps).toBe(1);
  });

  it('advanceFixedStep_discardsHiddenTimeAndDoesNotCatchUpOnResume', () => {
    const step = (state) => ({ ticks: state.ticks + 1 });
    const initial = createFixedStepState({ ticks: 0 });
    const hidden = advanceFixedStep(initial, 2_000, createNeutralInputFrame(), step, { hidden: true });
    const resumed = advanceFixedStep(hidden.loopState, 2_000, createNeutralInputFrame(), step);

    expect(hidden.steps).toBe(0);
    expect(resumed.steps).toBe(0);
    expect(resumed.loopState.currentState.ticks).toBe(0);
  });

  it('advanceFixedStep_limitsA500msFrameToSixTicks', () => {
    const result = advanceFixedStep(
      createFixedStepState({ ticks: 0 }),
      500,
      createNeutralInputFrame(),
      (state) => ({ ticks: state.ticks + 1 }),
    );

    expect(result.steps).toBeLessThanOrEqual(6);
    expect(result.loopState.currentState.ticks).toBeLessThanOrEqual(6);
  });

  it('advanceFixedStep_returnsInterpolatedFractionAndEveryStepOutput', () => {
    const result = advanceFixedStep(
      createFixedStepState(0),
      25,
      createNeutralInputFrame(),
      (state, _input, deltaSeconds) => state + deltaSeconds,
    );

    expect(result.steps).toBe(1);
    expect(result.alpha).toBeCloseTo(0.5);
    expect(result.outputs).toHaveLength(1);
  });
});
