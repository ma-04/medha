-- Timed exams: model exams (take anytime, personal countdown) and live exams
-- (fixed window, ranked afterward). Questions are delivered ONLY through the
-- start_exam_attempt RPC (migration 0011) — exam_questions is admin-only so a
-- student can never enumerate an exam's questions ahead of a live sitting.

-- Exams ---------------------------------------------------------------------
-- pattern jsonb: { duration_minutes, negative_mark, mark_per_question,
--                  total_questions }
create table public.exams (
  id uuid primary key default gen_random_uuid(),
  title_bn text not null,
  title_en text not null,
  description text,
  type text not null default 'model'
    check (type in ('model', 'live')),
  pattern jsonb not null default
    '{"duration_minutes": 30, "negative_mark": 0.25, "mark_per_question": 1, "total_questions": 0}'::jsonb,
  starts_at timestamptz,   -- live only
  ends_at timestamptz,     -- live only
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'published', 'archived')),
  results_published_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index exams_status_idx on public.exams (status);
create index exams_type_starts_idx on public.exams (type, starts_at);

create trigger exams_touch
  before update on public.exams
  for each row execute function public.touch_updated_at();

-- Which questions belong to an exam, and in what order. subject_id is
-- denormalized so per-subject breakdowns don't need a questions join.
create table public.exam_questions (
  exam_id uuid not null references public.exams(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  order_index int not null default 0,
  primary key (exam_id, question_id)
);
create index exam_questions_exam_idx on public.exam_questions (exam_id, order_index);

-- One attempt per user per exam. deadline is server-computed at start.
create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  deadline timestamptz not null,
  submitted_at timestamptz,
  score numeric(8, 2),
  correct_count int,
  wrong_count int,
  skipped_count int,
  subject_breakdown jsonb,
  rank int,
  unique (exam_id, user_id)
);
create index exam_attempts_exam_idx on public.exam_attempts (exam_id);
create index exam_attempts_user_idx on public.exam_attempts (user_id);
-- For cron auto-submit: unsubmitted attempts past their deadline.
create index exam_attempts_open_idx on public.exam_attempts (deadline)
  where submitted_at is null;

-- Saved answers during an attempt. Written only via save_answer RPC.
create table public.attempt_answers (
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  selected_key text not null,
  answered_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

-- RLS -----------------------------------------------------------------------
alter table public.exams enable row level security;
alter table public.exam_questions enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.attempt_answers enable row level security;

-- Exams: students see scheduled/published/archived; admins see everything.
create policy "exams_read_visible" on public.exams
  for select using (
    status in ('scheduled', 'published', 'archived') or public.is_admin()
  );
create policy "exams_admin_write" on public.exams
  for all using (public.is_admin()) with check (public.is_admin());

-- Exam questions: ADMIN ONLY. Students receive questions solely via the
-- start_exam_attempt RPC (SECURITY DEFINER), never by reading this table.
create policy "exam_questions_admin_only" on public.exam_questions
  for all using (public.is_admin()) with check (public.is_admin());

-- Attempts: a user can read their own; admins read all. Inserts/updates go
-- through SECURITY DEFINER RPCs, so no student write policy exists (score,
-- deadline and rank are therefore untamperable from the client).
create policy "attempts_own_read" on public.exam_attempts
  for select using (user_id = auth.uid() or public.is_admin());

-- Attempt answers: ADMIN ONLY for direct access; students read/write them only
-- through the exam RPCs (which enforce deadline + ownership).
create policy "attempt_answers_admin_only" on public.attempt_answers
  for all using (public.is_admin()) with check (public.is_admin());
