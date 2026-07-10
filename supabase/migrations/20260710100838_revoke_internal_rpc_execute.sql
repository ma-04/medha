-- Postgres grants EXECUTE to PUBLIC on every new function, and PUBLIC is
-- inherited by `anon` and `authenticated`. Every SECURITY DEFINER function in
-- `public` is therefore a PostgREST endpoint at /rest/v1/rpc/<name>, reachable
-- with nothing but the anon key. No migration so far issued a single REVOKE.
--
-- Most of our RPCs gate themselves (is_admin(), can_author(), an auth.uid()
-- null check, or an ownership test), so exposure is harmless. These do not:
--
--   auto_finalize_live()    takes no arguments and publishes results + flips
--                           status='published' for EVERY ended live exam.
--   finalize_live_exam(id)  same, for one exam. Its can_author() gate only
--                           applies BEFORE ends_at, so once the window closes
--                           any caller can publish. Exam ids are readable by
--                           students via the exams RLS select policy.
--   auto_submit_expired()   takes no arguments and force-grades every attempt
--                           past its deadline.
--   _grade_attempt(id)      overwrites score/submitted_at on any attempt id.
--
-- None of these four are called from application code. Revoking the PUBLIC
-- grant therefore closes the hole with no behaviour change and no change to any
-- function body. The two callers that remain keep working:
--
--   pg_cron   Both jobs run as `postgres` (cron.job.username), which owns all
--             four functions. A function's owner keeps EXECUTE implicitly, and
--             `revoke ... from public` does not touch it. Note `postgres` is
--             NOT a superuser on Supabase (pg_roles.rolsuper = false), so the
--             grant genuinely matters here -- ownership is what saves us.
--   scripts/  verify-live.mjs calls finalize_live_exam as `service_role`, which
--             is not the owner, so it is re-granted explicitly below.

revoke all on function public._grade_attempt(uuid) from public, anon, authenticated;
revoke all on function public.auto_submit_expired() from public, anon, authenticated;
revoke all on function public.auto_finalize_live() from public, anon, authenticated;
revoke all on function public.finalize_live_exam(uuid) from public, anon, authenticated;

-- verify-live.mjs finalizes a live exam out-of-band to assert ranking.
grant execute on function public.finalize_live_exam(uuid) to service_role;

-- Trigger functions. Postgres rejects a direct call ("trigger functions can
-- only be called as triggers"), so these were never exploitable — revoked to
-- keep `supabase db advisors` clean and to state the intent.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.protect_profile_columns() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

-- touch_updated_at was the one function with a mutable search_path
-- (advisor 0011_function_search_path_mutable). Body is unchanged.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.touch_updated_at() from public, anon, authenticated;

-- is_admin(), can_author(), and the self-gating RPCs (start_exam_attempt,
-- save_answer, submit_attempt, get_attempt_review, get_leaderboard,
-- retry_exam_attempt, check_practice_answer, reveal_answer,
-- admin_upsert_question, admin_set_exam_questions) keep their PUBLIC grant on
-- purpose: RLS policy expressions evaluate is_admin()/can_author() as the
-- invoking role, so `authenticated` must retain EXECUTE or every policy that
-- calls them fails with a permission error.
