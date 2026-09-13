-- Study Pro — fundos vendáveis do Dashboard
-- Permite que somente administradores publiquem imagens e que usuários autenticados
-- vejam os fundos ativos na Loja.

create table if not exists public.fundos_loja (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(trim(nome)) between 2 and 80),
  descricao text not null default '',
  preco integer not null default 200 check (preco >= 0),
  raridade text not null default 'raro' check (raridade in ('comum','raro','epico','lendario')),
  imagem_path text not null,
  ativo boolean not null default true,
  criado_por uuid not null default auth.uid() references auth.users(id) on delete restrict,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists fundos_loja_ativo_criado_em_idx
  on public.fundos_loja (ativo, criado_em desc);

alter table public.fundos_loja enable row level security;

revoke all on table public.fundos_loja from anon;
grant select, insert, update, delete on table public.fundos_loja to authenticated;

drop policy if exists "fundos ativos visiveis" on public.fundos_loja;
create policy "fundos ativos visiveis"
on public.fundos_loja for select
to authenticated
using (ativo = true or public.sou_admin());

drop policy if exists "admin cadastra fundos" on public.fundos_loja;
create policy "admin cadastra fundos"
on public.fundos_loja for insert
to authenticated
with check (public.sou_admin() and criado_por = (select auth.uid()));

drop policy if exists "admin atualiza fundos" on public.fundos_loja;
create policy "admin atualiza fundos"
on public.fundos_loja for update
to authenticated
using (public.sou_admin())
with check (public.sou_admin());

drop policy if exists "admin remove fundos" on public.fundos_loja;
create policy "admin remove fundos"
on public.fundos_loja for delete
to authenticated
using (public.sou_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fundos-dashboard',
  'fundos-dashboard',
  true,
  8388608,
  array['image/jpeg','image/png','image/webp','image/avif']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admin envia fundos dashboard" on storage.objects;
create policy "admin envia fundos dashboard"
on storage.objects for insert
to authenticated
with check (bucket_id = 'fundos-dashboard' and public.sou_admin());

drop policy if exists "admin atualiza fundos dashboard" on storage.objects;
create policy "admin atualiza fundos dashboard"
on storage.objects for update
to authenticated
using (bucket_id = 'fundos-dashboard' and public.sou_admin())
with check (bucket_id = 'fundos-dashboard' and public.sou_admin());

drop policy if exists "admin remove fundos dashboard" on storage.objects;
create policy "admin remove fundos dashboard"
on storage.objects for delete
to authenticated
using (bucket_id = 'fundos-dashboard' and public.sou_admin());
