# Changelog

## V3.0.0 — Google Login & Cloud Foundation

### Added
- Google OAuth through Supabase Auth.
- Exact owner-email allowlist in both the client and RLS policies.
- Local-first cloud synchronization for expenses and settings.
- `client_updated_at` timestamps for deterministic merge decisions.
- Soft-delete synchronization through the existing `deleted` field.
- Silent automatic sync on login, app focus, and network recovery.
- Account sheet with login, logout, manual retry, and last-sync details.
- Deployment, migration, and test documentation.

### Changed
- Removed the persistent green sync dot and success status from the home screen.
- Replaced email Magic Link authentication with Google OAuth.
- Updated service-worker caching to reduce stale GitHub Pages releases.
- Normal sync success is now silent; only actionable failures are surfaced.

### Fixed
- Prevented arbitrary authenticated accounts from accessing app tables.
- Prevented older remote records from silently replacing newer offline edits.
- Preserved deleted records as tombstones so they do not reappear after sync.
