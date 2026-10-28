# Skate City playability and art audit — 2026-10-28

Reviewed checkout: `feat/tvhead-skate-city`, HEAD `0521d94`.

Status: investigation and design handoff, **not an implemented correction**. The resulting written design has been approved; implementation-plan review/execution choice is pending. The user reports only D-pad response on their controller, no stick/jump response, missing automatic jump/grind/tagging, a rigid character, missing comic-book styling, and absent in-play controls. Treat this as failed user acceptance, not a passing device gate.

## Intent and constraints

Deliver a playable TVHead skating world with fast Bomb Rush Cyberfunk-inspired trick energy and comic-book art throughout the actual 3D scene, not just its menus. Preserve the spherical world, original TVHead identity, ordinary collision-stop behavior and comfortable automatic camera. Automatic rail/pipe/eligible-ledge attachment and balance are requested; a held Grind button is not. The latest request also explicitly includes automatic jumping; its trigger policy still needs definition. Controls must remain discoverable during play. Do not buy, import or redistribute assets without selecting the asset strategy and checking licenses.

## Confirmed findings

### High — incremental stick motion cannot acquire ownership

`js/game/input/gamepad.js:150–152` requires >=0.2 magnitude and >0.05 change relative to the immediately previous frame. Updating `previousAxes` every frame means a gradual movement can reach full deflection without ever notifying the router. A Node reproduction ramped the left-stick Y axis from 0 to -0.70 in steps of 0.01; ownership remained `keyboard` and the routed throttle stayed zero.

Correction direction: recognize activation threshold crossings or displacement from an intentional-activity baseline rather than only frame-to-frame movement. Preserve hysteresis/noise filtering and most-recent-device ownership. Add slow-stick, mixed-device and camera-only regression cases.

### High — reset blocks unrelated new button presses

`js/game/input/gamepad.js:107–110,131–148` gates the entire pad until all relevant axes/buttons return neutral. A Node reproduction held the left stick through reset, then newly pressed A; the adapter returned `jumpPressed:false` and no throttle. Releasing everything then pressing A returned `jumpPressed:true`.

Correction direction: suppress stale state per control, so a held axis does not block an unrelated new button. Test Join with stick held, drift on the other stick, blur/re-entry and unplug/reconnect. Do not remove stale-input protection wholesale.

### High — actual controller compatibility remains unverified

`js/game/input/gamepad.js:82–94` rejects nonstandard mappings. All current movement/button tests assume a standard pad, four centered axes and known button indices. The user reports D-pad-only response; the adapter maps D-pad to emotes, not movement, and emotes currently have no visible consumer. The reported D-pad response could be in-browser navigation or a different mapping; neither explanation is established.

User follow-up identifies a **new Steam Controller (2026), Windows, Firefox, USB-connected controller receiver, local game on port 8000**. This describes a USB receiver connection, not necessarily a cable directly to the controller. Browser-reported mapping/axis/button values and Steam Input configuration remain unknown. A diagnostics view and explicit session-only remapping are candidate corrections; do not guess button indices or treat synthetic tests as physical acceptance. Chrome is useful as an A/B comparison, not an established fix or a reason to dismiss Firefox.

Valve's [new-controller announcement](https://store.steampowered.com/news/group/45479024/view/508485755865137686) describes Steam Input integration. Its [player configuration documentation](https://partner.steamgames.com/doc/features/steam_controller/getting_started_for_players) distinguishes desktop bindings from emulated gamepad bindings. Steam Input producing keyboard/mouse input instead of browser gamepad input is a hypothesis to verify alongside the reproduced app bugs, not a confirmed hardware diagnosis. Do not use 2015-controller-specific instructions as proof of the 2026 model's behavior or require third-party drivers without evidence.

### High — automatic grind/balance does not exist

`js/game/core/city-skater.js` declares a grinding mode and rail fields but has no path-capture, rail traversal, balance or dismount state machine. No `grind-state.js` exists. World query helpers are not gameplay. `city-layout.js:354–359` authors only two rails and no eligible pipe/ledge path catalog.

This was deferred to Task 8, not delivered in Task 7. Required implementation: eligible path records, automatic capture, distance-based travel in either direction, balance input/state/feedback, jump/endpoint/loss-of-balance dismount, cooldown and real input-driven traversal tests. Have GPT Sol review the Genex reference and proposed mechanics before implementation, as requested previously.

### High — automatic ramp jumping does not exist

`city-skater.js:187–220` jumps from `jumpPressed`; `260–283` follows available ramp support with vertical speed reset. The current ramp is a smooth raised sine arc (`city-layout.js:45–70`), not an authored launch lip with takeoff behavior. Manual jump is implemented; automatic jump is not.

Proposed interpretation, not an approved rule: automatic launch at marked ramp lips/eligible ledge exits while moving, retaining manual jump and avoiding continuous auto-hopping on flat streets. Define this before implementing it or changing the authored ramp.

### High — graffiti and emote inputs are discarded downstream

Adapters and `fixed-step.js` preserve `tagPressed` and `emotePressed`, but `stepSkaterOnCity` never consumes them and `main.js` has no social-action handling/rendering. There is no tag/emote scene module, placement feedback or functional target system. Thus F/B/Tag/Wave can sample correctly and still do nothing visible. Tag rules and rendering were scheduled for Task 11.

Correction direction: implement visible, bounded local session graffiti/emotes before adding shared-room authority; validate target eligibility, reach, normal, cooldown and expiry. Explicitly identify local-only state rather than pretending a server acknowledged it. Wall tagging versus only rideable surfaces is a design choice to settle; the old plan describes rideable triangle targets.

### High — the character has no rig or animation

`render/avatar.js` builds separate rigid primitives directly below one group. Inspection measured 26 meshes, 470 triangles, zero bones, zero skinned meshes and zero clips. Sampling `applyAvatarPose` at different times leaves arm transforms unchanged. `render/avatar-pose.js` only applies the root pose. `main.js:303` passes per-frame elapsed time rather than accumulated animation time.

Correction direction: a real named joint/bone hierarchy and time-driven clips/blends for idle, push/coast, crouch, jump, spin/grab, grind/balance, landing, tagging and wave. Maintain a separate simulation/collision root and surface-normal contact frame; animation cannot move physics or award score. A primitive joint rig is not the same deliverable as a professionally skinned custom mesh; choose explicitly.

### Important — tricks complete immediately without validation/visible execution

`city-skater.js:227–231` emits `trickCompleted` immediately for any truthy airborne trick ID, with no catalog validation or animation duration. No combo/bank reducer or gameplay score HUD exists yet. This must be corrected alongside traversal/animation, not represented as completed trick gameplay merely because an input edge is sampled.

### Important — the actual scene does not use the requested art direction

`render/city-scene.js` and `render/avatar.js` use `MeshStandardMaterial`; no toon ramp, ink outlines, halftone shading, graphic surfaces or trick effects are installed. The generated world contains 24 simple box buildings, one smooth ramp and two rails; it lacks the planned landmarks, rejoining shortcut and authored ramp→rail→landing line.

Correction direction: cream/paper and black ink as the visual foundation, orange emphasis, controlled TVHead customization colors, stepped toon lighting, selective silhouette outlines, shadow-weighted halftone, original graffiti/signage and bounded trick motion accents. Author a readable plaza, signal-tower landmark, skate arch, connected branch and clear launch/grind/landing line. Keep lighting legible on the underside of the sphere and profile mobile; avoid applying an unreadable fullscreen dot filter as a substitute for art direction.

### Important — help is intentionally hidden while playing

`css/skate.css:193–198` includes `.skate-help` in the play-mode `display:none` rule. No in-play help replacement exists. The preview also advertises Shift grind and tag/emote actions that currently have no completed visible behavior.

Correction direction: always-visible compact active-device hints and a reachable Controls panel in play (keyboard, touch and controller), truthful feature descriptions, visible focus and no player/control occlusion. Keep Help usable offline and after pause/re-entry.

## Evidence and test limitations

- Fresh `npm test`: 129 unit tests and 20 Chromium browser tests passed; Worker suite contains no files and exits zero by allowance.
- Existing gamepad E2E snaps a perfect synthetic standard pad from zero to full throttle. It does not exercise gradual motion, all-neutral gating, unknown mapping or a physical controller.
- Existing tests do not prove automatic launch/grind, visible tagging/emotes, skeletal animation or comic-book rendering. Those passing suites do not close the issues above.
- Physical phone/controller acceptance and Task 6's complete manual lap/camera checkpoint remain open. A device-specific controller fix cannot be claimed until tested with the user's device or recorded browser inputs.
- Audit scripts ran read-only against the current modules; no product fixes were made during this investigation.

## Three.js research and applicability

1. [MeshToonMaterial](https://threejs.org/docs/pages/MeshToonMaterial.html): stepped lighting with a nearest-filtered gradient map. Appropriate foundation, not a complete comic-book style by itself.
2. [Three.js Journey: halftone shading](https://threejs-journey.com/lessons/halftone-shading-shaders): public preview explains shaded dot patterns and their comic/Spider-Verse use. Research only; no paid course code/assets copied.
3. [Skeletal animation blending example](https://threejs.org/examples/webgl_animation_skinning_blending.html) and [AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html): clips/blending for a rig. Do not reparent an unrigged OBJ and call it finished skinning.
4. [Decal example](https://threejs.org/examples/webgl_decals.html) and [DecalGeometry](https://threejs.org/docs/pages/DecalGeometry.html): surface-conforming graphics; projection around corners can distort. Tags need target/occlusion/placement rules as well as decals.
5. [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html): repeat windows, signs and props with shared geometry/materials. This is a performance technique, not a physics authoring substitute.
6. [Bruno Simon's playable portfolio](https://bruno-simon.com/): current page exposes keyboard/mobile/gamepad controls, quality options and behind-the-scenes references; useful for discoverable in-world UI and authored-world organization, not an art template to copy. Its modern WebGPU/TSL stack should not be pasted into this older renderer.
7. [Genex skate repository README](https://github.com/Rabneba/skate-threejs): describes a plaza/quarter-pipe/ledge/rail spot, trick/balance systems and rig/clip organization. It also describes very large streamed generated assets; that is not an appropriate asset-loading budget for this project. Reading its page/README is not a hands-on feel evaluation.
8. [FUNTECH reference](https://experience2026.funtech.inc/): text fetch currently exposes a showreel landing page, not the earlier runner's full visuals. Preserve the user's recorded rough ink/halftone/orange direction; do not claim the runner was visually re-reviewed.
9. [MDN gamepad mapping](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad/mapping): `standard` indicates browser remapping to a known layout, not universal hardware compatibility.

Compatibility: local Three.js reports revision 137. Its installed package includes `MeshToonMaterial`, `Bone`, `AnimationMixer`, `InstancedMesh`, `examples/jsm/effects/OutlineEffect.js`, `postprocessing/HalftonePass.js`, `geometries/DecalGeometry.js` and `loaders/GLTFLoader.js`. These addons are not currently loaded by the static site's global build; integrate compatible local modules deliberately and avoid duplicate engine instances/new-version APIs. Modern docs are conceptual references; use r137 source for implementation details. The old live halftone example URL returned 404; the installed r137 addon is the verified reference.

## Asset decision — mention now, acquire nothing yet

The repo contains `atltvhead.obj` but no game GLB/GLTF/FBX rig/animation asset. OBJ does not carry a skeleton or animation clips. Existing photos are not a ready-to-use game art pack.

Options:

1. **Original procedural world + bone-driven TVHead:** no asset purchase required; fastest route to consistent comic treatment, but custom code must supply convincing joint shapes and skating animation.
2. **Hybrid (recommended for discussion):** preserve TVHead identity and build its rig/animation; selectively use licensed modular props and author the skateable geometry/landmarks locally. [Kenney City Kit Commercial](https://kenney.nl/assets/city-kit-commercial) (50 files) and [City Kit Industrial](https://kenney.nl/assets/city-kit-industrial) (40 files) list CC0 licenses. Verify downloaded contents/formats/license, restyle and adjust scale before use; do not replace the sphere with a flat premade scene or copy an entire town.
3. **Artist-authored custom GLB:** best option for a polished deforming TVHead character. Request a Blender source plus GLB with skeleton, skin weights, clean pivots, rollerblades, and named skating/trick/tagging clips; establish budgets and usage rights. More art-authoring work, not a prerequisite for correcting input/help/tag logic.

Original graffiti marks, signs and halftone textures can be generated locally. A chosen custom tag/logo or existing rigged TVHead source would be useful user-supplied assets. No purchase or external asset import is authorized by this audit.

### User direction confirmed after the audit

- User likes the comic-book direction and requests **original SVG graffiti tags**. Preserve SVG source assets; rendering may rasterize a bounded-resolution transparent texture for surface-conforming decals, rather than drawing a screen-space SVG over the world. No external SVG resources/scripts or arbitrary uploaded markup are needed.
- User requests **Blender** for a new TVHead or modification of their current model. Blender `5.2.0 LTS` is installed and `blender.exe --version` runs successfully. No `.blend` source was found in the checkout. Use the current OBJ as identity/reference, preserve the original file, inspect it in Blender before deciding whether to retopologize/adapt or rebuild, and deliver editable Blender source plus rigged/animated GLB. No model/rig has been authored yet.
- User questions whether Kenney's city packs are suitable beyond top-down views. They are full 3D packs, not fixed top-down sprites, and world scale is adjustable. However scaling does not add storefront detail, usable ledges, architectural depth or authored skating routes. Evaluate any selected models at the actual chase-camera distance; do not assume their distant preview guarantees close-up quality.
- Recommended world strategy for discussion: custom Blender-authored foreground streets/storefronts/tag walls/rails/ledges and landmarks, with optional restyled Kenney modules for background buildings or selected props. Preserve the sphere radius and established camera/character scale unless a later design explicitly changes them. Match doors, floor heights and street furniture to the skater rather than enlarging low-detail buildings indiscriminately. Asset imports remain unapproved.
- Latest user decision supersedes that background-only recommendation: **use the downloaded Kenney pack for the city**, with comic-book rendering; author a **new lower-poly TVHead using the existing model as Blender reference**. SVG is a preferred editable option for original graffiti, not a hard runtime-format constraint; another suitable custom-art file type is permitted.
- Verified downloaded pack: `C:\Users\User\Downloads\kenney_city-kit-industrial_2.0`, CC0 `License.txt`; 37 GLBs totaling 3,139,644 bytes before textures, with required `Models/GLB format/Textures/colormap.png` present. Preview was reviewed. No production asset files have been copied yet.
- Read-only Blender inspection imported the OBJ as three meshes. The dense main mesh has 19,862 vertices/39,728 faces; a thin base is separate. The referenced `atltvhead.mtl` is missing, so original materials are unavailable, but geometry imports. Originals were not modified and no `.blend` or GLB was generated.
- Written design: `docs/superpowers/specs/2026-10-28-skate-city-playability-and-comic-art-design.md` — approved by the user; implementation plan is now written and awaiting review/execution choice. Automatic launch and wall-tagging rules are approved design, not previously implemented features.

## Proposed delivery sequence — awaiting design agreement

1. Correct controller activity/reset handling, capture device diagnostics, show truthful in-play controls; regress real reported input sequences.
2. Review with GPT Sol and agree automatic launch/grind/balance/trick rules; implement a complete playable local line rather than only action flags.
3. Add visible local graffiti/emote behavior and target feedback; preserve a clean future shared-room boundary.
4. Build a named character rig and blend actual action animations with a stable collision root.
5. Approve one representative comic-book street/TVHead vignette; then expand landmarks/props/shortcut, profile and retest all devices.
6. Reopen physical acceptance; do not mark the game delivered solely because automated tests are green. Networking/duels remain separate work unless explicitly requested.

Written-design review includes proposed automatic ramp/ledge launch rules and designated-wall/container/skate-surface tagging. Browser-reported controller mapping/Steam Input mode remains to be observed. Kenney city assets, Blender low-poly reference modeling and flexible custom graffiti sources are now chosen, not open asset alternatives.

## Review/design checklist

- [x] Inspect current source, roadmap, assets and tests.
- [x] Reproduce independent controller defects without claiming physical-device diagnosis.
- [x] Identify missing gameplay/render consumers and misleading help.
- [x] Research Three.js styling, rigging, decals, world organization and asset licensing.
- [x] Record findings, evidence and alternative asset approaches.
- [x] Obtain controller/device details and SVG/Blender direction.
- [x] Record selected city/model/graffiti direction and proposed mechanics in a written design.
- [x] Obtain user review/approval of `docs/superpowers/specs/2026-10-28-skate-city-playability-and-comic-art-design.md` (user: "approved").
- [x] Write the implementation plan: `docs/superpowers/plans/2026-10-28-skate-city-playability-and-comic-art-plan.md`.
- [ ] Obtain user review of the plan and choice of execution method.
- [ ] Implement regressions/corrections and perform automated plus physical/visual acceptance.
