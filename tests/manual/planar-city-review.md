# Planar city review — human approval pending

**Status: awaiting user review.** Automated evidence is not visual or physical acceptance. Do not mark the planar city approved or continue into the mechanics/comic-art work until the user has reviewed these captures.

The captures below are local, git-ignored files under `artifacts/skate-progress/`; they are not committed binaries. Automated captures use Chromium at 1280 × 800 unless the filename says otherwise.

## Review captures

| View | Capture | Notes |
| --- | --- | --- |
| Unchanged globe preview | `planar-city-globe-preview.png` | Menu remains the spherical preview with its eight buildings. |
| Play-city overview | `planar-city-topdown-overview.png` | Temporary overview camera; the actual follow camera is restored after capture. |
| Plaza / play spawn | `planar-city-plaza.png` | Joined-game chase view at the plaza spawn. |
| Ramp and primary rails | `planar-city-ramp-primary-rails.png` | Temporary close camera view to inspect the ramp/deck geometry; this is not an automatic launch/grind demo. |
| Narrowing street | `planar-city-narrowing-street.png` | Captured during normal simulated gamepad movement. |
| Dogleg turn one | `planar-city-alley-turn-one.png` | Captured during the two-turn alley traversal. |
| Dogleg turn two | `planar-city-alley-turn-two.png` | Captured during the same traversal. |
| Alley exit | `planar-city-alley-exit.png` | Shows the branch opening toward its east-route connector. |
| X seam | `planar-wrap-x-seam.png`, `planar-city-x-seam-review.png` | X-axis seam while moving; includes a dedicated canvas capture near the crossing. |
| Responsive seam views | `planar-wrap-x-seam-portrait.png`, `planar-wrap-x-seam-landscape.png` | Captures at 390 × 844 and 844 × 390 during the X-axis lap. |
| Z seam | `planar-wrap-z-seam.png` | Z-axis seam while moving. |
| Seam corner | `planar-wrap-corner-wide.png` | Wide corner view with the follow camera paused for the capture. |
| Authored wall/path detail | `planar-dogleg-line.png`, `planar-tag-panel-normals.png`, `planar-near-spawn-line.png` | P7 detail captures; useful for geometry/normals, not city approval. |

The movement captures use a simulated standard gamepad routed through the production input stack. They demonstrate automated traversal, not physical controller feel. The ramp/rail detail uses a temporary camera view; no gameplay mechanics are implied.

## Automated evidence

P8 adds mounted browser checks for:

- Traversing the narrowing alley and both dogleg turns with movement input; comparing grounded state to `queryPlanarSupport`; checking swept-body clearance with `sweepPlanarSkater`; and reaching the connected exit.
- Preserving the selected color and cap through Controls → Leave → Join, while confirming a queued/held Jump does not fire in the new play session.
- Crossing the X seam while retaining support identity and bounded camera/target offsets; the existing lap check also covers at least one full lap on both X and Z.

## Verification snapshot

- `npm test`: 218 unit tests passed (27 files); worker suite had no test files and exited 0 by configuration; 46/46 browser tests passed using the default four workers.
- `npm run build`, `node --check tests/e2e/planar-city.spec.js`, and `git diff --check`: exit 0. Asset source check: 12 local assets verified.
- Render metrics: 108 retained asset instances, 171 imported asset mesh instances; center view 6 draw calls / 3,442 triangles; seam view 4 / 448. Play camera far = 512; fog near/far = 160/208.
- Cleanup observations: forced failed scene boot emitted 75 geometry-dispose events; Retry retained both scenes (8 preview buildings and 9 play tiles). Disposing a peer preview scene caused 0 premature shared-template geometry disposals.
- Full structured snapshot: ignored `artifacts/skate-progress/planar-city-verification.json`. All PNGs remain local and git-ignored; no binary captures are committed. Physical-device checks remain pending in `tests/manual/device-matrix.md`.

## Human review questions

Please review the images and, if useful, try the city locally. Does the post-join world now read as an ordinary full-scale 3D city? In particular:

1. Do the changing street widths and building-defined two-turn alley feel clear and playable?
2. Do the full-scale buildings, player scale, plaza, ramp and rails read correctly?
3. Do X/Z seam travel and the corner view feel continuous, without an obvious pop or camera pan?
4. Is the globe preview still the expected entry/leave experience?

**Decision: pending user response.** Mechanics, comic-art approval, physical gamepad/phone acceptance, and any scope beyond P8 remain open.
