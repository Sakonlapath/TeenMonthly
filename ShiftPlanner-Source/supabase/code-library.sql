-- Run once in your Supabase project's SQL Editor. Safe to run again.
-- Each authenticated user owns one catalogue; no anonymous access.
begin;

create table if not exists public.code_libraries (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  records jsonb not null default '[]'::jsonb,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint code_library_array check (jsonb_typeof(records) = 'array'),
  constraint code_library_size check (octet_length(records::text) <= 5000000),
  constraint code_library_count check (jsonb_array_length(records) <= 10000)
);

alter table public.code_libraries enable row level security;
revoke all on public.code_libraries from anon;
revoke all on public.code_libraries from authenticated;
grant select, insert, update on public.code_libraries to authenticated;

drop policy if exists "Read own code library" on public.code_libraries;
create policy "Read own code library" on public.code_libraries
  for select to authenticated using ((select auth.uid()) = owner_id);
drop policy if exists "Insert own code library" on public.code_libraries;
create policy "Insert own code library" on public.code_libraries
  for insert to authenticated with check ((select auth.uid()) = owner_id);
drop policy if exists "Update own code library" on public.code_libraries;
create policy "Update own code library" on public.code_libraries
  for update to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- Atomic revision check: concurrent writes cannot silently replace newer data.
-- SECURITY INVOKER keeps all access subject to the RLS policies above.
create or replace function public.save_code_library(expected_revision bigint, entries jsonb)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare
  next_revision bigint;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if expected_revision is null or expected_revision < 0 then
    raise exception 'Invalid expected revision' using errcode = '22023';
  end if;
  if entries is null or jsonb_typeof(entries) <> 'array' then
    raise exception 'Entries must be an array' using errcode = '22023';
  end if;
  if octet_length(entries::text) > 5000000 or jsonb_array_length(entries) > 10000 then
    raise exception 'Library is too large' using errcode = '22023';
  end if;

  if expected_revision = 0 then
    insert into public.code_libraries(owner_id, records, revision)
      values (auth.uid(), entries, 1)
      on conflict (owner_id) do nothing
      returning revision into next_revision;
  else
    update public.code_libraries
      set records = entries, revision = revision + 1, updated_at = now()
      where owner_id = auth.uid() and revision = expected_revision
      returning revision into next_revision;
  end if;
  if next_revision is null then
    raise exception 'Library changed on another device. Load before saving.'
      using errcode = '40001';
  end if;
  return next_revision;
end;
$$;

revoke all on function public.save_code_library(bigint, jsonb) from public, anon;
grant execute on function public.save_code_library(bigint, jsonb) to authenticated;
commit;
