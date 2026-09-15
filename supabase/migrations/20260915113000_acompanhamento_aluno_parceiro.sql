create table if not exists public.acompanhamentos_parceiro_aluno (
  id uuid primary key default gen_random_uuid(),
  parceiro_id uuid not null references public.parceiros(id) on delete cascade,
  turma_id uuid references public.turmas(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null,
  texto text not null,
  status text not null default 'aberto',
  enviado_ao_aluno boolean not null default false,
  criado_por uuid not null references auth.users(id) on delete restrict,
  criado_em timestamptz not null default now(),
  concluido_por uuid references auth.users(id) on delete set null,
  concluido_em timestamptz,
  atualizado_em timestamptz not null default now(),
  constraint acompanhamentos_parceiro_aluno_tipo_check
    check (tipo in ('observacao', 'plano_acao', 'orientacao')),
  constraint acompanhamentos_parceiro_aluno_status_check
    check (status in ('aberto', 'concluido')),
  constraint acompanhamentos_parceiro_aluno_texto_check
    check (char_length(btrim(texto)) between 3 and 2000)
);

create index if not exists acompanhamentos_parceiro_aluno_busca_idx
  on public.acompanhamentos_parceiro_aluno (parceiro_id, user_id, criado_em desc);

alter table public.acompanhamentos_parceiro_aluno enable row level security;

revoke all on table public.acompanhamentos_parceiro_aluno from anon, authenticated;

create or replace function public.listar_acompanhamentos_aluno_parceiro(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_parceiro_id uuid;
begin
  select pu.parceiro_id
    into v_parceiro_id
  from public.parceiro_usuarios pu
  where pu.user_id = auth.uid()
    and pu.ativo
    and pu.papel in ('proprietario', 'gestor', 'professor')
  order by case pu.papel when 'proprietario' then 1 when 'gestor' then 2 else 3 end
  limit 1;

  if v_parceiro_id is null then
    raise exception 'Perfil de parceiro não encontrado.';
  end if;

  if not exists (
    select 1
    from public.licencas_acesso l
    where l.parceiro_id = v_parceiro_id
      and l.user_id = p_user_id
  ) then
    raise exception 'Aluno não pertence a esta parceria.';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'tipo', a.tipo,
        'texto', a.texto,
        'status', a.status,
        'enviado_ao_aluno', a.enviado_ao_aluno,
        'criado_em', a.criado_em,
        'criado_por_nome', coalesce(p.nome, 'Equipe da mentoria'),
        'concluido_em', a.concluido_em
      )
      order by a.criado_em desc
    )
    from public.acompanhamentos_parceiro_aluno a
    left join public.perfis p on p.id = a.criado_por
    where a.parceiro_id = v_parceiro_id
      and a.user_id = p_user_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.criar_acompanhamento_aluno_parceiro(
  p_user_id uuid,
  p_tipo text,
  p_texto text,
  p_enviar_aluno boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parceiro_id uuid;
  v_turma_id uuid;
  v_texto text;
  v_id uuid;
begin
  select pu.parceiro_id
    into v_parceiro_id
  from public.parceiro_usuarios pu
  where pu.user_id = auth.uid()
    and pu.ativo
    and pu.papel in ('proprietario', 'gestor', 'professor')
  order by case pu.papel when 'proprietario' then 1 when 'gestor' then 2 else 3 end
  limit 1;

  if v_parceiro_id is null then
    raise exception 'Perfil de parceiro não encontrado.';
  end if;

  if p_tipo not in ('observacao', 'plano_acao', 'orientacao') then
    raise exception 'Tipo de acompanhamento inválido.';
  end if;

  v_texto := btrim(coalesce(p_texto, ''));
  if char_length(v_texto) < 3 or char_length(v_texto) > 2000 then
    raise exception 'O texto deve ter entre 3 e 2000 caracteres.';
  end if;

  select l.turma_id
    into v_turma_id
  from public.licencas_acesso l
  where l.parceiro_id = v_parceiro_id
    and l.user_id = p_user_id
    and l.status in ('ativa', 'suspensa', 'pendente')
  order by l.atualizado_em desc nulls last, l.criado_em desc
  limit 1;

  if not found then
    raise exception 'Aluno não possui vínculo ativo com esta parceria.';
  end if;

  if coalesce(p_enviar_aluno, false) and p_tipo <> 'orientacao' then
    raise exception 'Somente orientações podem ser enviadas ao aluno.';
  end if;

  insert into public.acompanhamentos_parceiro_aluno (
    parceiro_id,
    turma_id,
    user_id,
    tipo,
    texto,
    enviado_ao_aluno,
    criado_por
  ) values (
    v_parceiro_id,
    v_turma_id,
    p_user_id,
    p_tipo,
    v_texto,
    coalesce(p_enviar_aluno, false),
    auth.uid()
  )
  returning id into v_id;

  if coalesce(p_enviar_aluno, false) then
    insert into public.notificacoes (user_id, tipo, titulo, mensagem, rota)
    values (
      p_user_id,
      'mentoria',
      'Orientação da sua mentoria',
      v_texto,
      '/cronograma-ia'
    );
  end if;

  return jsonb_build_object('id', v_id, 'sucesso', true);
end;
$$;

create or replace function public.concluir_acompanhamento_aluno_parceiro(p_acompanhamento_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parceiro_id uuid;
  v_id uuid;
begin
  select pu.parceiro_id
    into v_parceiro_id
  from public.parceiro_usuarios pu
  where pu.user_id = auth.uid()
    and pu.ativo
    and pu.papel in ('proprietario', 'gestor', 'professor')
  order by case pu.papel when 'proprietario' then 1 when 'gestor' then 2 else 3 end
  limit 1;

  if v_parceiro_id is null then
    raise exception 'Perfil de parceiro não encontrado.';
  end if;

  update public.acompanhamentos_parceiro_aluno a
  set status = 'concluido',
      concluido_em = coalesce(a.concluido_em, now()),
      concluido_por = coalesce(a.concluido_por, auth.uid()),
      atualizado_em = now()
  where a.id = p_acompanhamento_id
    and a.parceiro_id = v_parceiro_id
    and a.status = 'aberto'
  returning a.id into v_id;

  if v_id is null then
    raise exception 'Acompanhamento não encontrado ou já concluído.';
  end if;

  return jsonb_build_object('id', v_id, 'sucesso', true);
end;
$$;

revoke all on function public.listar_acompanhamentos_aluno_parceiro(uuid) from public;
revoke all on function public.criar_acompanhamento_aluno_parceiro(uuid,text,text,boolean) from public;
revoke all on function public.concluir_acompanhamento_aluno_parceiro(uuid) from public;

grant execute on function public.listar_acompanhamentos_aluno_parceiro(uuid) to authenticated;
grant execute on function public.criar_acompanhamento_aluno_parceiro(uuid,text,text,boolean) to authenticated;
grant execute on function public.concluir_acompanhamento_aluno_parceiro(uuid) to authenticated;