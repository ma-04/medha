-- Allow trusted server contexts (service-role, where auth.uid() is null) to
-- update role/plan. RLS already blocks anon users from reaching this UPDATE,
-- so a null auth.uid() here means a service-role caller — safe to permit.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.plan := old.plan;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
