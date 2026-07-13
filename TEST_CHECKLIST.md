# V3.0 Test Checklist

## Before deployment
- [ ] Confirm the owner email spelling.
- [ ] Run `SUPABASE_SETUP.sql` successfully.
- [ ] Confirm Google provider is enabled in Supabase.
- [ ] Confirm GitHub Pages URL is in Supabase Redirect URLs.
- [ ] Confirm no service-role key or Google client secret exists in the repository.

## Authentication
- [ ] Approved Google Account logs in successfully.
- [ ] A different Google Account is signed out and denied.
- [ ] Refreshing the page preserves the approved session.
- [ ] Logout returns the app to local-only mode.

## Local-first behavior
- [ ] Add an expense while online; UI updates immediately.
- [ ] Add an expense in Airplane Mode; UI updates immediately.
- [ ] Edit an expense in Airplane Mode.
- [ ] Delete an expense in Airplane Mode.
- [ ] Close and reopen the PWA while offline; changes remain.

## Recovery and synchronization
- [ ] Restore the network; offline changes appear in Supabase.
- [ ] Deleted records remain hidden after refresh and re-login.
- [ ] Repeated focus/refresh does not create duplicates.
- [ ] Existing IndexedDB records upload only once.
- [ ] Settings sync without changing the selected historical view month.

## UI and PWA
- [ ] No green sync dot appears on the home screen.
- [ ] Normal successful sync produces no toast.
- [ ] Sync failure is visible only through the profile button/error badge.
- [ ] Bottom dock stays fixed during scrolling.
- [ ] GitHub Pages loads from `/amex-expense-app/`.
- [ ] Installed iPhone PWA launches in standalone mode.
