# Medha — Setup Notes

## Environment

Copy the Supabase keys into `.env.local` (already gitignored). Required vars:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_PASSWORD=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`NEXT_PUBLIC_SITE_URL` is the origin used to build the sign-up confirmation link
and the Google OAuth redirect (`src/lib/site-url.ts`). On Vercel it may be
omitted — `VERCEL_PROJECT_PRODUCTION_URL` is the fallback, and it holds the
production domain even during preview builds, so a preview never mails out a
preview link. Whatever origin it resolves to must also be listed in the
dashboard under **Auth → URL Configuration → Redirect URLs**, including the
`/auth/callback` path, or Supabase rejects the redirect.

`SUPABASE_DB_PASSWORD` is for local CLI use only. Do not add it to Vercel.

## Database

Migrations live in `supabase/migrations/` and are the source of truth.

```bash
supabase link --project-ref <ref>
SUPABASE_DB_PASSWORD=<pw> supabase db push        # apply migrations to cloud
supabase gen types typescript --project-id <ref> > src/types/database.ts
```

## Auth

- **Email/password** works out of the box.
- **Email confirmation**: if enabled in the Supabase dashboard (Auth → Providers →
  Email), signup shows a "confirm your email" message instead of logging in
  immediately. Disable it for a frictionless dev flow.
- **Confirmation link origin**: set by `emailRedirectTo` in `signUp()`, derived
  from `NEXT_PUBLIC_SITE_URL`. Before that existed, the link fell back to the
  dashboard's Site URL, which still read `http://127.0.0.1:3000`.
- **Email subject and body cannot be customised on this project.** Since
  2026-06-03 a new free-tier project on Supabase's default email provider cannot
  edit the auth email templates at all. Changing them requires configuring custom
  SMTP (Auth → SMTP Settings) and then editing the templates in the dashboard —
  hosted templates cannot be pushed from `config.toml`.
- **Do not run `supabase config push`.** It overwrites the linked project's whole
  auth config from `supabase/config.toml`, which carries
  `enable_confirmations = false` and a dev-sized `email_sent` rate limit. It
  would silently disable email confirmation in production. Set Site URL and the
  redirect allow-list in the dashboard instead. `config.toml` governs the local
  `supabase start` stack, where `SITE_URL` and `SITE_CALLBACK_URL` must be
  exported (e.g. `http://127.0.0.1:3000` and `.../auth/callback`).
- **Google OAuth**: requires configuration in the Supabase dashboard
  (Auth → Providers → Google) with a Google Cloud OAuth client ID + secret, and
  the redirect URL `https://<ref>.supabase.co/auth/v1/callback`. The
  "Continue with Google" button is wired but will error until this is set.

## Create an admin user

```bash
node scripts/create-admin.mjs <email> <password>
```

Creates a confirmed user (or promotes an existing one) to the `admin` role.

## Run

```bash
npm run dev      # http://localhost:3000
npm run build    # production build
npm test         # Vitest unit tests (grading logic)
```

## Verification scripts

Integrity checks run against the linked cloud project (read `.env.local`):

```bash
node scripts/verify-rls.mjs     # answer-key isolation (anon cannot read answers)
node scripts/verify-exam.mjs    # model-exam grading + tamper checks
node scripts/verify-live.mjs    # live-exam window, one-attempt, ranking, leaderboard gating
```

Demo data for manual/UI testing:

```bash
node scripts/seed-questions.mjs      # all data/questions/*.json (BCS + Bank/Primary/NTRCA), idempotent
node scripts/seed-standing-exam.mjs  # a published "attend anytime" full model test over all questions
node scripts/seed-demo-exam.mjs      # a small 5-question published model exam
node scripts/seed-live-demo.mjs      # upcoming + finished live exams (needs live-* test users)
```

## Scheduled jobs (pg_cron)

Two cron jobs are created by migrations (guarded so migrations still apply if
pg_cron is unavailable):

- `auto-submit-expired-attempts` — grades attempts past their deadline (every minute)
- `auto-finalize-live-exams` — ranks + publishes live-exam results once the window closes (every minute)

Inspect them in the SQL editor: `select jobname, schedule from cron.job;`

## Deploy (Vercel)

The app is a standard Next.js App Router project — deploy on Vercel:

1. Push the repo to GitHub and import it in Vercel (requires your Vercel login).
2. Set the environment variables (Project → Settings → Environment Variables):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only; used by the bulk-import route)
   - `NEXT_PUBLIC_SITE_URL` (optional — defaults to the Vercel production domain)
3. Build command `next build`, output is auto-detected. No `vercel.json` needed.
4. In the Supabase dashboard add the production URL to Auth → URL Configuration
   (Site URL + redirect allow-list, including `/auth/callback`) so email and
   OAuth callbacks resolve. Do this in the dashboard, not via
   `supabase config push` — see the Auth section above.
5. For Google OAuth, add `https://<your-domain>/auth/callback` to the Google
   OAuth client's authorized redirects.

`SUPABASE_DB_PASSWORD` is only needed locally for `supabase db push`; it does not
belong in the Vercel environment.
