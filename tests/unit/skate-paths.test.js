import { describe, expect, it } from 'vitest';
import { compileSkatePath, projectSkatePath, sampleSkatePath } from '../../js/game/world/skate-paths.js';

describe('canonical skate paths', () => {
  it('paths_planarUpDoesNotBecomeRadial', () => {
    const planar = compileSkatePath({
      id: 'planar-ledge',
      points: [[40, 2, 30], [44, 3, 30]],
      gravityUp: [0, 9, 0],
    });
    const radialLegacy = compileSkatePath({
      id: 'legacy-radial',
      points: [[40, 0, 30], [44, 0, 30]],
    });

    expect(sampleSkatePath(planar, 1).gravityUp).toEqual([0, 1, 0]);
    expect(sampleSkatePath(radialLegacy, 0).gravityUp).toEqual([0.8, 0, 0.6]);
    expect(() => compileSkatePath({
      id: 'invalid-planar-up',
      points: [[0, 1, 0], [1, 1, 0]],
      gravityUp: [0, 0, 0],
    })).toThrow();
  });

  it('paths_signedDistanceAtEndpointsAndPoles', () => {
    const path = compileSkatePath({ id: 'pole', points: [[0, 32, 0], [0, 32, 4], [4, 32, 4]] });
    expect(path.totalLength).toBe(8);
    expect(sampleSkatePath(path, -2).point).toEqual([0, 32, 0]);
    expect(sampleSkatePath(path, 8).point).toEqual([4, 32, 4]);
    expect(sampleSkatePath(path, 2).point).toEqual([0, 32, 2]);
    expect(sampleSkatePath(path, 2).gravityUp.every(Number.isFinite)).toBe(true);
  });
  it('paths_highSpeedCrossingNotMissed', () => {
    const path = compileSkatePath({ id: 'rail', points: [[-5, 32, 0], [5, 32, 0]] });
    const hit = projectSkatePath(path, [0, 32, -4], [0, 32, 4]);
    expect(hit.distanceToPath).toBeCloseTo(0);
    expect(hit.distanceAlong).toBeCloseTo(5);
  });
});
