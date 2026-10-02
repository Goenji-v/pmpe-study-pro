-- Catálogo global de editais pré-definidos.
-- Leitura: qualquer usuário autenticado vê apenas os publicados.
-- Escrita: somente administradores existentes em public.administradores.

create table if not exists public.editais_catalogo (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  organizacao text not null,
  nome text not null,
  uf text not null,
  ano integer not null,
  carreira text not null default 'policia_militar',
  grupo_cargo text not null,
  cargo text not null,
  codigo_cargo text,
  banca text,
  fonte_url text,
  pdf_path text,
  analise jsonb not null default '{}'::jsonb,
  opcoes jsonb not null default '{}'::jsonb,
  status text not null default 'rascunho',
  destaque boolean not null default false,
  ordem integer not null default 0,
  criado_por uuid references auth.users(id) default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint editais_catalogo_uf_check check (char_length(uf) between 2 and 8),
  constraint editais_catalogo_ano_check check (ano between 2000 and 2100),
  constraint editais_catalogo_grupo_check check (grupo_cargo in ('soldado','oficial','outro')),
  constraint editais_catalogo_status_check check (status in ('rascunho','publicado','arquivado'))
);

comment on table public.editais_catalogo is
  'Catálogo global de editais pré-definidos. Leitura para usuários autenticados quando publicado; gestão exclusiva de administradores.';

create index if not exists editais_catalogo_listagem_idx
  on public.editais_catalogo (status, carreira, grupo_cargo, ordem, ano desc);

alter table public.editais_catalogo enable row level security;

revoke all privileges on table public.editais_catalogo from anon;
grant select, insert, update, delete on table public.editais_catalogo to authenticated;

drop policy if exists editais_catalogo_leitura on public.editais_catalogo;
create policy editais_catalogo_leitura
on public.editais_catalogo
for select
to authenticated
using (
  status = 'publicado'
  or (select public.sou_admin())
);

drop policy if exists editais_catalogo_admin_insert on public.editais_catalogo;
create policy editais_catalogo_admin_insert
on public.editais_catalogo
for insert
to authenticated
with check ((select public.sou_admin()));

drop policy if exists editais_catalogo_admin_update on public.editais_catalogo;
create policy editais_catalogo_admin_update
on public.editais_catalogo
for update
to authenticated
using ((select public.sou_admin()))
with check ((select public.sou_admin()));

drop policy if exists editais_catalogo_admin_delete on public.editais_catalogo;
create policy editais_catalogo_admin_delete
on public.editais_catalogo
for delete
to authenticated
using ((select public.sou_admin()));

drop policy if exists editais_catalogo_storage_select on storage.objects;
create policy editais_catalogo_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'materiais'
  and (storage.foldername(name))[1] = 'editais-catalogo'
  and (
    (select public.sou_admin())
    or exists (
      select 1
      from public.editais_catalogo ec
      where ec.pdf_path = storage.objects.name
        and ec.status = 'publicado'
    )
  )
);

drop policy if exists editais_catalogo_storage_insert on storage.objects;
create policy editais_catalogo_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'materiais'
  and (storage.foldername(name))[1] = 'editais-catalogo'
  and (select public.sou_admin())
);

drop policy if exists editais_catalogo_storage_update on storage.objects;
create policy editais_catalogo_storage_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'materiais'
  and (storage.foldername(name))[1] = 'editais-catalogo'
  and (select public.sou_admin())
)
with check (
  bucket_id = 'materiais'
  and (storage.foldername(name))[1] = 'editais-catalogo'
  and (select public.sou_admin())
);

drop policy if exists editais_catalogo_storage_delete on storage.objects;
create policy editais_catalogo_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'materiais'
  and (storage.foldername(name))[1] = 'editais-catalogo'
  and (select public.sou_admin())
);
