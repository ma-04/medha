-- Teacher role: a third role that can author content (subjects, topics,
-- questions, answer keys) and run exams (build question sets, finalize live
-- exams) — but CANNOT manage users. User management stays admin-only, enforced
-- by is_admin() remaining the gate on the profiles policies and the
-- protect_profile_columns() trigger.
--
-- The content/exam write path is repointed from is_admin() to a new can_author()
-- helper (admin OR teacher).

-- Allow 'teacher' as a role value.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('student', 'teacher', 'admin'));

-- Staff check: admin or teacher. SECURITY DEFINER, mirroring is_admin().
create or replace function public.can_author()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'teacher')
  );
$$;

-- --- Content policies: subjects, topics, questions, answer keys ---------------
alter policy "subjects_admin_write" on public.subjects
  using (public.can_author()) with check (public.can_author());

alter policy "topics_admin_write" on public.topics
  using (public.can_author()) with check (public.can_author());

alter policy "questions_read_published" on public.questions
  using (status = 'published' or public.can_author());
alter policy "questions_admin_write" on public.questions
  using (public.can_author()) with check (public.can_author());

alter policy "answers_admin_only" on public.question_answers
  using (public.can_author()) with check (public.can_author());

-- --- Exam policies -----------------------------------------------------------
alter policy "exams_read_visible" on public.exams
  using (status in ('scheduled', 'published', 'archived') or public.can_author());
alter policy "exams_admin_write" on public.exams
  using (public.can_author()) with check (public.can_author());

alter policy "exam_questions_admin_only" on public.exam_questions
  using (public.can_author()) with check (public.can_author());

alter policy "attempt_answers_admin_only" on public.attempt_answers
  using (public.can_author()) with check (public.can_author());

-- --- Storage: question images ------------------------------------------------
alter policy "question_images_admin_insert" on storage.objects
  with check (bucket_id = 'question-images' and public.can_author());
alter policy "question_images_admin_update" on storage.objects
  using (bucket_id = 'question-images' and public.can_author());
alter policy "question_images_admin_delete" on storage.objects
  using (bucket_id = 'question-images' and public.can_author());

-- --- RPCs: repoint the is_admin() gate to can_author() -----------------------
-- Bodies are reproduced verbatim from their defining migrations, with the sole
-- change being the authorization check.

-- admin_upsert_question (from 20260709000006)
create or replace function public.admin_upsert_question(
  p_topic_id uuid,
  p_body text,
  p_options jsonb,
  p_correct_key text,
  p_id uuid default null,
  p_explanation text default null,
  p_image_url text default null,
  p_difficulty smallint default null,
  p_source_exam text default null,
  p_source_year smallint default null,
  p_source_label text default null,
  p_status text default 'draft'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.can_author() then
    raise exception 'not authorized';
  end if;

  if p_id is null then
    insert into public.questions (
      topic_id, body, options, explanation, image_url, difficulty,
      source_exam, source_year, source_label, status, created_by
    ) values (
      p_topic_id, p_body, p_options, p_explanation, p_image_url, p_difficulty,
      p_source_exam, p_source_year, p_source_label, p_status, auth.uid()
    )
    returning id into v_id;
  else
    update public.questions set
      topic_id = p_topic_id,
      body = p_body,
      options = p_options,
      explanation = p_explanation,
      image_url = p_image_url,
      difficulty = p_difficulty,
      source_exam = p_source_exam,
      source_year = p_source_year,
      source_label = p_source_label,
      status = p_status
    where id = p_id
    returning id into v_id;
  end if;

  insert into public.question_answers (question_id, correct_key)
  values (v_id, p_correct_key)
  on conflict (question_id) do update set correct_key = excluded.correct_key;

  return v_id;
end;
$$;

-- admin_set_exam_questions (from 20260709000011)
create or replace function public.admin_set_exam_questions(
  p_exam_id uuid,
  p_question_ids uuid[]
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not public.can_author() then
    raise exception 'not authorized';
  end if;

  delete from public.exam_questions where exam_id = p_exam_id;

  insert into public.exam_questions (exam_id, question_id, subject_id, order_index)
  select
    p_exam_id,
    qid,
    t.subject_id,
    ord - 1
  from unnest(p_question_ids) with ordinality as u(qid, ord)
  join public.questions q on q.id = u.qid
  join public.topics t on t.id = q.topic_id;

  select count(*) into v_count
  from public.exam_questions where exam_id = p_exam_id;

  update public.exams
  set pattern = jsonb_set(pattern, '{total_questions}', to_jsonb(v_count))
  where id = p_exam_id;

  return v_count;
end;
$$;

-- finalize_live_exam (from 20260709000013) — teachers may finalize/publish
-- results for exams they run. The ends_at gate still prevents early leaks for
-- non-staff callers (cron).
create or replace function public.finalize_live_exam(p_exam_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exam public.exams;
  v_id uuid;
  v_ranked int;
begin
  select * into v_exam from public.exams where id = p_exam_id;
  if v_exam.id is null then
    raise exception 'exam not found';
  end if;
  if v_exam.type <> 'live' then
    raise exception 'not a live exam';
  end if;
  if not public.can_author()
     and (v_exam.ends_at is null or now() < v_exam.ends_at) then
    raise exception 'exam has not ended';
  end if;

  -- Grade anyone who never submitted.
  for v_id in
    select id from public.exam_attempts
    where exam_id = p_exam_id and submitted_at is null
  loop
    perform public._grade_attempt(v_id);
  end loop;

  -- Rank by score desc, earlier submission breaking ties.
  with ranked as (
    select id, rank() over (
      order by score desc nulls last, submitted_at asc
    ) as r
    from public.exam_attempts
    where exam_id = p_exam_id
  )
  update public.exam_attempts a
  set rank = ranked.r
  from ranked
  where a.id = ranked.id;

  select count(*) into v_ranked
  from public.exam_attempts where exam_id = p_exam_id;

  update public.exams
  set results_published_at = coalesce(results_published_at, now()),
      status = 'published'
  where id = p_exam_id;

  return v_ranked;
end;
$$;
