# Medha — Access & Credentials (template)

> Safe to commit — **no secrets**. The real values live in `ACCESS.md` (gitignored).
> Ask a maintainer for the keys, or read them from the Supabase dashboard
> (Settings → API).

Everything a new developer needs to connect to the backend and log into the app.

---

## 1. Supabase connection

| | |
|---|---|
| **Project name** | medha |
| **Project ref** | `<project-ref>` |
| **Region** | ap-southeast-1 (Singapore) |
| **Dashboard** | https://supabase.com/dashboard/project/`<project-ref>` |
| **API URL** | https://`<project-ref>`.supabase.co |

### `.env.local`

Create `.env.local` in the repo root (already gitignored) with:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<secret-service-role-key>
SUPABASE_DB_PASSWORD=<database-password>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- `NEXT_PUBLIC_*` keys are safe in the browser (public by design, guarded by RLS).
- `SUPABASE_SERVICE_ROLE_KEY` is **server-only** — used by the bulk-import route and
  the admin/seed scripts. Never expose it to the client.
- `SUPABASE_DB_PASSWORD` is only for local `supabase db push`. **Do not** add it to Vercel.
- `NEXT_PUBLIC_SITE_URL` is the origin used for the sign-up confirmation link and
  the Google OAuth redirect. On Vercel it can be omitted (falls back to
  `VERCEL_PROJECT_PRODUCTION_URL`). The same origin, plus its `/auth/callback`
  path, must be listed under **Auth → URL Configuration → Redirect URLs**.
- The confirmation **email's subject and body cannot be changed** on this
  project: since 2026-06-03, new free-tier projects on the default email provider
  cannot customise auth templates. That needs custom SMTP. See `SETUP.md`.

Find these in the Supabase dashboard: **Settings → API** (URL + keys) and
**Settings → Database** (password).

### CLI link (for migrations / type gen)

```bash
supabase link --project-ref <project-ref>
SUPABASE_DB_PASSWORD=<database-password> supabase db push
supabase gen types typescript --project-id <project-ref> > src/types/database.ts
```

---

## 2. App login credentials

All script-created accounts share the password **`Test1234!`** and are created with
email pre-confirmed, so they log in immediately at `/login` (no email step).

### Student accounts

| Email | Purpose |
|---|---|
| `exam-tester@medha.test` | Model-exam testing (`verify-exam.mjs`) |
| `live-a@medha.test` | Live-exam participant A (`verify-live.mjs`) |
| `live-b@medha.test` | Live-exam participant B |
| `live-c@medha.test` | Live-exam participant C |

These are created automatically the first time you run the matching verification
script — see §3. To create them without running the checks, run the scripts once.

### Admin account

There is **no default admin** — create one on demand:

```bash
node scripts/create-admin.mjs admin@medha.test Test1234!
```

Then log in at `/login` → you'll have access to `/admin`. The script creates a
confirmed user if it doesn't exist, or promotes an existing user to `admin`.

---

## 3. Quick start

```bash
# 1. Install
npm install

# 2. Add .env.local (see §1)

# 3. Create an admin login
node scripts/create-admin.mjs admin@medha.test Test1234!

# 4. (Optional) create the student test users + demo data
node scripts/seed-questions.mjs    # ~15 BCS questions across subjects
node scripts/seed-demo-exam.mjs    # one published model exam
node scripts/verify-live.mjs       # also creates live-a/b/c@medha.test
node scripts/seed-live-demo.mjs    # upcoming + finished live exams

# 5. Run
npm run dev                        # http://localhost:3000
```

Log in at http://localhost:3000/login with any account above.

---

## 4. Notes

- **Google OAuth** and **email confirmation** need dashboard configuration before
  they work in production — see `SETUP.md` (Auth section).
- More on migrations, cron jobs, verification, and Vercel deploy: `SETUP.md`.
- Rotate keys in the Supabase dashboard (Settings → API) if they ever leak; then
  update `.env.local` and the gitignored `ACCESS.md`.
