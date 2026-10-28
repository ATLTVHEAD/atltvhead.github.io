import {
  AVATAR_ACCESSORIES,
  isAccessoryId as isSharedAccessoryId,
  normalizeAppearanceColor,
} from '../shared/catalogs.js';

export { AVATAR_ACCESSORIES };

function getCachedGeometry(THREE, geometryCache, key, createGeometry) {
  if (geometryCache.has(key)) return geometryCache.get(key);
  const geometry = createGeometry(THREE);
  geometryCache.set(key, geometry);
  return geometry;
}

function cloneMaterial(material, clones) {
  if (!clones.has(material)) clones.set(material, material.clone());
  return clones.get(material);
}

function cloneMaterialsForAvatar(avatar) {
  const clones = new Map();
  avatar.traverse((object) => {
    if (!object.isMesh || !object.material) return;
    object.material = Array.isArray(object.material)
      ? object.material.map((material) => cloneMaterial(material, clones))
      : cloneMaterial(object.material, clones);
  });
}

function disposeMaterials(object) {
  const materials = new Set();
  object.traverse((child) => {
    if (!child.material) return;
    if (Array.isArray(child.material)) child.material.forEach((material) => materials.add(material));
    else materials.add(child.material);
  });
  materials.forEach((material) => material.dispose());
}

function mesh(THREE, geometry, material, name, avatarPart) {
  const object = new THREE.Mesh(geometry, material);
  object.name = name;
  object.userData.avatarPart = avatarPart;
  object.castShadow = true;
  object.receiveShadow = true;
  return object;
}

function buildTvHeadGeometry(THREE, geometryCache) {
  return getCachedGeometry(THREE, geometryCache, 'tvhead-shell', () => (
    new THREE.BoxGeometry(1.1, 0.9, 0.78)
  ));
}

function buildBodyGeometry(THREE, geometryCache) {
  return getCachedGeometry(THREE, geometryCache, 'body-torso', () => (
    new THREE.BoxGeometry(0.86, 1.12, 0.54)
  ));
}

function buildRollerbladeGeometry(THREE, geometryCache) {
  return getCachedGeometry(THREE, geometryCache, 'rollerblade-shell', () => (
    new THREE.BoxGeometry(0.34, 0.15, 0.88)
  ));
}

function buildAvatarModel(THREE, appearance, geometryCache) {
  const avatar = new THREE.Group();
  avatar.name = 'tvhead-avatar';

  const suitMaterial = new THREE.MeshStandardMaterial({
    color: normalizeAppearanceColor(appearance?.color),
    roughness: 0.74,
    flatShading: true,
  });
  const shellMaterial = new THREE.MeshStandardMaterial({
    color: '#F3F0FA',
    roughness: 0.65,
    flatShading: true,
  });
  const screenMaterial = new THREE.MeshStandardMaterial({
    color: '#111827',
    emissive: '#121d32',
    emissiveIntensity: 0.8,
    roughness: 0.35,
  });
  const detailMaterial = new THREE.MeshStandardMaterial({
    color: '#53EDFF',
    emissive: '#143f4a',
    emissiveIntensity: 0.45,
    roughness: 0.4,
  });
  const bladeMaterial = new THREE.MeshStandardMaterial({
    color: '#252b3b',
    roughness: 0.7,
    flatShading: true,
  });
  const wheelMaterial = new THREE.MeshStandardMaterial({
    color: '#B8C8E7',
    roughness: 0.48,
    flatShading: true,
  });

  const head = mesh(
    THREE,
    buildTvHeadGeometry(THREE, geometryCache),
    shellMaterial,
    'tv-head',
    'head-shell',
  );
  head.position.y = 2.46;
  avatar.add(head);

  const screen = mesh(
    THREE,
    getCachedGeometry(THREE, geometryCache, 'tvhead-screen', () => (
      new THREE.PlaneGeometry(0.78, 0.58)
    )),
    screenMaterial,
    'tv-screen',
    'head-screen',
  );
  screen.position.set(0, 2.46, 0.395);
  avatar.add(screen);

  const eyeGeometry = getCachedGeometry(THREE, geometryCache, 'tvhead-eye', () => (
    new THREE.BoxGeometry(0.1, 0.12, 0.025)
  ));
  for (const side of [-1, 1]) {
    const eye = mesh(THREE, eyeGeometry, detailMaterial, `screen-eye-${side}`, 'screen-detail');
    eye.position.set(side * 0.2, 2.5, 0.414);
    avatar.add(eye);
  }
  const mouth = mesh(
    THREE,
    getCachedGeometry(THREE, geometryCache, 'tvhead-mouth', () => (
      new THREE.BoxGeometry(0.22, 0.045, 0.025)
    )),
    detailMaterial,
    'screen-mouth',
    'screen-detail',
  );
  mouth.position.set(0, 2.32, 0.414);
  avatar.add(mouth);

  const torso = mesh(
    THREE,
    buildBodyGeometry(THREE, geometryCache),
    suitMaterial,
    'body',
    'torso',
  );
  torso.position.y = 1.27;
  avatar.add(torso);

  const armGeometry = getCachedGeometry(THREE, geometryCache, 'body-arm', () => (
    new THREE.CylinderGeometry(0.105, 0.15, 0.82, 6, 1)
  ));
  for (const side of [-1, 1]) {
    const arm = mesh(THREE, armGeometry, suitMaterial, `arm-${side}`, 'arm');
    arm.position.set(side * 0.56, 1.34, 0);
    arm.rotation.z = side * -0.12;
    avatar.add(arm);

    const leg = mesh(
      THREE,
      getCachedGeometry(THREE, geometryCache, 'body-leg', () => (
        new THREE.BoxGeometry(0.28, 0.72, 0.34)
      )),
      bladeMaterial,
      `leg-${side}`,
      'leg',
    );
    leg.position.set(side * 0.24, 0.57, 0);
    avatar.add(leg);

    const boot = new THREE.Group();
    boot.name = side < 0 ? 'left-rollerblade' : 'right-rollerblade';
    boot.position.set(side * 0.25, 0.18, 0.08);
    boot.userData.avatarPart = 'rollerblade';

    const bootShell = mesh(
      THREE,
      buildRollerbladeGeometry(THREE, geometryCache),
      shellMaterial,
      'boot-shell',
      'rollerblade-shell',
    );
    boot.add(bootShell);

    const blade = mesh(
      THREE,
      getCachedGeometry(THREE, geometryCache, 'rollerblade-blade', () => (
        new THREE.BoxGeometry(0.24, 0.07, 0.82)
      )),
      detailMaterial,
      `${boot.name}-blade`,
      'rollerblade-blade',
    );
    blade.position.y = -0.12;
    boot.add(blade);

    const wheelGeometry = getCachedGeometry(THREE, geometryCache, 'rollerblade-wheel', () => (
      new THREE.CylinderGeometry(0.075, 0.075, 0.075, 6, 1)
    ));
    for (const wheelSide of [-1, 1]) {
      for (const z of [-0.28, 0, 0.28]) {
        const wheel = mesh(THREE, wheelGeometry, wheelMaterial, 'rollerblade-wheel', 'wheel');
        wheel.position.set(wheelSide * 0.15, -0.2, z);
        wheel.rotation.z = Math.PI / 2;
        boot.add(wheel);
      }
    }
    avatar.add(boot);
  }

  avatar.userData.appearance = {
    color: normalizeAppearanceColor(appearance?.color),
    accessoryIds: [],
  };
  avatar.userData.geometryCache = geometryCache;
  avatar.userData.THREE = THREE;
  return avatar;
}

function createCapAccessory(avatar) {
  const THREE = avatar.userData.THREE;
  const geometryCache = avatar.userData.geometryCache;
  const accessory = new THREE.Group();
  accessory.name = 'accessory-cap';
  accessory.userData.accessoryId = 'cap';

  const material = new THREE.MeshStandardMaterial({
    color: avatar.userData.appearance.color,
    roughness: 0.62,
    flatShading: true,
  });
  const crown = mesh(
    THREE,
    getCachedGeometry(THREE, geometryCache, 'accessory-cap-crown', () => (
      new THREE.CylinderGeometry(0.38, 0.48, 0.24, 8, 1)
    )),
    material,
    'cap-crown',
    'accessory',
  );
  crown.position.y = 2.95;
  accessory.add(crown);

  const brim = mesh(
    THREE,
    getCachedGeometry(THREE, geometryCache, 'accessory-cap-brim', () => (
      new THREE.BoxGeometry(0.82, 0.07, 0.5)
    )),
    material,
    'cap-brim',
    'accessory',
  );
  brim.position.set(0, 2.83, 0.34);
  accessory.add(brim);
  return accessory;
}

export function countGeometryTriangles(geometryOrObject) {
  if (!geometryOrObject) return 0;

  if (geometryOrObject.attributes?.position) {
    const index = geometryOrObject.index;
    return Math.floor((index ? index.count : geometryOrObject.attributes.position.count) / 3);
  }

  let triangleCount = 0;
  geometryOrObject.traverse?.((object) => {
    if (object.geometry?.attributes?.position) {
      const index = object.geometry.index;
      triangleCount += Math.floor((index ? index.count : object.geometry.attributes.position.count) / 3);
    }
  });
  return triangleCount;
}

export function createTvheadAvatar(THREE, appearance = {}, geometryCache = new Map()) {
  if (!THREE?.Group || !THREE?.Mesh || !THREE?.BoxGeometry) {
    throw new Error('Three.js is required to create a TVHead avatar.');
  }
  if (!(geometryCache instanceof Map)) {
    throw new TypeError('The avatar geometry cache must be a Map.');
  }

  const avatar = buildAvatarModel(THREE, appearance, geometryCache);
  cloneMaterialsForAvatar(avatar);
  setAvatarAppearance(avatar, appearance);
  return avatar;
}

export function isAccessoryId(id) {
  return isSharedAccessoryId(id);
}

export function setAvatarAppearance(avatar, appearance = {}) {
  if (!avatar?.isGroup) throw new TypeError('A TVHead avatar group is required.');
  const accessoryIds = appearance.accessoryIds ?? [];
  if (!Array.isArray(accessoryIds)) {
    throw new TypeError('Accessory IDs must be provided as an array.');
  }

  const unknownIds = accessoryIds.filter((id) => !isAccessoryId(id));
  if (unknownIds.length > 0) {
    throw new Error(`Unknown accessory: ${unknownIds.join(', ')}`);
  }

  const color = normalizeAppearanceColor(appearance.color);
  const uniqueAccessoryIds = [...new Set(accessoryIds)];
  const selectedAccessories = new Set(uniqueAccessoryIds);
  const cap = avatar.getObjectByName('accessory-cap');

  if (selectedAccessories.has('cap') && !cap) {
    avatar.add(createCapAccessory(avatar));
  } else if (!selectedAccessories.has('cap') && cap) {
    avatar.remove(cap);
    disposeMaterials(cap);
  }

  avatar.traverse((object) => {
    if (!object.isMesh || !['torso', 'arm', 'accessory'].includes(object.userData.avatarPart)) return;
    object.material.color.set(color);
  });

  avatar.userData.appearance = {
    color,
    accessoryIds: uniqueAccessoryIds,
  };
}
