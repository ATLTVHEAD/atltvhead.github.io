import { compileCityWorld } from '../world/city-surfaces.js';

function vector(THREE, value) {
  return new THREE.Vector3(value[0], value[1], value[2]);
}

function markFeature(object, feature, data = {}) {
  object.userData.cityFeature = feature;
  Object.assign(object.userData, data);
  return object;
}

function buildSurfaceMesh(THREE, surface, material, feature) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(surface.vertices.flat(), 3));
  geometry.setIndex(surface.indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `${surface.type}-${surface.id}`;
  mesh.receiveShadow = true;
  return markFeature(mesh, feature, {
    surfaceId: surface.id,
    routeEdgeId: surface.routeEdgeId,
    centerline: surface.centerline,
    width: surface.width,
  });
}

function buildStreetMesh(THREE, surface, material) {
  return buildSurfaceMesh(THREE, surface, material, 'street');
}

function buildRampMesh(THREE, surface, material) {
  return buildSurfaceMesh(THREE, surface, material, 'ramp');
}

function buildBuildingMesh(THREE, building) {
  const [width, height, depth] = building.size;
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshStandardMaterial({
    color: building.color,
    roughness: 0.84,
    flatShading: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  const normal = vector(THREE, building.normal).normalize();
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  mesh.position.copy(vector(THREE, building.position)).addScaledVector(normal, height / 2);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = building.id;

  return markFeature(mesh, 'building', {
    buildingId: building.id,
    basePosition: building.position,
    surfaceNormal: building.normal,
  });
}

function buildImportedBuilding(THREE, building, assets) {
  const placement = building.placement;
  const root = new THREE.Group();
  root.name = building.id;
  root.position.set(...placement.position);
  const rotation = new THREE.Matrix4().makeBasis(...placement.axes.map((axis) => vector(THREE, axis)));
  root.quaternion.setFromRotationMatrix(rotation);
  const model = assets.retain(placement.assetId);
  model.scale.setScalar(placement.scale);
  model.position.set(...placement.sourceOrigin.map((value) => -value * placement.scale));
  root.add(model);
  return markFeature(root, 'building', { buildingId: building.id, assetId: placement.assetId,
    borrowedAsset: model, basePosition: placement.position, surfaceNormal: building.normal });
}

function buildRailMesh(THREE, rail, material) {
  const group = new THREE.Group();
  group.name = rail.id;
  markFeature(group, 'rail', { railId: rail.id, points: rail.points });

  const unitCylinder = new THREE.CylinderGeometry(rail.radius, rail.radius, 1, 6, 1);
  for (let index = 0; index < rail.points.length - 1; index += 1) {
    const start = vector(THREE, rail.points[index]);
    const end = vector(THREE, rail.points[index + 1]);
    const direction = end.clone().sub(start);
    const length = direction.length();
    if (length < 1e-8) continue;

    const segment = new THREE.Mesh(unitCylinder, material);
    segment.position.copy(start).add(end).multiplyScalar(0.5);
    segment.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    segment.scale.y = length;
    segment.castShadow = true;
    group.add(segment);
  }

  return group;
}

export function disposeCityScene(city, assets = null, geometryCache = null) {
  const geometries = new Set(geometryCache?.values?.() ?? []);
  const materials = new Set();
  function collect(object) {
    if (object.userData?.borrowedAsset) {
      assets?.release(object.userData.borrowedAsset);
      return;
    }
    if (object.geometry) geometries.add(object.geometry);
    const owned = Array.isArray(object.material) ? object.material : [object.material];
    owned.filter(Boolean).forEach((material) => materials.add(material));
    object.children?.forEach(collect);
  }
  collect(city);
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

export function createCityScene(THREE, layout, world = compileCityWorld(layout), assets = null) {
  if (!THREE?.Group || !layout || !Number.isFinite(layout.planetRadius)) {
    throw new Error('Three.js and a valid city layout are required.');
  }

  const city = new THREE.Group();
  city.name = 'spherical-skate-city';
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(layout.planetRadius, 36, 28),
    new THREE.MeshStandardMaterial({
      color: '#20283a',
      roughness: 0.95,
      flatShading: true,
    }),
  );
  planet.name = 'city-planet';
  planet.receiveShadow = true;
  city.add(markFeature(planet, 'planet', { radius: layout.planetRadius }));

  city.add(new THREE.HemisphereLight('#c2d9ff', '#39233c', 1.25));
  const keyLight = new THREE.DirectionalLight('#fff1d1', 2.1);
  keyLight.position.set(18, 24, 12);
  city.add(keyLight);

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

  for (const surface of world.surfaces) {
    city.add(surface.type === 'ramp'
      ? buildRampMesh(THREE, surface, rampMaterial)
      : buildStreetMesh(THREE, surface, streetMaterial));
  }
  try {
    for (const building of layout.buildings ?? []) {
      city.add(assets && building.placement ? buildImportedBuilding(THREE, building, assets)
        : buildBuildingMesh(THREE, building));
    }
    for (const rail of layout.rails ?? []) city.add(buildRailMesh(THREE, rail, railMaterial));
  } catch (error) {
    disposeCityScene(city, assets);
    // The rail material may not have been attached to any geometry yet.
    railMaterial.dispose();
    throw error;
  }

  return city;
}
