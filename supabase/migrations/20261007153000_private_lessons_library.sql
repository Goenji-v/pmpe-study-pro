-- Biblioteca privada pessoal do Study Pro.
-- Acesso é explicitamente permitido somente ao primeiro administrador existente.
create table if not exists public.study_private_feature_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.study_private_feature_access enable row level security;
revoke all on table public.study_private_feature_access from anon, authenticated;
grant select on table public.study_private_feature_access to authenticated;

drop policy if exists study_private_feature_access_select_self
  on public.study_private_feature_access;
create policy study_private_feature_access_select_self
  on public.study_private_feature_access
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

insert into public.study_private_feature_access (user_id)
select a.user_id
from public.administradores a
order by a.criado_em asc
limit 1
on conflict (user_id) do nothing;

create table if not exists public.study_private_lessons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null
    check (source_type in ('google_drive','youtube')),
  title text not null check (char_length(title) between 1 and 180),
  source_url text not null check (char_length(source_url) between 8 and 2000),
  materia text,
  assunto text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists study_private_lessons_user_created_idx
  on public.study_private_lessons (user_id, created_at desc);

alter table public.study_private_lessons enable row level security;
revoke all on table public.study_private_lessons from anon;
grant select, insert, update, delete on table public.study_private_lessons to authenticated;

drop policy if exists study_private_lessons_select_owner
  on public.study_private_lessons;
create policy study_private_lessons_select_owner
  on public.study_private_lessons
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.study_private_feature_access a
      where a.user_id = (select auth.uid())
    )
  );

drop policy if exists study_private_lessons_insert_owner
  on public.study_private_lessons;
create policy study_private_lessons_insert_owner
  on public.study_private_lessons
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.study_private_feature_access a
      where a.user_id = (select auth.uid())
    )
  );

drop policy if exists study_private_lessons_update_owner
  on public.study_private_lessons;
create policy study_private_lessons_update_owner
  on public.study_private_lessons
  for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.study_private_feature_access a
      where a.user_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.study_private_feature_access a
      where a.user_id = (select auth.uid())
    )
  );

drop policy if exists study_private_lessons_delete_owner
  on public.study_private_lessons;
create policy study_private_lessons_delete_owner
  on public.study_private_lessons
  for delete
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.study_private_feature_access a
      where a.user_id = (select auth.uid())
    )
  );