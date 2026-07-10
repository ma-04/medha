-- Bulk question import, moved out of the Next.js route handler and into the
-- database.
--
-- The route used to hold the SERVICE_ROLE key and issue two sequential upserts
-- per CSV row (~1000 round-trips for a 500-row file). It was also the only
-- runtime consumer of that key, and therefore the only backend path an Android
-- client could not reach: every other write goes through a can_author()-gated
-- RPC. This function closes both gaps.
--
-- Row shape (produced by importRowSchema in src/lib/import.ts, which still owns
-- CSV normalisation -- flattening option_a..option_e, lowercasing keys, coercing
-- numbers -- because doing it here would duplicate the zod schema in SQL):
--
--   { row, subject_slug, topic_slug, body, options: [{key, text}], correct_key,
--     explanation?, difficulty?, source_exam?, source_year?, source_label?,
--     status? }
--
-- `row` is the 1-based index in the *original* upload, so error messages still
-- point at the right line after zod has filtered rows out.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.admin_import_questions(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row       jsonb;
  v_n         int;
  v_topic_id  uuid;
  v_hash      text;
  v_id        uuid;
  v_is_insert boolean;
  v_inserted  int := 0;
  v_updated   int := 0;
  v_errors    jsonb := '[]'::jsonb;
begin
  if not public.can_author() then
    raise exception 'not authorized';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a json array';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_n := coalesce((v_row->>'row')::int, 0);

    select t.id into v_topic_id
    from public.topics t
    join public.subjects s on s.id = t.subject_id
    where s.slug = v_row->>'subject_slug'
      and t.slug = v_row->>'topic_slug';

    if v_topic_id is null then
      v_errors := v_errors || jsonb_build_object(
        'row', v_n,
        'error', format('topic not found: %s/%s',
                        v_row->>'subject_slug', v_row->>'topic_slug'));
      continue;
    end if;

    if coalesce(jsonb_array_length(v_row->'options'), 0) < 2 then
      v_errors := v_errors || jsonb_build_object(
        'row', v_n, 'error', 'need at least 2 options');
      continue;
    end if;

    if not exists (
      select 1 from jsonb_array_elements(v_row->'options') o
      where o->>'key' = v_row->>'correct_key'
    ) then
      v_errors := v_errors || jsonb_build_object(
        'row', v_n, 'error', 'correct_key not among options');
      continue;
    end if;

    -- Must reproduce contentHash() in src/lib/import.ts byte for byte, or the
    -- (content_hash) unique constraint stops deduplicating and re-imports
    -- create duplicates. JS `.trim()` strips all whitespace; bare btrim() would
    -- strip only spaces, so the character set is spelled out.
    v_hash := encode(extensions.digest(
      coalesce(v_row->>'source_exam', '') || '::' ||
      btrim(v_row->>'body', E' \t\n\r\f\v'), 'sha256'), 'hex');

    -- A bad row (status check violation, oversized field) must not abort the
    -- other 499. The subtransaction this block opens rolls back just this row.
    begin
      insert into public.questions (
        topic_id, body, options, explanation, difficulty,
        source_exam, source_year, source_label, status, content_hash, created_by
      ) values (
        v_topic_id,
        v_row->>'body',
        v_row->'options',
        v_row->>'explanation',
        (v_row->>'difficulty')::smallint,
        v_row->>'source_exam',
        (v_row->>'source_year')::smallint,
        v_row->>'source_label',
        coalesce(v_row->>'status', 'published'),
        v_hash,
        auth.uid()
      )
      on conflict (content_hash) do update set
        topic_id     = excluded.topic_id,
        body         = excluded.body,
        options      = excluded.options,
        explanation  = excluded.explanation,
        difficulty   = excluded.difficulty,
        source_exam  = excluded.source_exam,
        source_year  = excluded.source_year,
        source_label = excluded.source_label,
        status       = excluded.status
      -- xmax = 0 on a freshly inserted tuple; non-zero when ON CONFLICT
      -- resolved to an UPDATE. Lets a re-import report inserted = 0.
      returning id, (xmax = 0) into v_id, v_is_insert;

      insert into public.question_answers (question_id, correct_key)
      values (v_id, v_row->>'correct_key')
      on conflict (question_id) do update set correct_key = excluded.correct_key;

      if v_is_insert then
        v_inserted := v_inserted + 1;
      else
        v_updated := v_updated + 1;
      end if;
    exception when others then
      v_errors := v_errors || jsonb_build_object('row', v_n, 'error', sqlerrm);
    end;
  end loop;

  return jsonb_build_object(
    'inserted', v_inserted, 'updated', v_updated, 'errors', v_errors);
end;
$$;

revoke all on function public.admin_import_questions(jsonb) from public, anon;
grant execute on function public.admin_import_questions(jsonb) to authenticated;
