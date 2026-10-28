# TVHead Tiny-Planet Skate City — TDD Implementation Plan

> **Status: revised execution authorized by the user after Task 4.** Resume from the earliest unfinished revised task and preserve completed work. Tasks 5–12 replace the previous remaining Tasks 5–9, not their implementations (none existed). Capture development screenshots in gitignored `artifacts/skate-progress/` as playable slices are built.
>
> **For agentic workers after approval:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Continue on `feat/tvhead-skate-city`; do not recreate the branch or redo completed tasks. Each milestone is gated by its tests and explicit manual evidence, not merely by a green suite.

**Goal:** Add a browser-based, low-poly TVHead rollerblading game to the website, set in a shared miniature city built over a true sphere.

**Architecture:** Keep the existing portfolio and 3D viewer intact. Build and playtest an offline, fixed-step city-skating loop with canonical surfaces, input and a planet-relative follow camera before scoring or networking. Three.js renders state; pure simulation emits gameplay events; a single Cloudflare Worker/Durable Object synchronizes temporary guests, tags, emotes and duels. Wrangler is the local backend.

**Tech Stack:** Existing local Three.js/WebGL assets, vanilla JavaScript ES modules, Vitest, Cloudflare's maintained `@cloudflare/vitest-plugin`, Playwright, Wrangler, and `http-server` for local browser tests; Cloudflare Durable Objects provide the shared room.

**Spec:** Original approved design brief below (2026-10-27). Proposed design/architecture amendment and evidence: [`../reviews/2026-10-27-skate-city-architecture-review.md`](../reviews/2026-10-27-skate-city-architecture-review.md). The user has requested that the review's recommended improvements be included as buildable features in this guide. This approves their inclusion in the plan, not gameplay implementation or every proposed tuning/social-policy value.

## Revision and checkpoint

- Completed commits: shell `cfd34e7`, math/simulation baseline `b30d830`, city blockout `1e002ff`, avatar/customization `90af673`.
- Existing state: static orbitable preview with live appearance, **not** a playable skating loop. Preserve these working parts and their regression tests.
- Review baseline before implementation resumed: `npm test` → 45 unit / 9 browser tests; Workers had no test files. No real-phone FPS or traversal acceptance had passed.
- **Critical:** Tasks 5–8 and the correctness/security gates in Tasks 10–12; build the local loop and settle physics/input/world/score contracts before the room.
- **Recommended improvements, now included in planned build scope:** the feature register below assigns the review's R1–R4 recommendations to executable task items, interfaces and acceptance gates. Task 9 is a planned presentation/performance milestone, not an optional polish appendix. Expensive fidelity work remains optional.
- **Optional:** wall rides, boost/manuals, gesture tagging, delivery missions, elaborate outlines, BVH/LOD without profiling evidence, more rooms/players and authoritative anti-cheat. Do not expand scope implicitly.
- New ordering: **5 world/physics → 6 playable keyboard/camera → 7 gamepad/touch → 8 grind/trick flow → 9 presentation → 10 room → 11 social loop → 12 release acceptance**. Task 3's deferred ride check moves to Task 6.
- Camera preference clarified by the user: **Messenger is the primary gameplay-camera reference**, not Jet Set Radio. Use comfortable automatic over-the-shoulder following around the sphere; retain JSR inspiration for skating, graffiti, graphic energy and sound. This changes the planned camera behavior, not the currently implemented preview.
- Resume rule: preserve completed Tasks 1–4 in the progress ledger, execute only revised Tasks 5–12, and regenerate briefs from this file rather than using the old scoring-first Task 5. The user authorized execution and gitignored progress screenshots.

## Recommended-improvement feature register

These are explicit planned deliverables. Do not close a feature merely because its module exists: its task's automated tests and human/device acceptance must pass. Critical foundations retain priority, and no feature below requires an engine rewrite or a new backend.

| Feature | Build-out and player benefit | Dependencies / owning tasks | Acceptance evidence |
|---|---|---|---|
| **REC-01 — Messenger-inspired automatic camera** | Comfortable over-the-shoulder framing that follows spherical travel automatically, avoids walls/planet and smooths turns/jumps; manual camera input is optional, never needed to navigate. | World contacts in Task 5; F6.3; touch parity F7.2. | Hands-off camera traversal, pole/seam/occlusion sequences, no snap on stop/reverse/trick, 1,500 ms manual-release grace, real keyboard/controller/touch play. |
| **REC-02 — Immersive mobile play and accessible feedback** | Collapsible Join/customization card, visible skater, safe-area touch controls, compact trick/connection/duel feedback, mute/help/leave access. | Task 6 session states; F7.2; F9.7; F11.5. | Portrait/landscape browser play, >=44 px controls, focus/cancel tests, readable non-color-only feedback and real-phone check. |
| **REC-03 — Discoverable authored skate line** | One shortcut/branch and two recognizable landmarks connect a ramp, grind and clear landing zone; signage guides without forcing a delivery/campaign system. | Task 5 canonical geometry, Task 8 traversal; F9.1. | Clearance/physical-route tests, branch rejoins main loop, player follows signage and identifies both landmarks in playtest. |
| **REC-04 — Original graphic art direction** | Compact dusk palette, flat/toon materials, distinct feature shapes/signs and readable underside lighting; combines JSR energy with Messenger clarity. | F9.1; F9.5. | Reviewed preview/chase vignettes, feature recognition without color alone, no remote asset fetches or mandatory outline pass. |
| **REC-05 — Expressive TVHead animation** | Push/coast, crouch/jump, grind, clean landing and bail poses sell skating flow while preserving simulation authority. | Task 8 events; F9.2. | Deterministic pivot tests, visible transitions during actual skating, local/remote reuse without extra pose send frequency. |
| **REC-06 — Rhythmic music and action cues** | One original/licensed local loop, jump/landing/grind/tag cues, immediate mute and user-gesture unlock; sound supports flow but is not required to play. | Task 8 events; F9.4; tag acknowledgement in Task 11. | Unlock/mute/visibility/disposal tests, no duplicate loops/cues, missing-file fallback, source/license inventory. |
| **REC-07 — Measured low-end render quality** | Merged/instanced static avatar details, correct shared-resource ownership, low/standard presets and bounded cosmetic churn. | Task 6 ownership; early Task 7 phone measurement; F9.3/F9.6; Task 12 device/load gates. | Triangle ceilings plus <=12 calls/base avatar and <=150 calls/12-avatar low scene targets; stable resource counts and final five-minute median >=30 FPS on a real phone. |
| **REC-08 — Simple, shared dependency boundary** | One pure catalog/world configuration for client/server, matching test/vendored Three revision, cached query data; preserve existing assets and exports. | F5.1/F5.2; Task 10 uses the same data. | Revision-drift/import-boundary/appearance regression tests; no Three/DOM in shared or server rules; no speculative physics/ECS/UI/BVH dependency. |
| **REC-09 — Bounded multiplayer operating envelope** | Coalesced poses, slow-consumer recovery, capped room/social state and a repeatable local network-cost/resource report before public use. | F10.3/F10.7; Task 11 limits; F12.2. | 12-client traffic/resource report, graceful 13th rejection, bounded slow-client queues, no deployed/paid test; batching only after measured need. |

**Review traceability:** R1 → REC-07; R2 → REC-01 through REC-06; R3 → REC-08 plus shared ownership in REC-07; R4 → REC-09. All are planned; optional mechanics/effects listed above are not promoted by this request.

**Delivery checkpoints:** Tasks 6–8 prove playable movement and feel; Task 9 delivers the original presentation and low-end budget; Tasks 10–11 add shared presence/social play; Task 12 verifies the complete result. Capture visual/audio approval before expanding the city beyond the representative vignette.

## Global Constraints

- Start implementation on branch `feat/tvhead-skate-city`; do not implement directly on `main`.
- The game is a dedicated static page at `skate.html`; the existing viewer and portfolio must continue working.
- Use the repository's local Three.js/WebGL assets; do not require a remote CDN for the game to render.
- The rideable world is a small city built over a true spherical surface, with connected streets and skate features such as ramps and rails.
- Keep the art direction original while drawing inspiration from Jet Set Radio's movement/style and Messenger's miniature spherical city.
- Use Messenger as the primary gameplay-camera reference: automatic over-the-shoulder spherical following, collision-aware framing and minimal camera management. Do not interpret JSR-inspired skating as a requirement to reproduce JSR's camera behavior.
- Target one shared room with 12 concurrent skaters. This is a local/load-test target, not a guarantee of unlimited free-tier production capacity.
- Guest identity and customization are session-only. Do not save profiles, cosmetics, scores, or a permanent leaderboard.
- Players can choose a runtime color and from a small built-in accessory set. No user-uploaded assets.
- Character models are low-poly. Initial budget: at most 5,000 triangles for the base avatar and at most 7,500 for the avatar with all supported accessories.
- Keyboard/mouse, gamepad, and mobile touch are all day-one targets and separate progress items.
- A tag lasts 300,000 ms from its own placement time. Tagging over another live tag starts a 60,000 ms trick-score duel when its owner is online.
- Preset emotes only; no free-text chat in the first release.
- Use Cloudflare Worker/Durable Object for the shared room and Wrangler for local development. No Cloudflare credentials or secrets belong in static client code.
- Do not add Railway or a Docker-hosted second backend in the first implementation; `wrangler dev` is the local backend. Reconsider Railway/containers only if Cloudflare limits or deployment needs make it necessary.
- Send player pose snapshots at no more than 5 Hz; interpolate remote skaters locally between snapshots.
- Keep load tests local by default. Any deployed service test is opt-in and must first check current usage limits and estimated cost.
- Preserve `startSkateGame({ root, THREE }) -> { dispose() }`; extra diagnostics may be exposed, but tests must not depend on a private scene tree to claim gameplay acceptance.
- Run local simulation at 60 fixed ticks/second and render independently. Catch-up is bounded to 6 ticks/frame; reset accumulated time on blur/hidden/resume rather than replay a suspended tab. Pose sending remains independent at <=5 Hz.
- Physics, score rules, catalogs, world identity and protocol validation are pure modules with no Three.js/DOM imports. Avatar geometry and existing local assets remain reusable; no engine/framework replacement is planned.
- The room is casual/client-simulated, not cheat-proof competition. Server owns membership, deadlines, tag legality, duel identity and bounded accepted scores. Do not add a permanent ranking or claim authoritative movement.
- Named test suites become fail-on-empty when introduced. Worker tests must actually run a bound Durable Object, and multiplayer browser tests must launch local Wrangler.

## Approved Game Brief

The experience balances casual shared-world roaming with trick-focused play. A guest enters a single shared spherical city, chooses a color and accessories for a compact low-poly TVHead rollerblader, and skates streets, ramps, and rails. Tricks chain into flow-based scores. Preset emotes provide quick social reactions. Tags expire individually five minutes after placement; placing a tag over another live player's tag starts a one-minute head-to-head scored through skating tricks. Scores and duel results are temporary.

The build proceeds as local, testable slices first, then connects the same client to one shared room. The city blockout, low-poly avatar, and each input method are tracked independently so progress is visible before the complete game is assembled.

## Function-Level TDD Tracking Rules

- Every gameplay-facing function and feature gets an individual checklist item under its milestone. For revised F-items the paragraph specifies the RED assertions, implementation and GREEN result; the executor records separate nested RED/implementation/GREEN checkboxes per exported function in its task brief before coding, never marks a compound item complete while one function remains untested.
- Every helper function is listed as a nested sub-check under its owning gameplay-facing function. Test helper behavior through that owner; add a direct helper test if it is independently reusable or has nontrivial edge cases.
- For each function: write its failing test, run it and record the expected failure, implement the smallest change, run the focused test and regression suite, then mark it complete.
- A milestone is complete only when every function/feature item is green, its manual checks are recorded, and the milestone commit exists on the feature branch.
- Use the progress checkboxes in this file during implementation; record actual commands/results in the matching task.

## Repository File Map

| Path | Responsibility |
|---|---|
| `skate.html` | Standalone game shell, canvas, join/customization panel, HUD, and local Three.js script loading. |
| `css/skate.css` | Game-only layout, HUD, touch controls, and responsive rules; avoid changing global portfolio styling. |
| `js/game/main.js` | Boot/shutdown wiring for the game page. |
| `js/game/shared/catalogs.js` | Pure appearance, trick, tag and emote allow-lists/defaults; usable by Worker without renderer imports. |
| `js/game/shared/world-config.js` | Pure versioned world descriptor and gameplay tuning; same values on client/server. |
| `js/game/world/city-surfaces.js` | Compile canonical sampled surface triangles, support normals, collider/rail bounds and arc lengths. |
| `js/game/world/city-queries.js` | Pure support, sweep, tag-anchor and rail queries over the compiled world. |
| `js/game/core/city-skater.js` | City contact/air/bail/grind state and simulation-event output using existing movement math. |
| `js/game/core/fixed-step.js` | Bounded 60 Hz accumulator and one-shot action consumption. |
| `js/game/runtime/game-session.js` | Preview/playing/paused/disposed lifecycle; composes local state and optional room. |
| `js/game/render/follow-camera.js` | Messenger-inspired automatic over-the-shoulder framing, transported local up, optional look offset and collision. |
| `js/game/render/avatar-pose.js` | Apply simulation pose and local animation without network-dependent movement. |
| `js/game/render/social-scene.js` | Surface-oriented preset tags and transient emote visuals with bounded lifetime. |
| `js/game/audio/game-audio.js` | Gesture-unlocked local audio, mute, visibility and teardown. |
| `js/game/render/quality.js` | Session-only low/standard render settings; no change to simulation/network tick rates. |
| `js/game/ui/play-feedback.js` | Compact readable action/connection feedback and accessible play controls. |
| `tests/manual/skate-city-art-direction.md` | Original palette, feature silhouettes, reference attribution and approved vignette/audio checklist. |
| `scripts/game-room-load.js` | Local-only repeatable room traffic/resource diagnostic, introduced with Task 10. |
| `js/game/core/planet-math.js` | Pure vector/spherical-surface math. |
| `js/game/core/skater-simulation.js` | Deterministic movement state update. |
| `js/game/core/trick-combo.js` | Trick, grind, combo, and score rules. |
| `js/game/world/city-layout.js` | Deterministic city route, rideable surfaces, ramps, and rail data on the sphere. |
| `js/game/render/city-scene.js` | Converts city layout data into Three.js scene objects. |
| `js/game/render/avatar.js` | Shared low-poly TVHead skater geometry and runtime appearance. |
| `js/game/input/actions.js` | Shared `GameInput` contract. |
| `js/game/input/keyboard-mouse.js` | Keyboard movement/tricks and mouse camera input. |
| `js/game/input/gamepad.js` | Gamepad mapping, dead zone, and disconnect handling. |
| `js/game/input/touch.js` | Mobile virtual stick and touch buttons. |
| `js/game/net/protocol.js` | Versioned client/server message validation and serialization. |
| `js/game/net/room-client.js` | Browser WebSocket connection and remote-player interpolation. |
| `js/game/ui/customization.js` | Runtime color/accessory selection; no persistence. |
| `js/game/ui/hud.js` | Score, timer, duel result, and connection status. |
| `workers/skate-room/wrangler.jsonc` | Local/deploy configuration for the Worker and Durable Object. |
| `workers/skate-room/src/index.js` | Worker entry point and WebSocket upgrade routing. |
| `workers/skate-room/src/game-room.js` | One shared room's transient player, tag, emote, and duel state. |
| `tests/unit/` | Pure game and UI logic tests. |
| `tests/workers/` | Durable Object behavior tests using the installed `@cloudflare/vitest-plugin` and local bindings. |
| `tests/e2e/` | Browser-level page and multi-client tests. |
| `vitest.unit.config.js` | Unit test configuration. |
| `vitest.workers.config.js` | Durable Object test configuration. |
| `playwright.config.js` | Browser tests and local static/Worker servers. |

Changes to `package.json` are limited to test/dev scripts and pinning the existing Three.js test dependency to the vendored revision. Changes to `index.html` and `portfolio.html` remain limited to game navigation. Keep `js/viewer.js`, `lib/`, and existing page behavior unchanged unless a test reveals a required compatibility fix.

## Review Focus

1. **Curved travel/camera at poles, seams and slopes:** tangent heading after movement, continuous up, correct ramp contact; Tasks 5–6 `citySkater_transportsHeading`, `support_matchesRenderedTriangles`, `followCamera_crossesPolesWithoutFlip`.
2. **Frame pacing, focus and mixed devices:** same one-second movement at 30/60/120 render FPS, one jump edge per press, no held input after cancellation; Tasks 6–7 `fixedStep_isRenderRateIndependent`, `input_edgesConsumedOnce`, `touch_cancelAndResizeClearCapture`.
3. **Tag/duel races and idle expiry:** at 299,999/300,000 ms and 59,999/60,000 ms, concurrent overtags and duplicate scores yield one outcome; Task 11 clock/alarm/idempotency tests.
4. **Network stalls, malformed state and room lifecycle:** world mismatch, invalid/server payloads, old sequences, slow clients, restart/hibernation and disconnect never silently award a win; Tasks 10–11 protocol/recovery tests.
5. **Low-end device/readability/resource pressure:** twelve visible avatars, cosmetic churn, mobile card overlap and repeated join/leave do not exhaust resources or hide play; Tasks 7, 9 and 12 geometry-ownership, actual draw-call and device tests. A desktop WebGL probe is not phone-FPS evidence.

---

## Task 1 — Milestone 0: Branch, TDD Harness, and Isolated Game Page

**Outcome:** A new route can load independently, tests run locally, and the current website still works.

**Files:** Create `skate.html`, `css/skate.css`, `js/game/main.js`, `tests/e2e/site-navigation.spec.js`, `tests/e2e/skate-shell.spec.js`, `vitest.unit.config.js`, `vitest.workers.config.js`, and `playwright.config.js`. Modify `.gitignore`, `package.json`, `index.html`, and `portfolio.html`.

**Interfaces:** `skate.html` loads the existing local `lib/three.min.js` and `lib/OrbitControls.js`, then `js/game/main.js` as an ES module. The initial game boot function is `startSkateGame({ root, THREE }) -> { dispose() }`.

- [x] **Execution setup:** created `feat/tvhead-skate-city`; verified the current branch before changing tracked source.
- [x] **Test harness:** Added Vitest, `@cloudflare/vitest-plugin`, Playwright, Wrangler, and `http-server` as development dependencies. Added `test:unit`, `test:workers`, `test:e2e`, `test`, and `dev:room` scripts; kept the existing `dev` behavior. Set the package to ES modules so the Cloudflare Vite plugin and module configs load correctly, and ignored Playwright output.
- [x] **Feature M0-F1 — navigation:** Wrote `site-navigation.spec.js`; both missing-link tests failed RED, then the game links were added to `index.html` and `portfolio.html` and the tests passed GREEN.
- [x] **Feature M0-F2 — game shell:** Wrote `skate-shell.spec.js`; shell/control/boot tests failed RED, then added `skate.html`, game-only CSS, and boot wiring and the tests passed GREEN.
- [x] **Feature M0-F3 — portfolio regression:** Added browser checks for the existing 3D viewer and portfolio content; they pass without changing either page's existing behavior.
- [x] Run `npm run test:unit`, `npm run test:workers`, and `npm run test:e2e`; all configured suites pass.
- [x] Commit the test harness and isolated page: `feat: add isolated skate game shell` (`cfd34e7`).

## Task 2 — Milestone 1: Spherical Movement Core

**Outcome:** A skater can move over a sphere without drifting off the surface or losing a stable local orientation.

**Files:** Create `js/game/core/planet-math.js`, `js/game/core/skater-simulation.js`, `js/game/input/actions.js`, and `tests/unit/planet-math.test.js`, `tests/unit/skater-simulation.test.js`.

**Interfaces:** `Vec3` is a finite `[x, y, z]` tuple. `GameInput` is `{ steerX, steerY, accelerate, brake, jumpPressed, trickId, grind, tagPressed, emoteId }`, where axes are clamped to `[-1, 1]`. `SkaterState` is `{ position, forward, speed, airborne, verticalSpeed, groundRadius? }`; simulation sets `groundRadius` while airborne so radial jump height can be integrated and landing remains tied to the same sphere.

- [x] **Function M1-F1 — `projectToTangent(direction, normal) -> Vec3`**
  - [x] RED: `projectToTangent_removesNormalComponent` and `projectToTangent_parallelInputReturnsZero` failed before implementation.
  - [x] Implement the smallest tangent projection.
  - [x] GREEN: focused tests and full unit suite pass.
  - [x] Helper `dot3`: test correct dot product and finite inputs through the owning test file.
  - [x] Helper `normalize3`: test unit output and zero/non-finite fallback through the owning test file.
- [x] **Function M1-F2 — `makeSurfaceFrame(normal, heading) -> { up, forward, right }`**
  - [x] RED: `makeSurfaceFrame_returnsOrthonormalBasis` and `makeSurfaceFrame_handlesPoleAndSeam` failed before implementation; `up` equals the normalized input normal.
  - [x] Implement stable surface basis construction with a fallback tangent.
  - [x] GREEN: focused tests and full unit suite pass.
  - [x] Helper `cross3`: test right-handed output and zero result for parallel inputs.
  - [x] Helper `chooseFallbackTangent`: test stable output for parallel and near-zero headings.
- [x] **Function M1-F3 — `advanceAlongSphere(position, forward, distance, radius) -> Vec3`**
  - [x] RED: `advanceAlongSphere_preservesRadiusAcrossLargeTurn` and `advanceAlongSphere_zeroDistanceIsNoop` failed before implementation.
  - [x] Implement the smallest spherical step.
  - [x] GREEN: focused tests and full unit suite pass.
  - [x] Helper `rotateAroundAxis`: test zero, normalized, and non-unit axes.
- [x] **Function M1-F4 — `stepSkater(state, input, deltaSeconds) -> SkaterState`**
  - [x] RED: `stepSkater_neutralInputKeepsState`, `stepSkater_clampsSpeedAndPreservesGroundRadius`, and `stepSkater_jumpTransitionsToAirborne` failed before implementation.
  - [x] Implement deterministic movement using the earlier sphere functions.
  - [x] GREEN: focused tests and full unit suite pass.
  - [x] Helper `clampInputAxes`: test both bounds and non-finite values.
- [x] Run `npm run test:unit -- tests/unit/planet-math.test.js` and `npm run test:unit -- tests/unit/skater-simulation.test.js`; record RED before implementation and GREEN after implementation.
- [x] Commit: `feat: add spherical skater simulation` (`b30d83`).

## Task 3 — Milestone 2: Low-Poly Spherical City Blockout

**Outcome:** The planet is a small traversable city, not a bare sphere; a continuous route includes streets and skate features.

**Files:** Create `js/game/world/city-layout.js`, `js/game/render/city-scene.js`, and `tests/unit/city-layout.test.js`, `tests/e2e/city-world.spec.js`; modify `js/game/main.js` to mount the city on the game page.

**Interfaces:** `CityLayout` contains a planet radius, route graph, rideable street/ramp surface records, and rail segments. Surface points and normals are returned in world coordinates.

- [x] **Function M2-F1 — `createCityLayout({ radius, seed }) -> CityLayout`**
  - [x] RED: `createCityLayout_isDeterministic`, `cityLayout_hasConnectedRideLoop`, and `cityLayout_includesRampAndRail` failed before implementation.
  - [x] Implement deterministic city route and feature data.
  - [x] GREEN: focused tests and full unit suite pass.
  - [x] Helper `isRouteGraphConnected`: test empty, disconnected, and connected graphs.
- [x] **Function M2-F2 — `findRideableSurface(layout, position) -> SurfaceHit | null`**
  - [x] RED: `findRideableSurface_hitsStreetAndRamp`, `findRideableSurface_rejectsBuilding`, and `findRideableSurface_returnsSphericalNormal` failed before implementation.
  - [x] Implement surface lookup and stable route-join selection.
  - [x] GREEN: focused tests and full unit suite pass.
  - [x] Helper `surfaceDistanceToRecord`: test street, ramp, route-join, and curved-surface distances.
- [x] **Function M2-F3 — `findGrindRail(layout, position, forward) -> RailHit | null`**
  - [x] RED: `findGrindRail_findsNearestAlignedRail` and `findGrindRail_rejectsOutsideTolerance` failed before implementation.
  - [x] Implement nearest eligible rail lookup.
  - [x] GREEN: focused tests and full unit suite pass.
  - [x] Helper `projectOntoRail`: test endpoints, midpoint, and out-of-range positions.
- [x] **Function M2-F4 — `createCityScene(THREE, layout) -> THREE.Group`**
  - [x] RED: `cityWorld_rendersCurvedStreetsRampsAndRails` failed before implementation.
  - [x] Implement the graybox scene builder; final art is not a dependency for gameplay.
  - [x] GREEN: Playwright test and visual review pass; captured `test-results/city-world-mounted.png`.
  - [x] Helper `buildStreetMesh`: test mesh placement follows route surface data.
  - [x] Helper `buildBuildingMesh`: test building bases sit on the curved city surface.
  - [x] Helper `buildRampMesh`: test ramp mesh and rideable surface align.
  - [x] Helper `buildRailMesh`: test rail mesh matches its grind segment.
- [x] **Game-page integration:** mount the deterministic city in `startSkateGame`, use a capped low-power renderer, support orbit controls and resize, and dispose scene resources idempotently; mounted render/cleanup test passed red→green.
- [x] Run `npm run test:unit -- tests/unit/city-layout.test.js` and `npm run test:e2e -- tests/e2e/city-world.spec.js`; record RED/GREEN for each function.
- [ ] Manual ride check (now owned by Task 6): this milestone has no skater/play loop or movement controls yet; verify route traversal in the first offline playable slice, not the release task.
- [x] Commit: `feat: add spherical city skate routes`.

## Task 4 — Milestone 3: Low-Poly TVHead Avatar and Runtime Customization

**Outcome:** One compact character can be rendered for the local guest and reused for all remote skaters, with color/accessories changed at runtime.

**Files:** Create `js/game/render/avatar.js`, `js/game/ui/customization.js`, and `tests/unit/avatar.test.js`, `tests/e2e/customization.spec.js`; modify `js/game/main.js` to mount the local guest and wire its live preview. Inspected `atltvhead.obj` (4.74 MB, 20,250 vertices, 40,058 faces); use primitives rather than shipping the over-budget raw model.

**Interfaces:** `Appearance` is `{ color: '#RRGGBB', accessoryIds: string[] }`. The supported accessory IDs come from one exported `AVATAR_ACCESSORIES` catalog.

- [x] **Function M3-F1 — `createTvheadAvatar(THREE, appearance, geometryCache) -> THREE.Group`**
  - [x] RED: `createTvheadAvatar_hasTvHeadBodyAndRollerblades`, `createTvheadAvatar_staysWithinTriangleBudget`, and `createTvheadAvatar_reusesGeometry` failed before implementation.
  - [x] Implement a compact low-poly avatar using the cache; the existing OBJ exceeds the budget, so use Three.js primitives.
  - [x] GREEN: focused tests and full unit suite pass; base avatar is <=5,000 triangles.
  - [x] Helper `countGeometryTriangles`: test indexed and non-indexed meshes.
  - [x] Helper `buildTvHeadGeometry`: test low-poly TV-head geometry and bounds.
  - [x] Helper `buildBodyGeometry`: test low-poly body geometry and bounds.
  - [x] Helper `buildRollerbladeGeometry`: test left/right blade geometry and bounds.
- [x] **Function M3-F2 — `setAvatarAppearance(avatar, appearance) -> void`**
  - [x] RED: `setAvatarAppearance_appliesColorAndAccessories`, `setAvatarAppearance_rejectsUnknownAccessory`, and `setAvatarAppearance_doesNotLeakMaterialsBetweenPlayers` failed before implementation.
  - [x] Implement appearance updates with per-player materials and shared geometry; all supported accessories together remain <=7,500 triangles.
  - [x] GREEN: focused tests and full unit suite pass.
  - [x] Helper `isAccessoryId`: test every supported ID and an unknown ID.
  - [x] Helper `cloneMaterialsForAvatar`: test per-player color isolation while geometry remains shared.
- [x] **Function M3-F3 — `readCustomizationForm(form) -> Appearance`**
  - [x] RED: `readCustomizationForm_parsesValidValues`, `readCustomizationForm_usesDefaults`, and `readCustomizationForm_rejectsInvalidValues` failed before implementation.
  - [x] Implement runtime-only color/accessory parsing and UI wiring.
  - [x] GREEN: focused tests and full unit suite pass.
  - [x] Helper `normalizeColor`: test valid hex, uppercase normalization, and fallback for invalid input.
  - [x] Helper `filterAccessoryIds`: test allowed, duplicate, and unknown IDs.
- [x] Run `npm run test:unit -- tests/unit/avatar.test.js` and `npm run test:e2e -- tests/e2e/customization.spec.js`; record RED/GREEN for each function.
- [x] Add a browser check that a guest can change color/accessories before joining and see the same appearance in the city. Verify reload starts with defaults rather than persisted customization.
- [x] Commit: `feat: add low-poly customizable tvhead avatar`.

## Revised implementation contracts (proposal)

These extend the existing modules; they do not declare Tasks 1–4 broken or require throwing them away. Technical constants below are starting tuning, not a claim to reproduce either reference exactly. All new behavior gets RED → minimal implementation → GREEN; helper coverage lives under its owning function unless independently reusable.

### World and simulation

- `WorldDescriptor = { version: 1, seed: 2026, radius: 16, tuningVersion: 1 }`. Increment versions when layout/contact geometry or gameplay tuning changes; welcome must match the whole descriptor. Centralize current constants rather than silently creating new client/server worlds.
- `compileCityWorld(layout) -> CityWorld` in `world/city-surfaces.js`; plain arrays/records with stable IDs, canonical surface triangles, building collision volumes, rail segment lengths/bounds and spawn points. Three.js creates BufferGeometry from those vertices; the Worker imports only pure records/queries.
- `querySupport(world, position, { maxDrop, maxRise, previousSurfaceId }) -> SupportHit | null` in `world/city-queries.js`. Hit: `{ surfaceId, point, gravityUp, surfaceNormal, tangent, clearance }`; gravity up is radial, contact normal follows the actual triangle. Search vertical clearance separately from lateral extent. Use 0.02-world-unit contact tolerance initially.
- `sweepSkater(world, from, to, radius) -> { position, blocked, hitId }` prevents tunneling through inflated building volumes; initial capsule-footprint radius 0.25. Streets are preferred support; off-street sphere terrain is safe fallback, but buildings are not rideable. Map landmarks need not all be collision meshes.
- `stepSkaterOnCity(state, input, dt, world, tuning) -> { state, events }` in `core/city-skater.js` extends state with `mode: grounded|airborne|grinding|bailed`, `surfaceId`, `railId`, `railDistance`, tick and jump timing. Retain `stepSkater`'s public three-argument baseline with shared integration/math; do not maintain two independent movement models. Transport heading to the **new** tangent plane before returning. Land against current support, not the radius at takeoff.
- `createCitySkater(world, spawnId?) -> SkaterState` chooses a valid compiled spawn and initializes those fields, with feet/contact offsets derived from the avatar origin convention; invalid requested spawn falls back to the default, never the center of the planet. Runtime and recovery use this factory, not private ad-hoc state fixtures.
- Start with existing max speed 12, acceleration 8, braking 18, turn rate 2.6, jump speed 6 and gravity 14. Add configurable coasting drag 0.6 world units/s² when throttle/brake are neutral; initial steering factor `1 - 0.5 * clamp(speed/12,0,1)`. Coyote time <=100 ms and jump buffer age <=120 ms are eligible (inclusive). Pin defaults in behavioral tests; tune by local playtest before freezing `tuningVersion`. Jump press is an edge, not a held auto-hop. Keep legacy `stepSkater` behavior through a baseline tuning adapter so its compatibility tests do not force the city controller to retain unlimited coasting.
- Simulation events have `{ eventId, tick, type, ...context }`; deterministic event IDs are per-session tick/counter, not random. Types include `jumped`, `trickCompleted`, `grindStarted`, `grindEnded`, `landed`, `bailed`; legality uses simulation state. Render/network modules never award points.

### Input, runtime and camera

- `InputFrame = { steer: number, throttle: number, brake: number, grindHeld: boolean, jumpPressed: boolean, trickPressed: id|null, tagPressed: boolean, emotePressed: id|null }`; steer range [-1,1], throttle/brake [0,1], all finite. `CameraInput = { yawDelta, pitchDelta, zoomDelta }`. Keep legacy `GameInput` mapping in `actions.js` until old consumers migrate; define explicit conversion, not `steerY` guessing.
- Adapter lifecycle: `{ sample(), reset(), dispose() }`. Held state is sampled each tick; queued discrete edges are consumed once, even across catch-up ticks. Active device is the most recently intentionally used one; neutral gamepad noise must not steal keyboard/touch ownership. Form focus/preview never steers; blur/hidden clears all devices.
- Keyboard: W/up throttle, S/down brake, A/D steer, Space jump, J/K tricks, **Shift grind hold**, F tag, E emote; mouse drag/scroll adjusts the gameplay camera only on canvas. Gamepad: left-stick X steer/Y throttle or brake, A jump, X/Y tricks, LT grind, B tag, D-pad emote, right-stick camera. Touch: left stick and explicit jump/trick/grind-hold/tag/emote buttons; camera works automatically without requiring a second stick.
- `advanceFixedStep(loopState, elapsedMs, nextInput, step) -> { loopState, alpha }`; 60 Hz, maximum 6 catch-up ticks, discard excess after a 100 ms frame budget. No hidden-tab catch-up. Render previous/current poses independently; network timer never drives physics.
- `createGameSession(deps) -> { joinLocal(), pause(), resume(), leave(), dispose(), getState() }` owns `preview|playing|paused|disposed`; optional room connection has independent `offline|connecting|connected|full|reconnecting` state. Join starts offline play immediately, attempts room admission only when configured; full/offline does not stop skating. Leave returns preview and cancels network retry. Keep `main.js` as composer.
- **Camera reference and intent:** Messenger's creators describe automatic over-the-shoulder following, camera collision in alleys and support for any player orientation on the sphere. Use those documented goals, not an assumed copy of its private camera algorithm. Both references use third-person views, but this game's camera should prioritize Messenger-like comfort and hands-off exploration rather than literal JSR camera behavior. The skating-speed adaptations below are our proposed tuning, not measurements taken from Messenger.
- `updateFollowCamera(previous: CameraState, skater, cameraInput, world, dt) -> CameraState` transports local up and the previous view direction around the sphere, follows a damped player/forward-look target and sweeps against buildings/planet. Initial framing: 5 units behind, 2.5 above the feet, 0.6 to the right; aim 1.6 above the feet with up to 1.5 units of forward look-ahead. Keep the skater around the lower-middle of the usable play viewport and leave the route ahead readable; mirror/reduce the shoulder offset when collision or a narrow mobile viewport requires it. Zoom range remains 3–8. These values are tunable at the first camera playtest, not a promise of pixel-identical reference framing.
- **Automatic follow:** travel direction gently guides the viewing azimuth; do not set it to avatar facing every tick. Short steering corrections, stopping or reversing must not snap the camera; retain the last useful view when idle. Jump/landing height is damped separately, so the camera does not bounce with feet or spin with trick/head animations. Preserve continuous transported local up at seams/poles, with no world-Y reset. No mandatory speed-FOV kick, shake, banking or dramatic trick cuts in the default camera.
- **Optional look and collision:** drag/right stick can look around, but a full lap and jump/grind line must be playable without those inputs. After 1,500 ms without manual look, begin a smooth recenter while moving; do not snap back on a timer while stationary. Collision may shorten the boom immediately to keep sightlines safe, then restore distance smoothly after the obstruction clears. Preview keeps whole-planet OrbitControls; playing disposes/disables them rather than using global-origin orbit as the gameplay camera.
- `CameraPose = { position: Vec3, target: Vec3, up: Vec3 }`; `CameraState` extends that pose with transported `followDirection`, `orbitOffset: { yaw, pitch }`, `manualIdleMs` and the current damped boom length. Initial state comes from spawn/camera tuning; subsequent calls carry it, not hidden module globals. Camera math can be tested without WebGL. `applyAvatarPose(avatar, state, renderTime)` is the Three.js adapter and documents model +Y up / +Z forward and frame handedness; collision/score/camera following do not read its animated transforms.

### Buildable presentation and performance features

- `STYLE_TOKENS` and `createStyleMaterials(THREE, preset)` live in `render/style.js`. Initial original dusk tokens: terrain `#20283A`, street `#495068`, ramp `#EF4B91`, rail `#53EDFF`, tag target `#F4C95D`, landmark accent `#8FD694`, ink `#12121F`. Keep TVHead customization color distinct from world feature colors. Use Three r137-compatible toon/basic materials and shared palette resources; do not depend on a newer engine's color-management/postprocess API. Low and standard presets use the same feature semantics. Exact art can be adjusted at the vignette review without changing physics contracts.
- The first authored addition contains a **signal-tower plaza** and a **painted skate arch** as original landmark silhouettes. One marked shortcut branches off and rejoins the main loop; an unobstructed ramp → rail → landing line remains available. Choose their layout positions by physical clearance/camera tests, not by a screenshot alone. Landmark signs and feature shapes must remain identifiable when desaturated; no arrow-to-mission or delivery quest dependency.
- `applyAvatarPose(avatar, state, renderTime)` extends Task 6's rigid-pose adapter with named pelvis/torso/head/arm/blade pivots. Animate push/coast, crouch, jump, grind, landing and bail using simulation mode/speed/event time; never move the collision root or alter score based on animation. Animation absolute time sampling is deterministic. Reduced motion disables optional bob, sway and screen shake while retaining essential pose/state changes.
- `createGameAudio({ audioContextFactory, assetManifest, loadAudio }) -> { unlock, handleEvent, setMuted, setVolume, setSuspended, dispose }` in `audio/game-audio.js`; one soundtrack loop plus jump, clean-landing, grind-start/loop/end and acknowledged-tag cues. Start only after Join/user gesture; cap transient voices at 8, deduplicate event IDs and allow at most one music/grind loop each. Mute sets output gain to zero immediately, volume clamps [0,1], hidden/pause suspends loops and resume cannot stack nodes. Unsupported/failed audio resolves to silent usable play. Assets are local and have source/author/license metadata; tag feedback waits for server acceptance in Task 11.
- `applyRenderQuality({ renderer, scene }, quality, devicePixelRatio) -> AppliedQuality` in `render/quality.js`; accepted quality `low|standard`, invalid value falls back to `low`. Low: DPR cap 1, shadows/postprocessing off, decorative props reduced but all physical routes/landmarks/tags retained. Standard: DPR cap 1.5, shadows still off for the initial release, full inexpensive decoration. Default low on coarse-pointer devices and standard otherwise; manual override is session-only. Quality never changes 60 Hz physics, <=5 Hz sends, collision geometry or social timers. `captureRenderBudget(renderer, resourceRegistry)` reports draw calls, triangles and owned/shared resource counts for real rendered fixtures.
- `renderPlayFeedback(root, viewState) -> void` in `ui/play-feedback.js` renders pending/banked chain, last valid action, bail, connection/full/offline and current-duel status from existing state. Preview shows customization; play collapses that card and exposes compact help/mute/quality/leave controls. Use text/icon plus color, visible focus and >=44 CSS px controls; DOM text contrast >=4.5:1. A polite live region announces bank/bail/duel results, not a 60 Hz score/timer stream. No new state/score authority or persistent settings store.
- Local operating-envelope reports record scenario/device/tuning versions, duration, guests, accepted inbound pose/control counts separately, outbound frames/recipient deliveries/UTF-8 bytes, observed ACK/queue maxima and disconnect/reconnect/full results. Browser render metrics and DO memory/runtime observations are separate fields; unavailable runtime metrics are explicitly `unavailable`, never estimated as measured. Keep reports as test artifacts and a concise device-matrix summary, not guest analytics/profiles.

### Scoring, network and social authority

- Combo is `{ chainId, pendingPoints, multiplier, bankedScore, lastEventTick, processedEventIds }`. Only valid simulation events alter it. Each action adds base value to the pending base sum; multiplier starts at 1 and rises by 1 for each distinct subsequent action, capped at 5; projected pending value is base sum × multiplier, floored once when banked. Spin=100 then grab=150 in a chain therefore banks 500, versus 250 isolated. Same-trick repeat grants half base once then zero and does not raise multiplier. Grind accrues 50 base points/s only from moving >=2 world units/s, counts as one action per continuous rail interval and does not raise multiplier every tick. A clean landing banks pending once but retains the chain's action history/multiplier for a 1,500 ms link window; next successful action within that inclusive window continues it. Expiry resets link history, never banks airborne/unlanded points. Bail loses pending only and resets linkage; banked score survives. Duplicate events/grounded trick spam award zero. Keep bounded dedup by monotonic per-session event index, not an ever-growing Set. Expose tuning; no permanent score.
- `Pose = { seq, position:[x,y,z], rotation:[x,y,z,w], mode, speed, animationId }`; server adds `{ guestId, serverTime, roomEpoch }`. Client uses a small timestamped buffer (max 8 samples/guest), 200 ms interpolation delay; after 1,000 ms without updates, hold/fade, not unbounded extrapolation. Grounded interpolation follows angular direction and canonical support; airborne interpolation retains radial height. Quaternion shortest-path interpolation stays normalized.
- Versioned messages share a pure catalog/schema module. Client: `join`, `pose`, `appearance`, `emote`, `tag`, `trickScore`, `ack`; server: `welcome`, `snapshot`, `playerJoined`, `playerLeft`, `pose`, `appearance`, `emote`, `tagPlaced`, `tagsExpired`, `duelStarted`, `duelScore`, `duelEnded`, `error`. `welcome` carries world descriptor, protocol version, room epoch, server time and server-issued guest ID. All server frames carry monotonic `serverSeq` within epoch; snapshot replaces state at a defined revision, and callbacks from superseded connections cannot mutate it. Tags/duels may be empty until Task 11; social requests are rejected as unavailable until those handlers exist.
- Client frame maximum 1,024 UTF-8 bytes; server snapshot maximum 128 KiB with at most 12 guests, 120 tags, 6 active duels and 6 recent results. Reject binary/unknown/malformed payloads, nonfinite tuples, quaternion length error >0.01, unknown IDs, out-of-world positions (radius outside R−1 to R+8), stale `seq`, pre-join messages and supplied identity overrides. All authoritative timestamps come from server receipt; local elapsed time is monotonic. Deny a second join on one socket; unjoined sockets close after 5 seconds and total pending-upgrade connections are bounded to 24 so admission cannot be bypassed with idle handshakes.
- Pose sends coalesce to latest at >=200 ms intervals, server also enforces 5 Hz; snapshots need not echo sender poses. Appearance interval >=500 ms, emote >=1,000 ms, tag >=2,000 ms, score bank event >=250 ms; no burst allowance. Repeated violations close after 5 in a rolling 10-second window. Upgrade path `/room/main`, allowlisted origins from environment; local fixture uses `http://127.0.0.1:8000`. Public HTTPS pages use configurable `wss:` URL and no client credentials. Origin checks reduce browser misuse, not authentication; shared-room admission is intentionally public.
- `RoomConnection` exposes `sendPose(pose, now)`, `sendAppearance(appearance)`, `sendEmote(id)`, `sendTag(request)`, `sendScore(event)`, `close()`; buffers are bounded, reconnect delay doubles from 0.5 to 8 seconds with ±20% jitter, reconnect creates a new guest. Do not auto-loop a full-room rejection: stay locally playable and offer manual retry. Never replay old tag/score actions. Browser `bufferedAmount` >64 KiB coalesces/drops superseded poses. Do not assume the Durable Object socket supports browser `bufferedAmount`: piggyback cumulative `ackServerSeq` on pose or send `ack` at most 5 Hz when receiving without poses. Server tracks a bounded window (64 frames / 256 KiB, including initial snapshot); at cap stop poses, and disconnect/resnapshot if essential social state cannot be delivered. Reject ACK of an unsent sequence. No unbounded resend queue; ACK removes accounting metadata, not a retained copy of every pose payload.
- Tags use canonical street/ramp anchors initially, not arbitrary walls: `{ id, ownerId, styleId, surfaceId, triangleId, barycentric, position, normal, placedAt, expiresAt, coveredByTagId }`. Client request is `{ requestId, styleId, surfaceId, triangleId, barycentric }`; server reconstructs the point and validates it within 2 world units along the local surface of the guest's latest accepted grounded pose. Add wall tagging only as separately modeled surfaces later.
- `TAG_TTL_MS=300_000`, `DUEL_DURATION_MS=60_000`, `TAG_OVERLAP_DISTANCE=1.5` along the local spherical surface; include surface/height compatibility so vertically distinct targets do not overlap. Presets `wave|cheer|follow` and tag styles `tv|bolt|star` are proposed original symbols. No uploaded/free-text assets.
- Max 10 live tags per guest and 120 per room, including covered/offline-owner tags. Reject placement at cap with feedback, not arbitrary early eviction. Own tag never challenges self. Overtagging an offline owner is allowed visually without a duel; if either guest already has a duel, reject the challenge placement with `busy`. Live same-surface overlap picks the nearest visible tag, stable ID tie-break. One active duel per guest.
- Overtag cover + duel creation are one serialized transition, persisted consistently before success is acknowledged; storage awaits may not allow another placement to observe half a cover/duel. Retries with same request ID return the same result. Keep at most 128 recent request IDs/socket, expiring after 300,000 ms; under a new request ID after eviction normal gameplay validation still applies. Covered tags cannot start duels; each keeps its original expiry. When a cover expires, reveal the nearest still-live underlying tag without creating a new duel. Covered tags expire independently.
- Duel record `{ id, roomEpoch, challengerId, targetId, startedAt, endsAt, scores, status }`. Score messages contain `duelId`, unique monotonic `eventId` and a banked delta (1–5,000); reject nonparticipant, duplicate/stale/over-rate/over-budget events, and events received at or after `endsAt`. Maximum accepted duel delta sum per player 50,000. Larger local banks are capped to one 5,000-point duel claim with explicit HUD feedback, not split to evade the cap; local roaming bank can remain larger. Scores are casual, client-reported claims, not proof of legitimate physics. Start a fresh duel-local combo; do not bank pre-duel pending points. At end only bank deltas already accepted before the server deadline count; unlanded/unreceived points do not count and later client timestamps cannot backdate them.
- Server deadline/alarm processing sends one winner/tie; disconnect or room reset cancels without a winner. Use serverTime/endsAt for client countdown with periodic offset refresh, never client timer ownership. Results visible 5 seconds then removed; dedup state bounded to duel lifetime. Tags survive guest leave until expiry; reconnect cannot inherit an old duel/identity.
- Lifecycle: use WebSocket hibernation API/attachments for currently connected session identity, appearance, last accepted pose/seq, rate-limit timestamps and bounded ACK/request metadata (stay within the 16 KiB attachment limit); no guest/profile/cosmetic tables. Persist only TTL-bounded active tag/duel state as allowed by the original brief; DO alarms purge expired records, filter expiry on every snapshot/mutation, and reconstruct socket state after hibernation. Initialize storage behind an input gate before handling events; use storage transactions for related tag/duel mutations, not an awaited half-updated in-memory state. No perpetual DO interval for expiry. A world-version reset cancels duels and clears incompatible tags with a new epoch. Crash recovery cancels duels whose participants are absent. Tests must distinguish restart/deploy (sockets can close) from ordinary hibernation (healthy sockets stay attached) and guest reconnect.

### Social function boundaries

Pure rules in `core/social-rules.js` operate on explicit `RoomState` plus injected `now` and `CityWorld`; the DO owns sockets/storage and serializes/persists the returned transition. Use one shared `Transition = { state, result, events }`, not direct socket sends from pure rules.

- `placeTag(state, guestId, request, now, world) -> Transition` owns validation, expiry filtering, cover and optional duel atomically; calls `startTagDuel(state, challengerId, targetId, now)` internally, never as a separately interleavable network operation.
- `expireTags(state, now) -> Transition` and `finishExpiredDuels(state, now) -> Transition` are idempotent; alarm/read/mutation paths call the same rules.
- `recordDuelTrickScore(state, guestId, scoreEvent, now) -> Transition` owns participant/sequence/rate/deadline/budget checks. Socket identity supplies `guestId`, not a client payload.
- `sendEmote(state, guestId, emoteId, now) -> Transition` validates presets/rates and emits a bounded-lifetime event.
- `updateSocialScene(sceneState, authoritativeState, serverNow) -> void` is a rendering adapter, not a rules owner. `renderTagDuelHud(state, serverNow) -> void` handles timer/results/accessibility without sending scores.

## Task 5 — Milestone 4: Canonical City Contacts and Skating Contracts [Critical]

**Outcome:** A pure, tested city controller can traverse physical streets/ramps, block buildings, jump and land with correct orientation. Preserve the preview and existing exports.

**Files:** Create `js/game/shared/catalogs.js`, `js/game/shared/world-config.js`, `js/game/world/city-surfaces.js`, `js/game/world/city-queries.js`, `js/game/core/city-skater.js`, `tests/unit/city-surfaces.test.js`, `tests/unit/city-skater.test.js`, `tests/unit/shared-contracts.test.js`. Modify `planet-math.js`, `skater-simulation.js`, `actions.js`, `city-layout.js`, `city-scene.js`, `avatar.js`, `customization.js`, `package.json`, `package-lock.json`, and existing tests as needed; pin test Three to vendored revision rather than upgrade the viewer.

**Consumes:** existing layout/math/avatar and current `stepSkater` tests. **Produces:** `WorldDescriptor`, pure catalogs, `compileCityWorld`, `querySupport`, `sweepSkater`, `stepSkaterOnCity`, `InputFrame`/legacy conversion and event records defined above.

- [x] **F5.1 Shared contracts:** RED tests import pure catalogs in Node without DOM/Three; `threeRevision_matchesVendoredRuntime` compares installed `THREE.REVISION` with the browser value (`137` currently); invalid color/accessory and duplicate accessory cases preserve current UI behavior. Implement catalog extraction/re-exports, world descriptor and explicit input conversion. GREEN old appearance tests still pass. Helpers: color/default/allow-list validation and finite axes under owner tests.
- [x] **F5.2 `compileCityWorld`:** RED `support_matchesRenderedTriangles` raycasts real mesh vertices/transforms at street centers/edges/joins and ramp slopes and compares query point/normal within 0.02; radial normal must not be substituted for slope contact. Implement canonical triangles and cached bounds/lengths; render those triangles. GREEN no road seam beyond 0.02 and query normals perpendicular to actual slope. Include several seeds, seam and R=16 fixture; add pole-oriented fixture independent of the equatorial production route.
- [x] **F5.3 `querySupport` / `sweepSkater`:** RED tests reject a building footprint, distinguish vertically separated surfaces, keep prior support at join ties, detect an inflated building swept across in one tick, and return safe sphere terrain outside streets. Implement bounded support/sweeps over plain records. GREEN valid ramp/ground support and no far-side hit. Helpers: barycentric support, signed clearance, swept-volume intersection and deterministic tie-break tests.
- [x] **F5.4 `stepSkaterOnCity`:** RED `citySkater_transportsHeading` expects `abs(forward·newUp)<1e-6`, `citySkater_landsOnCurrentRampHeight`, no midair jump, buffered/coyote jump boundaries (99/100/101 ms and 119/120/121 ms), ramp ascent/descent and collision/respawn emit one event. Implement shared integrator/contact transitions, slope-aware ramp departure and safe spawn recovery; bailed state lasts 500 ms before respawn, clearing stale input edges. Invalid/nonfinite state recovers safely rather than propagating NaN. GREEN heading/landing, timer, ramp and collision recovery sequences pass; movement reuses the legacy speed/turn/vertical integrators.
- [x] **F5.5 `createCitySkater`:** RED requested/default/unknown spawn IDs produce finite valid supported state, feet at contact within 0.02, no initial building overlap and neutral speed/mode. Implement one spawn/reset factory from compiled points; GREEN runtime-ready state and recovery share the same safe origin convention.
- [x] Run each F5 focused test RED first, then GREEN; focused and full suites pass. The full run reports 75 unit tests and 9 browser tests; Workers currently has no tests and is explicitly pending Task 10. `npm run build` exits successfully (static site).
- [x] Commit: `feat: unify city surfaces and skating state contracts`.

## Task 6 — Milestone 5: First Offline Playable Slice and Follow Camera [Critical]

**Outcome:** Join starts actual keyboard skating offline, with a Messenger-inspired automatic over-the-shoulder camera and a complete lap/jump/ramp/landing that needs no manual camera control. This resolves the formerly deferred Task 3 manual route check.

**Files:** Create `js/game/core/fixed-step.js`, `js/game/runtime/game-session.js`, `js/game/render/follow-camera.js`, `js/game/render/avatar-pose.js`, `js/game/input/keyboard-mouse.js`, `tests/unit/fixed-step.test.js`, `tests/unit/follow-camera.test.js`, `tests/unit/keyboard-mouse.test.js`, `tests/e2e/local-skating.spec.js`, `tests/manual/device-matrix.md`, `.github/workflows/game-tests.yml`; modify `main.js`, `skate.html`, `css/skate.css`, `actions.js`, `package.json` and existing scene tests.

**Consumes:** Task 5 compiled world/controller and input/event contracts. **Produces:** runtime session, fixed-step loop, keyboard lifecycle and `updateFollowCamera`/`applyAvatarPose`; existing boot/dispose API stays intact.

- [ ] **F6.1 `advanceFixedStep`:** RED one-second 30/60/120 render schedules advance 60 simulation ticks and same distance within 0.02; one jump edge is consumed once across catch-up ticks; 2-second hidden interval adds zero catch-up on resume; 500 ms frame runs at most 6 ticks. Implement injected clock/RAF accumulator and bounded edge queue. GREEN deterministic ticks; helper accumulator/edge draining tests included.
- [ ] **F6.2 Keyboard/pointer adapter:** RED held keys map throttle/brake/steer/Shift and edge actions; keyup, blur, hidden and dispose neutralize; form typing/preview does not trigger movement; camera drag/scroll/cancel release capture. Implement `{sample,reset,dispose}`; prevent default only for handled game controls while playing. GREEN simultaneous keys, first/held/released press sequences and idempotent disposal pass.
- [ ] **F6.3 `updateFollowCamera` / `applyAvatarPose`:** RED `followCamera_traversesWithoutManualLook` completes the fixture route with neutral CameraInput; `followCamera_crossesPolesWithoutFlip` preserves continuous local up; `followCamera_stopReverseAndTricksDoNotSnap` checks idle view retention, bounded smooth turn response and independence from trick transforms; `followCamera_collisionRecoversSmoothly` prevents wall/planet clipping then restores boom distance without a jump. Add `followCamera_manualReleaseRecentersOnlyWhileMoving`: no return before 1,500 ms, smooth return begins at that boundary while moving, stationary view is retained; zoom clamps 3–8. Implement the CameraState contract and Messenger-inspired shoulder/look-ahead framing, plus rigid avatar mapping with feet on support. GREEN mathematical tests, browser route visibility/occlusion and portrait/landscape player framing; resize never changes skater heading or leaves preview orbit attached. Reduced motion disables optional sway, not essential automatic following.
- [ ] **F6.4 Runtime/Join:** RED `localSkating_joinMovesWithoutBackend`: click Join, hold W and observe position/distance change through the real loop; Space produces one jump then a landing, camera follows, leave returns preview. Implement runtime composition and small HUD/status; appearance preserved within guest session; reload resets it. GREEN no backend required. Refactor scene test to a separate canvas so it cannot replace the live renderer.
- [ ] **F6.5 Lifecycle/failure:** RED repeated join/leave/dispose stops RAF, clears input/listeners/observers, and no changes occur after disposal; WebGL unavailable/context loss shows a visible retry/error instead of only a console log. Implement owned-resource registry with rollback on partial boot; cached geometry teardown includes detached accessories. GREEN twice-dispose safe and render/heap resources return to stable baseline.
- [ ] Add PR CI now: lockfile install, browser install, unit/browser tests, no secrets/deploy; `test:unit` and configured E2E fail if empty. Workers remains explicitly not-yet-implemented until Task 10, not described as tested.
- [ ] Per function RED→GREEN; focused commands `npm run test:unit -- tests/unit/fixed-step.test.js tests/unit/follow-camera.test.js tests/unit/keyboard-mouse.test.js`, `npm run test:e2e -- tests/e2e/local-skating.spec.js`, then `npm test`. Expected: keyboard actions change actual simulation and rendered pose, not test-injected scores/positions.
- [ ] Manual checkpoint: with manual camera input untouched, skate a complete connected lap in both directions, enter/leave the ramp, jump/land, collide with a building, cross changed orientations and return to spawn. Then test optional look/release, stopping, reversal and an alley obstruction. Compare with Messenger's automatic over-the-shoulder readability, not JSR camera fidelity; record comfort, route visibility, shoulder/boom/look-ahead tuning and screenshots in the device matrix. Repeat the camera-only hands-off requirement with gamepad/touch in Tasks 7–8. The automated loop is necessary but not a substitute for this check.
- [ ] Commit: `feat: add playable offline skating and planet follow camera`.

## Task 7 — Milestone 6: Gamepad and Mobile Parity [Critical]

**Outcome:** All three day-one control schemes independently play the same local loop without sticky or double-triggered actions; mobile actually shows the game.

**Files:** Create `js/game/input/gamepad.js`, `js/game/input/touch.js`, `js/game/input/input-router.js`, `tests/unit/gamepad.test.js`, `tests/unit/touch.test.js`, `tests/unit/input-router.test.js`, `tests/e2e/input-devices.spec.js`; modify session, HTML/CSS/help and device matrix.

**Consumes:** Task 6 runtime/adapter lifecycle. **Produces:** gamepad/touch adapters and `selectActiveInput` with the same normalized axes/edges, no physics/network imports.

- [ ] **F7.1 Gamepad:** RED axes inside dead zone 0.15 return neutral, diagonal axes clamp, analog half-throttle remains half-throttle, A/X/Y/LT/B/D-pad/right stick map as contracted, missing device/disconnect resets held and queued edges. Implement gamepad sampling with previous-button state and standard mapping validation. GREEN unit tests and browser simulated device acceptance; unsupported mapping shows a keyboard/touch fallback.
- [ ] **F7.2 Touch:** RED multi-pointer stick/buttons work together, one pointer cannot release another's action, touchcancel/lostcapture/orientation/resize neutralize and release capture. Implement virtual stick, visible >=44 CSS pixel action targets and grind hold; suppress scroll only on interactive play surface, respect safe-area insets. GREEN browser touch events steer/jump in the real loop at 390×844 and landscape; card collapses after Join and does not cover player/essential HUD.
- [ ] **F7.3 `selectActiveInput`:** RED idle gamepad noise cannot steal active keyboard/touch, device switches drop stale edges, form focus pauses gameplay actions, keyboard blur clears pointer state too. Implement most-recent intentional-device ownership (gamepad activation threshold 0.2). GREEN held axes are never summed from competing devices. Helpers: edge detection, axis dead-zone remap and ownership thresholds under owner tests.
- [ ] Per function RED→GREEN; run `npm run test:unit -- tests/unit/gamepad.test.js tests/unit/touch.test.js tests/unit/input-router.test.js`, `npm run test:e2e -- tests/e2e/input-devices.spec.js`, then `npm test`; expected all three device loops covered separately.
- [ ] Manual day-one gates: keyboard/mouse, one physical gamepad including unplug, and one real iOS/Android phone including orientation/background/re-entry. Record baseline frame times and usability now, not after networking. Without physical hardware mark gate pending, never completed by emulation.
- [ ] Commit: `feat: add gamepad and touch skating parity`.

## Task 8 — Milestone 7: Real Rail Traversal and Event-Driven Trick Flow [Critical]

**Outcome:** A real skate → jump/ramp → grind → dismount → landing line feels connected and produces a context-validated local chain; no server required.

**Files:** Create `js/game/core/grind-state.js`, `js/game/core/trick-combo.js`, `js/game/ui/hud.js`, `tests/unit/grind-state.test.js`, `tests/unit/trick-combo.test.js`, `tests/e2e/trick-flow.spec.js`; extend city-skater, shared catalogs/tuning, runtime and device help/tests.

**Consumes:** real Task 5 support/rail queries and Tasks 6–7 inputs/clock. **Produces:** `stepGrind(state,input,dt,world) -> {state,events}` and `reduceCombo(combo,event,world,tuning) -> ComboState` with score/bank events for later duels.

- [ ] **F8.1 `stepGrind`:** RED grind requires held intent, speed>=2, capture distance<=0.8 and approach alignment>=0.65; reversed approach preserves signed rail direction; traverse by precomputed arc length; one start/end per interval; release/jump/endpoint leaves rail with continuous velocity and sane height. Implement stateful lock with 150 ms recapture cooldown, no nearest-rail oscillation. GREEN ground-adjacent button press/stationary rail cannot produce an ongoing grind. Helpers: arc-distance sampling, capture and dismount under rail tests.
- [ ] **F8.2 Trick execution:** RED trick while grounded/bailed rejected, one completed trick per jump unless another action follows its 300 ms animation duration, unknown IDs rejected, landing/bail at boundary completes or cancels deterministically. Implement grounded/air/grind transitions and typed completion events, not scoring on keydown. GREEN timing windows driven by fixed ticks and clean landing from real support.
- [ ] **F8.3 Combo reducer:** RED zero initial state; spin then grab banks 500 as a chain versus 250 isolated; same-trick repeat grants half once then zero; distinct-action multiplier caps at 5; pending value never changes banked score until clean landing; bail preserves prior bank; duplicate event ID ignored; unknown rail/arbitrary claimed duration adds zero; grind accrues 50/s from actual moving ticks only; link at 1,500 ms continues, at 1,501 ms resets, and expiry never banks an unlanded trick. Implement `createComboState`, context validation, reducer, one-shot bank and bounded event-index dedup. GREEN literal score fixtures and clean/unclean boundary cases. Helpers: catalog lookup, duplicate detection, duration bounds and multiplier tested under reducer.
- [ ] **F8.4 HUD/play:** RED browser uses W/Space/J or K/Shift and actual rail contact to update pending/banked HUD; bail and restart clear pending only; offline play still works. Implement compact score/chain feedback and preserve form settings in-session. GREEN no exposed `addPoints` test backdoor. A deterministic fixture world is allowed, not mocked movement or scores.
- [ ] Per function RED→GREEN; run `npm run test:unit -- tests/unit/grind-state.test.js tests/unit/trick-combo.test.js`, `npm run test:e2e -- tests/e2e/trick-flow.spec.js`, then `npm test`. Expected actual traversal drives score, button spam does not.
- [ ] Manual feel gate on all three devices: readable steering/braking, forgiving rail entry, useful dismount, satisfying linked route. Record proposed tuning changes/version before networking. Preserve original physics tests unless intentionally replaced by stronger documented behavior tests.
- [ ] Commit: `feat: add rail traversal and simulation-driven trick chains`.

## Task 9 — Milestone 8: Original Style, World Readability and Render Budget [Planned recommended features]

**Outcome:** A small, readable original skating vignette combines Jet Set Radio's graphic energy with Messenger's tiny-world clarity, without a heavyweight art pipeline.

**Files:** Create `js/game/render/style.js`, `js/game/render/quality.js`, `js/game/audio/game-audio.js`, `js/game/ui/play-feedback.js`, `tests/unit/avatar-pose.test.js`, `tests/unit/render-resources.test.js`, `tests/unit/game-audio.test.js`, `tests/unit/render-style.test.js`, `tests/unit/render-quality.test.js`, `tests/e2e/style-readability.spec.js`, `tests/e2e/play-feedback.spec.js`, `tests/manual/skate-city-art-direction.md`, `assets/game/README.md`; extend city-layout/surfaces/scene, avatar/pose, HUD/CSS and device matrix. Add only original/licensed local sound assets with attribution in the asset README.

**Consumes:** tested local loop and stable physical surfaces. **Produces:** REC-02 through REC-07: named landmarks/shortcut, `STYLE_TOKENS`, `createStyleMaterials`, animated `applyAvatarPose`, `createGameAudio`, `applyRenderQuality`, `captureRenderBudget`, `renderPlayFeedback` and shared render ownership that Task 10 reuses for remote avatars. The function contracts above travel with this task's brief.

- [ ] **F9.1 World/readability:** RED `cityStyle_hasLandmarksAndRejoiningShortcut` finds signal-tower plaza/skate arch and a branch that rejoins the connected main route; `authoredLine_hasSweptClearance` traverses ramp/rail/landing without props blocking it. Implement those small authored route edits on top of the seeded layout with stable feature IDs/signage. GREEN actual geometry/support matches after edits; preview and chase screenshots reviewed, both landmarks identifiable when desaturated. Do not build seven districts or switch authoring systems to imitate Messenger.
- [ ] **F9.2 `applyAvatarPose` animation:** RED `avatarPose_samplesSkatingStates` covers push/coast/crouch/jump/grind/landing/bail pivots; `avatarPose_doesNotMutateSimulation` preserves collision root/state/score; `avatarPose_reducedMotionKeepsEssentialPoses` removes optional sway only. Implement named articulated groups reusing existing primitive geometry and deterministic absolute-time animation. GREEN repeated sampling matches, local/remote pose reuse stays within 5 Hz networking, no render-driven score events.
- [ ] **F9.3 Resources/draw calls:** RED `avatar_disposalPreservesOtherGuests`, cap-on/off-then-teardown disposes detached cached geometry, and one hundred create/change/leave cycles return resource counters to baseline. Remove redundant fresh-material cloning and engine/cache from serializable data; merge/instance static details by material without losing animated pivots. GREEN base/accessory triangle ceilings preserved, target <=12 draw calls/base avatar, <=150 scene draw calls with 12 visible base avatars at low preset, no geometry disposed while another guest references it. If target conflicts with appearance/animation, profile and record tradeoff, not silently increase it.
- [ ] **F9.4 `createGameAudio`:** RED `gameAudio_requiresUserGesture`, `gameAudio_deduplicatesEventsAndCapsVoices`, `gameAudio_muteSuspendResumeDoNotStackLoops` and `gameAudio_failureLeavesPlayUsable` assert the audio contract above, including 8 transient voices/one music/one grind loop and idempotent disposal. Implement local licensed/original loop and jump/landing/grind/tag cues with volume/mute/visibility. GREEN browser unlock/mute plus injected-audio unit tests; each manifest item has source/author/license; no copied reference soundtrack.
- [ ] **F9.5 `createStyleMaterials`:** RED `style_usesSharedOriginalPalette`, `style_featureSemanticsSurviveLowQuality` and `style_hasNoRequiredOutlinePass` check material roles/shared resources across scene/avatars, not source-code strings. Implement the dusk palette and inexpensive Three-r137 toon/basic treatment; use silhouette/signage as well as color for feature meaning and readable unlit/fill shading on the planet underside. GREEN actual browser renders at front/back/pole orientations reviewed; normal DOM text contrast >=4.5:1 and no remote asset loads. Expensive postprocess outlines remain optional.
- [ ] **F9.6 `applyRenderQuality` / `captureRenderBudget`:** RED `quality_capsDprWithoutChangingSimulation` checks DPR 1/1.5 caps on a DPR-3 fixture; `quality_invalidValueFallsBackToLow`; `quality_switchPreservesPhysicsAndSocialGeometry`; `renderBudget_reportsActualCallsAndResources` exercises a rendered 12-avatar clustered fixture. Implement explicit low/standard setting, session-only override and diagnostic capture. GREEN switching does not alter collision/ticks/network/timers, physical features/tags remain visible, repeated toggles do not duplicate resources; final draw-call targets from F9.3 still hold.
- [ ] **F9.7 `renderPlayFeedback`:** RED `playFeedback_keepsMobileSkaterVisible` plays portrait/landscape with the card collapsed, `playFeedback_keyboardAccessesHelpMuteQualityAndLeave` checks focus/labels, `playFeedback_announcesEventsNotEveryFrame` checks live-region behavior, and `playFeedback_showsOfflineAndChainWithoutColorOnly` verifies readable icons/text. Implement compact session/HUD composition from existing state, including low-quality and muted indicators; do not introduce a second score store. GREEN actual input-driven bank/bail and leave work with controls >=44 CSS px; Task 11 extends the same view for duels, not a duplicate HUD.
- [ ] Per function RED→GREEN; `npm run test:unit -- tests/unit/avatar-pose.test.js tests/unit/render-resources.test.js tests/unit/game-audio.test.js tests/unit/render-style.test.js tests/unit/render-quality.test.js`, `npm run test:e2e -- tests/e2e/style-readability.spec.js tests/e2e/play-feedback.spec.js`, then `npm test`. Expected all seven F-items execute real behavior checks, measured renderer calls/resources rather than triangles/metadata alone, and local assets only.
- [ ] Human visual/feel checkpoint: record in `tests/manual/skate-city-art-direction.md` the original palette/silhouettes, JSR/Messenger lessons (no copied assets), landmark/shortcut screenshots, pose transitions, audio license inventory and mute/reduced-motion/quality checks. Approve one representative street/camera/TVHead vignette before expanding art. Check bright/underside orientations and route readability on a phone; screenshots are review artifacts, not unreviewed pixel-truth claims.
- [ ] Commit: `feat: add original skate-city presentation and render budgets`.

## Task 10 — Milestone 9: Bounded Shared Room on Local Wrangler [Critical]

**Outcome:** Two browsers skate together using the same world; 12 local guests are supported with bounded resources and recoverable failure. Existing offline movement is unaffected.

**Files:** Create `workers/skate-room/wrangler.jsonc`, `workers/skate-room/src/index.js`, `workers/skate-room/src/game-room.js`, `js/game/net/protocol.js`, `js/game/net/room-client.js`, `js/game/net/remote-buffer.js`, `scripts/game-room-load.js`, `tests/workers/game-room.test.js`, `tests/unit/room-protocol.test.js`, `tests/unit/room-client.test.js`, `tests/unit/remote-buffer.test.js`, `tests/unit/room-load-report.test.js`, `tests/e2e/multiplayer.spec.js`, `playwright.room.config.js`; modify Worker test config, package scripts, CI and runtime/HUD. No backend deploy in tests.

**Consumes:** pure Task 5 world/catalogs and Task 8 bank events; Task 9 render lifecycle. **Produces:** protocol-v1 validators, named-room DO, `RoomConnection`, `sampleRemotePose(buffer, renderTime)`, network-independent connection UI states and REC-09's local operating-envelope report tool.

- [ ] **F10.1 Bidirectional validation:** RED version/descriptor mismatch, invalid UTF-8 byte length, malformed/binary/unknown messages, NaN/Infinity/null tuples, wrong quaternion, identity override and out-of-world coordinates are rejected before mutating state. Implement separate client/server parsers with limits from contracts above. GREEN valid full 12-guest snapshot accepted even though >1,024 bytes; reject >128 KiB and >allowed collection counts. Catalog validation must not import Three or DOM.
- [ ] **F10.2 DO/runtime harness:** RED real upgrade/admission returns ephemeral ID, world/epoch/server time and snapshot; 12th accepted/13th full; missing/invalid origin/path denied; before-join pose and double-join denied; unjoined timeout at 5,000 ms and pending-upgrade cap 24 enforced. Implement Worker route, DO bindings/migration and local hibernatable sockets; use matching Wrangler config in Cloudflare Vitest. GREEN no account/secrets needed. Remove `--passWithNoTests` from Worker script once first test exists and add fail-if-empty CI gate.
- [ ] **F10.3 Pose/presence/appearance:** RED exactly 200 ms allowed, 199 ms rejected; stale seq ignored, sender pose not echoed, disconnect idempotent, original guest cannot reappear on reconnect, ACK of unsent seq denied, 64-frame/256-KiB unacked cap drops poses or disconnects without unbounded queues. Implement bounded membership, ACK accounting and 5 Hz client/server throttling; changed appearances render remotely using isolated materials. GREEN slow-client and reconnect/new-ID tests; no stored profiles/cosmetics. Use socket attachments for active-session restoration (pose/seq/limits included), not permanent guest tables; characterize actual Workerd socket API rather than mocking browser-only buffer properties.
- [ ] **F10.4 `RoomConnection`:** RED injected clock/socket tests coalesce poses, reject invalid sends, bounded backoff/jitter, close cancels timers and reconnect, old tag/score actions never replay, offline/full preserve local skating. Implement connection state handling and explicit environment URL (local `ws://127.0.0.1:8787`, HTTPS deployment needs public `wss:` endpoint). GREEN invalid server message cannot mutate remote state; snapshot/epoch replacement cleans removed guests/resources.
- [ ] **F10.5 Remote interpolation:** RED endpoints/alpha bounds, seam/pole crossing, grounded radius/support, airborne height, normalized shortest-path quaternion, out-of-order/duplicate seq and 1,000 ms silence. Implement 8-sample timestamped buffer, server-time offset and 200 ms delayed sampling; hold/fade on stale data and snap safely on respawn/discontinuity. GREEN no straight-line chord through planet, no unbounded extrapolation or memory.
- [ ] **F10.6 Real E2E:** add separate Playwright room config launching static server + local `wrangler dev` with isolated test persistence path; start/stop both on CI, fail backend readiness clearly. RED two real clients Join/skate/customize/leave/reconnect; implement runtime connections as optional dependency. GREEN peers see motion/appearance/leave, and backend interruption leaves local movement usable. Offline test suite remains independent of Wrangler.
- [ ] **F10.7 Local operating-envelope tooling:** RED `roomLoad_refusesNonLoopbackTargets` rejects nonlocal URLs before opening any socket; `roomLoad_reportsPoseAndControlTrafficSeparately` checks literal report totals/bytes from deterministic fixtures; `roomLoad_slowConsumerStaysBounded` exercises the real DO/ACK limits; `roomLoad_thirteenthGuestGetsFull` verifies admission. Implement `scripts/game-room-load.js` using the installed Node WebSocket API and aggregate counters, not a new hosted load service. CLI: `node scripts/game-room-load.js --url ws://127.0.0.1:8787/room/main --clients 12 --duration-seconds 300 --output test-results/room-load.json`; only loopback hosts are accepted, this command assumes local Wrangler is running. GREEN reports use the presentation/performance schema above, record reconnect/slow-consumer scenarios, and close all sockets/timers on completion/error; no credentials or persistent guest profiles in output.
- [ ] Per function RED→GREEN; `npm run test:unit -- tests/unit/room-protocol.test.js tests/unit/room-client.test.js tests/unit/remote-buffer.test.js tests/unit/room-load-report.test.js`, `npm run test:workers -- tests/workers/game-room.test.js`, proposed `npm run test:e2e:room -- tests/e2e/multiplayer.spec.js`, then `npm test` (include both E2E configurations without double-running offline files). Expected actual DO and two-browser tests execute; zero empty-suite exemptions.
- [ ] Run F10.7's 12-client local scenario and 13th rejection. Record accepted inbound poses, separate ACK/control traffic, recipient deliveries, bytes, buffer pressure, available memory/runtime metrics and report artifact path; baseline naive pose delivery rate <=660/s at full 5 Hz. These are diagnostic counts, not Cloudflare invoice estimates. Batch only if measurements justify it, and preserve <=5 Hz poses plus reliable social events if batching is introduced.
- [ ] Commit: `feat: add bounded ephemeral room and spherical remote playback`.

## Task 11 — Milestone 10: Visible Tags, Preset Emotes and Atomic Duels [Critical]

**Outcome:** Guests visibly tag/over-tag and complete one shared minute-long duel driven by real skating scores, with individual tag expiry and no persistent progression.

**Files:** Create `js/game/core/social-rules.js`, `js/game/render/social-scene.js`, `tests/unit/social-rules.test.js`, `tests/unit/social-scene.test.js`, `tests/workers/social-loop.test.js`, `tests/e2e/tag-duel.spec.js`; extend catalogs/protocol, room/room-client, HUD/audio/runtime and Worker lifecycle tests.

**Consumes:** world triangle anchors, Task 8 bank events and Task 10 transport/server clock/identity. **Produces:** `placeTag`, `expireTags`, `startTagDuel`, `recordDuelTrickScore`, `finishExpiredDuels`, `sendEmote`, `updateSocialScene` and corresponding client sends using the explicit contracts above.

- [ ] **F11.1 Tag intent/rules:** RED unknown style, nonrideable triangle, invalid barycentric, wrong height/world/far-side target, >2 reach and midair placement denied; at 2 reach valid; 10/120 tag caps and 2,000 ms cooldown enforced; duplicate request unchanged. Implement server point reconstruction from canonical anchors, geodesic/surface compatibility and bounded per-guest request dedup. GREEN each tag's `expiresAt=placedAt+300_000`, never derived from a common room timer. Helpers: overlap/anchor validation through actual fixtures.
- [ ] **F11.2 Atomic overtag/duel:** RED concurrent requests produce at most one active duel per guest; same-owner never self-duels; offline owner never challenged; busy participant returns busy without placing; expired/covered tag cannot trigger; nearest live visible overlap with stable tie-break. Implement a single serialized placement/cover/duel transition and reversible cover linkage. GREEN cover never extends either expiry; retry cannot duplicate a duel; `endsAt=startedAt+60_000`.
- [ ] **F11.3 Server time/score:** RED active participant's new bank delta accepted once, old-duel/pre-duel/duplicate/unknown sender denied; negative/>5,000 delta, >4 events/s or sum>50,000 denied; receive at 59,999 ms valid, at 60,000 ms rejected; tie and either winner deterministic. Implement bounded accepted-score bookkeeping from current-duel bank events and one result. GREEN bail/no-trick generates no duel points; document casual trust rather than anti-cheat claims.
- [ ] **F11.4 Expiry/recovery:** RED tag alive at 299,999 and absent at 300,000 even idle; multiple placements expire independently; live covered tags reveal on cover expiry but do not retrigger; leaving owner does not delete tags early; disconnect cancels duel without winner. Implement alarms + filtering on reads/writes and TTL storage cleanup. GREEN hibernation reconstructs connected sessions/deadlines; restored duel with absent participant cancels; incompatible world reset changes epoch/clears stale data; no permanent scores/profiles survive. Helpers for deadline ordering and result dedup under injected clock tests.
- [ ] **F11.5 Social rendering/HUD:** RED actual tag geometry sits on its triangle normal without z-fighting/far-side bleed; cover/expiry/reveal respected, emoji expires after 2,000 ms and only known presets render; duel HUD shows server-derived countdown/opponent/scores/tie/cancel, result removed after 5,000 ms. Implement bounded reusable scene resources and accessible DOM HUD. GREEN real transforms/visibility checked, hidden/removed guests release only their resources.
- [ ] **F11.6 Client actions/full loop:** RED validated `sendEmote`, `sendTag`, `sendScore` payloads contain session/duel/request IDs and no supplied owner/serverTime; stale/no-duel or paused inputs cannot send scores. Implement gameplay-to-protocol wiring; wait for server ack before authoritative tag/score rendering. GREEN two local browsers use real input to tag/over-tag, skate/trick/bank and see the same duel/result. Use fake clocks for five-minute/deadline boundaries in Worker/unit tests; no five-minute browser sleep or fake-score success path.
- [ ] **F11.7 `sendEmote`:** RED every preset accepted, unknown/free-text rejected, first receipt emitted once, 999 ms repeat rejected and 1,000 ms accepted; disconnect removes display without retaining identity. Implement the pure transition plus server/client adapters and cue. GREEN rate and lifetime tests use injected time and actual scene/HUD output, not only message mocks.
- [ ] Per function RED→GREEN; `npm run test:unit -- tests/unit/social-rules.test.js tests/unit/social-scene.test.js tests/unit/room-client.test.js`, `npm run test:workers -- tests/workers/social-loop.test.js`, `npm run test:e2e:room -- tests/e2e/tag-duel.spec.js`, then `npm test`. Expected both clients see the same one duel and independent expiries.
- [ ] Commit: `feat: add visible temporary tags emotes and atomic trick duels`.

## Task 12 — Milestone 11: Integrated Acceptance and Safe Release [Critical]

**Outcome:** Release verifies an already-playable game; it does not introduce the first gameplay composition. Keep this branch unmerged until user review.

**Files:** Extend E2E/Worker load tests, `tests/manual/device-matrix.md`, asset README and `.github/workflows/game-tests.yml`; tune only evidence-backed bottlenecks, with regression tests.

- [ ] **F12.1 Play/robustness acceptance:** RED full smoke covers Join/customize/skate/ramp/grind/trick/tag-duel/leave, offline/full/reconnecting, blur/hidden, world mismatch, WebGL loss/retry, resize and idempotent teardown. Fix only uncovered integrations with reproduced tests; GREEN no synthetic score/movement shortcuts, all three device workstreams retain their focused tests.
- [ ] **F12.2 Local load/resources:** rerun Task 10's operating-envelope tool with the final Task 11 handlers: 12 clients for five minutes, 13th full; exercise appearance churn, tag caps, reconnect and one slow consumer. Save `test-results/room-load.json` plus separate clustered/sparse browser render reports, and summarize versions/device/settings/results in the device matrix. Check bounded queues/resource counts, no stale guests/duels and no unintended pose-rate increase. Record unavailable runtime memory metrics explicitly; report local counts, not unmeasured production pricing or unlimited capacity.
- [ ] **F12.3 Real-device acceptance:** representative mid-range phone, 12 avatars, city and social visuals, five-minute session: median >=30 FPS; also record p95 frame time, worst stalls, device/OS/browser, settings and memory/context loss observations. Include sparse and clustered guests, rotate/background/resume and both muted/unmuted states. Desktop/headless results never close this checkbox. Simplify draw submissions/lighting before raising triangle budgets.
- [ ] Manual matrix: keyboard/mouse, physical controller unplug/replug, real touch phone, accessible focus/help/mute, reduced motion, quality fallback, camera comfort and readable streets under every orientation. Mark pending explicitly if hardware/inspection unavailable.
- [ ] Run `npm test` locally and CI; expected unit, actual Worker, offline-browser and local-room-browser suites all execute and pass without deployed services/accounts/secrets. Preserve existing viewer/portfolio regressions and CI behavior.
- [ ] Document production-only decisions: public WSS URL, allowed origins, DO migration/storage retention, error monitoring without persistent guest profiles, asset licenses, current Cloudflare limits/cost estimate. Do not deploy/push/merge without separate permission; preserve GitHub Pages' existing deployment branch.
- [ ] Commit: `test: verify playable skate city devices load and regressions`.

## Completion Criteria

- [x] User authorized reviewing the guide and executing revision-skipped steps; screenshots go in gitignored `artifacts/skate-progress/`.
- [ ] Tasks 5–12 pass named RED/GREEN and actual manual gates; Tasks 1–4 history preserved and Task 3's deferred route check closed in Task 6.
- [ ] A real offline skating loop and Messenger-inspired automatic over-the-shoulder camera work before the room is enabled; navigating the sphere and a linked skating line never requires manual camera management.
- [ ] The small city is physically traversable with collision, a ramp, rail, linked line and readable route choice, not only graph connectivity.
- [ ] Tricks/grinds/clean landings drive scoring; spam/duplicates/stationary rail claims cannot bank points.
- [ ] Low-poly avatars share geometry with isolated appearances, bounded draw calls and correct ownership/disposal; no profile/customization/progression persistence.
- [ ] Keyboard/mouse, physical gamepad and real mobile touch each have recorded acceptance, not adapter-only coverage.
- [ ] Original graphic presentation, legible landmarks/feature cues, simple animation and audio/mute are reviewed; optional advanced effects are not blockers.
- [ ] REC-01 through REC-09 are implemented and verified at their owning task gates: automatic camera; accessible mobile/HUD; landmarks/shortcut; original toon palette; animated TVHead; licensed local audio; quality/resource budgets; pure shared dependencies; local operating-envelope tooling. Inclusion in the guide alone does not satisfy this checkbox.
- [ ] One shared local room supports 12 clients; 13th/full/disconnect/reconnect/slow-consumer behavior is graceful and bounded.
- [ ] Tags expire individually after 300,000 ms; atomic tag-over duels end after 60,000 ms or cancel without a winner on disconnect; visible tags/emotes/HUD agree across clients.
- [ ] `npm test` and PR CI run nonempty unit, Worker, offline-E2E and Wrangler-E2E suites without production credentials/deployments.
- [ ] Representative phone sustains median >=30 FPS for five minutes with 12 avatars; frame-time/resource evidence and remaining limitations recorded.
- [ ] Existing viewer and portfolio stay unchanged in behavior; all work remains on `feat/tvhead-skate-city` pending user-approved integration.
