# AMEX Expense App V3.0.0

V3.0 establishes the cloud foundation without making the app feel like a cloud dashboard.

## User-facing changes
- Sign in with the single approved Google Account.
- Continue adding, editing, and deleting expenses without a network connection.
- Data syncs automatically after login, when the app regains focus, and when the network returns.
- The home screen no longer shows a green sync dot or routine success messages.
- A small profile button opens account and troubleshooting details.

## Data-safety behavior
- Every edit is written to IndexedDB first.
- UI refreshes from local data immediately.
- Failed cloud requests never remove the local record.
- Deletes are synchronized as tombstones instead of destructive remote deletes.
- Newer client timestamps win during merges.
