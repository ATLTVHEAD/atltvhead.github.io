const ZERO3 = Object.freeze([0, 0, 0]);

function isFiniteVec3(value) {
  return Array.isArray(value)
    && value.length === 3
    && value.every(Number.isFinite);
}

export function dot3(a, b) {
  if (!isFiniteVec3(a) || !isFiniteVec3(b)) return 0;
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function normalize3(vector) {
  if (!isFiniteVec3(vector)) return [...ZERO3];

  const length = Math.hypot(vector[0], vector[1], vector[2]);
  if (length < 1e-12) return [...ZERO3];

  return vector.map((component) => {
    const normalized = component / length;
    return Math.abs(normalized) < 1e-15 ? 0 : normalized;
  });
}

export function projectToTangent(direction, normal) {
  if (!isFiniteVec3(direction)) return [...ZERO3];

  const unitNormal = normalize3(normal);
  if (unitNormal.every((component) => component === 0)) return [...direction];

  const normalComponent = dot3(direction, unitNormal);
  return direction.map((component, index) => {
    const tangentComponent = component - unitNormal[index] * normalComponent;
    return Math.abs(tangentComponent) < 1e-12 ? 0 : tangentComponent;
  });
}

export function cross3(a, b) {
  if (!isFiniteVec3(a) || !isFiniteVec3(b)) return [...ZERO3];
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function chooseFallbackTangent(normal, heading = ZERO3) {
  const up = normalize3(normal);
  if (up.every((component) => component === 0)) return [0, 0, 1];

  const projectedHeading = projectToTangent(heading, up);
  if (Math.hypot(...projectedHeading) >= 1e-12) return normalize3(projectedHeading);

  const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const leastAlignedAxis = axes.reduce((best, axis) => (
    Math.abs(dot3(axis, up)) < Math.abs(dot3(best, up)) ? axis : best
  ));

  return normalize3(projectToTangent(leastAlignedAxis, up));
}

export function makeSurfaceFrame(normal, heading) {
  const normalizedUp = normalize3(normal);
  const up = normalizedUp.every((component) => component === 0)
    ? [0, 1, 0]
    : normalizedUp;

  const projectedHeading = projectToTangent(heading, up);
  const forward = Math.hypot(...projectedHeading) >= 1e-12
    ? normalize3(projectedHeading)
    : chooseFallbackTangent(up, heading);
  const right = normalize3(cross3(forward, up));

  return {
    up,
    forward: normalize3(cross3(up, right)),
    right,
  };
}

export function rotateAroundAxis(vector, axis, angleRadians) {
  if (!isFiniteVec3(vector) || !Number.isFinite(angleRadians)) return [...ZERO3];

  const unitAxis = normalize3(axis);
  if (unitAxis.every((component) => component === 0)) return [...vector];

  const cosine = Math.cos(angleRadians);
  const sine = Math.sin(angleRadians);
  const cross = cross3(unitAxis, vector);
  const projection = dot3(unitAxis, vector) * (1 - cosine);
  return vector.map((component, index) => {
    const rotated = component * cosine + cross[index] * sine + unitAxis[index] * projection;
    return Math.abs(rotated) < 1e-12 ? 0 : rotated;
  });
}

export function advanceAlongSphere(position, forward, distance, radius) {
  if (!isFiniteVec3(position)) return [...ZERO3];

  const up = normalize3(position);
  const positionRadius = Math.hypot(...position);
  if (positionRadius < 1e-12) return [...position];

  const sphereRadius = Number.isFinite(radius) && radius > 0 ? radius : positionRadius;
  const travelDistance = Number.isFinite(distance) ? distance : 0;
  if (travelDistance === 0) return up.map((component) => component * sphereRadius);

  const tangent = normalize3(projectToTangent(forward, up));
  if (tangent.every((component) => component === 0)) {
    return up.map((component) => component * sphereRadius);
  }

  const angle = travelDistance / sphereRadius;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return up.map((component, index) => {
    const next = sphereRadius * (component * cosine + tangent[index] * sine);
    return Math.abs(next) < 1e-12 ? 0 : next;
  });
}
