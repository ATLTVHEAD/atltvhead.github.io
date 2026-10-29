# GPT Sol review — planar launch, capture, balance and tricks

Date: 2026-10-29

Reviewer: GPT-6.1 Sol, in the current session at the user's request
Scope: read-only mechanics/design review; no gameplay implementation or tuning changes

## Disposition

**The requested read-only review is recorded.** At review time, Task 5 still needed
two capture-policy decisions and an explicit manual Jump/lip precedence choice.
The user subsequently approved the resolutions recorded below. The overall
simulation-owned design is suitable; do not replace its approved numbers or add a
Grind-hold requirement. The findings are counterexamples to an underspecified
composition, **not claims that the then-absent launch/grind implementation
contained these bugs**.

## Review checklist and evidence

- [x] Read original spec §§4–5 and Tasks 5–6, plus the planar continuation overrides.
- [x] Read the Genex README, relevant design-log material, and launch/capture/balance/
  trick source at commit `7251d3c6fac59f30865f38365d0422fcbd3cfa8f`.
- [x] Inspect current planar motion, compiled paths/markers/supports, fixed-tick session,
  fixture and existing content tests.
- [x] Check the two capture counterexamples numerically through the local path projector.
- [x] Run focused existing tests: 29 passed across four files (command below).
- [x] Record unresolved decisions and preserve outstanding human acceptance gates.

Reference: <https://github.com/Rabneba/skate-threejs/tree/7251d3c6fac59f30865f38365d0422fcbd3cfa8f>
(`README.md`, `DESIGN.md`, `src/skate/{skate-model,grind,tricks}.ts`). This was a
source/design review, **not a hands-on play/feel evaluation** of Genex or our game.
No reference code or assets were copied.

## Findings

### R1 — Important: capture can cancel the launch it immediately follows

**Locations:** original plan Task 5 interface/composition (line 157);
`js/game/world/planar-city-layout.js:174–199,221–230`.

The launch marker is on an eligible ledge path, `line-smooth-crest-exit`.
The prescribed sequence is normal motion → launch crossing → capture. Once launch
sets airborne mode, the source ledge itself qualifies unless capture explicitly
excludes it. At the marker, launch velocity `[12,4,0]` has distance **0** from that
path and absolute 3D alignment **0.965920**, comfortably passing 2/0.8/0.65. A naive
capture stage therefore immediately replaces the launch with a grind on its own
takeoff path. Using only planar heading for alignment does not prevent this.

**Proposed user decision:** temporarily exclude the consumed marker's source path
from capture until the skater leaves that path's 0.8-unit capture neighborhood.
Other eligible target paths remain capturable; do not globally disable rising
captures, which could prevent the intended pipe approach. Keep marker rearming
and the 150 ms post-grind cooldown as separate concepts.

**Required regression if approved:** actual motion through the crest at speed 3
and at cruising speed 12 launches once and is not immediately captured by the
source ledge, while the intended pipe can still capture. Repeat for seam images
with a single canonical path/marker ID. Test leaving/re-entering the source region.

### R2 — Important: 150 ms cooldown alone does not prevent endpoint recapture

**Locations:** original spec §4, capture/dismount rules (lines 64–65);
original plan Task 5 boundary tests (line 160);
`js/game/world/skate-paths.js:44–74`.

The projector clamps to segment endpoints, so the 0.8-unit capture region extends
beyond a path's end. Consider leaving a horizontal elevated path at speed 2.2,
with existing drag 0.6 and gravity 14. After 150 ms, its analytic airborne pose is
**0.32325** units past the endpoint and **0.15750** below it. Horizontal speed is
**2.11**, distance to the endpoint is **0.359579**, and full-velocity alignment is
**0.708784**. Every numerical capture condition passes when cooldown expires,
even though there is no path left in the outgoing direction. Capturing that
endpoint can produce another start/end interval, a backward snap, and later false
combo links. This is a counterexample, not a simulation of unimplemented mechanics.

**Proposed user decision:** additionally reject a candidate when no positive path
distance remains in the approach's signed travel direction. Preserve the exact
150 ms cooldown; do not extend it arbitrarily or import Genex's different
0.7-unit recatch-clearance/minimum-remaining-length constants.

**Required regression if approved:** run past endpoints in both directions at
near-minimum speeds for substantially longer than 150 ms; emit no new start/end
until a genuinely valid approach. Keep the separate 149/150 ms eligibility tests
using an interior point with positive distance remaining. Check high-speed
endpoints and seam-adjacent endpoints too.

### R3 — Medium: source-path IDs are not support-surface IDs

**Locations:** `js/game/world/planar-city-layout.js:184,198,224`;
`js/game/world/planar-city-surfaces.js:202–230,248–260`;
`js/game/core/planar-skater.js:179–184,269–272`.

The marker names `line-smooth-crest-exit`, but support queries return
`line-smooth-crest-exit:deck`. The pipe's `connectedSupportIds` includes the unsuffixed
path ID. Direct comparison with `surfaceId` or `motion.priorSurfaceId` will miss
valid transitions. The local probe confirmed all three names.

**Implementation clarification, not a rule change:** resolve references through
the canonical compiled path's `supportSurfaceId`; accept an explicitly referenced
surface ID as itself. Do not strip suffixes indiscriminately or treat arbitrary
nearby support as connected. Test positive connected transitions, unrelated
support rejection, and both image translations.

### R4 — Medium: one Jump event does not define Jump/lip precedence

**Locations:** original plan Task 5 test list (line 160);
`js/game/core/planar-skater.js:132–137,201–210`;
`js/game/core/city-skater.js:19–29`.

Manual Jump currently starts at upward speed **6**; the approved automatic launch
uses **4**. The plan requires one launch when they coincide but does not say which
impulse wins. Deduplicating events alone could still add both impulses or quietly
weaken manual Jump.

**Proposed user decision:** manual Jump wins with its existing impulse, never
stacks with automatic launch, and consumes that marker crossing for rearming
purposes. Pin the resulting velocity as well as the single event in tests.

## Reference comparison and retained requirements

- Genex's `Grinder.catch`/`update` separates entry from locked movement, and its
  model stops ordinary position integration while grinding. Our planned single
  authoritative `railId`/distance plus exclusive locked-motion branch is appropriate.
- The reference documents and handles accidental grounded catches, stale motion
  sweeps, launch capture stealing takeoff, and endpoint recatch loops. These are
  useful failure cases to test, not permission to copy its tuning or code.
- Genex's takeoff uses surface slope/energy, differentiated capture windows and
  different recatch rules. Our marked speed-3/up-4 arcade launch, inclusive
  speed-2/distance-0.8/alignment-0.65 capture, constant planar up, and 150 ms cooldown
  remain the approved contract. Do not silently substitute the reference physics.
- Keep deterministic balance with the plan's 200 ms grace, 1.6/s correction,
  duration drift and signed curvature. Test reversed travel, zero-length adjacent
  path segments, ±1 failure, braking below 2, and independence from render cadence.
  Presentation must map correction/lean signs consistently in both travel directions.
- Keep controlled balance-failure dismount, not Genex's compulsory ragdoll. Emit
  one reasoned end event, lose pending points once, and retain already banked score.
- Preserve full outgoing tangent velocity on sloped dismounts. Planar free-motion
  `forward` is horizontal, so transfer tangent X/Z magnitude into horizontal speed
  and tangent Y into vertical speed; do not normalize away the vertical component.
- Keep 300 ms simulation-timed tricks, known-ID validation, completion-before-clean-
  landing ordering, bounded event deduplication, and a single combo authority.
  The reference's score/animation/HUD structure is not ours to import.
- Maintain eventIndex across composed stages and recovery within a session; do not
  restart it when a recovery factory resets motion. Leave may reset the whole local
  session. Preserve signed path distance in grind events for later scoring checks.
- Consume collision-resolved, local unwrapped sweeps. Canonicalize only final pose;
  periodic path/marker images share identity. Avoid double motion or charging a
  full tick twice when changing stages.

## User decisions recorded after the review (2026-10-29)

The user approved these Task 5 rules before implementation:

1. Exclude the launch source path from capture until the skater leaves its 0.8-unit
   capture neighborhood.
2. Reject an outward endpoint capture when no positive path distance remains in
   the approach's signed travel direction.
3. If manual Jump and a marked lip cross in the same tick, manual Jump wins;
   impulses do not stack, and that marker crossing is consumed.

These decisions do not approve visual feel, physical-device behavior, the P8 city,
Task 10 comic art, or final acceptance. Those gates remain in the pending-gates
tracker.

## Verification and limitations

Fresh command:

```text
npm run test:unit -- tests/unit/skate-paths.test.js tests/unit/planar-city-layout.test.js tests/unit/planar-skater.test.js tests/unit/game-session.test.js
4 files passed; 29 tests passed.
```

Read-only Node probes used `createSkateLineFixture` with the local asset manifest,
`queryPlanarSupport` and `projectSkatePath` for R1/R3, plus an analytically integrated
airborne endpoint case projected against a compiled horizontal path for R2. An
initial fixture probe omitted the required manifest and failed with missing asset
bounds; the corrected probe supplied it and produced the numbers above.

At review time, existing content tests checked only a hypothetical launch trajectory
at speed 3 and did not demonstrate production automatic launch/capture/balance or
timed tricks. The subsequent Task 5 implementation added the mounted keyboard/pad/
touch line and 30/60/120-schedule tests; those implementation checks are recorded
in the SDD progress ledger. No mechanics tests or gameplay implementation were
added as part of this read-only review itself.

P8 city visual/feel approval, Task 10 comic vignette approval, real physical-device
acceptance and final whole-branch review remain pending. See the consolidated
[`pending-gates tracker`](2026-10-29-skate-city-pending-review-gates.md).
