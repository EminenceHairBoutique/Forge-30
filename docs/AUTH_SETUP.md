# AUTH_SETUP.md — Supabase auth configuration (v3 Phase 1)

The app runs fully signed-out with zero configuration. To enable backup/sync:

1. Create a Supabase project → Settings → API: copy the URL and anon key into
   `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client-safe), and the
   service-role key into `SUPABASE_SERVICE_ROLE_KEY` (server-only — used by API routes in
   Phase 2+, never imported by client code).
2. Run `supabase/migrations/0001_core.sql` against the project (SQL editor or CLI). It
   creates `sync_blobs`/`sync_rows` with RLS locked to `auth.uid() = user_id`.
3. Auth → Providers: enable **Email** (magic link). Set the Site URL to the deployed origin
   so the link redirects back into the installed PWA.
4. Optional — **Apple Sign In**: Apple Developer → Identifiers → Services ID with
   "Sign In with Apple", domain + return URL `https://<project>.supabase.co/auth/v1/callback`;
   paste the Services ID, team ID, key ID and private key into Supabase Auth → Apple.
5. Optional — **Google OAuth**: Google Cloud Console → OAuth client (web), authorized
   redirect `https://<project>.supabase.co/auth/v1/callback`; paste client id/secret into
   Supabase Auth → Google.

Buttons for Apple/Google appear only when configured; the shipped UI is the magic-link email
card in Settings ("Back up your data"). Signed-out remains the first-run default forever —
"Continue without account" is not a mode, it's the baseline.
