-- Exam engine RPCs. All are SECURITY DEFINER: they enforce ownership, the
-- server-authoritative deadline, and result gating themselves — the client is
-- never trusted with answer keys, scores, or timing.

-- Start (or resume) an attempt. Returns the attempt, the server clock, saved
-- answers, and the answer-free question list. --------------------------------
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

  -- Resume if an attempt already exists, else create one with a server deadline.
  select * into v_attempt
  from public.exam_attempts where exam_id = p_exam_id and user_id = v_uid;

  if v_attempt.id is null then
    v_duration := coalesce((v_exam.pattern->>'duration_minutes')::int, 30);
    if v_exam.type = 'live' then
      -- Everyone stops at the exam's end; a late joiner just gets less time.
      v_deadline := least(now() + make_interval(mins => v_duration), v_exam.ends_at);
    else
      v_deadline := now() + make_interval(mins => v_duration);
    end if;

    insert into public.exam_attempts (exam_id, user_id, deadline)
    values (p_exam_id, v_uid, v_deadline)
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

-- Save (or clear, when p_selected_key is null) one answer. -------------------
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
  if now() >= v_attempt.deadline then
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

-- Internal grader: no auth check (callers gate access). Idempotent — grading an
-- already-submitted attempt just recomputes the same numbers. --------------
create or replace function public._grade_attempt(p_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.exam_attempts;
  v_pattern jsonb;
  v_mark numeric;
  v_neg numeric;
  v_correct int;
  v_wrong int;
  v_total int;
  v_score numeric;
  v_breakdown jsonb;
begin
  select * into v_attempt from public.exam_attempts where id = p_attempt_id;
  if v_attempt.id is null then
    raise exception 'attempt not found';
  end if;

  select pattern into v_pattern from public.exams where id = v_attempt.exam_id;
  v_mark := coalesce((v_pattern->>'mark_per_question')::numeric, 1);
  v_neg := coalesce((v_pattern->>'negative_mark')::numeric, 0);

  select count(*) into v_total
  from public.exam_questions where exam_id = v_attempt.exam_id;

  -- Correct / wrong over answered questions.
  select
    count(*) filter (where aa.selected_key = qa.correct_key),
    count(*) filter (where aa.selected_key <> qa.correct_key)
  into v_correct, v_wrong
  from public.attempt_answers aa
  join public.question_answers qa on qa.question_id = aa.question_id
  where aa.attempt_id = p_attempt_id;

  v_correct := coalesce(v_correct, 0);
  v_wrong := coalesce(v_wrong, 0);
  v_score := v_correct * v_mark - v_wrong * v_neg;

  -- Per-subject breakdown keyed by subject_id.
  select coalesce(jsonb_object_agg(subject_id, counts), '{}'::jsonb)
  into v_breakdown
  from (
    select
      eq.subject_id,
      jsonb_build_object(
        'total', count(*),
        'correct', count(*) filter (where aa.selected_key = qa.correct_key),
        'wrong', count(*) filter (
          where aa.selected_key is not null and aa.selected_key <> qa.correct_key),
        'skipped', count(*) filter (where aa.selected_key is null)
      ) as counts
    from public.exam_questions eq
    join public.question_answers qa on qa.question_id = eq.question_id
    left join public.attempt_answers aa
      on aa.attempt_id = p_attempt_id and aa.question_id = eq.question_id
    where eq.exam_id = v_attempt.exam_id
    group by eq.subject_id
  ) s;

  update public.exam_attempts set
    submitted_at = coalesce(submitted_at, now()),
    score = v_score,
    correct_count = v_correct,
    wrong_count = v_wrong,
    skipped_count = v_total - v_correct - v_wrong,
    subject_breakdown = v_breakdown
  where id = p_attempt_id;
end;
$$;

-- Submit an attempt (user-initiated). Idempotent. ---------------------------
create or replace function public.submit_attempt(p_attempt_id uuid)
returns jsonb
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

  if v_attempt.submitted_at is null then
    perform public._grade_attempt(p_attempt_id);
    select * into v_attempt from public.exam_attempts where id = p_attempt_id;
  end if;

  return jsonb_build_object(
    'attempt_id', v_attempt.id,
    'score', v_attempt.score,
    'correct_count', v_attempt.correct_count,
    'wrong_count', v_attempt.wrong_count,
    'skipped_count', v_attempt.skipped_count,
    'subject_breakdown', v_attempt.subject_breakdown,
    'submitted_at', v_attempt.submitted_at
  );
end;
$$;

-- Per-question review with correct keys + explanations. Gated: model exams
-- after the user submits; live exams only once results are published. --------
create or replace function public.get_attempt_review(p_attempt_id uuid)
returns table (
  question_id uuid,
  order_index int,
  subject_id uuid,
  body text,
  options jsonb,
  image_url text,
  explanation text,
  selected_key text,
  correct_key text,
  is_correct boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_attempt public.exam_attempts;
  v_exam public.exams;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_attempt from public.exam_attempts where id = p_attempt_id;
  if v_attempt.id is null or (v_attempt.user_id <> v_uid and not public.is_admin()) then
    raise exception 'attempt not found';
  end if;

  select * into v_exam from public.exams where id = v_attempt.exam_id;

  if v_exam.type = 'live' then
    if v_exam.results_published_at is null and not public.is_admin() then
      raise exception 'results not published yet';
    end if;
  else
    if v_attempt.submitted_at is null and not public.is_admin() then
      raise exception 'attempt not submitted yet';
    end if;
  end if;

  return query
  select
    q.id,
    eq.order_index,
    eq.subject_id,
    q.body,
    q.options,
    q.image_url,
    q.explanation,
    aa.selected_key,
    qa.correct_key,
    (aa.selected_key is not null and aa.selected_key = qa.correct_key)
  from public.exam_questions eq
  join public.questions q on q.id = eq.question_id
  join public.question_answers qa on qa.question_id = eq.question_id
  left join public.attempt_answers aa
    on aa.attempt_id = p_attempt_id and aa.question_id = eq.question_id
  where eq.exam_id = v_attempt.exam_id
  order by eq.order_index;
end;
$$;

-- Admin helper: replace an exam's full question set atomically and sync the
-- pattern's total_questions. Keeps subject_id denormalization consistent. -----
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
  if not public.is_admin() then
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
