# Skate City device and playtest matrix

Automated browser coverage is useful evidence, but it does not replace the hands-on route, comfort, and physical-device checks below. Do not mark a manual row complete based only on Playwright.

| Device / browser | Input | Viewport | Status | Notes / capture |
| --- | --- | --- | --- | --- |
| Chromium / Playwright | Keyboard + mouse | 1280 × 800 | Automated pass | Join, move, jump/land, follow camera, leave, WebGL recovery; `artifacts/skate-progress/task-6-playable-desktop.png` |
| Chromium / Playwright | Keyboard + mouse | 390 × 844 | Automated pass | Renderer resizes and heading remains unchanged; `artifacts/skate-progress/task-6-playable-portrait.png` |
| Chromium / Playwright | Simulated standard/unsupported gamepad | 1280 × 800 | Automated pass | Standard pad moves/jumps; unsupported mapping reports keyboard/touch fallback; fallback persists correctly after leave/rejoin. No physical gamepad tested. |
| Chromium / Playwright mobile emulation | Touch + semantic button activation | 390 × 844 portrait; 844 × 390 landscape | Automated pass | Virtual stick and jump work in the local loop in both orientations; keyboard Space activates the focused touch button; 44px+ targets, player framing and card/control clearance verified. No physical phone tested. |
| User-reported playtest; device/browser unspecified | Keyboard | Not recorded | Partial manual feedback | Join, W forward, A/D steer, S brake, Space jump, follow camera and building/ramp collision detection worked; camera felt good. World felt small. Retest the expanded world and stop-on-building behavior; full lap and recenter checks remain pending. |
| User-reported playtest (2026-10-28); Windows Firefox, Steam Controller (new/2026), USB-connected receiver, local port 8000 | Physical gamepad | Not recorded | Reported failure — acceptance open | User reports only D-pad response, no joystick movement or jump-button response. Exact browser mapping/Steam Input mode remains unverified. Audit reproduced gradual-stick ownership failure and all-neutral reset blocking a new Jump press; see `docs/reviews/2026-10-28-skate-city-playability-audit.md`. Chrome comparison has not been performed. Do not infer physical success from simulated-pad tests. |
| Desktop Chrome, physical device | Keyboard + mouse | Landscape | Pending manual playtest | Complete the connected lap both directions; jump/land; enter and leave the ramp; collide with a building; test an alley obstruction; record comfort, visibility and camera tuning. |
| iOS Safari, physical device | Touch | Portrait + landscape | Pending Task 7 | Validate touch controls, safe areas, camera framing, background/re-entry and hands-off automatic following. |
| Android Chrome, physical device | Touch | Portrait + landscape | Pending Task 7 | Validate touch controls, performance, safe areas, background/re-entry and hands-off automatic following. |
| Desktop Chrome, physical device | Gamepad | Landscape | Pending Task 7 | Validate pairing, reconnect, dead zones, disconnect and automatic camera behavior. |

## Manual route checklist

- [ ] Keep manual camera input untouched and complete a connected lap in both directions.
- [ ] Jump on the street, enter/leave the ramp, and confirm landing/contact orientation.
- [ ] Collide with a building and confirm ordinary play stops safely without a bail or respawn; challenge-specific bail remains opt-in.
- [ ] Cross route joins, slope changes and pole-oriented sections without a camera flip or support gap.
- [ ] Stop, reverse, trick, and test an alley obstruction; note whether the player stays framed and the route remains visible.
- [ ] Try optional drag/scroll camera control, then release and verify the 1.5-second moving-only recenter.
- [ ] Record device, browser, viewport, comfort notes, camera tuning changes and screenshots above.
