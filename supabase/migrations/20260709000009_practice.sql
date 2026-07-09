-- Practice mode: append-only answer log + a SECURITY DEFINER RPC that checks
-- an answer server-side (so the client never needs read access to answers).

create table public.practice_answers (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  selected_key text not null,
  is_correct boolean not null,
  answered_at timestamptz not null default now()
);
create index practice_answers_user_topic_idx
  on public.practice_answers (user_id, topic_id);
create index practice_answers_user_time_idx
  on public.practice_answers (user_id, answered_at desc);

alter table public.practice_answers enable row level security;

-- Users only see/insert their own rows. is_correct is set by the RPC, but even
-- a direct insert can't leak the key — it just records what the user claims.
create policy "practice_own_select" on public.practice_answers
  for select using (user_id = auth.uid());
create policy "practice_own_insert" on public.practice_answers
  for insert with check (user_id = auth.uid());

-- Checks an answer and logs it. Returns the correct key + explanation so the
-- UI can reveal them — WITHOUT ever exposing question_answers to the client.
create or replace function public.check_practice_answer(
  p_question_id uuid,
  p_selected_key text
)
returns table (correct_key text, is_correct boolean, explanation text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_correct text;
  v_topic uuid;
  v_explanation text;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select qa.correct_key, q.topic_id, q.explanation, q.status
    into v_correct, v_topic, v_explanation, v_status
  from public.questions q
  join public.question_answers qa on qa.question_id = q.id
  where q.id = p_question_id;

  if v_correct is null then
    raise exception 'question not found';
  end if;
  if v_status <> 'published' then
    raise exception 'question not available';
  end if;

  insert into public.practice_answers
    (user_id, question_id, topic_id, selected_key, is_correct)
  values
    (auth.uid(), p_question_id, v_topic, p_selected_key,
     p_selected_key = v_correct);

  return query select v_correct, (p_selected_key = v_correct), v_explanation;
end;
$$;

-- Per-user topic accuracy (for weak-area detection).
create or replace view public.v_user_topic_stats
with (security_invoker = true) as
select
  user_id,
  topic_id,
  count(*) as attempts,
  count(*) filter (where is_correct) as correct
from public.practice_answers
group by user_id, topic_id;
