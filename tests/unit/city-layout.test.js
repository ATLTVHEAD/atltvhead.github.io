import { describe, expect, it } from 'vitest';
import {
  createCityLayout,
  findGrindRail,
  findRideableSurface,
  isRouteGraphConnected,
  projectOntoRail,
  surfaceDistanceToRecord,
} from '../../js/game/world/city-layout.js';
import { cross3, normalize3 } from '../../js/game/core/planet-math.js';

describe('createCityLayout', () => {
  it('createCityLayout_isDeterministic', () => {
    expect(createCityLayout({ radius: 16, seed: 42 }))
      .toEqual(createCityLayout({ radius: 16, seed: 42 }));
  });

  it('cityLayout_hasConnectedRideLoop', () => {
    const layout = createCityLayout({ radius: 16, seed: 4 });
    const loopEdges = layout.routeGraph.edges.filter((edge) => edge.loop);

    expect(isRouteGraphConnected(layout.routeGraph)).toBe(true);
    expect(loopEdges.length).toBeGreaterThanOrEqual(layout.routeGraph.nodes.length);
    expect(new Set(loopEdges.map((edge) => edge.from)).size)
      .toBe(layout.routeGraph.nodes.length);
  });

  it('cityLayout_includesRampAndRail', () => {
    const layout = createCityLayout({ radius: 16, seed: 11 });

    expect(layout.surfaces.some((surface) => surface.type === 'street')).toBe(true);
    expect(layout.surfaces.some((surface) => surface.type === 'ramp')).toBe(true);
    expect(layout.rails.length).toBeGreaterThan(0);
    expect(layout.buildings.length).toBeGreaterThan(0);
  });
});

describe('isRouteGraphConnected', () => {
  it('isRouteGraphConnected_handlesEmptyDisconnectedAndConnectedGraphs', () => {
    expect(isRouteGraphConnected({ nodes: [], edges: [] })).toBe(false);
    expect(isRouteGraphConnected({
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [],
    })).toBe(false);
    expect(isRouteGraphConnected({
      nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
      ],
    })).toBe(true);
  });
});

describe('findRideableSurface', () => {
  it('findRideableSurface_hitsStreetAndRamp', () => {
    const layout = createCityLayout({ radius: 16, seed: 7 });
    const street = layout.surfaces.find((surface) => surface.type === 'street');
    const ramp = layout.surfaces.find((surface) => surface.type === 'ramp');

    expect(findRideableSurface(layout, street.centerline[5]).type).toBe('street');
    expect(findRideableSurface(layout, ramp.centerline[6]).type).toBe('ramp');
  });

  it('findRideableSurface_rejectsBuilding', () => {
    const layout = createCityLayout({ radius: 16, seed: 8 });
    const building = layout.buildings[4];

    expect(findRideableSurface(layout, building.position)).toBeNull();
  });

  it('findRideableSurface_returnsSphericalNormal', () => {
    const layout = createCityLayout({ radius: 16, seed: 9 });
    const roadPoint = layout.surfaces[0].centerline[5];
    const hit = findRideableSurface(layout, roadPoint);

    expect(hit).not.toBeNull();
    expect(Math.hypot(...hit.normal)).toBeCloseTo(1);
    expect(hit.normal).toEqual(hit.position.map((component) => component / Math.hypot(...hit.position)));
  });

  it('findRideableSurface_isStableAtRouteJoins', () => {
    const layout = createCityLayout({ radius: 16, seed: 10 });
    const join = layout.surfaces[4].centerline[0];
    const firstHit = findRideableSurface(layout, join);
    const secondHit = findRideableSurface(layout, join);

    expect(firstHit.surfaceId).toBe(secondHit.surfaceId);
    expect(layout.surfaces.some((surface) => surface.id === firstHit.surfaceId)).toBe(true);
  });

  it('surfaceDistanceToRecord_followsStreetRampAndCurvedPoints', () => {
    const layout = createCityLayout({ radius: 16, seed: 13 });
    const street = layout.surfaces[0];
    const ramp = layout.surfaces.find((surface) => surface.type === 'ramp');

    const streetHit = surfaceDistanceToRecord(street.centerline[5], street);
    const rampHit = surfaceDistanceToRecord(ramp.centerline[6], ramp);

    expect(streetHit.distance).toBeCloseTo(0);
    expect(rampHit.distance).toBeCloseTo(0);
    expect(Math.hypot(...streetHit.normal)).toBeCloseTo(1);
    expect(Math.hypot(...rampHit.normal)).toBeCloseTo(1);
  });
});

describe('findGrindRail', () => {
  it('findGrindRail_findsNearestAlignedRail', () => {
    const layout = createCityLayout({ radius: 16, seed: 5 });
    const rail = layout.rails[0];
    const forward = normalize3(rail.end.map((component, axis) => component - rail.start[axis]));
    const hit = findGrindRail(layout, rail.points[2], forward);

    expect(hit.railId).toBe(rail.id);
    expect(hit.distance).toBeCloseTo(0);
  });

  it('findGrindRail_rejectsOutsideToleranceAndMisalignedApproach', () => {
    const layout = createCityLayout({ radius: 16, seed: 6 });
    const rail = layout.rails[0];
    const forward = normalize3(rail.end.map((component, axis) => component - rail.start[axis]));
    const normal = normalize3(rail.points[2]);
    const misaligned = cross3(forward, normal);
    const farAway = rail.points[0].map((component) => component * 2);

    expect(findGrindRail(layout, rail.points[2], misaligned)).toBeNull();
    expect(findGrindRail(layout, farAway, forward)).toBeNull();
  });

  it('projectOntoRail_handlesEndpointsMidpointAndOutOfRangePositions', () => {
    const rail = createCityLayout({ radius: 16, seed: 12 }).rails[0];
    const midpoint = rail.points[Math.floor(rail.points.length / 2)];
    const midpointHit = projectOntoRail(midpoint, rail);
    const startHit = projectOntoRail(rail.start, rail);
    const endHit = projectOntoRail(rail.end, rail);
    const forward = normalize3(rail.end.map((component, axis) => component - rail.start[axis]));
    const beforeStart = rail.start.map((component, axis) => component - forward[axis] * 4);
    const beforeHit = projectOntoRail(beforeStart, rail);

    expect(startHit.progress).toBeCloseTo(0);
    expect(endHit.progress).toBeCloseTo(1);
    expect(midpointHit.progress).toBeGreaterThan(0.35);
    expect(midpointHit.progress).toBeLessThan(0.65);
    expect(beforeHit.progress).toBeCloseTo(0);
    expect(beforeHit.point).toEqual(rail.start);
  });
});
