# Medha — Setup Notes

## Environment

Copy the Supabase keys into `.env.local` (already gitignored). Required vars:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_PASSWORD=
```

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
node scripts/seed-questions.mjs   # ~15 BCS questions across all subjects
node scripts/seed-demo-exam.mjs   # one published model exam
node scripts/seed-live-demo.mjs   # upcoming + finished live exams (needs live-* test users)
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
3. Build command `next build`, output is auto-detected. No `vercel.json` needed.
4. In the Supabase dashboard add the production URL to Auth → URL Configuration
   (Site URL + redirect allow-list) so email/OAuth callbacks resolve.
5. For Google OAuth, add `https://<your-domain>/auth/callback` to the Google
   OAuth client's authorized redirects.

`SUPABASE_DB_PASSWORD` is only needed locally for `supabase db push`; it does not
belong in the Vercel environment.
