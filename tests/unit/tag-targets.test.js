import { describe, expect, it } from 'vitest';
import { findTagTarget, resolveTagAnchor } from '../../js/game/world/tag-targets.js';

function panel(id, x, { z = 0, width = 4, height = 4, normal = [-1, 0, 0] } = {}) {
  const right = normal[0] < 0 ? [0, 0, 1] : [0, 0, -1];
  const points = [
    [x, 0, z],
    [x, 0, z + width],
    [x, height, z + width],
    [x, height, z],
  ];
  const triangles = normal[0] < 0
    ? [{ id: `${id}-a`, points: [points[0], points[1], points[2]] },
      { id: `${id}-b`, points: [points[0], points[2], points[3]] }]
    : [{ id: `${id}-a`, points: [points[0], points[2], points[1]] },
      { id: `${id}-b`, points: [points[0], points[3], points[2]] }];
  return {
    id,
    triangles,
    frame: { origin: points[0], right, up: [0, 1, 0], normal },
    polygon: [[0, 0], [width, 0], [width, height], [0, height]],
  };
}

function world(tagTargets, colliders = []) {
  return { width: 256, depth: 256, surfaces: [], tagTargets, colliders };
}

function box(id, center, halfExtents) {
  return {
    id,
    collision: {
      type: 'box',
      center,
      axes: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
      halfExtents,
    },
    bounds: {
      min: center.map((value, axis) => value - halfExtents[axis]),
      max: center.map((value, axis) => value + halfExtents[axis]),
    },
  };
}

describe('planar wall tag targets', () => {
  it('tagTargets_wallNormalAndBarycentricRoundTrip', () => {
    const target = panel('west-facing-panel', 12, { normal: [-1, 0, 0], width: 6, height: 3 });
    const anchor = { targetId: target.id, triangleId: target.triangles[0].id, barycentric: [0.2, 0.3, 0.5] };
    const resolved = resolveTagAnchor(world([target]), anchor);

    expect(resolved.point).toEqual([12, 1.5, 4.8]);
    expect(resolved.normal).toEqual([-1, 0, 0]);
  });

  it('tagTargets_rejectsOccludedFarSideAndInvalidAnchor', () => {
    const target = panel('far-panel', 4);
    const blockedWorld = world([target], [box('intervening-wall', [2, 2, 2], [0.2, 3, 3])]);
    expect(findTagTarget(blockedWorld, { position: [0, 2, 2] }, { maxReach: 8 })).toBeNull();
    const triangleWall = {
      id: 'triangle-wall',
      triangles: [
        { id: 'triangle-wall:0', points: [[2, 0, 0], [2, 0, 4], [2, 4, 4]] },
        { id: 'triangle-wall:1', points: [[2, 0, 0], [2, 4, 4], [2, 4, 0]] },
      ],
    };
    expect(findTagTarget({
      ...world([target]),
      surfaces: [triangleWall],
    }, { position: [0, 2, 2] }, { maxReach: 8 })).toBeNull();
    expect(findTagTarget(world([target]), { position: [5, 2, 2] }, { maxReach: 8 })).toBeNull();
    expect(resolveTagAnchor(world([target]), {
      targetId: target.id, triangleId: 'missing-triangle', barycentric: [1, 0, 0],
    })).toBeNull();
    for (const barycentric of [
      [2, -1, 0],
      [0.2, 0.2, 0.2],
      [Number.NaN, 0, 1],
      [0.5, 0.5, -1e-8],
    ]) {
      expect(resolveTagAnchor(world([target]), {
        targetId: target.id, triangleId: target.triangles[0].id, barycentric,
      })).toBeNull();
    }
  });

  it('tagTargets_usesNearestReachablePanelEdgeAndExactReach', () => {
    const large = panel('large-panel', 1, { z: 0, width: 8, height: 4 });
    const nearest = findTagTarget(world([large]), { position: [0, 2, 9] }, { maxReach: 2 });
    expect(nearest).not.toBeNull();
    expect(nearest.point).toEqual([1, 2, 8]);
    expect(Math.hypot(...nearest.point.map((value, axis) => value - [0, 2, 9][axis])))
      .toBeCloseTo(Math.sqrt(2), 8);

    for (const [distance, expected] of [[1.999, true], [2, true], [2.001, false]]) {
      const result = findTagTarget(world([panel(`reach-${distance}`, distance)]), {
        position: [0, 2, 2],
      }, { maxReach: 2 });
      expect(result !== null, `panel at ${distance}`).toBe(expected);
    }
  });

  it('tagTargets_findsVisibleSurfaceWhenNearestPointIsPartiallyOccluded', () => {
    const target = panel('partly-visible-panel', 1);
    const worldWithPartialBlocker = world([target], [
      box('small-intervening-obstacle', [0.5, 2, 2], [0.1, 0.25, 0.25]),
    ]);
    const result = findTagTarget(worldWithPartialBlocker, { position: [0, 2, 2] }, { maxReach: 2 });

    expect(result).not.toBeNull();
    const distance = Math.hypot(...result.point.map((value, axis) => value - [0, 2, 2][axis]));
    expect(distance).toBeCloseTo(1.18, 2);
    expect(result.point).not.toEqual([1, 2, 2]);
  });

  it('tagTargets_seamImageUsesRealReach', () => {
    const target = panel('seam-panel', 255.5, {
      z: 124,
      width: 8,
      height: 4,
      normal: [1, 0, 0],
    });
    const result = findTagTarget(world([target]), { position: [0.5, 2, 128] }, { maxReach: 1 });

    expect(result).not.toBeNull();
    expect(result.point).toEqual([-0.5, 2, 128]);
    expect(result.anchor.targetId).toBe(target.id);
    expect(result.normal).toEqual([1, 0, 0]);
    expect(findTagTarget(world([target], [box('seam-blocker', [0, 2, 128], [0.1, 3, 2])]), {
      position: [0.5, 2, 128],
    }, { maxReach: 1 })).toBeNull();
  });
});
