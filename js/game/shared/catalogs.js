export const DEFAULT_APPEARANCE = Object.freeze({
  color: '#FF006E',
  accessoryIds: Object.freeze([]),
});

export const AVATAR_ACCESSORIES = Object.freeze([
  Object.freeze({ id: 'cap', label: 'Cap' }),
]);

export const TRICK_CATALOG = Object.freeze([
  Object.freeze({ id: 'spin', label: 'Spin', basePoints: 100 }),
  Object.freeze({ id: 'grab', label: 'Grab', basePoints: 150 }),
]);

export function getTrickAction(id) {
  return TRICK_CATALOG.find((action) => action.id === id) ?? null;
}

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
