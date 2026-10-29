import { createCalibration } from '../input/gamepad-mapping.js';

export function bindControlsPanel({ root, session, input, gamepad, onFocusPlay }) {
  const panel = root.querySelector('#controls-panel');
  const openButton = root.querySelector('#open-controls');
  const closeButton = panel.querySelector('[data-close-controls]');
  const diagnostics = panel.querySelector('[data-controller-diagnostics]');
  const hint = root.querySelector('[data-active-device]');
  const selector = panel.querySelector('#controller-select');
  const calibrateButton = panel.querySelector('[data-calibrate]');
  const cancelCalibrationButton = panel.querySelector('[data-cancel-calibration]');
  const resetMappingButton = panel.querySelector('[data-reset-mapping]');
  const calibrationStatus = panel.querySelector('[data-calibration-status]');
  let handle = null;
  let lastUpdate = -Infinity;
  let menuHeld = false;
  let closeHeld = false;
  let navigationHeld = false;
  let disposed = false;
  let calibration = null;
  let calibrationIndex = null;
  let deviceSignature = '';

  function updateDiagnostics() {
    const state = gamepad.getDiagnostics();
    const signature = JSON.stringify(state.devices.map(({ id, index }) => [id, index]));
    if (signature !== deviceSignature) {
      deviceSignature = signature;
      const current = selector.value;
      selector.replaceChildren(new Option('Automatic', ''));
      state.devices.forEach((device) => selector.add(new Option(`${device.index}: ${device.id}`, String(device.index))));
      if ([...selector.options].some((option) => option.value === current)) selector.value = current;
    }
    if (!state.devices.length) {
      diagnostics.textContent = 'No gamepad exposed by this browser. Check Steam Input gamepad versus desktop bindings; keyboard and touch remain available.';
      return;
    }
    diagnostics.textContent = state.devices.map((device) => (
      `${device.index}: ${device.id} (${device.mapping || 'nonstandard'})\n`
      + `Axes (${device.axes.length}): ${device.axes.map((x) => Number(x).toFixed(2)).join(', ')}\n`
      + `Buttons (${device.buttons.length}): ${device.buttons.map((x) => x.value.toFixed(2)).join(', ')}`
    )).join('\n\n') + `\nSelected: ${state.selectedIndex ?? 'none'}\nStatus: ${state.status}`
      + (state.normalized ? `\nNormalized axes: ${state.normalized.axes.map((x) => Number(x).toFixed(2)).join(', ')}`
        + `\nNormalized buttons: ${state.normalized.buttons.map((button) => Number(button.value ?? 0).toFixed(2)).join(', ')}` : '');
  }

  function menuPressed() {
    const state = gamepad.getDiagnostics();
    return Boolean(state.menuButtons?.menu);
  }

  function dialogButtons() {
    const buttons = gamepad.getDiagnostics().menuButtons;
    return { confirm: Boolean(buttons?.confirm), cancel: Boolean(buttons?.cancel) };
  }

  function moveFocus(direction) {
    const focusable = [...panel.querySelectorAll('button:not([disabled]), summary, select:not([disabled]), input:not([disabled])')]
      .filter((element) => element.getClientRects().length > 0);
    if (!focusable.length) return;
    const index = focusable.indexOf(document.activeElement);
    focusable[(index + direction + focusable.length) % focusable.length].focus();
  }

  function poll(timestamp) {
    handle = null;
    if (disposed || panel.hidden || document.hidden) return;
    if (calibration) {
      const raw = gamepad.getDiagnostics().devices.find((device) => device.index === calibrationIndex);
      if (!raw) {
        calibration = null;
        calibrationStatus.textContent = 'Controller disconnected; calibration cancelled.';
        cancelCalibrationButton.hidden = true;
      } else {
        calibration.sample(raw);
        const state = calibration.getState();
        if (state.mapping) {
          gamepad.setMapping(state.mapping);
          calibration = null;
          menuHeld = menuPressed();
          const buttons = dialogButtons();
          closeHeld = buttons.confirm || buttons.cancel;
          calibrationStatus.textContent = 'Calibration complete';
          cancelCalibrationButton.hidden = true;
        } else {
          calibrationStatus.textContent = state.waitingForRelease ? `Release controls · ${state.prompt}` : state.prompt;
        }
      }
      if (timestamp - lastUpdate >= 100) { updateDiagnostics(); lastUpdate = timestamp; }
      handle = requestAnimationFrame(poll);
      return;
    }
    const pressed = menuPressed();
    const buttons = dialogButtons();
    const confirm = buttons.confirm || buttons.cancel;
    const normalized = gamepad.getDiagnostics().normalized?.buttons;
    const up = Boolean(normalized?.[12]?.pressed || normalized?.[12]?.value >= 0.5);
    const down = Boolean(normalized?.[13]?.pressed || normalized?.[13]?.value >= 0.5);
    if ((pressed && !menuHeld) || (buttons.cancel && !closeHeld)) { close(); return; }
    if (buttons.confirm && !closeHeld) {
      if (document.activeElement === closeButton) { close(); return; }
      document.activeElement?.click?.();
    }
    if ((up || down) && !navigationHeld) moveFocus(up ? -1 : 1);
    navigationHeld = up || down;
    menuHeld = pressed;
    closeHeld = confirm;
    if (timestamp - lastUpdate >= 100) { updateDiagnostics(); lastUpdate = timestamp; }
    handle = requestAnimationFrame(poll);
  }

  function open() {
    if (!panel.hidden || session.getState().mode !== 'playing') return;
    menuHeld = menuPressed();
    const buttons = dialogButtons();
    closeHeld = buttons.confirm || buttons.cancel;
    navigationHeld = false;
    session.suspend('controls');
    panel.hidden = false;
    updateDiagnostics();
    closeButton.focus();
    handle = requestAnimationFrame(poll);
  }

  function close() {
    if (panel.hidden) return;
    panel.hidden = true;
    calibration = null;
    cancelCalibrationButton.hidden = true;
    if (handle !== null) cancelAnimationFrame(handle);
    handle = null;
    onFocusPlay();
    session.restore('controls');
  }

  function keydown(event) {
    if (!panel.hidden && event.key === 'Escape') { event.preventDefault(); close(); }
    else if (!panel.hidden && event.key === 'Tab') {
      const focusable = [...panel.querySelectorAll('button:not([disabled]), summary, select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter((element) => element.getClientRects().length > 0);
      const index = focusable.indexOf(document.activeElement);
      if (focusable.length && (index < 0 || (event.shiftKey && index === 0)
          || (!event.shiftKey && index === focusable.length - 1))) {
        event.preventDefault();
        focusable[event.shiftKey ? focusable.length - 1 : 0].focus();
      }
    }
  }
  function visibility() {
    if (document.hidden && handle !== null) { cancelAnimationFrame(handle); handle = null; }
    else if (!document.hidden && !panel.hidden && handle === null) handle = requestAnimationFrame(poll);
  }
  function selectController() {
    calibration = null;
    cancelCalibrationButton.hidden = true;
    gamepad.selectGamepad(selector.value === '' ? null : Number(selector.value));
    calibrationStatus.textContent = '';
    updateDiagnostics();
  }
  function beginCalibration() {
    const state = gamepad.getDiagnostics();
    const raw = state.devices.find((device) => device.index === state.selectedIndex);
    if (!raw) { calibrationStatus.textContent = 'Select a connected controller first.'; return; }
    calibrationIndex = raw.index;
    calibration = createCalibration(raw.id);
    cancelCalibrationButton.hidden = false;
    calibrationStatus.textContent = 'Release controls · Move steering right';
  }
  function cancelCalibration() {
    calibration = null;
    cancelCalibrationButton.hidden = true;
    calibrationStatus.textContent = 'Calibration cancelled.';
  }
  function resetMapping() {
    cancelCalibration();
    gamepad.setMapping(null);
    calibrationStatus.textContent = 'Mapping reset.';
  }
  openButton.addEventListener('click', open);
  closeButton.addEventListener('click', close);
  selector.addEventListener('change', selectController);
  calibrateButton.addEventListener('click', beginCalibration);
  cancelCalibrationButton.addEventListener('click', cancelCalibration);
  resetMappingButton.addEventListener('click', resetMapping);
  document.addEventListener('keydown', keydown);
  document.addEventListener('visibilitychange', visibility);
  return {
    close() { close(); },
    render() {
      const device = input.getActiveDevice();
      hint.textContent = device === 'gamepad' ? 'Gamepad · stick to move · A jump · X Spin · Y Grab'
        : device === 'touch' ? 'Touch · stick to move · Spin · Grab'
          : 'Keyboard · W/A/S/D · Space · J Spin · K Grab';
      const pressed = menuPressed();
      if (panel.hidden && pressed && !menuHeld) open();
      menuHeld = pressed;
    },
    dispose() {
      disposed = true;
      if (handle !== null) cancelAnimationFrame(handle);
      openButton.removeEventListener('click', open);
      closeButton.removeEventListener('click', close);
      selector.removeEventListener('change', selectController);
      calibrateButton.removeEventListener('click', beginCalibration);
      cancelCalibrationButton.removeEventListener('click', cancelCalibration);
      resetMappingButton.removeEventListener('click', resetMapping);
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('visibilitychange', visibility);
    },
  };
}
