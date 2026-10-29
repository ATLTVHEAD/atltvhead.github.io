import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createFixedStepState, advanceFixedStep } from '../../js/game/core/fixed-step.js';
import { createLocalPlayState, stepLocalPlay } from '../../js/game/core/local-play.js';
import { createSeamGrindFixture } from '../fixtures/seam-grind.js';

const manifest = JSON.parse(readFileSync(new URL('../../assets/game/manifest.json', import.meta.url)));
const { world, spawnId } = createSeamGrindFixture({ assetManifest: manifest });
const STEP_MS = 1000 / 60;

function balanceCorrection(pathId) {
  const codeSum = [...pathId].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return codeSum % 2 === 0 ? 0.2 : -0.2;
}

describe('seam grind integration', () => {
  it('localPlay_realInputGrindCrossesTheXSeamWithoutLosingOrDuplicatingComboProgress', () => {
    const initial = createLocalPlayState(world, spawnId);
    let fixed = createFixedStepState(initial);
    const events = [];
    let crossing = null;
    let postCrossProgress = false;

    for (let frame = 0; frame < 600 && !postCrossProgress; frame += 1) {
      const previous = fixed.currentState;
      const steer = previous.mode === 'grinding'
        ? balanceCorrection('test-seam-grind-rail')
        : 0;
      const result = advanceFixedStep(fixed, STEP_MS, {
        steer,
        throttle: 1,
        brake: 0,
        grindHeld: false,
        jumpPressed: false,
        trickPressed: null,
        tagPressed: false,
        emotePressed: null,
      }, (state, input, deltaSeconds) => stepLocalPlay(state, input, deltaSeconds, world));
      fixed = result.loopState;
      for (const output of result.outputs) events.push(...output.events);

      const current = fixed.currentState;
      if (previous.mode === 'grinding' && previous.position[0] > 250
          && current.position[0] < 8 && current.mode === 'grinding') {
        crossing = {
          tick: current.tick,
          pendingBase: current.combo.pendingBase,
          actionCount: current.combo.distinctActionCount,
          scored: current.combo.activeGrindScored,
        };
      }
      if (crossing && current.mode === 'grinding'
          && current.combo.pendingBase > crossing.pendingBase) {
        postCrossProgress = true;
      }
      if (crossing && current.mode !== 'grinding') break;
    }

    const progress = events.filter((event) => event.type === 'grindProgress');
    const postCrossEvents = progress.filter((event) => event.tick > crossing?.tick);
    expect(crossing).toMatchObject({ actionCount: 1, scored: true });
    expect(crossing.pendingBase).toBeGreaterThan(0);
    expect(postCrossProgress).toBe(true);
    expect(postCrossEvents.length).toBeGreaterThan(0);
    expect(events.filter((event) => event.type === 'grindStarted')).toHaveLength(1);
    expect(new Set(events.map((event) => event.eventId)).size).toBe(events.length);
    expect(events.map((event) => event.eventIndex)).toEqual(
      events.map((_, index) => index + 1),
    );
    expect(fixed.currentState.combo.pendingBase).toBeGreaterThan(crossing.pendingBase);
  });
});
