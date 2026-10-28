# Local game assets

The `kenney-industrial` files are a curated subset of Kenney's City Kit Industrial 2.0, distributed under CC0; see `kenney-industrial/License.txt`. Models retain their relative `Textures/colormap.png` dependency. `manifest.json` records model SHA-256 hashes, source-space bounds and texture hashes.

Reproduce or verify the import from a local copy of the pack:

```powershell
node scripts/import-game-assets.js --source "C:\Users\User\Downloads\kenney_city-kit-industrial_2.0"
node scripts/import-game-assets.js --source "C:\Users\User\Downloads\kenney_city-kit-industrial_2.0" --check
```

The game-specific loader utilities in `lib/game/` are copied from the installed Three.js r137 package, under its accompanying license. The original portfolio model is not modified.

## Visible building placement

The current game places all eight imported building variants along the existing spherical route, at a common uniform scale of 3 (no independent axis stretching). Canonical placement centers each native X/Z bound and puts its minimum Y at the placement base, oriented radially. Buildings are offset beyond the street half-width plus their half-diagonal and 1.2 units of clearance; the world stays radius 32.

Each imported building uses an oriented-box collision proxy computed from those same native bounds and transform. It is deliberately conservative around roof/details and recesses; doors and roofs are not advertised as rideable routes. The skater sweep adds its 0.25-unit clearance separately. Non-asset fixture layouts retain the legacy capsule proxies and identify themselves as `blockout-v1`; the asset-backed runtime identifies itself as `kenney-industrial-v1` in world descriptor version 2.

Imported instances borrow template geometry/materials/textures from the asset library. Scene teardown releases its instances instead of disposing the shared resources directly. Street/ramp/rail and avatar resources remain scene-owned.
