# Skate-game foundation audit

Audit date: 2026-11-11. Checkout: `3800d52f3526c3aa59dece147e8eea8e1cda0432`.

Scope: fresh-context, read-only research into the foundation for a Three.js, Jet Set Radio / Bomb Rush Cyberfunk-inspired multiplayer website game. Only this report was written. No game changes, dependency installation, server startup/deployment, commits, publishing, deletion or worktrees.

**User clarification received during the audit:** the discipline is **aggressive inline skating / rollerblading**, not skateboarding: flow-state traversal, jumps, tricks, wall rides, grinds and momentum buildup, with high-tech fantasy skates inspired by *Air Gear*. The priority is a **shared world first, challenges later**. Player-player collisions and crash ragdolls are eventual ambitions, **explicitly outside initial scope**. Desktop/gamepad come first; phones with an on-screen gamepad come second. Three.js remains a requirement. These are user-stated goals and priority boundaries, **not architectural approval or permission to change physics dependencies/backend**.

## Executive assessment

**There is useful engineering here, but not yet the requested game.** This is a working-in-source **offline skating prototype**, with a spherical menu and a different planar play city. It has meaningful input/lifecycle handling, fixed-step simulation, authored support surfaces, launches, automatic grinds and local scoring. Multiplayer is absent, not merely disabled. The strongest reason to reconsider the foundation is **not Three.js**: it is the current movement/contact model, sparse/disconnected skating content and the lack of validated feel/presentation.

Fresh source-level probes found actual defects, not just subjective tuning concerns:

1. **Falling below the takeoff/support height is integrated incorrectly.** A two-unit drop remains airborne at Y=1.768611 after one second, despite gravity 14 predicting ground impact at about 0.534522 seconds. The production line launches at tick 85, catches its pipe at 86, dismounts at 94, but only lands at tick 532—on a distant yard, not its authored runout.
2. **Landing can snap upward from below a deck.** A descending skater at `[132,1,80]` becomes grounded at `[132,1.2,80]` in one tick.
3. **Renderable and rideable space disagree in important places.** The fallback ground has no corresponding ground mesh. Primary rails have 0.9-wide support decks but render as radius-0.09 cylinders; a point supported at Y=0.82 beside a rail only intersects the visible ramp at Y≈0.248333.

Evidence and reproducible probes are below. These defects are separate from the legitimate, previously chosen arcade launch/grind rules.

**PROPOSED assessment:** preserve the website, original assets/identity and useful testable boundaries; investigate a bounded movement/contact and skate-layout rework rather than either accepting the current behavior as a tuning problem or throwing away the whole site. Whether that rework remains custom physics or uses a physics library is **OPEN**. No deletion should be recommended or performed until an explicitly approved replacement is validated.

### Authority and historical intent

- **User-stated product direction:** the clarified aggressive-inline-skating/shared-world goals above. **OPEN architecture:** how to achieve them; this audit grants no implementation authorization and does not approve a physics engine or backend.
- **OPEN:** exact movement/wall-ride/boost semantics, world topology/scale, shared interactions, specific supported hardware/browser combinations and budgets, player count, authority/backend, persistence and dependency choices. Desktop/gamepad-first and phone-second priorities are stated, not open alternatives. Existing constants are implementation facts, not newly approved requirements.
- Historical records do contain explicit earlier approvals: the October 28 design and human scale; the October 29 source-path exclusion, endpoint rejection and manual-Jump precedence rules. Preserve those records and explicitly reopen a conflict rather than silently changing them. See `docs/superpowers/specs/2026-10-28-skate-city-playability-and-comic-art-design.md:5–31`, `docs/reviews/2026-10-28-collision-and-visible-assets-checkpoint.md:34–42`, and `docs/reviews/2026-10-29-sol-skate-mechanics-review.md:150–163`.
- The planar spec still says “draft” and “no planar implementation,” while the later plan and pending-gates tracker record implementation and outstanding human review. Therefore its header is stale history, not proof that planar code is absent or that the user accepted its feel. Compare `docs/superpowers/specs/2026-10-29-planar-wraparound-city-design.md:5–17` with `docs/superpowers/plans/2026-10-29-planar-wraparound-city-plan.md:40–64,97–113` and `docs/reviews/2026-10-29-skate-city-pending-review-gates.md:8–27`.
- No glossary existed at initial inspection; the parent session created `GLOSSARY.md` during the audit. It was then read and preserved unchanged. Its aggressive-inline-skating/shared-world vocabulary is used here; its additional Boost/Boost trick/Combo/Bomb Rush Mode definitions are vocabulary, not evidence those features exist or that their architecture is approved (`GLOSSARY.md:1–24`). No `docs/adr/` was found. Read `AGENTS.md`, `docs/agents/domain.md` and `docs/agents/issue-tracker.md`; no tickets or labels were changed. The pre-existing untracked `AGENTS.md` and `docs/agents/` were preserved.

## 1. What actually runs

### Runtime dependency graph

```text
skate.html
  global scripts: lib/three.min.js (r137), OrbitControls,
                  game/BufferGeometryUtils, SkeletonUtils, GLTFLoader
  module: js/game/main.js
    boot -> fetch local asset manifest -> loadGameAssets
    preview -> city-layout -> asset-placements -> city-surfaces -> city-scene
               createCitySkater -> avatar / customization / OrbitControls
    Join -> activeWorld=playWorld, activeScene=playScene -> joinLocal
      planar-city-layout -> asset-placements -> planar-city-surfaces
      planar-city-scene -> merged static meshes, nine tiles, panels/marker
      game-session -> fixed-step -> stepLocalPlay
        planar-skater -> speed/vertical integrators, wrap math, support/sweep
                      -> launch-state -> grind-state -> skate-paths
        trick-state -> trick-combo -> feedback
      keyboard + gamepad/mapping + touch -> input-router -> normalized frames
      input-lifecycle / controls-panel -> session suspension
      simulation pose -> avatar-pose + follow-camera -> renderer.render
    Leave -> spherical scene/world + reset; Retry -> dispose/reload/rebuild
```

Entry/load evidence: `skate.html:113–118`, `js/game/main.js:1–25,84–136,330–361,379–425,527–563`. Local composition: `js/game/core/local-play.js:99–144`. Session scheduling: `js/game/runtime/game-session.js:101–127,146–173`.

A read-only static-import scan found **41 game JS modules, 40 reachable from `main.js`**; only `world/tag-targets.js` is outside that import closure. “Reachable module” does not mean every exported function runs. In particular:

| System | Actual reachability / preservation consequence |
| --- | --- |
| Spherical layout/compiler/renderer/avatar spawn | Still used at boot and on Leave. **Not dead code.** `main.js:87–122,238–258,405–425`. |
| `stepSkaterOnCity` | Imported and present in the dispatch closure, but ordinary Join switches to planar *before* scheduling play; preview does not simulate. This is a dormant normal-play branch, not the current movement path. `main.js:330–338,379–403`; `game-session.js:30–37,76–79,146–155`. |
| `city-skater.js` / `city-queries.js` | Cannot delete wholesale: planar code imports `CITY_SKATER_TUNING` and `sweepBox`. `planar-skater.js:7`, `grind-state.js:3`, `planar-city-queries.js:1–2`. |
| `skater-simulation.js` | Its integrators are active; the legacy spherical `stepSkater` export has no caller in production `js/`. `skater-simulation.js:20–51`; `planar-skater.js:2–6,286–302`. |
| `tag-targets.js` | Implemented/tested geometry queries, but no production importer or UI/action consumer. Browser tests dynamically import it; that is not game wiring. `tests/e2e/authored-city.spec.js:11–29`; `tag-targets.js:47–62,167–170,244–291`; `local-play.js:108–144`. |
| `SkeletonUtils.js` | Loaded by HTML, but no production `js/` call; avatar is procedural and asset retention uses ordinary `scene.clone(true)`. Loading a utility is not rigging. `skate.html:116`, `avatar.js:68–227`, `game-assets.js:100–107`. |
| Legacy input conversion / `grindHeld` | `inputFrameFromLegacy` has no production caller; Shift still samples `grindHeld`, but planar capture is automatic and ignores it. Do not reintroduce a hold requirement as “cleanup.” `actions.js:24–55`, `keyboard-mouse.js:196–204`, `grind-state.js:343–363`. |
| `WORLD_LIMITS` | Declares 12 guests/5 Hz, but nothing imports/enforces it. It is not implemented capacity. `shared/world-config.js:11–14`. |
| Other website systems | Viewer and its loaders/thin-film map are separate page systems, not obsolete game code. `index.html:64–73`, `js/viewer.js:7–67`. |

### Implemented / partial / absent inventory

| Capability | Assessment | Source evidence |
| --- | --- | --- |
| Offline Join/Leave, pause, retry, customization | **Implemented**, with deliberate lifecycle boundaries; not freshly browser-verified here. | `main.js:238–288,330–440,527–563`; `game-session.js:39–68,146–183`. |
| Keyboard, mouse camera, gamepad, touch | **Implemented adapters**; physical compatibility/feel remain unverified. | `keyboard-mouse.js:91–105,190–217`; `gamepad.js:130–136,166–245`; `touch.js:82–99,197–211`. |
| Fixed-step motion | **Implemented** 60 Hz, six-step/100 ms cap and one-shot edges. | `fixed-step.js:3–8,41–60,89–120`. |
| Acceleration/braking/coasting | **Implemented arcade scalar-speed model**, not directional momentum or slope-energy dynamics. | `skater-simulation.js:10–48`; `city-skater.js:19–33`; `planar-skater.js:286–308`. |
| Jump/buffer/coyote/landing | **Implemented but defective** on lower-height falls and below-deck landing. | `planar-skater.js:244–284,296–378`; findings F1–F2. |
| Automatic launch | **Implemented at one directed marker**, not at every ramp/edge. | `planar-city-layout.js:149–171,221–231`; `launch-state.js:69–139`. |
| Grinds/balance/dismount | **Implemented**, explicit eligible paths, automatic capture, signed distance, deterministic balance and cooldown. | `grind-state.js:89–141,195–215,226–340`; `shared/skate-tuning.js:6–18`. |
| Wall rides / fantasy momentum-building systems | **Absent**. No wall-attached mode, wall-ride transition, boost action or boost/combo-power-up movement path; ordinary wall contact stops. This is a gap against the clarified goals, not evidence that wall rides are optional. | `planar-skater.js:15–17,69–94,286–324`; `actions.js:11–39`; `skater-simulation.js:20–29`; `trick-combo.js:108–153`. |
| Spin/Grab, combo/HUD | **Implemented rules/feedback**, two 300 ms airborne actions, not visual trick animation. | `catalogs.js:10–17`; `trick-state.js:27–78`; `local-play.js:108–144`; `trick-combo.js:108–153`. |
| City geometry | **Implemented rough blockout/content sample**, not a validated urban skate playground. | `planar-city-layout.js:46–201,257–352`; findings F5–F6. |
| Camera | **Implemented** follow/smoothing/recentering/seam rebasing and box obstruction; surface/occlusion coverage is limited. | `follow-camera.js:109–135,164–236`. |
| TVHead | **Implemented original procedural placeholder**, color/cap support; no rig/animation consumer. | `avatar.js:68–227,286–337`; `avatar-pose.js:7–43`. |
| Imported art pipeline | **Implemented local curated assets**, hash checking, transforms, resource retention; not final art direction. | `game-assets.js:21–27,44–118`; `asset-placements.js:77–153`; `assets/game/README.md:1–12`. |
| Graffiti and emotes | **Absent gameplay output**. Static target panels and input intents exist; F/E/Tag/Wave do nothing in local composition. | `skate.html:66,79–81,102–103`; `local-play.js:108–144`; native no-op comparison below. |
| Multiplayer | **Absent** transport, peer representation, protocol, room server and tests. | Missing-path and source scans below; `package.json:13,16`; `vitest.workers.config.js:5–12`. |
| Player-player collisions / crash ragdolls | **Absent and explicitly later scope**, not an initial acceptance blocker. Current `bailed` is a timer/reset state, not a simulated crash body. | `planar-skater.js:220–225,312–321`; `game-session.js:146–173`; user clarification above. |
| Persistence/accounts/progression | **Absent in reachable game state**; leaving resets local progress. No requirement inferred. | `game-session.js:146–173`; `main.js:271–277`; `local-play.js:99–105`. |
| Audio / final comic treatment / rigged GLB | **Absent from reachable runtime**; historical plan is not implementation. | Active imports `main.js:1–25`; renderer/material construction `main.js:127–163`, `planar-city-scene.js:466–483`, `avatar.js:68–103`. |

## 2. Movement/contact findings and feel hypotheses

“Confidence” below refers to source/probe evidence, **not hands-on feel evaluation**. A confirmed behavior can still require a user decision about the desired replacement.

### F1 — Confirmed: lower-height falling loses accumulated displacement

**High confidence, correctness defect.** Both free-motion and post-grind remainder compute `height = Math.max(0, position.y - groundHeight)`, then reconstruct the next Y as `groundHeight + integratedHeight`. Once below that baseline, each tick discards the previous negative displacement while vertical speed keeps becoming more negative. The vertical integrator itself is the ordinary constant-gravity equation; the coordinate conversion around it is wrong for a drop to a lower surface.

Sources: `js/game/core/planar-skater.js:161–180,296–302,343–345,357–360`; `js/game/core/skater-simulation.js:44–48`. Grind dismount explicitly sets the baseline to the elevated exit: `js/game/core/grind-state.js:125–133`.

Fresh production-world probe, 60 steps at 1/60 second, starting airborne at `[100,2,100]`, `groundHeight=2`, vertical speed 0: **Y=1.7686111111111114, vertical speed≈−14, still airborne**. Expected ballistic impact against its Y=0 fallback is `sqrt(2*2/14)≈0.534522` seconds. A flat-ground jump with baseline 0 can still behave acceptably because it lands before entering this below-baseline regime; this is not a claim that all jumping fails.

The normal authored-line probe is more directly consequential: from `spawn-skate-line`, holding throttle, **launch tick 85 → grind start 86 → grind end 94 → land 532**. It travels from dismount X≈134.345/Y≈1.735 to first landing X≈188.839 on `yard-west`. Thus the configured launch/grind sequence “completes” while missing the intended local runout. **PROPOSED:** treat this as a focused regression/correctness discussion before inferring a need for a new engine.

### F2 — Confirmed: landing does not require crossing a surface from above

**High confidence, correctness/contact-policy defect.** Airborne support searches allow a rise of 4, choose by proximity, then declare landing whenever descending and `currentY <= supportY + 0.02`. There is no previous-above/current-below contact crossing requirement. At `[132,1,80]`, downward velocity −1, zero speed, baseline 0, the next tick jumps *up* to `[132,1.2,80]` on `line-smooth-crest-exit:deck`, emitting `landed`.

Sources: `planar-skater.js:349–375` and the analogous remainder path at `175–192`; `planar-city-queries.js:52–70,107–139`. **PROPOSED:** separately establish lawful landing and grounded step/snap rules; changing a tolerance alone does not establish correct sided contact.

### F3 — Confirmed model limitation: coast exists, directional inertia does not

**High confidence in the model; medium confidence in the subjective consequence.** The state stores horizontal `forward` and nonnegative scalar `speed`, plus vertical speed—not a free planar velocity independent of facing. Steering rotates `forward`; movement immediately follows that new direction. The same acceleration, braking and steering branch runs in air. There is no explicit lateral slip/grip, angular response or gravity projected down a ramp. Ordinary wall impact sets all scalar speed to zero rather than preserving a tangential slide.

Sources: `planar-skater.js:69–94,286–324,326–345`; `skater-simulation.js:20–48`; `city-skater.js:19–33`.

Measured/inferred scale of the existing tuning:

- Max speed 12, acceleration 8, brake 18, neutral drag 0.6. Fresh ten-second coast probe: speed falls from 12 to approximately 6, not instantly to zero.
- At full steer/max speed, turn rate is `2.6*(1−0.5)=1.3 rad/s`, corresponding to an ideal horizontal turn radius about **9.23 units**. This is not intrinsically wrong, but is a material relationship to alley corner size and available clearance. Existing automated dogleg traversal deliberately controls speed around 4, not maximum speed (`tests/unit/planar-skater.test.js:446–478`).
- Fresh airborne steering probe changes forward while preserving speed 12. Therefore “just add more drag” would not add directional momentum.

**PROPOSED:** distinguish three questions: how long speed should persist, how facing/velocity/grip should differ, and how strongly air control should affect trajectory. The phrase “inertial movement” does not settle any of them. A custom arcade controller can implement those choices; a dynamic rigid body is not mandatory.

Against the clarified high-tech aggressive-inline-skating target, this is more than a cosmetic issue: speed is always clamped to 12, timed tricks affect scoring but never feed motion, and no wall-ride support mode exists. Momentum buildup through techniques/boosts and continuous ground→wall→air→grind flow therefore require behavior that the present scalar/controller composition does not supply (`skater-simulation.js:20–29`; `trick-state.js:27–78`; `local-play.js:108–144`). **PROPOSED:** evaluate that flow explicitly rather than treating later ragdolls/player collisions as a reason to overbuild an initial fully physical skate simulation.

### F4 — Confirmed: shared world data is only a partial render/query contract

**High confidence.** Positive: road/ramp rendering consumes the compiler's vertices and indices, and imported building placement and boxes share the same manifest-derived transform. That is worth preserving (`planar-city-scene.js:164–194`, `asset-placements.js:102–148`, `planar-city-surfaces.js:142–169`).

Exceptions are substantial:

1. **Invisible fallback ground.** Queries supply Y=0 support everywhere, but the compiler does not add a ground surface and the renderer only batches authored surfaces/assets/rails. At `[100,0,100]`, query returns `ground`; a downward Three.js raycast through the constructed planar scene finds no mesh. The avatar can skate off a visible road onto invisible supported space. `planar-city-queries.js:124–136`; `planar-city-surfaces.js:323–360`; `planar-city-scene.js:174–195,499–526`.
2. **Invisible wide primary-rail support.** `width=0.9` creates a support deck, but rails render as cylinders with radius 0.09. The decks themselves are skipped by the surface renderer. At `[92.75,0.82,180]`, support is `primary-rail-left:deck` at Y≈0.82 while the first visible hit is the ramp at Y≈0.248333. `planar-city-layout.js:160–169`; `planar-city-surfaces.js:202–231,234–260,331–334`; `planar-city-scene.js:178–180,198–235`.
3. **Support is not general solid collision.** Sweeps only iterate building/prop boxes; ramp/rail/deck triangles are vertically queried supports, not swept wall/underside solids. Building roofs are not support surfaces. Camera collision uses that same boxes-only sweep plus a global minimum Y, not rendered ramps/ledges. `planar-city-surfaces.js:328–354`; `planar-city-queries.js:153–194`; `follow-camera.js:100–135`.
4. **The body is a small swept contact-point proxy, not the visible 3-unit character volume.** `sweepBox` expands each local box axis by radius; it never sweeps a tall character capsule. Torso/head/overhead clearance is not established. `city-queries.js:148–175`; `planar-skater.js:310`; `shared/skate-tuning.js:4`; `avatar.js:50–65,112–175`.

The raycast scene probe used the vendored r137 library and synthetic box assets with manifest bounds—not loaded production GLB meshes or WebGL. The ground and procedural-rail findings are on renderer-owned geometry, unaffected by that substitution. Actual imported facade details were **not** visually or geometrically revalidated here.

**PROPOSED:** preserve the canonical-data principle, but decide which surfaces are rideable/solid and make visual affordances agree. A forgiving capture volume can intentionally exceed a rail's thickness; an invisible *grounded deck* is a different affordance and should not be conflated with capture forgiveness.

## 3. World layout and ramps/rails

### Measured current layout

Production compilation yields **256×256**, **8 building instances**, **4 props**, **20 support surfaces / 134 triangles**, **4 grind paths**, **1 launch marker**, **2 tag targets**, **11 graph nodes / 16 edges**. Nine render tiles repeat that canonical tile. The surface count includes three support decks; the thin pipe has no deck.

- Four straight wrap corridors: X-directed at Z=30 and 220; Z-directed at X=20 and 236. Widths vary, but the main skeleton remains four straight corridors. `planar-city-layout.js:257–278`.
- A long dogleg alley goes `[60,30] → [60,107] → [63,110] → [157,110] → [160,113] → [160,190]`, then connects to Z=220. Six staggered buildings frame selected parts; two more sit by yards. `planar-city-layout.js:101–137,287–293`.
- Plaza X=184…220/Z=112…146, default spawn `[202,0,130]`, a short connector to X=236, containers/tower/tank. `planar-city-layout.js:140–146,280–285,301–312,340–347`.
- The named `plaza-ramp` is actually at X=94/Z=160…184, outside that plaza: **three samples**, Y profile `0 → 0.745 → 0` over **24 units**, hence two straight slopes and a sharp crest. Both primary rails flank that same ramp at X=92.35 and 95.65, top 0.82, length 24. `planar-city-layout.js:149–171`.
- The *automatic* line is elsewhere: ledge X=124…138 at Z=80, crest Y=1.2, one +X marker at X=132, a very short pipe X=132.8…134.2, followed by a Y=0 runout X=132…146. The pipe's measured arc length is ≈1.435 units. `planar-city-layout.js:174–201,221–231,294–300`.

### F5 — Confirmed: the obvious ramp is not the automatic launch feature

**High confidence.** The primary ramp has no launch marker. Fresh full-throttle traversal from `[94,0,160]`, +Z, speed 12, through Z=190 stayed grounded, reached Y≈0.745, and emitted **no launch or grind events**. Launch belongs to the separate narrow ledge line. This can explain “ramps don't launch” without claiming launch code is absent.

The historical planar spec describes a 64-unit sine crest and separate alley/plaza box rails, not this 24-unit triangular crest with paired cylinders. Source and tests now explicitly accept peak height/count/width without establishing that old profile or locations. This is **document/source drift**, not authorization to “fix to spec” without reconfirmation. Sources: `docs/superpowers/specs/2026-10-29-planar-wraparound-city-design.md:78–95`; `tests/unit/planar-city-layout.test.js:297–300,417–420`.

**PROPOSED:** decide whether the desired ramp behavior is authored impulse, tangent/curvature/energy takeoff, or a hybrid. Under any choice, distinguish the visible ramp, the takeoff feature and the grind target so the player can read the line. Do not silently replace the historically approved speed-3/up-4 marker rule.

### F6 — Likely: layout validates clearance/connectivity more than skating flow

**High confidence in data gaps; medium confidence in their felt impact.** The graph connects its declared nodes, but has no edge for the primary ramp or the launch/runout feature. The local simulation does not constrain motion to graph routes and can use fallback ground. Thus graph connectivity proves neither a discoverable skating circuit nor a complete visible floor. Tests verify selected corridor geometry, not whether a newcomer can find or maintain lines.

The default plaza is roughly 86 units in straight wrapped X/Z distance from the automatic crest—over seven seconds even at max speed on an ideal direct path—and faces +X away from it. This is an inference from coordinates, not a claim that it is physically unreachable. The showcased browser line starts at `?testSpawnId=spawn-skate-line`; it does not establish discoverability from ordinary Join. Sources: `planar-city-layout.js:46–99,221–231,340–346`; `main.js:110–113`; `tests/e2e/traversal.spec.js:3–35`; `tests/unit/planar-city-layout.test.js:269–305,338–386`.

There are good raw ingredients: repeatable wrap routes, one building-shaped turning branch, meaningful scale, landmark props, canonical placements and stable feature IDs. But eight buildings over this tile and isolated skate spots are a **rough authored test environment**, not evidence of rich urban density, transfer variety, vertical routes or satisfying flow. More buildings alone would not fix launch/contact semantics. **PROPOSED:** judge a representative connected spot/line against the chosen movement and camera before endorsing this whole layout or replacing it. No new topology is selected here.

## 4. Camera, avatar, assets and game loop

### Camera and input: preserve the useful seams, reopen feel honestly

The camera has shoulder framing, speed look-ahead, follow-direction rate limiting, optional yaw/pitch/zoom, delayed recentering, exponential smoothing and seam rebasing. It collision-checks its final smoothed boom. These are meaningful existing systems, not just OrbitControls in play (`follow-camera.js:14–33,85–98,109–135,174–236`; `main.js:263–285,350–360`).

Its collision knowledge is limited to the box proxies described in F4. Tight alleys, ramp occlusion, controller sensitivity, framing and comfort need mounted/physical review. Do not infer camera quality solely from finite-vector/height assertions. Historical user feedback calls the earlier camera good, but that is not fresh approval of the present city (`tests/manual/device-matrix.md:31–38`).

The input layer has real value: exclusive active-device ownership; normalized held/edge fields; per-control stale suppression; calibration/diagnostics; pointer cancellation; reason-based modal/focus/visibility suspension. Preserve behavior and regressions if code is replaced. Sources: `input-router.js:20–25,39–74`; `gamepad.js:130–136,166–228,260–292`; `touch.js:71–99,155–194`; `runtime/input-lifecycle.js:1–27`; `ui/controls-panel.js:112–147`.

Descriptions still advertise tagging/emotes without consumers. **PROPOSED:** distinguish available controls from unfinished actions; whether to implement or hide those actions is a product decision, not automatic scope expansion (`skate.html:60–81,94–104`).

### Avatar and art: placeholder, not an animation foundation already completed

Fresh vendored-library construction measures **26 mesh nodes / 470 triangles**, matching old reports. `applyAvatarPose` only sets root position/orientation and metadata; it never poses limbs or reads `activeTrick`/balance. A completed Spin is a rule event/HUD entry, not an actual visible spin. Root alignment/support offset is useful, but this is not a rig, skating animation or final TVHead mesh (`avatar.js:68–227`; `avatar-pose.js:7–43`).

No `.blend`, game character GLB, audio file or graffiti SVG was found in the asset tree; its GLBs are the industrial pack. The original `atltvhead.obj` remains the website/reference asset and must be preserved. Historical Blender/rigging deliverables are plans, not present artifacts (`docs/superpowers/specs/2026-10-28-skate-city-playability-and-comic-art-design.md:33–41,87–97`).

The current world/avatar use `MeshStandardMaterial`, neon/dusk colors and ordinary lights, with shadows disabled at the renderer. This is not the historical paper/ink/orange comic direction, and neither visual similarity nor quality was browser-reviewed here (`planar-city-scene.js:466–483`; `avatar.js:72–103`; `main.js:127–163`; historical target at the October 28 spec `:99–111`). **PROPOSED:** retain original identity and customization while revisiting the presentation implementation; choose any new rig/asset workflow explicitly.

### Assets/licenses and performance

- Twelve curated local GLBs and one referenced colormap are present. Fresh SHA-256 verification matched **all 13 manifest hashes**. This establishes byte consistency with the checked-in manifest, not independent provenance or a new source-pack comparison. `assets/game/manifest.json:3–25,188–282`; `game-assets.js:21–27,44–65`.
- Local pack license identifies City Kit Industrial 2.0 / CC0; the official Kenney page also lists CC0. Preserve provenance/license files. Three's vendored game utilities carry MIT terms requiring the notice. No rights to franchise characters, music, logos or ripped assets are inferred from “inspired.” `assets/game/kenney-industrial/License.txt:3–15`; `lib/game/LICENSE:1–21`; external sources below.
- The manifest/loader, abort generation guards, reference counts, explicit disposal and static merge are valuable, but not proof of a future animation-ready clone pipeline: retention currently uses plain `clone(true)`. `game-assets.js:29–42,67–118`; `main.js:527–553`.
- Nine tiles share merged geometry/materials, but scene creation retains **108 asset scene instances** even though only the central copy is traversed for the static batch. This is current ownership/retention overhead, not 108 unique GPU textures. Fresh synthetic scene construction/release returned matching retain/release counts. `planar-city-scene.js:463,485–503,528–564`.
- Support queries scan all triangles, and capture considers nine periodic images per path. Adequate or inadequate performance has **not** been measured on target devices. No BVH, ECS, worker-threading or instancing rewrite is justified solely by code size. `planar-city-queries.js:116–122,170–187`; `grind-state.js:52–74,235–253`.
- Twenty-six avatar mesh nodes are not automatically twenty-six measured submissions in every view, but triangle count alone is no multiplayer render budget. The old 12-avatar diagnostic reported high calls; it is historical, not a fresh phone/FPS result (`docs/superpowers/reviews/2026-10-27-skate-city-architecture-review.md:23–30`).

### Timing

The simulation boundary is a keeper candidate: fixed 60 Hz, max six catch-up steps/100 ms, deferred edges consumed once, excess time bounded, hidden/modal time discarded. Fresh native probes produced exactly identical production-line state and events after 180 ticks under 30/60/120 render schedules. This proves schedule independence for that fixture, **not good physics** (`fixed-step.js:41–60,68–120`; `game-session.js:39–68,101–127`).

Rendering currently uses the latest state directly. Although previous state/alpha are retained and exposed, `main.js` does not interpolate them for avatar rendering. High-refresh visual stepping is a plausible concern, not observed browser jitter. `game-session.js:81–98,185–194`; `main.js:340–360`.

`main.js` passes per-frame `elapsedMs` into `applyAvatarPose`, not accumulated `elapsedPlayMs`. Present code only stores that value, so this does not currently break a real clip player; it is an important integration trap if animation is added (`main.js:349`, `game-session.js:94–95`, `avatar-pose.js:38–42`). **PROPOSED:** keep simulation, presentation and any future network clocks distinct; no clock/persistence contract is chosen here.

## 5. Multiplayer and hosting reality

**No multiplayer is implemented in this checkout.** This is based on the reachable graph plus a scan of production game modules for `WebSocket`, `RTCPeerConnection` and `EventSource` (zero matches), and confirmed absence of:

```text
workers/
workers/skate-room/wrangler.jsonc
js/game/net/
tests/workers/
playwright.room.config.js
```

`dev:room` points to that nonexistent config. Worker tests allow an empty suite; the config only supplies Miniflare compatibility metadata. The session only exposes `joinLocal`, creates one local skater and resets it; UI correctly says offline. There is no remote-avatar list, synchronization, reconciliation/interpolation, admission control or server authority hidden behind the Join button. Sources: `package.json:12–16,34–39`; `vitest.workers.config.js:1–12`; `game-session.js:146–173`; `main.js:271–277,330–361`.

The older roadmap's Cloudflare Durable Object, one-room/12-player/5 Hz/casual-client-simulation approach is **historical proposed architecture**, not implemented infrastructure or a freshly accepted current product constraint. It includes security/lifecycle obligations, not free functionality conferred by installed package names (`docs/superpowers/plans/2026-10-27-tvhead-skate-city-tdd-plan.md:55–70,299–313,417–428`). Do not assume competition, duels, cooperation, persistent identity or any particular backend from those notes.

The clarified **shared world first, challenges later** direction makes shared presence/movement the initial multiplayer concern, not reviving the old duel rules. Eventual player-player collisions/ragdolls are a future authority/latency/design consideration, not permission to include crash simulation in the initial slice or select an engine/provider now.

GitHub Pages serves static HTML/CSS/JS. It can distribute a Three.js client; it does not execute the room server envisioned by that script. Shared sessions require separately supplied coordination/transport/authority services as appropriate; even peer-to-peer designs need their discovery/signaling/connectivity problem addressed. Pages' asset/bandwidth/deployment limits also remain relevant as content grows. This is a hosting boundary, **not a recommendation to deploy Cloudflare or replace Pages**. Official sources are below.

**PROPOSED boundary questions:** who owns shared state, what must be trusted, what survives leaving/restarting, how latency/disconnect affects local movement, and what operational limits/costs are acceptable? These must be answered before choosing or reviving the old backend plan. Deterministic local event IDs and world descriptors are useful ingredients, not an anti-cheat or synchronization protocol.

## 6. Test evidence: useful, incomplete and not freshly all green

### Existing tests inspected

- Unit coverage includes geometry/placement/query consistency, seam math, laps, wall fall/escape, jump boundaries, directed launch/manual-Jump precedence, capture thresholds/cooldown, signed grind/dismount/balance, timed tricks, combo dedup/banking, device ownership/reset, camera, assets and lifecycle. Concrete examples: `tests/unit/planar-skater.test.js:119–250,252–402,446–538`; `tests/unit/planar-grind-state.test.js:49–120,161–235`; `tests/unit/local-play.test.js:30–114`; `tests/unit/fixed-step.test.js:44–106`.
- Browser tests include real mounted keyboard movement, synthetic pad/touch input, playable-line event flow, mobile HUD geometry, world switching, WebGL recovery and real imported-asset scenes. These are stronger than unit-only mocks. Sources: `tests/e2e/traversal.spec.js:3–140`; `tests/e2e/trick-flow.spec.js:3–57,60–117,119–164`; `tests/e2e/planar-city.spec.js:232–290`; `tests/e2e/planar-render.spec.js:3–26,81–100,130–147`; `tests/e2e/skate-shell.spec.js`.
- The geometry/clearance fixture computes its own ideal ballistic trajectory; that does not verify production integration. The mounted line does verify event order, but accepts any truthy landing surface, allows 30 seconds, and only demands X>150. Those assertions permit the F1 trajectory to pass while landing on a distant yard. `tests/unit/planar-city-layout.test.js:338–386`; `tests/e2e/traversal.spec.js:31–68`.
- Scene unit tests use fake bounds-box assets; separate E2E tests load actual assets. Do not conflate them. `tests/unit/planar-city-scene.test.js:16–39,89–137`; `tests/e2e/planar-render.spec.js:81–100`.
- `tests/unit/seam-grind.test.js:14–70` drives a fixture-only rail through fixed-step inputs. Valuable regression, not proof a production seam rail exists or is discoverable.

### Acceptance evidence missing or still open

**PROPOSED acceptance topics, not a new approved test plan:** analytic lower-floor falls; one-sided landing/underside contact; expected landing location and time; visible support/solid geometry agreement; wall-grazing/slope-energy/air-control behavior against a chosen feel contract; finding a linked line from default spawn; repeated line variations at useful speeds; audiovisual state readability; physical device/comfort/performance; sustained multi-client behavior/security/recovery if a backend is built.

For the clarified goals, those topics also need to cover momentum-building and wall-ride transitions rather than only the existing ground/air/grind states. Desktop keyboard/gamepad acceptance has priority; phone/on-screen-gamepad work is secondary. Challenge systems, player-player impacts and crash ragdolls should not silently become initial acceptance criteria.

The repository itself leaves city feel/art, physical phones/controllers and final acceptance pending. Its latest historical record says **263 unit / 53 browser passed**, worker suite empty. That is prior evidence, not this audit's result (`docs/reviews/2026-10-29-skate-city-pending-review-gates.md:8–27`). The device matrix still contains old spherical/pole instructions and says automatic mechanics are later work, while newer code implements them; use it as historical/test-coverage evidence, not a fully current checklist (`tests/manual/device-matrix.md:19–22,40–48`).

### Commands and actual outcomes in this audit

| Command | Actual outcome |
| --- | --- |
| `git status --short` (initial) | `?? AGENTS.md` and `?? docs/agents/`; preserved. |
| `git rev-parse HEAD` | `3800d52f3526c3aa59dece147e8eea8e1cda0432`. |
| `git log -5 --oneline` | Latest code commit `3800d52 feat: execute timed tricks and bank local skating chains`; preceding launch/grind commit `2fb928c`. |
| `node --version` | `v22.23.1`. |
| `npm ls --depth=0` | Exit 1 / `ELSPROBLEMS`: all six declared packages unmet (`three`, Vitest, Playwright, Cloudflare plugin, Wrangler, http-server). |
| `npm run test:unit` | Exit 127: `vitest: command not found`; suite did not run. |
| `npm run test:workers` | Exit 127: `vitest: command not found`; not an empty-suite pass this session. |
| `npm run test:e2e` | Exit 127: `playwright: command not found`; browser/server did not start. |
| `npm run build` | Exit 0; only prints `Static site - no build required`. Not compilation/link/asset validation. |
| Native `node --input-type=module` probes described below | Simulation, scene/raycast, graph/hash and regression/syntax commands completed exit 0, except the explicitly corrected floating-point assertion below. The full minimal physics reproduction printed below was also executed unchanged, exit 0, reproducing the stated drop/landing/line values. |
| `git diff --check` | Exit 0, no output; tracked diff check, not execution or untracked-report validation. |
| Report-only native content/whitespace check | Exit 0 / `REPORT_CHECK_OK`; checked final newline, no trailing whitespace, and inclusion of the clarified user goals. |

`package.json:31–39` declares Three `^0.137.0`, Vitest `^5.0.5`, Playwright `^1.64.1`, Cloudflare plugin `^1.4.9`, Wrangler `^4.154.0`, http-server `^14.1.1`; lockfile records those exact versions without carets. Browser boot uses vendored r137, not npm resolution; missing dev packages do **not** establish a broken deployed/static game. No installation or `npx` was attempted. CI normally installs dependencies and Chromium, then runs `npm test` and the echo build (`.github/workflows/game-tests.yml:18–34`); current CI status was not queried.

#### Read-only native probe commands

All were executed from the repository root via **`node --input-type=module <<'NODE'`**, with inline programs and no saved scripts. They do not replace the existing Vitest/Playwright suites. The following is the complete minimal reproduction of the main physics findings and production line:

```sh
node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs';
import { createPlanarCityLayout } from './js/game/world/planar-city-layout.js';
import { compilePlanarWorld } from './js/game/world/planar-city-surfaces.js';
import { createPlanarSkater, stepSkaterOnPlanarCity } from './js/game/core/planar-skater.js';
import { createLocalPlayState, stepLocalPlay } from './js/game/core/local-play.js';
const manifest = JSON.parse(readFileSync('assets/game/manifest.json'));
const world = compilePlanarWorld(createPlanarCityLayout({ assetManifest: manifest }));
let drop = { ...createPlanarSkater(world), position: [100,2,100], groundHeight: 2,
  mode: 'airborne', verticalSpeed: 0, speed: 0, coyoteAgeMs: 101 };
for (let i=0; i<60; i++) drop=stepSkaterOnPlanarCity(drop,{},1/60,world).state;
console.log('drop',drop.mode,drop.position[1],drop.verticalSpeed,Math.sqrt(4/14));
const below={...createPlanarSkater(world),position:[132,1,80],groundHeight:0,
  mode:'airborne',verticalSpeed:-1,speed:0,coyoteAgeMs:101,surfaceId:'ground'};
const landed=stepSkaterOnPlanarCity(below,{},1/60,world);
console.log('below',landed.state.position,landed.state.mode,landed.events.map(e=>e.type));
let line=createLocalPlayState(world,'spawn-skate-line');
for(let i=0;i<600;i++) {
  const result=stepLocalPlay(line,{throttle:1},1/60,world); line=result.state;
  for(const event of result.events) if(event.type!=='grindProgress')
    console.log('line',line.tick,event.type,event.surfaceId??event.pathId??'',line.position);
}
NODE
```

The actual executed diagnostic programs additionally asserted the observed behavior, printed inventory, traversed the primary ramp for 150 ticks, compared ten-second coasting and queried off-road support. Main results: inventory listed in §3; drop and below-deck values in F1/F2; line events 85/86/94/532; primary ramp no events and maximum Y≈0.745; coast speed≈6; off-road surface `ground`. An initial below-primary-rail sample at `[92.35,0.7,170]` stayed airborne; that sample is **not** evidence of upward snapping. The later ledge sample is the confirmed counterexample.

For the render/query probe, the executed command used Node's `vm.runInNewContext` to evaluate `lib/three.min.js` and `lib/game/BufferGeometryUtils.js`, created fake asset groups from every manifest bound using `THREE.BoxGeometry`/`MeshBasicMaterial`, then called the unchanged `createPlanarCityScene`. A downward `THREE.Raycaster` from `[x,10,z]` was compared with `queryPlanarSupport` at `[100,0,100]`, `[92.75,0.82,180]`, `[132,1.2,80]`. Outputs:

```text
revision=137; tiles=9; retained=108
[100,0,100]       support ground Y=0; mesh hit=null
[92.75,.82,180]   support primary-rail-left:deck Y=.8199999999999998;
                  mesh first hit ramp Y=.24833333492279053
[132,1.2,80]      support ledge deck Y=1.2; mesh rail Y=1.199999988079071
retain/release counts equal after city.dispose()
```

First execution exited 1 because the ad-hoc probe asserted exact `0.82 === 0.8199999999999998`; rerunning with `abs(actual−0.82)<1e−9` completed exit 0, then also confirmed F2. That failed assertion was a probe precision mistake, **not** a new product defect.

The native regression/syntax command imported `node:assert/strict` and the production modules, then checked:

```text
PASS positive-axis-lap spawn-wrap-x 1280
PASS positive-axis-lap spawn-wrap-z 1280
PASS production-line-fixed-step-equivalence (30/60/120 FPS, 180 ticks each,
     identical states/events: launched, grindStarted, grindEnded plus progress)
PASS tag-emote-input-has-no-runtime-effect (neutral vs Tag+Wave deep equality)
PASS local-jump-spin-banks-100
air-steering speed=12; forward=[.9997652869600542,0,.021664971490407324]
avatar meshNodes=26; triangles=470; supportOffset=.0849519041180611
PASS node-syntax-checks 96
```

Exact check method: both positive-axis laps used initial speed 12, throttle 1, 1,280 steps at 1/60 and asserted return within 1e−6; schedule checks called `advanceFixedStep` for three seconds with `stepLocalPlay`; no-op inputs compared one-tick results; Spin was started with Jump and advanced 90 neutral ticks. Syntax checks executed **`node --check <file>`** via `spawnSync` on every `.js` in `js/`, `tests/`, `scripts/`, and root `*.config.js` (96 files, all exit 0). No GPU/context/browser was involved.

The inventory command recursively read all `js/game/**/*.js`, extracted local static import/re-export paths, traversed from `main.js`, and reported 40/41 reachable modules. It separately checked the missing paths in §5, scanned the game modules for the three transport API identifiers, read exact locked package versions, and verified SHA-256 via `node:crypto` for each manifest asset/dependency (13 matches). A static graph is evidence about this source tree, not deployed bundles or arbitrary future dynamic loading.

**Not verified:** browser boot/gameplay, screenshots, GLB loading/materials on GPU, actual frame times/draw calls/memory, physical keyboard/controller/phone feel, current CI/live site, DNS/Pages configuration, multiplayer capacity/security/latency, source-pack byte equivalence or third-party franchise rights. The absence of installed test tooling limits this session; it is not game acceptance failure. Existing screenshot paths referenced by historical notes were not opened or treated as fresh evidence.

## 7. Keep / rework / replace / defer matrix

Every recommendation in this section is **PROPOSED**. “Replace” means validate an approved alternative before retiring an old implementation, **never delete first**.

| Area | PROPOSED disposition | Reason and preservation boundary |
| --- | --- | --- |
| Portfolio/viewer/pages/navigation | **KEEP** | Separate value and separate entry points. Preserve original HTML/CSS/viewer behavior, OBJ and game links. A game rewrite is not permission to rewrite the website. |
| Three.js as renderer | **KEEP** | Consistent with user intent; not responsible for custom integration defects. Version migration is a separate decision. Shared `lib/three.min.js` is used by the viewer too. |
| Fixed-step/session/input lifecycle | **KEEP behavior; targeted rework only if evidenced** | Good existing separation and regressions; preserve edge consumption, reset, pause/retry/disposal and device fallback. Not a reason for a framework rewrite. |
| World compiler/shared transforms/IDs | **KEEP principle, REWORK coverage** | Active roads/buildings largely share data. Resolve ground/deck/solid/body discrepancies without pretending current proxies cover everything. |
| Movement/support/landing | **REWORK; possibly REPLACE the bounded core** | Confirmed integration/contact defects plus scalar-speed limitations. Preserve public behavior only where reconfirmed, event ordering, input boundary and strong regressions—not every wrong numeric result. |
| Launch/grind state | **KEEP useful mechanisms, REWORK composition/content as approved** | Explicit paths, source lock, endpoint guard, signed dismount and balance are substantive. Retest against corrected falls/contact; preserve/reopen recorded rule approvals explicitly. |
| Current whole-city layout | **REWORK or REPLACE authored layout** | Clearance/wrap checks are valuable, but visible floor, default-spawn discovery, speed-scaled corners and linked landing flow are not established. Preserve current layout as comparison/fixture until a replacement is validated. |
| Spherical preview | **KEEP unless user changes its role** | It is live website/menu content, not obsolete planar physics. Keep/remove is an experience decision. |
| Procedural avatar/presentation | **KEEP as fallback/reference; REPLACE or substantially REWORK final presentation** | Identity/customization/contact-root useful; no rig or state animation. Preserve original OBJ and known customization behavior. |
| Kenney assets/import manifest/licenses | **KEEP reusable assets/tooling** | Local, hashed, documented license, matching transforms. Keep files even if some placements/style change. Their existing use does not mandate them for every future foreground. |
| Camera | **KEEP candidate, REWORK with accepted movement/layout** | Many useful behaviors already exist; obstruction model and tight-corner comfort need validation. Do not discard a historically liked camera without comparison. |
| Timed trick/combo reducers/HUD | **KEEP candidate; reassess fit** | Pure event rules are reusable and do not require current geometry. Existing local scores are not server-validated scores. |
| `tag-targets.js` and target records | **DEFER wiring or adapt after product choice** | Valid useful preparatory code, currently not gameplay. Preserve rather than deleting as “unused.” |
| Legacy spherical sim exports/adapters | **DEFER retirement** | Some exports are unused in ordinary play, but their modules contain active helpers and tests. Prove symbol-level consumers and compatibility obligations before any approved removal. |
| Networking/cloud packages/room script | **REWORK scaffolding after architecture decisions; shared world remains a product priority** | No implementation to salvage as a server. “Defer provider choice” does not mean defer the user's shared-world goal behind challenges. Do not install, remove dependencies or implement the stale duel roadmap by assumption. |
| Wall-ride/momentum flow | **REWORK/EXTEND movement only after approved semantics** | User-stated core target, currently absent. Test continuity across support modes and speed-building behavior rather than treating skate mesh/style as the deliverable. |
| Challenges, player-player impacts, crash ragdolls | **DEFER initial implementation** | User explicitly puts these later. Preserve room for discussion without implementing speculative collision/ragdoll infrastructure up front. |
| Docs/test harness | **KEEP evidence; REWORK stale descriptions** | Tests are substantial; correct acceptance gaps rather than deleting inconvenient tests. Documentation updates are separately authorized work, not performed here. |

## 8. Strategy comparison — architecture remains OPEN

Decision **FOUNDATION-01 — OPEN**: which implementation scope gives the desired skating feel and multiplayer foundation without destroying useful website work?

| Strategy | Relative cost | Strengths | Failure modes / reversibility |
| --- | --- | --- | --- |
| **PROPOSED A — Keep architecture, repair and tune** | Lowest initial code churn; feel iteration still required. | Correct F1/F2, reconcile visible/contact content, evaluate existing arcade model before introducing dependency risk. Preserves most tests/lifecycle. | Tuning cannot create independent velocity, richer collision or a coherent city by itself. Fails if “keep” becomes a ban on changing the inadequate model. Highly reversible with focused behavior changes. |
| **PROPOSED B — Incremental bounded replacement** | Medium implementation and integration cost. | Replace movement/contact and a representative skate spot while preserving Three.js/page/session/input/identity; compare against existing implementation and retained fixtures. Can remain custom or use a separately approved collision/physics library. | Temporary adapters, incompatible state semantics, event/score/contact regressions. Requires explicit interface decisions rather than blindly freezing every existing field. Good reversibility if old playable path remains until validation. |
| **PROPOSED C — Rewrite game subsystem, preserve website** | Highest total cost and regression exposure; no defensible calendar estimate before scope. | Allows a coherent controller/world/presentation/network design if current assumptions fundamentally conflict with desired game. Existing website and source assets need not move. | Rebuilds boot/input/disposal/test coverage; greenfield still needs the same feel/art/backend decisions and may repeat the defects. Least reversible if old code is removed early; far safer as an approved parallel replacement with validation before retirement. |

**PROPOSED recommendation:** B is the strongest working hypothesis given the clarified momentum-building/wall-ride flow target, which materially exceeds this scalar controller; A is a credible lower-churn alternative if it includes actual controller evolution, not just drag tuning. Shared presence should not be displaced by implementing challenges first. There is no evidence that C or a new framework is necessary; Three.js stays by user requirement. The confirmed bugs justify repair/re-evaluation, not an automatic full rewrite. No strategy is selected and no implementation plan is authorized.

### Physics approaches inside any strategy

These clarify alternatives, **not a dependency selection**:

1. **PROPOSED custom arcade/kinematic controller:** explicitly own velocity/facing/grip, gravity, support/sweeps and grind constraints. Maximum feel control and easiest reuse of pure tests; highest responsibility for contact edge cases. Keeping the present model is the smallest variant, not the only custom option.
2. **PROPOSED hybrid controller plus physics queries/character controller:** outsource suitable collision queries/move-and-slide while retaining authored skating/launch/grind behavior. Can improve solid/body/slope coverage, but integration, asset colliders, periodic-world semantics and rule transitions remain custom. Rapier's official JS 0.21 docs explicitly say character behavior is game-specific, gravity still comes from the application, and its built-in character controller only supports translation—not rotational movement.
3. **PROPOSED dynamic rigid body plus authored assists/constraints:** engine-integrated forces, contacts and velocity can support physical momentum. Harder to obtain precise arcade steering, reliable skate stance and grind transitions; fully physical skates/ragdolls are not required by the current request. Network authority/replay/determinism implications need separate investigation. An engine is not a shortcut to the feel of the reference games.

Useful uncertainty-reduction evidence would be the *same* small slope/drop/corner/rail-transfer scenario under candidate controller behavior, with numerical contact tests and user hands-on comparison. That is a **PROPOSED evaluation**, not a staged implementation prescription or authorization to build prototypes/install packages.

## 9. Primary-source research and applicability

Accessed during this audit session dated 2026-11-11 (tool/npm timestamps cross into 2026-11-12 UTC). No repository code, sensitive strings or assets were sent to search providers; official public URLs were fetched directly. No external code/assets were copied.

| Source | Finding / applicability |
| --- | --- |
| [Three.js r137 official “Making a Game” manual source](https://raw.githubusercontent.com/mrdoob/three.js/r137/manual/en/game.html) | Explicitly says Three.js is a 3D library/scene graph, not a game engine providing physics, collision or input. Version-matched primary source: current local renderer is r137. This supports retaining the renderer while deciding movement separately, not adopting its example architecture. |
| [Current official WebGLRenderer docs](https://threejs.org/docs/pages/WebGLRenderer.html) | Renderer displays a scene through a camera; `info` exposes render/resource statistics. Current docs also note WebGL1 removal since r163: **do not apply current API/platform assumptions blindly to r137** or upgrade the shared site library casually. |
| [GitHub: What is GitHub Pages?](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) | Pages is static hosting for HTML/CSS/JS, optionally built before publication. Inference: client hosting does not supply a live room backend. |
| [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) | Published site ≤1 GB; source repo recommended 1 GB; soft bandwidth 100 GB/month; deployment timeout 10 minutes; soft 10 builds/hour with documented custom-Actions exception. These are hosting constraints, not a concurrency/player-count guarantee. No measured production traffic/cost claim here. |
| [Rapier official JS controllers guide, 0.21](https://rapier.rs/docs/user_guides/javascript/character_controller/) | Generic kinematic controller adjusts desired translations via casts/move-and-slide, with slope/step/snap rules. Game-specific behavior remains the application's responsibility; gravity is application-supplied and rotation unsupported by the built-in controller. Illustrates hybrid tradeoffs, not a recommendation to install it. |
| [Rapier official JS rigid-body guide, 0.21](https://rapier.rs/docs/user_guides/javascript/rigid_bodies/) | Distinguishes dynamic, fixed and kinematic bodies; colliders supply contact shape. Kinematic bodies do not automatically obey force/contact responses; dynamic-body pose teleporting can cause odd behavior. Illustrates why “add physics” is not a single interchangeable choice. No determinism/backend suitability conclusion is drawn from this guide. |
| [Kenney City Kit Industrial official asset page, 2.0](https://kenney.nl/assets/city-kit-industrial) | Lists Creative Commons CC0, consistent with checked-in pack license. Does not establish rights to unrelated franchise assets or automatically validate each downloaded byte. |

Retrieval limitations: current `https://threejs.org/manual/en/game.html`, current `.../manual/en/creating-a-scene.html`, and master-branch `manual/en/game.html` returned 404. The official **r137** manual above succeeded; no 404 content was treated as evidence. The current docs index/manual shell returned only navigation, so the successful direct renderer page was used instead.

## 10. Questions for subsequent user grilling

All below are **OPEN**, not implicit requirements:

- What specifically is missing from “inertia”: persistent coast, delayed turning/grip, drifting, slope speed changes, airborne momentum, speed carry through impacts, or something else? What would an unacceptable loss of control look like?
- Within the stated flow/jump/trick/wall-ride/grind target, what should a good sequence feel like and how should momentum be built/spent? How much do graffiti/social identity and audiovisual style matter alongside that core? Inspiration does not require copying the reference games' whole mechanics lists.
- Should ordinary ramps launch from shape/speed, only marked lips, or a combination? How much automatic rail capture/forgiveness and balance management is desirable?
- How should ordinary wall impact differ from entering a deliberate wall ride? Should grazing walls preserve flow? Are rooftops, overhead passages or multi-level routes also wanted? Player-player collisions and crash ragdolls are already stated as later scope, not an initial deliverable.
- What should ordinary Join reveal and teach? Does a player need a compact dense spot, a broader city, continuous wrap, bounded districts, or another topology? Is the spherical preview still valuable?
- Within **shared world first**, is initial interaction limited to seeing/skating with others, or are shared actions essential too? Challenges come later; competition/cooperation rules need not be assumed now. Which shared outcomes need trust/authority?
- Given **desktop/gamepad first, phone/on-screen-gamepad second**, which actual devices/browsers and minimum frame rates matter, and how many visible/concurrent players are worth supporting? The old 12-player constant is not an answer by itself.
- Should anything survive Leave, refresh, room restart or deployment? If not, avoid inventing accounts/storage; if yes, define exactly what.
- Which existing identity/assets/camera/customization behaviors are nonnegotiable, and which can change? Are historical comic-art/rigging choices still desired, or should they be reopened?
- What operational service/cost/privacy/maintenance burden is acceptable beyond static hosting? No provider choice is made here.

**What questions or other options would you like to explore? Reply freely; no decision has been made.** This report is a research handoff, not an implementation plan or approval to delete/replace anything.

## 11. Follow-up verification after authorized dependency installation

The user subsequently authorized installing Vitest and Playwright to test. These results supplement, rather than replace, the earlier missing-tooling record. No product code, test assertions, package manifest, or lockfile was changed.

| Command | Actual outcome |
| --- | --- |
| `npm ci` | Installed 136 packages from the existing lockfile; npm reported zero vulnerabilities. |
| `./node_modules/.bin/playwright install chromium` | Installed Chromium and its bundled support downloads. Playwright warned that this OS is not officially supported and selected the Ubuntu 24.04 fallback. That warning alone does not establish the cause of any failure. |
| `npm run test:unit` | **33 files / 263 tests passed**, exit 0. |
| `npm run test:workers` | **No tests found**, exit 0 due to the existing `--passWithNoTests` configuration. Not multiplayer evidence. |
| `npm run test:e2e` | Initial command allowance expired at 120 seconds, exit 143; four tests had reported failures, and no complete Playwright summary was produced. This is an interrupted run, not a full-suite verdict. |
| `npm run test:e2e -- --output=/tmp/opencode/atltvhead-e2e-2026-11-11-full --reporter=list` | With a 600-second command allowance and unchanged default four workers: **48 passed / 5 failed**, completed in about 2.5 minutes, exit 1. |
| `npm run test:e2e -- --workers=1 --grep 'planarCity_lapsBothAxesWithoutCameraPop\|planarCity_leaveFromOpenControlsPreservesCustomizationWithoutStaleJump\|planarCity_seamSupportAndCameraStayContinuous\|trickFlow_actualOfflineSpinGrabBanksChainAndLeaveResetsIt\|combo_wrapCrossingDoesNotDuplicateOrResetActions' --output=/tmp/opencode/atltvhead-e2e-2026-11-11-serial --reporter=list` | **All 5 selected tests passed**, about 1.9 minutes, exit 0. This is a subset rerun, not a fresh full-suite pass. Pipes are escaped here for Markdown table rendering; the shell regex used ordinary pipes inside single quotes. |
| `git diff --exit-code -- package.json package-lock.json` | Exit 0: manifest and lockfile unchanged. |
| Native minimal physics reproduction from §6, rerun by parent session | Reproduced the one-second drop at Y=1.7686111111111114, upward landing from Y=1 to Y=1.2, and authored line events at ticks 85/86/94/532. |

### Completed four-worker browser failures

- `planarCity_lapsBothAxesWithoutCameraPop`: timed out waiting for the expected street/position/speed/heading condition at `tests/e2e/planar-city.spec.js:364`.
- `planarCity_leaveFromOpenControlsPreservesCustomizationWithoutStaleJump`: timed out waiting for airborne state; its captured final state was grounded at the plaza (`tests/e2e/planar-city.spec.js:728`).
- `planarCity_seamSupportAndCameraStayContinuous`: timed out during gamepad-driven positioning; captured state was supported by fallback `ground`, not the expected road (`tests/e2e/planar-city.spec.js:96,766`).
- `trickFlow_actualOfflineSpinGrabBanksChainAndLeaveResetsIt`: timed out observing an active Spin (`tests/e2e/trick-flow.spec.js:15`).
- `combo_wrapCrossingDoesNotDuplicateOrResetActions`: timed out waiting for both seam crossing and pending base 100 (`tests/e2e/trick-flow.spec.js:207`).

Failure traces and error contexts are under `/tmp/opencode/atltvhead-e2e-2026-11-11-full/`. The first interrupted run's artifacts remain under `test-results/`. The separate single-worker rerun of exactly the five failures passed all five, without changing test code, application code, or per-test timeout settings. Its output directory is `/tmp/opencode/atltvhead-e2e-2026-11-11-serial/`.

**Inference, not diagnosed cause:** the four-worker failures are sensitive to execution conditions; rendering load or timing-sensitive observations are plausible contributors. A single subset rerun cannot isolate concurrency from ordering/load variation or rule out application races. Do not relabel the failed full run as green, silently change worker configuration, or infer that the independently reproduced physics defects are fixed. No fresh full 53-test single-worker run was performed.

Automated Chromium coverage does not establish physical gamepad/phone feel or human art acceptance. No bug fixes or test loosening were attempted.
