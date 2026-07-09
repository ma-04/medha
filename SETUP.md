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
```
