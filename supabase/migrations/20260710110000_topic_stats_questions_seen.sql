-- practice_answers is append-only, so `attempts` counts every answer a student
-- ever submitted, not how much of a topic they have covered. Add a distinct
-- question count so the practice pages can report coverage separately.
--
-- `create or replace view` can only append columns, never reorder or drop them;
-- questions_seen therefore goes last, and security_invoker must be restated or
-- the view would silently revert to definer semantics and leak other users'
-- rows past the practice_answers RLS policy.
create or replace view public.v_user_topic_stats
with (security_invoker = true) as
select
  user_id,
  topic_id,
  count(*) as attempts,
  count(*) filter (where is_correct) as correct,
  count(distinct question_id) as questions_seen
from public.practice_answers
group by user_id, topic_id;
