alter table public.faturamento_parceiros
  add column if not exists status text not null default 'pendente',
  add column if not exists ajuste_centavos integer not null default 0,
  add column if not exists vencimento_em date,
  add column if not exists pago_em timestamptz,
  add column if not exists observacao text,
  add column if not exists atualizado_em timestamptz not null default now(),
  add column if not exists atualizado_por uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.faturamento_parceiros'::regclass
      and conname = 'faturamento_parceiros_status_check'
  ) then
    alter table public.faturamento_parceiros
      add constraint faturamento_parceiros_status_check
      check (status in ('pendente', 'pago', 'cancelado'));
  end if;
end $$;

update public.faturamento_parceiros
set valor_total_centavos = coalesce(valor_total_centavos, alunos_ativos * valor_unitario_centavos),
    atualizado_em = coalesce(atualizado_em, fechado_em)
where valor_total_centavos is null;

create or replace function public.fechar_faturamento_parceiro_admin(
  p_parceiro_id uuid,
  p_competencia date,
  p_ajuste_centavos integer default 0,
  p_vencimento_em date default null,
  p_observacao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_competencia date;
  v_proxima_competencia date;
  v_valor_unitario integer;
  v_alunos integer;
  v_id uuid;
  v_status text;
begin
  if auth.uid() is null or not public.sou_admin() then
    raise exception 'Apenas administradores podem fechar competências.';
  end if;

  if p_parceiro_id is null or p_competencia is null then
    raise exception 'Parceiro e competência são obrigatórios.';
  end if;

  v_competencia := date_trunc('month', p_competencia::timestamp)::date;
  v_proxima_competencia := (v_competencia + interval '1 month')::date;

  select valor_aluno_centavos
    into v_valor_unitario
  from public.parceiros
  where id = p_parceiro_id;

  if not found then
    raise exception 'Parceria não encontrada.';
  end if;

  select count(*)::integer
    into v_alunos
  from public.licencas_acesso l
  where l.parceiro_id = p_parceiro_id
    and l.status = 'ativa'
    and l.inicio_em < v_proxima_competencia::timestamptz
    and (l.expira_em is null or l.expira_em >= v_competencia::timestamptz);

  select id, status
    into v_id, v_status
  from public.faturamento_parceiros
  where parceiro_id = p_parceiro_id
    and competencia = v_competencia;

  if found and v_status = 'pago' then
    raise exception 'A competência já está paga. Volte o status para pendente antes de recalcular.';
  end if;

  insert into public.faturamento_parceiros (
    parceiro_id,
    competencia,
    alunos_ativos,
    valor_unitario_centavos,
    valor_total_centavos,
    fechado_em,
    fechado_por,
    status,
    ajuste_centavos,
    vencimento_em,
    pago_em,
    observacao,
    atualizado_em,
    atualizado_por
  ) values (
    p_parceiro_id,
    v_competencia,
    v_alunos,
    v_valor_unitario,
    v_alunos * v_valor_unitario,
    now(),
    auth.uid(),
    'pendente',
    coalesce(p_ajuste_centavos, 0),
    p_vencimento_em,
    null,
    nullif(trim(coalesce(p_observacao, '')), ''),
    now(),
    auth.uid()
  )
  on conflict (parceiro_id, competencia) do update
    set alunos_ativos = excluded.alunos_ativos,
        valor_unitario_centavos = excluded.valor_unitario_centavos,
        valor_total_centavos = excluded.valor_total_centavos,
        fechado_em = excluded.fechado_em,
        fechado_por = excluded.fechado_por,
        status = 'pendente',
        ajuste_centavos = excluded.ajuste_centavos,
        vencimento_em = excluded.vencimento_em,
        pago_em = null,
        observacao = excluded.observacao,
        atualizado_em = now(),
        atualizado_por = auth.uid()
  returning id into v_id;

  return jsonb_build_object(
    'sucesso', true,
    'id', v_id,
    'competencia', v_competencia,
    'alunos_ativos', v_alunos,
    'valor_unitario_centavos', v_valor_unitario,
    'valor_base_centavos', v_alunos * v_valor_unitario,
    'ajuste_centavos', coalesce(p_ajuste_centavos, 0),
    'valor_devido_centavos', greatest(0, (v_alunos * v_valor_unitario) + coalesce(p_ajuste_centavos, 0)),
    'status', 'pendente'
  );
end;
$$;

create or replace function public.atualizar_faturamento_parceiro_admin(
  p_faturamento_id uuid,
  p_status text,
  p_ajuste_centavos integer,
  p_vencimento_em date,
  p_observacao text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reg public.faturamento_parceiros%rowtype;
begin
  if auth.uid() is null or not public.sou_admin() then
    raise exception 'Apenas administradores podem atualizar o financeiro.';
  end if;

  if p_status not in ('pendente', 'pago', 'cancelado') then
    raise exception 'Status financeiro inválido.';
  end if;

  update public.faturamento_parceiros
  set status = p_status,
      ajuste_centavos = coalesce(p_ajuste_centavos, 0),
      vencimento_em = p_vencimento_em,
      observacao = nullif(trim(coalesce(p_observacao, '')), ''),
      pago_em = case
        when p_status = 'pago' then coalesce(pago_em, now())
        else null
      end,
      atualizado_em = now(),
      atualizado_por = auth.uid()
  where id = p_faturamento_id
  returning * into v_reg;

  if v_reg.id is null then
    raise exception 'Fechamento financeiro não encontrado.';
  end if;

  return jsonb_build_object(
    'sucesso', true,
    'id', v_reg.id,
    'status', v_reg.status,
    'valor_devido_centavos', greatest(0, coalesce(v_reg.valor_total_centavos, 0) + v_reg.ajuste_centavos),
    'pago_em', v_reg.pago_em
  );
end;
$$;

create or replace function public.listar_faturamento_parceiro_admin(p_parceiro_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.sou_admin() then
    raise exception 'Apenas administradores podem consultar este financeiro.';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', f.id,
        'parceiro_id', f.parceiro_id,
        'competencia', f.competencia,
        'alunos_ativos', f.alunos_ativos,
        'valor_unitario_centavos', f.valor_unitario_centavos,
        'valor_base_centavos', coalesce(f.valor_total_centavos, 0),
        'ajuste_centavos', f.ajuste_centavos,
        'valor_devido_centavos', greatest(0, coalesce(f.valor_total_centavos, 0) + f.ajuste_centavos),
        'status', f.status,
        'vencimento_em', f.vencimento_em,
        'pago_em', f.pago_em,
        'observacao', f.observacao,
        'fechado_em', f.fechado_em,
        'atualizado_em', f.atualizado_em
      ) order by f.competencia desc
    )
    from public.faturamento_parceiros f
    where f.parceiro_id = p_parceiro_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.listar_meu_faturamento_parceiro()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_parceiro_id uuid;
  v_papel text;
begin
  select pu.parceiro_id, pu.papel
    into v_parceiro_id, v_papel
  from public.parceiro_usuarios pu
  where pu.user_id = auth.uid()
    and pu.ativo
  order by case pu.papel when 'proprietario' then 1 when 'gestor' then 2 else 3 end
  limit 1;

  if v_parceiro_id is null or v_papel <> 'proprietario' then
    raise exception 'Somente o responsável principal pode consultar o financeiro da parceria.';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', f.id,
        'competencia', f.competencia,
        'alunos_ativos', f.alunos_ativos,
        'valor_unitario_centavos', f.valor_unitario_centavos,
        'valor_base_centavos', coalesce(f.valor_total_centavos, 0),
        'ajuste_centavos', f.ajuste_centavos,
        'valor_devido_centavos', greatest(0, coalesce(f.valor_total_centavos, 0) + f.ajuste_centavos),
        'status', f.status,
        'vencimento_em', f.vencimento_em,
        'pago_em', f.pago_em,
        'observacao', f.observacao,
        'fechado_em', f.fechado_em,
        'atualizado_em', f.atualizado_em
      ) order by f.competencia desc
    )
    from public.faturamento_parceiros f
    where f.parceiro_id = v_parceiro_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.fechar_faturamento_parceiro_admin(uuid,date,integer,date,text) from public;
revoke all on function public.atualizar_faturamento_parceiro_admin(uuid,text,integer,date,text) from public;
revoke all on function public.listar_faturamento_parceiro_admin(uuid) from public;
revoke all on function public.listar_meu_faturamento_parceiro() from public;

grant execute on function public.fechar_faturamento_parceiro_admin(uuid,date,integer,date,text) to authenticated;
grant execute on function public.atualizar_faturamento_parceiro_admin(uuid,text,integer,date,text) to authenticated;
grant execute on function public.listar_faturamento_parceiro_admin(uuid) to authenticated;
grant execute on function public.listar_meu_faturamento_parceiro() to authenticated;