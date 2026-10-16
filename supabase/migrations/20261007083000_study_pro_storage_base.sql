-- Study Pro Storage: metadados privados e progresso de vídeos.
-- O arquivo físico fica fora do Postgres (R2/MinIO/S3 compatível);
-- o banco guarda somente metadados, vínculo com matéria e autorização.

create table if not exists public.study_storage_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 's3',
  bucket text not null,
  object_key text not null,
  file_name text not null,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null check (size_bytes >= 0),
  kind text not null default 'other'
    check (kind in ('video', 'pdf', 'image', 'document', 'other')),
  visibility text not null default 'private'
    check (visibility = 'private'),
  materia text,
  assunto text,
  duration_seconds integer
    check (duration_seconds is null or duration_seconds >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'ready', 'failed', 'deleted')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, bucket, object_key),
  unique (id, user_id)
);

create index if not exists study_storage_files_user_created_idx
  on public.study_storage_files (user_id, created_at desc);

create index if not exists study_storage_files_user_subject_idx
  on public.study_storage_files (user_id, materia, assunto)
  where status = 'ready';

alter table public.study_storage_files enable row level security;

revoke all on table public.study_storage_files from anon;
grant select, insert, update, delete on table public.study_storage_files to authenticated;

drop policy if exists study_storage_files_select_owner
  on public.study_storage_files;
create policy study_storage_files_select_owner
  on public.study_storage_files
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists study_storage_files_insert_owner
  on public.study_storage_files;
create policy study_storage_files_insert_owner
  on public.study_storage_files
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists study_storage_files_update_owner
  on public.study_storage_files;
create policy study_storage_files_update_owner
  on public.study_storage_files
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists study_storage_files_delete_owner
  on public.study_storage_files;
create policy study_storage_files_delete_owner
  on public.study_storage_files
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.study_storage_video_progress (
  file_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  position_seconds integer not null default 0
    check (position_seconds >= 0),
  duration_seconds integer
    check (duration_seconds is null or duration_seconds >= 0),
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (file_id, user_id),
  constraint study_storage_video_progress_file_owner_fk
    foreign key (file_id, user_id)
    references public.study_storage_files (id, user_id)
    on delete cascade
);

create index if not exists study_storage_video_progress_user_idx
  on public.study_storage_video_progress (user_id);

alter table public.study_storage_video_progress enable row level security;

revoke all on table public.study_storage_video_progress from anon;
grant select, insert, update, delete
  on table public.study_storage_video_progress
  to authenticated;

drop policy if exists study_storage_video_progress_select_owner
  on public.study_storage_video_progress;
create policy study_storage_video_progress_select_owner
  on public.study_storage_video_progress
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists study_storage_video_progress_insert_owner
  on public.study_storage_video_progress;
create policy study_storage_video_progress_insert_owner
  on public.study_storage_video_progress
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists study_storage_video_progress_update_owner
  on public.study_storage_video_progress;
create policy study_storage_video_progress_update_owner
  on public.study_storage_video_progress
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists study_storage_video_progress_delete_owner
  on public.study_storage_video_progress;
create policy study_storage_video_progress_delete_owner
  on public.study_storage_video_progress
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
