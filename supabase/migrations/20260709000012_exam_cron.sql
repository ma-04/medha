-- Auto-submit attempts whose server deadline has passed. A student who closes
-- the tab (or whose auto-submit fails client-side) is still graded, so no
-- attempt lingers ungraded and no answer can be added past the deadline.

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
    where submitted_at is null and now() >= deadline
  loop
    perform public._grade_attempt(v_id);
  end loop;
end;
$$;

-- pg_cron: grade expired attempts every minute. Guarded so the migration still
-- applies on instances where pg_cron is unavailable.
do $$
begin
  create extension if not exists pg_cron;

  if not exists (
    select 1 from cron.job where jobname = 'auto-submit-expired-attempts'
  ) then
    perform cron.schedule(
      'auto-submit-expired-attempts',
      '* * * * *',
      $cron$select public.auto_submit_expired();$cron$
    );
  end if;
exception
  when others then
    raise notice 'pg_cron unavailable, skipping schedule: %', sqlerrm;
end;
$$;
