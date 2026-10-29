const PLANAR_WORLD_SIZE = Object.freeze({ width: 256, depth: 256 });

export const WORLD_DESCRIPTOR = Object.freeze({
  version: 3,
  seed: 2026,
  radius: 32,
  tuningVersion: 2,
  planar: PLANAR_WORLD_SIZE,
});

export const WORLD_LIMITS = Object.freeze({
  maxGuests: 12,
  poseHz: 5,
});
