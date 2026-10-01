-- Defesa em profundidade para os pontos levantados na auditoria de segurança:
-- 1) tabelas públicas continuam protegidas por RLS, mas anon perde grants diretos;
-- 2) policies operacionais deixam de usar PUBLIC e passam a authenticated;
-- 3) SECURITY DEFINER resolve built-ins em pg_catalog antes de public.

revoke all privileges on all tables in schema public from anon;
revoke usage, select on all sequences in schema public from anon;

alter default privileges in schema public
  revoke all privileges on tables from anon;
alter default privileges in schema public
  revoke all privileges on sequences from anon;

drop policy if exists auditoria_leitura on public.auditoria_acesso;
create policy auditoria_leitura
on public.auditoria_acesso
for select
to authenticated
using (
  public.sou_admin()
  or private.sou_operacao_parceiro(parceiro_id)
);

drop policy if exists convites_gestao on public.convites_turma;
create policy convites_gestao
on public.convites_turma
for all
to authenticated
using (
  public.sou_admin()
  or private.sou_operacao_parceiro(parceiro_id)
)
with check (
  public.sou_admin()
  or private.sou_operacao_parceiro(parceiro_id)
);

drop policy if exists solicitacoes_gestao on public.solicitacoes_turma;
create policy solicitacoes_gestao
on public.solicitacoes_turma
for update
to authenticated
using (
  public.sou_admin()
  or private.sou_operacao_parceiro(parceiro_id)
)
with check (
  public.sou_admin()
  or private.sou_operacao_parceiro(parceiro_id)
);

drop policy if exists solicitacoes_leitura on public.solicitacoes_turma;
create policy solicitacoes_leitura
on public.solicitacoes_turma
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.sou_admin()
  or private.sou_operacao_parceiro(parceiro_id)
);

alter function public.alterar_status_curso_parceiro(uuid, text)
  set search_path = pg_catalog, public, pg_temp;

alter function public.definir_primeira_tentativa_simulado_oficial()
  set search_path = pg_catalog, public, pg_temp;

alter function public.duplicar_curso_parceiro(uuid)
  set search_path = pg_catalog, public, pg_temp;

alter function public.finalizar_simulado_oficial(uuid, jsonb, integer)
  set search_path = pg_catalog, public, pg_temp;

alter function public.iniciar_simulado_oficial(uuid)
  set search_path = pg_catalog, public, pg_temp;

alter function public.ranking_estudo(text, text)
  set search_path = pg_catalog, public, pg_temp;

alter function public.ranking_simulado_aluno(uuid)
  set search_path = pg_catalog, public, pg_temp;
