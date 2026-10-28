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

## Next review

Visible-building integration and its verification will be recorded here before the next playtest. The scene must retain the current avatar and routes; new mechanics and final comic art are not acceptance claims for this checkpoint.
