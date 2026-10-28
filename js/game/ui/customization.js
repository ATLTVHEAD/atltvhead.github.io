import {
  DEFAULT_APPEARANCE,
  filterAccessoryIds,
  normalizeAppearanceColor,
} from '../shared/catalogs.js';

export { DEFAULT_APPEARANCE, filterAccessoryIds };
export const normalizeColor = normalizeAppearanceColor;

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
    color: normalizeAppearanceColor(colorInput?.value),
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
