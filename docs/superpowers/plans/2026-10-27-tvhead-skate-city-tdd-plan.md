# TVHead Tiny-Planet Skate City — TDD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. The user requested development on a new branch; start implementation on `feat/tvhead-skate-city`. Each milestone is gated by its tests.

**Goal:** Add a browser-based, low-poly TVHead rollerblading game to the website, set in a shared miniature city built over a true sphere.

**Architecture:** Keep the existing portfolio and 3D viewer intact, adding a dedicated game page and focused game modules. Three.js renders the city locally; a single Cloudflare Worker/Durable Object room synchronizes temporary player, tag, emote, and duel state. Wrangler provides the local backend for development and tests.

**Tech Stack:** Existing local Three.js/WebGL assets, vanilla JavaScript ES modules, Vitest, Cloudflare's maintained `@cloudflare/vitest-plugin`, Playwright, Wrangler, and `http-server` for local browser tests; Cloudflare Durable Objects provide the shared room.

**Spec:** Approved design brief below; approved in conversation on 2026-10-27. This plan is the requested TDD tracking document; no separate design file is created in Plan mode.

## Global Constraints

- Start implementation on branch `feat/tvhead-skate-city`; do not implement directly on `main`.
- The game is a dedicated static page at `skate.html`; the existing viewer and portfolio must continue working.
- Use the repository's local Three.js/WebGL assets; do not require a remote CDN for the game to render.
- The rideable world is a small city built over a true spherical surface, with connected streets and skate features such as ramps and rails.
- Keep the art direction original while drawing inspiration from Jet Set Radio's movement/style and Messenger's miniature spherical city.
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

## Approved Game Brief

The experience balances casual shared-world roaming with trick-focused play. A guest enters a single shared spherical city, chooses a color and accessories for a compact low-poly TVHead rollerblader, and skates streets, ramps, and rails. Tricks chain into flow-based scores. Preset emotes provide quick social reactions. Tags expire individually five minutes after placement; placing a tag over another live player's tag starts a one-minute head-to-head scored through skating tricks. Scores and duel results are temporary.

The build proceeds as local, testable slices first, then connects the same client to one shared room. The city blockout, low-poly avatar, and each input method are tracked independently so progress is visible before the complete game is assembled.

## Function-Level TDD Tracking Rules

- Every gameplay-facing function and feature gets an individual checklist item under its milestone, with named tests and nested RED, implementation, and GREEN/regression checkboxes.
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
| `tests/workers/` | Durable Object behavior tests using the Cloudflare Vitest pool. |
| `tests/e2e/` | Browser-level page and multi-client tests. |
| `vitest.unit.config.js` | Unit test configuration. |
| `vitest.workers.config.js` | Durable Object test configuration. |
| `playwright.config.js` | Browser tests and local static/Worker servers. |

Modify `package.json`, `index.html`, and `portfolio.html` only for test/dev scripts and a link to the new game page. Keep `js/viewer.js`, `lib/`, and existing page behavior unchanged unless a test reveals a required compatibility fix.

## Review Focus

1. **Sphere poles and orientation changes:** movement and camera up must remain continuous where naive longitude/latitude controls would flip. Pin with `surfaceFrame_handlesPoleAndSeamContinuously` and `advanceAlongSphere_preservesRadiusAcrossLargeTurn`.
2. **City-route continuity:** streets, ramps, and rails must remain attached to the curved surface and form a traversable route. Pin with `cityLayout_hasConnectedRideLoop` and `surfaceQueries_followSphericalCurvature`.
3. **Tag expiry/duel timing races:** use an injected clock; one tag expires at exactly 300,000 ms and a duel ends at exactly 60,000 ms. Pin at both sides of each boundary.
4. **Disconnects and stale/invalid network state:** remove departed players, reject malformed or over-rate messages, and do not award a duel win after a participant disconnects. Pin in Worker tests.
5. **Input cancellation and low-end rendering:** keyup, gamepad disconnect, touchcancel, and resize must not leave controls stuck; 12 skaters must reuse avatar geometry and remain usable on a real phone. Pin in adapter tests and the final device checklist.

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
- [ ] Manual ride check (deferred to Task 9): this milestone has no skater/play loop or movement controls yet; verify route traversal during the integrated playtest.
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

## Task 5 — Milestone 4: Trick Flow and Score Rules

**Outcome:** Tricks and grinds produce a clear chain score suitable for one-minute duels.

**Files:** Create `js/game/core/trick-combo.js`, `js/game/ui/hud.js`, and `tests/unit/trick-combo.test.js`, `tests/e2e/trick-flow.spec.js`.

**Interfaces:** A `ComboState` contains active chain value, multiplier, and total earned score. Trick values are data in a small `TRICK_CATALOG`; a clean trick/grind extends a chain, while a bail breaks the active chain without erasing already-earned duel points.

- [ ] **Function M4-F1 — `createComboState() -> ComboState`**
  - [ ] RED: `createComboState_startsWithZeroScoreAndChain` fails before implementation.
  - [ ] Implement initial combo state.
  - [ ] GREEN: focused and full unit tests pass.
- [ ] **Function M4-F2 — `recordTrick(combo, trickId) -> ComboState`**
  - [ ] RED: `recordTrick_knownTrickAddsPoints`, `recordTrick_linkedChainOutscoresIsolatedTricks`, and `recordTrick_unknownIdAddsNoPoints` fail before implementation.
  - [ ] Implement catalog-backed trick scoring.
  - [ ] GREEN: focused and full unit tests pass.
  - [ ] Helper `getTrickDefinition`: test every catalog ID and an unknown ID.
- [ ] **Function M4-F3 — `recordGrind(combo, railId, durationMs) -> ComboState`**
  - [ ] RED: `recordGrind_validRailExtendsFlow`, `recordGrind_invalidRailAddsNoPoints`, and `recordGrind_clampsDuration` fail before implementation.
  - [ ] Implement grind scoring using rail IDs from the city layout.
  - [ ] GREEN: focused and full unit tests pass.
  - [ ] Helper `clampGrindDuration`: test zero, configured maximum, and over-maximum duration.
- [ ] **Function M4-F4 — `breakCombo(combo) -> ComboState`**
  - [ ] RED: `breakCombo_resetsChainButPreservesEarnedScore` fails before implementation.
  - [ ] Implement bail/reset behavior.
  - [ ] GREEN: focused and full unit tests pass.
- [ ] **Function M4-F5 — `landCombo(combo, clean) -> ComboState`**
  - [ ] RED: `landCombo_cleanLandingBanksChain` and `landCombo_uncleanLandingBreaksChain` fail before implementation.
  - [ ] Implement clean/unclean landing behavior.
  - [ ] GREEN: focused and full unit tests pass.
- [ ] Run `npm run test:unit -- tests/unit/trick-combo.test.js` after each function and record RED/GREEN individually.
- [ ] Add `trick-flow.spec.js`: jump/trick/land and grind paths update the HUD without requiring a network connection.
- [ ] Commit: `feat: add chained trick and grind scoring`.

## Task 6 — Milestone 5: Input Devices (Separate Day-One Workstreams)

**Outcome:** Three independent adapters produce the same `GameInput` actions; no adapter is required to understand physics or networking.

**Files:** Create `js/game/input/keyboard-mouse.js`, `js/game/input/gamepad.js`, `js/game/input/touch.js`, and `tests/unit/keyboard-mouse.test.js`, `tests/unit/gamepad.test.js`, `tests/unit/touch.test.js`.

**Interfaces:** Each adapter exports `readInput(deviceState) -> GameInput`. Mouse camera input is separate from movement input. Initial keyboard bindings: W/up accelerates, S/down brakes, A/left and D/right steer, Space jumps, J/K select tricks, F tags, and E cycles emotes; mouse drag/scroll adjusts the follow camera. Gamepad: left stick moves, A jumps, X/Y trick, B tags, and D-pad emotes. Touch: left virtual stick and right-side jump/trick/tag/emote buttons.

- [ ] **Function M5-F1 — `readKeyboardMouseInput(keys) -> GameInput`**
  - [ ] RED: `keyboardInput_mapsMovementAndActions` and `keyboardInput_clearsOnKeyupAndBlur` fail before implementation.
  - [ ] Implement keyboard action mapping.
  - [ ] GREEN: focused tests pass, including simultaneous inputs and no sticky action.
  - [ ] Helper `clampAxis`: test exact bounds, out-of-range values, and non-finite values.
- [ ] **Function M5-F2 — `readPointerCameraInput(pointerState) -> CameraInput`**
  - [ ] RED: `pointerCamera_dragOrbits`, `pointerCamera_scrollZoomIsBounded`, and `pointerCamera_cancelStopsMotion` fail before implementation.
  - [ ] Implement mouse camera controls.
  - [ ] GREEN: focused tests pass; pointer capture is released on blur/cancel.
- [ ] **Function M5-F3 — `readGamepadInput(gamepadState) -> GameInput`**
  - [ ] RED: `gamepadInput_appliesDeadZoneAndMapsButtons` and `gamepadInput_disconnectReturnsNeutralInput` fail before implementation.
  - [ ] Implement gamepad mapping.
  - [ ] GREEN: focused tests pass for axis clamp, missing device, and disconnect.
  - [ ] Helper `normalizeGamepadAxis`: test zero, dead-zone threshold, diagonal, and maximum values.
- [ ] **Function M5-F4 — `readTouchInput(touchState) -> GameInput`**
  - [ ] RED: `touchInput_mapsVirtualStickAndButtons` and `touchInput_cancelResetsAllActions` fail before implementation.
  - [ ] Implement virtual stick and touch buttons.
  - [ ] GREEN: focused tests pass for touchend, touchcancel, and multi-touch.
  - [ ] Helper `normalizeTouchStick`: test dead zone, diagonal input, and clamping.
- [ ] For each device function: add focused failing unit tests, observe RED, implement the adapter only, run its test file, and verify GREEN.
- [ ] Keyboard/mouse manual check: play the full local loop and verify keyup/blur and pointer-cancel behavior.
- [ ] Gamepad manual check: play the full local loop on one physical controller and verify disconnect resets input.
- [ ] Mobile touch manual check: play the full local loop on one real iOS or Android device and verify touchcancel/orientation behavior.
- [ ] Manual mobile check: page scrolling is suppressed only over the game controls; rotate/resize does not leave a touch held.
- [ ] Commit: `feat: add keyboard gamepad and touch controls`.

## Task 7 — Milestone 6: One Shared Realtime Room

**Outcome:** Multiple anonymous clients see each other in the same room; the local Wrangler server is the default test backend.

**Files:** Create `workers/skate-room/wrangler.jsonc`, `workers/skate-room/src/index.js`, `workers/skate-room/src/game-room.js`, `js/game/net/protocol.js`, `js/game/net/room-client.js`, `tests/workers/game-room.test.js`, `tests/unit/room-protocol.test.js`, and `tests/unit/room-client.test.js`.

**Interfaces:** One named Durable Object room represents the shared world. Client messages are versioned JSON: `join`, `pose`, `appearance`, `emote`, `tag`, and `trickScore`; server messages include `welcome`, `snapshot`, `playerJoined`, `playerLeft`, `tagPlaced`, `duelStarted`, `duelScore`, `duelEnded`, and `error`. A `Pose` is `{ position: Vec3, rotation: [x, y, z, w] }`. Pose snapshots are sent at no more than 5 Hz. Each guest gets an ephemeral server-issued ID. `RoomConnection` exposes separately tracked pose and appearance send functions plus `close()`.

- [ ] **Function M6-F1 — `parseRoomMessage(raw) -> ClientMessage | Error`**
  - [ ] RED: `parseRoomMessage_acceptsVersionedMessages`, `parseRoomMessage_rejectsMalformedOrUnknownMessages`, and `parseRoomMessage_rejectsOversizedOrInvalidFields` fail before implementation.
  - [ ] Implement versioned message parsing with a 1,024-byte maximum.
  - [ ] GREEN: protocol unit tests and Worker tests pass.
  - [ ] Helper `validateCoordinates`: test tuple length, NaN, and Infinity.
  - [ ] Helper `validateNumericFields`: test finite values and configured bounds.
  - [ ] Helper `validateEnum`: test all allowed values and unknown values.
- [ ] **Function M6-F2 — `addGuest(socket, appearance) -> Guest`**
  - [ ] RED: `addGuest_assignsEphemeralIdAndSnapshot`, `addGuest_rejectsThirteenthPlayer`, and `addGuest_doesNotPersistProfile` fail before implementation.
  - [ ] Implement room admission and initial snapshot.
  - [ ] GREEN: focused Worker tests pass at 12 and 13 connections.
  - [ ] Helper `createGuestId`: test uniqueness within a room and no persistent-profile dependency.
  - [ ] Helper `createInitialSnapshot`: test current guests and unexpired tags are returned.
- [ ] **Function M6-F3 — `updateGuestPose(guestId, pose, now) -> void`**
  - [ ] RED: `updateGuestPose_broadcastsToOtherGuests`, `updateGuestPose_limitsRateToFiveHz`, and `updateGuestPose_rejectsInvalidPose` fail before implementation.
  - [ ] Implement bounded pose updates and fan-out to the other guests in the same room.
  - [ ] GREEN: focused Worker tests pass; the sender does not receive its own pose echo.
  - [ ] Helper `poseRateLimitAllows`: test exactly 200 ms is accepted and faster repeats are rejected.
- [ ] **Function M6-F4 — `removeGuest(guestId) -> void`**
  - [ ] RED: `removeGuest_broadcastsLeaveAndCleansPresence` and `removeGuest_isIdempotent` fail before implementation.
  - [ ] Implement disconnect cleanup and active-duel disconnect notification.
  - [ ] GREEN: focused Worker tests pass.
  - [ ] Helper `cleanupGuestState`: test presence removal while still-live tags remain until expiry.
- [ ] **Function M6-F5 — `connectToRoom(url, callbacks) -> RoomConnection`**
  - [ ] RED: `connectToRoom_receivesWelcomeAndSnapshot`, `connectToRoom_reconnectsAsNewGuest`, and `connectToRoom_closesGracefully` fail before implementation.
  - [ ] Implement browser WebSocket lifecycle and reconnect state.
  - [ ] GREEN: focused unit/e2e tests pass.
  - [ ] Helper `reconnectDelay`: test bounded exponential backoff and reset after successful connection.
- [ ] **Function M6-F6 — `interpolateRemoteSkater(previous, next, alpha) -> Pose`**
  - [ ] RED: `interpolateRemoteSkater_smoothsPosition`, `interpolateRemoteSkater_keepsSphericalOrientation`, and `interpolateRemoteSkater_handlesStaleSnapshot` fail before implementation.
  - [ ] Implement render-time interpolation without increasing network send frequency.
  - [ ] GREEN: focused unit tests pass.
  - [ ] Helper `lerpVec3`: test alpha 0, 0.5, 1, and out-of-range clamping.
  - [ ] Helper `slerpQuaternion`: test normalized orientation and alpha bounds.
- [ ] **Function M6-F7 — `sendPlayerPose(connection, pose, now) -> void`**
  - [ ] RED: `sendPlayerPose_sendsLatestPoseAtFiveHz` and `sendPlayerPose_coalescesIntermediatePoses` fail before implementation.
  - [ ] Implement client-side pose throttling/coalescing at no more than 5 Hz.
  - [ ] GREEN: focused room-client tests pass without sending unnecessary messages.
  - [ ] Helper `poseSendIntervalElapsed`: test the 200 ms boundary and clock rollback.
- [ ] **Function M6-F8 — `sendAppearance(connection, appearance) -> void`**
  - [ ] RED: `sendAppearance_broadcastsRuntimeChanges` and `sendAppearance_rejectsInvalidValues` fail before implementation.
  - [ ] Implement validated runtime appearance updates; do not write appearance to persistent storage.
  - [ ] GREEN: focused room-client and Worker tests pass; remote clients render the updated look.
  - [ ] Helper `serializeAppearance`: test allow-listed accessory IDs and valid color format.
- [ ] For M6-F1 through M6-F4: use the Cloudflare Vitest pool with the local Durable Object runtime; run `npm run test:workers -- tests/workers/game-room.test.js` and verify each behavior goes RED then GREEN.
- [ ] For M6-F5 through M6-F8: run `npm run test:unit -- tests/unit/room-client.test.js`; verify RED then GREEN per function.
- [ ] Start local backend with `npm run dev:room` (`npx wrangler dev --config workers/skate-room/wrangler.jsonc --port 8787`). Add a 12-client local test: all 12 are present, poses fan out, and the 13th connection receives a clear full-room result.
- [ ] Confirm the room contains no persistent guest/profile/cosmetic/score table. Only short-lived tags/duels may use Durable Object storage for expiry across hibernation.
- [ ] Commit: `feat: add shared ephemeral skate room`.

## Task 8 — Milestone 7: Emotes, Temporary Tags, and One-Minute Duels

**Outcome:** The social interaction loop works for guests and expires without persistent progression.

**Files:** Extend `workers/skate-room/src/game-room.js`, `js/game/net/protocol.js`, `js/game/net/room-client.js`, and `js/game/ui/hud.js`. Create `tests/workers/social-loop.test.js`, `tests/unit/social-protocol.test.js`, `tests/unit/room-client.test.js`, and `tests/e2e/tag-duel.spec.js`.

**Interfaces:** `TAG_TTL_MS = 300_000`; `DUEL_DURATION_MS = 60_000`; `TAG_OVERLAP_DISTANCE = 1.5` world units measured along the spherical surface. A tag record is `{ id, ownerId, styleId, position, placedAt, expiresAt, coveredByTagId }`. An overtag covers the previous tag visually but does not change either tag's original expiry; covered tags cannot start duplicate duels. A duel record is `{ id, challengerId, targetId, startedAt, endsAt, scores, status }`. Use an injected clock in all time-dependent rules.

- [ ] **Function M7-F1 — `sendEmote(guestId, emoteId, now) -> void`**
  - [ ] RED: `sendEmote_broadcastsPreset` and `sendEmote_rejectsFreeTextAndRateLimits` fail before implementation.
  - [ ] Implement preset emote broadcast.
  - [ ] GREEN: focused Worker tests pass.
  - [ ] Helper `isAllowedEmote`: test every catalog value and unknown values.
  - [ ] Helper emote rate limiter: test allowed and too-frequent inputs.
- [ ] **Function M7-F2 — `placeTag(guestId, styleId, position, now) -> TagResult`**
  - [ ] RED: `placeTag_projectsToRideableSurface` and `placeTag_setsExactFiveMinuteExpiry` fail before implementation.
  - [ ] Implement tag creation and the tag-overlap trigger.
  - [ ] GREEN: focused Worker tests pass; a new overlapping tag covers the old tag visually without extending its expiry and starts a duel only when its owner is online.
  - [ ] Helper `projectTagToRideSurface`: test valid and non-rideable positions.
  - [ ] Helper `tagOverlapDistance`: test overlap and non-overlap on the sphere, including across a longitude seam.
  - [ ] Helper `isAllowedTagStyle`: test every preset and unknown style IDs.
- [ ] **Function M7-F3 — `expireTags(now) -> ExpiredTag[]`**
  - [ ] RED: `expireTags_keepsTagBeforeBoundary`, `expireTags_removesAtBoundary`, and `expireTags_expiresEachTagIndependently` fail before implementation.
  - [ ] Implement per-tag expiry and cleanup.
  - [ ] GREEN: fake-clock Worker tests pass at 299,999 ms and 300,000 ms.
- [ ] **Function M7-F4 — `startTagDuel(challengerId, targetId, now) -> Duel`**
  - [ ] RED: `startTagDuel_startsForLiveConnectedOwner`, `startTagDuel_ignoresExpiredOrCoveredTag`, and `startTagDuel_doesNotStartForOfflineOwner` fail before implementation.
  - [ ] Implement one-minute duel creation with server time.
  - [ ] GREEN: focused Worker tests pass with `endsAt = startedAt + 60_000`.
  - [ ] Helper `findOverlappingTag`: test live, expired, and covered tags.
  - [ ] Helper `isGuestOnline`: test present and disconnected owners.
- [ ] **Function M7-F5 — `recordDuelTrickScore(duelId, guestId, points, now) -> Duel`**
  - [ ] RED: `recordDuelTrickScore_countsParticipantCombo`, `recordDuelTrickScore_rejectsNonParticipant`, and `recordDuelTrickScore_stopsAtEndTime` fail before implementation.
  - [ ] Implement bounded temporary score updates; do not treat client physics as anti-cheat.
  - [ ] GREEN: focused Worker tests pass; duplicate/stale event tests also pass.
  - [ ] Helper `clampTrickPoints`: test zero, negative, valid, and over-limit values.
  - [ ] Helper `hasProcessedScoreEvent`: test first receipt and repeated event IDs.
- [ ] **Function M7-F6 — `finishExpiredDuels(now) -> DuelResult[]`**
  - [ ] RED: `finishExpiredDuels_selectsWinnerOrTieAtBoundary` and `finishExpiredDuels_cancelsOnDisconnect` fail before implementation.
  - [ ] Implement one-result broadcast and ephemeral cleanup.
  - [ ] GREEN: fake-clock Worker tests pass at 59,999 ms and 60,000 ms; no result is stored permanently.
  - [ ] Helper `compareDuelScore`: test either player winning and a tie.
  - [ ] Helper `cancelDuelOnDisconnect`: test cancellation without a winner.
- [ ] **Function M7-F7 — `renderTagDuelHud(state) -> void`**
  - [ ] RED: `tagDuelHud_showsOpponentTimerAndScore` and `tagDuelHud_clearsAfterResult` fail before implementation.
  - [ ] Implement temporary duel UI.
  - [ ] GREEN: Playwright browser tests pass.
  - [ ] Helper `formatDuelTime`: test 60 seconds, 1 second, and zero.
- [ ] **Function M7-F8 — `sendEmoteAction(connection, emoteId) -> void`**
  - [ ] RED: `sendEmoteAction_sendsOnlyPresetMessage` fails before implementation.
  - [ ] Implement the client emote message using the shared protocol.
  - [ ] GREEN: focused room-client tests pass; unknown/free-text payloads are not sent.
- [ ] **Function M7-F9 — `sendTagAction(connection, styleId, position) -> void`**
  - [ ] RED: `sendTagAction_sendsValidatedTagRequest` fails before implementation.
  - [ ] Implement client tag placement request.
  - [ ] GREEN: focused room-client tests pass for valid and invalid style/position values.
  - [ ] Helper `serializeTagPosition`: test finite coordinates and normalized surface orientation.
- [ ] **Function M7-F10 — `sendTrickScoreAction(connection, duelId, points, eventId) -> void`**
  - [ ] RED: `sendTrickScoreAction_sendsCurrentDuelScoreEvent` fails before implementation.
  - [ ] Implement client score-event sending from the trick-combo result.
  - [ ] GREEN: focused room-client tests pass; stale/no-duel scores are not sent.
- [ ] For M7-F1 through M7-F6: use fake time; run `npm run test:workers -- tests/workers/social-loop.test.js`; verify the named boundary cases RED then GREEN per function.
- [ ] For M7-F8 through M7-F10: run `npm run test:unit -- tests/unit/room-client.test.js`; verify RED/GREEN per function.
- [ ] Run `npm run test:e2e -- tests/e2e/tag-duel.spec.js` against local Wrangler; two browser clients place/over-tag, score tricks, and see the same duel state.
- [ ] Commit: `feat: add temporary tags and trick duels`.

## Task 9 — Milestone 8: Full Playtest, Performance, and Safe Release

**Outcome:** The game is demonstrably playable with all three control schemes, a spherical city, and up to 12 guests; no live paid usage is required to run regular tests.

**Files:** Extend `tests/e2e/`, add `tests/manual/device-matrix.md`, and add `.github/workflows/game-tests.yml` to run non-deployed tests on pull requests.

- [ ] **Function M8-F1 — `startSkateGame({ root, THREE }) -> { dispose() }`**
  - [ ] RED: `startSkateGame_joinsAndPlaysFullLocalLoop` fails before full game wiring.
  - [ ] Implement final game composition from the tested modules.
  - [ ] GREEN: browser smoke passes for join, customize, skate, trick, tag-duel, and leave.
  - [ ] Helper sub-check: `dispose()` stops the animation loop, removes listeners, closes WebSocket, and is idempotent.
- [ ] **Function M8-F2 — `showConnectionState(state) -> void`**
  - [ ] RED: `connectionState_showsConnectingConnectedFullOfflineAndReconnecting` fails before implementation.
  - [ ] Implement status feedback without blocking local movement.
  - [ ] GREEN: focused browser test passes for every supported state.
- [ ] Add end-to-end test: two clients observe appearance, emote, and temporary tag changes; one tag-over event starts one shared duel and both see trick-score updates.
- [ ] Run all suites: `npm test`; expected: unit, Worker, and browser suites pass with no Cloudflare account/network deployment required.
- [ ] Run the 12-client Worker test and record duration, memory, outbound message volume, and Worker request counts; tune update frequency down if needed while preserving visible interpolation.
- [ ] Manual device matrix: desktop keyboard/mouse; one physical gamepad; one real iOS or Android touch device; resize/orientation change; reconnect/disconnect; reduced-performance graphics settings.
- [ ] Performance acceptance: with 12 avatars in the city on a representative mid-range phone, maintain a median of at least 30 FPS during a five-minute local session. Record device/browser and measured result; simplify city/lighting before increasing model budget if it fails.
- [ ] Add pull-request CI for unit, Worker, and browser tests. CI must not deploy a Worker or access production credentials.
- [ ] If a public preview is requested, configure a Cloudflare preview deployment manually and check the account's current free-tier usage limits first. Keep GitHub Pages deployment on its existing main-branch workflow.
- [ ] Commit: `test: verify skate game playtest and regressions`.

## Completion Criteria

- [ ] All milestone/function entries above are individually checked, including the nested helper checks.
- [ ] `npm test` passes locally and in pull-request CI.
- [ ] A 12-client local room test passes; 13th-player behavior is graceful.
- [ ] The small city is traversable on the spherical surface and contains at least one ramp and one grind rail.
- [ ] Low-poly avatar and runtime customization pass the triangle/reuse tests.
- [ ] Keyboard/mouse, gamepad, and mobile touch work in their separate checklists.
- [ ] Tags expire individually after five minutes; tag-over duels end after one minute and award only temporary trick-chain scores.
- [ ] No guest profile, customization, world score, or permanent leaderboard is saved.
- [ ] Existing viewer and portfolio pages still pass regression tests.
- [ ] All work remains on `feat/tvhead-skate-city` until the user reviews and approves integration.
