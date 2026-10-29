import { createPlanarCityLayout } from '../../js/game/world/planar-city-layout.js';
import { compilePlanarWorld } from '../../js/game/world/planar-city-surfaces.js';

export function createSeamGrindFixture({ assetManifest } = {}) {
  const layout = createPlanarCityLayout({ assetManifest });
  layout.spawnPoints = [
    ...layout.spawnPoints,
    {
      id: 'spawn-seam-grind-test',
      surfaceId: 'street-wrap-x-west',
      position: [236, 0, 30],
      forward: [1, 0, 0],
    },
  ];
  layout.skatePaths = [
    ...layout.skatePaths,
    {
      id: 'test-seam-grind-rail',
      type: 'rail',
      top: 0.72,
      width: 0.9,
      radius: 0.09,
      supportDeck: false,
      connectedSupportIds: ['street-wrap-x-west'],
      gravityUp: [0, 1, 0],
      points: [[244, 0.72, 30], [282, 0.72, 30]],
    },
  ];

  return { layout, world: compilePlanarWorld(layout), spawnId: 'spawn-seam-grind-test' };
}
