import { isAccessoryId } from '../render/avatar.js';

export const DEFAULT_APPEARANCE = Object.freeze({
  color: '#FF006E',
  accessoryIds: Object.freeze([]),
});

export function normalizeColor(color) {
  return typeof color === 'string' && /^#[\da-f]{6}$/i.test(color)
    ? color.toUpperCase()
    : DEFAULT_APPEARANCE.color;
}

export function filterAccessoryIds(accessoryIds) {
  if (!Array.isArray(accessoryIds)) return [];
  return [...new Set(accessoryIds.filter(isAccessoryId))];
}

export function readCustomizationForm(form) {
  if (typeof form?.querySelector !== 'function') {
    return {
      color: DEFAULT_APPEARANCE.color,
      accessoryIds: [],
    };
  }

  const colorInput = form.querySelector('input[type="color"]');
  const selectedAccessories = typeof form.querySelectorAll === 'function'
    ? Array.from(form.querySelectorAll('input[name="accessories"]:checked'), (input) => input.value)
    : [];

  return {
    color: normalizeColor(colorInput?.value),
    accessoryIds: filterAccessoryIds(selectedAccessories),
  };
}

export function bindCustomizationForm(form, onAppearanceChange) {
  if (!form || typeof form.addEventListener !== 'function') {
    throw new TypeError('A customization form is required.');
  }
  if (typeof onAppearanceChange !== 'function') {
    throw new TypeError('An appearance change callback is required.');
  }

  const updateAppearance = () => onAppearanceChange(readCustomizationForm(form));
  form.addEventListener('input', updateAppearance);
  form.addEventListener('change', updateAppearance);
  updateAppearance();

  let disposed = false;
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      form.removeEventListener('input', updateAppearance);
      form.removeEventListener('change', updateAppearance);
    },
  };
}
