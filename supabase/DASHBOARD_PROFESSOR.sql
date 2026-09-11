-- Dashboard consolidado da área do professor/parceiro.
-- Entrega somente dados do parceiro vinculado ao usuário autenticado.

create or replace function public.dashboard_meu_parceiro()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
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
    and pu.papel in ('proprietario', 'gestor', 'professor')
  order by case pu.papel when 'proprietario' then 1 when 'gestor' then 2 else 3 end
  limit 1;

  if v_parceiro_id is null then
    raise exception 'Perfil de professor/parceiro não encontrado.';
  end if;

  with
  alunos as (
    select distinct on (l.user_id)
      l.user_id,
      l.turma_id,
      coalesce(pf.nome, 'Aluno') as nome,
      coalesce(pf.email, '') as email,
      l.inicio_em,
      l.expira_em,
      case
        when l.status = 'ativa' and l.expira_em is not null and l.expira_em <= now() then 'expirada'
        else l.status
      end as status
    from public.licencas_acesso l
    left join public.perfis pf on pf.id = l.user_id
    where l.parceiro_id = v_parceiro_id
    order by l.user_id, l.criado_em desc
  ),
  ativos as (
    select *
    from alunos
    where status = 'ativa'
      and inicio_em <= now()
      and (expira_em is null or expira_em > now())
  ),
  sessoes_mes as (
    select s.user_id,
      sum(s.minutos)::int as minutos,
      count(*)::int as sessoes,
      count(distinct s.data::date)::int as dias,
      max(s.data) as ultima_atividade
    from public.sessoes_estudo s
    join ativos a on a.user_id = s.user_id
    where s.data >= date_trunc('month', now())
    group by s.user_id
  ),
  ultima_sessao as (
    select s.user_id, max(s.data) as ultima_atividade
    from public.sessoes_estudo s
    join ativos a on a.user_id = s.user_id
    group by s.user_id
  ),
  questoes_mes as (
    select q.user_id,
      sum(q.certas + q.erradas)::int as total,
      sum(q.certas)::int as certas,
      sum(q.erradas)::int as erradas
    from public.registros_questoes q
    join ativos a on a.user_id = q.user_id
    where q.data >= date_trunc('month', now())
    group by q.user_id
  ),
  revisoes_stats as (
    select r.user_id,
      count(*) filter (where r.concluida and r.data_conclusao >= date_trunc('month', now()))::int as concluidas_mes,
      count(*) filter (where not r.concluida and r.data_prevista < now())::int as atrasadas
    from public.revisoes r
    join ativos a on a.user_id = r.user_id
    group by r.user_id
  ),
  simulados_stats as (
    select st.usuario_id as user_id,
      count(*) filter (where st.finalizada_em >= date_trunc('month', now()))::int as simulados_mes,
      avg(
        case
          when st.finalizada_em >= date_trunc('month', now())
          then coalesce((st.resultado->>'percentual')::numeric, 0)
        end
      ) as media_mes
    from public.simulados_oficiais_tentativas st
    join ativos a on a.user_id = st.usuario_id
    where st.finalizada and st.conta_ranking
    group by st.usuario_id
  ),
  sequencias as (
    select a.user_id,
      coalesce((
        with dias as (
          select distinct s.data::date d
          from public.sessoes_estudo s
          where s.user_id = a.user_id
        ), grupos as (
          select d, d - row_number() over(order by d)::int grp
          from dias
        ), blocos as (
          select min(d) ini, max(d) fim, count(*)::int n
          from grupos
          group by grp
        )
        select max(n) filter (where fim in (current_date, current_date - 1))
        from blocos
      ), 0)::int as sequencia
    from ativos a
  ),
  aluno_metricas as (
    select
      a.*,
      coalesce(sm.minutos, 0) as minutos_mes,
      coalesce(sm.sessoes, 0) as sessoes_mes,
      coalesce(sm.dias, 0) as dias_mes,
      us.ultima_atividade,
      coalesce(qm.total, 0) as questoes_mes,
      coalesce(qm.certas, 0) as certas_mes,
      coalesce(qm.erradas, 0) as erradas_mes,
      case when coalesce(qm.total, 0) > 0 then round(100.0 * qm.certas / qm.total, 1) else 0 end as acuracia_mes,
      coalesce(rs.concluidas_mes, 0) as revisoes_concluidas_mes,
      coalesce(rs.atrasadas, 0) as revisoes_atrasadas,
      coalesce(ss.simulados_mes, 0) as simulados_mes,
      coalesce(round(ss.media_mes, 1), 0) as media_simulados,
      coalesce(seq.sequencia, 0) as sequencia,
      greatest(0, current_date - coalesce(us.ultima_atividade::date, a.inicio_em::date))::int as dias_sem_estudar
    from ativos a
    left join sessoes_mes sm on sm.user_id = a.user_id
    left join ultima_sessao us on us.user_id = a.user_id
    left join questoes_mes qm on qm.user_id = a.user_id
    left join revisoes_stats rs on rs.user_id = a.user_id
    left join simulados_stats ss on ss.user_id = a.user_id
    left join sequencias seq on seq.user_id = a.user_id
  ),
  saude as (
    select am.*,
      case
        when am.dias_sem_estudar >= 7
          or am.revisoes_atrasadas >= 5
          or (am.questoes_mes >= 20 and am.acuracia_mes < 50)
          then 'risco'
        when am.dias_sem_estudar >= 3
          or am.revisoes_atrasadas >= 2
          or (am.questoes_mes >= 20 and am.acuracia_mes < 65)
          then 'atencao'
        else 'em_dia'
      end as saude,
      trim(both ', ' from concat(
        case when am.dias_sem_estudar >= 7 then am.dias_sem_estudar || ' dias sem estudar, ' when am.dias_sem_estudar >= 3 then am.dias_sem_estudar || ' dias sem estudar, ' else '' end,
        case when am.revisoes_atrasadas > 0 then am.revisoes_atrasadas || ' revisões atrasadas, ' else '' end,
        case when am.questoes_mes >= 20 and am.acuracia_mes < 65 then am.acuracia_mes || '% de acertos, ' else '' end
      )) as motivo
    from aluno_metricas am
  ),
  ranking as (
    select
      r.user_id,
      coalesce(nullif(r.nome_publico, ''), s.nome) as nome,
      r.xp,
      r.minutos,
      r.questoes,
      r.acertos,
      r.revisoes,
      r.simulados,
      r.nivel,
      row_number() over(order by r.xp desc, r.minutos desc, r.acertos desc, r.user_id)::int as posicao
    from public.ranking_mensal r
    join saude s on s.user_id = r.user_id
    where r.mes = to_char(current_date, 'YYYY-MM')
  ),
  turmas_resumo as (
    select
      t.id,
      t.nome,
      count(s.user_id)::int as alunos_ativos,
      coalesce(sum(s.minutos_mes), 0)::int as minutos_mes,
      coalesce(sum(s.questoes_mes), 0)::int as questoes_mes,
      coalesce(sum(s.certas_mes), 0)::int as certas_mes,
      coalesce(sum(s.revisoes_atrasadas), 0)::int as revisoes_atrasadas,
      coalesce(sum(s.simulados_mes), 0)::int as simulados_mes,
      case when coalesce(sum(s.questoes_mes), 0) > 0 then round(100.0 * sum(s.certas_mes) / sum(s.questoes_mes), 1) else 0 end as acuracia
    from public.turmas t
    left join saude s on s.turma_id = t.id
    where t.parceiro_id = v_parceiro_id and t.ativa
    group by t.id, t.nome
  ),
  atividade_7d as (
    select d.dia,
      coalesce(sum(s.minutos), 0)::int as minutos,
      count(distinct s.user_id)::int as alunos
    from generate_series(current_date - 6, current_date, interval '1 day') d(dia)
    left join public.sessoes_estudo s
      on s.data::date = d.dia::date
      and exists (select 1 from ativos a where a.user_id = s.user_id)
    group by d.dia
    order by d.dia
  )
  select jsonb_build_object(
    'parceiro_id', v_parceiro_id,
    'parceiro_nome', v_parceiro_nome,
    'indicadores', jsonb_build_object(
      'alunos_ativos', (select count(*) from ativos),
      'turmas_ativas', (select count(*) from public.turmas t where t.parceiro_id = v_parceiro_id and t.ativa),
      'minutos_mes', coalesce((select sum(minutos_mes) from saude), 0),
      'dias_estudo_mes', coalesce((select sum(dias_mes) from saude), 0),
      'questoes_mes', coalesce((select sum(questoes_mes) from saude), 0),
      'acertos_mes', coalesce((select sum(certas_mes) from saude), 0),
      'acuracia_mes', case when coalesce((select sum(questoes_mes) from saude), 0) > 0 then round(100.0 * (select sum(certas_mes) from saude) / (select sum(questoes_mes) from saude), 1) else 0 end,
      'revisoes_concluidas_mes', coalesce((select sum(revisoes_concluidas_mes) from saude), 0),
      'revisoes_atrasadas', coalesce((select sum(revisoes_atrasadas) from saude), 0),
      'simulados_mes', coalesce((select sum(simulados_mes) from saude), 0),
      'media_simulados', coalesce((select round(avg(media_simulados), 1) from saude where simulados_mes > 0), 0),
      'sequencia_media', coalesce((select round(avg(sequencia), 1) from saude), 0),
      'alunos_ativos_hoje', coalesce((select count(*) from saude where ultima_atividade::date = current_date), 0)
    ),
    'saude', jsonb_build_object(
      'em_dia', (select count(*) from saude where saude = 'em_dia'),
      'atencao', (select count(*) from saude where saude = 'atencao'),
      'risco', (select count(*) from saude where saude = 'risco')
    ),
    'alunos_atencao', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', x.user_id,
        'nome', x.nome,
        'email', x.email,
        'turma_id', x.turma_id,
        'turma', coalesce(t.nome, 'Sem turma'),
        'saude', x.saude,
        'motivo', nullif(x.motivo, ''),
        'dias_sem_estudar', x.dias_sem_estudar,
        'revisoes_atrasadas', x.revisoes_atrasadas,
        'acuracia_mes', x.acuracia_mes,
        'questoes_mes', x.questoes_mes,
        'sequencia', x.sequencia
      ) order by case x.saude when 'risco' then 1 else 2 end, x.dias_sem_estudar desc, x.revisoes_atrasadas desc)
      from (
        select * from saude where saude <> 'em_dia'
        order by case saude when 'risco' then 1 else 2 end, dias_sem_estudar desc, revisoes_atrasadas desc
        limit 8
      ) x
      left join public.turmas t on t.id = x.turma_id
    ), '[]'::jsonb),
    'ranking', coalesce((
      select jsonb_agg(jsonb_build_object(
        'posicao', r.posicao,
        'user_id', r.user_id,
        'nome', r.nome,
        'xp', r.xp,
        'minutos', r.minutos,
        'questoes', r.questoes,
        'acertos', r.acertos,
        'revisoes', r.revisoes,
        'simulados', r.simulados,
        'nivel', r.nivel
      ) order by r.posicao)
      from (select * from ranking order by posicao limit 5) r
    ), '[]'::jsonb),
    'turmas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', tr.id,
        'nome', tr.nome,
        'alunos_ativos', tr.alunos_ativos,
        'minutos_mes', tr.minutos_mes,
        'questoes_mes', tr.questoes_mes,
        'acuracia', tr.acuracia,
        'revisoes_atrasadas', tr.revisoes_atrasadas,
        'simulados_mes', tr.simulados_mes
      ) order by tr.nome)
      from turmas_resumo tr
    ), '[]'::jsonb),
    'atividade_7_dias', coalesce((
      select jsonb_agg(jsonb_build_object('data', a.dia::date, 'minutos', a.minutos, 'alunos', a.alunos) order by a.dia)
      from atividade_7d a
    ), '[]'::jsonb)
  ) into v_result;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

revoke all on function public.dashboard_meu_parceiro() from public, anon;
grant execute on function public.dashboard_meu_parceiro() to authenticated;
