# TVHead Skate City — planar wrap-around play city

Date: 2026-10-29

Status: **draft — awaiting user review (hard gate)**.

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

Confirmed choices:

- **Globe preview stays.** The pre-join menu keeps the spherical city (radius 32, eight
  Kenney buildings, OrbitControls). Only post-join play is planar.
- Portfolio and 3D Viewer pages are unchanged.
- All human-scale decisions carry over unchanged: `BUILDING_SCALE = 17` (single source in
  `asset-placements.js`), avatar 2.995 units, street width 6.4, ramp lift 0.72, rail deck
  height 0.82, follow-camera distances, stop-not-bail collision response.

## 2. World model

The play world is a **torus**: positions wrap on both horizontal axes.

- `W = D = 256` units (≈ 152 m at 0.594 m/unit). One full lap at maxSpeed 12 takes
  ≈ 21.3 s — a "small planet" lap feel at street speed.
- **Streets:** a 4×4 primary grid, width 6.4, centerlines at 0 / 64 / 128 / 192 on both
  axes. The axis-0 street (centerline 0) straddles the seam; it is authored as two wrapped
  halves so all authored geometry stays finite inside [0, W) × [0, D).
- **Blocks:** 16 blocks, interior 57.6 × 57.6 each. Every block has one **alley**, width
  3.6, running the block's full length along one interior edge. Edge chosen by
  `(blockX + blockZ) % 4` → 0 W, 1 N, 2 E, 3 S; alley centerline 3.9 units in from that
  edge. Alleys are the "allyways" of the request: they give every block a second,
  narrower route parallel to one primary street.
- **Ramp:** on the x=128 primary street, the z ∈ [128, 192] segment (64 long). Centerline
  profile `Y = 0.025 + 0.72·sin(πt)`, t ∈ [0, 1] — one smooth up-down crest, max lift 0.72.
- **Rails:** two straight box rails, deck 0.9 wide, length 24, top at Y = 0.82:
  - `rail-0` in a building block's alley;
  - `rail-1` in the water-tower plaza.
- **Buildings:** the eight Kenney variants (building-a … building-h), one each, placed on
  the side of the alley **opposite** the block's alley edge. Largest across-alley span is
  building-c at 17× (35.8 units); every placement keeps ≥ 2.1 clearance to the alley
  centerline plus half alley width, and ≥ 1.2 to any street centerline minus half street
  width. The unit test asserts these clearances.
- **Water-tower plaza:** block (1,1). Landmark `water-tower` plus `shipping-container-a`
  ×2 and `detail-tank` ×1, arranged as an open plaza (no building).
- **Open blocks:** the remaining 7 blocks without buildings take sparse props
  (`chimney-basic`, `detail-tank`) and are the tag/graffiti surfaces for Task 7.
- **Spawns:** one spawn per block (street-side) plus one in the plaza; default spawn is the
  plaza. Spawn records carry position, heading, and block id.
- The layout is **static and deterministic** — no runtime randomization. "Seed invariance"
  is tested as: layout output is byte-identical regardless of the seed passed.

## 3. Physics, queries, and torus collision

- The skater position is wrapped into `[0, W) × [0, D)` every step (after integration).
- Constant up `[0, 1, 0]`. Terrain is the Y = 0 plane (replaces the radial
  `groundRadius` fallback). `groundRadius` becomes `groundHeight = 0`.
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
- `SKATER_PHYSICS` (skater-simulation.js) is reused unchanged; the planar skater reuses the
  city tuning values: coastingDrag 0.6, coyoteTimeMs 100, jumpBufferMs 120, bailDurationMs
  500, bodyRadius 0.25, collisionResponse 'stop'.

New modules:

| Module | Responsibility |
|---|---|
| `js/game/core/wrap-math.js` | `wrapScalar(v, span)`, `wrapPosition(p, { width, depth })`, `wrapDelta(a, b, span)` (smallest signed difference), `nearestImage(target, reference, span)`. Pure, unit-tested. |
| `js/game/world/planar-city-layout.js` | `createPlanarCityLayout()` → the static table from §2: streets, alleys, blocks, building placements (via `placePlanarCityAssets`), plaza, ramp, rails, spawns. |
| `js/game/world/planar-city-surfaces.js` | `compilePlanarWorld(layout)` → surfaces: flat street/alley quads (Y = 0.025), ramp strip (profiled), rail boxes, building AABBs, ground plane. One source of truth for both queries and rendering. |
| `js/game/world/planar-city-queries.js` | `queryPlanarSupport(world, point)` — vertical strip projection onto street/alley/ramp/rail/ground, returns height + normal (normal is `[0,1,0]` everywhere); `sweepPlanarSkater(world, from, to, radius)` — seam-exact swept test via shared slab function. |
| `js/game/core/planar-skater.js` | Mirrors `city-skater.js` structure: same modes (grounded / airborne / grinding / bailed), jump buffer, coyote time, bail timer; calls the planar queries; returns state with wrapped position and a finite `supportNormal` in every mode (in air it is `[0, 1, 0]`). |

## 4. Rendering

- **Nine static tile copies.** The play scene contains the city tile at offsets
  `(i·W, j·D)` for `i, j ∈ {−1, 0, 1}`. The skater is always inside tile (0, 0) (position
  is wrapped), so the 3×3 array always covers the frustum at any camera distance — no
  per-frame reparenting, no visible seam.
- **Shared geometry, per-tile scenes.** Each tile is built once; the 9 copies share
  `BufferGeometry` (mesh clones, not geometry clones). Imported GLB assets are retained
  9× (once per tile): `game-assets.js` `retain(id)` returns a fresh refcounted scene per
  call and a `THREE.Object3D` has a single parent, so per-tile retention is the supported
  pattern. Texture VRAM is shared (resource refcounts), so the 9× cost is node count, not
  textures — measured in Task 11.
- **Per-material static merge.** Within a tile, static surfaces are merged per material
  with the vendored r137 `THREE.BufferGeometryUtils.mergeBufferGeometries`
  (`lib/game/BufferGeometryUtils.js`, already loaded by skate.html): asphalt, ramp, rail,
  ground, plaza, and building facades group into ≈ 6 static meshes per tile
  (≈ 54 across the 9 tiles).
- **Dynamic attachments.** Graffiti tags, target markers, and similar per-frame or
  per-interaction objects use `planarCity.attach(object)` / `detach(object)`: the API
  replicates the child into all 9 tiles with the per-tile offset so a tag placed near the
  seam is visible from every side.
- **Draw-call budget** is measured in Task 11: target ≤ 150 draw calls in play mode; if
  the merged layout exceeds it, the fallback is dropping the merge (with the measurement
  recorded in the ledger) — not culling, which would reintroduce seam pop.

## 5. Camera, avatar, and scene composition

- **Follow camera retargeted to planar.** `follow-camera.js` is instantiated only in play
  mode (`main.js` creates it on mode `playing` and drives it in `onFrame`), so retargeting
  cannot affect the menu's OrbitControls preview. Changes: up is the constant `[0, 1, 0]`
  (no surface-frame math); `keepCameraOutsidePlanet` becomes `keepCameraAboveGround`
  (camera y ≥ 0.45, same clearance value); far plane 512; boom/height/shoulder/tuning
  values unchanged.
- **Avatar pose fix.** `applyAvatarPose` currently falls back to
  `gravityUp = normalize3(state.position)` while airborne — wrong on a plane (that is a
  horizontal vector). Planar states always carry a finite `supportNormal` (constant
  `[0, 1, 0]` in air), so the `mode === 'grounded'` gate on `contactNormal` is dropped: a
  finite `surfaceNormal`/`state.supportNormal` always wins, and the radial fallback is
  only reached for spherical states (which keep today's behavior exactly).
- **Two scenes, one renderer.** `previewScene` (spherical city — today's `city-scene.js`
  output) and `playScene` (planar city). The renderer is unchanged; the mode machine
  renders the active scene. `playScene` is built at boot so Join is instant; both scenes
  draw from the same loaded asset set.
- **Session dispatch.** `game-session.js` stays world-agnostic (it is a mode machine).
  `main.js` holds a mutable `activeWorld` reference; the `step` / `resetState` closures
  dispatch on it. `onJoin` switches `activeWorld` to planar **before** `joinLocal`;
  `onLeave` switches back to spherical.
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
  `skater-simulation.js` integrators, `skate-paths.js`.
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
| `tests/unit/planar-city-layout.test.js` | Seed invariance (output identical for any seed); street/alley clearances per §2; every block reachable from every other via the street+alley graph (connectivity); building clearances ≥ 2.1 (alley) and ≥ 1.2 (street). |
| `tests/unit/planar-city-surfaces.test.js` | Compiled surfaces all finite; ramp centerline matches `0.025 + 0.72·sin(πt)` at sample t; ground plane covers [0, W)×[0, D). |
| `tests/unit/planar-city-queries.test.js` | **Seam crossing:** support height and swept-collision results are identical for a skater crossing x = W/0 and z = D/0 (same query in unwrapped and wrapped coordinates). |
| `tests/unit/planar-skater.test.js` | **Walk one direction for one lap of fixed steps returns to the spawn position** (wrapped position within 0.05 of start); jump/grind/bail behaviors mirror the sphere tests. |

**Retargeted**

- `tests/unit/follow-camera.test.js` → planar: camera y never below 0.45; boom/shoulder
  behavior on flat ground.
- `tests/unit/avatar-pose.test.js` → adds: planar airborne state stays upright (up
  `[0, 1, 0]`), grounded uses support normal.
- `tests/e2e/local-skating.spec.js` → play-mode assertions re-scoped to planar
  coordinates (spawn from `playWorld`, camera above ground, movement on the flat grid).
- `tests/e2e/city-world.spec.js` → descriptor assertion (line 143) version 2 → 3; the
  menu-layout scene test is unchanged.

**Unchanged:** `tests/e2e/visible-city.spec.js` assertions (menu world); the chase-camera
screenshot it captures now shows the planar city, which is the intended new behavior.

**New e2e file** `tests/e2e/planar-city.spec.js`:

1. Join lands the player at the planar plaza spawn (finite, inside [0, 256)²).
2. Holding forward for one lap (~21 s) returns the player within 0.5 units of the start.
3. Crossing the seam: screenshot captured with the player near x ≈ 0; camera position and
   skater state all finite (no NaN), no visible pop (human check on the capture).
4. Leave returns to the globe preview: menu city still renders its 8 buildings.

## 9. Impact on plan Tasks 4–12

- **Task 4** (steps 1–5 re-scoped to the planar authored content): tag panels on planar
  walls; the launch → rail → landing line on planar streets (rail-0 alley or plaza line);
  the alley loop branch through one block's alley. Descriptor version in the step is
  corrected 2 → 3. `skate-paths.js` is reused as-is (generic path math).
- **Tasks 5, 6, 8:** unchanged in substance; their world records and scene fixtures move
  to the planar layout.
- **Task 7:** tags become planar wall-panel decals, replicated 9× via the
  `planarCity.attach` API.
- **Task 9:** adds the `applyAvatarPose` fix from §5 and its test.
- **Task 10:** the visual vignette is a planar street/plaza shot; the
  planet-underside/pole vignette items become menu-only.
- **Task 11:** measures the 9-copy draw-call and node budget (≤ 150 draw-call target;
  unmerged fallback allowed with the measurement recorded).
- **Task 12:** adds the single-direction lap and seam-invisibility acceptance items.

The Sol mechanics review gate (Task 5, step 0) and the Task 10 visual vignette approval
remain open human gates, unaffected by this spec.

## 10. Acceptance evidence and human gates

Evidence required before claiming done:

- New unit files (5) green, retargeted files green, full `npm test` (unit + workers +
  e2e) green.
- `planar-city.spec.js` green, including the ~21 s lap return and seam screenshot.
- Screenshots: planar play (street, plaza, rail), seam-crossing frame, and the unchanged
  menu globe — inspected by the user.
- Ledger entry with command + output for each step (SDD process).

Human gates, in order:

1. **This spec** (hard gate — implementation plan is not written until approved).
2. Sol mechanics review (Task 5, step 0) — unchanged.
3. Task 10 visual vignette approval — unchanged.

## 11. Risks

- **9× asset retention memory.** 12 assets retained per tile × 9 tiles. Geometries are
  shared across tiles; only the retained asset scenes multiply (node count), textures stay
  single (resource refcounts). Measured in Task 11; if node count is a problem, the
  fallback is authoring static geometry only for the center tile and keeping 3×3 for
  dynamic attachments — but the default is full 9× for seam simplicity.
- **Merged geometry loses per-building object identity** in the play scene. Accepted:
  play-scene tests read the layout records (`planarLayout`), not scene-object bounds; the
  menu's `visible-city.spec.js` bounds assertions are untouched.
- **Seam precision.** Guaranteed by the 1.2-unit per-step bound vs 128-unit half-width;
  covered by the dedicated seam unit tests and the e2e seam screenshot.
- **r137 `mergeBufferGeometries` requires matching attribute sets.** Merging is
  per-material and all inputs are position+normal BufferGeometries built by
  `compilePlanarWorld`, so attributes match; index handling is the util's job.
- **Two scenes at boot doubles scene-graph build time.** Both scenes are small (merged
  statics + retained assets); measured at boot in Task 11 alongside the draw-call budget.
- **Spec drift from the 2026-10-28 spec.** This document explicitly enumerates what it
  supersedes (§1, §8 of the old spec) and what it preserves (§6); the plan document is
  amended in place rather than forked.
