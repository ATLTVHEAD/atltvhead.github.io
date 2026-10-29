import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';

mkdirSync('artifacts/skate-progress', { recursive: true });

test('authoredCity_compilesReachableLinesBranchesLaunchAndPanels', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/skate.html');
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'ready');

  const authored = await page.evaluate(async () => {
    const { findTagTarget } = await import('/js/game/world/tag-targets.js');
    const { skateGame: game } = window;
    const { planarLayout: layout, playWorld } = game;
    const branch = playWorld.routeGraph.branches?.find((entry) => entry.id === 'branch-alley-dogleg');
    const targets = playWorld.tagTargets.map((target) => ({
      id: target.id,
      normal: target.frame?.normal,
      triangleCount: target.triangles?.length,
    }));
    const attachedFeatures = game.playCity.userData.tileGroups.map((tile) => ({
      lines: tile.children.filter((object) => object.userData.cityFeature === 'rail'
        && object.userData.railIds?.includes('line-smooth-crest-exit')).length,
      targets: tile.children.filter((object) => object.userData.cityFeature === 'tag-panel').length,
      launches: tile.children.filter((object) => object.userData.cityFeature === 'launch-marker').length,
    }));
    const nearbyTag = findTagTarget(game.playWorld, {
      position: [59.5, 1.5, 70],
    }, { maxReach: 2 });
    return {
      pathTypes: layout.skatePaths?.map((path) => ({ id: path.id, type: path.type })) ?? [],
      rails: playWorld.rails.map((path) => ({ id: path.id, type: path.type, gravityUp: path.gravityUp })),
      marker: playWorld.launchMarkers.find((entry) => entry.id === 'launch-lip-smooth-crest'),
      branch,
      targets,
      attachedFeatures,
      nearbyTag,
    };
  });

  expect(authored.pathTypes).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'line-smooth-crest-exit', type: 'ledge' }),
    expect.objectContaining({ id: 'line-pipe-capture', type: 'pipe' }),
  ]));
  expect(authored.rails.some((path) => path.id === 'primary-rail-left')).toBe(true);
  expect(authored.rails.every((path) => path.gravityUp?.join(',') === '0,1,0')).toBe(true);
  expect(authored.marker).toMatchObject({ direction: 1, supportId: 'line-smooth-crest-exit' });
  expect(authored.branch?.entryNodeId).toBeTruthy();
  expect(authored.branch?.exitNodeId).toBeTruthy();
  expect(authored.targets.length).toBeGreaterThan(0);
  expect(authored.targets.every((target) => Math.abs(target.normal[1]) < 1e-8
    && target.triangleCount > 0)).toBe(true);
  expect(authored.targets.find((target) => target.id === 'tag-panel-alley-west-wall').normal)
    .toEqual([1, 0, 0]);
  expect(authored.nearbyTag?.anchor.targetId).toBe('tag-panel-alley-west-wall');
  expect(authored.nearbyTag.normal).toEqual([1, 0, 0]);
  expect(authored.attachedFeatures).toHaveLength(9);
  expect(authored.attachedFeatures.every((features) => features.lines > 0
    && features.targets > 0 && features.launches > 0)).toBe(true);

  await page.getByRole('button', { name: 'Join City' }).click();
  await expect(page.locator('#game-root')).toHaveAttribute('data-game-state', 'playing');
  await page.evaluate(() => {
    window.skateGame.session.pause();
    document.querySelector('.skate-topbar').hidden = true;
    document.querySelector('.skate-card').hidden = true;
    document.querySelector('#touch-controls').hidden = true;
    document.querySelector('#controls-panel').hidden = true;
  });
  const captures = [
    { path: 'artifacts/skate-progress/planar-near-spawn-line.png', position: [128, 7, 74], target: [132, 1, 80], up: [0, 1, 0] },
    { path: 'artifacts/skate-progress/planar-dogleg-line.png', position: [66, 7, 105], target: [96, 0, 110], up: [0, 1, 0] },
    { path: 'artifacts/skate-progress/planar-tag-panel-normals.png', position: [61.3, 3.2, 70], target: [58.32, 1.8, 70], up: [0, 1, 0] },
  ];
  for (const capture of captures) {
    await page.evaluate(({ position, target, up }) => {
      const { skateGame: game, THREE } = window;
      game.camera.position.set(...position);
      game.camera.up.set(...up);
      game.camera.lookAt(new THREE.Vector3(...target));
      game.renderer.render(game.playScene, game.camera);
    }, capture);
    await page.locator('#game-canvas').screenshot({ path: capture.path });
  }
});
