# TVHead Skate City Playability and Comic Art Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a complete local skating line with reliable controller input, discoverable in-play controls, automatic launch/grind/balance, visible tricks/graffiti, a Blender-rigged TVHead and a Kenney-based comic-book city.

**Architecture:** Preserve the current pure world/simulation and fixed-step runtime boundaries. Input, local social rules, asset lifetime, skeletal animation and comic presentation remain separate modules composed by `main.js`; rendering never drives physics or scoring. This is one integrated vertical slice, staged into independently testable deliveries; networking and duels remain on the older roadmap.

**Tech Stack:** JavaScript ES modules, existing global Three.js r137 plus matching locally vendored legacy addons, Vitest 5, Playwright, Python/Blender 5.2 LTS, GLB and local SVG/PNG assets. No new runtime framework, renderer migration, paid assets or hardware drivers.

**Spec:** `docs/superpowers/specs/2026-10-28-skate-city-playability-and-comic-art-design.md` (user approved 2026-10-28).

**Approved playtest reprioritization (2026-10-28):** Steam Controller-specific acceptance is deferred; other gamepads have user-reported movement/Jump/camera success. Complete the bounded wall-fall/escape correction and visible Kenney building integration, then stop for a user playtest before new mechanics. Evidence, limits and the review checklist are in [`../../reviews/2026-10-28-collision-and-visible-assets-checkpoint.md`](../../reviews/2026-10-28-collision-and-visible-assets-checkpoint.md). This checkpoint is not completion of the full authored-route/tag-target Task 4 or waiver of the Task 5 mechanics review.

## Global Constraints

- Keep radius 32, widened streets, established character scale and local camera distances; preserve spherical/contact up, ordinary collision-stop and original viewer/portfolio behavior.
- Keep original OBJ/downloads untouched. Deliver a separate editable `.blend`, exported `.glb`, and reproducible Blender authoring/export script.
- All production assets are served locally; there is no runtime dependency on Downloads or a third-party asset CDN. Copy only selected assets and their dependencies/license.
- Use downloaded `C:\Users\User\Downloads\kenney_city-kit-industrial_2.0` (CC0); 37 GLBs, 3,139,644 bytes before textures. Blender executable: `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`. Reference `atltvhead.obj`; missing `atltvhead.mtl` is known, not an import blocker.
- Keep one Three.js revision/engine per page. Use r137 `examples/js` global addons, which were verified installed, not newer `three/addons` or WebGPU APIs. Leave unrelated pages' scripts unchanged.
- Preserve fixed 60 Hz simulation, six-tick/100 ms catch-up cap, input edges consumed once, and clearing queued edges on focus/visibility/device invalidation.
- Automatic launch: speed >=3, upward speed 4, once per directed marked-lip crossing; retain manual Jump. No continuous flat-ground hopping.
- Automatic capture: speed >=2, feet distance <=0.8, absolute approach alignment >=0.65; airborne or explicit support connection only; 150 ms recapture cooldown. No held Grind button.
- Balance in [-1,1]; failure dismounts and loses unbanked chain, not compulsory respawn. Horizontal steering corrects balance during grind.
- Graffiti: designated visible walls/containers/skate surfaces, reach <=2, grounded placement, 2,000 ms cooldown, 10 local live tags, individual five-minute lifetimes, clear on Leave. Emotes live 2 seconds.
- Character: <=5,000 base/7,500 accessorized triangles, named skeleton/weighted mesh and editable clips; <=12 base-avatar draw-submission target. Twelve-avatar low-scene target <=150 measured draw calls. DPR caps 1 low/1.5 standard; do not raise targets silently.
- Paper/cream + black ink + orange emphasis throughout the world/character/UI; stable automatic camera, no mandatory shake/FOV kicks. Touch controls >=44 CSS px, normal text contrast >=4.5:1, player/HUD unobscured at 390×844 and 844×390.
- Local-only state is not a server acknowledgement. No multiplayer, duels, persistence/accounts, new soundtrack work, public deploy, push or merge in this plan. Prior physical controller/phone and full-lap gates stay open until actually performed.

## Review Focus

1. Steam Input exposes no pad, a nonstandard pad, two pads or a replacement at the same index: diagnostics stay truthful, mapping is explicit, stale input never transfers (Tasks 1–2).
2. A queued Jump/Tag precedes form focus, Help, blur or hidden state: it must not execute after resume or leave/rejoin, and closing Help must not resume a context-lost game (Tasks 1–2, 7).
3. A high-speed step crosses a lip, rail end or small tag panel between samples: detect swept transitions, preserve physical clearance and reject through-wall/far-side tagging (Tasks 4–7).
4. Slow/failed GLB or external texture loading finishes after retry/dispose: no duplicate scene, leaked resources or false-ready status (Tasks 3, 9).
5. Skinned avatar copies, outlines and decals share geometry/textures: leaving one instance must not damage another, and quality toggles must not change contacts or hide gameplay (Tasks 9–12).

## File map and execution conventions

| Owner | Files and responsibility |
| --- | --- |
| Input | Existing `input/gamepad.js`, `input-router.js`, `keyboard-mouse.js`, `touch.js`; new `input/gamepad-mapping.js` owns device mapping/calibration, not physics. |
| Runtime | Existing `core/fixed-step.js`, `runtime/game-session.js`; new `runtime/input-lifecycle.js` binds focus/visibility/modal suspension. |
| Controls UI | New `ui/controls-panel.js`; `skate.html`/`css/skate.css` expose Help, hints, diagnostics and later quality. |
| Assets | New `assets/game/manifest.json`, `assets/game/README.md`, `scripts/import-game-assets.js`, `render/game-assets.js`; curated GLBs/textures/licenses and r137 addon copies under `lib/game/`. |
| World | Existing `world/city-layout.js`, `city-surfaces.js`, `city-queries.js`; new `world/skate-paths.js` and `world/tag-targets.js` own canonical path/target transforms. |
| Mechanics | New `core/launch-state.js`, `grind-state.js`, `trick-state.js`, `trick-combo.js`, `local-play.js`, `shared/skate-tuning.js`; extend `core/city-skater.js`. `local-play.js` composes pure fixed-tick local state, not renderer callbacks. |
| Local social | New `core/local-social.js`, `render/social-scene.js`, `assets/game/graffiti/*`; no network transport. |
| Character | New `scripts/build-tvhead.py`, `scripts/check-tvhead.py`, `assets/game/source/tvhead.blend`, `assets/game/models/tvhead.glb`, `render/animated-avatar.js`; existing `avatar-pose.js` retains contact-root orientation. |
| Presentation | New `render/style.js`, `quality.js`, `action-effects.js`, `ui/play-feedback.js`; extend `render/city-scene.js`, avatar material conversion, game-only CSS and composition. |
| Acceptance | New/extended tests named below, `tests/fixtures/skate-line.js`, `tests/manual/skate-city-art-direction.md`, existing device matrix. |

Paths in the map are beneath `js/game/` unless otherwise prefixed. Every task reads the spec, constraints and preceding Interfaces blocks. Extend existing tests instead of replacing them with easier assertions. Test fixtures may construct real worlds and inject clocks/devices; they may not teleport the mounted player, add points, fake physics events or change production behavior for tests.

Use the existing `feat/tvhead-skate-city` checkout preference unless the user chooses isolation at execution handoff. Run the current full `npm test` baseline before implementation. Track RED→GREEN evidence, review rulings, commits and pending manual gates in the execution ledger. Each task ends with focused checks plus `npm test` and a commit; stage only its own files. If a plan-level test snippet needs a fixture, implement that fixture in its named owner test file, not a production backdoor.

### Task 1: Correct controller ownership, stale-control gating and queued resets

**Files:** Modify `js/game/input/{gamepad,input-router,keyboard-mouse,touch}.js`, `js/game/core/fixed-step.js`, `js/game/runtime/game-session.js`, `js/game/main.js`; create `js/game/runtime/input-lifecycle.js`; extend `tests/unit/{gamepad,input-router,keyboard-mouse,touch,fixed-step,game-session}.test.js`, create `tests/unit/input-lifecycle.test.js`; extend `tests/e2e/input-devices.spec.js`.

**Interfaces:** Preserve adapter `{sample,sampleCameraInput,reset,dispose}` and normalized `InputFrame`. Add `router` option `onInvalidated(reason)` called on ownership/device invalidation; `clearPendingInput(loopState) -> LoopState` empties edges while preserving poses/tick. Extend session with `invalidateInput()`, `suspend(reason)`, `restore(reason)` and `elapsedPlayMs = fixedStep.tick*fixedStep.stepMs` in frame/getState (no hidden/suspended or discarded catch-up time); existing `pause/resume` delegate to reason `manual`. `bindInputLifecycle({target,documentObject,form,canvas,session,input}) -> {dispose}` owns listeners. Reasons form a Set; clearing `controls` cannot clear `context-lost`, `visibility` or `blur`.

- [x] **1. RED:** Add named tests `gamepad_gradualStickAcquiresOwnership` (0→0.70 in 0.01 increments), `gamepad_newJumpWorksWhileOtherControlIsSuppressed`, `gamepad_replacementDoesNotReuseEdges`, `fixedStep_clearPendingPreservesPoseAndTick`, `session_modalCloseCannotResumeContextLoss`, `inputLifecycle_formBlocksEveryDevice`. Pin expectations: `expect(router.getActiveDevice()).toBe('gamepad')`, new Jump true exactly once, queued Jump/Tag false after invalidation, elapsed play clock unchanged while suspended.

  ```js
  expect(router.getActiveDevice()).toBe('gamepad');
  expect(freshButtonFrame.jumpPressed).toBe(true);
  expect(resumedTickInput).toMatchObject({ jumpPressed: false, tagPressed: false });
  ```
- [x] **2. Verify RED:** `npm run test:unit -- tests/unit/gamepad.test.js tests/unit/input-router.test.js tests/unit/fixed-step.test.js tests/unit/game-session.test.js tests/unit/input-lifecycle.test.js`; confirm each fails on the audited behavior/missing interface, not fixture mistakes.
- [x] **3. GREEN implementation:** In gamepad, track intentional baseline/activation crossing with 0.2 activation/0.15 release hysteresis; reset arms stale controls separately, and identity includes ID/index/connection generation. Independent new buttons/camera remain usable. Emit invalidation before preserving the current sample's fresh edge. Route session reset through `clearPendingInput`, derive elapsed play milliseconds from advanced ticks, and use suspension reasons for forms/modals/window lifecycle. Detect editable focus continuously as well as on focus events; do not resume play on form focusout unless focus returned to game controls/canvas.
- [x] **4. Verify GREEN:** Re-run named unit files; extend browser acceptance with gradual stick ramp and held-stick Join→fresh A; run `npm run test:e2e -- tests/e2e/input-devices.spec.js` and `npm test`. Existing analog half-throttle/noise, keyboard/mouse/touch and camera tests must remain green.
- [x] **5. Commit:** `fix: make controller activation and input resets reliable` (only the files above plus ledger evidence).

### Task 2: Ship in-play Help, honest diagnostics and session-only remapping

**Files:** Create `js/game/input/gamepad-mapping.js`, `js/game/ui/controls-panel.js`; modify `js/game/input/gamepad.js`, `js/game/main.js`, `skate.html`, `css/skate.css`, `tests/manual/device-matrix.md`; create `tests/unit/gamepad-mapping.test.js`, `tests/e2e/controls-panel.spec.js`; extend `tests/unit/{gamepad,input-router}.test.js`.

**Interfaces:** `GamepadMapping = {deviceId, axes:{steer,throttleBrake,cameraYaw,cameraPitch}, buttons:{jump,spin,grab,tag,emoteUp,emoteRight,emoteDown,emoteLeft,menu,confirm,cancel}}`; axis bindings `{index,invert}`, button bindings nonnegative index. `normalizeGamepad(raw,mapping) -> {axes,buttons}` returns the existing standard-order four-axis/17-button arrays after validated mapping (logical mappings may alias confirm=jump/cancel=tag). Adapter gains `getDiagnostics() -> {devices,selectedIndex,normalized,status}`; devices contain raw ID/index/mapping/axes/buttons, normalized uses that mapping, and reading it emits no gameplay intent. Add `selectGamepad(index|null)` and `setMapping(mapping|null)`; no persistence. `bindControlsPanel({root,session,input,gamepad,onFocusPlay}) -> {render,dispose}` suspends/restores reason `controls`; `render()` polls menu rising edges each visible play frame, and while open a panel-owned RAF continues menu polling with a 100 ms throttle on diagnostics DOM updates. Stop its RAF on close/dispose/hidden; do not run physics from it.

- [x] **1. RED:** `mapping_unknownRequiresExplicitBindings` rejects missing/out-of-range/same-axis camera aliases unless explicitly chosen; `mapping_preservesHalfThrottle` asserts 0.5. Browser `controls_playKeepsHintsAndHelpVisible`, `controls_diagnosticsReadWhilePaused`, `controls_nonstandardCalibrationDrivesJump`, `controls_noPadExplainsSteamInput`, `controls_confirmCloseDoesNotJump` cover real UI and subsequent simulation events. Opening/closing with keyboard, touch and standard pad must not fire Tag/Jump behind the dialog; tab/escape returns focus safely.

  ```js
  expect(normalizeGamepad(rawHalfStick, standardMapping).axes[1]).toBe(-0.5);
  await expect(page.getByRole('button', { name: 'Controls', exact: true })).toBeVisible();
  expect(eventsAfterMenuClose.filter(e => e.type === 'jumped')).toHaveLength(0);
  ```
- [x] **2. Verify RED:** `npm run test:unit -- tests/unit/gamepad-mapping.test.js`; `npm run test:e2e -- tests/e2e/controls-panel.spec.js`; expect missing controls/diagnostic/calibration behavior.
- [x] **3. GREEN implementation:** Standard defaults retain left-stick/A/X/Y/B/D-pad/right-stick mapping; Start/menu=9, confirm=0, cancel=1, D-pad navigation=12–15. Collect one requested binding at a time from neutral→intent sample, wait for release between calibration prompts, validate all indices and allow Cancel/Reset. Poll raw input for menu navigation separately from suspended gameplay; rising edges repeat only after release. Explain that no exposed pad cannot be remapped by the page and Steam desktop bindings may emit keyboard/mouse. Never require Chrome, install drivers or claim direct Steam HID support.
- [x] **4. Verify GREEN:** Focused unit/browser commands then `npm test`; verify 44px targets, visible hints at both mobile sizes, Space/Enter native buttons and W/J behavior outside dialogs. Quality is not advertised until Task 11 makes it functional.
- [x] **5. Commit:** `feat: add in-game controls and controller calibration`.

### Task 3: Deliver licensed local Kenney assets and a cancellable r137 loader

**Files:** Create `scripts/import-game-assets.js`, `assets/game/manifest.json`, `assets/game/README.md`, `assets/game/kenney-industrial/{License.txt,*.glb,Textures/colormap.png}`, `lib/game/{GLTFLoader,SkeletonUtils,BufferGeometryUtils}.js`, `lib/game/LICENSE`, `js/game/render/game-assets.js`; modify only game-page script loading/boot (`skate.html`, `js/game/main.js`) and late-boot/retry cases in `tests/e2e/local-skating.spec.js`; create `tests/unit/game-assets.test.js`, `tests/e2e/game-assets.spec.js`.

**Interfaces:** Import CLI `node scripts/import-game-assets.js --source <pack-directory> [--output <asset-directory>] [--check]` copies/checks an allowlist and emits a deterministic JSON manifest with ID, relative URL, SHA-256, dependencies, native bounds, author/license and intended role. Default output is `assets/game/kenney-industrial`; unit tests use a dedicated temporary output, never overwrite production or Downloads. Select `building-a` through `building-h`, `shipping-container-a`, `water-tower`, `chimney-basic`, `detail-tank`; keep excluded models outside production. `loadGameAssets({THREE,manifest,signal,onProgress}) -> Promise<AssetLibrary>`; library `{get(id),retain(id),release(id),dispose()}` refcounts shared geometry/textures. `get` returns an immutable template; retained clones release their references separately from the library's own template ownership. Missing/failed dependencies reject with asset ID; late results after abort are disposed. Composition receives the loaded library through `startSkateGame({root,THREE,assets})`; preserve its synchronous return object's existing fields/methods, with browser boot doing asynchronous loading before calling it. Late-boot tests must pass normally loaded assets, not bypass the loader.

- [x] **1. RED:** `assets_allowlistCopiesAllTextureDependencies`, `assets_rejectsPathTraversalAndBadHash`, `assets_sharedModelSurvivesOneRelease` and browser `assets_failedTextureOffersRetry`, `assets_lateLoadAfterRetryDoesNotMountOldScene`. Assert every manifest URI resolves locally and abort/retry leaves one canvas/RAF/scene owner.

  ```js
  expect(manifest.assets.every(a => a.url.startsWith('assets/game/'))).toBe(true);
  expect(missingLocalDependencies).toEqual([]);
  expect(mountedSceneOwnersAfterRetry).toBe(1);
  ```
- [x] **2. Verify RED:** `npm run test:unit -- tests/unit/game-assets.test.js`; `npm run test:e2e -- tests/e2e/game-assets.spec.js`; failures must identify absent manifest/loader/retry behavior.
- [x] **3. GREEN implementation:** Copy exact r137 legacy addons from installed `node_modules/three/examples/js/` with Three LICENSE and hash provenance; load after existing `lib/three.min.js`, never a second engine. Preserve the public `startSkateGame` return contract: async asset boot finishes before composition calls it; existing rollback/dispose/retry behavior stays. Keep the live primitive character until Task 9 replaces it. Register asset cleanup before requesting resources and keep pending Join disabled with truthful progress/retry text.
- [x] **4. Verify GREEN:** `node scripts/import-game-assets.js --source "C:\Users\User\Downloads\kenney_city-kit-industrial_2.0" --check`; focused unit/browser then `npm test`. Offline mounting must request no CDN and remain correct under a delayed/aborted GLB/PNG response.
- [x] **5. Commit:** `feat: add local licensed city assets and safe loading`.

### Task 4: Author canonical Kenney blocks, launch lips, paths and tag panels

**Files:** Create `js/game/world/{skate-paths,tag-targets}.js`, `tests/fixtures/skate-line.js`; modify `js/game/world/{city-layout,city-surfaces,city-queries}.js`, `js/game/shared/world-config.js`, `js/game/render/city-scene.js`; extend `tests/unit/{city-layout,city-surfaces,follow-camera}.test.js`; create `tests/unit/skate-paths.test.js`, `tests/unit/tag-targets.test.js`, `tests/e2e/authored-city.spec.js`.

**Interfaces:** Layout adds `assetPlacements`, `launchMarkers`, `tagTargets` while `rails` remains the eligible-path collection (types `rail|pipe|ledge`). Each placement has stable ID, manifest assetId, ground transform and canonical collision proxy. Paths compile points/segmentLengths/totalLength/bounds and optional connected support IDs. `sampleSkatePath(path,distance) -> {point,tangent,gravityUp}`; `projectSkatePath(path,from,to) -> {distanceAlong,distanceToPath,point,tangent}|null` handles swept approach. Launch marker is a directed local segment-plane with half-width/height and support ID. Tag target stores world triangles, local frame and bounded polygon. `resolveTagAnchor(world,{targetId,triangleId,barycentric}) -> {point,normal}|null`; `findTagTarget(world,skater,{maxReach:2}) -> {anchor,point,normal}|null` includes line-of-sight against planet/building/target triangles.

**Playtest correction — building scale (user approved):** The current scale of 3 makes doors and storeys too small next to the playable character. Treat the character as a 5′10″ (1.778 m) adult reference and enlarge the imported buildings uniformly so representative doors and storeys read at credible human scale. Keep the character, planet radius 32, and camera distances unchanged; do not assume overall building bounds alone prove door scale. Measure actual model features and document the selected scale and any per-variant exceptions. Recompute canonical placements and collision proxies from the same transforms; preserve visibly open streets and safe wall/ground contact. Capture close-up character/door comparisons and chase views for user review. This is outstanding work, not a completed playtest gate.

- [x] **Scale RED:** Add geometry/placement regressions using representative real imported models and the playable avatar. Check that selected door/storey features accommodate the 5′10″ reference, rendered and physical bounds still agree within 0.02 units, and the skater footprint clears the connected route. Confirm the current too-small placement fails the scale assertion.
- [x] **Scale GREEN and review:** Enlarge buildings with consistent proportions, adjust placements as needed, and rerun collision, route, camera and resource-lifetime regressions plus `npm test`. Capture and inspect close-up and chase views; ask the user to approve the human-scale result before treating the visual checkpoint as passed. Preserve the working avatar and do not substitute a smaller character to make the buildings appear larger.

- [ ] **1. RED:** `world_kenneyPlacementBoundsMatchRender` (<0.02 contact mismatch), `world_branchRejoinsLoop`, `world_launchRailLandingHasSweptClearance`, `paths_signedDistanceAtEndpointsAndPoles`, `paths_highSpeedCrossingNotMissed`, `tagTargets_wallNormalIsNotForcedRadial`, `tagTargets_rejectsOccludedFarSideAndInvalidAnchor`. Test real transformed geometry/support and branch traversal, not names in metadata alone.

  ```js
  expect(maxPhysicalVisualGap).toBeLessThan(0.02);
  expect(branchRejoinsMainRoute).toBe(true);
  expect(findTagTarget(worldWithOccluder, skater, { maxReach: 2 })).toBeNull();
  ```
- [ ] **2. Verify RED:** `npm run test:unit -- tests/unit/city-layout.test.js tests/unit/city-surfaces.test.js tests/unit/skate-paths.test.js tests/unit/tag-targets.test.js`; new fixtures must fail for absent authored records/queries.
- [ ] **3. GREEN implementation:** Fit curated assets to skater/door scale using manifest native bounds; orient local up radially and recompute collision proxies outside route clearance. Author a water/signal-tower plaza, skate arch, rejoining shortcut and close-to-spawn launch→rail→landing line; add accessible pipe and ledge examples, visible eligible marks and wall/container/skate tag panels. Render physical paths/panels from their canonical records, not mesh-name guesses. Set `WORLD_DESCRIPTOR.version=2`; radius remains 32. Preserve current seeded layout/spawn determinism and legacy query exports.
- [ ] **4. Verify GREEN:** Unit command, `npm run test:e2e -- tests/e2e/authored-city.spec.js tests/e2e/city-world.spec.js tests/e2e/local-skating.spec.js`, then `npm test`. Measure bright/underside/pole clearance and chase framing; stop and revise placement if a collision proxy blocks a visibly open street.
- [ ] **5. Commit:** `feat: author connected industrial skate routes and targets`.

### Task 5: Implement automatic launch, locked traversal and balance

**Files:** Create `js/game/shared/skate-tuning.js`, `js/game/core/{launch-state,grind-state}.js`, `tests/unit/{launch-state,grind-state}.test.js`, `tests/e2e/traversal.spec.js`; modify `js/game/core/city-skater.js`, `js/game/shared/world-config.js`, `tests/fixtures/skate-line.js`.

**Interfaces:** Extend skater with `eventIndex`, `launchLockId`, `railDirection`, `balance`, `grindAgeMs`, `recaptureRemainingMs`; keep existing `railId/railDistance` as authoritative path identity/distance, not a duplicate grind pose. `stepLaunch(state,input,dt,world,motion) -> StepResult`; `stepGrind(state,input,dt,world,motion) -> StepResult`, `motion={from,to,priorSurfaceId}` records the actual motion sweep, and `StepResult={state,events}`. Launch/capture consume the post-normal-motion candidate plus that sweep; an already-locked grind moves itself without a preceding ground motion step. Each event keeps eventId/tick and adds monotonic `eventIndex` plus typed context (path ID, signed distance advanced, speed, reason). Composer orders normal motion sweep→launch crossing→capture, or locked grind→dismount→landing; first crossing is consumed once per tick and results are immutable with respect to input state/world.

- [ ] **0. Mechanics review gate:** Arrange the previously requested GPT Sol read-only review of Genex reference plus spec §4–5 and this task before mechanics implementation. Use model discovery to resolve the requested Sol model; review is not permission to change approved behavior. Record findings in the ledger; escalate substantive design changes to the user rather than silently replacing the rules.
- [ ] **1. RED:** `launch_crossingAt3GetsUpwardSpeed4Once` versus 2.999/no marker/reverse crossing; manual Jump+lip same tick yields one launch. `grind_captureBoundaries` uses 1.999/2, 0.799/0.8/0.801, 0.649/0.65 alignment; `grind_reversedApproachTravelsBackwards`; endpoint/Jump/missing-path/balance failure each produce one end with finite continuous velocity; 149/150 ms cooldown boundaries; no airborne teleport from distant/high paths. At 30/60/120 render schedules the same tick inputs produce the same path distance/balance.

  ```js
  expect(launchAtThreshold.state.verticalSpeed).toBe(4);
  expect(captureAtThreshold.state.mode).toBe('grinding');
  expect(captureOutsideTolerance.state.mode).not.toBe('grinding');
  expect(balanceFailure.state.mode).not.toBe('bailed');
  ```
- [ ] **2. Verify RED:** `npm run test:unit -- tests/unit/launch-state.test.js tests/unit/grind-state.test.js tests/unit/city-skater.test.js`; `npm run test:e2e -- tests/e2e/traversal.spec.js` must fail without actual automatic launch/capture.
- [ ] **3. GREEN implementation:** Put approved launch/capture numbers in `SKATE_TUNING`; set `tuningVersion=2`. For unspecified balance tuning, pin initial plan defaults: 200 ms entry grace, correction gain 1.6/s, duration drift ramps 0.08→0.30/s over 4 seconds, and signed travel-direction curvature (adjacent tangent angle per world-unit, multiplied by speed) clamped ±0.35/s. Straight-path drift sign is +1 for an even sum of path-ID character codes and -1 otherwise. After grace use `balance += (sign*(0.08+0.22*clamp(grindAgeMs/4000,0,1)) + curvatureTerm - input.steer*1.6)*dt`; clamp at ±1 then controlled failure dismount. No random sources. Retain captured tangential speed, allow braking through the existing brake integrator, and dismount if it drops below2. No grounded capture without an explicit connected-support record, no legacy Shift/LT requirement. Preserve original default-stop/explicit challenge-bail behavior and safe invalid-state recovery.
- [ ] **4. Verify GREEN:** Focused tests then `npm test`; the mounted browser fixture enters the line from its real spawn using keyboard, pad and touch separately, records launch/start/end/landing events and actual movement, with camera untouched. Fixtures select a real test world at boot, never mutate player pose or emit synthetic success events.
- [ ] **5. Commit:** `feat: add automatic launches and balanced path grinding`.

### Task 6: Complete timed tricks, banked chains and actual play feedback

**Files:** Create `js/game/core/{trick-state,trick-combo,local-play}.js`, `js/game/ui/play-feedback.js`, `tests/unit/{trick-state,trick-combo,local-play}.test.js`, `tests/e2e/trick-flow.spec.js`; modify `js/game/shared/catalogs.js`, `js/game/core/city-skater.js`, `js/game/runtime/game-session.js`, `js/game/main.js`, `skate.html`, `css/skate.css`, `js/game/ui/controls-panel.js`.

**Interfaces:** Skater adds `activeTrick:{id,startedTick,elapsedMs}|null`. `stepTrick(state,input,dt,world) -> StepResult` advances one 300 ms action and emits valid completion/cancellation. `createComboState()`, `reduceCombo(combo,event,world,tuning) -> ComboState`; combo holds pendingBase, multiplier, bankedScore, per-chain action counts/link tick and bounded last processed eventIndex. `createLocalPlayState(world,spawnId?)` returns `createCitySkater` fields plus `.combo`; `stepLocalPlay(state,input,dt,world) -> StepResult` delegates motion/tricks and reduces combo after each fixed tick. Main passes these factory/step callbacks to the existing session; the one fixed-step state remains authoritative. Frame/getState expose `.combo` as a direct read alias of `.skaterState.combo`, never a second mutable store. `renderPlayFeedback(root,{skater,combo,lastAction,socialStatus,quality}) -> void` reads state only; Leave invokes the local-play factory to reset score.

- [ ] **1. RED:** `trick_unknownGroundedAndEarlyLandingReject`, duration 299/300/301 ms plus completion/landing same-tick order; `combo_spinGrabBanks500Versus250Isolated`, repeated same trick half once then zero, distinct multiplier cap5, actual moving grind50/s, stationary/unknown path/duplicate event zero; link1500/1501 ms; balance failure discards pending not banked; expiry cannot bank airborne points. Browser actual actions change score/balance display while offline.

  ```js
  expect(linkedSpinGrab.bankedScore).toBe(500);
  expect(isolatedSpinAndGrabTotal).toBe(250);
  expect(airborneExpiry.bankedScore).toBe(previousBank);
  expect(afterDuplicateEvent).toEqual(beforeDuplicateEvent);
  ```
- [ ] **2. Verify RED:** `npm run test:unit -- tests/unit/trick-state.test.js tests/unit/trick-combo.test.js tests/unit/local-play.test.js`; `npm run test:e2e -- tests/e2e/trick-flow.spec.js`.
- [ ] **3. GREEN implementation:** Spin=100/grab=150; projected pending is floor(baseSum×multiplier), multiplier increments once per new action capped5. A continuous grind is one action with validated per-tick distance/speed/time; accumulate 50 base/s while speed>=2. Clean landing banks once, preserving chain history for inclusive1500 ms. Process completion before clean landing if duration reached that tick; otherwise cancel. Unknown IDs/grounded spam never complete. Dedup by monotonic eventIndex, not an unbounded Set. Add compact readable balance/action/bank text with event-driven polite announcements, not 60 Hz live-region spam.
- [ ] **4. Verify GREEN:** Named units/browser then `npm test`; use input-driven real line and no score injection. Check HUD/control/player clearance at both mobile sizes.
- [ ] **5. Commit:** `feat: execute timed tricks and bank local skating chains`.

### Task 7: Make graffiti and preset emotes work visibly in local play

**Files:** Create `js/game/core/local-social.js`, `js/game/render/social-scene.js`, `scripts/build-graffiti.js`, `assets/game/graffiti/{signal,bolt,eyes}.{svg,png}`, `tests/unit/{local-social,social-scene}.test.js`, `tests/e2e/local-social.spec.js`; modify `js/game/core/local-play.js`, `js/game/shared/catalogs.js`, `assets/game/manifest.json`, `js/game/runtime/game-session.js`, `js/game/ui/play-feedback.js`, `js/game/main.js`.

**Interfaces:** `createLocalSocialState() -> {tags,emotes,nextId,lastTagAtMs}`; `stepLocalSocial(state,{tagPressed,emotePressed},skater,world,nowMs) -> {state,events}` uses `skater.tick*1000/60`, not render time, for simulation deadlines. Task6's local-play factory adds `.social`; its step composes local-social after motion and stamps rule events with the skater's monotonic eventIndex. Frame/getState expose `.social` as a direct read alias, not another store. Tag `{id,styleId,anchor,placedAtMs,expiresAtMs}`, emote `{id,presetId,expiresAtMs}`. `createSocialScene({THREE,assets,world}) -> {group,update(state,nowMs),dispose}` reconstructs target anchors, clips decal geometry to target polygon and uses small outward normal lift. Only validated local rules consume input, never pretending a server accepted it. Offline `node scripts/build-graffiti.js [--check]` renders trusted local SVGs through installed Playwright Chromium canvas to 512×512 transparent PNGs, with no network; `--check` verifies checked-in output dimensions/source hashes without rewriting files.

- [ ] **1. RED:** Reach1.999/2/2.001, cooldown1999/2000, cap10 rejects11, independent expiry299999/300000, emote1999/2000; midair/unknown style/through-wall/far-side/removed-target denied. `socialScene_followsWallNormalAndClipsPanel` checks actual geometry/depth/lifetime. Browser keyboard F, pad B and touch Tag each place an actual visible world mark and report invalid/cooldown cases; invalidated queued Tag must not place after Help.

  ```js
  expect(tag.expiresAtMs - tag.placedAtMs).toBe(300_000);
  expect(atCap.state.tags).toHaveLength(10);
  expect(rejectedEleventhTag.state.tags).toEqual(atCap.state.tags);
  expect(atEmoteExpiry.state.emotes).toHaveLength(0);
  ```
- [ ] **2. Verify RED:** `npm run test:unit -- tests/unit/local-social.test.js tests/unit/social-scene.test.js`; `npm run test:e2e -- tests/e2e/local-social.spec.js`.
- [ ] **3. GREEN implementation:** Author three original local graffiti presets with no scripts/external SVG resources; keep source editable and use bounded cached PNG texture where preferable. Grounded/settled placement chooses nearest visible designated target from Task4, not arbitrary rays through the city. Maintain10 tags and one current local emote, dispose expired instance geometry while retaining shared textures, and clear on Leave. Show target marker/success/no-target/range/cooldown/cap status; wave/cheer/follow show bounded visuals now, with rig actions integrated in Task9.
- [ ] **4. Verify GREEN:** Focused tests then `npm test`; no network call required. Verify displayed wall/ground marks have correct normals and cannot bleed onto planet backside; leave/retry cannot retain old marks or timers.
- [ ] **5. Commit:** `feat: add visible local graffiti and preset emotes`.

### Task 8: Author and export the low-poly Blender TVHead rig

**Files:** Create `scripts/build-tvhead.py`, `scripts/check-tvhead.py`, `assets/game/source/tvhead.blend`, `assets/game/models/tvhead.glb`, `tests/unit/tvhead-asset.test.js`; update manifest/asset README; keep original OBJ untouched.

**Interfaces:** Blender CLI authoring takes `--reference <obj> --output-blend <path> --output-glb <path>` and writes only explicitly named outputs. `check-tvhead.py --asset <blend-or-glb>` exits nonzero on violations and emits JSON joint/clip/weight/bounds/triangle report. GLB contract: +Y up/+Z forward after export, centered feet at localY0, nominal head-to-feet height2.9, no pedestal; named `root,pelvis,spine,head,upper_arm.L/R,forearm.L/R,hand.L/R,thigh.L/R,shin.L/R,foot.L/R`. Known material roles are `suit,shell,screen,blades,accessory`; removable cap follows head.

- [ ] **1. RED:** `tvhead_hasWeightedJointHierarchyAndAllClips`, `tvhead_preservesTriangleBudgetAndDimensions`, `tvhead_noPedestalAndSkatesBelowFeet`, `tvhead_exportKeepsSuitAndCapRoles`; assert normalized skin weights (sum within1e-4), finite/in-place root tracks, <=5000/7500 triangles. Required clips: idle,push,coast,crouch,jump,spin,grab,grind,balance-left,balance-right,land,tag,wave. Test real exported asset structures, not manifest claims.

  ```js
  expect(assetReport.baseTriangles).toBeLessThanOrEqual(5_000);
  expect(assetReport.maxWeightSumError).toBeLessThanOrEqual(1e-4);
  expect(requiredClips.every(name => assetReport.clips.includes(name))).toBe(true);
  ```
- [ ] **2. Verify RED:** `npm run test:unit -- tests/unit/tvhead-asset.test.js`; missing output should fail clearly, then Blender checker must reject a known unrigged temporary fixture.
- [ ] **3. GREEN implementation:** Import reference into a nonexport reference collection, inspect silhouette/front/side, and rebuild suitable low-poly joint topology rather than blindly decimate fused geometry. Author named armature, weighted limbs, rigid-weighted TV/blades, smooth keyframe clips and optional cap. Save source/actions and export real GLB with skin/animations; keep reference hashes unchanged. Run authoring/check scripts via `& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup --python <script> -- <arguments>`.
- [ ] **4. Verify GREEN:** Run both Blender commands with actual outputs, named unit and `npm test`; capture Blender front/side/pose renders under ignored `artifacts/skate-progress/`. Compare TV silhouette/limbs to reference and inspect bending/feet before calling modeling complete; do not substitute an animated box rig.
- [ ] **5. Commit:** `feat: add Blender-authored low-poly animated tvhead` (include `.blend`, `.glb`, scripts and provenance, not temporary Blender backups or original edits).

### Task 9: Integrate the skinned avatar with contact pose and customization

**Files:** Create `js/game/render/animated-avatar.js`, `tests/unit/animated-avatar.test.js`, `tests/e2e/avatar-animation.spec.js`; modify `js/game/render/{game-assets,avatar,avatar-pose}.js`, `js/game/ui/customization.js`, `js/game/main.js`, `tests/unit/{avatar,avatar-pose}.test.js`, `tests/e2e/customization.spec.js`.

**Interfaces:** `createAnimatedAvatar({THREE,template,clips,appearance,assets}) -> {root,model,update(skater,events,elapsedPlayMs,{reducedMotion}),setAppearance(appearance),dispose}`; use r137 `SkeletonUtils.clone` so bones/skin are per instance. Physics/contact root retains `applyAvatarPose` convention; model is its child and owns `AnimationMixer`. Contract stores no engine/cache/mixer in serialized simulation state; session elapsedPlayMs from Task1 feeds animation, never one-frame delta as absolute time.

- [ ] **1. RED:** `avatar_clonesHaveIndependentSkeletonsAndColors`, `avatar_clipsMoveLimbsWithoutMovingPhysics`, `avatar_pauseResumeDoesNotJumpAnimation`, `avatar_capTracksHeadAndRepeatedToggleDisposes`, `avatar_oneDisposalPreservesOtherGuests`. Browser actual push/jump/grind/tag/wave changes bone transforms/clip state, keeps feet on current support/ramp, and visible TVHead stays framed.

  ```js
  expect(firstSkeleton).not.toBe(secondSkeleton);
  expect(animatedElbowQuaternion).not.toEqual(restElbowQuaternion);
  expect(simulationAfterRender).toEqual(simulationBeforeRender);
  ```
- [ ] **2. Verify RED:** `npm run test:unit -- tests/unit/animated-avatar.test.js tests/unit/avatar-pose.test.js tests/unit/avatar.test.js`; `npm run test:e2e -- tests/e2e/avatar-animation.spec.js`.
- [ ] **3. GREEN implementation:** Blend locomotion from simulation speed/mode, prioritize active trick/landing/tag/emote actions, and layer balance upper-body lean without altering camera/contact root. Bound transient action queues and use deterministic action start times; pause/reduced motion retains essential poses. Apply per-instance suit/cap materials, shared immutable mesh/texture resources, correct skin cloning and once-only disposal. Adapt existing preview color/cap behavior without changing original viewer assets.
- [ ] **4. Verify GREEN:** Focused tests, existing customization/local-skating E2E and `npm test`; inspect real animation clips in the browser and re-run asset-load late-result/retry tests with the new character included.
- [ ] **5. Commit:** `feat: animate rigged tvhead in the skating session`.

### Task 10: Apply the comic-book world and bounded trick accents

**Files:** Create `js/game/render/{style,action-effects}.js`, `tests/unit/{render-style,action-effects}.test.js`, `tests/e2e/comic-style.spec.js`, `tests/manual/skate-city-art-direction.md`; modify `js/game/render/{city-scene,animated-avatar}.js`, `js/game/main.js`, `skate.html`, `css/skate.css`.

**Interfaces:** `createStyleMaterials(THREE,{quality}) -> {materials,convertMaterial(source,role),dispose}` preserves source maps/alpha/skin/morph support with shared conversion cache. Roles terrain/street/building/ramp/grind/tag/ink/character use paper `#F2E6CE`, ink `#191716`, orange `#F06A24` plus bounded user color. `createActionEffects({THREE,assets}) -> {group,update(events,elapsedPlayMs,pose,{reducedMotion}),dispose}` owns <=24 pooled effects, <=500 ms each; eventIndex dedup prevents replay on redraw.

- [ ] **1. RED:** `style_worldAndSkinnedAvatarUseSharedComicRoles`, `style_lowKeepsEligibleGeometryReadable`, `effects_boundedDeduplicatedAndReducedMotion`, browser bright/back/pole actual-material renders plus dark-outline/halftone legibility. Assert user color survives conversion, source maps/transparent edges remain, style toggling does not clone resources indefinitely and physics snapshots are unchanged.

  ```js
  expect(convertedSuit.color.getHexString()).toBe(selectedAppearanceHex);
  expect(activeEffects.length).toBeLessThanOrEqual(24);
  expect(worldAfterStyleChange).toEqual(worldBeforeStyleChange);
  ```
- [ ] **2. Verify RED:** `npm run test:unit -- tests/unit/render-style.test.js tests/unit/action-effects.test.js`; `npm run test:e2e -- tests/e2e/comic-style.spec.js`.
- [ ] **3. GREEN implementation:** Use r137 toon gradient bands, readable fill on the sphere underside, selective normal-expanded backface ink shells (skin/morph compatible), restrained shadow-weighted procedural halftone and original sign/graffiti graphics; not a required fullscreen dot/outline compositor. Favor fixed palette/contrast and pooled speed streaks/action punctuation, not camera shake/banking/FOV kicks. Style actual city/rig, not only CSS. Stage a single representative street/plaza/TVHead vignette first.
- [ ] **4. Verify GREEN:** Focused tests then `npm test`; record chase/underside/pole and portrait/landscape screenshots and actual action video/frame sequence for user visual approval. Stop expansion of art until that vignette is approved; do not label unviewed screenshots approved.
- [ ] **5. Commit:** `feat: give skate city original comic-book rendering`.

### Task 11: Bound resources, quality presets and measured render budgets

**Files:** Create `js/game/render/quality.js`, `tests/unit/{render-quality,render-resources}.test.js`, `tests/e2e/render-budget.spec.js`; modify `js/game/render/{game-assets,city-scene,animated-avatar,action-effects,social-scene}.js`, `js/game/ui/{play-feedback,controls-panel}.js`, `js/game/main.js`, `skate.html`, `css/skate.css`.

**Interfaces:** `applyRenderQuality({renderer,city,effects},quality,devicePixelRatio) -> {quality,dpr}`; invalid quality falls back low. `captureRenderBudget(renderer,registry) -> {drawCalls,triangles,geometries,textures,ownedResources}` reads actual last-frame renderer.info/registry, not estimated metadata. Repeated static buildings/details use shared/instanced or merged geometry per material while retaining canonical per-placement contact/target data.

- [ ] **1. RED:** DPR3 clamps1/1.5; `quality_changesNoPhysicalOrSocialRecords`; 100 create/appearance/cap/leave cycles and repeated quality toggles return resource counters to baseline; deleting one skinned/decal instance leaves peers intact. Real rendered low scene with12 clustered base avatars checks <=150 calls, <=12/base and triangle limits, recording sparse comparison and context/resource errors.

  ```js
  expect(lowPreset.dpr).toBe(1);
  expect(standardPreset.dpr).toBe(1.5);
  expect(clusteredBudget.drawCalls).toBeLessThanOrEqual(150);
  expect(registryAfter100Cycles).toEqual(baselineRegistry);
  ```
- [ ] **2. Verify RED:** `npm run test:unit -- tests/unit/render-quality.test.js tests/unit/render-resources.test.js`; `npm run test:e2e -- tests/e2e/render-budget.spec.js`.
- [ ] **3. GREEN implementation:** Default low on coarse-pointer devices, standard otherwise; session-only selector in Help/HUD. Batch static material-compatible parts, bound outline/effect submissions and reference-count shared asset/texture ownership including late loads and detached caps. Quality reduces optional decoration/accents/DPR only; paths, tags, landmarks, target markers and physics remain present. Optimize submissions first; if approved visual constraints conflict with measured targets, record report and seek a tradeoff, never silently bump thresholds.
- [ ] **4. Verify GREEN:** Focused tests then `npm test`; save JSON renderer measurements under ignored test artifacts and summarize actual versions/settings in art-direction/device docs. This twelve-avatar renderer fixture is not multiplayer/phone-FPS acceptance.
- [ ] **5. Commit:** `perf: bound skate-city resources and render presets`.

### Task 12: Complete integrated local acceptance and document remaining hardware gates

**Files:** Create `tests/e2e/playable-city.spec.js`; extend existing E2E/site navigation/customization/CI coverage and `tests/manual/{device-matrix,skate-city-art-direction}.md`; update new plan/approved-spec status and existing roadmap links without closing unrelated networking milestones.

**Interfaces:** Uses only the production session, validated input adapters, asset loaders/world queries, HUD and real rendered scene from Tasks1–11. No new runtime APIs or synthetic success actions are allowed in this task.

- [ ] **1. RED:** Integrated acceptance covers Join/customize→skate→automatic launch/capture/balance→manual dismount→timed trick/landing/bank→visible graffiti/emote→Help/diagnostics/quality→Leave/rejoin. Repeat with keyboard, simulated pad and touch; inject raw controller streams/clock only, never scores/events/positions. Include delayed texture retry, WebGL loss while Help open, form focus with queued Tag, resize/background/re-entry, independent resource disposal and original portfolio/viewer navigation.

  ```js
  expect(observedEventTypes).toEqual(expect.arrayContaining(['jumped', 'grindStarted', 'grindEnded', 'landed']));
  await expect(page.locator('[data-graffiti-count]')).toHaveAttribute('data-graffiti-count', '1');
  expect(afterLeaveState.combo.bankedScore).toBe(0);
  ```
- [ ] **2. Verify RED:** `npm run test:e2e -- tests/e2e/playable-city.spec.js`; any missing behavior is named and traced to its owning task before a correction.
- [ ] **3. GREEN corrections:** Fix only reproduced integration gaps in owner modules with focused RED/GREEN regression tests. Link the approved spec/plan from the old roadmap; record exactly which original Task7–9/local Task11 portions are implemented and which room/duel/release items remain pending. Do not resurrect audio/network scope or mislabel a passing empty Worker suite.
- [ ] **4. Verify GREEN:** Run `npm test`, `npm run build`, changed-module `node --check`, `git diff --check`, Blender `check-tvhead.py` on committed sources/GLB and importer `--check`. Review final vignette/action captures; record physical Windows Firefox/new Steam Controller/receiver, Chrome comparison, actual exposed mappings/Steam configuration, complete hands-off lap both directions, and a real phone's orientation/background/re-entry/performance **only if actually tested**. Otherwise mark each unavailable/pending and state that physical acceptance is not complete.
- [ ] **5. Commit:** `test: verify the integrated local comic skating city`; request final whole-branch review and ask user before any push/PR/merge/deploy. Keep checkout/assets intact for hardware/visual iteration.

## Plan review and execution handoff

- [ ] User reviews this plan and selects Native or Subagent-driven execution; spec approval alone does not skip this gate.
- [ ] At execution start, verify checkout/isolation preference, source pack/Blender availability and current full baseline; then execute in dependency order1→12. Tasks8's Blender authoring is logically separable but runtime integration waits for its asset checks; do not add parallel agents without the selected method authorizing them.
- [ ] Task5's requested GPT Sol mechanics review and Task10's representative visual approval are explicit gates, not claims made by this plan.

Self-review completed against spec §§1–12: all requirements have owners above; interfaces and exact numeric spec boundaries are carried into tasks; all five Review Focus conditions have owner regression tests. This document is a plan, not implementation/test success evidence.
