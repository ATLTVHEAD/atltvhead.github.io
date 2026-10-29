import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createLocalPlayState, stepLocalPlay } from '../../js/game/core/local-play.js';
import { createComboState, reduceCombo } from '../../js/game/core/trick-combo.js';
import { createSkateLineFixture } from '../fixtures/skate-line.js';

const manifest = JSON.parse(readFileSync(new URL('../../assets/game/manifest.json', import.meta.url)));
const { world } = createSkateLineFixture({ assetManifest: manifest });
const NEUTRAL = Object.freeze({
  steer: 0, throttle: 0, brake: 0, grindHeld: false, jumpPressed: false,
  trickPressed: null, tagPressed: false, emotePressed: null,
});

function fallingTrick(elapsedMs) {
  return {
    ...createLocalPlayState(world, 'spawn-plaza'),
    position: [202, 0.001, 130],
    forward: [1, 0, 0],
    speed: 0,
    mode: 'airborne',
    verticalSpeed: -1,
    groundHeight: 0,
    coyoteAgeMs: 101,
    activeTrick: { id: 'spin', startedTick: 5, elapsedMs },
    tick: 8,
    sessionId: 'local-play-test',
  };
}

describe('local play composition', () => {
  it('localPlay_factoryOwnsPlanarStateAndZeroedComboTogether', () => {
    const state = createLocalPlayState(world, 'spawn-plaza');

    expect(state.spawnId).toBe('spawn-plaza');
    expect(state.mode).toBe('grounded');
    expect(state.combo).toMatchObject({
      pendingBase: 0, multiplier: 1, bankedScore: 0, lastProcessedEventIndex: 0,
    });
  });

  it('localPlay_completedTrickPrecedesSameTickLandingAndBanksOnce', () => {
    const result = stepLocalPlay(fallingTrick(299), NEUTRAL, 0.001, world);

    expect(result.state.mode).toBe('grounded');
    expect(result.events.map((event) => event.type)).toEqual(['trickCompleted', 'landed']);
    expect(result.events.map((event) => event.eventIndex)).toEqual([1, 2]);
    expect(result.state.combo.bankedScore).toBe(100);
    expect(result.state.combo.pendingBase).toBe(0);
  });

  it('localPlay_earlyLandingCancelsTrickAndDoesNotBankIt', () => {
    const result = stepLocalPlay(fallingTrick(100), NEUTRAL, 0.001, world);

    expect(result.state.mode).toBe('grounded');
    expect(result.events.map((event) => event.type)).toEqual(['trickCanceled', 'landed']);
    expect(result.state.combo.bankedScore).toBe(0);
    expect(result.state.combo.pendingBase).toBe(0);
  });

  it('localPlay_landingCancelsBeforeABufferedJumpReentersAirborne', () => {
    const result = stepLocalPlay(fallingTrick(100), { ...NEUTRAL, jumpPressed: true }, 0.001, world);

    expect(result.state.mode).toBe('airborne');
    expect(result.events.map((event) => event.type)).toEqual([
      'trickCanceled', 'landed', 'jumped',
    ]);
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'trickCanceled', trickId: 'spin', reason: 'landing',
    }));
    expect(result.events.some((event) => event.type === 'trickCompleted')).toBe(false);
    expect(result.state.combo.pendingBase).toBe(0);
  });

  it('localPlay_lastActionReportsOnlyPointsActuallyAwardedForRepeats', () => {
    const activeSpin = {
      ...createLocalPlayState(world, 'spawn-plaza'),
      position: [202, 10, 130],
      mode: 'airborne',
      verticalSpeed: 0,
      groundHeight: 0,
      coyoteAgeMs: 101,
      activeTrick: { id: 'spin', startedTick: 0, elapsedMs: 299 },
      tick: 0,
      eventIndex: 1,
      sessionId: 'repeat-feedback-test',
      combo: reduceCombo(createComboState(), {
        eventIndex: 1,
        tick: 0,
        type: 'trickCompleted',
        trickId: 'spin',
      }, world),
    };

    const secondSpin = stepLocalPlay(activeSpin, NEUTRAL, 1 / 60, world);
    expect(secondSpin.state.lastAction).toMatchObject({ label: 'Spin', basePoints: 50 });
    expect(secondSpin.state.combo.pendingBase).toBe(150);

    const thirdSpin = stepLocalPlay({
      ...secondSpin.state,
      activeTrick: { id: 'spin', startedTick: secondSpin.state.tick, elapsedMs: 299 },
    }, NEUTRAL, 1 / 60, world);
    expect(thirdSpin.state.lastAction).toMatchObject({ label: 'Spin', basePoints: 0 });
    expect(thirdSpin.state.combo.pendingBase).toBe(150);
  });

  it('localPlay_groundedTrickInputCannotAwardOrStartAction', () => {
    const initial = createLocalPlayState(world, 'spawn-plaza');
    const result = stepLocalPlay(initial, { ...NEUTRAL, trickPressed: 'spin' }, 1 / 60, world);

    expect(result.state.activeTrick ?? null).toBeNull();
    expect(result.state.combo.pendingBase).toBe(0);
    expect(result.state.combo.bankedScore).toBe(0);
    expect(result.events.some((event) => event.type === 'trickCompleted')).toBe(false);
  });
});
