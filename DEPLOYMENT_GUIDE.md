# V3.0 Deployment Guide

## 1. Confirm the owner email
The build currently allows exactly:

`gnaguy.lee@gmail.com`

If this is misspelled, replace it in both:
- `js/config.js`
- `SUPABASE_SETUP.sql`

## 2. Update the database
Open Supabase → SQL Editor and run `SUPABASE_SETUP.sql` once.

This adds `client_updated_at`, replaces the broad per-user policies with owner-only policies, and removes hard-delete access.

## 3. Enable Google in Supabase
In Supabase Authentication Providers, enable Google and enter the Google OAuth client ID and secret.

In Google Cloud Console, use the callback URL shown by Supabase for the Google provider. It normally uses the Supabase project auth callback endpoint.

## 4. Configure app redirect URLs
In Supabase Authentication URL Configuration:
- Site URL: `https://liyuyanghc.github.io/amex-expense-app/`
- Redirect URL: `https://liyuyanghc.github.io/amex-expense-app/`

The app sends this exact GitHub Pages location as `redirectTo`, so it must be allowed in Supabase.

## 5. Disable unwanted login methods
Disable Email authentication if it is no longer needed. Leave Google enabled.

## 6. Deploy
Copy the project files to the root of `LiYuyangHC/amex-expense-app`, commit, and push to the branch used by GitHub Pages.

## 7. Refresh the installed PWA
After GitHub Pages finishes deploying:
1. Open the website in Safari.
2. Reload once.
3. If an old version remains, remove the Home Screen app and add it again.

Never place a Supabase `service_role` key, Google client secret, database password, or GitHub token in this repository.
