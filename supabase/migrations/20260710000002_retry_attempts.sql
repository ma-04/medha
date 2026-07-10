-- Retryable model tests. A model exam may allow up to `max_attempts` tries per
-- student (default 1 = today's once-only behavior). Each try is kept as its own
-- exam_attempts row, keyed by attempt_number, so full score history survives.

-- 1. Per-exam cap. Live exams stay at 1 (enforced in the app + retry RPC).
alter table public.exams
  add column max_attempts int not null default 1
  check (max_attempts between 1 and 20);

-- 2. Attempts become multi-row per (exam, user).
alter table public.exam_attempts
  add column attempt_number int not null default 1;

-- 3. Swap the once-only unique constraint for one that admits multiple attempts.
alter table public.exam_attempts
  drop constraint if exists exam_attempts_exam_id_user_id_key;
alter table public.exam_attempts
  add constraint exam_attempts_exam_id_user_id_attempt_key
  unique (exam_id, user_id, attempt_number);

-- 4. start_exam_attempt now resumes the LATEST attempt (highest attempt_number)
-- rather than "the" attempt. A submitted latest is returned as-is (the attempt
-- page redirects to its result) — it never silently opens a fresh retake; that
-- is the explicit job of retry_exam_attempt below.
create or replace function public.start_exam_attempt(p_exam_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_exam public.exams;
  v_attempt public.exam_attempts;
  v_duration int;
  v_deadline timestamptz;
  v_questions jsonb;
  v_answers jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_exam from public.exams where id = p_exam_id;
  if v_exam.id is null then
    raise exception 'exam not found';
  end if;

  -- Availability window.
  if v_exam.type = 'model' then
    if v_exam.status <> 'published' then
      raise exception 'exam not available';
    end if;
  else -- live
    if v_exam.status not in ('scheduled', 'published') then
      raise exception 'exam not available';
    end if;
    if v_exam.starts_at is null or now() < v_exam.starts_at then
      raise exception 'exam has not started';
    end if;
    if v_exam.ends_at is not null and now() >= v_exam.ends_at then
      raise exception 'exam has ended';
    end if;
  end if;

  -- Resume the latest attempt if one exists, else create attempt #1.
  select * into v_attempt
  from public.exam_attempts
  where exam_id = p_exam_id and user_id = v_uid
  order by attempt_number desc
  limit 1;

  if v_attempt.id is null then
    v_duration := coalesce((v_exam.pattern->>'duration_minutes')::int, 30);
    if v_exam.type = 'live' then
      -- Everyone stops at the exam's end; a late joiner just gets less time.
      v_deadline := least(now() + make_interval(mins => v_duration), v_exam.ends_at);
    else
      v_deadline := now() + make_interval(mins => v_duration);
    end if;

    insert into public.exam_attempts (exam_id, user_id, deadline, attempt_number)
    values (p_exam_id, v_uid, v_deadline, 1)
    returning * into v_attempt;
  end if;

  -- Answer-free questions in exam order.
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', q.id,
      'order_index', eq.order_index,
      'subject_id', eq.subject_id,
      'body', q.body,
      'options', q.options,
      'image_url', q.image_url,
      'source_label', q.source_label
    ) order by eq.order_index
  ), '[]'::jsonb)
  into v_questions
  from public.exam_questions eq
  join public.questions q on q.id = eq.question_id
  where eq.exam_id = p_exam_id;

  -- Any answers already saved (for resume).
  select coalesce(jsonb_object_agg(question_id, selected_key), '{}'::jsonb)
  into v_answers
  from public.attempt_answers where attempt_id = v_attempt.id;

  return jsonb_build_object(
    'attempt_id', v_attempt.id,
    'deadline', v_attempt.deadline,
    'submitted_at', v_attempt.submitted_at,
    'server_now', now(),
    'answers', v_answers,
    'questions', v_questions
  );
end;
$$;

-- 5. Explicit retry entry point for model tests. Creates the next attempt when
-- the cap allows and the latest attempt is already submitted. SECURITY DEFINER
-- so it can enforce the cap server-side and bypass the insert RLS.
create or replace function public.retry_exam_attempt(p_exam_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_exam public.exams;
  v_latest public.exam_attempts;
  v_count int;
  v_duration int;
  v_deadline timestamptz;
  v_attempt public.exam_attempts;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_exam from public.exams where id = p_exam_id;
  if v_exam.id is null then
    raise exception 'exam not found';
  end if;
  if v_exam.type <> 'model' then
    raise exception 'retry not allowed';
  end if;
  if v_exam.status <> 'published' then
    raise exception 'exam not available';
  end if;

  select * into v_latest
  from public.exam_attempts
  where exam_id = p_exam_id and user_id = v_uid
  order by attempt_number desc
  limit 1;

  if v_latest.id is null then
    raise exception 'no attempt to retry';
  end if;
  if v_latest.submitted_at is null then
    raise exception 'finish your current attempt first';
  end if;

  select count(*) into v_count
  from public.exam_attempts
  where exam_id = p_exam_id and user_id = v_uid;

  if v_count >= v_exam.max_attempts then
    raise exception 'no attempts left';
  end if;

  v_duration := coalesce((v_exam.pattern->>'duration_minutes')::int, 30);
  v_deadline := now() + make_interval(mins => v_duration);

  insert into public.exam_attempts (exam_id, user_id, deadline, attempt_number)
  values (p_exam_id, v_uid, v_deadline, v_latest.attempt_number + 1)
  returning * into v_attempt;

  return jsonb_build_object(
    'attempt_id', v_attempt.id,
    'attempt_number', v_attempt.attempt_number
  );
end;
$$;
