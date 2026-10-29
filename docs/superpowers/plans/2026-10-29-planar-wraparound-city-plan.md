# Planar Wrap-Around Skate City Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace post-join spherical skating with a static, seamless planar city whose streets change width and whose tight, turning alleys are enclosed by staggered Kenney buildings.

**Architecture:** Keep the spherical menu and add a separately compiled planar world and scene, sharing the asset library and one renderer/session. Pure torus math, authored layout, compiled contact geometry, simulation, camera, and rendering remain separate owners. This plan replaces the unfinished original Task 4; the continuation table below re-scopes original Tasks 5–12 without duplicating their mechanics/art requirements.

**Tech Stack:** Existing JavaScript ES modules, global Three.js r137 and matching vendored addons, Vitest 5 and Playwright. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-10-29-planar-wraparound-city-design.md`, amending `docs/superpowers/specs/2026-10-28-skate-city-playability-and-comic-art-design.md`. Original plan: `docs/superpowers/plans/2026-10-28-skate-city-playability-and-comic-art-plan.md`.

**Status:** Tasking requested by the user; awaiting written-plan review. Implementation is assigned to **Luna**, inline/native, in the existing checkout. No product code was changed while writing this plan. Approval of this plan also confirms the implementation clarifications below; do not mark approval based only on the request to write tasking.

## Global Constraints

- Play world `width = depth = 256`; wrap X/Z into `[0,256)`, preserve Y; gravity up `[0,1,0]`, terrain `Y=0`, ordinary road `Y=0.025`.
- Static authored layout, identical across seed arguments; no random generation. No equal-pitch 4×4 grid or fixed block count.
- Streets vary along their length: proposed local widths 5–10, nominal 6.4. Alleys vary 1.8–3.0 wall-to-wall, with at least one connected route having two building-defined turns. These are design targets, not measurements supplied by the user.
- Use all eight building variants at uniform `BUILDING_SCALE=17`; repeated play-city instances allowed. Avatar 2.995 units, ramp lift 0.72, rail top 0.82, existing follow-camera distances. Menu stays radius 32 with eight buildings.
- Two primary rails: deck width 0.9, length 24, in an alley's widened pocket and the water-tower plaza; keep clear approach/landing space. Ramp profile `0.025 + 0.72*sin(pi*t)` over 64 units.
- Reuse `SKATER_PHYSICS` and `CITY_SKATER_TUNING`: speed 12, acceleration 8, braking 18, turn 2.6, jump 6, gravity 14, max delta 0.1; drag 0.6, coyote 100 ms, jump buffer 120 ms, bail 500 ms, body radius 0.25, default collision `'stop'`.
- Fixed 60 Hz and six-tick/100 ms catch-up remain. Render cannot mutate simulation; no test teleports, injected success events, score injection, or production test-only movement hooks.
- Preserve original portfolio/viewer, OBJ/downloads, controls, asset hash checks, boot retry, context-loss suspension, customization, and public spherical exports.
- Assets/addons remain local and r137-compatible. Nine tile copies share geometry/materials/textures; keep full scenery/contact continuity at seams.
- `WORLD_DESCRIPTOR.version=3`, `planar:{width:256,depth:256}`; menu geometry `'kenney-industrial-v1'`, play geometry `'planar-kenney-v1'`. Do not bump `tuningVersion` until original Task 5.
- Target ≤150 measured draw calls; original twelve-avatar low-quality target still applies in Task 11. DPR ≤1 low/1.5 standard. If constraints conflict, report measurements and seek approval, never weaken acceptance or raise thresholds silently.
- Continue current `feat/tvhead-skate-city` checkout. No push, merge, deploy, unrelated cleanup, or automatic session-model switch. The separately requested Sol mechanics review remains required before Task5. Keep RED/GREEN logs and pending gates in `.superpowers/sdd/2026-10-28-skate-city-playability-and-comic-art-plan/progress.md` (local/ignored).

## Review Focus

1. Diagonal/corner wrapping and objects spanning a seam: no missed wall, doubled contact, or changed support ID (P1/P3).
2. Camera interpolation after crossing 255→0 or 0→255: no full-map pan, wall clipping, or visible tile boundary (P5/P6).
3. Tight doglegs: the actual swept body, not just its center point, clears facing building proxies and can reverse away from a wall (P2/P3/P4).
4. Leave/rejoin while Help, blur, or context loss is active: one correct world reset, no stale input, no wrong-scene avatar (P6).
5. Two scenes, nine tiles, failed boot and attachments: releasing one owner must not dispose shared resources still used by another; cleanup runs once (P5/P6/P7).

---

## Task map and implementation clarifications

**Order:** P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8 (human city review). After approval, continue original Tasks 5–12 using the continuation table. Do not redo completed original Tasks 1–3 or the approved scale correction.

| Owner | Files (paths under `js/game/` unless stated) |
|---|---|
| Torus math | New `core/wrap-math.js`; pure scalar/vector periodic operations. |
| Authored city | New `world/planar-city-layout.js`; extend `world/asset-placements.js`; static routes, clusters, spawns, transforms. |
| Contacts | New `world/planar-city-surfaces.js`, `world/planar-city-queries.js`; export existing `sweepBox` from `world/city-queries.js` without changing its behavior. |
| Skater | New `core/planar-skater.js`; use shared integrators, no radial movement. |
| Render | New `render/planar-city-scene.js`; nine tiles, merge/asset ownership, replicated attachment API. |
| Camera/composition | Modify `render/follow-camera.js`, `render/avatar-pose.js`, `main.js`, `shared/world-config.js`; world/scene dispatch. |
| Authored play content | New `world/tag-targets.js`, `tests/fixtures/skate-line.js`; extend `world/skate-paths.js` for explicit planar up. |
| Tests/evidence | New matching planar unit tests, `tests/e2e/planar-city.spec.js`, `tests/e2e/authored-city.spec.js`, and updates named below. |

Decisions required by the existing code (these clarify, rather than replace, user intent):

- **Geometry representation:** author route cross-sections explicitly as `{center,left,right}` 3D points, with matching left/right heights per section; local width is `distance(left,right)`. Adjacent sections form non-self-crossing quads; explicit junction polygons/triangle indices close joins. This supports asymmetric narrowing and doglegs without guessing constant-width offsets. Author rounded/beveled corner sections with swept-body clearance; do not connect sharp centerline turns with unbounded miters.
- **Coordinates:** physics state is canonical, but route geometry may use a continuous seam-local image (for example X=252…260). Renderer neighbors and queries translate this geometry by whole tile spans. A route never draws a segment straight from 255 to 1 through the tile interior. Stable record IDs identify the same feature in every image; seam links declare integer tile offsets.
- **Query output frame:** support/collision results stay in the caller's local image, even if outside `[0,256)`. Only the skater normalizes its final state. This avoids wrapping a camera boom endpoint back across the map. All query segments must be locally unwrapped and shorter than half a span per horizontal axis.
- **Camera continuity:** store the previous canonical skater position in camera state. Before smoothing, translate prior camera/target by `current - previous - shortestDelta(previous,current)` on X/Z. Then smooth locally and collision-check the final smoothed target→camera boom, not only the desired unsmoothed boom.
- **Finite render coverage:** 3×3 tiles do not cover a far plane of 512 by themselves. Keep play far=512, but use matching background/ground fog with full opacity by distance 208 (start 160), inside the nearest repeated-world outer edge even with the camera offset. This is distant city haze, not a visible boundary. Test seam/corner/wide-aspect views and fail if ground/scenery termination is visible. The globe scene has no added fog.
- **Path up:** current `sampleSkatePath` derives up from `normalize3(point)`; it is not fully planar-ready. Add optional constant `gravityUp` to path records, preserving radial fallback only when absent. Carry this field through compilation.
- **Avatar up:** planar simulation supplies `gravityUp:[0,1,0]` in every mode. Grounded pose uses contact normal; airborne pose uses explicit gravity up. Preserve the existing spherical airborne radial fallback instead of trusting a stale spherical support normal.
- **Budget:** merging compatible geometry is an optimization, not permission to drop neighboring buildings or ignore ≤150. Separate merging by actual material/attribute signatures, preserve maps, and measure the resulting scene; “six materials” is not a guaranteed count.

## Task 1: P1 — Pure periodic coordinate math

**Files:** Create `js/game/core/wrap-math.js`, `tests/unit/wrap-math.test.js`.

**Interfaces:** `wrapScalar(value,span)->number`; `wrapPosition([x,y,z],{width,depth})->[x,y,z]`; `wrapDelta(from,to,span)->number` is signed shortest `to-from`, in `[-span/2,span/2)`; `nearestImage(value,reference,span)->number` is `reference + wrapDelta(reference,value,span)`. Reject nonfinite inputs or nonpositive spans with `RangeError`; do not mutate inputs.

- [x] **1. RED:** Add `wrap_exactNegativeAndMultipleSpans`, `wrap_shortestDeltaAndHalfSpanTie`, `wrap_positionPreservesHeightAndInputs`, `wrap_rejectsInvalidDimensions`.
  ```js
  expect(wrapScalar(-1, 256)).toBe(255);
  expect(wrapScalar(512, 256)).toBe(0);
  expect(wrapDelta(255.8, 0.2, 256)).toBeCloseTo(0.4);
  expect(wrapDelta(0, 128, 256)).toBe(-128);
  expect(nearestImage(1, 255, 256)).toBe(257);
  expect(wrapPosition([-1, 7, 257], { width: 256, depth: 256 })).toEqual([255, 7, 1]);
  expect(() => wrapScalar(1, 0)).toThrow(RangeError);
  ```
- [x] **2. Verify RED:** `npm run test:unit -- tests/unit/wrap-math.test.js`; failed first on missing module, then (after temporary interface stubs) all four behavior tests failed as expected.
- [x] **3. GREEN:** Implement the four pure exports, including positive modulo and deterministic half-span tie.
- [x] **4. Verify GREEN:** Focused command passed; post-commit `npm test`: 175 unit pass, Worker suite empty (exit0), 36 browser pass.
- [x] **5. Commit:** `f0b1581 feat: add deterministic torus coordinate math`.

## Task 2: P2 — Static irregular routes and building-defined alleys

**Files:** Create `js/game/world/planar-city-layout.js`, `tests/unit/planar-city-layout.test.js`; modify `js/game/world/asset-placements.js`, `tests/unit/asset-placements.test.js`.

**Interfaces:** `createPlanarCityLayout({assetManifest,seed}={}) -> layout`; `placePlanarCityAssets(layout,manifest)->layout` beside the existing spherical function; export the existing `BUILDING_SCALE` constant rather than copying 17 elsewhere. A manifest with missing/invalid required bounds throws clearly.

Layout fields: `{width,depth,surfaces,routeGraph,buildings,assetPlacements,rails,spawnPoints,defaultSpawnId,landmarks,launchMarkers,tagTargets}`. `surfaces` route records are `{id,type:'street'|'alley'|'ramp',routeEdgeId,sections:[{center,left,right}]}`; junction/plaza records use `{id,type,vertices,indices}` with explicit nondegenerate triangles. Graph nodes `{id,position}` and edges `{id,from,to,surfaceId,tileOffset:[ix,iz]}` declare seam links. No seed-dependent fields in returned data.

Placements use existing `{id,assetId,position,scale,size,sourceOrigin,axes}` convention: `position` is bottom-center, local up is Y; source-origin correction must honor asymmetric manifest bounds. Buildings retain `{id,position,normal:[0,1,0],size,placement}`. Spawn records `{id,surfaceId,position,forward,routeId}`; `defaultSpawnId='spawn-plaza'`. Include `'spawn-wrap-x'` and `'spawn-wrap-z'` for pure simulation tests, on ordinary unobstructed straight wrap routes; mounted play always uses plaza.

- [x] **1. RED:** Add `layout_isStaticAcrossSeeds`, `layout_hasUnequalStreetSpacingAndVaryingWidths`, `layout_doglegIsEnclosedByDifferentBuildings`, `layout_wrappedNeighborsDoNotOverlap`, `layout_graphAndSafeSpawnsAreConnected`, plus exact seam/patch and manifest validation cases. Check all eight variants at 17×, two containers/tank/tower at plaza, primary rails at 0.82, and width profiles in stated ranges. For every nonconstant street and the showcase alley, `maxWidth-minWidth >= 0.6`; alley has ≥2 turns of ≥45° and distinct staggered building instances on both sides of each leg. Assert actual transformed footprints enclose the passage and clear the radius-0.25 swept corridor, not metadata flags. Compare neighboring tile footprints as well as central ones. Verify ramp sampled lift peaks at 0.745 and seam cross-section endpoints/widths match after declared translation within 1e-6.
  ```js
  expect(createPlanarCityLayout({ assetManifest: manifest, seed: 1 }))
    .toEqual(createPlanarCityLayout({ assetManifest: manifest, seed: 999 }));
  expect(new Set(layout.assetPlacements.filter(p => p.assetId.startsWith('building-'))
    .map(p => p.assetId)).size).toBe(8);
  expect(minShowcaseAlleyClearWidth).toBeGreaterThanOrEqual(1.8);
  expect(maxShowcaseAlleyClearWidth).toBeLessThanOrEqual(3.0);
  expect(showcaseAlleyTurnCount).toBeGreaterThanOrEqual(2);
  expect(overlappingWrappedBuildingPairs).toEqual([]);
  ```
  Both primary wrap streets must vary by at least 0.6 units themselves; the width-change
  test must not pass vacuously because every street was authored constant-width.
- [x] **2. Verify RED:** `npm run test:unit -- tests/unit/planar-city-layout.test.js tests/unit/asset-placements.test.js`; existing spherical assertions stayed green, new layout first failed for its absent module; the wall-anchor regression exposed and fixed a missing-position case.
- [x] **3. GREEN:** Author a fixed coordinate/transform table around real manifest footprints: unequal-spaced wrap corridors, offset connecting streets, a staggered building-enclosed multi-turn shortcut, plaza and irregular yards. Buildings remain at 17×. Keep primary rails and ramp away from seams for the first playable line; city routes cross both seams. Add safe spawns and explicit route connections. Launch/tag arrays remain empty until P7.
- [x] **4. Verify GREEN:** Focused tests passed; full `npm test` → 185 unit passed, Worker suite empty (exit 0), 36 browser passed. Layout has 8 buildings across all 8 variants, alley width 1.9–2.8 with a minimum 0.6-unit facade clearance beyond each route edge, and every wrap street varies by 2.2–2.6 units. Seam cross-sections match after translation within 1e-6; no central or neighboring-tile building overlaps.
- [x] **5. Commit:** `85d51ab feat: author irregular planar streets and enclosed alley turns`.

## Task 3: P3 — Shared planar surfaces, supports and seam-exact sweeps

**Files:** Create `js/game/world/planar-city-surfaces.js`, `js/game/world/planar-city-queries.js`, `tests/unit/planar-city-surfaces.test.js`, `tests/unit/planar-city-queries.test.js`; modify `js/game/world/city-queries.js` only to export `sweepBox`.

**Interfaces:** `compilePlanarWorld(layout)->world` produces `{descriptor,width,depth,surfaces,joins,buildings,rails,spawnPoints,defaultSpawnId,launchMarkers,tagTargets}`. Compiled surfaces follow existing `{id,type,vertices,indices,triangles,bounds}` format; triangles carry `{id,surfaceId,indices,points,normal,tangent,bounds}`. Buildings carry manifest-derived oriented `collision:{type:'box',center,axes,halfExtents}` and world AABB `bounds`; props that block passages also receive colliders. Rails compile through `compileSkatePath` (constant up added in P7).

Route surfaces also retain `routeEdgeId`, `centerline` (section centers) and `widths`
(section left/right distances); polygon patches do not invent a centerline. Compile
rail decks into support triangles at their actual 0.82 top height and 0.9 width,
with stable support IDs connected to the corresponding eligible paths. Retain
`routeGraph` on the compiled world for branch/connectivity consumers.

`queryPlanarSupport(world,position,{maxDrop=2,maxRise=2,previousSurfaceId}={}) -> null|{surfaceId,triangleId,point,gravityUp,surfaceNormal,tangent,clearance}`. Preserve existing 0.02 contact tie tolerance and stable ID tie-break. Ground is a fallback support at Y=0; ramp normals come from triangles, never forced flat. `sweepPlanarSkater(world,from,to,radius=0.25)->{position,blocked,hitId}` mirrors the old return shape in the caller's unwrapped image; invalid input follows the existing safe-return convention.

- [x] **1. RED:** Add `surfaces_variableWidthsAndJunctionsHaveNoGaps`, `surfaces_rampNormalsMatchSlope`, `surfaces_collisionAndManifestTransformsAgree`; `queries_xZAndCornerSeamsMatchUnwrapped`, `queries_translationKeepsSurfaceIdentity`, `queries_bodyClearsDoglegsAndCanBackAway`, `queries_verticalWallSweepAndLandingSupport`, `queries_contactTieKeepsPriorSurface`. Include box straddling X=0, diagonal crossing both seams, from/to outside canonical range, zero movement, radius 0/0.25, and a render/query point on each side of a narrowing. Numerical assertions: bounds gap <0.02, shared-boundary gap <1e-6, triangle area >1e-10, ramp normals nonzero/upward and nonflat on slopes. Initial-overlap escape must be allowed; moving farther into a wall must be blocked.
  ```js
  expect(seamHit.hitId).toBe(translatedHit.hitId);
  expect(seamHit.blocked).toBe(true);
  expect(Math.abs(seamHit.position[0] - (translatedHit.position[0] - 256))).toBeLessThan(1e-6);
  expect(queryPlanarSupport(world, [40, 0, 40])?.gravityUp).toEqual([0, 1, 0]);
  expect(maxPhysicalVisualBoundsGap).toBeLessThan(0.02);
  ```
- [x] **2. Verify RED:** The focused command first failed on absent planar exports (after correcting a test syntax error); the new suites then failed on missing planar behavior before implementation.
- [x] **3. GREEN:** Triangulate adjacent authored sections and explicit junction patches consistently. Query projected XZ triangle interiors and vertical height in relevant periodic images. Unwrap each sweep endpoint with shortest deltas; translate box centers, not axes, into every image intersecting the radius-expanded local segment bounds. Reuse exported `sweepBox`, earliest progress, and deterministic hit-ID ties. Bound image enumeration using geometry bounds; seam-crossing geometry remains in its authored local image. Queries return local, not wrapped, contact points.
- [x] **4. Verify GREEN:** Focused planar plus spherical surface/skater tests passed (38 total); full `npm test` → 193 unit passed, Worker suite empty (exit 0), 36 browser passed. Compiled 17 surfaces/112 triangles, 7 joins, 8 building boxes, 4 prop boxes, and 2 support decks. Manifest-derived visual/collision AABBs agree within 0.02 (measured maximum 0); seam/corner image tests, radius 0/0.25 sweeps, ramp normals, rail support, contact ties and dogleg back-away all pass.
- [x] **5. Commit:** `14f9478 feat: compile planar contacts and periodic collision queries`.

## Task 4: P4 — Planar fixed-step skating with existing tuning

**Files:** Create `js/game/core/planar-skater.js`, `tests/unit/planar-skater.test.js`; extend `tests/unit/avatar-pose.test.js`, modify `js/game/render/avatar-pose.js`.

**Interfaces:** `createPlanarSkater(world,spawnId?)->state`; `stepSkaterOnPlanarCity(state,rawInput,deltaSeconds,world,tuningOverrides={})->{state,events}`. Keep existing city-state fields/event shapes except `groundRadius` becomes `groundHeight` (current supporting height, including roads/ramps); add constant `gravityUp`. Position wraps only after local sweep/support/landing resolution. In air, `supportNormal` and `gravityUp` both remain `[0,1,0]`; grounded `supportNormal` is the triangle normal. Keep mode/tick/session/spawn semantics and immutable input/world behavior. Do not implement new automatic launch, capture or balance here.

- [x] **1. RED:** Added the listed planar-skater/avatar cases plus `skater_groundApproachCannotSnapToUnconnectedRail`. Four real-corridor laps run 1280 steps at 1/60 from speed 12; tests cover jump 6/gravity 14, buffer 120/121 ms, coyote 100/101 ms, collision stop vs 500 ms bail, invalid deltas and 0.1-second cap, immutable frozen values, safe recovery, and event IDs/ticks. Dogleg navigation uses throttle/brake/steer and sweeps the real compiled colliders. Avatar airborne at `[200,3,40]` must stay world-up; spherical airborne with stale support remains radial.
- [x] **2. Verify RED:** `npm run test:unit -- tests/unit/planar-skater.test.js tests/unit/avatar-pose.test.js`; initial run failed on the missing planar-skater module and the avatar's radial-up behavior for explicit planar gravity.
- [x] **3. GREEN:** Reused shared speed/turn/vertical integrators with constant up, planar XZ displacement, support-height landing, and periodic sweeps. Preserved wall-stop gravity and invalid-state recovery semantics without sphere transport/radial-height math. Grounded support's upward step is capped at 0.5 units. Pose priority is explicit surface override, grounded contact normal, state gravityUp, then radial fallback. Existing trick event behavior remains untimed; no automatic launch/capture/balance was added.
- Grounded support's allowed upward step is 0.5 units; the normal per-step ramp rise is smaller. A ground-level skater cannot snap onto the unconnected 0.82-high rail deck and bypass Task5's airborne/explicit-support capture rules.
- [x] **4. Verify GREEN:** Focused P4 tests: 12 passed; existing spherical city-skater/simulation tests: 29 passed. Full `npm test` → 202 unit passed (25 files), Worker suite empty (exit 0), 36 browser passed. Four laps returned within 0.005 of their starting coordinates; dogleg traversal completed without a blocked sweep; rail approach remained on ground support.
- [x] **5. Commit:** `4f76df9 feat: add planar skating with periodic movement and upright poses`.

## Task 5: P5 — Nine-tile rendering and explicit shared ownership

**Files:** Create `js/game/render/planar-city-scene.js`, `tests/unit/planar-city-scene.test.js`, `tests/e2e/planar-render.spec.js`; extend `tests/unit/game-assets.test.js` for simultaneous preview/play retention.

**Interfaces:** `createPlanarCityScene(THREE,layout,world,assets)->THREE.Group` with methods `attach(object)->object`, `detach(object)->void`, `dispose()->void`. This `attach` means replicated attachment, **not** Three's transform-preserving `Object3D.attach`; implement/document the override explicitly. Root owns nine child tile groups at `(ix*256,0,iz*256)` with `userData.tileOffset=[ix,iz]`. Attach takes a canonical world-positioned object, creates one transform-preserving node clone per tile, shares its geometry/materials, tracks clones by original identity, and is idempotent. Detach removes all clones; source attachment resources remain caller-owned. Do not use this API for the single playable avatar; place that in the play scene separately.

Repeated attach refreshes changed source transforms/children without accumulating
copies; unchanged calls are no-ops. Presenters call attach again after modifying their
source group. Extend the attachment test by moving/adding/removing a source child and
refreshing it: all 9 copies must reflect the change without extra live nodes or shared
source-resource disposal. This is the update contract used by original Task7.

- [x] **1. RED:** Added the five named unit/asset cases and a standalone WebGL test. Initial unit and browser runs failed on the missing planar renderer module. After implementation, the tightened partial-build test also failed as intended: an intermediate normalized geometry survived a later retained-asset failure.
- [x] **2. Verify RED:** `npm run test:unit -- tests/unit/planar-city-scene.test.js tests/unit/game-assets.test.js` and `npm run test:e2e -- tests/e2e/planar-render.spec.js` both showed the missing module before implementation. The standalone browser fixture constructs/disposes its own scene and restores the asset retain method; the mounted player is not changed.
- [x] **3. GREEN:** Built the nine 256×256 tile groups, merged real retained static GLB meshes per material and surface/ramp/rail geometry, preserved source-origin/placement transforms and material maps, and shared merged geometry across tiles. Retained each asset instance per tile and release on success/failure without disposing library-owned resources. Replicated attach/detach is idempotent, refreshes changed source transforms/children, and leaves caller resources untouched. Explicit geometry ownership now disposes intermediates and final merged geometry exactly once on rollback or scene disposal.
- [x] **4. Verify GREEN:** Focused unit tests 9/9 and standalone real-asset WebGL test 1/1. Full `npm test`: 207 unit tests passed (26 files), Worker suite empty (exit 0), 37 browser tests passed. Browser confirmed real building bounds and west-tile image both match compiled bounds within 0.02; rendered 108 retained asset instances / 171 imported batch mesh instances. Measured central view: 5 draw calls, 3,190 triangles; seam view: 4 calls, 416 triangles (well below 150). Captured `artifacts/skate-progress/planar-city-render.png`.
- [x] **5. Commit:** `215e57c feat: render shared periodic city tiles and replicated attachments`.

## Task 6: P6 — Seam-continuous camera and Join/Leave scene composition

**Files:** Modify `js/game/render/follow-camera.js`, `js/game/main.js`, `js/game/shared/world-config.js`, `tests/unit/follow-camera.test.js`, `tests/unit/shared-contracts.test.js`, `tests/e2e/local-skating.spec.js`, `tests/e2e/city-world.spec.js`; create `tests/e2e/planar-city.spec.js`. Extend `tests/e2e/game-assets.spec.js` for two-scene retry/cleanup. Preserve `tests/e2e/visible-city.spec.js` menu assertions.

**Interfaces:** Existing `createFollowCameraState(skater,world,viewport)` / `updateFollowCamera(previous,skater,cameraInput,world,deltaSeconds,viewport)` become planar play-only. Camera state adds `lastSkaterPosition`; keep old public fields, use constant up and `groundClearance=0.45` in place of `planetClearance`. Retain tuning values, right-stick look, responsive shoulders, zoom, restoration smoothing. Collision can shorten actual boom below requested `minBoomLength=3`; never force a camera through an alley wall to honor a zoom preference.

`startSkateGame` keeps `city/world/layout/scene` pointing at the menu objects, adds `playCity/playWorld/playScene/planarLayout`; `skaterState/cameraState` remain live read-only aliases. `render()` chooses an internal activeScene; never reassign the public menu scene to disguise planar assertions. Reuse one avatar, reparented between menu city and play scene at mode transitions; retain customization and one cleanup owner. An `activeWorld` selector controls both reset factory and step closure; paused mode remains planar.

- [x] **1. RED tests added:** Added the camera seam/collision/clearance unit tests and the five mounted planar composition, lap, cleanup, pause and wide-aspect E2E cases. Existing input/device and preview assertions remain active.
- [ ] **2. Verify RED:** The pre-P6 comparison against spherical play was not reproduced after this session resumed with the P6 implementation already present. No RED result is claimed; the GREEN gates were run fresh.
- [x] **3. GREEN camera:** Implemented prior-frame rebase using `lastSkaterPosition`, local unwrapped camera coordinates, periodic collision queries, immediate collision shortening, collision-free boom restoration, and ground clearance. Constant up is used in planar play.
- [x] **4. GREEN composition:** Built separate preview and planar scenes sharing asset ownership; selectors switch before Join/Leave reset operations and roll back on failure. Preview pointers and camera settings restore on Leave; planar descriptor v3, 512 far plane and 160–208 fog are covered.
- [x] **5. Verify GREEN:** Focused camera/contracts 16/16; planar mounted E2E 5/5; existing skating/city/visible-city/assets E2E 16/16; final `npm test`: 210 unit passed, Worker suite empty (exit 0), 42 browser passed. Laps traversed ≥256 units on both axes with camera/target offset jumps <0.5. Captures: X seam, Z seam, 390×844 portrait, 844×390 landscape, and wide corner; inspected repeated-world roads against matching fog/background. Evidence summary: `.superpowers/sdd/2026-10-29-planar-wraparound-city-plan/task-6-tests.log`.
- [x] **6. Commit:** Stage only P6 files; `git commit -m "feat: switch joined play to a seamless planar city"`.

## Task 7: P7 — Finish original Task 4's canonical paths, launch records and tag targets

**Files:** Modify `js/game/world/skate-paths.js`, `tests/unit/skate-paths.test.js`, `js/game/world/planar-city-layout.js`, `js/game/world/planar-city-surfaces.js`, `js/game/render/planar-city-scene.js`; create `js/game/world/tag-targets.js`, `tests/unit/tag-targets.test.js`, `tests/fixtures/skate-line.js`, `tests/e2e/authored-city.spec.js`.

**Interfaces:** Keep `compileSkatePath`, `sampleSkatePath`, `projectSkatePath` signatures. Optional path `gravityUp:[0,1,0]` is normalized/validated during compile; sample returns it instead of radial up when present, preserving legacy radial tests. Paths keep stable id, type`rail|pipe|ledge`, points/lengths/bounds and optional `connectedSupportIds`; primary rail dimensions remain unchanged. Author one accessible pipe and ledge example as required by original Task4, distinct from the two primary rails.

Launch marker: `{id,supportId,point,normal,tangent,halfWidth,halfHeight,direction}` in an unwrapped local image; `normal` is the directed crossing-plane normal, `tangent` is forward travel, `direction:1` means permitted negative→positive plane crossing. No automatic launch implementation in P7. Author a smooth-crest exit/ledge line with enough launch/capture/landing clearance at planned thresholds; do not assume a marker on any crest automatically proves that trajectory.

Tag target: `{id,triangles:[{id,points}],frame:{origin,right,up,normal},polygon}` with polygon vertices in frame-local2D; anchors `{targetId,triangleId,barycentric:[u,v,w]}`. `resolveTagAnchor(world,anchor)->null|{point,normal}` reconstructs canonical point; reject missing targets/triangles, nonfinite/negative weights or sum error>1e-6. `findTagTarget(world,skater,{maxReach=2}={})->null|{anchor,point,normal}` finds the nearest visible reachable point in the skater's nearest tile image, not merely a panel centroid. Use planar collision/triangle occlusion, true wall normals and stable ties. Leave grounding/cooldown/tag-cap rules to original Task7.

`tests/fixtures/skate-line.js` exports `createSkateLineFixture({assetManifest})->{layout,world,spawnId,lineIds}` using the production compiler and fixed authored records; lineIds identifies lip/path/landing/branch/panel. Unit tests may start from fixture spawns. Mounted browser tests must use ordinary default boot or select a genuine fixture via factory before startup, never teleport an already mounted player.

- [x] **1. RED:** Added `paths_planarUpDoesNotBecomeRadial`, `world_branchTurnsAndRejoins`, `world_launchRailLandingHasSweptClearance`, `tagTargets_wallNormalAndBarycentricRoundTrip`, `tagTargets_rejectsOccludedFarSideAndInvalidAnchor`, and `tagTargets_seamImageUsesRealReach`. Tests cover planar up at non-origin coordinates and legacy radial behavior; reach 1.999/2/2.001; box and triangle occlusion; nearest edge of a large panel; missing triangles and malformed weights; candidate launch at speed 3/upward 4/gravity 14; capture within 0.8/alignment ≥0.65; radius-0.25 swept clearance and safe support landing.
  ```js
  expect(sampleSkatePath(planarPath, 5).gravityUp).toEqual([0, 1, 0]);
  expect(findTagTarget(occludedWorld, skater, { maxReach: 2 })).toBeNull();
  expect(resolveTagAnchor(world, { ...anchor, barycentric: [2, -1, 0] })).toBeNull();
  expect(branchRejoinsMainRoute).toBe(true);
  expect(launchTrajectoryBlocked).toBe(false);
  ```
- [x] **2. Verify RED:** The focused unit command failed on absent planar-up, branch, launch and tag-target behavior (and missing `tag-targets.js`). The first authored-city E2E RED read the menu `layout` instead of `planarLayout`; that result is not claimed as a valid E2E RED. The corrected mounted test uses the actual planar layout and passes GREEN.
- [x] **3. GREEN:** Added constant-up compiled paths, directed launch marker, accessible ledge and pipe paths, a turning dogleg branch that reconnects to the east route, and two compiled container/alley wall panels. Rendering uses the same world records and replicates panels/markers to nine tiles. Added validated barycentric anchors, nearest visible surface points, front-face normals, triangle/box line of sight and periodic blocker checks. No automatic launch or tag gameplay was added. `world.rails` contains primary and authored eligible paths without duplicate path-distance records.
- [x] **4. Verify GREEN:** Focused path/tag/layout/surface/scene tests 24/24; authored-city E2E 1/1; planar/local-skating/visible-city E2E 16/16. Fresh full `npm test`: 218 unit tests passed (27 files), Worker suite empty (exit 0), 43 browser tests passed. Renderer measured 108 retained asset instances / 171 imported mesh instances; center 6 draw calls / 3,442 triangles, seam 4 / 448. Captures inspected: `artifacts/skate-progress/planar-near-spawn-line.png`, `planar-dogleg-line.png`, `planar-tag-panel-normals.png`.
- [x] **5. Commit:** `feat: author planar skate lines and validated wall targets`.

## Task 8: P8 — Integrated evidence and human city-review gate

**Files:** Extend `tests/e2e/planar-city.spec.js`, `tests/manual/device-matrix.md`; create `tests/manual/planar-city-review.md`; update this plan and the local ledger with evidence, not assumed approval.

**Interfaces:** Production game/input/world APIs only. No new gameplay hook. This closes the replacement city milestone, not the entire twelve-task game plan.

- [x] **1. RED:** Added `planarCity_tightAlleyTurnsRemainPlayable`, `planarCity_sceneSwitchKeepsCustomizationAndNoStaleJump`, and `planarCity_seamSupportAndCameraStayContinuous`. They use mounted gamepad/keyboard input without pose/event mutation and audit support, swept clearance, customization and stale-jump reset. Existing gamepad ownership/lifecycle tests remain in place.
- [x] **2. Verify RED:** The mounted planar-city spec passed 8/8 with one worker, so no missing production behavior was reproduced. A default-worker full run exposed two test-only timing failures: the lap trace omitted movement before its first animation-frame sample, and the jump-buffer observer could miss its transient state. Both passed alone and failed under contention; the sampling issues were corrected in tests, not production behavior.
- [x] **3. GREEN corrections:** No production gaps were confirmed. Seeded the camera-wrap trace from a synchronous initial sample and changed the jump-buffer observer to 10 ms polling so the integration assertions do not miss their state window under worker contention.
- [x] **4. Verify:** `npm test` passed: 218 unit tests (27 files), worker suite empty with accepted exit 0, and 46 browser tests (default four workers). Build, changed-JS syntax, diff check and the local asset check passed (12 assets verified). Ignored captures plus actual renderer/fog/far/resource-release metrics are indexed in `tests/manual/planar-city-review.md` and `artifacts/skate-progress/planar-city-verification.json`. Historical 171-unit/36-browser counts are context only.
- [ ] **5. Commit:** Stage changed owner tests/docs only; `git commit -m "test: verify planar city traversal and review evidence"`.
- [ ] **6. HUMAN GATE — STOP:** Present the captures and `tests/manual/planar-city-review.md` to the user. Ask whether the changing widths, tight building-defined turns, human scale and seamless travel now feel right. Do not mark city approval or proceed into new mechanics until the user has reviewed it. Physical controller/phone/full-lap acceptance stays pending unless actually performed.

## Continuation: original Tasks 5–12 (after city approval)

The original plan retains its numbered RED/GREEN steps, numerical rules, file owners and review requirements except for these explicit substitutions. This table is part of the implementation tasking, not permission to skip an original task. Update its checkboxes only when the re-scoped behavior is verified.

| Original task | Required re-scope and additional verification |
|---|---|
| **5 — launch/grind/balance** | First arrange the requested read-only **GPT Sol mechanics review** of Genex reference/spec §§4–5. This planning work is **not** that review. Record it; substantive behavior changes go to the human. Modify `core/planar-skater.js`, not spherical `city-skater.js`; unit command substitutes `tests/unit/planar-skater.test.js`. `stepLaunch`/`stepGrind` consume the local unwrapped motion sweep and P7 constant-up paths; wrap only final pose, never a path-distance interpolation. Add `grind_planarUpAndSeamAdjacentSweepRemainContinuous` and `launch_markerImageFiresOnlyOnce`: opposite seam images keep one marker/path ID and one event. Retain speed3/up4 launch, capture2/0.8/0.65, cooldown150 ms, deterministic balance defaults and tuningVersion2; test exact existing thresholds and keyboard/pad/touch mounted line. Do not mark a generic inherited `grinding` mode as automatic capture completion. |
| **6 — tricks/chain/HUD** | `createLocalPlayState(world,spawnId)` calls `createPlanarSkater`; `stepLocalPlay` calls planar motion/launch/grind. Keep `.combo` in one authoritative fixed-tick state. Main's active-world reset dispatch must use local-play factory in play and spherical factory in preview. Add `combo_wrapCrossingDoesNotDuplicateOrResetActions`: real travel across a seam neither banks nor loses points nor duplicates grind events. Keep all original trick300 ms, score, dedup/link1500/1501 boundaries and HUD mobile assertions. |
| **7 — graffiti/emotes** | Use P7 planar triangle anchors/visibility; render each local mark/eligible marker through `playCity.attach` and remove through `detach` before source disposal. `createSocialScene` keeps its original group/update/dispose contract; main attaches that owned group once for replication, and presentation must synchronize recreated children rather than relying on stale one-time deep clones (detach/re-attach after bounded geometry changes, or update mapped clones). Add `socialScene_seamCopiesShareTagIdentityAndExpireTogether`: one local tag counts once, nine visible images, same clip/panel normal, expiry removes all9, deleting one tag does not dispose peer textures. Include wall near seam, occluded dogleg and nearest-panel-edge reach. Maintain reach2, cooldown2000, cap10, expiry300000, emote2000 and Leave clears all. |
| **8 — Blender rig** | No world-layout rewrite: execute original offline author/export/check task unchanged, preserving reference and all bones/clips/triangle budgets. It does not require new world records. Unit asset checks and committed `.blend`/`.glb` remain required; do not substitute primitive animation for a real skinned asset. |
| **9 — animated avatar** | P4 already owns explicit planar-air up; integrate the new rig beneath that contact root without reintroducing radial logic. Preview uses sphere pose; play uses planar gravity/contact frames. Add `avatar_planarJumpAndRampKeepRootUpright` and `avatar_joinLeaveReparentsOneRoot`: root orientation remains right through jump/turn/seam/ramp, model-only tricks never rotate camera/physics, customization and independent skeleton/material disposal still pass. No9× avatar duplication. |
| **10 — comic art** | Convert/style `render/planar-city-scene.js` as well as menu city, maintaining actual imported material maps and shared tile ownership. Replace play-mode underside/pole acceptance with street, enclosed dogleg, plaza and seam views; underside/pole remain menu-only checks. Build one planar street/plaza/TVHead vignette, then **STOP for the original human visual gate before expanding dressing**. Include narrow-alley contrast/readability and fog/background consistency; no mandatory shake/FOV cuts. |
| **11 — measured budgets** | Include both scenes' lifetime and9-tile merged statics, attachment clones, real authored building count, skinned avatar, outlines and effect submissions. Test low/standard toggles and100 create/appearance/cap/leave cycles. Add `resources_periodicSceneDisposalPreservesPreviewAndPeers`; record actual draw calls with12 visible base avatars (≤150 target) and sparse comparison. Do not use the old assumed six meshes/tile, unmerged fallback, or center-tile-only scenery as acceptance. If measured art constraints conflict, stop for a human tradeoff with measurements. |
| **12 — final acceptance** | Run original full input→launch/grind/balance/trick/landing/tag/emote/Help/Leave sequence on planar streets, plus one-direction laps both axes/directions, narrowing street, multi-turn building alley and seamless corner crossing. Verify Leave's unchanged globe and original portfolio/viewer navigation. Include actual city-review and Task10 approvals; keep physical Windows Firefox/Steam Controller/Chrome comparison/real phone/hands-off-camera laps explicitly pending when unavailable. Request final whole-branch review; no push/PR/merge/deploy without permission. |

## Human gates and execution handoff

- [ ] **Gate A (now):** User reviews this written tasking and its implementation clarifications. Native/inline execution is already selected; next implementation session uses Luna. User controls the model switch; this session does not launch another model.
- [ ] **Execution preflight:** Luna loads `executing-plans`, confirms current checkout and clean/unrelated changes, reads both specs + this plan + continuation source, and runs fresh `npm test` before P1. If baseline is red, diagnose and record it instead of attributing it to this work.
- [ ] **Gate B (P8):** Human reviews the playable irregular city and seam captures; stop there before continuation.
- [ ] **Mechanics review (original Task5 step0):** Required Sol read-only review; human review if findings require a design change.
- [ ] **Gate C (original Task10):** Human approves representative comic vignette before art expansion.
- [ ] **Gate D:** Human resolves any measured budget/design conflict or unavailable physical acceptance; no invented approvals.

**Self-review:** Spec §§1–3 → P1–P4; §4 → P5/P6; §5 → P4/P6; §§6–7 → P2/P6; §§8–10 → P7/P8 and continuation table; §11 risks → P3/P5/P6 and Task11. All five Review Focus conditions have named owner tests. Interfaces consistently use local-image query outputs, canonical final skater state, explicit planar up, and preserved spherical/menu exports. Remaining gates are unchecked deliberately. This document is tasking, not evidence that any new feature/test has been implemented or passed.
