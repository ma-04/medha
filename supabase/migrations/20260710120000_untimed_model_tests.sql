-- Untimed model tests. `pattern.timed` (default true) turns the countdown off
-- for a model exam; the attempt then carries a null deadline, which is what the
-- rest of the system keys on. Live exams are always timed — they are bounded by
-- exams.ends_at, and an untimed live exam has no coherent meaning.

alter table public.exam_attempts alter column deadline drop not null;

comment on column public.exam_attempts.deadline is
  'When the attempt stops accepting answers. Null = untimed (model exams with pattern.timed = false); such an attempt is never auto-submitted.';

-- start_exam_attempt: same as 20260710000002, except v_deadline may be null.
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
    elsif coalesce((v_exam.pattern->>'timed')::boolean, true) then
      v_deadline := now() + make_interval(mins => v_duration);
    else
      v_deadline := null;
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
    'started_at', v_attempt.started_at,
    'submitted_at', v_attempt.submitted_at,
    'server_now', now(),
    'answers', v_answers,
    'questions', v_questions
  );
end;
$$;

-- retry_exam_attempt: the retry must honour the same timed flag as attempt #1.
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

  if coalesce((v_exam.pattern->>'timed')::boolean, true) then
    v_duration := coalesce((v_exam.pattern->>'duration_minutes')::int, 30);
    v_deadline := now() + make_interval(mins => v_duration);
  else
    v_deadline := null;
  end if;

  insert into public.exam_attempts (exam_id, user_id, deadline, attempt_number)
  values (p_exam_id, v_uid, v_deadline, v_latest.attempt_number + 1)
  returning * into v_attempt;

  return jsonb_build_object(
    'attempt_id', v_attempt.id,
    'attempt_number', v_attempt.attempt_number
  );
end;
$$;

-- save_answer: `now() >= null` is null, not false, so the bare comparison would
-- already have fallen through — but say it explicitly, because a reader must be
-- able to see that an untimed attempt is intentionally never past its deadline.
create or replace function public.save_answer(
  p_attempt_id uuid,
  p_question_id uuid,
  p_selected_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_attempt public.exam_attempts;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_attempt from public.exam_attempts where id = p_attempt_id;
  if v_attempt.id is null or v_attempt.user_id <> v_uid then
    raise exception 'attempt not found';
  end if;
  if v_attempt.submitted_at is not null then
    raise exception 'attempt already submitted';
  end if;
  if v_attempt.deadline is not null and now() >= v_attempt.deadline then
    raise exception 'time is up';
  end if;

  -- Only questions that belong to this exam are writable.
  if not exists (
    select 1 from public.exam_questions
    where exam_id = v_attempt.exam_id and question_id = p_question_id
  ) then
    raise exception 'question not in exam';
  end if;

  if p_selected_key is null then
    delete from public.attempt_answers
    where attempt_id = p_attempt_id and question_id = p_question_id;
  else
    insert into public.attempt_answers (attempt_id, question_id, selected_key)
    values (p_attempt_id, p_question_id, p_selected_key)
    on conflict (attempt_id, question_id)
    do update set selected_key = excluded.selected_key, answered_at = now();
  end if;
end;
$$;

-- auto_submit_expired: an untimed attempt has no expiry and must never be swept.
create or replace function public.auto_submit_expired()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  for v_id in
    select id from public.exam_attempts
    where submitted_at is null
      and deadline is not null
      and now() >= deadline
  loop
    perform public._grade_attempt(v_id);
  end loop;
end;
$$;

-- The revoke in 20260710100838 is per-function-identity, and `create or replace`
-- preserves the ACL, so auto_submit_expired stays unreachable from anon and
-- authenticated. Re-assert it anyway: a future `drop function` + `create` here
-- would silently restore the default PUBLIC EXECUTE grant.
revoke all on function public.auto_submit_expired() from public, anon, authenticated;
