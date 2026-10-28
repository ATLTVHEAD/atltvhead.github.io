import { createNeutralInputFrame } from './actions.js';

const ACTIONS = new Set(['jump', 'spin', 'grab', 'tag', 'emote']);

function clamp(value, min = -1, max = 1) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(min, Math.min(max, value));
}

function resetStickStyle(stickKnob) {
  if (stickKnob?.style) stickKnob.style.transform = 'translate(0px, 0px)';
}

export function createTouchInput({
  controlsRoot,
  target = globalThis.window,
  documentObject = globalThis.document,
  isEnabled = () => true,
  onIntent = () => {},
  } = {}) {
  const stickZone = controlsRoot?.querySelector?.('[data-touch-stick]') ?? null;
  const stickKnob = controlsRoot?.querySelector?.('[data-touch-stick-knob]') ?? null;
  const pointers = new Map();
  const edges = {
    jumpPressed: false,
    trickPressed: null,
    tagPressed: false,
    emotePressed: null,
  };
  let stick = { steer: 0, throttle: 0, brake: 0 };
  let disposed = false;

  function canControl() {
    return !disposed && !documentObject?.hidden && isEnabled();
  }

  function clearEdges() {
    edges.jumpPressed = false;
    edges.trickPressed = null;
    edges.tagPressed = false;
    edges.emotePressed = null;
  }

  function activateAction(action) {
    if (action === 'jump') edges.jumpPressed = true;
    if (action === 'spin') edges.trickPressed = 'spin';
    if (action === 'grab') edges.trickPressed = 'grab';
    if (action === 'tag') edges.tagPressed = true;
    if (action === 'emote') edges.emotePressed = 'wave';
  }

  function releaseCapture(element, pointerId) {
    if (typeof element?.releasePointerCapture !== 'function') return;
    try {
      if (!element.hasPointerCapture || element.hasPointerCapture(pointerId)) {
        element.releasePointerCapture(pointerId);
      }
    } catch {
      // A browser may revoke pointer capture while dispatching cancellation.
    }
  }

  function capturePointer(element, pointerId) {
    try {
      element?.setPointerCapture?.(pointerId);
    } catch {
      // Pointer capture is an enhancement; cancellation handlers still reset state.
    }
  }

  function reset() {
    const activePointers = [...pointers.entries()];
    pointers.clear();
    stick = { steer: 0, throttle: 0, brake: 0 };
    clearEdges();
    resetStickStyle(stickKnob);
    for (const [pointerId, pointerState] of activePointers) {
      releaseCapture(pointerState.target, pointerId);
    }
  }

  function setStickPosition(pointerState, clientX, clientY) {
    const dx = clamp((clientX - pointerState.origin.x) / pointerState.radius);
    const dy = clamp((clientY - pointerState.origin.y) / pointerState.radius);
    const distance = Math.hypot(dx, dy);
    const scale = distance > 1 ? 1 / distance : 1;
    const x = dx * scale;
    const y = dy * scale;
    stick = {
      steer: x,
      throttle: Math.max(0, -y),
      brake: Math.max(0, y),
    };
    if (stickKnob?.style) {
      stickKnob.style.transform = `translate(${x * pointerState.radius}px, ${y * pointerState.radius}px)`;
    }
    const activity = Math.max(Math.abs(x), Math.abs(y));
    if (activity > 0.05) onIntent(activity);
  }

  function onPointerDown(event) {
    if (!canControl() || pointers.has(event.pointerId)) return;
    const targetElement = event.target;
    const actionElement = targetElement?.closest?.('[data-touch-action]');
    if (actionElement) {
      const action = actionElement.dataset?.touchAction;
      if (!ACTIONS.has(action)) return;
      pointers.set(event.pointerId, { type: 'action', action, target: targetElement });
      activateAction(action);
      onIntent(1);
      capturePointer(targetElement, event.pointerId);
      event.preventDefault?.();
      return;
    }

    const touchedStick = targetElement?.closest?.('[data-touch-stick]');
    if (!stickZone || touchedStick !== stickZone || [...pointers.values()].some((pointerState) => (
      pointerState.type === 'stick'
    ))) return;

    const bounds = stickZone.getBoundingClientRect?.() ?? {};
    const radius = Math.max(1, Math.min(bounds.width || 120, bounds.height || 120) / 2);
    const pointerState = {
      type: 'stick',
      target: targetElement,
      origin: { x: event.clientX, y: event.clientY },
      radius,
    };
    pointers.set(event.pointerId, pointerState);
    onIntent(1);
    capturePointer(targetElement, event.pointerId);
    event.preventDefault?.();
  }

  function onClick(event) {
    if (!canControl() || event.detail !== 0) return;
    const actionElement = event.target?.closest?.('[data-touch-action]');
    const action = actionElement?.dataset?.touchAction;
    if (!ACTIONS.has(action)) return;
    activateAction(action);
    onIntent(1);
  }

  function onPointerMove(event) {
    if (!canControl()) {
      reset();
      return;
    }
    const pointerState = pointers.get(event.pointerId);
    if (pointerState?.type !== 'stick') return;
    setStickPosition(pointerState, event.clientX, event.clientY);
    event.preventDefault?.();
  }

  function onPointerUp(event) {
    const pointerState = pointers.get(event.pointerId);
    if (!pointerState) return;
    pointers.delete(event.pointerId);
    releaseCapture(pointerState.target, event.pointerId);
    if (pointerState.type === 'stick') {
      stick = { steer: 0, throttle: 0, brake: 0 };
      resetStickStyle(stickKnob);
    }
    event.preventDefault?.();
  }

  function onPointerCancel(event) {
    if (pointers.has(event.pointerId)) reset();
  }

  function onLostPointerCapture(event) {
    if (pointers.has(event.pointerId)) reset();
  }

  function onVisibilityChange() {
    if (documentObject?.hidden) reset();
  }

  const controlListeners = [
    ['pointerdown', onPointerDown],
    ['click', onClick],
    ['pointermove', onPointerMove],
    ['pointerup', onPointerUp],
    ['pointercancel', onPointerCancel],
    ['lostpointercapture', onLostPointerCapture],
  ];
  const targetListeners = [
    ['blur', reset],
    ['resize', reset],
    ['orientationchange', reset],
  ];
  for (const [type, listener] of controlListeners) controlsRoot?.addEventListener?.(type, listener);
  for (const [type, listener] of targetListeners) target?.addEventListener?.(type, listener);
  documentObject?.addEventListener?.('visibilitychange', onVisibilityChange);

  return {
    sample() {
      if (!canControl()) {
        reset();
        return createNeutralInputFrame();
      }
      const frame = {
        ...createNeutralInputFrame(),
        ...stick,
        ...edges,
      };
      clearEdges();
      return frame;
    },
    sampleCameraInput() {
      return { yawDelta: 0, pitchDelta: 0, zoomDelta: 0 };
    },
    reset,
    dispose() {
      if (disposed) return;
      reset();
      disposed = true;
      for (const [type, listener] of controlListeners) {
        controlsRoot?.removeEventListener?.(type, listener);
      }
      for (const [type, listener] of targetListeners) target?.removeEventListener?.(type, listener);
      documentObject?.removeEventListener?.('visibilitychange', onVisibilityChange);
    },
  };
}
