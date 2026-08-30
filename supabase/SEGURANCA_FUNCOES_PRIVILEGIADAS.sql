-- Hardening das funções privilegiadas do Study Pro.
-- Objetivos:
-- 1) manter SECURITY DEFINER apenas onde é necessário;
-- 2) reduzir search_path a schemas confiáveis;
-- 3) garantir EXECUTE apenas para authenticated/service_role;
-- 4) remover privilégios SQL diretos desnecessários das tabelas sensíveis.

-- sou_admin não precisa de privilégio elevado: a policy da tabela permite que
-- cada usuário autenticado consulte apenas o próprio registro administrativo.
alter function public.sou_admin() security invoker;
alter function public.sou_admin() set search_path = pg_catalog, pg_temp;

revoke all on function public.sou_admin() from PUBLIC, anon;
grant execute on function public.sou_admin() to authenticated, service_role;

drop policy if exists "admin ve proprio cadastro" on public.administradores;
create policy "admin ve proprio cadastro"
on public.administradores for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.administradores from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.administradores from authenticated;
grant select on table public.administradores to authenticated;

-- Estas duas funções consultam auth.users. O SECURITY DEFINER é intencional,
-- mas o chamador precisa passar por public.sou_admin() antes de obter dados.
alter function public.admin_resumo() security definer;
alter function public.admin_resumo() set search_path = pg_catalog, auth, pg_temp;
comment on function public.admin_resumo() is
  'SECURITY DEFINER intencional: consulta auth.users após validar public.sou_admin().';
revoke all on function public.admin_resumo() from PUBLIC, anon;
grant execute on function public.admin_resumo() to authenticated, service_role;

alter function public.admin_listar_usuarios() security definer;
alter function public.admin_listar_usuarios() set search_path = pg_catalog, auth, pg_temp;
comment on function public.admin_listar_usuarios() is
  'SECURITY DEFINER intencional: consulta auth.users após validar public.sou_admin().';
revoke all on function public.admin_listar_usuarios() from PUBLIC, anon;
grant execute on function public.admin_listar_usuarios() to authenticated, service_role;

-- O ranking precisa gravar em ranking_mensal sem conceder INSERT/UPDATE ao
-- cliente. O corpo usa auth.uid() e lê somente configuracoes desse mesmo usuário.
alter function public.recalcular_meu_ranking(text) security definer;
alter function public.recalcular_meu_ranking(text) set search_path = pg_catalog, pg_temp;
comment on function public.recalcular_meu_ranking(text) is
  'SECURITY DEFINER intencional: recalcula o ranking a partir dos dados do próprio auth.uid() sem permitir escrita direta do cliente em ranking_mensal.';
revoke all on function public.recalcular_meu_ranking(text) from PUBLIC, anon;
grant execute on function public.recalcular_meu_ranking(text) to authenticated, service_role;

revoke all on table public.ranking_mensal from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.ranking_mensal from authenticated;
grant select on table public.ranking_mensal to authenticated;