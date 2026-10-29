# TVHead Skate City — planar wrap-around play city

Date: 2026-10-29

Status: **draft — awaiting user review (hard gate)**.

Handoff (2026-10-29): user requested this documentation revision, then a stop so
**GPT Luna 6** can handle implementation. The user subsequently asked Sol to create
the tasking before switching to Luna. The written plan is now
`docs/superpowers/plans/2026-10-29-planar-wraparound-city-plan.md` (awaiting review);
no planar implementation has been produced. The previous uniform-grid proposal has
been replaced by the irregular, building-shaped route requirements in §2.

Amends `docs/superpowers/specs/2026-10-28-skate-city-playability-and-comic-art-design.md`.
That spec stays approved for Tasks 1–3, the menu/globe, and everything outside post-join
play; this spec supersedes its §1 ("preserve the tiny spherical world") and §8
("do not redesign as a flat top-down map") **for post-join play only**.

## 1. Requested change

User direction (2026-10-29, verbatim): "after you join it's just an ordinary planar world
city in 3d for the player to move around in. it should have a static layout. There should be
no percievable world edges, it should feel like the small planets ability for the player to
move across the map and end up back where they started just by navigating in a single
direction through streets and allyways."

User refinement (2026-10-29): streets and alleys must not be even/uniform; their
dimensions should change as they progress. Alleys should be tighter and have turns
formed by lining up different buildings. The intended feel is an authored, lifelike
city, not equally spaced rectangular blocks with straight gaps painted between them.

Confirmed choices:

- **Globe preview stays.** The pre-join menu keeps the spherical city (radius 32, eight
  Kenney buildings, OrbitControls). Only post-join play is planar.
- Portfolio and 3D Viewer pages are unchanged.
- All human-scale decisions carry over unchanged: `BUILDING_SCALE = 17` (single source in
  `asset-placements.js`), avatar 2.995 units, nominal street width 6.4, ramp lift 0.72, rail deck
  height 0.82, follow-camera distances, stop-not-bail collision response.
  **6.4 is a reference width, not a constant-width requirement.**

## 2. World model

The play world is a **torus**: positions wrap on both horizontal axes.

- `W = D = 256` units (≈ 152 m at 0.594 m/unit). One full lap at maxSpeed 12 takes
  ≈ 21.3 s along a clear straight wrap route; winding routes take longer.
- **Streets:** a hand-authored connected network, not a 4×4 equal-pitch grid. Use
  unequal spacing, offset junctions, short bends, and wider openings near the plaza.
  Width changes along a route: narrow stretches open out, then pinch back down.
  Initial design targets are 5–10 units for ordinary streets, with 6.4 as the nominal
  reference; these ranges are proposed tuning targets, not user-specified measurements.
  Changes must be visibly meaningful, not tiny perturbations of a uniform grid.
- **Blocks:** irregular building clusters and courtyards with unequal footprints.
  Remove the fixed 16-block count, 57.6-square interiors, modulo-selected alley edges,
  and one-alley-per-block rule. Keep a readable connected street network with optional
  narrower shortcuts, not a maze of compulsory dead ends.
- **Alleys shaped by buildings:** offset and line up different full-scale Kenney
  building footprints to create tighter passages, recesses, doglegs, and corners.
  The facing walls define the route's actual boundaries; do not draw a winding strip
  through an otherwise open block and call it an alley. Include at least one connected
  alley route with two or more turns between staggered buildings and visibly different
  widths along its length. Initial clear-width targets are 1.8–3.0 units (≈1.1–1.8 m),
  measured wall-to-wall after collision geometry and props are accounted for. Preserve
  body-radius clearance through corners and playable entrances/exits onto streets.
  Tighter walls may shorten the follow-camera boom; they must not trap the player or
  force camera clipping. Keep the rail/landing line in a locally wider pocket.
- **Route records:** author sampled centerlines with local left/right widths (or
  equivalent explicit boundary polygons), junction connections, and building transforms.
  Width interpolation and turn geometry must not leave gaps, self-intersections, or
  collision/render disagreements. Derive alley clearance from the real transformed
  building bounds rather than a fixed setback from an abstract alley edge.
- **Wrap continuity:** route edges crossing either tile seam must match position,
  heading, height, and left/right widths on the opposite edge. Buildings and props
  must also respect their wrapped neighbors. Preserve at least one unobstructed
  straight wrap corridor in each horizontal direction so sustained travel can return
  to its start without encountering a boundary; the rest of the network can bend.
- **Ramp:** on a suitable straight, clear street segment (not tied to x=128 or a
  grid block). Centerline profile `Y = 0.025 + 0.72·sin(πt)`, t ∈ [0, 1], over a
  64-unit segment — one smooth up-down crest, max lift 0.72. Local street widths
  still vary, with enough room at the ramp and its connected landing line.
- **Rails:** two straight box rails, deck 0.9 wide, length 24, top at Y = 0.82:
  - `rail-0` in a building block's alley;
  - `rail-1` in the water-tower plaza.
- **Buildings:** use all eight Kenney variants (building-a … building-h) at uniform
  scale 17; repeated instances are allowed when needed to form believable enclosing
  frontages. The play city is no longer limited to eight instances or one building per
  block; the menu preview still has eight. Vary alignment, setbacks, and grouping
  without stretching assets. Place buildings on both sides of alley turns; test
  transformed footprints for overlap, including across seams. Replace the old 2.1-unit
  alley setback rule with the clear passage widths above, allowing walls to actually
  enclose the alley. Keep the entire authored street corridor free of building colliders.
- **Water-tower plaza:** a named landmark district, no fixed block coordinate.
  `water-tower` plus `shipping-container-a` ×2 and `detail-tank` ×1 frame an open plaza
  connected to streets and an alley exit.
- **Open spaces:** use irregular yards, recesses, and small prop/tag pockets where the
  building composition leaves room; no fixed seven-open-block allocation.
- **Spawns:** authored safe street-side/courtyard locations plus the plaza default.
  Spawn records carry position, heading, and district/route id, with verified clearance.
- The layout is **static and deterministic** — no runtime randomization. "Seed invariance"
  is tested as: layout output is byte-identical regardless of the seed passed.

## 3. Physics, queries, and torus collision

- The skater position is wrapped into `[0, W) × [0, D)` every step (after integration).
- Constant up `[0, 1, 0]`. Terrain is the Y = 0 plane (replaces the radial
  `groundRadius` fallback). `groundRadius` becomes `groundHeight`, the current support
  height (0 on terrain, 0.025 on ordinary roads, profiled on ramps).
- **Seam correctness:** max per-step travel is `maxSpeed × maxDeltaSeconds = 12 × 0.1 =
  1.2` units, far less than `W / 2 = 128`. So nearest-image logic is exact:
  - Support queries: probe the skater's own cell plus, when within one street-width of a
    seam, the wrapped neighbor — or, equivalently, run the vertical strip projection on
    the unwrapped coordinates.
  - Swept collision: unwrap the start→end segment (add a whole-W offset to the endpoint
    when it crosses the seam), then test the straight segment against the static boxes'
    **nearest images** (each box also duplicated at ±W / ±D only when it lies within the
    segment's inflated bounds). The existing slab segment-vs-AABB test in
    `city-queries.js` is extracted and shared; the response is unchanged
    (`collisionResponse: 'stop'` — halt, never bail on a wall).
- Planning clarification: canonical skater positions wrap; authored seam-crossing
  geometry may use continuous local images (for example X=252…260), with explicit
  whole-tile translations in route links. Support/sweep results stay in the query
  caller's image; wrap only the skater's final state, not camera boom endpoints.
- `SKATER_PHYSICS` (skater-simulation.js) is reused unchanged; the planar skater reuses the
  city tuning values: coastingDrag 0.6, coyoteTimeMs 100, jumpBufferMs 120, bailDurationMs
  500, bodyRadius 0.25, collisionResponse 'stop'.

New modules:

| Module | Responsibility |
|---|---|
| `js/game/core/wrap-math.js` | `wrapScalar(v, span)`, `wrapPosition(p, { width, depth })`, `wrapDelta(a, b, span)` (smallest signed difference), `nearestImage(target, reference, span)`. Pure, unit-tested. |
| `js/game/world/planar-city-layout.js` | `createPlanarCityLayout()` → static authored variable-width routes, irregular building clusters (via `placePlanarCityAssets`), junctions, plaza, ramp, rails, spawns from §2. |
| `js/game/world/planar-city-surfaces.js` | `compilePlanarWorld(layout)` → triangulated variable-width street/alley polygons (Y = 0.025), profiled ramp strip, rail boxes, transformed building colliders, ground plane. One source of truth for both queries and rendering. |
| `js/game/world/planar-city-queries.js` | `queryPlanarSupport(world, point)` — vertical projection onto compiled street/alley/ramp/rail/ground triangles, returns height and the actual surface normal (flat ground up is `[0,1,0]`, ramp normals follow its slope); `sweepPlanarSkater(world, from, to, radius)` — seam-exact swept test via shared slab function, with narrow-corner coverage. |
| `js/game/core/planar-skater.js` | Mirrors `city-skater.js` structure: same modes (grounded / airborne / grinding / bailed), jump buffer, coyote time, bail timer; calls the planar queries; returns state with wrapped position and a finite `supportNormal` in every mode (in air it is `[0, 1, 0]`). |

## 4. Rendering

- **Nine static tile copies.** The play scene contains the city tile at offsets
  `(i·W, j·D)` for `i, j ∈ {−1, 0, 1}`. The skater is always inside tile (0, 0) (position
  is wrapped). Planning clarification: a finite 3×3 array does not cover a far plane
  of 512 by itself. Play uses matching background/ground fog from distance 160 to full
  opacity at 208, before any outer repeated-tile edge; menu rendering is unchanged.
  Verify wide-aspect and seam/corner views. No per-frame tile reparenting or visible seam.
- **Shared geometry, per-tile scenes.** Each tile is built once; the 9 copies share
  `BufferGeometry` (mesh clones, not geometry clones). Imported GLB assets are retained
  9× (once per tile): `game-assets.js` `retain(id)` returns a fresh refcounted scene per
  call and a `THREE.Object3D` has a single parent, so per-tile retention is the supported
  pattern. Texture VRAM is shared (resource refcounts), so the 9× cost is node count, not
  textures — measured in Task 11.
- **Per-material static merge.** Within a tile, static surfaces are merged per material
  with the vendored r137 `THREE.BufferGeometryUtils.mergeBufferGeometries`
  (`lib/game/BufferGeometryUtils.js`, already loaded by skate.html): asphalt, ramp, rail,
  ground, plaza, and compatible building facades are grouped by actual material and
  attribute compatibility. The earlier ≈6 static meshes/tile is an estimate, not an
  acceptance assumption; measure actual imported material/mesh submissions.
- **Dynamic attachments.** Graffiti tags, target markers, and similar per-frame or
  per-interaction objects use `planarCity.attach(object)` / `detach(object)`: the API
  replicates the child into all 9 tiles with the per-tile offset so a tag placed near the
  seam is visible from every side. Repeated attach refreshes changed source transforms
  and children without accumulating copies; callers refresh after presentation updates.
  Source resources remain caller-owned; detach all copies before disposing the source.
- **Draw-call budget** is measured in Task 11: target ≤ 150 draw calls in play mode; if
  the merged layout exceeds it, record actual measurements and optimize compatible
  submissions. If meeting it conflicts with required scenery/contact/readability,
  request a human tradeoff; dropping the merge or hiding neighbors is not acceptance.

## 5. Camera, avatar, and scene composition

- **Follow camera retargeted to planar.** `follow-camera.js` is instantiated only in play
  mode (`main.js` creates it on mode `playing` and drives it in `onFrame`), so retargeting
  cannot affect the menu's OrbitControls preview. Changes: up is the constant `[0, 1, 0]`
  (no surface-frame math); `keepCameraOutsidePlanet` becomes `keepCameraAboveGround`
  (camera y ≥ 0.45, same clearance value); far plane 512; boom/height/shoulder/tuning
  values unchanged. Rebase prior camera/target by the skater's whole-tile wrap offset
  before smoothing, and collision-check the final smoothed boom in its local image.
- **Avatar pose fix.** `applyAvatarPose` currently falls back to
  `gravityUp = normalize3(state.position)` while airborne — wrong on a plane (that is a
  horizontal vector). Planar states carry explicit `gravityUp:[0,1,0]` in every mode
  and a finite `supportNormal` (constant `[0,1,0]` in air). Use explicit surface override,
  then grounded support normal, then explicit gravity up, then radial fallback. This
  preserves spherical airborne behavior even when its state retains an old support normal;
  simply dropping the grounded gate would not preserve that behavior.
- **Two scenes, one renderer.** `previewScene` (spherical city — today's `city-scene.js`
  output) and `playScene` (planar city). The renderer is unchanged; the mode machine
  renders the active scene. `playScene` is built at boot so Join is instant; both scenes
  draw from the same loaded asset set.
- **Session dispatch.** `game-session.js` stays world-agnostic (it is a mode machine).
  `main.js` holds a mutable `activeWorld` reference; the `step` / `resetState` closures
  dispatch on it. `onJoin` switches `activeWorld` to planar **before** `joinLocal`;
  `onLeave` switches back to spherical **before** `leave`, which resets synchronously.
- **`window.skateGame`** keeps `world` / `city` / `layout` pointing at the **menu**
  (spherical) world so existing e2e assertions keep passing, and adds
  `playCity` (planar scene), `playWorld` (compiled planar world), `playScene`, and
  `planarLayout`.

## 6. What stays unchanged

- Menu/globe preview: `city-layout.js`, `city-surfaces.js` (`compileCityWorld`),
  `city-scene.js`, the radial support path of `city-queries.js`, `city-skater.js`, and
  `visible-city.spec.js` assertions (8 buildings, radius 32, `kenney-industrial-v1`).
- Portfolio and 3D Viewer pages.
- Tasks 1–3 deliverables (input ownership, fixed step, session modal/context-loss),
  `skater-simulation.js` integrators, and existing `skate-paths.js` signatures/radial
  behavior. Extend path records with optional constant `gravityUp` for planar samples;
  current `sampleSkatePath` otherwise derives radial up from position.
- `asset-placements.js` keeps `BUILDING_SCALE = 17` as the single source;
  `placePlanarCityAssets` is added beside `placeCityAssets`.
- All input handling (keyboard/mouse, gamepad, touch, router, lifecycle), UI panels,
  customization, and the controls panel.

## 7. Descriptor

`WORLD_DESCRIPTOR` advances to version 3:

```js
{ version: 3, seed: 2026, radius: 32, tuningVersion: 1, planar: { width: 256, depth: 256 } }
```

The menu keeps geometry id `kenney-industrial-v1`; the play world reports
`planar-kenney-v1`. The descriptor version bump is what invalidates cached world records
from the old spherical play world (Task 8 records key off it).

## 8. Test strategy

**New unit files**

| File | Key assertions |
|---|---|
| `tests/unit/wrap-math.test.js` | `wrapScalar`/`wrapPosition` for negative, > span, and exact-span inputs; `wrapDelta` smallest-signed-difference and half-span tie; `nearestImage` picks the closest copy. |
| `tests/unit/planar-city-layout.test.js` | Seed invariance; non-uniform street spacing and measurable within-route width changes; connected districts and shortcuts; an alley with ≥2 building-shaped turns, enclosing walls on both sides, and varying 1.8–3.0-unit clear widths; no building overlap or blocked swept-body corridor, including at wrapped neighbors; seam endpoint position/heading/height/width continuity. |
| `tests/unit/planar-city-surfaces.test.js` | Finite, nondegenerate variable-width triangulation; continuous coverage at width transitions, doglegs, and junctions; compiled boundaries match layout and building clearances; ramp profile and slope normals; ground plane covers [0, W)×[0, D). |
| `tests/unit/planar-city-queries.test.js` | **Seam crossing:** wrapped/unwrapped support and collision equivalence on both axes; narrow-corner wall stops, no tunneling, valid support throughout alley turns and width transitions. |
| `tests/unit/planar-skater.test.js` | **Travel one direction for one lap on each straight wrap corridor returns to its starting position** (within 0.05); separately steer through the authored alley's turns without overlap or bailout; jump/grind/bail behaviors mirror the sphere tests. |

**Retargeted**

- `tests/unit/follow-camera.test.js` → planar: camera y never below 0.45; boom/shoulder
  behavior on flat ground; collision-safe boom shortening and restoration through
  tight alley turns and widening exits.
- `tests/unit/avatar-pose.test.js` → adds: planar airborne state stays upright (up
  `[0, 1, 0]`), grounded uses support normal.
- `tests/e2e/local-skating.spec.js` → play-mode assertions re-scoped to planar
  coordinates (spawn from `playWorld`, camera above ground, movement on planar routes).
- `tests/e2e/city-world.spec.js` → descriptor assertion (line 143) version 2 → 3; the
  menu-layout scene test is unchanged.

**Unchanged:** `tests/e2e/visible-city.spec.js` assertions (menu world); the chase-camera
screenshot it captures now shows the planar city, which is the intended new behavior.

**New e2e file** `tests/e2e/planar-city.spec.js`:

1. Join lands the player at the planar plaza spawn (finite, inside [0, 256)²).
2. Navigate from the plaza onto an authored straight wrap corridor using normal input;
   then sustained forward travel for one lap returns within 0.5 units of the lap start.
   Measure a full 256-unit lap (≈21.3 s at cruising speed; acceleration adds time).
3. Crossing the seam: screenshot captured with the player near x ≈ 0; camera position and
   skater state all finite (no NaN), no visible pop (human check on the capture).
4. Leave returns to the globe preview: menu city still renders its 8 buildings.
5. Traverse a building-enclosed alley with at least two turns and changing widths using
   normal movement input. Capture its entrance, dogleg, and wider exit; inspect for
   lifelike building-defined boundaries, playable clearance, and a non-clipping camera.

## 9. Impact on plan Tasks 4–12

- **Task 4** (steps 1–5 re-scoped to the planar authored content): tag panels on planar
  walls; the launch → rail → landing line on planar streets (rail-0 alley or plaza line);
  the alley loop branch through a building-defined dogleg route. Descriptor version in the step is
  corrected 2 → 3. Reuse `skate-paths.js` math with explicit planar `gravityUp` records.
  Replace uniform-grid fixtures with variable-width routes and building-shaped alley
  turns; author launch/rail/landing clearance against those actual boundaries.
- **Tasks 5 and 6:** mechanics/scoring requirements unchanged; world records and scene
  fixtures move to planar. **Task 8** remains the independent Blender asset task.
- **Task 7:** tags become planar wall-panel decals, replicated 9× via the
  `planarCity.attach` API.
- **Task 9:** adds the `applyAvatarPose` fix from §5 and its test.
- **Task 10:** the visual vignette is a planar street/plaza shot; the
  planet-underside/pole vignette items become menu-only.
- **Task 11:** measures the 9-copy draw-call and node budget (≤ 150 draw-call target;
  measured constraints that conflict require a human tradeoff, not an unmerged waiver).
- **Task 12:** adds the single-direction lap, seam-invisibility, visible street-width
  variation, and tight building-defined alley-turn acceptance items.

The Sol mechanics review gate (Task 5, step 0) and the Task 10 visual vignette approval
remain open human gates, unaffected by this spec.

## 10. Acceptance evidence and human gates

Evidence required before claiming done:

- New unit files (5) green, retargeted files green, full `npm test` (unit + workers +
  e2e) green.
- `planar-city.spec.js` green, including the ~21 s lap return and seam screenshot.
- Screenshots: planar play (street, plaza, rail), seam-crossing frame, and the unchanged
  menu globe — inspected by the user. Also inspect a top-down layout and street-level
  alley-turn sequence: unequal spacing, clear width changes, and enclosing staggered
  buildings must read as a lifelike city rather than a regular grid with cosmetic bends.
- Ledger entry with command + output for each step (SDD process).

Human gates, in order:

1. **This spec** (hard gate — implementation plan is not written until approved).
2. Sol mechanics review (Task 5, step 0) — unchanged.
3. Task 10 visual vignette approval — unchanged.

## 11. Risks

- **9× asset retention memory.** The actual authored asset instances per tile multiply
  across 9 tiles; repeats needed to enclose alleys increase that count. Geometries and
  textures are shared through resource refcounts; retained scene nodes multiply.
  Measure in Task 11 and optimize shared/merged statics if needed without removing
  neighboring scenery or changing alley walls, contacts, or seam continuity.
- **Merged geometry loses per-building object identity** in the play scene. Accepted:
  play-scene tests read the layout records (`planarLayout`), not scene-object bounds; the
  menu's `visible-city.spec.js` bounds assertions are untouched.
- **Seam precision.** Guaranteed by the 1.2-unit per-step bound vs 128-unit half-width;
  covered by the dedicated seam unit tests and the e2e seam screenshot.
- **Irregular passages.** A road mesh alone does not establish a believable alley:
  layout, transformed building colliders, local passage widths, and camera clearance
  must agree. Validate full swept corridors at corners, not just sampled center points.
  More building instances may increase the 9-tile rendering cost; measure actual
  authored instance counts rather than assuming eight buildings or twelve assets/tile.
- **r137 `mergeBufferGeometries` requires matching attribute sets.** Merging is
  per-material and all inputs are position+normal BufferGeometries built by
  `compilePlanarWorld`, so attributes match; index handling is the util's job.
- **Two scenes at boot doubles scene-graph build time.** Both scenes are small (merged
  statics + retained assets); measured at boot in Task 11 alongside the draw-call budget.
- **Spec drift from the 2026-10-28 spec.** This document explicitly enumerates what it
  supersedes (§1, §8 of the old spec) and what it preserves (§6); the plan document is
  amended in place rather than forked.

## 12. Documentation-only handoff to GPT Luna 6

- [x] Record the user's lifelike, changing-width street/alley direction.
- [x] Replace uniform-grid, straight-alley, fixed building-count, and setback rules.
- [x] Align route/surface interfaces, tests, acceptance evidence, and plan references.
- [x] Self-review the revision for conflicting uniform-layout requirements.
- [ ] User review of the revised written spec (existing hard gate remains open).
- [x] Sol: write the re-scoped implementation tasking at
  `docs/superpowers/plans/2026-10-29-planar-wraparound-city-plan.md` (user requested).
- [ ] User reviews the written plan and its planning clarifications.
- [ ] GPT Luna 6: implement the reviewed tasking inline until the city-review gate,
  then continue only under the existing mechanics/visual gates and human approvals.

Stop after this tasking/documentation update. Do not launch another model, write product
code, or begin implementation in this session. The user will hand implementation to GPT Luna 6.
