# Skate City device and playtest matrix

Automated browser coverage is useful evidence, but it does not replace the hands-on route, comfort, and physical-device checks below. Do not mark a manual row complete based only on Playwright.

P8 city-review captures and automated integration results are collected in `tests/manual/planar-city-review.md`; the human city-approval gate remains open.

## Current build review checklist

Start the local server with `npm run dev` and open `http://localhost:8000/skate.html`. The server must remain running; the game assets load locally before Join becomes available.

- [ ] Confirm the preview loads, choose a color/cap, join, and use W/A/S/D and Space to move and jump. Leave and rejoin; confirm the session resets.
- [ ] Open Controls during play. Check that the game pauses, the active-device hint is visible, Escape returns focus to the game, and movement does not continue behind the panel.
- [ ] With one of the working non-Steam gamepads connected, expand Controller diagnostics. Record browser, controller ID, mapping, axis/button counts, selected controller, and whether values change when sticks/buttons move. Verify left stick and Jump; note any drift or missed inputs. Steam Controller-specific acceptance is deferred at the user's request.
- [ ] If the browser exposes a nonstandard controller, select it and follow Calibrate, releasing controls between prompts. Test Jump and movement after returning to play. Reset mapping or reload to clear the session-only mapping.
- [ ] If no gamepad is exposed, check the no-device guidance. No Steam Input troubleshooting is required for this checkpoint.
- [ ] On a phone, try touch movement and Jump in portrait and landscape, then background and reopen the page. Record device/browser, visibility, focus and performance.
- [ ] Confirm that imported industrial buildings (windows, doors, roofs and varied silhouettes) are visible instead of the plain cubes. The avatar and route palette remain the existing versions; final comic art is not part of this checkpoint.
- [ ] Jump toward a building side, release movement and verify the character falls onto the world instead of hovering beside the wall. Repeat while holding forward into the wall, then turn away and skate off; ordinary contact must not force respawn.
- [ ] Skate the full route both ways with the camera untouched. Check visibly open streets for invisible barriers and note any building/camera clipping. Try one bright and one underside section.
- [ ] Check local loading and Retry after an interrupted asset request if you can reproduce one; this does not require a connection to an asset CDN.

Automatic launches/grinds, finalized graffiti, the rigged character, and comic city art are later work and are not acceptance checks for this build. Full-lap, phone and visual acceptance remain pending until actually performed. Other gamepads have partial user-reported movement/Jump/camera acceptance; Steam Controller is deferred, not supported by assertion.

| Device / browser | Input | Viewport | Status | Notes / capture |
| --- | --- | --- | --- | --- |
| Chromium / Playwright | Keyboard + mouse | 1280 × 800 | Automated pass | Join, move, jump/land, follow camera, leave, WebGL recovery; `artifacts/skate-progress/task-6-playable-desktop.png` |
| Chromium / Playwright | Keyboard + mouse | 390 × 844 | Automated pass | Renderer resizes and heading remains unchanged; `artifacts/skate-progress/task-6-playable-portrait.png` |
| Chromium / Playwright | Simulated standard/unsupported gamepad | 1280 × 800 | Automated pass | Standard pad moves/jumps; unsupported mapping reports keyboard/touch fallback; fallback persists correctly after leave/rejoin. No physical gamepad tested. |
| Chromium / Playwright | Keyboard + simulated standard gamepad | 1280 × 800 | Automated pass | P8: tight-alley turns and connector, support-query agreement, swept-body clearance, continuous X/Z laps and seam camera offsets, customization preservation and stale-jump reset. Captures and pending human-review prompts: `tests/manual/planar-city-review.md`. |
| Chromium / Playwright mobile emulation | Touch + semantic button activation | 390 × 844 portrait; 844 × 390 landscape | Automated pass | Virtual stick and jump work in the local loop in both orientations; keyboard Space activates the focused touch button; 44px+ targets, player framing and card/control clearance verified. No physical phone tested. |
| User-reported playtest; device/browser unspecified | Keyboard | Not recorded | Partial manual feedback | Join, W forward, A/D steer, S brake, Space jump, follow camera and building/ramp collision detection worked; camera felt good. World felt small. Retest the expanded world and stop-on-building behavior; full lap and recenter checks remain pending. |
| User-reported playtest (2026-10-28); Windows Firefox, Steam Controller (new/2026), USB-connected receiver, local port 8000 | Physical gamepad | Not recorded | Reported failure — acceptance open | User reports only D-pad response, no joystick movement or jump-button response. Exact browser mapping/Steam Input mode remains unverified. Audit reproduced gradual-stick ownership failure and all-neutral reset blocking a new Jump press; see `docs/reviews/2026-10-28-skate-city-playability-audit.md`. Chrome comparison has not been performed. Do not infer physical success from simulated-pad tests. |
| User follow-up playtest (2026-10-28); other gamepad models/browser unspecified | Physical gamepad | Not recorded | Partial manual pass | Movement, Jump and camera worked; in-game controls and controller selection appeared to work. Steam Controller remained incompletely recognized and was explicitly deferred by the user, not marked fixed. Wall-sticking collision failure remains subject to retest. |
| Desktop Chrome, physical device | Keyboard + mouse | Landscape | Pending manual playtest | Complete the connected lap both directions; jump/land; enter and leave the ramp; collide with a building; test an alley obstruction; record comfort, visibility and camera tuning. |
| iOS Safari, physical device | Touch | Portrait + landscape | Pending Task 7 | Validate touch controls, safe areas, camera framing, background/re-entry and hands-off automatic following. |
| Android Chrome, physical device | Touch | Portrait + landscape | Pending Task 7 | Validate touch controls, performance, safe areas, background/re-entry and hands-off automatic following. |
| Desktop Chrome, physical device | Gamepad | Landscape | Pending Task 7 | Validate pairing, reconnect, dead zones, disconnect and automatic camera behavior. |
| Human city review (P8) | Visual review of browser captures | 1280 × 800 automated captures | Pending user gate | Review width variation, building-enclosed turns, full-scale scenery and seam continuity in `tests/manual/planar-city-review.md`; no human approval inferred from automation. |

## Manual route checklist

- [ ] Keep manual camera input untouched and complete a connected lap in both directions.
- [ ] Jump on the street, enter/leave the ramp, and confirm landing/contact orientation.
- [ ] Collide with a building and confirm ordinary play stops safely without a bail or respawn; challenge-specific bail remains opt-in.
- [ ] Cross route joins, slope changes and pole-oriented sections without a camera flip or support gap.
- [ ] Stop, reverse, trick, and test an alley obstruction; note whether the player stays framed and the route remains visible.
- [ ] Try optional drag/scroll camera control, then release and verify the 1.5-second moving-only recenter.
- [ ] Record device, browser, viewport, comfort notes, camera tuning changes and screenshots above.
