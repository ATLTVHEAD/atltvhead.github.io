import { createNeutralInputFrame } from './actions.js';

const ACTION_KEYS = new Set([
  'w', 'arrowup', 's', 'arrowdown', 'a', 'arrowleft', 'd', 'arrowright',
  'shift', 'space', 'j', 'k', 'f', 'e',
]);

function keyName(event) {
  if (event.code === 'Space' || event.key === ' ') return 'space';
  if (event.key?.toLowerCase?.() === 'shift') return 'shift';
  return typeof event.key === 'string' ? event.key.toLowerCase() : '';
}

function isTextTarget(target, form) {
  if (!target) return false;
  if (form?.contains?.(target)) return true;
  if (target.isContentEditable) return true;
  const tagName = target.tagName?.toUpperCase();
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName)) return true;
  return Boolean(target.closest?.('input, textarea, select, [contenteditable="true"]'));
}

function isTouchActionTarget(target) {
  return Boolean(target?.closest?.('[data-touch-action]'));
}

function emptyCameraInput() {
  return { yawDelta: 0, pitchDelta: 0, zoomDelta: 0 };
}

export function createKeyboardMouseInput({
  target = globalThis.window,
  canvas,
  form = null,
  documentObject = globalThis.document,
  isEnabled = () => true,
  onIntent = () => {},
  onReset = () => {},
} = {}) {
  if (!target?.addEventListener || !canvas?.addEventListener) {
    throw new TypeError('Keyboard input needs an event target and a game canvas.');
  }

  const held = new Set();
  const pressed = new Set();
  const edges = {
    jumpPressed: false,
    trickPressed: null,
    tagPressed: false,
    emotePressed: null,
  };
  const cameraInput = emptyCameraInput();
  let dragPointerId = null;
  let lastPointer = null;
  let disposed = false;

  const canControl = () => !disposed && isEnabled();
  const clearEdges = () => {
    edges.jumpPressed = false;
    edges.trickPressed = null;
    edges.tagPressed = false;
    edges.emotePressed = null;
  };

  function releasePointer(lost = false) {
    if (dragPointerId === null) return;
    const pointerId = dragPointerId;
    dragPointerId = null;
    lastPointer = null;
    if (!lost && typeof canvas.releasePointerCapture === 'function') {
      try {
        if (!canvas.hasPointerCapture || canvas.hasPointerCapture(pointerId)) {
          canvas.releasePointerCapture(pointerId);
        }
      } catch {
        // A browser may revoke capture while dispatching pointer cancellation.
      }
    }
  }

  function reset() {
    held.clear();
    pressed.clear();
    clearEdges();
    cameraInput.yawDelta = 0;
    cameraInput.pitchDelta = 0;
    cameraInput.zoomDelta = 0;
    releasePointer();
  }

  function onKeyDown(event) {
    const name = keyName(event);
    if (!ACTION_KEYS.has(name) || !canControl() || isTextTarget(event.target, form)
      || (name === 'space' && isTouchActionTarget(event.target))) return;
    event.preventDefault?.();
    if (pressed.has(name) || event.repeat) return;
    pressed.add(name);
    held.add(name);
    onIntent(1);
    if (name === 'space') edges.jumpPressed = true;
    if (name === 'j') edges.trickPressed = 'spin';
    if (name === 'k') edges.trickPressed = 'grab';
    if (name === 'f') edges.tagPressed = true;
    if (name === 'e') edges.emotePressed = 'wave';
  }

  function onKeyUp(event) {
    const name = keyName(event);
    if (!ACTION_KEYS.has(name)) return;
    const hadKey = pressed.delete(name);
    held.delete(name);
    if (hadKey && canControl() && !isTextTarget(event.target, form)) event.preventDefault?.();
  }

  function onFocusIn(event) {
    if (isTextTarget(event.target, form)) {
      reset();
      onReset();
    }
  }

  function onVisibilityChange() {
    if (documentObject?.hidden) {
      reset();
      onReset();
    }
  }

  function onBlur() {
    reset();
    onReset();
  }

  function onPointerDown(event) {
    if (!canControl() || event.target !== canvas || event.button !== 0) return;
    dragPointerId = event.pointerId;
    lastPointer = { x: event.clientX, y: event.clientY };
    try {
      canvas.setPointerCapture?.(event.pointerId);
    } catch {
      releasePointer(true);
    }
    onIntent(1);
    event.preventDefault?.();
  }

  function onPointerMove(event) {
    if (!canControl() || dragPointerId !== event.pointerId || !lastPointer) return;
    const deltaX = event.clientX - lastPointer.x;
    const deltaY = event.clientY - lastPointer.y;
    cameraInput.yawDelta -= deltaX * 0.005;
    cameraInput.pitchDelta += deltaY * 0.005;
    lastPointer = { x: event.clientX, y: event.clientY };
    event.preventDefault?.();
  }

  function onPointerUp(event) {
    if (dragPointerId === event.pointerId) releasePointer();
  }

  function onLostPointerCapture(event) {
    if (dragPointerId === event.pointerId) releasePointer(true);
  }

  function onWheel(event) {
    if (!canControl() || event.target !== canvas || !Number.isFinite(event.deltaY)) return;
    cameraInput.zoomDelta += event.deltaY * 0.01;
    onIntent(1);
    event.preventDefault?.();
  }

  const targetListeners = [
    ['keydown', onKeyDown],
    ['keyup', onKeyUp],
    ['blur', onBlur],
    ['focusin', onFocusIn],
  ];
  const canvasListeners = [
    ['pointerdown', onPointerDown],
    ['pointermove', onPointerMove],
    ['pointerup', onPointerUp],
    ['pointercancel', onPointerUp],
    ['lostpointercapture', onLostPointerCapture],
    ['wheel', onWheel, { passive: false }],
  ];
  for (const [type, listener] of targetListeners) target.addEventListener(type, listener);
  if (documentObject?.addEventListener) documentObject.addEventListener('visibilitychange', onVisibilityChange);
  for (const [type, listener, options] of canvasListeners) canvas.addEventListener(type, listener, options);

  return {
    sample() {
      if (!canControl()) {
        reset();
        return createNeutralInputFrame();
      }
      const input = {
        ...createNeutralInputFrame(),
        steer: Number(held.has('d') || held.has('arrowright'))
          - Number(held.has('a') || held.has('arrowleft')),
        throttle: Number(held.has('w') || held.has('arrowup')),
        brake: Number(held.has('s') || held.has('arrowdown')),
        grindHeld: held.has('shift'),
        ...edges,
      };
      clearEdges();
      return input;
    },
    sampleCameraInput() {
      if (!canControl()) {
        reset();
        return emptyCameraInput();
      }
      const sampled = { ...cameraInput };
      cameraInput.yawDelta = 0;
      cameraInput.pitchDelta = 0;
      cameraInput.zoomDelta = 0;
      return sampled;
    },
    reset,
    dispose() {
      if (disposed) return;
      reset();
      disposed = true;
      for (const [type, listener] of targetListeners) target.removeEventListener(type, listener);
      documentObject?.removeEventListener?.('visibilitychange', onVisibilityChange);
      for (const [type, listener, options] of canvasListeners) canvas.removeEventListener(type, listener, options);
    },
  };
}
