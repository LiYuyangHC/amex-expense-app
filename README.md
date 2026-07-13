# AMEX Expense App V3.0.0

A personal, iPhone-first expense PWA with IndexedDB local-first storage, Supabase PostgreSQL backup, and Google OAuth.

## Architecture
1. Write every mutation to IndexedDB.
2. Render the UI immediately from local state.
3. Synchronize with Supabase silently in the background.
4. Keep pending local changes if the network or cloud request fails.

## Owner access
This build is configured for one Google Account only. See `js/config.js` and `SUPABASE_SETUP.sql`.

## Deployment
Read `DEPLOYMENT_GUIDE.md`, run `SUPABASE_SETUP.sql`, then deploy the project root to GitHub Pages.

## Security
The frontend contains only the Supabase publishable key. Database access is enforced by RLS with both `auth.uid()` and the exact JWT email. Never commit privileged secrets.
