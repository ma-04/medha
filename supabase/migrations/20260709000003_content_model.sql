-- Content model: subjects, topics, questions, and the answer-key table.
-- Correct answers live in a separate admin-only table (question_answers) so
-- students can never read them, at any time, via any query path.

create extension if not exists pg_trgm;

-- Subjects (e.g. বাংলা, English, গণিত) --------------------------------------
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  name_bn text not null,
  name_en text not null,
  slug text not null unique,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

-- Topics within a subject ---------------------------------------------------
create table public.topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  name_bn text not null,
  name_en text not null,
  slug text not null,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  unique (subject_id, slug)
);
create index topics_subject_idx on public.topics (subject_id);

-- Questions -----------------------------------------------------------------
-- options is JSONB: [{ "key": "a", "text": "..." }, ...]
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete restrict,
  body text not null,
  options jsonb not null,
  explanation text,
  image_url text,
  difficulty smallint check (difficulty between 1 and 3),
  source_exam text,
  source_year smallint,
  source_label text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  content_hash text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as
    (to_tsvector('simple', coalesce(body, ''))) stored
);
create index questions_topic_idx on public.questions (topic_id);
create index questions_status_idx on public.questions (status);
create index questions_source_idx on public.questions (source_exam, source_year);
create index questions_search_idx on public.questions using gin (search_vector);
create index questions_body_trgm_idx on public.questions using gin (body gin_trgm_ops);
create unique index questions_hash_idx on public.questions (content_hash)
  where content_hash is not null;

-- Answer key: separate table, admin-only reads ------------------------------
create table public.question_answers (
  question_id uuid primary key
    references public.questions(id) on delete cascade,
  correct_key text not null
);

-- updated_at maintenance
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger questions_touch
  before update on public.questions
  for each row execute function public.touch_updated_at();

-- RLS -----------------------------------------------------------------------
alter table public.subjects enable row level security;
alter table public.topics enable row level security;
alter table public.questions enable row level security;
alter table public.question_answers enable row level security;

-- Subjects & topics: readable by everyone, writable by admins.
create policy "subjects_read" on public.subjects
  for select using (true);
create policy "subjects_admin_write" on public.subjects
  for all using (public.is_admin()) with check (public.is_admin());

create policy "topics_read" on public.topics
  for select using (true);
create policy "topics_admin_write" on public.topics
  for all using (public.is_admin()) with check (public.is_admin());

-- Questions: students read only published ones; admins read/write all.
create policy "questions_read_published" on public.questions
  for select using (status = 'published' or public.is_admin());
create policy "questions_admin_write" on public.questions
  for all using (public.is_admin()) with check (public.is_admin());

-- Answer key: ADMIN ONLY. No student-readable policy exists. Answer checking
-- and reveals go exclusively through SECURITY DEFINER RPCs.
create policy "answers_admin_only" on public.question_answers
  for all using (public.is_admin()) with check (public.is_admin());
