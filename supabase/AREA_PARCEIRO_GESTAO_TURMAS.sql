-- Área do Parceiro: gestão segura de convites e movimentação de alunos.

create or replace function public.alterar_status_convite_meu_parceiro(
  p_convite_id uuid,
  p_ativo boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_convite public.convites_turma%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  select * into v_convite
  from public.convites_turma
  where id = p_convite_id
  for update;

  if not found or not (public.sou_admin() or private.sou_gestor_parceiro(v_convite.parceiro_id)) then
    raise exception 'Convite não autorizado.';
  end if;

  update public.convites_turma
  set ativo = p_ativo,
      atualizado_em = now()
  where id = v_convite.id;

  insert into public.auditoria_acesso(parceiro_id, ator_id, evento, detalhes)
  values (
    v_convite.parceiro_id,
    auth.uid(),
    case when p_ativo then 'convite_reativado' else 'convite_revogado' end,
    jsonb_build_object('convite_id', v_convite.id, 'turma_id', v_convite.turma_id)
  );
end;
$$;

grant execute on function public.alterar_status_convite_meu_parceiro(uuid, boolean) to authenticated;

create or replace function public.mover_aluno_entre_turmas_meu_parceiro(
  p_licenca_id uuid,
  p_turma_destino_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_licenca public.licencas_acesso%rowtype;
  v_destino public.turmas%rowtype;
  v_turma_origem uuid;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  select * into v_licenca
  from public.licencas_acesso
  where id = p_licenca_id
  for update;

  if not found then
    raise exception 'Aluno não encontrado.';
  end if;

  if not (public.sou_admin() or private.sou_gestor_parceiro(v_licenca.parceiro_id)) then
    raise exception 'Aluno não autorizado para este parceiro.';
  end if;

  select * into v_destino
  from public.turmas
  where id = p_turma_destino_id
    and ativa;

  if not found then
    raise exception 'Turma de destino não encontrada ou inativa.';
  end if;

  if v_destino.parceiro_id <> v_licenca.parceiro_id then
    raise exception 'A transferência entre parceiros diferentes precisa ser feita pelo suporte.';
  end if;

  if v_licenca.turma_id = v_destino.id then
    return;
  end if;

  v_turma_origem := v_licenca.turma_id;

  update public.licencas_acesso
  set turma_id = v_destino.id,
      atualizado_em = now()
  where id = v_licenca.id;

  -- Mantém o histórico concluído e limpa somente o planejamento futuro da turma anterior.
  delete from public.cronograma_mentoria_tarefas
  where user_id = v_licenca.user_id
    and status in ('pendente', 'em_andamento', 'atrasado')
    and data >= current_date;

  insert into public.auditoria_acesso(
    parceiro_id,
    licenca_id,
    ator_id,
    usuario_afetado_id,
    evento,
    detalhes
  ) values (
    v_licenca.parceiro_id,
    v_licenca.id,
    auth.uid(),
    v_licenca.user_id,
    'aluno_movido_turma',
    jsonb_build_object(
      'turma_origem_id', v_turma_origem,
      'turma_destino_id', v_destino.id,
      'turma_destino_nome', v_destino.nome
    )
  );
end;
$$;

grant execute on function public.mover_aluno_entre_turmas_meu_parceiro(uuid, uuid) to authenticated;

-- Corrige a leitura da turma do próprio aluno. A política anterior comparava turma_id com o id da licença.
drop policy if exists turmas_leitura on public.turmas;
create policy turmas_leitura on public.turmas
for select
using (
  private.sou_gestor_parceiro(parceiro_id)
  or public.sou_admin()
  or exists (
    select 1
    from public.licencas_acesso l
    where l.turma_id = turmas.id
      and l.user_id = auth.uid()
  )
);
