import { createCityLayout } from './world/city-layout.js';
import { compileCityWorld } from './world/city-surfaces.js';
import { createCityScene } from './render/city-scene.js';
import { createTvheadAvatar, setAvatarAppearance } from './render/avatar.js';
import { bindCustomizationForm, readCustomizationForm } from './ui/customization.js';
import { createCitySkater, stepSkaterOnCity } from './core/city-skater.js';
import { WORLD_DESCRIPTOR } from './shared/world-config.js';
import { createKeyboardMouseInput } from './input/keyboard-mouse.js';
import { createGamepadInput } from './input/gamepad.js';
import { createTouchInput } from './input/touch.js';
import { createInputRouter } from './input/input-router.js';
import { createGameSession } from './runtime/game-session.js';
import { bindInputLifecycle } from './runtime/input-lifecycle.js';
import { applyAvatarPose } from './render/avatar-pose.js';
import {
  createFollowCameraState,
  updateFollowCamera,
} from './render/follow-camera.js';

function disposeCityResources(city, geometryCache = null) {
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
  for (const geometry of geometryCache?.values?.() ?? []) geometries.add(geometry);

  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

function viewportFor(root) {
  return { width: root.clientWidth, height: root.clientHeight };
}

function showBootError(root, message) {
  const errorBox = root.querySelector('#game-error');
  const errorMessage = root.querySelector('#game-error-message');
  if (errorMessage) errorMessage.textContent = message;
  if (errorBox) errorBox.hidden = false;
  root.dataset.gameState = 'error';
}

function clearBootError(root) {
  const errorBox = root.querySelector('#game-error');
  if (errorBox) errorBox.hidden = true;
}

export function startSkateGame({ root, THREE }) {
  if (!root) throw new Error('A game root element is required.');
  if (!THREE) throw new Error('The local Three.js library is required.');

  const canvas = root.querySelector('#game-canvas');
  if (!canvas) throw new Error('A game canvas is required.');

  const cleanups = [];
  let cleanupComplete = false;
  let disposed = false;
  let city = null;
  let scene = null;
  let renderer = null;
  let controls = null;
  let input = null;
  let session = null;
  let customizationBinding = null;
  let resizeObserver = null;

  function registerCleanup(cleanup) {
    cleanups.push(cleanup);
  }

  function cleanupResources() {
    if (cleanupComplete) return;
    cleanupComplete = true;
    for (let index = cleanups.length - 1; index >= 0; index -= 1) {
      try {
        cleanups[index]();
      } catch {
        // Continue releasing independent resources if one teardown fails.
      }
    }
  }

  try {
    root.dataset.gameState = 'loading';
    const layout = createCityLayout({
      radius: WORLD_DESCRIPTOR.radius,
      seed: WORLD_DESCRIPTOR.seed,
    });
    const world = compileCityWorld(layout);
    const initialSkaterState = createCitySkater(world);
    const geometryCache = new Map();
    city = createCityScene(THREE, layout, world);
    registerCleanup(() => {
      if (scene) scene.remove(city);
      if (city) disposeCityResources(city, geometryCache);
      geometryCache.clear();
    });
    const customizationForm = root.querySelector('#customization-form');
    const avatar = createTvheadAvatar(
      THREE,
      readCustomizationForm(customizationForm),
      geometryCache,
    );
    applyAvatarPose(avatar, initialSkaterState);
    city.add(avatar);

    scene = new THREE.Scene();
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
    const previewCameraPosition = new THREE.Vector3(
      cameraTarget.x,
      layout.planetRadius * 1.15,
      layout.planetRadius * 3.6,
    );
    camera.position.copy(previewCameraPosition);
    camera.lookAt(cameraTarget);

    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'low-power',
    });
    registerCleanup(() => renderer?.dispose());
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = false;

    let cameraState = null;
    let previewCameraSnapshot = null;
    let lastEvents = [];
    const joinButton = root.querySelector('#join-city');
    const leaveButton = root.querySelector('#leave-city');
    const status = root.querySelector('#connection-state');
    const inputStatus = root.querySelector('#input-status');
    const touchControls = root.querySelector('#touch-controls');
    let currentGamepadStatus = 'disconnected';
    const touchAvailable = Boolean(
      window.matchMedia?.('(pointer: coarse)').matches || window.navigator?.maxTouchPoints > 0,
    );

    function render() {
      if (!disposed) renderer.render(scene, camera);
    }

    controls = THREE.OrbitControls
      ? new THREE.OrbitControls(camera, renderer.domElement)
      : null;
    if (controls) {
      registerCleanup(() => {
        controls?.removeEventListener('change', render);
        controls?.dispose();
      });
    }
    if (controls) {
      controls.target.copy(cameraTarget);
      controls.enablePan = false;
      controls.minDistance = layout.planetRadius * 1.55;
      controls.maxDistance = layout.planetRadius * 4.5;
      controls.addEventListener('change', render);
      controls.update();
    }

    function applyCameraState(nextState) {
      camera.position.set(...nextState.position);
      camera.up.set(...nextState.up);
      camera.lookAt(new THREE.Vector3(...nextState.target));
    }

    function showPreviewCamera() {
      const preview = previewCameraSnapshot;
      camera.position.copy(preview?.position ?? previewCameraPosition);
      camera.up.copy(preview?.up ?? new THREE.Vector3(0, 1, 0));
      cameraTarget.copy(preview?.target ?? cameraTarget);
      if (controls) {
        controls.enabled = true;
        controls.target.copy(cameraTarget);
      }
      camera.lookAt(cameraTarget);
      controls?.update();
      cameraState = null;
      previewCameraSnapshot = null;
    }

    function updateGamepadStatus(gamepadStatus) {
      currentGamepadStatus = gamepadStatus;
      if (!inputStatus) return;
      const unsupported = gamepadStatus === 'unsupported'
        && session?.getState().mode === 'playing';
      inputStatus.hidden = !unsupported;
      inputStatus.textContent = unsupported
        ? 'Gamepad unsupported — keyboard or touch controls remain available.'
        : '';
    }

    function updateUI(mode) {
      if (mode === 'preview') {
        root.dataset.gameState = 'ready';
        if (joinButton) joinButton.hidden = false;
        if (leaveButton) leaveButton.hidden = true;
        if (touchControls) touchControls.hidden = true;
        if (inputStatus) {
          inputStatus.hidden = true;
          inputStatus.textContent = '';
        }
        if (status) {
          status.dataset.gameMode = 'preview';
          status.textContent = 'Offline preview';
        }
        showPreviewCamera();
        applyAvatarPose(avatar, session?.getState().skaterState ?? initialSkaterState);
        render();
        return;
      }

      root.dataset.gameState = mode;
      if (controls) controls.enabled = false;
      if (joinButton) joinButton.hidden = true;
      if (leaveButton) leaveButton.hidden = false;
      if (touchControls) touchControls.hidden = !(mode === 'playing' && touchAvailable);
      updateGamepadStatus(currentGamepadStatus);
      if (status) {
        status.dataset.gameMode = mode;
        status.textContent = mode === 'playing'
          ? 'Local session · offline · progress resets when you leave'
          : mode === 'paused'
            ? 'Paused while the game is unavailable'
            : 'Game closed';
      }
      if (mode === 'playing') {
        const state = session.getState().skaterState;
        cameraState = createFollowCameraState(state, world, viewportFor(root));
        applyCameraState(cameraState);
        applyAvatarPose(avatar, state);
        render();
      }
    }

    const isPlaying = () => session?.getState().mode === 'playing';
    let inputRouter = null;
    const keyboardInput = createKeyboardMouseInput({
      target: window,
      canvas,
      form: customizationForm,
      documentObject: document,
      isEnabled: isPlaying,
      onIntent: (activity) => inputRouter?.notifyIntent('keyboard', activity),
      onReset: () => inputRouter?.reset(),
    });
    const gamepadInput = createGamepadInput({
      target: window,
      documentObject: document,
      isEnabled: isPlaying,
      onIntent: (activity) => inputRouter?.notifyIntent('gamepad', activity),
      onStatusChange: updateGamepadStatus,
      onInvalidated: () => session?.invalidateInput(),
    });
    const touchInput = createTouchInput({
      controlsRoot: touchControls,
      target: window,
      documentObject: document,
      isEnabled: isPlaying,
      onIntent: (activity) => inputRouter?.notifyIntent('touch', activity),
    });
    inputRouter = createInputRouter({
      keyboard: keyboardInput,
      gamepad: gamepadInput,
      touch: touchInput,
      isEnabled: isPlaying,
      onInvalidated: () => session?.invalidateInput(),
    });
    input = inputRouter;
    registerCleanup(() => {
      if (session) session.dispose();
      else input?.dispose();
    });
    session = createGameSession({
      initialState: initialSkaterState,
      resetState: () => createCitySkater(world),
      input,
      step: (state, inputFrame, deltaSeconds) => stepSkaterOnCity(
        state,
        inputFrame,
        deltaSeconds,
        world,
      ),
      onModeChange: updateUI,
      onFrame(frame) {
        lastEvents = frame.recentEvents;
        const state = frame.skaterState;
        applyAvatarPose(avatar, state, frame.elapsedMs);
        const cameraInput = input.sampleCameraInput(frame.elapsedMs / 1000);
        cameraState = updateFollowCamera(
          cameraState,
          state,
          cameraInput,
          world,
          frame.elapsedMs / 1000,
          viewportFor(root),
        );
        applyCameraState(cameraState);
        render();
      },
    });

    const lifecycle = bindInputLifecycle({ target: window, documentObject: document,
      form: customizationForm, canvas, session, input });
    registerCleanup(() => lifecycle.dispose());

    customizationBinding = customizationForm
      ? bindCustomizationForm(customizationForm, (appearance) => {
        setAvatarAppearance(avatar, appearance);
        render();
      })
      : null;
    registerCleanup(() => customizationBinding?.dispose());

    function onJoin() {
      previewCameraSnapshot = {
        position: camera.position.clone(),
        target: controls?.target.clone() ?? cameraTarget.clone(),
        up: camera.up.clone(),
      };
      if (!session.joinLocal()) return;
      canvas.focus({ preventScroll: true });
    }

    function onLeave() {
      session.leave();
      canvas.blur?.();
    }

    function onContextLost(event) {
      event.preventDefault();
      session.suspend('context-lost');
      showBootError(root, '3D graphics paused unexpectedly. Retry to rebuild the game.');
    }

    joinButton?.addEventListener('click', onJoin);
    leaveButton?.addEventListener('click', onLeave);
    canvas.addEventListener('webglcontextlost', onContextLost);
    registerCleanup(() => {
      joinButton?.removeEventListener('click', onJoin);
      leaveButton?.removeEventListener('click', onLeave);
      canvas.removeEventListener('webglcontextlost', onContextLost);
    });

    function resize() {
      if (disposed) return;
      const width = Math.max(1, root.clientWidth);
      const height = Math.max(1, root.clientHeight);
      renderer.setSize(width, height, false);
      const targetX = width / height > 1.2 ? -layout.planetRadius * 0.5 : 0;
      if (targetX !== cameraTarget.x) {
        const offset = targetX - cameraTarget.x;
        cameraTarget.x = targetX;
        previewCameraPosition.x += offset;
        if (previewCameraSnapshot) {
          previewCameraSnapshot.position.x += offset;
          previewCameraSnapshot.target.x += offset;
        }
        if (!cameraState) {
          camera.position.x += offset;
          controls?.target.copy(cameraTarget);
          controls?.update();
        }
      }
      if (cameraState) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        render();
        return;
      }
      camera.lookAt(cameraTarget);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      render();
    }

    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(resize);
      registerCleanup(() => resizeObserver?.disconnect());
      resizeObserver.observe(root);
    } else {
      window.addEventListener('resize', resize);
      registerCleanup(() => window.removeEventListener('resize', resize));
    }
    resize();
    root.dataset.gameState = 'ready';

    return {
      city,
      avatar,
      geometryCache,
      layout,
      world,
      scene,
      camera,
      renderer,
      controls,
      session,
      get skaterState() { return session.getState().skaterState; },
      get lastEvents() { return [...lastEvents]; },
      get cameraState() { return cameraState; },
      dispose() {
        if (disposed) return;
        disposed = true;
        cleanupResources();
        root.dataset.gameState = 'disposed';
      },
    };
  } catch (error) {
    disposed = true;
    cleanupResources();
    throw error;
  }
}

const root = document.querySelector('#game-root');
if (root) {
  let activeGame = null;
  const retryButton = root.querySelector('#retry-game');

  const boot = () => {
    activeGame?.dispose();
    activeGame = null;
    root.dataset.gameState = 'loading';
    clearBootError(root);
    try {
      activeGame = startSkateGame({ root, THREE: window.THREE });
      window.skateGame = activeGame;
    } catch (error) {
      window.skateGame = null;
      const message = /webgl|context|renderer/i.test(error?.message ?? '')
        ? 'WebGL is unavailable. Enable hardware acceleration or try a browser with 3D graphics support.'
        : 'The game could not start. Retry to try again.';
      showBootError(root, message);
    }
  };

  retryButton?.addEventListener('click', boot);
  boot();
}
