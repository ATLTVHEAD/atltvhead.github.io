import { createCityLayout } from './world/city-layout.js';
import { createCityScene } from './render/city-scene.js';

const CITY_RADIUS = 16;
const CITY_SEED = 2026;

function disposeCityResources(city) {
  const geometries = new Set();
  const materials = new Set();

  city.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (Array.isArray(object.material)) {
      object.material.forEach((material) => materials.add(material));
    } else if (object.material) {
      materials.add(object.material);
    }
  });

  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

export function startSkateGame({ root, THREE }) {
  if (!root) throw new Error('A game root element is required.');
  if (!THREE) throw new Error('The local Three.js library is required.');

  const canvas = root.querySelector('#game-canvas');
  if (!canvas) throw new Error('A game canvas is required.');

  const layout = createCityLayout({ radius: CITY_RADIUS, seed: CITY_SEED });
  const city = createCityScene(THREE, layout);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#11111c');
  scene.add(city);

  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, layout.planetRadius * 12);
  const cameraTarget = new THREE.Vector3(
    root.clientWidth / Math.max(root.clientHeight, 1) > 1.2
      ? -layout.planetRadius * 0.5
      : 0,
    0,
    0,
  );
  camera.position.set(
    cameraTarget.x,
    layout.planetRadius * 1.15,
    layout.planetRadius * 3.6,
  );
  camera.lookAt(cameraTarget);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = false;

  let disposed = false;
  let resizeObserver = null;
  const controls = THREE.OrbitControls
    ? new THREE.OrbitControls(camera, renderer.domElement)
    : null;
  if (controls) {
    controls.target.copy(cameraTarget);
    controls.enablePan = false;
    controls.minDistance = layout.planetRadius * 1.55;
    controls.maxDistance = layout.planetRadius * 4.5;
    controls.addEventListener('change', render);
    controls.update();
  }

  function render() {
    if (!disposed) renderer.render(scene, camera);
  }

  function resize() {
    if (disposed) return;
    const width = Math.max(1, root.clientWidth);
    const height = Math.max(1, root.clientHeight);
    const targetX = width / height > 1.2 ? -layout.planetRadius * 0.5 : 0;
    if (targetX !== cameraTarget.x) {
      camera.position.x += targetX - cameraTarget.x;
      cameraTarget.x = targetX;
      camera.lookAt(cameraTarget);
      if (controls) {
        controls.target.copy(cameraTarget);
        controls.update();
      }
    }
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render();
  }

  if (typeof ResizeObserver === 'function') {
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(root);
  } else {
    window.addEventListener('resize', resize);
  }
  resize();
  root.dataset.gameState = 'ready';

  return {
    city,
    layout,
    scene,
    camera,
    renderer,
    dispose() {
      if (disposed) return;
      disposed = true;
      resizeObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener('resize', resize);
      controls?.removeEventListener('change', render);
      controls?.dispose();
      scene.remove(city);
      disposeCityResources(city);
      renderer.dispose();
      root.dataset.gameState = 'disposed';
    },
  };
}

const root = document.querySelector('#game-root');
if (root) {
  try {
    window.skateGame = startSkateGame({ root, THREE: window.THREE });
  } catch (error) {
    root.dataset.gameState = 'error';
    console.error(error);
  }
}
