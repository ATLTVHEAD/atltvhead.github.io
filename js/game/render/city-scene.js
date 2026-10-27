import { makeSurfaceFrame } from '../core/planet-math.js';

function vector(THREE, value) {
  return new THREE.Vector3(value[0], value[1], value[2]);
}

function markFeature(object, feature, data = {}) {
  object.userData.cityFeature = feature;
  Object.assign(object.userData, data);
  return object;
}

function buildSurfaceMesh(THREE, surface, material, feature) {
  const positions = [];
  const indices = [];
  const centers = surface.centerline;

  for (let index = 0; index < centers.length; index += 1) {
    const center = vector(THREE, centers[index]);
    const normal = center.clone().normalize();
    const previous = vector(THREE, centers[Math.max(0, index - 1)]);
    const next = vector(THREE, centers[Math.min(centers.length - 1, index + 1)]);
    const heading = next.sub(previous).projectOnPlane(normal).normalize();
    const frame = makeSurfaceFrame(normal.toArray(), heading.toArray());
    const lateral = vector(THREE, frame.right).normalize();
    const edgeRadius = center.length() + 0.025;
    const left = center.clone().addScaledVector(lateral, -surface.width / 2).normalize().multiplyScalar(edgeRadius);
    const right = center.clone().addScaledVector(lateral, surface.width / 2).normalize().multiplyScalar(edgeRadius);

    positions.push(...left.toArray(), ...right.toArray());
    if (index < centers.length - 1) {
      const first = index * 2;
      indices.push(first, first + 1, first + 2, first + 1, first + 3, first + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
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

export function createCityScene(THREE, layout) {
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

  for (const surface of layout.surfaces ?? []) {
    city.add(surface.type === 'ramp'
      ? buildRampMesh(THREE, surface, rampMaterial)
      : buildStreetMesh(THREE, surface, streetMaterial));
  }
  for (const building of layout.buildings ?? []) city.add(buildBuildingMesh(THREE, building));
  for (const rail of layout.rails ?? []) city.add(buildRailMesh(THREE, rail, railMaterial));

  return city;
}
