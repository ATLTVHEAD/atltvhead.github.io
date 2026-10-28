# TVHead Skate City — playability corrections and comic-book art

Date: 2026-10-28

Status: **user-approved design (2026-10-28); implementation-plan review and execution-method selection pending**.

Audit: `docs/reviews/2026-10-28-skate-city-playability-audit.md`.
Existing roadmap: `docs/superpowers/plans/2026-10-27-tvhead-skate-city-tdd-plan.md`.

## 1. Outcome and agreed direction

Replace the current input-capable blockout with one complete, readable local skating experience: reliable controls, automatic launch/grind transitions, balance and visible tricks, graffiti, an animated low-poly TVHead, and a comic-book city.

User-confirmed choices:

- Overall action energy is closer to **Bomb Rush Cyberfunk** than Jet Set Radio. Genex Skate is mechanics inspiration, not a source of copied code or assets.
- Preserve the tiny spherical world and comfortable automatic follow camera. Keep radius 32, widened streets, established character scale and local camera distances; do not rescale these merely to fit a downloaded model.
- Use the **downloaded Kenney City Kit Industrial 2.0** as city building/prop assets, including foreground where it holds up at chase-camera distance. A custom architecture pack is not required.
- Create a new **lower-poly TVHead in Blender using the existing model as reference**. Preserve recognizable head/body/limb proportions, but do not merely decimate the reference and call it a rig.
- Graffiti is original custom artwork. SVG is suitable editable source, but transparent PNG or another practical local texture format is acceptable when it renders better.
- Controls descriptions must be available during play. Ordinary building collisions stop safely, not forcibly bail/respawn.

This design extends/revises the existing Task 7–9 scope and brings **local** visible tagging/emotes forward. It does not implement multiplayer, shared tagging/duels, persistence, accounts, a new renderer stack, or a larger multi-district game. The remaining original roadmap is not silently complete.

## 2. Verified source assets and preservation

Kenney source directory: `C:\Users\User\Downloads\kenney_city-kit-industrial_2.0` (matching ZIP also present). Its `License.txt` permits personal/commercial use under CC0. The actual GLB folder contains **37 models**, 20 named building variants plus chimneys, containers, energy equipment, tanks and a water tower. GLBs total **3,139,644 bytes before textures**; the largest is 212,040 bytes. The pack's generic online file count is not a count of distinct downloaded GLBs.

GLBs reference `Textures/colormap.png`, which is present. Runtime copies must preserve/remap that dependency and include the license/provenance. Import a curated subset and reuse instances, rather than bundling every source format or loading the entire Downloads directory. All production assets are served locally; there is no runtime dependency on Downloads or a third-party asset CDN.

Character reference: repository `atltvhead.obj` (4,741,483 bytes, 20,250 vertices, 40,058 faces). Blender 5.2.0 LTS imports it as three meshes, including a thin base and a dense main body. Its referenced `atltvhead.mtl` is absent; geometry imports but original materials must not be assumed available. The user identifies arms, legs, TV head and base in this reference. Inspect its silhouette before modeling; remove the display base from the playable character, not from the preserved original reference.

Keep original OBJ/downloads untouched. Deliver a separate editable `.blend`, exported `.glb`, and reproducible Blender authoring/export script. New files live under game-only asset/source paths and cannot replace the site's original viewer model.

## 3. Controller and input corrections

Reported environment: new/2026 Steam Controller, USB-connected receiver, Windows Firefox, local game on port 8000. Do not confuse the receiver with a wired USB controller or assume a 2015 Steam Controller mapping.

Correct the two reproduced application bugs:

1. Gradual stick motion must acquire ownership on intentional threshold crossing/displacement, not require a single-frame >0.05 change. Keep activation hysteresis so noise cannot steal keyboard/touch ownership.
2. Join/blur/reset suppress stale state **per control**, not block every axis and new button until the whole device is neutral. A new Jump press must work even if a different stick remains held or drifts.

Maintain one active input device; do not sum keyboard and controller movement. Preserve one-shot action edges across catch-up ticks and clear both adapter state and queued runtime action edges on focus/visibility/device invalidation. Editable form focus suppresses all gameplay inputs until focus returns to play.

In-play Controls includes an expandable diagnostics area: detected ID/mapping, selected pad, axis/button counts and raw/current normalized values, plus clear no-device/nonstandard/calibration status. Values are local and ephemeral, not sent or logged remotely. Prefer a supported selected pad and prevent stale input from a disconnected/replaced pad.

Keep default standard controls: left stick move/brake/steer, A jump, X/Y tricks, B tag, D-pad emotes, right stick camera. Unknown mapping gets explicit session-only calibration/remapping instead of invented fixed Steam indices. If the browser exposes no gamepad, the page cannot manufacture one; explain Steam Input desktop-versus-gamepad configuration and retain keyboard/touch play. Compare Firefox and Chrome without declaring either a hardware fix in advance. No driver installation or WebHID permission is part of this scope.

## 4. Automatic jumping, capture and balance — proposed rules for review

The following concrete defaults complete previously unspecified behavior; they become implementation requirements only after this written design is approved and the requested GPT Sol mechanics review is recorded.

- **Automatic jump means launch from marked ramp lips and eligible ledge exits**, not continuous hopping on flat ground or climbing arbitrary walls. Manual jump remains available on all devices. Cross a launch marker while moving in its allowed direction at speed >=3; launch once per crossing with upward speed 4, retain tangential speed, and require leaving/re-entering the marker before it can launch again. Ordinary descending stairs/drop-offs are not launch markers unless authored as such.
- Eligible rails, pipes and ledges are explicit path records with stable IDs, points, arc lengths, physical height and matching render geometry. Not every roof edge or decorative pipe is eligible. Keep at least one discoverable continuous launch→grind→landing line.
- Automatic grind capture requires moving speed >=2, feet within 0.8 world units of the eligible path, and absolute approach alignment >=0.65. Capture from airborne approach near path height, or an explicitly authored connected-support transition; do not teleport a grounded skater onto an unreachable high rail. Preserve signed path direction and height.
- Travel by path distance, retain one attachment until dismount and emit exactly one start/end event for an interval. Endpoint, Jump, invalidated path or balance failure dismounts with continuous tangential velocity. Apply a 150 ms capture cooldown to prevent immediate reattachment/nearest-path oscillation. No held Grind input is required.
- During grind, horizontal steering becomes left/right balance correction; camera remains automatic and optional right-stick look still works. Use a bounded deterministic balance value in [-1,1], visible center/safe/danger feedback, curvature/duration-driven drift and a short entry grace. Reaching the limit causes a controlled dismount and loss of unbanked chain, **not a compulsory respawn**. Tuning lives in a versioned table with deterministic boundary tests; changing drift strength cannot change scoring authority.
- Touch uses its existing horizontal stick for balance. No extra mandatory touch stick or grind-hold button is introduced.

Simulation owns capture, launch, balance, landing and trick legality. Rendering cannot change those decisions. Keep canonical contact triangles/path records shared between queries and visual placement; imported decorative geometry is not an invisible extra physics system.

## 5. Tricks and local chain feedback

Replace immediate arbitrary `trickCompleted` emission with known trick IDs and simulation-owned action timing. Spin/grab are legal airborne or in an explicitly supported grind transition; grounded spam and unknown IDs are rejected. Complete/cancel actions deterministically against landing and dismount boundaries. Use the prior roadmap's 300 ms initial action duration and its documented event-driven local combo/banking rules, not points awarded directly on keydown.

HUD displays pending/banked chain, last successful action and grind balance. Animation mirrors the simulation action; a prettier clip cannot award points or rotate the collision/camera root. Preserve banked score through ordinary stops and failed unbanked chains; all scores reset when leaving the local session. No global scoring service or duel claims are added here.

## 6. Graffiti and emotes

Use a small original preset library with readable bold outlines/fills and TVHead-inspired marks. Keep editable SVGs where useful; bake bounded-resolution transparent PNGs when needed. Textures render on **world surfaces** with normal alignment, depth testing and a small anti-z-fighting offset. They are not floating screen overlays. No externally supplied SVG markup, scripts, fonts or remote image references are accepted.

Proposed target rule for this review: nearby visible **designated building-wall panels, containers and skate surfaces** can be tagged; decorative windows/sky and far-side/occluded targets cannot. Walls extend the old rideable-triangle-only proposal intentionally. Show an eligible target marker before placement; choose the nearest reachable eligible point within 2 world units of the skater contact point. Tagging requires grounded/settled support, with 2,000 ms cooldown, a cap of 10 live local tags and independent five-minute lifetimes. At the cap, reject with feedback rather than silently grow resources. Leave clears local tags.

Each tag stores a style ID and stable target/local surface anchor, not an arbitrary world-space plane disconnected from geometry. Handle target unload/disposal and expired geometry/material resources. Provide visible success, cooldown, out-of-range and no-target feedback, not a dead button.

Wave/cheer/follow presets produce a bounded 2-second visual response and corresponding available rig pose; unknown/free-text emotes are rejected. Keep input/rules/render modules separate so future server authority can reuse the same validated intents. This phase is explicitly local-only; do not fake server acknowledgements or implement shared duels.

## 7. Blender low-poly character and animations

Author a clean low-poly mesh using the reference's recognizable TV shell/screen, torso, arms and legs. Use suitable topology at shoulders, elbows, hips and knees. Add rollerblades rather than retaining a pedestal as a foot base. Keep nominal in-game dimensions/contact lift compatible with the current camera and support footprint; do not import the reference's raw 5.48-unit height directly into gameplay.

Create a named armature with root/pelvis/spine/head and paired upper/lower arm, hand, upper/lower leg and foot joints. Skin deforming parts with normalized weights; rigid TV pieces/blades may be rigid-weighted to their appropriate bones. An animated group of unsplit primitives is not the requested final character.

Deliver named clips: idle, push, coast, crouch, jump, spin, grab, grind, balance-left/right, land, tag and wave; additional emote poses may reuse additive upper-body motion. Use Blender-authored keyframes and Three.js clip crossfades, with appropriate action time and in-place animation. Source `.blend` includes the rig and editable actions; export GLB includes bones, weights and clips.

Integrate the animated model below a separate physics/contact root. Follow sphere/contact normals without camera spins during tricks; skates should visibly contact support in settled poses. Accumulate animation time correctly, pause/resume without a large clock jump, and release mixer/skin resources on teardown. Keep customization color/cap working or provide its equivalent on the new rig, with no material sharing that recolors other instances.

Initial geometry ceilings remain 5,000 base/7,500 accessorized triangles. Prefer <=12 base-avatar material draw submissions; log any evidenced tradeoff before increasing a budget. Reduced-motion mode removes optional sway/trick screen effects, not essential state recognition.

## 8. Kenney industrial city and comic-book presentation

Use curated Kenney building variants, containers, tanks and water-tower components as the actual city vocabulary. Scale assets consistently against the skater/doors/storeys and orient their local up to the sphere. Arrange distinguishable industrial/commercial-feeling blocks, alleys and open skate spaces; avoid simply replacing every old box with the same model. These downloaded assets are the chosen primary art source, not background-only placeholders.

Maintain physically readable streets and an uncluttered playable route. Add a water/signal-tower plaza landmark, a graphic skate arch, a marked branch that rejoins the main route, clear launch lips/eligible ledges/rails and landing space. Use custom simple geometry only for necessary skating surfaces, signage and small gaps in the pack. Do not redesign the city as a flat top-down map or expand into seven districts.

Declared collision/support/tag anchors must match asset placement and scale. Update the world descriptor when physical geometry changes. Collision may use documented conservative proxies, but proxies cannot intrude into visible streets, and nonrideable roofs must not imply an advertised route. Ground/tag panels and rails use verified matching geometry. Render quality changes decoration/effects only, never contacts or eligible routes.

Apply a shared **paper/cream + black ink + orange emphasis** art system to city, character, surfaces and UI. Use stepped toon light bands, clear silhouettes, selective ink outlines, subtle shadow-weighted halftone/hatching and original SVG/PNG signs/graffiti. Keep TVHead color customization readable and use shape/signage as well as color for gameplay meaning. This supersedes the earlier dusk-neon blockout palette.

Trick energy comes from readable poses, compact comic action accents and bounded motion streaks. Default camera remains stable: no mandatory shake, banking, abrupt FOV kicks or cinematic trick cuts. Halftone is not a fullscreen filter that obscures rails, face details or small text. Maintain legibility on underside/pole orientations, with simplified mobile shading and bounded effect lifetimes.

Use the existing Three.js r137 WebGL stack with compatible locally served loaders/materials/effects; do not silently migrate the portfolio to a new renderer, duplicate Three engine instances or paste newer color-space/WebGPU APIs into this build. Cache shared assets/materials and batch repeated static details. Asset-load failures provide actionable retry/fallback status without falsely indicating that the final art is loaded.

## 9. In-play controls and feedback

Keep a compact always-visible active-device hint, Controls, quality and Leave actions during play. Full keyboard/controller/touch descriptions open in a reachable panel without leaving the session. The panel includes balance, automatic launch/capture, tagging range/targets, manual jump and controller diagnostics/calibration. Do not advertise nonexistent Shift-hold grinding or actions with no behavior.

Controls have visible focus, >=44 CSS px touch targets and normal text contrast >=4.5:1. Form/dialog interaction pauses gameplay actions and restores the previous input context safely on close. Help works with keyboard, touch and standard controller menu navigation; navigation must not also skate/jump behind it. In portrait/landscape, neither card/help affordances nor touch controls cover the player, balance indicator or essential route sightline.

## 10. Integration boundaries and failures

- Keep `main.js` as composition, not a new owner of physics, score, asset conversion or social rules.
- Input adapters emit validated frame/camera/action intents; runtime consumes edges once at fixed 60 Hz, including reset/visibility semantics.
- World compilation owns canonical support/collision/grind/tag records; simulation emits typed contextual events; local presentation consumes them.
- Asset manifest/loader owns local file dependencies, clone/shared-resource lifetimes and retry status; Blender conversion is offline tooling, never browser work.
- Animation, decals, comic effects and DOM feedback cannot mutate simulation/score state. Bounded caches/effects are disposed on leave/retry without breaking shared geometry still in use.

No root/camera conventions, reference model files, existing portfolio/viewer pages or deployment behavior may change accidentally. Keep the current branch unmerged and do not deploy/push new corrections without permission.

## 11. Acceptance evidence

Implementation is not done because input edges or a screenshot look plausible. Add behavioral regressions for the actual audited failures and real rendered paths:

1. Gradual stick movement, threshold/noise boundaries, held-stick Join plus new Jump, independent stale-control reset, disconnect/replacement, form focus and queued-edge invalidation.
2. Device calibration/unsupported/no-pad reporting, active-device help and keyboard/touch/controller menu control without double actions.
3. Actual automatic launch→eligible rail/pipe/ledge capture→balance→dismount→landing and manual Jump on keyboard, simulated pad and touch; no fake score/teleport success hooks.
4. Known trick durations/legality, clean/failed chain banking and deterministic balance/transition boundaries.
5. Tag target/reach/occlusion/cooldown/cap/expiry, world-normal decal placement, observable input-driven tag/emote output and resource cleanup.
6. GLB bones/weights/clip presence, changing joint transforms over time, physics-root immutability, color/accessory isolation and <=triangle ceilings.
7. Imported asset dependency loads, street clearance, branch connectivity, bright/underside/pole comic readability and 390×844/844×390 player/HUD/control clearance.
8. Measured render calls/resource behavior rather than triangle counts alone: target <=150 scene draw calls with 12 visible base avatars on low preset; DPR caps 1 low/1.5 standard. Capture any failure/tradeoff rather than relabeling it passed.
9. Full unit/browser suites, static build, changed-file syntax checks and existing site navigation/viewer regressions. An empty Worker suite does not establish multiplayer acceptance.

Record a representative street/TVHead vignette and action transitions for human visual approval before expanding city dressing. Physical Steam Controller acceptance on Windows Firefox via receiver remains open until the user or a real hardware test confirms it; Chromium emulation cannot close it. Compare Chrome and record browser-exposed input/Steam configuration. Real phone orientation/background/re-entry, full hands-off-camera lap both directions and sustained performance remain manual gates. Any unavailable measure stays explicitly unavailable.

## 12. Design handoff

After written-design approval, create a staged TDD implementation plan: controller/help correction first, mechanics review and playable line, local graffiti/emotes, Blender asset pipeline/rig, then integrated Kenney/comic art and device/visual acceptance. Preserve separate milestones and dependencies so one subsystem's passing unit tests are not labeled a completed game.

Required before Task 8 mechanics code: record the requested GPT Sol review of the Genex reference and the proposed launch/capture/balance/trick design. User reviews the written plan and chooses its execution method before product implementation begins.
