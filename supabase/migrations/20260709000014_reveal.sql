-- Archive reveal-on-tap: return a published question's answer key + explanation
-- without ever exposing question_answers to the client. Read-only (browsing the
-- archive is not a graded attempt, so nothing is logged).
create or replace function public.reveal_answer(p_question_id uuid)
returns table (correct_key text, explanation text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select q.status into v_status
  from public.questions q where q.id = p_question_id;
  if v_status is null then
    raise exception 'question not found';
  end if;
  if v_status <> 'published' then
    raise exception 'question not available';
  end if;

  return query
  select qa.correct_key, q.explanation
  from public.questions q
  join public.question_answers qa on qa.question_id = q.id
  where q.id = p_question_id;
end;
$$;
