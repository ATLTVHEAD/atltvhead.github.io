import { describe, expect, it } from 'vitest';
import { createComboState, reduceCombo } from '../../js/game/core/trick-combo.js';

const world = { rails: [{ id: 'rail-a', totalLength: 100 }] };
let nextIndex = 0;

function event(type, context = {}, tick = nextIndex + 1) {
  nextIndex += 1;
  return {
    eventId: `combo-test:${tick}:${nextIndex}`,
    eventIndex: nextIndex,
    tick,
    type,
    ...context,
  };
}

function fresh() {
  nextIndex = 0;
  return createComboState();
}

function complete(combo, trickId, tick, tuning) {
  return reduceCombo(combo, event('trickCompleted', { trickId }, tick), world, tuning);
}

function bank(combo, tick, tuning) {
  return reduceCombo(combo, event('landed', { surfaceId: 'ground' }, tick), world, tuning);
}

describe('local trick combo reducer', () => {
  it('combo_spinGrabBanks500Versus250Isolated', () => {
    let linked = fresh();
    linked = complete(linked, 'spin', 1);
    linked = complete(linked, 'grab', 2);
    expect(linked.pendingBase).toBe(250);
    expect(linked.multiplier).toBe(2);
    linked = bank(linked, 3);

    let isolated = fresh();
    isolated = complete(isolated, 'spin', 1);
    isolated = bank(isolated, 2);
    isolated = complete(isolated, 'grab', 93);
    isolated = bank(isolated, 94);

    expect(linked.bankedScore).toBe(500);
    expect(linked.pendingBase).toBe(0);
    expect(isolated.bankedScore).toBe(250);
  });

  it('combo_repeatedTrickAwardsHalfOnceThenZeroWithoutMultiplierGrowth', () => {
    let combo = fresh();
    combo = complete(combo, 'spin', 1);
    combo = complete(combo, 'spin', 2);
    combo = complete(combo, 'spin', 3);

    expect(combo.pendingBase).toBe(150);
    expect(combo.multiplier).toBe(1);
  });

  it('combo_distinctActionMultiplierCapsAtFive', () => {
    let combo = fresh();
    combo = complete(combo, 'spin', 1);
    combo = complete(combo, 'grab', 2);

    for (let interval = 0; interval < 5; interval += 1) {
      const started = event('grindStarted', { pathId: 'rail-a' }, interval + 3);
      combo = reduceCombo(combo, started, world);
      combo = reduceCombo(combo, event('grindProgress', {
        intervalId: started.eventId,
        pathId: 'rail-a',
        speed: 3,
        signedDistanceAdvanced: 0.05,
        deltaSeconds: 1 / 60,
      }, interval + 3), world);
      combo = reduceCombo(combo, event('grindEnded', {
        pathId: 'rail-a', reason: 'endpoint', signedDistanceAdvanced: 0.05, speed: 3,
      }, interval + 3), world);
    }

    expect(combo.multiplier).toBe(5);
  });

  it('combo_actualMovingGrindAccrues50BasePerSecondAsOneAction', () => {
    let combo = fresh();
    const started = event('grindStarted', { pathId: 'rail-a' }, 1);
    combo = reduceCombo(combo, started, world);
    for (let tick = 0; tick < 60; tick += 1) {
      combo = reduceCombo(combo, event('grindProgress', {
        intervalId: started.eventId,
        pathId: 'rail-a',
        speed: 4,
        signedDistanceAdvanced: 4 / 60,
        deltaSeconds: 1 / 60,
      }, tick + 2), world);
    }

    expect(combo.pendingBase).toBeCloseTo(50, 10);
    expect(combo.multiplier).toBe(1);
  });

  it('combo_stationaryUnknownPathAndDuplicateGrindEventsAwardZero', () => {
    let stationary = fresh();
    const started = event('grindStarted', { pathId: 'rail-a' }, 1);
    stationary = reduceCombo(stationary, started, world);
    const stopped = event('grindProgress', {
      intervalId: started.eventId, pathId: 'rail-a', speed: 1.99,
      signedDistanceAdvanced: 0.01, deltaSeconds: 1 / 60,
    }, 2);
    stationary = reduceCombo(stationary, stopped, world);

    let unknown = fresh();
    const unknownStart = event('grindStarted', { pathId: 'not-authored' }, 1);
    unknown = reduceCombo(unknown, unknownStart, world);
    unknown = reduceCombo(unknown, event('grindProgress', {
      intervalId: unknownStart.eventId, pathId: 'not-authored', speed: 5,
      signedDistanceAdvanced: 5 / 60, deltaSeconds: 1 / 60,
    }, 2), world);

    let duplicate = fresh();
    const validStart = event('grindStarted', { pathId: 'rail-a' }, 1);
    duplicate = reduceCombo(duplicate, validStart, world);
    const progress = event('grindProgress', {
      intervalId: validStart.eventId, pathId: 'rail-a', speed: 4,
      signedDistanceAdvanced: 4 / 60, deltaSeconds: 1 / 60,
    }, 2);
    duplicate = reduceCombo(duplicate, progress, world);
    const afterFirst = duplicate;
    duplicate = reduceCombo(duplicate, progress, world);

    expect(stationary.pendingBase).toBe(0);
    expect(unknown.pendingBase).toBe(0);
    expect(duplicate).toBe(afterFirst);
  });

  it('combo_linkWindowIsInclusiveAt1500AndResetsAt1501WithoutBanking', () => {
    const millisecondTicks = { simulationHz: 1000 };
    let at1500 = fresh();
    at1500 = complete(at1500, 'spin', 1, millisecondTicks);
    at1500 = bank(at1500, 10, millisecondTicks);
    at1500 = complete(at1500, 'grab', 1510, millisecondTicks);

    let at1501 = fresh();
    at1501 = complete(at1501, 'spin', 1, millisecondTicks);
    at1501 = bank(at1501, 10, millisecondTicks);
    at1501 = complete(at1501, 'grab', 1511, millisecondTicks);

    expect(at1500.multiplier).toBe(2);
    expect(at1500.bankedScore).toBe(100);
    expect(at1501.multiplier).toBe(1);
    expect(at1501.bankedScore).toBe(100);
    expect(at1501.pendingBase).toBe(150);
  });

  it('combo_balanceFailureDropsPendingButKeepsBankedScore', () => {
    let combo = fresh();
    combo = complete(combo, 'spin', 1);
    combo = bank(combo, 2);
    combo = complete(combo, 'grab', 3);
    combo = reduceCombo(combo, event('grindEnded', { reason: 'balance-failure' }, 4), world);

    expect(combo.bankedScore).toBe(100);
    expect(combo.pendingBase).toBe(0);
    expect(combo.multiplier).toBe(1);
  });

  it('combo_linkExpiryNeverBanksAirbornePoints', () => {
    let combo = fresh();
    combo = complete(combo, 'spin', 1);
    combo = bank(combo, 2);
    combo = complete(combo, 'grab', 100);

    expect(combo.bankedScore).toBe(100);
    expect(combo.pendingBase).toBe(150);
    expect(combo.multiplier).toBe(1);
  });

  it('combo_linkExpiryPreservesPendingUntilCleanLandingThenBanksAtResetMultiplier', () => {
    const millisecondTicks = { simulationHz: 1000 };
    let combo = fresh();
    combo = complete(combo, 'spin', 1, millisecondTicks);
    combo = bank(combo, 2, millisecondTicks);
    combo = complete(combo, 'grab', 3, millisecondTicks);
    expect(combo.pendingBase).toBe(150);
    expect(combo.bankedScore).toBe(100);

    combo = bank(combo, 1503, millisecondTicks);

    expect(combo.pendingBase).toBe(0);
    expect(combo.bankedScore).toBe(250);
    expect(combo.multiplier).toBe(1);
  });
});
