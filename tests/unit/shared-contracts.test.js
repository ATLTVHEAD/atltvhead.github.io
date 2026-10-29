import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import * as installedThree from 'three';
import {
  AVATAR_ACCESSORIES,
  DEFAULT_APPEARANCE,
  filterAccessoryIds,
  isAccessoryId,
  normalizeAppearanceColor,
} from '../../js/game/shared/catalogs.js';
import { WORLD_DESCRIPTOR } from '../../js/game/shared/world-config.js';
import {
  inputFrameFromLegacy,
  normalizeInputFrame,
} from '../../js/game/input/actions.js';

describe('shared catalogs and contracts', () => {
  it('threeRevision_matchesVendoredRuntime', () => {
    const source = readFileSync(new URL('../../lib/three.min.js', import.meta.url), 'utf8');
    const browser = {};
    runInNewContext(source, browser);

    expect(installedThree.REVISION).toBe(browser.THREE.REVISION);
    expect(browser.THREE.REVISION).toBe('137');
  });

  it('sharedCatalogs_keepAppearanceValidationPureAndCompatible', () => {
    expect(DEFAULT_APPEARANCE).toEqual({ color: '#FF006E', accessoryIds: [] });
    expect(normalizeAppearanceColor('#36a6ff')).toBe('#36A6FF');
    expect(normalizeAppearanceColor('chartreuse')).toBe('#FF006E');
    expect(AVATAR_ACCESSORIES.map(({ id }) => id)).toEqual(['cap']);
    expect(isAccessoryId('cap')).toBe(true);
    expect(isAccessoryId('jetpack')).toBe(false);
    expect(filterAccessoryIds(['cap', 'cap', 'jetpack', null])).toEqual(['cap']);
  });

  it('worldDescriptor_pinsSharedWorldVersionsAndScale', () => {
    expect(WORLD_DESCRIPTOR).toEqual({
      version: 3,
      seed: 2026,
      radius: 32,
      tuningVersion: 2,
      planar: { width: 256, depth: 256 },
    });
    expect(Object.isFrozen(WORLD_DESCRIPTOR)).toBe(true);
    expect(Object.isFrozen(WORLD_DESCRIPTOR.planar)).toBe(true);
  });

  it('inputFrame_explicitlyConvertsLegacyKeyboardAndStickFields', () => {
    expect(inputFrameFromLegacy({
      steerX: 2,
      steerY: -0.4,
      accelerate: true,
      brake: false,
      jumpPressed: true,
      trickId: 'spin',
      grind: true,
      tagPressed: true,
      emoteId: 'cheer',
    })).toEqual({
      steer: 1,
      throttle: 1,
      brake: 0.4,
      grindHeld: true,
      jumpPressed: true,
      trickPressed: 'spin',
      tagPressed: true,
      emotePressed: 'cheer',
    });
  });

  it('inputFrame_clampsNonfiniteAndOutOfRangeAxes', () => {
    expect(normalizeInputFrame({
      steer: Number.NaN,
      throttle: Number.POSITIVE_INFINITY,
      brake: -1,
    })).toMatchObject({ steer: 0, throttle: 0, brake: 0 });
    expect(normalizeInputFrame({ steer: -2, throttle: 2, brake: 0.25 }))
      .toMatchObject({ steer: -1, throttle: 1, brake: 0.25 });
    expect(normalizeInputFrame({ steer: 0, extra: 'ignored' })).not.toHaveProperty('extra');
  });
});
