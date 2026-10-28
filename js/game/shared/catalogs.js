export const DEFAULT_APPEARANCE = Object.freeze({
  color: '#FF006E',
  accessoryIds: Object.freeze([]),
});

export const AVATAR_ACCESSORIES = Object.freeze([
  Object.freeze({ id: 'cap', label: 'Cap' }),
]);

export function normalizeAppearanceColor(color) {
  return typeof color === 'string' && /^#[\da-f]{6}$/i.test(color)
    ? color.toUpperCase()
    : DEFAULT_APPEARANCE.color;
}

export function isAccessoryId(id) {
  return AVATAR_ACCESSORIES.some((accessory) => accessory.id === id);
}

export function filterAccessoryIds(accessoryIds) {
  if (!Array.isArray(accessoryIds)) return [];
  return [...new Set(accessoryIds.filter(isAccessoryId))];
}
