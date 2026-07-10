-- Per-attempt question and option shuffling.
--
-- Before this, the option order was scrambled on the client from a seed of the
-- question id, so every student saw the same scramble forever, practice and the
-- model test agreed, and a retry was positionally identical to the first try.
-- The order is now derived server-side from md5(attempt_id || question_id[ || key]),
-- which is unique per attempt and costs nothing to store: the seed is the
-- primary key. Measured at ~+3 ms on a 100-question exam, once per attempt.
-- save_answer, the per-tap hot path, is untouched.
--
-- Two per-exam flags gate it, both defaulting to true:
--   pattern.shuffle_questions, pattern.shuffle_options
-- When a flag is false every `case` yields null, all rows tie, and the tiebreak
-- (eq.order_index / the jsonb array's ordinality) restores the authored order.
--
-- md5() is built in (no pgcrypto) and stable across Postgres major versions,
-- unlike hashtext(), which is not and would silently reorder old reviews on an
-- upgrade.
--
-- THE EXPRESSION IS FROZEN. Order is derived, never stored, so editing the seed
-- or the sort would retroactively change how already-completed attempts render
-- in review — the student would see a different arrangement than the one they
-- sat. Scores are safe either way (_grade_attempt joins on the option key, never
-- a position), but the display must not drift. If it ever has to change, add a
-- shuffle_version column to exam_attempts and branch on it.
--
-- get_attempt_review MUST keep using the identical expression keyed on its own
-- attempt id; that is the only thing making the review agree with the runner.
--
-- Same reasoning applies to the flags themselves: they are read live, not
-- snapshotted onto the attempt, so flipping one re-orders how already-submitted
-- attempts render in review. The review stays internally consistent (it
-- highlights by option key, and numbers by position), but a student comparing
-- against memory would see a different arrangement. Snapshotting the flags onto
-- exam_attempts would fix that, at the price of a column.

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
  v_shuffle_q boolean;
  v_shuffle_o boolean;
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

  v_shuffle_q := coalesce((v_exam.pattern->>'shuffle_questions')::boolean, true);
  v_shuffle_o := coalesce((v_exam.pattern->>'shuffle_options')::boolean, true);

  -- Answer-free questions, shuffled for this attempt. Resuming re-derives the
  -- same order from the same attempt id, so a reload does not reshuffle.
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', x.id,
      'order_index', x.order_index,
      'subject_id', x.subject_id,
      'body', x.body,
      'options', x.options,
      'image_url', x.image_url,
      'source_label', x.source_label
    ) order by x.sort_key, x.order_index
  ), '[]'::jsonb)
  into v_questions
  from (
    select
      q.id,
      eq.order_index,
      eq.subject_id,
      q.body,
      q.image_url,
      q.source_label,
      case when v_shuffle_q
           then md5(v_attempt.id::text || q.id::text) end as sort_key,
      (
        select jsonb_agg(o order by
                 case when v_shuffle_o
                      then md5(v_attempt.id::text || q.id::text || (o->>'key')) end,
                 ord)
        from jsonb_array_elements(q.options) with ordinality t(o, ord)
      ) as options
    from public.exam_questions eq
    join public.questions q on q.id = eq.question_id
    where eq.exam_id = p_exam_id
  ) x;

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

-- Same order, same seed, keyed on the attempt being reviewed.
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
  v_shuffle_q boolean;
  v_shuffle_o boolean;
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

  v_shuffle_q := coalesce((v_exam.pattern->>'shuffle_questions')::boolean, true);
  v_shuffle_o := coalesce((v_exam.pattern->>'shuffle_options')::boolean, true);

  return query
  select
    q.id,
    eq.order_index,
    eq.subject_id,
    q.body,
    (
      select jsonb_agg(o order by
               case when v_shuffle_o
                    then md5(p_attempt_id::text || q.id::text || (o->>'key')) end,
               ord)
      from jsonb_array_elements(q.options) with ordinality t(o, ord)
    ),
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
  order by
    case when v_shuffle_q then md5(p_attempt_id::text || q.id::text) end,
    eq.order_index;
end;
$$;
