-- Ranking completo do Study Pro.
-- Acrescenta visões semanais/mensais por turma ou gerais, ranking por simulado
-- e histórico mensal da posição do aluno. Métricas de outros usuários são
-- agregadas no servidor; as tabelas individuais continuam protegidas por RLS.

create index if not exists revisoes_user_conclusao_idx
on public.revisoes (user_id, data_conclusao desc)
where concluida = true;

create index if not exists simulados_oficiais_tentativas_ranking_periodo_idx
on public.simulados_oficiais_tentativas (usuario_id, finalizada_em desc)
where conta_ranking = true and finalizada = true;

create index if not exists licencas_acesso_turma_status_user_idx
on public.licencas_acesso (turma_id, status, user_id);

create or replace function public.ranking_estudo(
  p_periodo text default 'mes',
  p_escopo text default 'geral'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user uuid := auth.uid();
  v_periodo text := case when lower(coalesce(p_periodo,'')) = 'semana' then 'semana' else 'mes' end;
  v_escopo text := case when lower(coalesce(p_escopo,'')) = 'turma' then 'turma' else 'geral' end;
  v_inicio timestamptz;
  v_fim timestamptz := now();
  v_turma uuid;
  v_turma_nome text;
  v_parceiro_nome text;
  v_resultado jsonb;
begin
  if v_user is null then
    raise exception 'Usuário não autenticado.';
  end if;

  v_inicio := case
    when v_periodo = 'semana' then date_trunc('week', now())
    else date_trunc('month', now())
  end;

  if v_escopo = 'turma' then
    select l.turma_id, t.nome, p.nome
      into v_turma, v_turma_nome, v_parceiro_nome
    from public.licencas_acesso l
    join public.turmas t on t.id = l.turma_id
    join public.parceiros p on p.id = l.parceiro_id
    where l.user_id = v_user
      and l.status = 'ativa'
      and l.inicio_em <= now()
      and (l.expira_em is null or l.expira_em > now())
      and l.turma_id is not null
    order by l.inicio_em desc
    limit 1;

    if v_turma is null then
      raise exception 'Você não possui uma turma ativa para este ranking.';
    end if;
  end if;

  with usuarios as (
    select p.id as user_id
    from public.perfis p
    where v_escopo = 'geral'
       or exists (
         select 1
         from public.licencas_acesso le
         where le.user_id = p.id
           and le.turma_id = v_turma
           and le.status = 'ativa'
           and le.inicio_em <= now()
           and (le.expira_em is null or le.expira_em > now())
       )
  ),
  sessoes as (
    select s.user_id, coalesce(sum(greatest(0, s.minutos)),0)::int as minutos
    from public.sessoes_estudo s
    join usuarios u on u.user_id = s.user_id
    where s.data >= v_inicio and s.data <= v_fim
    group by s.user_id
  ),
  questoes as (
    select q.user_id,
      coalesce(sum(greatest(0, q.minutos)),0)::int as minutos,
      coalesce(sum(greatest(0, q.certas)),0)::int as certas,
      coalesce(sum(greatest(0, q.erradas)),0)::int as erradas,
      coalesce(sum(
        case
          when coalesce(q.dados->>'emBranco','') ~ '^[0-9]+$' then (q.dados->>'emBranco')::int
          else 0
        end
      ),0)::int as em_branco
    from public.registros_questoes q
    join usuarios u on u.user_id = q.user_id
    where q.data >= v_inicio and q.data <= v_fim
    group by q.user_id
  ),
  revisoes as (
    select r.user_id, count(*)::int as total
    from public.revisoes r
    join usuarios u on u.user_id = r.user_id
    where r.concluida = true
      and r.data_conclusao >= v_inicio and r.data_conclusao <= v_fim
    group by r.user_id
  ),
  simulados_locais as (
    select s.user_id,
      count(*)::int as total,
      coalesce(sum(greatest(0,s.minutos)),0)::int as minutos,
      coalesce(sum(greatest(0,s.certas)),0)::int as certas,
      coalesce(sum(greatest(0,s.erradas)),0)::int as erradas,
      coalesce(sum(greatest(0,s.em_branco)),0)::int as em_branco,
      coalesce(sum(
        10 + case
          when (greatest(0,s.certas)::numeric / greatest(1, greatest(0,s.certas)+greatest(0,s.erradas)+greatest(0,s.em_branco))::numeric) >= 0.80 then 10
          when (greatest(0,s.certas)::numeric / greatest(1, greatest(0,s.certas)+greatest(0,s.erradas)+greatest(0,s.em_branco))::numeric) >= 0.60 then 5
          else 0
        end
      ),0)::int as xp_simulados
    from public.simulados s
    join usuarios u on u.user_id = s.user_id
    where s.data >= v_inicio and s.data <= v_fim
    group by s.user_id
  ),
  simulados_oficiais as (
    select st.usuario_id as user_id,
      count(*)::int as total,
      coalesce(sum(greatest(0,st.minutos_gastos)),0)::int as minutos,
      coalesce(sum(greatest(0,coalesce((st.resultado->>'certas')::int,0))),0)::int as certas,
      coalesce(sum(greatest(0,coalesce((st.resultado->>'erradas')::int,0))),0)::int as erradas,
      coalesce(sum(greatest(0,coalesce((st.resultado->>'emBranco')::int,0))),0)::int as em_branco,
      coalesce(sum(
        10 + case
          when (greatest(0,coalesce((st.resultado->>'certas')::int,0))::numeric /
                greatest(1,
                  greatest(0,coalesce((st.resultado->>'certas')::int,0)) +
                  greatest(0,coalesce((st.resultado->>'erradas')::int,0)) +
                  greatest(0,coalesce((st.resultado->>'emBranco')::int,0))
                )::numeric) >= 0.80 then 10
          when (greatest(0,coalesce((st.resultado->>'certas')::int,0))::numeric /
                greatest(1,
                  greatest(0,coalesce((st.resultado->>'certas')::int,0)) +
                  greatest(0,coalesce((st.resultado->>'erradas')::int,0)) +
                  greatest(0,coalesce((st.resultado->>'emBranco')::int,0))
                )::numeric) >= 0.60 then 5
          else 0
        end
      ),0)::int as xp_simulados
    from public.simulados_oficiais_tentativas st
    join usuarios u on u.user_id = st.usuario_id
    where st.conta_ranking = true
      and st.finalizada = true
      and st.finalizada_em >= v_inicio and st.finalizada_em <= v_fim
    group by st.usuario_id
  ),
  agregado as (
    select u.user_id,
      coalesce(se.minutos,0) + coalesce(q.minutos,0) + coalesce(sl.minutos,0) + coalesce(so.minutos,0) as minutos,
      coalesce(q.certas,0) + coalesce(sl.certas,0) + coalesce(so.certas,0) as acertos,
      coalesce(q.erradas,0) + coalesce(sl.erradas,0) + coalesce(so.erradas,0) as erradas,
      coalesce(q.em_branco,0) + coalesce(sl.em_branco,0) + coalesce(so.em_branco,0) as em_branco,
      coalesce(rv.total,0) as revisoes,
      coalesce(sl.total,0) + coalesce(so.total,0) as simulados,
      coalesce(sl.xp_simulados,0) + coalesce(so.xp_simulados,0) as xp_simulados
    from usuarios u
    left join sessoes se on se.user_id=u.user_id
    left join questoes q on q.user_id=u.user_id
    left join revisoes rv on rv.user_id=u.user_id
    left join simulados_locais sl on sl.user_id=u.user_id
    left join simulados_oficiais so on so.user_id=u.user_id
  ),
  com_xp as (
    select a.*,
      (a.acertos + a.erradas + a.em_branco) as questoes,
      least(1000000,
        floor(a.minutos / 10.0)::int +
        floor((a.acertos + a.erradas + a.em_branco) / 10.0)::int * 2 +
        floor(a.acertos / 10.0)::int * 2 +
        a.revisoes * 5 + a.xp_simulados
      ) as xp
    from agregado a
    where a.minutos > 0 or a.acertos > 0 or a.erradas > 0 or a.em_branco > 0 or a.revisoes > 0 or a.simulados > 0
  ),
  linhas as (
    select x.*,
      coalesce(nullif(rm.nome_publico,''), nullif(pf.nome,''), split_part(coalesce(pf.email,'Usuário'),'@',1), 'Usuário') as nome,
      coalesce(ctx.turma,'Study Pro') as turma,
      coalesce(ctx.parceiro,'Study Pro') as parceiro
    from com_xp x
    left join public.perfis pf on pf.id=x.user_id
    left join lateral (
      select r.nome_publico
      from public.ranking_mensal r
      where r.user_id=x.user_id
      order by r.mes desc
      limit 1
    ) rm on true
    left join lateral (
      select t.nome as turma, p.nome as parceiro
      from public.licencas_acesso l
      join public.turmas t on t.id=l.turma_id
      join public.parceiros p on p.id=l.parceiro_id
      where l.user_id=x.user_id
        and l.status='ativa'
        and l.inicio_em<=now()
        and (l.expira_em is null or l.expira_em>now())
      order by l.inicio_em desc
      limit 1
    ) ctx on true
  ),
  ranqueado as (
    select l.*,
      row_number() over(order by l.xp desc, l.minutos desc, l.acertos desc, l.user_id) as posicao,
      count(*) over() as participantes
    from linhas l
  )
  select jsonb_build_object(
    'periodo',v_periodo,
    'escopo',v_escopo,
    'inicio',v_inicio,
    'fim',v_fim,
    'turma',v_turma_nome,
    'parceiro',v_parceiro_nome,
    'participantes',coalesce((select max(participantes) from ranqueado),0),
    'minha_posicao',(select posicao from ranqueado where user_id=v_user),
    'ranking',coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id',r.user_id,
        'nome',r.nome,
        'turma',r.turma,
        'parceiro',r.parceiro,
        'minutos',r.minutos,
        'questoes',r.questoes,
        'acertos',r.acertos,
        'erradas',r.erradas,
        'em_branco',r.em_branco,
        'revisoes',r.revisoes,
        'simulados',r.simulados,
        'xp',r.xp,
        'posicao',r.posicao,
        'top5',(r.posicao <= 5)
      ) order by r.posicao)
      from ranqueado r
      where r.posicao <= 100
    ),'[]'::jsonb)
  ) into v_resultado;

  return v_resultado;
end
$$;

revoke all on function public.ranking_estudo(text,text) from public, anon;
grant execute on function public.ranking_estudo(text,text) to authenticated, service_role;

create or replace function public.ranking_simulado_aluno(p_simulado_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_user uuid := auth.uid();
  v_sim public.simulados_oficiais%rowtype;
  v_pode_gerir boolean := false;
  v_resultado jsonb;
begin
  if v_user is null then raise exception 'Usuário não autenticado.'; end if;

  select * into v_sim from public.simulados_oficiais where id=p_simulado_id;
  if not found then raise exception 'Simulado não encontrado.'; end if;

  v_pode_gerir := public.sou_admin()
    or (v_sim.parceiro_id is not null and private.sou_gestor_parceiro(v_sim.parceiro_id));

  if not v_pode_gerir and not exists (
    select 1 from public.simulados_oficiais_tentativas st
    where st.simulado_id=p_simulado_id
      and st.usuario_id=v_user
      and st.conta_ranking=true
      and st.finalizada=true
  ) then
    raise exception 'Finalize sua primeira tentativa oficial para entrar no ranking.';
  end if;

  if not v_pode_gerir and v_sim.resultado_liberado_em is not null and v_sim.resultado_liberado_em > now() then
    raise exception 'O ranking será liberado junto com o resultado.';
  end if;

  with base as (
    select st.usuario_id,
      coalesce(nullif(rm.nome_publico,''),nullif(pf.nome,''),split_part(coalesce(pf.email,'Aluno'),'@',1),'Aluno') as nome,
      coalesce(ctx.turma,'Sem turma') as turma,
      coalesce(ctx.parceiro,'Study Pro') as parceiro,
      greatest(0,coalesce((st.resultado->>'certas')::int,0)) as certas,
      greatest(0,coalesce((st.resultado->>'erradas')::int,0)) as erradas,
      greatest(0,coalesce((st.resultado->>'emBranco')::int,0)) as em_branco,
      greatest(0,coalesce(st.minutos_gastos,0)) as minutos,
      st.finalizada_em
    from public.simulados_oficiais_tentativas st
    left join public.perfis pf on pf.id=st.usuario_id
    left join lateral (
      select r.nome_publico from public.ranking_mensal r
      where r.user_id=st.usuario_id order by r.mes desc limit 1
    ) rm on true
    left join lateral (
      select t.nome as turma, p.nome as parceiro
      from public.licencas_acesso l
      join public.turmas t on t.id=l.turma_id
      join public.parceiros p on p.id=l.parceiro_id
      where l.user_id=st.usuario_id
        and (v_sim.parceiro_id is null or l.parceiro_id=v_sim.parceiro_id)
      order by l.inicio_em desc limit 1
    ) ctx on true
    where st.simulado_id=p_simulado_id
      and st.conta_ranking=true
      and st.finalizada=true
  ),
  ranqueado as (
    select b.*,
      row_number() over(order by b.certas desc, b.minutos asc, b.finalizada_em asc, b.usuario_id) as posicao,
      count(*) over() as participantes
    from base b
  ),
  premiado as (
    select r.*,
      (
        select item->>'premio'
        from jsonb_array_elements(coalesce(v_sim.bonificacoes,'[]'::jsonb)) item
        where item->>'posicao'=r.posicao::text
        limit 1
      ) as premio
    from ranqueado r
  )
  select jsonb_build_object(
    'simulado_id',v_sim.id,
    'simulado',v_sim.nome,
    'participantes',coalesce((select max(participantes) from premiado),0),
    'minha_posicao',(select posicao from premiado where usuario_id=v_user),
    'meu_premio',(select premio from premiado where usuario_id=v_user),
    'ranking',coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id',r.usuario_id,
        'nome',r.nome,
        'turma',r.turma,
        'parceiro',r.parceiro,
        'certas',r.certas,
        'erradas',r.erradas,
        'em_branco',r.em_branco,
        'minutos',r.minutos,
        'posicao',r.posicao,
        'premio',r.premio,
        'top5',(r.posicao <= 5)
      ) order by r.posicao)
      from premiado r
      where r.posicao <= 100
    ),'[]'::jsonb)
  ) into v_resultado;

  return v_resultado;
end
$$;

revoke all on function public.ranking_simulado_aluno(uuid) from public, anon;
grant execute on function public.ranking_simulado_aluno(uuid) to authenticated, service_role;

create or replace function public.historico_meu_ranking(p_limite integer default 6)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_catalog
as $$
declare
  v_user uuid := auth.uid();
  v_limite integer := greatest(1,least(coalesce(p_limite,6),24));
  v_resultado jsonb;
begin
  if v_user is null then raise exception 'Usuário não autenticado.'; end if;

  with ranqueado as (
    select r.*,
      row_number() over(partition by r.mes order by r.xp desc,r.minutos desc,r.acertos desc,r.user_id) as posicao,
      count(*) over(partition by r.mes) as participantes
    from public.ranking_mensal r
  ),
  meu as (
    select * from ranqueado
    where user_id=v_user
    order by mes desc
    limit v_limite
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'mes',mes,
    'posicao',posicao,
    'participantes',participantes,
    'xp',xp,
    'minutos',minutos,
    'questoes',questoes,
    'acertos',acertos,
    'revisoes',revisoes,
    'simulados',simulados
  ) order by mes desc),'[]'::jsonb)
  into v_resultado
  from meu;

  return v_resultado;
end
$$;

revoke all on function public.historico_meu_ranking(integer) from public, anon;
grant execute on function public.historico_meu_ranking(integer) to authenticated, service_role;
