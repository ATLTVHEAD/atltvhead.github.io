function vector(THREE, value) {
  return new THREE.Vector3(value[0], value[1], value[2]);
}

function markFeature(object, feature, data = {}) {
  object.userData.cityFeature = feature;
  Object.assign(object.userData, data);
  return object;
}

function ownGeometry(ownedGeometries, geometry) {
  ownedGeometries.add(geometry);
  return geometry;
}

function disposeOwnedGeometry(ownedGeometries, geometry) {
  if (!ownedGeometries.delete(geometry)) return;
  geometry.dispose();
}

function attributeSignature(geometry) {
  return Object.keys(geometry.attributes).sort().map((name) => (
    `${name}:${geometry.attributes[name].itemSize}`
  )).join('|');
}

function normalizeAttribute(THREE, attribute) {
  const values = new Float32Array(attribute.count * attribute.itemSize);
  const getters = ['getX', 'getY', 'getZ', 'getW'];
  const source = attribute.array;
  const normalizedScale = attribute.normalized
    ? (source instanceof Int8Array ? 127
      : source instanceof Uint8Array ? 255
        : source instanceof Int16Array ? 32767
          : source instanceof Uint16Array ? 65535
            : source instanceof Int32Array ? 2147483647
              : source instanceof Uint32Array ? 4294967295 : 1)
    : 1;
  for (let vertex = 0; vertex < attribute.count; vertex += 1) {
    for (let component = 0; component < attribute.itemSize; component += 1) {
      const raw = attribute[getters[component]](vertex);
      const normalized = attribute.normalized
        ? source instanceof Int8Array || source instanceof Int16Array || source instanceof Int32Array
          ? Math.max(-1, raw / normalizedScale)
          : raw / normalizedScale
        : raw;
      values[vertex * attribute.itemSize + component] = normalized;
    }
  }
  return new THREE.Float32BufferAttribute(values, attribute.itemSize);
}

function normalizedGeometry(THREE, geometry, ownedGeometries) {
  const attributes = Object.fromEntries(Object.entries(geometry.attributes)
    .map(([name, attribute]) => [name, normalizeAttribute(THREE, attribute)]));
  const output = ownGeometry(ownedGeometries, new THREE.BufferGeometry());
  for (const [name, attribute] of Object.entries(attributes)) output.setAttribute(name, attribute);
  if (geometry.index) {
    output.setIndex(Array.from(geometry.index.array));
  } else {
    output.setIndex(Array.from({ length: geometry.attributes.position.count }, (_, index) => index));
  }
  return output;
}

function geometryForGroup(THREE, source, group, ownedGeometries) {
  const geometry = ownGeometry(ownedGeometries, source.clone());
  if (group) {
    const start = group.start;
    const end = start + group.count;
    if (geometry.index) {
      geometry.setIndex(Array.from(geometry.index.array.slice(start, end)));
    } else {
      geometry.setIndex(Array.from({ length: group.count }, (_, index) => start + index));
    }
    geometry.clearGroups();
  }
  if (geometry.morphAttributes && Object.values(geometry.morphAttributes).some((targets) => targets.length)) {
    throw new TypeError('Animated asset geometry cannot be merged into a static planar city.');
  }
  return geometry;
}

function addGeometryBatch(THREE, batches, material, geometry, matrix, assetId, ownedGeometries) {
  if (!material) {
    disposeOwnedGeometry(ownedGeometries, geometry);
    return;
  }
  geometry.applyMatrix4(matrix);
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  const signature = attributeSignature(geometry);
  let variants = batches.get(material);
  if (!variants) {
    variants = new Map();
    batches.set(material, variants);
  }
  let batch = variants.get(signature);
  if (!batch) {
    batch = { geometries: [], assetIds: new Set() };
    variants.set(signature, batch);
  }
  batch.geometries.push(normalizedGeometry(THREE, geometry, ownedGeometries));
  disposeOwnedGeometry(ownedGeometries, geometry);
  batch.assetIds.add(assetId);
}

function collectAssetBatches(THREE, retained, batches, assetId, ownedGeometries) {
  const transformRoot = new THREE.Group();
  const placement = retained.userData.planarPlacement;
  transformRoot.position.set(...placement.position);
  transformRoot.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    ...placement.axes.map((axis) => vector(THREE, axis)),
  ));
  retained.scale.setScalar(placement.scale);
  retained.position.set(...placement.sourceOrigin.map((value) => -value * placement.scale));
  transformRoot.add(retained);
  transformRoot.updateMatrixWorld(true);

  retained.traverse((object) => {
    if (!object.isMesh || !object.geometry) return;
    const groups = Array.isArray(object.material) ? object.geometry.groups : [];
    const parts = Array.isArray(object.material)
      ? groups.map((group) => ({ group, material: object.material[group.materialIndex] }))
      : [{ group: null, material: object.material }];
    for (const part of parts) {
      const geometry = geometryForGroup(THREE, object.geometry, part.group, ownedGeometries);
      addGeometryBatch(
        THREE, batches, part.material, geometry, object.matrixWorld, assetId, ownedGeometries,
      );
    }
  });
}

function mergeBatches(THREE, batches, ownedGeometries) {
  const merge = THREE.BufferGeometryUtils?.mergeBufferGeometries;
  if (typeof merge !== 'function') {
    throw new Error('THREE.BufferGeometryUtils.mergeBufferGeometries is required for planar city rendering.');
  }
  const result = [];
  for (const [material, variants] of batches) {
    for (const batch of variants.values()) {
      if (batch.geometries.length === 0) continue;
      const geometry = batch.geometries.length === 1
        ? batch.geometries[0]
        : merge(batch.geometries, false);
      if (!geometry) throw new Error('Compatible planar city meshes could not be merged.');
      ownGeometry(ownedGeometries, geometry);
      for (const source of batch.geometries) {
        if (source !== geometry) disposeOwnedGeometry(ownedGeometries, source);
      }
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      ownedGeometries.add(geometry);
      result.push({
        geometry,
        material,
        assetIds: [...batch.assetIds].sort(),
      });
    }
  }
  return result;
}

function surfaceGeometry(THREE, surface, ownedGeometries) {
  const geometry = ownGeometry(ownedGeometries, new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(surface.vertices.flat(), 3));
  geometry.setIndex(surface.indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function makeSurfaceBatches(THREE, world, streetMaterial, rampMaterial, ownedGeometries) {
  const street = [];
  const ramp = [];
  const surfaceIds = { street: [], ramp: [] };
  for (const surface of world.surfaces) {
    if (surface.type === 'rail-deck') continue;
    if (surface.type === 'ramp') {
      ramp.push(surfaceGeometry(THREE, surface, ownedGeometries));
      surfaceIds.ramp.push(surface.id);
    } else {
      street.push(surfaceGeometry(THREE, surface, ownedGeometries));
      surfaceIds.street.push(surface.id);
    }
  }
  return [
    ...mergeBatches(THREE, new Map([
      [streetMaterial, new Map([['surface', { geometries: street, assetIds: new Set(surfaceIds.street) }]])],
    ]), ownedGeometries).map((batch) => ({ ...batch, feature: 'surface', ids: surfaceIds.street })),
    ...mergeBatches(THREE, new Map([
      [rampMaterial, new Map([['surface', { geometries: ramp, assetIds: new Set(surfaceIds.ramp) }]])],
    ]), ownedGeometries).map((batch) => ({ ...batch, feature: 'ramp', ids: surfaceIds.ramp })),
  ];
}

function railGeometries(THREE, world, material, ownedGeometries) {
  const geometries = [];
  for (const rail of world.rails) {
    for (let index = 0; index < rail.points.length - 1; index += 1) {
      const start = vector(THREE, rail.points[index]);
      const end = vector(THREE, rail.points[index + 1]);
      const direction = end.clone().sub(start);
      const length = direction.length();
      if (length < 1e-8) continue;
      const geometry = ownGeometry(
        ownedGeometries,
        new THREE.CylinderGeometry(rail.radius, rail.radius, length, 8, 1),
      );
      const transform = new THREE.Matrix4().compose(
        start.clone().add(end).multiplyScalar(0.5),
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()),
        new THREE.Vector3(1, 1, 1),
      );
      geometry.applyMatrix4(transform);
      geometry.computeVertexNormals();
      geometries.push(geometry);
    }
  }
  if (!geometries.length) return [];
  const batch = new Map([[material, new Map([['rail', {
    geometries: geometries.map((geometry) => normalizedGeometry(THREE, geometry, ownedGeometries)),
    assetIds: new Set(world.rails.map((rail) => rail.id)),
  }]])]]);
  geometries.forEach((geometry) => disposeOwnedGeometry(ownedGeometries, geometry));
  return mergeBatches(THREE, batch, ownedGeometries).map((record) => ({
    ...record,
    feature: 'rail',
    ids: world.rails.map((rail) => rail.id),
  }));
}

function placementRecords(layout) {
  return [
    ...(layout.buildings ?? []).map((record) => ({ record, placement: record.placement })),
    ...(layout.props ?? []).map((record) => ({ record, placement: record.placement })),
  ];
}

function sourceSignature(object) {
  object.updateWorldMatrix(true, true);
  const entries = [];
  function visit(node, isRoot = false) {
    if (node.matrixAutoUpdate) node.updateMatrix();
    const matrix = isRoot ? node.matrixWorld : node.matrix;
    const material = Array.isArray(node.material)
      ? node.material.map((entry) => entry?.uuid ?? null)
      : node.material?.uuid ?? null;
    entries.push([
      node.uuid,
      node.type,
      node.name,
      node.visible,
      node.renderOrder,
      ...matrix.elements,
      node.geometry?.uuid ?? null,
      node.geometry?.version ?? null,
      material,
      node.children.map((child) => child.uuid),
    ]);
    node.children.forEach((child) => visit(child));
  }
  visit(object, true);
  return JSON.stringify(entries);
}

function cloneAtWorldTransform(THREE, source) {
  const clone = source.clone(true);
  source.matrixWorld.decompose(clone.position, clone.quaternion, clone.scale);
  clone.matrixAutoUpdate = true;
  clone.updateMatrix();
  clone.userData = { ...clone.userData, replicatedSourceId: source.uuid };
  return clone;
}

function makeAttachmentApi(THREE, city, tiles, attachments) {
  // This overrides Object3D.attach: it replicates a canonical world pose into every tile.
  city.attach = (object) => {
    if (city.userData.disposed) throw new Error('A disposed planar city cannot accept attachments.');
    if (!object?.isObject3D) throw new TypeError('A replicated attachment must be a Three.js Object3D.');
    const signature = sourceSignature(object);
    const previous = attachments.get(object);
    if (previous?.signature === signature) return object;

    const clones = tiles.map((tile) => cloneAtWorldTransform(THREE, object));
    if (previous) {
      previous.clones.forEach((clone, index) => tiles[index].remove(clone));
    }
    clones.forEach((clone, index) => tiles[index].add(clone));
    attachments.set(object, { signature, clones });
    return object;
  };
  city.detach = (object) => {
    const previous = attachments.get(object);
    if (!previous) return;
    previous.clones.forEach((clone, index) => tiles[index].remove(clone));
    attachments.delete(object);
  };
}

export function createPlanarCityScene(THREE, layout, world, assets) {
  if (!THREE?.Group || !THREE?.Mesh || !layout || !world
      || !Number.isFinite(layout.width) || !Number.isFinite(layout.depth)
      || layout.width !== world.width || layout.depth !== world.depth) {
    throw new TypeError('Three.js, a planar layout and its compiled world are required.');
  }
  if (typeof THREE.BufferGeometryUtils?.mergeBufferGeometries !== 'function') {
    throw new Error('THREE.BufferGeometryUtils.mergeBufferGeometries is required for planar city rendering.');
  }
  const placements = placementRecords(layout);
  if (placements.length && (!assets || typeof assets.retain !== 'function' || typeof assets.release !== 'function')) {
    throw new TypeError('A retained asset library is required to render the planar city.');
  }

  const city = new THREE.Group();
  city.name = 'planar-skate-city';
  const ownedGeometries = new Set();
  const ownedMaterials = new Set();
  const retainedAssets = [];
  const attachments = new Map();
  const tileRecords = [-1, 0, 1].flatMap((ix) => [-1, 0, 1].map((iz) => [ix, iz]));

  try {
    const streetMaterial = new THREE.MeshStandardMaterial({
      color: '#343d52',
      roughness: 0.9,
      side: THREE.DoubleSide,
    });
    const rampMaterial = new THREE.MeshStandardMaterial({
      color: '#ef4b91',
      roughness: 0.78,
      side: THREE.DoubleSide,
    });
    const railMaterial = new THREE.MeshStandardMaterial({
      color: '#53edff',
      metalness: 0.55,
      roughness: 0.32,
    });
    ownedMaterials.add(streetMaterial);
    ownedMaterials.add(rampMaterial);
    ownedMaterials.add(railMaterial);

    const batches = new Map();
    for (const [index, { record, placement }] of placements.entries()) {
      if (!placement?.assetId || !Array.isArray(placement.axes) || placement.axes.length !== 3) {
        throw new TypeError(`Planar asset ${record.id ?? index} has no complete placement transform.`);
      }
      for (const offset of tileRecords) {
        const model = assets.retain(placement.assetId);
        retainedAssets.push(model);
        model.userData.planarPlacement = placement;
        if (offset[0] === 0 && offset[1] === 0) {
          collectAssetBatches(THREE, model, batches, placement.assetId, ownedGeometries);
        }
      }
    }
    const assetMeshes = mergeBatches(THREE, batches, ownedGeometries);
    const surfaceMeshes = makeSurfaceBatches(
      THREE, world, streetMaterial, rampMaterial, ownedGeometries,
    );
    const railMeshes = railGeometries(THREE, world, railMaterial, ownedGeometries);

    const canonicalMeshes = [
      ...assetMeshes.map((batch) => ({
        ...batch,
        feature: 'imported-assets',
        ids: batch.assetIds,
        name: `imported-assets-${batch.assetIds.join('-')}`,
        castShadow: true,
        receiveShadow: true,
      })),
      ...surfaceMeshes.map((batch) => ({
        ...batch,
        name: `${batch.feature}-${batch.ids.join('-')}`,
        castShadow: batch.feature === 'ramp',
        receiveShadow: true,
      })),
      ...railMeshes.map((batch) => ({
        ...batch,
        name: `rail-${batch.ids.join('-')}`,
        castShadow: true,
        receiveShadow: true,
      })),
    ];

    const tiles = tileRecords.map(([ix, iz]) => {
      const tile = new THREE.Group();
      tile.name = `planar-city-tile-${ix}-${iz}`;
      tile.position.set(ix * layout.width, 0, iz * layout.depth);
      tile.userData.tileOffset = [ix, iz];
      for (const batch of canonicalMeshes) {
        const mesh = new THREE.Mesh(batch.geometry, batch.material);
        mesh.name = batch.name;
        mesh.castShadow = batch.castShadow;
        mesh.receiveShadow = batch.receiveShadow;
        markFeature(mesh, batch.feature, {
          assetIds: batch.assetIds ?? [],
          surfaceIds: batch.feature === 'surface' || batch.feature === 'ramp' ? batch.ids : [],
          railIds: batch.feature === 'rail' ? batch.ids : [],
        });
        tile.add(mesh);
      }
      city.add(tile);
      return tile;
    });

    city.userData.tileGroups = tiles;
    city.userData.layoutSize = [layout.width, layout.depth];
    makeAttachmentApi(THREE, city, tiles, attachments);
    city.dispose = () => {
      if (city.userData.disposed) return;
      city.userData.disposed = true;
      [...attachments.keys()].forEach((object) => city.detach(object));
      ownedGeometries.forEach((geometry) => geometry.dispose());
      ownedGeometries.clear();
      ownedMaterials.forEach((material) => material.dispose());
      for (let index = retainedAssets.length - 1; index >= 0; index -= 1) {
        assets.release(retainedAssets[index]);
      }
      retainedAssets.length = 0;
      city.clear();
    };
    return city;
  } catch (error) {
    ownedGeometries.forEach((geometry) => geometry.dispose());
    ownedGeometries.clear();
    ownedMaterials.forEach((material) => material.dispose());
    for (let index = retainedAssets.length - 1; index >= 0; index -= 1) {
      assets.release(retainedAssets[index]);
    }
    city.clear();
    throw error;
  }
}
