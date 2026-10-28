# Local game assets

The `kenney-industrial` files are a curated subset of Kenney's City Kit Industrial 2.0, distributed under CC0; see `kenney-industrial/License.txt`. Models retain their relative `Textures/colormap.png` dependency. `manifest.json` records model SHA-256 hashes, source-space bounds and texture hashes.

Reproduce or verify the import from a local copy of the pack:

```powershell
node scripts/import-game-assets.js --source "C:\Users\User\Downloads\kenney_city-kit-industrial_2.0"
node scripts/import-game-assets.js --source "C:\Users\User\Downloads\kenney_city-kit-industrial_2.0" --check
```

The game-specific loader utilities in `lib/game/` are copied from the installed Three.js r137 package, under its accompanying license. The original portfolio model is not modified.
