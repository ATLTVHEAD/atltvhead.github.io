import { dot3, normalize3 } from '../core/planet-math.js';

const sub = (a, b) => a.map((v, i) => v - b[i]);
const addScaled = (a, b, t) => a.map((v, i) => v + b[i] * t);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const validPoint = (point) => Array.isArray(point) && point.length === 3 && point.every(Number.isFinite);

export function compileSkatePath(record) {
  if (!record?.id || !Array.isArray(record.points) || record.points.length < 2
      || !record.points.every(validPoint)) throw new TypeError('A path needs an ID and finite points.');
  const points = record.points.map((point) => [...point]);
  const segmentLengths = points.slice(1).map((point, i) => Math.hypot(...sub(point, points[i])));
  const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);
  if (!(totalLength > 0)) throw new RangeError('A path must have nonzero length.');
  return { ...record, points, segmentLengths, totalLength,
    bounds: { min: [0, 1, 2].map((i) => Math.min(...points.map((p) => p[i]))),
      max: [0, 1, 2].map((i) => Math.max(...points.map((p) => p[i]))) } };
}

export function sampleSkatePath(path, distance) {
  if (!Number.isFinite(distance) || !path?.segmentLengths?.length) return null;
  let remaining = clamp(distance, 0, path.totalLength);
  for (let index = 0; index < path.segmentLengths.length; index += 1) {
    const length = path.segmentLengths[index];
    if (length <= 1e-12) continue;
    if (remaining <= length || index === path.segmentLengths.length - 1) {
      const tangent = normalize3(sub(path.points[index + 1], path.points[index]));
      const point = addScaled(path.points[index], tangent, Math.min(remaining, length));
      return { point, tangent, gravityUp: normalize3(point) };
    }
    remaining -= length;
  }
  return null;
}

function closestParameters(p, q, a, b) {
  const u = sub(q, p); const v = sub(b, a); const w = sub(p, a);
  const uu = dot3(u, u); const vv = dot3(v, v); const uv = dot3(u, v);
  const uw = dot3(u, w); const vw = dot3(v, w);
  const determinant = uu * vv - uv * uv;
  let s = determinant > 1e-12 ? clamp((uv * vw - uw * vv) / determinant, 0, 1) : 0;
  let t = vv > 1e-12 ? (uv * s + vw) / vv : 0;
  if (t < 0) { t = 0; s = uu > 1e-12 ? clamp(-uw / uu, 0, 1) : 0; }
  else if (t > 1) { t = 1; s = uu > 1e-12 ? clamp((uv - uw) / uu, 0, 1) : 0; }
  return { s, t };
}

export function projectSkatePath(path, from, to) {
  if (!validPoint(from) || !validPoint(to) || !path?.segmentLengths) return null;
  let best = null;
  let offset = 0;
  for (let i = 0; i < path.segmentLengths.length; i += 1) {
    const length = path.segmentLengths[i];
    if (length <= 1e-12) continue;
    const a = path.points[i]; const b = path.points[i + 1];
    const { s, t } = closestParameters(from, to, a, b);
    const point = addScaled(a, sub(b, a), t);
    const sweptPoint = addScaled(from, sub(to, from), s);
    const distanceToPath = Math.hypot(...sub(point, sweptPoint));
    if (!best || distanceToPath < best.distanceToPath) {
      best = { distanceAlong: offset + t * length, distanceToPath, point,
        tangent: normalize3(sub(b, a)) };
    }
    offset += length;
  }
  return best;
}
