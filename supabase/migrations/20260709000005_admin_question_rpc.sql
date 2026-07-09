-- Atomic upsert of a question + its answer key. Admin-only. Keeping both
-- writes in one function guarantees a question never exists without its key.
create or replace function public.admin_upsert_question(
  p_id uuid,
  p_topic_id uuid,
  p_body text,
  p_options jsonb,
  p_correct_key text,
  p_explanation text,
  p_image_url text,
  p_difficulty smallint,
  p_source_exam text,
  p_source_year smallint,
  p_source_label text,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  if p_id is null then
    insert into public.questions (
      topic_id, body, options, explanation, image_url, difficulty,
      source_exam, source_year, source_label, status, created_by
    ) values (
      p_topic_id, p_body, p_options, p_explanation, p_image_url, p_difficulty,
      p_source_exam, p_source_year, p_source_label, p_status, auth.uid()
    )
    returning id into v_id;
  else
    update public.questions set
      topic_id = p_topic_id,
      body = p_body,
      options = p_options,
      explanation = p_explanation,
      image_url = p_image_url,
      difficulty = p_difficulty,
      source_exam = p_source_exam,
      source_year = p_source_year,
      source_label = p_source_label,
      status = p_status
    where id = p_id
    returning id into v_id;
  end if;

  insert into public.question_answers (question_id, correct_key)
  values (v_id, p_correct_key)
  on conflict (question_id) do update set correct_key = excluded.correct_key;

  return v_id;
end;
$$;
