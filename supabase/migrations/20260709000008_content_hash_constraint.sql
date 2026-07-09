-- Replace the partial unique index with a full unique constraint so PostgREST
-- upserts can target it via onConflict. NULL content_hash values (manually
-- created questions) remain allowed and distinct, since Postgres treats NULLs
-- as non-equal in unique constraints.
drop index if exists public.questions_hash_idx;

alter table public.questions
  add constraint questions_content_hash_key unique (content_hash);
