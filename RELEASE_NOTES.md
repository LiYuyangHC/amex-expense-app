# V3.0.1 — Sync Integrity

## Fixed
- Prevented concurrent sync runs from fighting each other.
- Prevented offline records from being inserted repeatedly after reconnecting.
- Prevented legacy migrations from generating new IDs on every launch.
- Prevented edits from creating a second record.
- Prevented soft-deleted records from reappearing.
- Removed active duplicates using date + amount + category + note.

## Added
- Permanent UUID identity for every record.
- Idempotent Supabase `upsert` using the record UUID.
- IndexedDB migration version marker.
- Atomic local canonical replacement after a successful sync.
- Local duplicate blocking before save.
- Cloud duplicate cleanup and database-level duplicate protection.

## Data safety
- Local data is never cleared before a successful cloud round trip.
- Failed sync leaves local pending records intact.
- Normal sync remains silent; only actionable failures are surfaced.
