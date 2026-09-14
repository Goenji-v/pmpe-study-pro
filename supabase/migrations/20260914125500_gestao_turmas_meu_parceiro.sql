create or replace function public.listar_turmas_meu_parceiro()
returns table (
  id uuid,
  nome text,
  codigo text,
  inicia_em date,
  encerra_em date,
  ativa boolean,
  alunos_ativos bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_parceiro_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  select pu.parceiro_id
    into v_parceiro_id
  from public.parceiro_usuarios pu
  join public.parceiros p on p.id = pu.parceiro_id
  where pu.user_id = auth.uid()
    and pu.ativo
    and p.status = 'ativo'
    and pu.papel in ('proprietario', 'gestor', 'professor')
  order by case pu.papel when 'proprietario' then 1 when 'gestor' then 2 else 3 end
  limit 1;

  if v_parceiro_id is null then
    raise exception 'Perfil de parceiro não encontrado.';
  end if;

  return query
  select
    t.id,
    t.nome,
    t.codigo,
    t.inicia_em,
    t.encerra_em,
    t.ativa,
    count(l.id) filter (
      where l.status = 'ativa'
        and l.inicio_em <= now()
        and (l.expira_em is null or l.expira_em > now())
    ) as alunos_ativos
  from public.turmas t
  left join public.licencas_acesso l
    on l.turma_id = t.id
   and l.parceiro_id = t.parceiro_id
  where t.parceiro_id = v_parceiro_id
  group by t.id, t.nome, t.codigo, t.inicia_em, t.encerra_em, t.ativa, t.criado_em
  order by t.ativa desc, t.criado_em desc;
end;
$$;

create or replace function public.criar_turma_meu_parceiro(
  p_nome text,
  p_codigo text default null,
  p_inicia_em date default null,
  p_encerra_em date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parceiro_id uuid;
  v_id uuid;
  v_nome text := trim(coalesce(p_nome, ''));
  v_codigo text := nullif(trim(coalesce(p_codigo, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  select pu.parceiro_id
    into v_parceiro_id
  from public.parceiro_usuarios pu
  join public.parceiros p on p.id = pu.parceiro_id
  where pu.user_id = auth.uid()
    and pu.ativo
    and p.status = 'ativo'
    and pu.papel in ('proprietario', 'gestor', 'professor')
  order by case pu.papel when 'proprietario' then 1 when 'gestor' then 2 else 3 end
  limit 1;

  if v_parceiro_id is null then
    raise exception 'Perfil de parceiro não encontrado.';
  end if;
  if length(v_nome) < 2 or length(v_nome) > 160 then
    raise exception 'Nome da turma inválido.';
  end if;
  if v_codigo is not null and length(v_codigo) > 80 then
    raise exception 'Código da turma inválido.';
  end if;
  if p_inicia_em is not null and p_encerra_em is not null and p_encerra_em < p_inicia_em then
    raise exception 'A data de encerramento deve ser posterior ao início.';
  end if;

  insert into public.turmas(parceiro_id, nome, codigo, inicia_em, encerra_em)
  values(v_parceiro_id, v_nome, v_codigo, p_inicia_em, p_encerra_em)
  returning id into v_id;

  insert into public.auditoria_acesso(parceiro_id, ator_id, evento, detalhes)
  values(
    v_parceiro_id,
    auth.uid(),
    'turma_criada',
    jsonb_build_object('turma_id', v_id, 'nome', v_nome, 'origem', 'parceiro')
  );

  return v_id;
exception
  when unique_violation then
    raise exception 'Já existe uma turma com esse código nesta parceria.';
end;
$$;

create or replace function public.atualizar_turma_meu_parceiro(
  p_turma_id uuid,
  p_nome text,
  p_codigo text default null,
  p_inicia_em date default null,
  p_encerra_em date default null,
  p_ativa boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_turma public.turmas%rowtype;
  v_nome text := trim(coalesce(p_nome, ''));
  v_codigo text := nullif(trim(coalesce(p_codigo, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  select t.* into v_turma
  from public.turmas t
  where t.id = p_turma_id;

  if not found then
    raise exception 'Turma não encontrada.';
  end if;
  if not private.sou_gestor_parceiro(v_turma.parceiro_id) then
    raise exception 'Você não pode alterar esta turma.';
  end if;
  if length(v_nome) < 2 or length(v_nome) > 160 then
    raise exception 'Nome da turma inválido.';
  end if;
  if v_codigo is not null and length(v_codigo) > 80 then
    raise exception 'Código da turma inválido.';
  end if;
  if p_inicia_em is not null and p_encerra_em is not null and p_encerra_em < p_inicia_em then
    raise exception 'A data de encerramento deve ser posterior ao início.';
  end if;

  update public.turmas
  set nome = v_nome,
      codigo = v_codigo,
      inicia_em = p_inicia_em,
      encerra_em = p_encerra_em,
      ativa = p_ativa,
      atualizado_em = now()
  where id = p_turma_id;

  insert into public.auditoria_acesso(parceiro_id, ator_id, evento, detalhes)
  values(
    v_turma.parceiro_id,
    auth.uid(),
    'turma_atualizada',
    jsonb_build_object(
      'turma_id', p_turma_id,
      'nome', v_nome,
      'codigo', v_codigo,
      'ativa', p_ativa,
      'origem', 'parceiro'
    )
  );
exception
  when unique_violation then
    raise exception 'Já existe uma turma com esse código nesta parceria.';
end;
$$;

create or replace function public.duplicar_turma_meu_parceiro(
  p_turma_id uuid,
  p_nome text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_turma public.turmas%rowtype;
  v_nova_turma_id uuid;
  v_trilha public.trilhas_mentoria%rowtype;
  v_nova_trilha_id uuid;
  v_nome text := trim(coalesce(p_nome, ''));
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  select t.* into v_turma
  from public.turmas t
  where t.id = p_turma_id;

  if not found then
    raise exception 'Turma não encontrada.';
  end if;
  if not private.sou_gestor_parceiro(v_turma.parceiro_id) then
    raise exception 'Você não pode duplicar esta turma.';
  end if;
  if length(v_nome) < 2 or length(v_nome) > 160 then
    raise exception 'Nome da nova turma inválido.';
  end if;

  insert into public.turmas(
    parceiro_id, nome, codigo, inicia_em, encerra_em, ativa
  )
  values(
    v_turma.parceiro_id, v_nome, null, v_turma.inicia_em, v_turma.encerra_em, true
  )
  returning id into v_nova_turma_id;

  insert into public.curso_parceiro_turmas(curso_id, turma_id, ativo, liberado_em, criado_por)
  select ct.curso_id, v_nova_turma_id, true, now(), auth.uid()
  from public.curso_parceiro_turmas ct
  where ct.turma_id = p_turma_id
    and ct.ativo;

  select tr.* into v_trilha
  from public.trilhas_mentoria tr
  where tr.turma_id = p_turma_id
    and tr.ativa
  order by tr.criado_em desc
  limit 1;

  if found then
    insert into public.trilhas_mentoria(
      parceiro_id,
      turma_id,
      nome,
      ativa,
      minutos_padrao,
      materias_por_dia,
      questoes_por_sessao,
      revisoes_por_dia,
      criado_por,
      intervalos_revisao,
      simulado_cada_dias,
      percentual_teoria
    )
    values(
      v_trilha.parceiro_id,
      v_nova_turma_id,
      v_trilha.nome,
      true,
      v_trilha.minutos_padrao,
      v_trilha.materias_por_dia,
      v_trilha.questoes_por_sessao,
      v_trilha.revisoes_por_dia,
      auth.uid(),
      v_trilha.intervalos_revisao,
      v_trilha.simulado_cada_dias,
      v_trilha.percentual_teoria
    )
    returning id into v_nova_trilha_id;

    insert into public.trilha_mentoria_itens(
      trilha_id,
      materia,
      assunto,
      ordem,
      ativo,
      minutos_estimados,
      questoes_alvo,
      prioridade,
      obrigatorio,
      tipo,
      instrucoes,
      material_url
    )
    select
      v_nova_trilha_id,
      item.materia,
      item.assunto,
      item.ordem,
      item.ativo,
      item.minutos_estimados,
      item.questoes_alvo,
      item.prioridade,
      item.obrigatorio,
      item.tipo,
      item.instrucoes,
      item.material_url
    from public.trilha_mentoria_itens item
    where item.trilha_id = v_trilha.id;
  end if;

  insert into public.auditoria_acesso(parceiro_id, ator_id, evento, detalhes)
  values(
    v_turma.parceiro_id,
    auth.uid(),
    'turma_criada',
    jsonb_build_object(
      'turma_id', v_nova_turma_id,
      'nome', v_nome,
      'duplicada_de', p_turma_id,
      'origem', 'parceiro'
    )
  );

  return v_nova_turma_id;
end;
$$;

revoke all on function public.listar_turmas_meu_parceiro() from public, anon;
revoke all on function public.criar_turma_meu_parceiro(text, text, date, date) from public, anon;
revoke all on function public.atualizar_turma_meu_parceiro(uuid, text, text, date, date, boolean) from public, anon;
revoke all on function public.duplicar_turma_meu_parceiro(uuid, text) from public, anon;

grant execute on function public.listar_turmas_meu_parceiro() to authenticated;
grant execute on function public.criar_turma_meu_parceiro(text, text, date, date) to authenticated;
grant execute on function public.atualizar_turma_meu_parceiro(uuid, text, text, date, date, boolean) to authenticated;
grant execute on function public.duplicar_turma_meu_parceiro(uuid, text) to authenticated;
