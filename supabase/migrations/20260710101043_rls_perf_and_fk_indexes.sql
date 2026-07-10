-- Database-side performance, all three findings from `supabase db advisors`.
--
-- 1. auth_rls_initplan (WARN x5). A bare `auth.uid()` in a policy predicate is
--    re-evaluated once per scanned row. Wrapping it as `(select auth.uid())`
--    makes the planner hoist it into an InitPlan and evaluate it once per
--    statement. Supabase measures ~95% off a uid-filtered scan. The same holds
--    for is_admin()/can_author(), which run a `profiles` lookup each call.
--
-- 2. multiple_permissive_policies (WARN x20). subjects/topics/questions/exams
--    each carry a `for all` write policy AND a read policy. `for all` includes
--    SELECT, so every read evaluates both, and the write policy's can_author()
--    fires on every anonymous read. Splitting `for all` into explicit
--    insert/update/delete removes it from the SELECT path entirely. Staff can
--    still read drafts: the read policies already carry `or can_author()`.
--
-- 3. unindexed_foreign_keys (INFO x7). Postgres does not index FKs. Unindexed
--    child columns make the parent's delete-time referential check a seq scan.
--
-- The public read policies (subjects_read, topics_read, questions_read_published,
-- exams_read_visible) deliberately keep NO `to` clause: `/` renders for signed-
-- out visitors and queries `exams`, so `anon` must still match them. Only the
-- write and own-row policies get `to authenticated`, where `anon` never matches.

-- --- profiles ----------------------------------------------------------------
drop policy "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id or (select public.is_admin()));

drop policy "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id or (select public.is_admin()))
  with check ((select auth.uid()) = id or (select public.is_admin()));

-- --- subjects ----------------------------------------------------------------
drop policy "subjects_admin_write" on public.subjects;
create policy "subjects_author_insert" on public.subjects
  for insert to authenticated with check ((select public.can_author()));
create policy "subjects_author_update" on public.subjects
  for update to authenticated
  using ((select public.can_author())) with check ((select public.can_author()));
create policy "subjects_author_delete" on public.subjects
  for delete to authenticated using ((select public.can_author()));

-- --- topics ------------------------------------------------------------------
drop policy "topics_admin_write" on public.topics;
create policy "topics_author_insert" on public.topics
  for insert to authenticated with check ((select public.can_author()));
create policy "topics_author_update" on public.topics
  for update to authenticated
  using ((select public.can_author())) with check ((select public.can_author()));
create policy "topics_author_delete" on public.topics
  for delete to authenticated using ((select public.can_author()));

-- --- questions ---------------------------------------------------------------
alter policy "questions_read_published" on public.questions
  using (status = 'published' or (select public.can_author()));

drop policy "questions_admin_write" on public.questions;
create policy "questions_author_insert" on public.questions
  for insert to authenticated with check ((select public.can_author()));
create policy "questions_author_update" on public.questions
  for update to authenticated
  using ((select public.can_author())) with check ((select public.can_author()));
create policy "questions_author_delete" on public.questions
  for delete to authenticated using ((select public.can_author()));

-- --- question_answers (staff-only; single policy, no SELECT overlap) ----------
alter policy "answers_admin_only" on public.question_answers
  using ((select public.can_author())) with check ((select public.can_author()));

-- --- practice_answers --------------------------------------------------------
drop policy "practice_own_select" on public.practice_answers;
create policy "practice_own_select" on public.practice_answers
  for select to authenticated using (user_id = (select auth.uid()));

drop policy "practice_own_insert" on public.practice_answers;
create policy "practice_own_insert" on public.practice_answers
  for insert to authenticated with check (user_id = (select auth.uid()));

-- --- exams -------------------------------------------------------------------
alter policy "exams_read_visible" on public.exams
  using (status in ('scheduled', 'published', 'archived') or (select public.can_author()));

drop policy "exams_admin_write" on public.exams;
create policy "exams_author_insert" on public.exams
  for insert to authenticated with check ((select public.can_author()));
create policy "exams_author_update" on public.exams
  for update to authenticated
  using ((select public.can_author())) with check ((select public.can_author()));
create policy "exams_author_delete" on public.exams
  for delete to authenticated using ((select public.can_author()));

-- --- exam_questions / attempt_answers (staff-only; single policy each) --------
alter policy "exam_questions_admin_only" on public.exam_questions
  using ((select public.can_author())) with check ((select public.can_author()));

alter policy "attempt_answers_admin_only" on public.attempt_answers
  using ((select public.can_author())) with check ((select public.can_author()));

-- --- exam_attempts (no write policy: scores/ranks stay RPC-only) --------------
drop policy "attempts_own_read" on public.exam_attempts;
create policy "attempts_own_read" on public.exam_attempts
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- --- storage: question images ------------------------------------------------
alter policy "question_images_admin_insert" on storage.objects
  with check (bucket_id = 'question-images' and (select public.can_author()));
alter policy "question_images_admin_update" on storage.objects
  using (bucket_id = 'question-images' and (select public.can_author()));
alter policy "question_images_admin_delete" on storage.objects
  using (bucket_id = 'question-images' and (select public.can_author()));

-- --- unindexed foreign keys (advisor 0001) -----------------------------------
-- practice_answers and attempt_answers grow without bound, and their FKs to
-- questions/topics are exactly what a question or topic delete must check.
create index if not exists practice_answers_question_idx
  on public.practice_answers (question_id);
create index if not exists practice_answers_topic_idx
  on public.practice_answers (topic_id);
create index if not exists attempt_answers_question_idx
  on public.attempt_answers (question_id);
create index if not exists exam_questions_question_idx
  on public.exam_questions (question_id);
create index if not exists exam_questions_subject_idx
  on public.exam_questions (subject_id);
create index if not exists questions_created_by_idx
  on public.questions (created_by);
create index if not exists exams_created_by_idx
  on public.exams (created_by);

-- Archive search orders by (source_year desc, created_at desc) over published
-- questions and paginates with .range() — currently a full sort of the published
-- set on every page. See searchArchive() in src/lib/queries/archive.ts.
create index if not exists questions_archive_sort_idx
  on public.questions (status, source_year desc, created_at desc);

-- Note: advisors also reports questions_search_idx, questions_body_trgm_idx and
-- practice_answers_user_topic_idx as "unused". That reflects a young database
-- with little traffic, not dead indexes — all three back live query paths
-- (full-text search, ilike body search, the topic-stats view). Left in place.
