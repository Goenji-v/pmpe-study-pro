-- Monitoramento de erros reais em produção.
-- Aplicado no projeto Supabase em 2026-08-30.

alter table public.erros_cliente
  add column if not exists fingerprint text default '',
  add column if not exists status text not null default 'aberto',
  add column if not exists resolvido_em timestamptz;

update public.erros_cliente
set fingerprint = md5(coalesce(origem,'') || '|' || coalesce(rota,'') || '|' || coalesce(mensagem,''))
where fingerprint is null;

alter table public.erros_cliente
  alter column fingerprint set not null;

alter table public.erros_cliente
  drop constraint if exists erros_cliente_status_check;

alter table public.erros_cliente
  add constraint erros_cliente_status_check
  check (status in ('aberto','resolvido'));

create index if not exists erros_cliente_status_created_idx
  on public.erros_cliente (status, created_at desc);

create index if not exists erros_cliente_fingerprint_idx
  on public.erros_cliente (fingerprint, created_at desc);

drop policy if exists erros_cliente_atualizar_admin on public.erros_cliente;
create policy erros_cliente_atualizar_admin
on public.erros_cliente
for update
to authenticated
using ((select sou_admin()))
with check ((select sou_admin()));
