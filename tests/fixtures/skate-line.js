import { createPlanarCityLayout } from '../../js/game/world/planar-city-layout.js';
import { compilePlanarWorld } from '../../js/game/world/planar-city-surfaces.js';

export function createSkateLineFixture({ assetManifest } = {}) {
  const layout = createPlanarCityLayout({ assetManifest });
  const world = compilePlanarWorld(layout);
  return {
    layout,
    world,
    spawnId: 'spawn-skate-line',
    lineIds: {
      lip: 'launch-lip-smooth-crest',
      path: 'line-smooth-crest-exit',
      capture: 'line-pipe-capture',
      landing: 'line-landing-runout',
      branch: 'branch-alley-dogleg',
      panel: 'tag-panel-container-north',
    },
  };
}
