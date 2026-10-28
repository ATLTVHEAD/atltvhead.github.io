# TVHead Skate City — architecture and inspiration review

**Reviewed:** 2026-10-27, branch `feat/tvhead-skate-city`, source through `90af673`.
**Scope:** source, tests, tooling, the existing implementation plan, and Jet Set Radio / Abeto Messenger as references. This is a review and proposed design amendment, not permission to resume implementation. No gameplay code is changed by this review.

## Review checklist

- [x] Read the design brief, constraints, completed tasks, remaining tasks, current game modules, page/CSS, test suites, and test configuration.
- [x] Consult the supplied Messenger site and its creators' technical/design account; distinguish observations from recommendations.
- [x] Run the existing suite and focused diagnostic probes; separate tested infrastructure from unimplemented gameplay.
- [x] Evaluate mechanics, presentation, interfaces, dependencies, performance, and future rework risks.
- [x] Revise the existing plan in place, preserving Tasks 1–4 and their commits.
- [x] Check revised dependencies, acceptance tests, and completion criteria for consistency.

## Verdict

**Keep the completed foundation, but change the remaining order before implementing more features.** The current result is a customizable spherical-city preview, not a playable Jet Set Radio-like game. It aligns with the isolated-page, original TVHead, low-poly, guest-only, and spherical-blockout goals. It has not yet demonstrated skating, route traversal, ramp launches, grinds, tricks, a gameplay camera, or multiplayer. That is understandable at Task 4; calling those systems complete or postponing their integration to the final task would not be.

There is one design/implementation document in `docs/`: the original plan containing the approved brief. There is no separate approved spec or implemented Worker to review. Earlier completion records are implementation history, not evidence that a complete game or its manual acceptance has passed.

## Evidence and limitations

- Fresh `npm test`: **45 unit tests, 9 Chromium browser tests passed**. Worker runner exits successfully with **no tests found**. This establishes the existing checkpoint, not multiplayer readiness.
- Pure-code probe at R=16, speed=12, dt=0.1: returned `forward · newUp = 0.0749297`, not zero. Heading is projected at the old position, then returned unchanged after moving.
- Ramp sample: returned radial query normal dot local sloped centerline tangent is **0.174815**, not zero. A radial gravity direction and a ramp's contact normal are different quantities.
- Render raycast through a street center sample: query radius **16.28**, mesh intersection radius **16.226821**, difference **−0.053179**. Both builders use the same records, but ribbon triangulation is not the same surface as the current analytic query.
- Browser probe: clicking Join and sending W leaves the avatar position unchanged. `main.js` contains no input/physics animation loop or Join handler; it renders on resize, orbit, and appearance changes only.
- Browser probe at 390×844: the element covering the projected skater is `.skate-card`. The existing E2E composition assertions cover desktop only.
- Base avatar: **470 triangles, 26 meshes**; cap-equipped: **514 triangles**. Synthetic worst-case probe places 12 base avatars at the same visible location: renderer reports **357 draw calls / 8,352 triangles**, versus **71 / 3,182** for one. This is a draw-call diagnostic, not a real-device FPS result.
- The ad-hoc browser probe was rerun with corrected test-server shutdown and exited 0; it remains a diagnostic, not a committed automated regression. The missing regression coverage is explicitly scheduled below.
- Messenger's live entry HTML and the creators' article were read; no claim of a full hands-on playthrough, mobile performance validation, or access to its private implementation is made.

## Inspiration: what to borrow and what not to copy

### Jet Set Radio

The relevant target is **expressive traversal through an authored urban playground**: momentum, readable steering/braking, jumping into accessible grinds, linked routes and transfers, visible character poses, bold cel-like forms, graphic signage/graffiti, and rhythmic audio feedback. A neon palette, a rollerblade mesh, and a score counter alone do not deliver that feel.

Preserve TVHead's identity and session-only social tagging. Do not silently add police chases, a campaign, copied characters/art/music, spray-can inventory, gesture graffiti, or a delivery quest system. Wall rides, boost, manuals, advanced rail transfers, and competitive anti-cheat are optional follow-ups, not prerequisites for the first playable loop. The first release needs at least one satisfying **skate → jump/ramp → rail → dismount → clean landing** line.

### Messenger by Abeto

The supplied site describes a tiny-planet delivery game. Abeto's own article documents central gravity, an angle-aware dynamic camera, over-the-shoulder automatic following with alley collision, hand-drawn outlines, seven distinct places, a small palette atlas, LOD/memory work, mouse/one-finger accessibility, 3D emoji, and 10-player instances. These are useful design lessons, **not requirements to replicate its toolchain or game rules**.

For TVHead, borrow a coherent curved city, recognizable neighborhood landmarks, self-managing camera framing, friendly social presence, and restrained low-cost materials. Keep the approved 12-player target and three control schemes. Do not copy its ten-player cap, seven-district scope, Houdini pipeline, C++/WASM typography, custom per-pixel outlines, or delivery missions. Keep DOM UI for accessibility and implementation simplicity.

**Recommended synthesis:** Jet Set Radio supplies movement, attitude, graffiti and musical rhythm; Messenger supplies tiny-world readability, camera comfort and low-friction social exploration. Approve an original daytime/dusk palette and one representative street vignette before polishing the entire city. Saturated accents should identify ramps, rails, targets and other guests, not turn every object into an equally bright focal point.

**User camera clarification:** Messenger is the primary gameplay-camera reference. The implementation guide now specifies automatic over-the-shoulder spherical following, gentle turn/jump response, collision avoidance and optional rather than necessary manual look. JSR remains a movement/style reference, not the camera target. Camera distances/damping are our tuning proposals; the creator article establishes the reference's design intent, not its exact private algorithm. This clarification updates the plan only; the current whole-planet preview has not been replaced.

## Core-system assessment

| System | Current interface and interaction | Assessment / target boundary |
|---|---|---|
| Planet math | Pure Vec3 functions; used by layout, scene and simulation | Reuse. Add transported-heading and continuous orientation checks; current pole tests assert finite bases, not frame-to-frame continuity. Document local-avatar forward/sign conventions. |
| Movement | `stepSkater(state, input, dt)` operates on a radius, not the city | Useful baseline, not a city controller. Extend through one shared integrator with explicit contact, airborne, grind and bail states. Keep the existing export/tests as compatibility coverage. |
| Layout/queries | Seeded route graph, street/ramp centerlines, rails and building records | Reuse seed/data/IDs; compile collision and render geometry from one sampled surface definition. Add collision shapes, slope normals, edges and spawn/respawn. A connected graph is not a tested traversable mesh. |
| Input | `GameInput` factory/clamping only | Define analog throttle/brake, edge-versus-held commands, device ownership, focus/cancellation and grind bindings before adapters multiply. `steerY` currently has no simulation consumer. |
| Runtime/camera | `startSkateGame` builds preview and owns resource cleanup | Keep public boot/dispose API. Move simulation stepping, gameplay camera and session state into small modules; do not grow `main.js` into all systems. OrbitControls is preview/debug-only. |
| Avatar/appearance | Shared geometry Map, per-player materials, cap, form bindings | Keep geometry and appearance behavior; split pure catalogs from Three/DOM, add pivot animation and explicit ownership/disposal. Do not serialize `userData` containing THREE/Map. |
| Combos | Not implemented; planned ID/point mutation functions | Consume validated simulation events, not raw button presses or arbitrary durations. Require unique event IDs and chain banking rules. |
| Room/social | Not implemented; planned versioned JSON / Durable Object | Appropriate for 12 casual guests. Resolve world identity, snapshot sequencing, trust, rate/resource bounds and lifecycle before protocol freezes. Server owns time/duels; client owns responsive skating. |
| Presentation | Standard lit boxes, whole-planet camera, opaque info card | A deliberate graybox, not yet cel-styled street skating. Add readable follow camera first, then inexpensive toon/palette/animation/audio in a separate tested slice. |
| Tests/tooling | Node Vitest, real-browser Three, placeholder Workers config | Good regression base. Missing integration/manual gates are more important than number of functions checked. Pin client/test Three revisions and boot Wrangler in multiplayer E2E. |

## Critical changes — required before dependent milestones

“Critical” here means a blocker to the planned game or a high-rework contract, not a claim of a currently exploitable production incident.

### C1. Move the offline playable slice ahead of scoring and networking

**Evidence:** `js/game/main.js:27–166`, `skate.html:37`; original Tasks 5–6 need gameplay E2E/manual checks but the loop/camera/Join integration was assigned to Task 9.

Add fixed-step stepping, Join/leave/offline states, keyboard bindings, chase camera and route acceptance before score work. Network failure must not freeze local play. Run the deferred Task 3 ride-through here, not after building the room. This is the highest-value rework prevention.

### C2. Unify physical surfaces, collision and orientation

**Evidence:** `js/game/core/skater-simulation.js:23–75`; `js/game/world/city-layout.js:145–231`; `js/game/render/city-scene.js:13–41`.

The controller holds current/remembered radius rather than querying ramps, ignores buildings, has no surface-edge/fall policy or rail lock, and returns a heading tangent to the previous position. Ground radius cannot represent landing on a different-height ramp. Surface lookup uses width as a combined vertical/lateral tolerance and returns radial normals even on slopes. Ribbon normals/geometry must not be inferred only from centerline metadata.

Introduce a pure compiled-world query boundary with separate `gravityUp` and `surfaceNormal`, signed clearance, bounded nearest-support search, continuous motion/collision and rail arc length. Use the same sampled triangles for renderer and support queries; keep a safe sphere-ground fallback outside streets, but buildings block movement. Slope/launch behavior must be explicit. Retain the existing small math functions; a generic physics engine is not required for this kinematic scope.

### C3. Stabilize gameplay input and event contracts before scoring

**Evidence:** `js/game/input/actions.js:6–26`; original plan's Tasks 5–6 interfaces.

Boolean acceleration loses analog stick/trigger intent; unused `steerY` and ambiguous `jumpPressed` make repeat/substep behavior unclear. No grind binding is listed. Pure `readInput` functions alone cannot prove listeners/capture are removed or key presses are consumed once.

Use normalized held axes and queued discrete edges; select one active device rather than summing all three. One press must not repeat across catch-up ticks. The simulation emits landing/grind/trick/bail events; scoring validates context and deduplicates them. A valid rail ID plus an arbitrary duration must never mint points by itself.

### C4. Define shared world/protocol identity and trust before the room

**Evidence:** hardcoded radius/seed in `js/game/main.js:7–8`; original Tasks 7–8 declare `Pose` without world version, sequence, timestamp, animation state or bounded recovery.

Share pure appearance/action catalogs, tuning and a versioned world descriptor across client and Worker, without importing Three, DOM or app boot into server code. Validate both directions. Welcome identifies world/room epoch; reject a mismatch instead of placing players/tags into different worlds. Interpolate along the sphere for grounded poses rather than straight through it; carry mode/animation and preserve airborne height. Bound buffers and stale updates.

The first release is casual and client-simulated. Server validates pose bounds/rates, tag reach and legal style, participant identity, event freshness and score ceilings; this is **not anti-cheat**. Do not advertise fair competitive rankings or persist results. Full authoritative input simulation is a later product decision, not a dependency to invent now.

### C5. Make the social lifecycle and resource bounds implementable

**Evidence:** original Task 8 relies on separate trigger/expiry/duel functions without transaction ordering, caps, render modules or concurrency policy.

Specify one live duel per guest, self/overtag rules, tag cooldown/caps, duplicate requests, ties, late score timing, disconnects, reconnect and covered-tag expiry. Commit overtag and duel creation atomically. Define whether covered tags reappear (proposed: yes if still live when the covering tag expires), and prevent duplicate duel triggers. Add actual surface-oriented tag rendering and preset-emote display, not only wire messages/HUD.

Use Durable Object alarms plus expiry filtering on reads for idle-room deadlines; reconstruct live socket sessions using attachments if hibernation is enabled. Only expiring tag/duel records may use storage, not guest profiles/cosmetics/progression. A room reset changes epoch, clears client stale state and cancels—not awards—interrupted duels. Document the operational lifetime before shipping. Cloudflare documents that hibernation clears object memory while healthy socket attachments survive, and deployments disconnect sockets; constructor-memory-only tags/duels would therefore be incorrect.

### C6. Make the test gates truthful

**Evidence:** `package.json:12–15`, `vitest.workers.config.js:5–8`, `playwright.config.js:14–18`, `tests/e2e/city-world.spec.js:18–71`, `tests/unit/city-layout.test.js:82–103`.

The current suite is green while no input moves the avatar. Some mesh-alignment assertions inspect the builder's own metadata rather than actual vertices/transforms; repeat lookup at one point does not prove stable adjacent-route traversal. The standalone scene test also creates a second renderer on the game's existing canvas.

Keep these smoke checks, then add actual contact-vs-rendered-triangle tests, finite sequences across poles/joins, 30/60/120 FPS equivalence, real input-driven browser play and fail-on-empty expected suites. Use a separate test canvas or dispose/reboot deliberately. Add Wrangler-backed two-client E2E infrastructure when the room is introduced. Do not mock movement to claim skating or inject arbitrary points to claim trick-duel acceptance.

## Recommended improvements — include in the revised first-release work

### R1. Budget draw calls, memory and frame time, not just triangles

**Evidence:** `js/game/render/avatar.js:131–219` creates 26 meshes per base skater. Twelve clustered avatars add 286 calls over the one-avatar view. Current geometry sharing reduces vertex allocation but not draw submissions.

Merge static head/face/boot detail by material, instance repeated wheels where useful, and keep only the pivots needed for animation. Avoid multi-material groups that merely preserve every original draw call. Pool shared geometry; dispose per-player materials on leave and cached geometry only at world teardown. Cap accessory churn and do not dispose geometry still referenced by other guests. Add early physical-phone playtesting before art/network scale-up and retain the final five-minute 12-avatar gate.

### R2. Add a modest art/audio/animation slice instead of assuming graybox equals style

**Evidence:** `city-scene.js:116–146`, `avatar.js:76–107`, `css/skate.css:82–91`.

Choose a compact original palette, flat/toon lighting, semantic feature colors, signage, visible tag surfaces, two distinguishable landmarks and a route shortcut/branch. Use player-relative camera and gentle pose animation (push, crouch, jump, grind, bail) before expensive outlines. Ensure the city's underside stays readable under central gravity; a fixed world-Y hemisphere light is not planet-relative lighting. Add local licensed/original loop and jump/grind/tag sounds, user-gesture audio unlock, mute and reduced motion. Exact reference fidelity and additional soundtrack tracks are optional, but silence/static poses should not be mistaken for final style.

### R3. Keep the engine simple and dependency decisions deliberate

- Existing Three.js r137 is sufficient for the proposed slice. Verify installed test `THREE.REVISION` matches vendored `lib/three.min.js`; pin the package exactly and add a drift test. A later engine upgrade should be its own task with portfolio regressions, not hidden inside game work.
- No React, ECS framework, general event bus, second backend, Docker, auth database, generic physics engine or WASM UI is required.
- Missing dependencies are primarily **systems/contracts**, not npm libraries: collision/support, fixed timestep, camera, device lifecycle, audio, shared world data, server/client validators and real local-room test plumbing.
- Cache segment lengths/bounds once. Current 144 street segments are small enough for straightforward scans; introduce spatial partitioning/BVH only if measurements after city expansion justify it. Messenger uses `three-mesh-bvh`, but that alone is not a reason to add it here.
- `bindCustomizationForm` imports validation from renderer code; move the tiny catalog/defaults/normalization to a pure module and re-export for compatibility. Remove redundant per-avatar material cloning. Keep engine/cache references out of serialized appearance objects and preferably out of `userData`.
- `dev:room` points to a not-yet-created config; report it as planned scaffolding rather than a working backend. Configure actual bindings/test isolation when implementing the room. Add no production secrets or paid deploy tests.

### R4. Bound room throughput and cost before public use

At the approved maximum, naive pose fan-out is `12 × 5 × 11 = 660` recipient deliveries/second (**198,000 in five minutes**), with 60 accepted inbound poses/second. This is a delivery calculation, not a Cloudflare billing claim; pricing categories must be checked at deployment. A single room is fine for the intended population but is not horizontal scaling.

Start with the simple fan-out model, measure payload bytes, recipient deliveries, send queue/buffer pressure and local DO behavior; coalesce/drop superseded poses for slow clients, never queue them indefinitely. Keep social events reliable/resyncable. The revised transport uses bounded application acknowledgment accounting on server sockets rather than assuming browser `bufferedAmount` exists in the Workers API; ACKs can add inbound traffic beyond the 60 pose messages/s and should piggyback where possible. Consider 5 Hz batched pose broadcasts only if measured benefit warrants it. More rooms/interest management are optional later; do not imply unlimited capacity from a local 12-socket test.

## Optional enhancements — explicitly not first-release blockers

- Boost/manual/wall-ride tricks, extended transfers, gesture tagging, races or delivery missions.
- Detailed outline postprocessing, screen-space ink, large authored districts, custom cube-unwrapped world tooling, LOD/BVH before measurements warrant them.
- Accounts/progression/permanent leaderboard (would contradict the current brief unless separately approved).
- Fully authoritative movement/score replay, matchmaking, extra rooms, spectators or more than 12 players.

## Plan changes and rework avoidance

Three paths were considered: keep the original scoring-first order (smallest paperwork change, but postpones the highest-risk feedback); rewrite around a physics engine/ECS/new content pipeline (large cost without evidence it is needed); or **incrementally harden the existing pure modules and bring the playable slice forward** (recommended). The revision chooses the third. It preserves the small-world scope instead of turning references into a feature checklist.

### Decisions most likely to cause significant rework

| Decision to avoid now | Likely rework if left unresolved | Smallest preventative change |
|---|---|---|
| Finalize score/protocol before real landings and grinds | Replace button-based scoring, animation payloads and duel bank events together | Stabilize simulation events and play a line first. |
| Polish procedural streets whose render/contact geometry differs | Remodel ramps, colliders and tags; invalidate tag anchors | One canonical compiled geometry with versioned IDs before art. |
| Treat `groundRadius` as general terrain contact | Rewrite landing, slope motion, camera and rail transitions | Distinguish radial gravity from queried support height/normal. |
| Freeze absolute poses with no world version/mode/order | Peers sink/flip and incompatible versions corrupt social state | World descriptor, sequence/server time/epoch and state-aware interpolation. |
| Solve only triangle count / dispose a guest's shared geometry | Late mobile rewrite or disappearing remaining guests | Early draw-call/resource tests and explicit shared ownership. |
| Rely on DO in-memory timers/maps | Tags disappear on hibernation or duels finish twice | TTL records, socket reconstruction and idempotent alarms/transactions. |
| Add every mechanic or tool from either reference | Expand into a campaign/asset-pipeline rewrite before skating feels good | Minimum linked line and one approved visual vignette; optional backlog stays optional. |

| Previous remaining item | Revised owner | Why |
|---|---|---|
| Task 5 scoring first | New Tasks 5–6: physical contracts + playable keyboard/camera slice | Settle what a real trick/landing is before scoring it. |
| Task 6 all inputs, manual play before composition | Task 6 keyboard; Task 7 gamepad/touch parity | Keep three workstreams; each ends in a playable check. |
| No explicit rail state/camera/collision task | Tasks 5, 6, 8 | Queries are not traversal, and orbit is not a follow camera. |
| No art/audio/animation milestone | Task 9 | Make stylistic intent measurable without cloning either reference. |
| Task 7 room before full offline play | Task 10 after local slice and stable contracts | Avoid publishing a protocol around unfinished movement/world data. |
| Task 8 rules/HUD without tags/emote scene render | Task 11 local presentation + server integration | The social loop must be visible, bounded and idempotent. |
| Task 9 first full wiring/performance/CI | Early CI/device gates in Tasks 6–7; final Task 12 acceptance | Detect unplayability and mobile failures before the last task. |

Preserve Tasks 1–4, their tests, commits, local assets and public `startSkateGame({ root, THREE }) → { dispose() }` contract. Follow-up tasks repair narrow shortcomings rather than reset the branch. The revised plan is a proposal pending user review; do not read new unchecked tasks as authorization to execute.

## Sources

- [Messenger, supplied game](https://messenger.abeto.co/) — live entry HTML/title/description consulted.
- [Abeto: Messenger, creator case study, 2026-01-15](https://www.awwwards.com/messenger.html) — direct account of camera, gravity, authoring, palette, outlines, multiplayer and optimization. Recommendations above intentionally use only the relevant lessons.
- [Jet Set Radio overview](https://en.wikipedia.org/wiki/Jet_Set_Radio) — background reference for skating, graffiti, cel-shaded identity and music; no source assets are proposed for reuse. Sega Retro was attempted but returned a bot challenge, so it is not evidence for this review.
- [Cloudflare: Durable Object WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/) and [Workers WebSocket runtime API](https://developers.cloudflare.com/workers/runtime-apis/websockets/) — consulted for hibernation/attachments, deployment disconnections and the server API boundary. Production pricing was not evaluated because no deployment is requested.
