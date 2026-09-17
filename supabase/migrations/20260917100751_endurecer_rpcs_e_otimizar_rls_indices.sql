-- Restringe RPCs privilegiados a usuários autenticados e service role.
revoke execute on function public.admin_atualizar_turma_parceiro(uuid, text, boolean) from public, anon;
grant execute on function public.admin_atualizar_turma_parceiro(uuid, text, boolean) to authenticated, service_role;

revoke execute on function public.admin_criar_parceria(text, text, integer) from public, anon;
grant execute on function public.admin_criar_parceria(text, text, integer) to authenticated, service_role;

revoke execute on function public.admin_criar_turma_parceiro(uuid, text, text, date, date) from public, anon;
grant execute on function public.admin_criar_turma_parceiro(uuid, text, text, date, date) to authenticated, service_role;

revoke execute on function public.admin_definir_usuario_parceiro(uuid, text, text, boolean) from public, anon;
grant execute on function public.admin_definir_usuario_parceiro(uuid, text, text, boolean) to authenticated, service_role;

revoke execute on function public.admin_listar_parcerias() from public, anon;
grant execute on function public.admin_listar_parcerias() to authenticated, service_role;

revoke execute on function public.alterar_status_convite_meu_parceiro(uuid, boolean) from public, anon;
grant execute on function public.alterar_status_convite_meu_parceiro(uuid, boolean) to authenticated, service_role;

revoke execute on function public.alterar_status_curso_parceiro(uuid, text) from public, anon;
grant execute on function public.alterar_status_curso_parceiro(uuid, text) to authenticated, service_role;

revoke execute on function public.concluir_acompanhamento_aluno_parceiro(uuid) from public, anon;
grant execute on function public.concluir_acompanhamento_aluno_parceiro(uuid) to authenticated, service_role;

revoke execute on function public.criar_acompanhamento_aluno_parceiro(uuid, text, text, boolean) from public, anon;
grant execute on function public.criar_acompanhamento_aluno_parceiro(uuid, text, text, boolean) to authenticated, service_role;

revoke execute on function public.duplicar_curso_parceiro(uuid) from public, anon;
grant execute on function public.duplicar_curso_parceiro(uuid) to authenticated, service_role;

revoke execute on function public.listar_acompanhamentos_aluno_parceiro(uuid) from public, anon;
grant execute on function public.listar_acompanhamentos_aluno_parceiro(uuid) to authenticated, service_role;

revoke execute on function public.mover_aluno_entre_turmas_meu_parceiro(uuid, uuid) from public, anon;
grant execute on function public.mover_aluno_entre_turmas_meu_parceiro(uuid, uuid) to authenticated, service_role;

revoke execute on function public.personalizar_meu_cronograma_mentoria(date, integer) from public, anon;
grant execute on function public.personalizar_meu_cronograma_mentoria(date, integer) to authenticated, service_role;

revoke execute on function public.voltar_meu_cronograma_para_turma(date, integer) from public, anon;
grant execute on function public.voltar_meu_cronograma_para_turma(date, integer) to authenticated, service_role;

-- consultar_convite é intencionalmente público: o código longo e hash validam o convite.
revoke execute on function public.consultar_convite(text) from public;
grant execute on function public.consultar_convite(text) to anon, authenticated, service_role;

-- Evita que novas funções criadas por postgres herdem EXECUTE anônimo via PUBLIC.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon;

-- Índices para FKs apontadas pelo advisor de performance.
create index if not exists acompanhamentos_parceiro_aluno_concluido_por_fk_idx
  on public.acompanhamentos_parceiro_aluno(concluido_por);
create index if not exists acompanhamentos_parceiro_aluno_criado_por_fk_idx
  on public.acompanhamentos_parceiro_aluno(criado_por);
create index if not exists acompanhamentos_parceiro_aluno_turma_id_fk_idx
  on public.acompanhamentos_parceiro_aluno(turma_id);
create index if not exists acompanhamentos_parceiro_aluno_user_id_fk_idx
  on public.acompanhamentos_parceiro_aluno(user_id);
create index if not exists auditoria_acesso_ator_id_fk_idx
  on public.auditoria_acesso(ator_id);
create index if not exists auditoria_acesso_licenca_id_fk_idx
  on public.auditoria_acesso(licenca_id);
create index if not exists auditoria_acesso_usuario_afetado_id_fk_idx
  on public.auditoria_acesso(usuario_afetado_id);
create index if not exists faturamento_parceiros_atualizado_por_fk_idx
  on public.faturamento_parceiros(atualizado_por);
create index if not exists faturamento_parceiros_fechado_por_fk_idx
  on public.faturamento_parceiros(fechado_por);
create index if not exists fundos_loja_criado_por_fk_idx
  on public.fundos_loja(criado_por);
create index if not exists licencas_acesso_criado_por_fk_idx
  on public.licencas_acesso(criado_por);
create index if not exists parceiro_usuarios_user_id_fk_idx
  on public.parceiro_usuarios(user_id);
create index if not exists parceiros_criado_por_fk_idx
  on public.parceiros(criado_por);
create index if not exists preferencias_cronograma_aluno_trilha_personalizada_fk_idx
  on public.preferencias_cronograma_aluno(trilha_personalizada_id);

-- Otimiza auth.uid()/sou_admin() como initPlan, preservando exatamente as regras atuais.
drop policy if exists perfis_leitura_parceiro on public.perfis;
create policy perfis_leitura_parceiro
on public.perfis
for select
to authenticated
using (
  id = (select auth.uid())
  or (select public.sou_admin())
  or exists (
    select 1
    from public.licencas_acesso l
    where l.user_id = perfis.id
      and private.sou_gestor_parceiro(l.parceiro_id)
  )
);

drop policy if exists questoes_catalogo_leitura on public.questoes_catalogo;
create policy questoes_catalogo_leitura
on public.questoes_catalogo
for select
to authenticated
using (
  status = 'ativa'
  or (status = 'pendente' and criado_por = (select auth.uid()))
  or (select public.sou_admin())
);

drop policy if exists parceiros_leitura_autorizada on public.parceiros;
create policy parceiros_leitura_autorizada
on public.parceiros
for select
to public
using (
  (select public.sou_admin())
  or private.sou_gestor_parceiro(id)
  or exists (
    select 1
    from public.licencas_acesso l
    where l.parceiro_id = parceiros.id
      and l.user_id = (select auth.uid())
  )
);

drop policy if exists parceiro_usuarios_leitura on public.parceiro_usuarios;
create policy parceiro_usuarios_leitura
on public.parceiro_usuarios
for select
to public
using (
  user_id = (select auth.uid())
  or (select public.sou_admin())
  or private.sou_operacao_parceiro(parceiro_id)
);

drop policy if exists turmas_leitura on public.turmas;
create policy turmas_leitura
on public.turmas
for select
to public
using (
  private.sou_gestor_parceiro(parceiro_id)
  or (select public.sou_admin())
  or exists (
    select 1
    from public.licencas_acesso l
    where l.turma_id = turmas.id
      and l.user_id = (select auth.uid())
  )
);

drop policy if exists licencas_leitura on public.licencas_acesso;
create policy licencas_leitura
on public.licencas_acesso
for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.sou_gestor_parceiro(parceiro_id)
  or (select public.sou_admin())
);
