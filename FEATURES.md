# Medha (মেধা) — Features & How It Works

**Medha** is a bilingual (Bangla/English) web app for BCS and government-job exam
preparation — practice, timed model tests, scheduled live exams with a
leaderboard, and a searchable question bank. This document explains every
feature and the mechanics behind it.

> Companion docs: [`SETUP.md`](./SETUP.md) (environment + deploy), [`ACCESS.example.md`](./ACCESS.example.md) (onboarding template). Secrets live only in gitignored files (`.env.local`, `supabase-credentials.md`, `ACCESS.md`).

---

## 1. Tech stack at a glance

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript, React 19 |
| Backend | Supabase — Postgres, Auth, Storage, RLS, `pg_cron` |
| Data access | `@supabase/supabase-js` v2 + `@supabase/ssr` (cookie sessions) |
| UI kit | **Base UI** (`@base-ui/react`, base-nova preset) — *not* Radix |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`) |
| i18n | `next-intl`, cookie-based locale (no locale in the URL) |
| Math | KaTeX via a `<MathText>` component (`$…$` delimiters) |
| Forms/validation | `react-hook-form` + `zod` |
| Fonts | Hind Siliguri (UI) + Noto Serif Bengali (`font-bengali-serif`, question bodies) |
| Tests | Vitest (grading logic); RLS/RPC verify scripts under `scripts/` |
| Hosting | Vercel (GitHub-connected); Supabase cloud project `lwyaybsmshckpanmgaln` |

**Base UI notes:** use the `render` prop instead of `asChild`; pass
`nativeButton={false}` when a `Button` renders a `Link`.

---

## 2. Core architecture principle: the server is the only source of truth

Everything that could be cheated is decided in Postgres, never in the browser:

- **Correct answers** live in a separate table (`question_answers`) that has
  **no student-readable RLS policy** — students cannot read it via any query
  path, ever.
- **Answer checking, grading, timing, and ranking** happen inside
  `SECURITY DEFINER` Postgres functions (RPCs). The client calls an RPC and gets
  back only what it's allowed to see at that moment.
- **Exam deadlines** are computed from the database clock (`now()`), not the
  browser clock.
- **One attempt per user per exam** is a `UNIQUE` DB constraint, not an app check.

This means the same logic is reused unchanged by a future native mobile app —
it only needs to call the same RPCs.

---

## 3. Features

### 3.1 Accounts & roles

- **Sign up / log in** with email + password, or **Google OAuth**
  (`src/app/(auth)/login`, `signup`, `auth/callback`).
- A signup DB trigger (`handle_new_user`) auto-creates a `profiles` row, taking
  the name from OAuth metadata or the email prefix.
- Two roles: **`student`** (default) and **`admin`**. A student can edit their
  profile but a trigger (`protect_profile_columns`) silently reverts any attempt
  to change their own `role` or `plan`. A `plan` column ('free') exists for
  future premium tiers.
- Route guards live in `src/lib/auth.ts`: `requireUser()` redirects anonymous
  visitors to `/login`; `requireAdmin()` redirects non-admins away from `/admin`.

### 3.2 Practice mode

Untimed, instant-feedback drilling by subject → topic.

- Browse `/practice` → `/practice/[subject]` → `/practice/[subject]/[topic]`.
- Each answer calls the **`check_practice_answer(question_id, key)`** RPC, which
  logs the attempt to `practice_answers` and returns `{correct_key, is_correct,
  explanation}` — so the correct answer is revealed only *after* you commit,
  and never sits in the page source beforehand.
- Every logged answer feeds the **weak-topic** detector: the `v_user_topic_stats`
  view aggregates accuracy per topic, and the dashboard surfaces topics where
  you've answered ≥2 questions with <60% accuracy.

### 3.3 Model tests (take anytime)

Self-serve timed exams with a personal countdown.

- `/exams` lists available model tests; `/exams/[id]` is the cover page →
  `/exams/[id]/attempt` runs it → `/result` → `/review`.
- **`start_exam_attempt(exam_id)`** creates the attempt, stamps a
  server-computed `deadline` (`now() + duration_minutes`), and returns the
  questions **without** answer keys or explanations. Re-calling it *resumes* the
  same attempt (returns saved answers + remaining time).
- **`save_answer(attempt_id, question_id, key)`** autosaves each choice; it
  rejects writes after `submitted_at` or past the `deadline` (passing `null`
  clears an answer).
- **`submit_attempt(attempt_id)`** grades idempotently: joins the hidden answer
  keys, applies `mark_per_question` and `negative_mark` from the exam
  `pattern`, and fills `correct/wrong/skipped` counts plus a per-subject
  `subject_breakdown`.
- A per-minute **`pg_cron`** job auto-submits attempts whose deadline has passed
  (so an abandoned tab still gets graded).
- **Review** (`/review`) shows each question with the correct key and
  explanation via **`get_attempt_review`** — gated so it's only available *after
  you submit*.

There is a standing **"Full Model Test — Mixed"** (100 balanced questions,
~10 per subject) published with no time window, so any user can sit a full mock
at any time.

### 3.4 Live exams (scheduled + ranked)

Fixed-window exams that everyone sits together, ranked afterward.

- `/live` lists them; `/live/[id]` is a **lobby** with a countdown to
  `starts_at` and a **Realtime Presence** participant count (no live
  leaderboard — that would be a cheat vector and needless load).
- `start_exam_attempt` enforces the window: it refuses before `starts_at` and
  after `ends_at`; a late joiner's deadline is clamped to the exam's `ends_at`
  so everyone stops together.
- After the window closes, **`finalize_live_exam(exam_id)`** force-grades anyone
  who never submitted, assigns ranks with
  `RANK() OVER (ORDER BY score DESC, submitted_at ASC)`, and publishes results.
  A per-minute `pg_cron` job (`auto_finalize_live`) runs it automatically.
- **`get_leaderboard(exam_id)`** returns the top 100 plus your own row —
  and only *after* results are published (`results_published_at`).
- `/live/[id]/leaderboard` shows rankings; review unlocks only post-publish.

### 3.5 Question bank / archive

- `/archive` — filter published questions by **subject, source exam, and year**,
  plus Bangla-friendly substring search (pg_trgm trigram index on the body).
- Filters are URL-param driven (`?subject=…&exam=…&year=…&q=…`) and paginated
  (30/page). Facets (subject list, distinct exams/years) come from
  `getArchiveFacets()`.
- **Reveal-on-tap:** **`reveal_answer(question_id)`** returns the correct key +
  explanation for a *published* question — read-only browsing, so nothing is
  logged and the answer table is never exposed.

### 3.6 Admin panel (`/admin`, role-guarded)

- **Dashboard** — content/exam counts.
- **Questions CRUD** (`/admin/questions`, `/new`, `/[id]`) — editor with live
  **KaTeX preview**, image upload to Supabase Storage, difficulty, source tags,
  and draft/published/archived status. Correct key is written to the separate
  `question_answers` table via an admin RPC.
- **Bulk import** (`/admin/questions/import`) — CSV/JSON parsed with papaparse,
  validated against a preview, committed through a service-role route handler
  (`/api/admin/import`).
- **Taxonomy** (`/admin/taxonomy`) — manage subjects & topics.
- **Exam builder** (`/admin/exams`, `/new`, `/[id]`) — set pattern (duration,
  marks, negative marking), schedule live windows, and pick the question set.
  **`admin_set_exam_questions(exam_id, question_ids[])`** atomically replaces an
  exam's questions, denormalizes each `subject_id`, and syncs
  `pattern.total_questions`.
- **Users** (`/admin/users`) — role management.

### 3.7 Bilingual UI (Bangla ⇄ English)

- Toggle in the nav (`locale-toggle.tsx`) persists locale to a cookie; Bangla is
  the default. No locale segment in URLs.
- UI strings come from `src/i18n/messages/{bn,en}.json` — server components use
  `getTranslations`/`getLocale` (from `next-intl/server`), client components use
  `useTranslations`/`useLocale`.
- **Subject/topic names** switch language via the `localName(row, locale)`
  helper (`src/lib/i18n-name.ts`): returns `name_en` in English mode, else
  `name_bn`. Question *content itself* is shown as authored (not translated).
- **Bangla numerals & dates** everywhere via `src/lib/format.ts`
  (`formatNumberBn`, `formatDateTimeBn`, `formatDurationBn` for the countdown).

### 3.8 Client-side option shuffling

Multiple-choice options are randomized per question in the display
(`src/lib/shuffle.ts`, used by both the exam and practice runners):

- `shuffleOptions(options, questionId)` uses an **FNV-1a seed → mulberry32
  PRNG → Fisher–Yates** shuffle. It's **deterministic per question id** (stable
  across re-renders) and **React-Compiler-purity-safe** — no `Math.random()`
  during render.
- Each option keeps its original `key` (a/b/c/d) for grading, but gets a fresh
  positional **label** so the visible order looks natural. Because grading and
  answer-save always use the original `key`, shuffling is invisible to the
  server — purely cosmetic and cheat-neutral.
- The post-submission review page keeps the original order (read-only).

---

## 4. Database schema

All tables have **RLS enabled**. Migrations in `supabase/migrations/` are the
source of truth (14 files, `20260709000001`–`…000014`).

| Table | Purpose | RLS |
|---|---|---|
| `profiles` | 1:1 with `auth.users`; `role`, `preferred_locale`, `plan` | own row read/update; `role`/`plan` locked by trigger |
| `subjects`, `topics` | Taxonomy (`name_bn`, `name_en`, `slug`, `order_index`) | read: everyone · write: admin |
| `questions` | `body` (may contain `$latex$`), `options` JSONB, `explanation`, `image_url`, source tags, `status`, FTS `search_vector`, trigram index, `content_hash` (idempotent import) | students read **published** only · write: admin |
| **`question_answers`** | `question_id` → `correct_key`. **The anti-cheat linchpin.** | **admin-only — no student policy exists** |
| `exams` | `type` model/live, `pattern` JSONB, `starts_at`/`ends_at`, `status`, `results_published_at` | students see scheduled/published/archived · write: admin |
| `exam_questions` | Which questions are in an exam, `order_index`, denormalized `subject_id` | **admin-only** — delivered to students only via RPC |
| `exam_attempts` | One per user/exam (`UNIQUE`), server `deadline`, `score`, counts, `subject_breakdown`, `rank` | students read own · **no write policy** (RPC-only) |
| `attempt_answers` | Saved answers per attempt | admin-only direct; students via RPC |
| `practice_answers` | Append-only practice log; feeds `v_user_topic_stats` | students read/insert own |

### SECURITY DEFINER RPCs (the only tamper-proof write path)

| RPC | Does |
|---|---|
| `is_admin()` | Role check used by every admin policy (avoids recursive RLS) |
| `check_practice_answer(qid, key)` | Logs practice answer; returns correct key + explanation |
| `reveal_answer(qid)` | Archive reveal for a published question (no logging) |
| `start_exam_attempt(exam_id)` | Validates window/uniqueness, computes server deadline, returns answer-free questions (resumes if exists) |
| `save_answer(attempt_id, qid, key)` | Ownership + `now() < deadline` + not-submitted checks; upsert/clear |
| `submit_attempt(attempt_id)` | Idempotent grading via `_grade_attempt` |
| `_grade_attempt(attempt_id)` | Internal grader: negative marking + subject breakdown |
| `get_attempt_review(attempt_id)` | Answers/explanations — gated post-submit (model) / post-publish (live) |
| `finalize_live_exam(exam_id)` | Grade stragglers, rank, publish — admin anytime, else only after `ends_at` |
| `get_leaderboard(exam_id)` | Top 100 + own row; only after results published |
| `auto_finalize_live()` | `pg_cron` per-minute finalize of ended live exams |
| `admin_set_exam_questions(exam_id, ids[])` | Atomically set an exam's question set + total |

---

## 5. Code map

```
src/
├── app/
│   ├── (auth)/         login, signup, auth/callback
│   ├── (student)/      dashboard, practice/*, exams/*, live/*, archive, profile
│   ├── (admin)/admin/  dashboard, questions/*, exams/*, taxonomy, users
│   └── api/admin/import  service-role bulk import
├── components/
│   ├── exam/           exam-runner.tsx (countdown, palette, autosave), live-lobby.tsx
│   ├── practice/       practice-runner.tsx (instant reveal)
│   ├── math/           MathText (KaTeX)
│   ├── admin/, archive/, auth/, nav/, ui/ (Base UI wrappers)
│   └── locale-toggle.tsx
├── lib/
│   ├── auth.ts         getProfile / requireUser / requireAdmin
│   ├── supabase/       client.ts (browser), server.ts (SSR), middleware.ts
│   ├── queries/        archive.ts, stats.ts, taxonomy.ts
│   ├── questions.ts    zod schemas + QuestionOption/QuestionInput types
│   ├── scoring.ts      pure grader mirroring _grade_attempt (unit-tested)
│   ├── scoring.test.ts Vitest grading tests (negative-marking edges)
│   ├── shuffle.ts      deterministic option shuffle
│   ├── i18n-name.ts    localName(row, locale)
│   ├── format.ts       Bangla numerals / dates / duration
│   ├── exams.ts, import.ts, utils.ts
│   └── ...
└── i18n/messages/      bn.json, en.json
```

**Grading is defined twice on purpose:** `_grade_attempt` (SQL) is authoritative;
`src/lib/scoring.ts` mirrors the exact formula for Vitest tests and any
client-side estimate. Keep the two in sync.

---

## 6. Seed data & scripts

- **`data/questions/*.json`** — canonical question set (~282 questions), also the
  admin bulk-import format. Files: real BCS PYQs (`bcs-pyq-batch2`,
  `bcs-sample`), mixed Bank/Primary/NTRCA (`mixed-jobs-batch3`), and
  topic-generated sets across all subjects (`gen-bangla`, `gen-english`,
  `gen-math`, `gen-gkbd`, `gen-gkintl`, `gen-science`, `gen-ict`,
  `gen-mental-ethics`, `gen-geography`).
- **`scripts/` (Node ESM, service-role):**
  - `seed-questions.mjs` — idempotent import (dedupes on
    `content_hash = sha256(source_exam::body)`).
  - `seed-standing-exam.mjs` — publishes the always-open 100Q "Full Model Test —
    Mixed", balanced ~10 per subject.
  - `seed-demo-exam.mjs`, `seed-live-demo.mjs` — demo model/live exams.
  - `create-admin.mjs` — promote a user to admin.
  - `verify-exam.mjs`, `verify-live.mjs`, `verify-rls.mjs` — tamper/RLS checks
    (e.g. a student cannot `SELECT question_answers`, cannot save past deadline,
    cannot mutate their own score/role).

---

## 7. Anti-cheat summary

1. Correct answers are unreachable by students at any time (separate table,
   admin-only RLS).
2. Exam questions are delivered *only* through `start_exam_attempt`, and never
   before a live exam's `starts_at` (`exam_questions` is admin-only).
3. The attempt `deadline` is server-authoritative; `save_answer` rejects
   late/post-submit writes.
4. One attempt per user is a DB `UNIQUE` constraint.
5. Scores/ranks have no student write policy — set only by RPCs.
6. Review and leaderboards are gated until submit / results-publish.
7. Client option shuffling is cosmetic (keyed grading), adding a small
   screenshot-sharing deterrent without affecting correctness.

**Out of scope for v1** (documented, not implemented): tab-switch detection,
proctoring.

---

## 8. Deployment

- **Vercel**, GitHub-connected. `NEXT_PUBLIC_*` env vars are inlined at **build
  time** — a config change needs a fresh rebuild (a cache-reused redeploy won't
  pick them up).
- Env vars set in Vercel: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
  `SUPABASE_DB_PASSWORD` is **local-only** — never in Vercel.
- Supabase Auth needs Site URL + redirect allow-list pointing at the Vercel
  domain (see `SETUP.md`).
- Migrations apply via `supabase db push`; types regenerate with
  `supabase gen types typescript`.
</content>
</invoke>
