# amex-expense-app V3.0.2

Personal iPhone-first PWA for Yuyang Li.

## Architecture
- GitHub Pages PWA
- IndexedDB local-first storage
- Supabase PostgreSQL cloud persistence
- Google OAuth

## Sync model
- Every record receives one permanent UUID at creation.
- Local changes are written first and marked pending.
- Cloud writes use idempotent UUID upserts.
- Deletes use tombstones (`deleted = true`).
- Exact active duplicates are defined by date + amount + category + note.
- Successful sync atomically replaces local data with the cloud canonical set.
- Normal sync is silent.

Run `SUPABASE_SETUP.sql` before deploying this version.


## Data privacy

No expense data is stored or seeded from the GitHub repository. Expense records live only in IndexedDB and the authenticated Supabase database.
