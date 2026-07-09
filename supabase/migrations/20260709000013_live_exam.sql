-- Live exams: after the window closes, force-submit stragglers, rank everyone,
-- and publish results. Ranking is computed once (not live) to avoid a cheat
-- vector and needless load during the sitting.

-- Finalize a live exam: grade the unsubmitted, assign ranks, publish results.
-- Callable by an admin anytime, or by anyone/cron only once the exam has ended
-- (the ends_at gate is what prevents early result leaks).
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
  if not public.is_admin()
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

-- Leaderboard: top 100 plus the caller's own row. Gated until results publish.
create or replace function public.get_leaderboard(p_exam_id uuid)
returns table (
  rank int,
  user_id uuid,
  full_name text,
  score numeric,
  is_self boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_published timestamptz;
  v_uid uuid := auth.uid();
begin
  select results_published_at into v_published
  from public.exams where id = p_exam_id;

  if v_published is null and not public.is_admin() then
    raise exception 'results not published yet';
  end if;

  return query
  select
    a.rank,
    a.user_id,
    coalesce(p.full_name, 'পরীক্ষার্থী'),
    a.score,
    (a.user_id = v_uid)
  from public.exam_attempts a
  join public.profiles p on p.id = a.user_id
  where a.exam_id = p_exam_id
    and a.submitted_at is not null
    and (a.rank <= 100 or a.user_id = v_uid)
  order by a.rank asc;
end;
$$;

-- Cron: finalize any live exam whose window has closed but isn't published yet.
create or replace function public.auto_finalize_live()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  for v_id in
    select id from public.exams
    where type = 'live'
      and ends_at is not null
      and now() >= ends_at
      and results_published_at is null
  loop
    perform public.finalize_live_exam(v_id);
  end loop;
end;
$$;

do $$
begin
  create extension if not exists pg_cron;

  if not exists (
    select 1 from cron.job where jobname = 'auto-finalize-live-exams'
  ) then
    perform cron.schedule(
      'auto-finalize-live-exams',
      '* * * * *',
      $cron$select public.auto_finalize_live();$cron$
    );
  end if;
exception
  when others then
    raise notice 'pg_cron unavailable, skipping schedule: %', sqlerrm;
end;
$$;
