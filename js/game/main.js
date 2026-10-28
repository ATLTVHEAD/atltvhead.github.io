import { createCityLayout } from './world/city-layout.js';
import { compileCityWorld } from './world/city-surfaces.js';
import { createCityScene } from './render/city-scene.js';
import { createTvheadAvatar, setAvatarAppearance } from './render/avatar.js';
import { bindCustomizationForm, readCustomizationForm } from './ui/customization.js';
import { makeSurfaceFrame, normalize3 } from './core/planet-math.js';
import { createCitySkater } from './core/city-skater.js';
import { WORLD_DESCRIPTOR } from './shared/world-config.js';

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

  const layout = createCityLayout({
    radius: WORLD_DESCRIPTOR.radius,
    seed: WORLD_DESCRIPTOR.seed,
  });
  const world = compileCityWorld(layout);
  const skaterState = createCitySkater(world);
  const city = createCityScene(THREE, layout, world);
  const geometryCache = new Map();
  const customizationForm = root.querySelector('#customization-form');
  const avatar = createTvheadAvatar(
    THREE,
    readCustomizationForm(customizationForm),
    geometryCache,
  );
  {
    const frame = makeSurfaceFrame(normalize3(skaterState.position), skaterState.forward);
    const up = new THREE.Vector3(...frame.up);
    const right = new THREE.Vector3(...frame.right).negate();
    const forward = new THREE.Vector3(...frame.forward);
    const orientation = new THREE.Matrix4().makeBasis(right, up, forward);
    avatar.quaternion.setFromRotationMatrix(orientation);
    avatar.position.copy(new THREE.Vector3(...skaterState.position));
  }
  city.add(avatar);

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

  const customizationBinding = customizationForm
    ? bindCustomizationForm(customizationForm, (appearance) => {
      setAvatarAppearance(avatar, appearance);
      render();
    })
    : null;

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
    avatar,
    geometryCache,
    layout,
    world,
    skaterState,
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
      customizationBinding?.dispose();
      scene.remove(city);
      disposeCityResources(city);
      geometryCache.clear();
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
