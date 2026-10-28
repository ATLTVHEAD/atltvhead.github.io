import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  AVATAR_ACCESSORIES,
  countGeometryTriangles,
  createTvheadAvatar,
  isAccessoryId,
  setAvatarAppearance,
} from '../../js/game/render/avatar.js';
import {
  DEFAULT_APPEARANCE,
  filterAccessoryIds,
  normalizeColor,
  readCustomizationForm,
} from '../../js/game/ui/customization.js';

function createAvatar(appearance = { color: '#ff006e', accessoryIds: [] }, cache = new Map()) {
  return createTvheadAvatar(THREE, appearance, cache);
}

function geometryBounds(geometry) {
  geometry.computeBoundingBox();
  return geometry.boundingBox.getSize(new THREE.Vector3());
}

describe('createTvheadAvatar', () => {
  it('createTvheadAvatar_hasTvHeadBodyAndRollerblades', () => {
    const avatar = createAvatar();

    expect(avatar.getObjectByName('tv-head')?.isMesh).toBe(true);
    expect(avatar.getObjectByName('body')?.isMesh).toBe(true);
    expect(avatar.getObjectByName('left-rollerblade')).toBeDefined();
    expect(avatar.getObjectByName('right-rollerblade')).toBeDefined();
  });

  it('createTvheadAvatar_staysWithinTriangleBudget', () => {
    const baseAvatar = createAvatar();

    expect(countGeometryTriangles(baseAvatar)).toBeLessThanOrEqual(5_000);
  });

  it('createTvheadAvatar_reusesGeometry', () => {
    const cache = new Map();
    const first = createAvatar(undefined, cache);
    const second = createAvatar(undefined, cache);

    expect(first.getObjectByName('tv-head').geometry)
      .toBe(second.getObjectByName('tv-head').geometry);
    expect(first.getObjectByName('body').geometry)
      .toBe(second.getObjectByName('body').geometry);
    expect(first.getObjectByName('left-rollerblade-blade').geometry)
      .toBe(second.getObjectByName('left-rollerblade-blade').geometry);
  });

  it('countGeometryTriangles_countsIndexedAndNonIndexedGeometry', () => {
    const indexed = new THREE.BoxGeometry(1, 1, 1);
    const nonIndexed = new THREE.BufferGeometry();
    nonIndexed.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      0, 0, 0, 0, 1, 0, 0, 0, 1,
    ], 3));

    expect(countGeometryTriangles(indexed)).toBe(12);
    expect(countGeometryTriangles(nonIndexed)).toBe(2);
  });

  it('avatarPartGeometry_staysWithinLowPolyBounds', () => {
    const avatar = createAvatar();
    const headSize = geometryBounds(avatar.getObjectByName('tv-head').geometry);
    const bodySize = geometryBounds(avatar.getObjectByName('body').geometry);
    const bladeSize = geometryBounds(avatar.getObjectByName('left-rollerblade-blade').geometry);
    const leftBlade = avatar.getObjectByName('left-rollerblade');
    const rightBlade = avatar.getObjectByName('right-rollerblade');

    expect(headSize.x).toBeGreaterThan(0.7);
    expect(headSize.x).toBeLessThanOrEqual(1.4);
    expect(headSize.y).toBeGreaterThan(0.5);
    expect(headSize.y).toBeLessThanOrEqual(1.2);
    expect(bodySize.y).toBeGreaterThan(0.7);
    expect(bodySize.y).toBeLessThanOrEqual(1.5);
    expect(bladeSize.x).toBeLessThanOrEqual(0.65);
    expect(bladeSize.z).toBeLessThanOrEqual(1.2);
    expect(leftBlade.position.x).toBeLessThan(0);
    expect(rightBlade.position.x).toBeGreaterThan(0);
    expect(leftBlade.position.x).toBeCloseTo(-rightBlade.position.x);
  });
});

describe('setAvatarAppearance', () => {
  it('setAvatarAppearance_appliesColorAndAccessories', () => {
    const avatar = createAvatar();

    setAvatarAppearance(avatar, { color: '#36a6ff', accessoryIds: ['cap'] });

    expect(avatar.userData.appearance).toEqual({
      color: '#36A6FF',
      accessoryIds: ['cap'],
    });
    expect(avatar.getObjectByName('body').material.color.getHexString()).toBe('36a6ff');
    expect(avatar.getObjectByName('accessory-cap').visible).toBe(true);
    expect(countGeometryTriangles(avatar)).toBeLessThanOrEqual(7_500);
  });

  it('setAvatarAppearance_rejectsUnknownAccessory', () => {
    const avatar = createAvatar();

    expect(() => setAvatarAppearance(avatar, {
      color: '#ff0000',
      accessoryIds: ['jetpack'],
    })).toThrow(/unknown accessory/i);
  });

  it('setAvatarAppearance_removesAccessoryAndDisposesItsMaterialOnce', () => {
    const avatar = createAvatar({ color: '#ff006e', accessoryIds: ['cap'] });
    const cap = avatar.getObjectByName('accessory-cap');
    const material = cap.children[0].material;
    const disposeMaterial = material.dispose.bind(material);
    let disposeCalls = 0;
    material.dispose = () => {
      disposeCalls += 1;
      disposeMaterial();
    };

    setAvatarAppearance(avatar, { color: '#ff006e', accessoryIds: [] });

    expect(avatar.getObjectByName('accessory-cap')).toBeUndefined();
    expect(disposeCalls).toBe(1);
  });

  it('setAvatarAppearance_doesNotLeakMaterialsBetweenPlayers', () => {
    const cache = new Map();
    const first = createAvatar({ color: '#ff0000', accessoryIds: [] }, cache);
    const second = createAvatar({ color: '#0000ff', accessoryIds: [] }, cache);
    const firstBody = first.getObjectByName('body');
    const secondBody = second.getObjectByName('body');

    expect(firstBody.geometry).toBe(secondBody.geometry);
    expect(firstBody.material).not.toBe(secondBody.material);
    setAvatarAppearance(first, { color: '#00ff00', accessoryIds: [] });
    expect(firstBody.material.color.getHexString()).toBe('00ff00');
    expect(secondBody.material.color.getHexString()).toBe('0000ff');
  });
});

describe('isAccessoryId', () => {
  it('isAccessoryId_acceptsEveryCatalogIdAndRejectsUnknownIds', () => {
    for (const accessory of AVATAR_ACCESSORIES) {
      expect(isAccessoryId(accessory.id)).toBe(true);
    }
    expect(isAccessoryId('jetpack')).toBe(false);
  });
});

describe('readCustomizationForm', () => {
  it('readCustomizationForm_parsesValidValues', () => {
    const form = {
      querySelector: () => ({ value: '#36a6ff' }),
      querySelectorAll: () => [{ value: 'cap' }, { value: 'cap' }],
    };

    expect(readCustomizationForm(form)).toEqual({
      color: '#36A6FF',
      accessoryIds: ['cap'],
    });
  });

  it('readCustomizationForm_usesDefaults', () => {
    expect(readCustomizationForm(null)).toEqual(DEFAULT_APPEARANCE);
    expect(readCustomizationForm({
      querySelector: () => null,
      querySelectorAll: () => [],
    })).toEqual(DEFAULT_APPEARANCE);
  });

  it('readCustomizationForm_rejectsInvalidValues', () => {
    const form = {
      querySelector: () => ({ value: 'chartreuse' }),
      querySelectorAll: () => [{ value: 'jetpack' }],
    };

    expect(readCustomizationForm(form)).toEqual(DEFAULT_APPEARANCE);
  });
});

describe('normalizeColor', () => {
  it('normalizeColor_acceptsHexUppercasesAndFallsBack', () => {
    expect(normalizeColor('#12abEF')).toBe('#12ABEF');
    expect(normalizeColor('not-a-color')).toBe(DEFAULT_APPEARANCE.color);
  });
});

describe('filterAccessoryIds', () => {
  it('filterAccessoryIds_keepsAllowedUniqueIdsOnly', () => {
    expect(filterAccessoryIds(['cap', 'cap', 'jetpack', null])).toEqual(['cap']);
    expect(filterAccessoryIds('cap')).toEqual([]);
  });
});
