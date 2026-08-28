-- Catálogo de wallpapers da Loja Study Pro.
-- Aplicado no projeto remoto via migration `loja_wallpapers_admin`.

create table if not exists public.loja_itens (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  tipo text not null default 'wallpaper' check (tipo in ('wallpaper')),
  nome text not null check (char_length(nome) between 2 and 80),
  descricao text not null default '',
  preco integer not null check (preco >= 0 and preco <= 100000),
  raridade text not null check (raridade in ('comum','raro','epico','lendario')),
  icone text not null default '🖼️',
  desktop_path text not null,
  mobile_path text,
  preview_path text,
  ativo boolean not null default true,
  ordem integer not null default 0,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.loja_itens enable row level security;

grant select on public.loja_itens to authenticated;
grant insert, update, delete on public.loja_itens to authenticated;

drop policy if exists "loja_itens_leitura_autenticada" on public.loja_itens;
create policy "loja_itens_leitura_autenticada"
on public.loja_itens for select
to authenticated
using (true);

drop policy if exists "loja_itens_admin_insert" on public.loja_itens;
create policy "loja_itens_admin_insert"
on public.loja_itens for insert
to authenticated
with check ((select public.sou_admin()));

drop policy if exists "loja_itens_admin_update" on public.loja_itens;
create policy "loja_itens_admin_update"
on public.loja_itens for update
to authenticated
using ((select public.sou_admin()))
with check ((select public.sou_admin()));

drop policy if exists "loja_itens_admin_delete" on public.loja_itens;
create policy "loja_itens_admin_delete"
on public.loja_itens for delete
to authenticated
using ((select public.sou_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'loja-wallpapers',
  'loja-wallpapers',
  true,
  8388608,
  array['image/jpeg','image/png','image/webp','image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "loja_wallpapers_admin_select" on storage.objects;
create policy "loja_wallpapers_admin_select"
on storage.objects for select
to authenticated
using (bucket_id = 'loja-wallpapers' and (select public.sou_admin()));

drop policy if exists "loja_wallpapers_admin_insert" on storage.objects;
create policy "loja_wallpapers_admin_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'loja-wallpapers' and (select public.sou_admin()));

drop policy if exists "loja_wallpapers_admin_update" on storage.objects;
create policy "loja_wallpapers_admin_update"
on storage.objects for update
to authenticated
using (bucket_id = 'loja-wallpapers' and (select public.sou_admin()))
with check (bucket_id = 'loja-wallpapers' and (select public.sou_admin()));

drop policy if exists "loja_wallpapers_admin_delete" on storage.objects;
create policy "loja_wallpapers_admin_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'loja-wallpapers' and (select public.sou_admin()));

create index if not exists loja_itens_tipo_ativo_ordem_idx
  on public.loja_itens (tipo, ativo, ordem, criado_em desc);
