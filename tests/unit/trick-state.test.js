import { describe, expect, it } from 'vitest';
import { stepTrick } from '../../js/game/core/trick-state.js';

const world = { rails: [] };
const neutral = Object.freeze({ trickPressed: null });

function state(overrides = {}) {
  return {
    position: [10, 1, 10],
    forward: [1, 0, 0],
    mode: 'airborne',
    speed: 3,
    verticalSpeed: 0,
    tick: 20,
    sessionId: 'trick-test',
    eventIndex: 0,
    activeTrick: null,
    ...overrides,
  };
}

describe('timed trick state', () => {
  it('trick_unknownGroundedAndEarlyLandingReject', () => {
    const unknown = stepTrick(state(), { trickPressed: 'kickflip' }, 1 / 60, world);
    const grounded = stepTrick(state({ mode: 'grounded' }), { trickPressed: 'spin' }, 1 / 60, world);
    const earlyLanding = stepTrick(state({
      mode: 'grounded',
      activeTrick: { id: 'spin', startedTick: 10, elapsedMs: 100 },
    }), neutral, 1 / 60, world);

    expect(unknown.state.activeTrick).toBeNull();
    expect(unknown.events).toEqual([]);
    expect(grounded.state.activeTrick).toBeNull();
    expect(grounded.events).toEqual([]);
    expect(earlyLanding.state.activeTrick).toBeNull();
    expect(earlyLanding.events.map((event) => event.type)).toEqual(['trickCanceled']);
    expect(earlyLanding.events[0]).toMatchObject({ trickId: 'spin', reason: 'landing' });
  });

  it('trick_actionRunsFor299ThenCompletesAt300AndBy301Milliseconds', () => {
    const before = state({ activeTrick: { id: 'spin', startedTick: 12, elapsedMs: 0 } });
    const at299 = stepTrick(before, neutral, 0.299, world);
    const at300 = stepTrick(before, neutral, 0.3, world);
    const at301 = stepTrick(before, neutral, 0.301, world);

    expect(at299.state.activeTrick.elapsedMs).toBeCloseTo(299, 10);
    expect(at299.events).toEqual([]);
    expect(at300.state.activeTrick).toBeNull();
    expect(at300.events.map((event) => event.type)).toEqual(['trickCompleted']);
    expect(at301.state.activeTrick).toBeNull();
    expect(at301.events.map((event) => event.type)).toEqual(['trickCompleted']);
  });

  it('trick_completedActionWinsWhenLandingCrossesTheSameTick', () => {
    const result = stepTrick(state({
      mode: 'grounded',
      activeTrick: { id: 'grab', startedTick: 12, elapsedMs: 299 },
    }), neutral, 0.001, world);

    expect(result.state.activeTrick).toBeNull();
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      eventId: 'trick-test:20:1', eventIndex: 1, tick: 20,
      type: 'trickCompleted', trickId: 'grab',
    });
  });

  it('trick_startCreatesOneTimedActionWithoutMutatingItsInput', () => {
    const initial = state();
    const result = stepTrick(initial, { trickPressed: 'grab' }, 1 / 60, world);

    expect(initial.activeTrick).toBeNull();
    expect(result.state.activeTrick).toEqual({ id: 'grab', startedTick: 20, elapsedMs: 0 });
    expect(result.state.eventIndex).toBe(1);
    expect(result.events[0]).toMatchObject({
      type: 'trickStarted', trickId: 'grab', eventIndex: 1,
    });
  });
});
