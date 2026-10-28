# Collision and visible-assets playtest checkpoint

## Approved reprioritization

Following the user's playtest of the October 28 plan's Tasks 1–3:

- Other physical gamepads worked for movement, Jump and camera; in-game controls and controller selection appeared to work. The exact devices/browser were not recorded.
- Steam Controller recognition was incomplete. The user explicitly deferred this device; it is no longer a blocker for the next milestone. It is not marked supported or fixed.
- Loading the asset library did not replace the visible blockout buildings. The next review must show actual imported buildings in the scene, not just successful downloads.
- The character became stuck beside a blockout building above the world surface. The screenshot records the symptom, not an exact input replay.

The user approved this order: collision reliability → visible Kenney building placement with matching canonical bounds and street clearance → user playtest → later automatic launch/grind work. Preserve radius 32, the existing routes, character scale and comfortable automatic camera. This bounded correction does not complete all of Task 4 (branch/landmarks/tag panels remain later work), add wall rides, or bypass the mechanics-review gate.

## Collision correction

Deterministic simulation regressions reproduced a failure consistent with the screenshot: the ordinary collision branch returned before gravity and landing, zeroing vertical speed on every contact tick. The collision query also blocked movement away from an existing overlap.

The correction stops horizontal motion but continues radial gravity and support/landing resolution. Movement separating from an existing contact is allowed; movement into it is blocked. Explicit contest-bail behavior remains unchanged. Tests cover falling/landing and escape at three planet orientations, plus a genuinely supported grounded stop.

Verification before the collision commit: `npm test` passed 166 unit / 33 browser tests. The Worker suite was empty. Human confirmation of the screenshot scenario is still pending.

## Visible-building integration

The actual browser scene now places 24 imported Kenney buildings (eight variants) along the existing routes. A common scale of 3 preserves the models' relative proportions. Shared canonical transforms feed both mesh placement and oriented-box collision bounds; all sampled street vertices retain skater clearance. The native-box proxies are conservative around recesses/details, not an invitation to skate roofs or enter doors. Radius, street/ramp widths, avatar and camera distances are preserved. Descriptor version 2 distinguishes asset-backed `kenney-industrial-v1` from legacy `blockout-v1` test layouts.

The loader exposes a copy of its manifest to the pure layout builder. Scene teardown releases borrowed asset instances separately from owned street/avatar resources. A real-browser peer-scene test confirms disposing one scene does not dispose shared building geometry used by another. Actual GLB scene bounds match compiled collider bounds within 0.02 units.

The first full asset-backed run passed 34/35 browser tests but hit the existing hybrid Leave test's two-second interaction timeout under 16 simultaneous software-WebGL tests. Three focused repeats passed unchanged. Local Playwright concurrency is now limited to four workers (CI remains two); no interaction timeout or assertion was relaxed. The subsequent full suite passed 170 unit / 35 browser tests. The Worker suite was empty.

A read-only review found that escaping one of two equally close box faces could still be blocked at a corner. The corner sweep regression failed before the fix and passed afterward; a second regression verifies escape from an actual imported building. Reviewer-deferred items—exact screenshot replay, physical-device/visual comfort, Worker/multiplayer behavior and the explicitly deferred Steam Controller/later mechanics—remain outside automated acceptance and must not be marked passed.

Developer-inspected preview and chase captures: `artifacts/skate-progress/visible-kenney-preview.png` and `visible-kenney-chase.png` (ignored artifacts). These are not user approval or a phone-FPS claim.

## Human review gate

Run `npm run dev`, then open `http://localhost:8000/skate.html` and reload to pick up the current modules. Follow `tests/manual/device-matrix.md`, especially the new wall-fall/escape and visible-building clearance checks. Steam Controller troubleshooting is not required. The exact screenshot encounter still needs human confirmation; deterministic regressions establish the corrected failure mode, not a replay of the user's original inputs.

Stop here for the user's playtest before new mechanics. Branch/landmark/tag-target portions of Task 4, automatic traversal, rigging and final comic art remain open.
