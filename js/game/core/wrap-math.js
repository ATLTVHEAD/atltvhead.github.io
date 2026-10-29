function requireFinite(value, name) {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite.`);
}

function requireSpan(span) {
  requireFinite(span, 'Span');
  if (span <= 0) throw new RangeError('Span must be greater than zero.');
}

export function wrapScalar(value, span) {
  requireFinite(value, 'Value');
  requireSpan(span);
  const remainder = value % span;
  if (remainder === 0) return 0;
  const wrapped = remainder < 0 ? remainder + span : remainder;
  return wrapped >= span ? 0 : wrapped;
}

export function wrapPosition(position, dimensions = {}) {
  if (!Array.isArray(position) || position.length !== 3) {
    throw new RangeError('Position must be a finite three-component vector.');
  }
  if (!dimensions || typeof dimensions !== 'object') {
    throw new RangeError('World dimensions must include positive width and depth.');
  }
  const { width, depth } = dimensions;
  requireFinite(position[1], 'Position height');
  return [
    wrapScalar(position[0], width),
    position[1],
    wrapScalar(position[2], depth),
  ];
}

export function wrapDelta(from, to, span) {
  requireFinite(from, 'From');
  requireFinite(to, 'To');
  requireSpan(span);
  let delta = wrapScalar(to, span) - wrapScalar(from, span);
  const halfSpan = span / 2;
  if (delta >= halfSpan) delta -= span;
  else if (delta < -halfSpan) delta += span;
  return delta === 0 ? 0 : delta;
}

export function nearestImage(value, reference, span) {
  requireFinite(value, 'Value');
  requireFinite(reference, 'Reference');
  requireSpan(span);
  const image = reference + wrapDelta(reference, value, span);
  requireFinite(image, 'Nearest image');
  return image;
}
