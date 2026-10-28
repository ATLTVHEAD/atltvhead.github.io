# Skate City device and playtest matrix

Automated browser coverage is useful evidence, but it does not replace the hands-on route, comfort, and physical-device checks below. Do not mark a manual row complete based only on Playwright.

| Device / browser | Input | Viewport | Status | Notes / capture |
| --- | --- | --- | --- | --- |
| Chromium / Playwright | Keyboard + mouse | 1280 × 800 | Automated pass | Join, move, jump/land, follow camera, leave, WebGL recovery; `artifacts/skate-progress/task-6-playable-desktop.png` |
| Chromium / Playwright | Keyboard + mouse | 390 × 844 | Automated pass | Renderer resizes and heading remains unchanged; `artifacts/skate-progress/task-6-playable-portrait.png` |
| User-reported playtest; device/browser unspecified | Keyboard | Not recorded | Partial manual feedback | Join, W forward, A/D steer, S brake, Space jump, follow camera and building/ramp collision detection worked; camera felt good. World felt small. Retest the expanded world and stop-on-building behavior; full lap and recenter checks remain pending. |
| Desktop Chrome, physical device | Keyboard + mouse | Landscape | Pending manual playtest | Complete the connected lap both directions; jump/land; enter and leave the ramp; collide with a building; test an alley obstruction; record comfort, visibility and camera tuning. |
| iOS Safari, physical device | Touch | Portrait + landscape | Pending Task 8 | Validate touch controls, safe areas, camera framing and hands-off automatic following. |
| Android Chrome, physical device | Touch | Portrait + landscape | Pending Task 8 | Validate touch controls, performance, safe areas and hands-off automatic following. |
| Desktop Chrome, physical device | Gamepad | Landscape | Pending Task 7 | Validate pairing, reconnect, dead zones, disconnect and automatic camera behavior. |

## Manual route checklist

- [ ] Keep manual camera input untouched and complete a connected lap in both directions.
- [ ] Jump on the street, enter/leave the ramp, and confirm landing/contact orientation.
- [ ] Collide with a building and confirm ordinary play stops safely without a bail or respawn; challenge-specific bail remains opt-in.
- [ ] Cross route joins, slope changes and pole-oriented sections without a camera flip or support gap.
- [ ] Stop, reverse, trick, and test an alley obstruction; note whether the player stays framed and the route remains visible.
- [ ] Try optional drag/scroll camera control, then release and verify the 1.5-second moving-only recenter.
- [ ] Record device, browser, viewport, comfort notes, camera tuning changes and screenshots above.
