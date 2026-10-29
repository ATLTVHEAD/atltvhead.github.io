# Skate City — pending reviews and acceptance gates

Updated: 2026-10-29

Automated implementation may continue under the user's direction, but that does
not substitute for any visual, mechanics, or physical-device review below.

| Gate | Status | What remains |
| --- | --- | --- |
| P8 planar city visual/feel review | **Pending user review** | Review the captures and questions in [`tests/manual/planar-city-review.md`](../../tests/manual/planar-city-review.md): street-width variation, building scale, dogleg readability, X/Z seams and the unchanged globe preview. No city approval is inferred from automation. |
| Task 5 launch/grind/balance mechanics | **User rules approved; automated implementation verified** | [GPT-6.1 Sol's read-only review](2026-10-29-sol-skate-mechanics-review.md) is recorded. The user approved source-path exclusion until outside the 0.8 capture neighborhood, outward-endpoint rejection with no path remaining, and manual Jump precedence (overrides, does not stack, consumes crossing). Automated unit and keyboard/pad/touch mounted checks pass. This does not close visual-feel or physical-device gates. |
| Task 10 comic-art vignette | **Pending** | After the planar scene treatment and one representative street/plaza/TVHead vignette, stop for user visual approval before expanding the dressing. |
| Physical device and manual route | **Pending actual hands-on testing** | See [`tests/manual/device-matrix.md`](../../tests/manual/device-matrix.md). This includes the physical Windows Firefox/Steam Controller report and Chrome comparison, real iOS/Android phones, and hands-off-camera/full-lap checks. Simulated Playwright inputs do not close these rows. |
| Task 12 final acceptance | **Pending** | Run the complete input-to-launch/grind/trick/tag/emote/Help/Leave sequence on the planar city; include both-axis/direction laps and the manual reviews above. Request a final whole-branch review. No push, PR, merge, or deploy without permission. |

## Latest automated baseline

- Latest `npm test`: 241 unit tests passed; the worker suite found no tests and
  exited 0 by configuration; all 49 browser tests passed.
- A preceding four-worker run had two browser timeouts: `planarCity_lapsBothAxesWithoutCameraPop`
  and `planarCity_leaveFromOpenControlsPreservesCustomizationWithoutStaleJump`.
  Both later passed in a loaded planar subset and the full suite. The stale-Jump
  test now latches its simulation state across animation frames so polling cannot
  miss the transient buffer; this is a test-observation fix, not a gameplay change.
  Do not infer a product regression or city approval from the earlier timeouts.
