-- O estado sincronizado em configuracoes.appState é a fonte canônica do histórico do aluno.
-- O dashboard do parceiro passa a ler esse estado diretamente para não mostrar KPIs zerados
-- quando o ranking já contém atividade sincronizada. Tentativas oficiais server-side entram
-- como complemento, com deduplicação pelo id da tentativa.

create or replace function public.dashboard_meu_parceiro()
returns jsonb
language plpgsql
stable security definer
set search_path to ''
as $function$
declare
  v_parceiro_id uuid;
  v_parceiro_nome text;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  select pu.parceiro_id, p.nome
    into v_parceiro_id, v_parceiro_nome
  from public.parceiro_usuarios pu
  join public.parceiros p on p.id = pu.parceiro_id
  where pu.user_id = auth.uid()
    and pu.ativo
    and pu.papel in ('proprietario','gestor','professor')
  order by case pu.papel when 'proprietario' then 1 when 'gestor' then 2 else 3 end
  limit 1;

  if v_parceiro_id is null then
    raise exception 'Perfil de professor/parceiro não encontrado.';
  end if;

  with alunos as (
    select distinct on (l.user_id)
      l.user_id,
      l.turma_id,
      coalesce(pf.nome,'Aluno') as nome,
      coalesce(pf.email,'') as email,
      l.inicio_em,
      l.expira_em,
      case
        when l.status='ativa' and l.expira_em is not null and l.expira_em<=now() then 'expirada'
        else l.status
      end as status
    from public.licencas_acesso l
    left join public.perfis pf on pf.id=l.user_id
    where l.parceiro_id=v_parceiro_id
    order by l.user_id,l.criado_em desc
  ),
  ativos as (
    select *
    from alunos
    where status='ativa'
      and inicio_em<=now()
      and (expira_em is null or expira_em>now())
  ),
  estados as (
    select
      a.*,
      coalesce(c.dados->'appState','{}'::jsonb) as estado
    from ativos a
    left join public.configuracoes c on c.user_id=a.user_id
  ),
  simulados_locais_raw as (
    select e.user_id, s.obj
    from estados e
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(e.estado->'simulados')='array' then e.estado->'simulados' else '[]'::jsonb end
    ) s(obj)
  ),
  sim_ids_all as (
    select user_id, id
    from (
      select user_id, nullif(obj->>'id','') as id from simulados_locais_raw
      union all
      select user_id, nullif(obj->>'tentativaId','') as id from simulados_locais_raw
    ) x
    where id is not null
  ),
  sessoes_eventos as (
    select
      e.user_id,
      nullif(s.obj->>'data','')::timestamptz as momento,
      greatest(0,coalesce(nullif(s.obj->>'minutos','')::int,0)) as minutos
    from estados e
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(e.estado->'sessoes')='array' then e.estado->'sessoes' else '[]'::jsonb end
    ) s(obj)
    where nullif(s.obj->>'data','') is not null
  ),
  questoes_eventos as (
    select
      e.user_id,
      nullif(q.obj->>'data','')::timestamptz as momento,
      greatest(0,coalesce(nullif(q.obj->>'minutos','')::int,0)) as minutos,
      greatest(0,coalesce(nullif(q.obj->>'certas','')::int,0)) as certas,
      greatest(0,coalesce(nullif(q.obj->>'erradas','')::int,0)) as erradas,
      greatest(0,coalesce(nullif(q.obj->>'emBranco','')::int,0)) as em_branco
    from estados e
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(e.estado->'questoes')='array' then e.estado->'questoes' else '[]'::jsonb end
    ) q(obj)
    where nullif(q.obj->>'data','') is not null
      and not (
        coalesce(q.obj->>'origem','')='simulado-ia'
        and nullif(q.obj->>'tentativaId','') is not null
        and exists (
          select 1 from sim_ids_all i
          where i.user_id=e.user_id and i.id=q.obj->>'tentativaId'
        )
      )
  ),
  simulados_eventos as (
    select
      sl.user_id,
      nullif(sl.obj->>'data','')::timestamptz as momento,
      greatest(0,coalesce(nullif(sl.obj->>'minutos','')::int,0)) as minutos,
      greatest(0,coalesce(nullif(sl.obj->>'certas','')::int,0)) as certas,
      greatest(0,coalesce(nullif(sl.obj->>'erradas','')::int,0)) as erradas,
      greatest(0,coalesce(nullif(sl.obj->>'emBranco','')::int,0)) as em_branco
    from simulados_locais_raw sl
    where nullif(sl.obj->>'data','') is not null

    union all

    select
      st.usuario_id,
      st.finalizada_em as momento,
      greatest(0,coalesce(st.minutos_gastos,0)) as minutos,
      greatest(0,coalesce(nullif(st.resultado->>'certas','')::int,0)) as certas,
      greatest(0,coalesce(nullif(st.resultado->>'erradas','')::int,0)) as erradas,
      greatest(0,coalesce(nullif(st.resultado->>'emBranco','')::int,0)) as em_branco
    from public.simulados_oficiais_tentativas st
    join ativos a on a.user_id=st.usuario_id
    where st.finalizada
      and st.conta_ranking
      and st.finalizada_em is not null
      and not exists (
        select 1 from sim_ids_all i
        where i.user_id=st.usuario_id and i.id=st.id::text
      )
  ),
  revisoes_raw as (
    select e.user_id, r.obj
    from estados e
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(e.estado->'revisoes')='array' then e.estado->'revisoes' else '[]'::jsonb end
    ) r(obj)
  ),
  revisoes_eventos as (
    select
      user_id,
      nullif(obj->>'dataConclusao','')::timestamptz as momento
    from revisoes_raw
    where coalesce(nullif(obj->>'concluida','')::boolean,false)
      and nullif(obj->>'dataConclusao','') is not null
  ),
  atividades as (
    select user_id,momento,minutos from sessoes_eventos
    union all
    select user_id,momento,minutos from questoes_eventos
    union all
    select user_id,momento,minutos from simulados_eventos
    union all
    select user_id,momento,0 from revisoes_eventos
  ),
  atividade_stats as (
    select
      a.user_id,
      coalesce(sum(at.minutos) filter(where at.momento>=date_trunc('month',now())),0)::int as minutos_mes,
      count(*) filter(where at.momento>=date_trunc('month',now()))::int as eventos_mes,
      count(distinct at.momento::date) filter(where at.momento>=date_trunc('month',now()))::int as dias_mes,
      max(at.momento) as ultima_atividade
    from ativos a
    left join atividades at on at.user_id=a.user_id
    group by a.user_id
  ),
  questoes_stats as (
    select
      a.user_id,
      coalesce(sum(x.certas+x.erradas+x.em_branco),0)::int as total,
      coalesce(sum(x.certas),0)::int as certas,
      coalesce(sum(x.erradas),0)::int as erradas
    from ativos a
    left join (
      select user_id,momento,certas,erradas,em_branco from questoes_eventos
      union all
      select user_id,momento,certas,erradas,em_branco from simulados_eventos
    ) x on x.user_id=a.user_id and x.momento>=date_trunc('month',now())
    group by a.user_id
  ),
  revisoes_stats as (
    select
      a.user_id,
      count(*) filter(
        where coalesce(nullif(r.obj->>'concluida','')::boolean,false)
          and nullif(r.obj->>'dataConclusao','') is not null
          and nullif(r.obj->>'dataConclusao','')::timestamptz>=date_trunc('month',now())
      )::int as concluidas_mes,
      count(*) filter(
        where not coalesce(nullif(r.obj->>'concluida','')::boolean,false)
          and nullif(r.obj->>'dataPrevista','') is not null
          and nullif(r.obj->>'dataPrevista','')::timestamptz<now()
      )::int as atrasadas
    from ativos a
    left join revisoes_raw r on r.user_id=a.user_id
    group by a.user_id
  ),
  simulados_stats as (
    select
      a.user_id,
      count(se.momento)::int as simulados_mes,
      coalesce(round(avg(
        case
          when (se.certas+se.erradas+se.em_branco)>0
            then 100.0*se.certas/(se.certas+se.erradas+se.em_branco)
          else 0
        end
      ),1),0) as media_mes,
      coalesce(sum(
        10 + case
          when (se.certas::numeric/greatest(1,se.certas+se.erradas+se.em_branco))>=0.80 then 10
          when (se.certas::numeric/greatest(1,se.certas+se.erradas+se.em_branco))>=0.60 then 5
          else 0
        end
      ),0)::int as xp_simulados
    from ativos a
    left join simulados_eventos se
      on se.user_id=a.user_id
     and se.momento>=date_trunc('month',now())
    group by a.user_id
  ),
  sequencias as (
    select
      a.user_id,
      coalesce((
        with dias as (
          select distinct at.momento::date d
          from atividades at
          where at.user_id=a.user_id
        ), grupos as (
          select d,d-row_number() over(order by d)::int grp from dias
        ), blocos as (
          select min(d) ini,max(d) fim,count(*)::int n from grupos group by grp
        )
        select max(n) filter(where fim in (current_date,current_date-1)) from blocos
      ),0)::int as sequencia
    from ativos a
  ),
  aluno_metricas as (
    select
      a.*,
      coalesce(ast.minutos_mes,0) as minutos_mes,
      coalesce(ast.eventos_mes,0) as sessoes_mes,
      coalesce(ast.dias_mes,0) as dias_mes,
      ast.ultima_atividade,
      coalesce(qs.total,0) as questoes_mes,
      coalesce(qs.certas,0) as certas_mes,
      coalesce(qs.erradas,0) as erradas_mes,
      case when coalesce(qs.total,0)>0 then round(100.0*qs.certas/qs.total,1) else 0 end as acuracia_mes,
      coalesce(rs.concluidas_mes,0) as revisoes_concluidas_mes,
      coalesce(rs.atrasadas,0) as revisoes_atrasadas,
      coalesce(ss.simulados_mes,0) as simulados_mes,
      coalesce(ss.media_mes,0) as media_simulados,
      coalesce(seq.sequencia,0) as sequencia,
      greatest(0,current_date-coalesce(ast.ultima_atividade::date,a.inicio_em::date))::int as dias_sem_estudar,
      least(1000000,
        floor(coalesce(ast.minutos_mes,0)/10.0)::int +
        floor(coalesce(qs.total,0)/10.0)::int*2 +
        floor(coalesce(qs.certas,0)/10.0)::int*2 +
        coalesce(rs.concluidas_mes,0)*5 +
        coalesce(ss.xp_simulados,0)
      )::int as xp
    from ativos a
    left join atividade_stats ast on ast.user_id=a.user_id
    left join questoes_stats qs on qs.user_id=a.user_id
    left join revisoes_stats rs on rs.user_id=a.user_id
    left join simulados_stats ss on ss.user_id=a.user_id
    left join sequencias seq on seq.user_id=a.user_id
  ),
  saude as (
    select
      am.*,
      case
        when am.dias_sem_estudar>=7 or am.revisoes_atrasadas>=5 or (am.questoes_mes>=20 and am.acuracia_mes<50) then 'risco'
        when am.dias_sem_estudar>=3 or am.revisoes_atrasadas>=2 or (am.questoes_mes>=20 and am.acuracia_mes<65) then 'atencao'
        else 'em_dia'
      end as saude,
      trim(both ', ' from concat(
        case when am.dias_sem_estudar>=7 then am.dias_sem_estudar||' dias sem estudar, '
             when am.dias_sem_estudar>=3 then am.dias_sem_estudar||' dias sem estudar, '
             else '' end,
        case when am.revisoes_atrasadas>0 then am.revisoes_atrasadas||' revisões atrasadas, ' else '' end,
        case when am.questoes_mes>=20 and am.acuracia_mes<65 then am.acuracia_mes||'% de acertos, ' else '' end
      )) as motivo
    from aluno_metricas am
  ),
  ranking as (
    select
      s.user_id,
      s.nome,
      s.xp,
      s.minutos_mes as minutos,
      s.questoes_mes as questoes,
      s.certas_mes as acertos,
      s.revisoes_concluidas_mes as revisoes,
      s.simulados_mes as simulados,
      greatest(1,floor(s.xp/250.0)::int+1) as nivel,
      row_number() over(order by s.xp desc,s.minutos_mes desc,s.certas_mes desc,s.user_id)::int as posicao
    from saude s
    where s.minutos_mes>0 or s.questoes_mes>0 or s.revisoes_concluidas_mes>0 or s.simulados_mes>0
  ),
  turmas_resumo as (
    select
      t.id,
      t.nome,
      count(s.user_id)::int as alunos_ativos,
      coalesce(sum(s.minutos_mes),0)::int as minutos_mes,
      coalesce(sum(s.questoes_mes),0)::int as questoes_mes,
      coalesce(sum(s.certas_mes),0)::int as certas_mes,
      coalesce(sum(s.revisoes_atrasadas),0)::int as revisoes_atrasadas,
      coalesce(sum(s.simulados_mes),0)::int as simulados_mes,
      case when coalesce(sum(s.questoes_mes),0)>0 then round(100.0*sum(s.certas_mes)/sum(s.questoes_mes),1) else 0 end as acuracia
    from public.turmas t
    left join saude s on s.turma_id=t.id
    where t.parceiro_id=v_parceiro_id and t.ativa
    group by t.id,t.nome
  ),
  atividade_7d as (
    select
      d.dia,
      coalesce(sum(at.minutos),0)::int as minutos,
      count(distinct at.user_id)::int as alunos
    from generate_series(current_date-6,current_date,interval '1 day') d(dia)
    left join atividades at on at.momento::date=d.dia::date
    group by d.dia
    order by d.dia
  )
  select jsonb_build_object(
    'parceiro_id',v_parceiro_id,
    'parceiro_nome',v_parceiro_nome,
    'indicadores',jsonb_build_object(
      'alunos_ativos',(select count(*) from ativos),
      'turmas_ativas',(select count(*) from public.turmas t where t.parceiro_id=v_parceiro_id and t.ativa),
      'minutos_mes',coalesce((select sum(minutos_mes) from saude),0),
      'dias_estudo_mes',coalesce((select sum(dias_mes) from saude),0),
      'questoes_mes',coalesce((select sum(questoes_mes) from saude),0),
      'acertos_mes',coalesce((select sum(certas_mes) from saude),0),
      'acuracia_mes',case when coalesce((select sum(questoes_mes) from saude),0)>0 then round(100.0*(select sum(certas_mes) from saude)/(select sum(questoes_mes) from saude),1) else 0 end,
      'revisoes_concluidas_mes',coalesce((select sum(revisoes_concluidas_mes) from saude),0),
      'revisoes_atrasadas',coalesce((select sum(revisoes_atrasadas) from saude),0),
      'simulados_mes',coalesce((select sum(simulados_mes) from saude),0),
      'media_simulados',coalesce((select round(avg(media_simulados),1) from saude where simulados_mes>0),0),
      'sequencia_media',coalesce((select round(avg(sequencia),1) from saude),0),
      'alunos_ativos_hoje',coalesce((select count(*) from saude where ultima_atividade::date=current_date),0)
    ),
    'saude',jsonb_build_object(
      'em_dia',(select count(*) from saude where saude='em_dia'),
      'atencao',(select count(*) from saude where saude='atencao'),
      'risco',(select count(*) from saude where saude='risco')
    ),
    'alunos_atencao',coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id',x.user_id,
        'nome',x.nome,
        'email',x.email,
        'turma_id',x.turma_id,
        'turma',coalesce(t.nome,'Sem turma'),
        'saude',x.saude,
        'motivo',nullif(x.motivo,''),
        'dias_sem_estudar',x.dias_sem_estudar,
        'revisoes_atrasadas',x.revisoes_atrasadas,
        'acuracia_mes',x.acuracia_mes,
        'questoes_mes',x.questoes_mes,
        'sequencia',x.sequencia
      ) order by case x.saude when 'risco' then 1 else 2 end,x.dias_sem_estudar desc,x.revisoes_atrasadas desc)
      from (
        select * from saude
        where saude<>'em_dia'
        order by case saude when 'risco' then 1 else 2 end,dias_sem_estudar desc,revisoes_atrasadas desc
        limit 8
      ) x
      left join public.turmas t on t.id=x.turma_id
    ),'[]'::jsonb),
    'ranking',coalesce((
      select jsonb_agg(jsonb_build_object(
        'posicao',r.posicao,
        'user_id',r.user_id,
        'nome',r.nome,
        'xp',r.xp,
        'minutos',r.minutos,
        'questoes',r.questoes,
        'acertos',r.acertos,
        'revisoes',r.revisoes,
        'simulados',r.simulados,
        'nivel',r.nivel
      ) order by r.posicao)
      from (select * from ranking order by posicao limit 5) r
    ),'[]'::jsonb),
    'turmas',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',tr.id,
        'nome',tr.nome,
        'alunos_ativos',tr.alunos_ativos,
        'minutos_mes',tr.minutos_mes,
        'questoes_mes',tr.questoes_mes,
        'acuracia',tr.acuracia,
        'revisoes_atrasadas',tr.revisoes_atrasadas,
        'simulados_mes',tr.simulados_mes
      ) order by tr.nome)
      from turmas_resumo tr
    ),'[]'::jsonb),
    'atividade_7_dias',coalesce((
      select jsonb_agg(jsonb_build_object(
        'data',a.dia::date,
        'minutos',a.minutos,
        'alunos',a.alunos
      ) order by a.dia)
      from atividade_7d a
    ),'[]'::jsonb)
  ) into v_result;

  return coalesce(v_result,'{}'::jsonb);
end;
$function$;
