# V3.0.6 — UI Initialization Hotfix

## Fixed
- Fixed mixed PWA cache versions that could load a new HTML shell with old JavaScript.
- Changed JavaScript and CSS assets to network-first loading with versioned URLs.
- Added defensive event binding so one missing element cannot disable the entire app.
- Replaced `Array.prototype.at()` for broader iOS Safari compatibility.
- Added a visible, non-destructive initialization error state.

## Data safety
- No IndexedDB records are deleted or migrated by this hotfix.
- No Supabase schema changes are required.
