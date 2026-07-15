# V3.0.1 Deployment

1. Back up Supabase `expenses` as CSV.
2. Confirm the allowed email in `js/config.js` and `SUPABASE_SETUP.sql`.
3. Run `SUPABASE_SETUP.sql` in Supabase SQL Editor.
4. Upload the contents of this folder to the GitHub repository root.
5. Wait for GitHub Pages deployment.
6. Open the site in Safari once and refresh.
7. If an old version persists, remove the existing Home Screen PWA and website data for `liyuyanghc.github.io`, then add it again.
8. Complete `TEST_CHECKLIST.md` before regular use.

Do not clear IndexedDB before the SQL backup and cloud cleanup are confirmed.
