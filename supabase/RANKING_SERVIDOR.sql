-- Ranking mensal recalculado no PostgreSQL.
-- O cliente deixa de enviar XP/minutos/questões arbitrários para ranking_mensal.

create or replace function public.recalcular_meu_ranking(p_nome_publico text default 'Usuário')
returns public.ranking_mensal
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_mes text := to_char(now(), 'YYYY-MM');
  v_estado jsonb := '{}'::jsonb;
  v_minutos integer := 0;
  v_questoes integer := 0;
  v_acertos integer := 0;
  v_revisoes integer := 0;
  v_simulados integer := 0;
  v_xp integer := 0;
  v_nivel integer := 1;
  v_resultado public.ranking_mensal;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  select coalesce(dados->'appState', '{}'::jsonb)
    into v_estado
  from public.configuracoes
  where user_id = v_user_id;

  with
  sims as (
    select s.obj
    from jsonb_array_elements(coalesce(v_estado->'simulados', '[]'::jsonb)) s(obj)
    where left(coalesce(s.obj->>'data', ''), 7) = v_mes
  ),
  sim_ids as (
    select id from (
      select nullif(obj->>'id', '') as id from sims
      union all
      select nullif(obj->>'tentativaId', '') as id from sims
    ) x where id is not null
  ),
  qs as (
    select q.obj
    from jsonb_array_elements(coalesce(v_estado->'questoes', '[]'::jsonb)) q(obj)
    where left(coalesce(q.obj->>'data', ''), 7) = v_mes
      and not (
        coalesce(q.obj->>'origem', '') = 'simulado-ia'
        and nullif(q.obj->>'tentativaId', '') is not null
        and exists (
          select 1 from sim_ids i where i.id = q.obj->>'tentativaId'
        )
      )
  ),
  sessoes_mes as (
    select s.obj
    from jsonb_array_elements(coalesce(v_estado->'sessoes', '[]'::jsonb)) s(obj)
    where left(coalesce(s.obj->>'data', ''), 7) = v_mes
  ),
  revisoes_mes as (
    select r.obj
    from jsonb_array_elements(coalesce(v_estado->'revisoes', '[]'::jsonb)) r(obj)
    where coalesce((r.obj->>'concluida')::boolean, false)
      and left(coalesce(r.obj->>'dataConclusao', ''), 7) = v_mes
  ),
  q_agregado as (
    select
      coalesce(sum(greatest(0, coalesce((obj->>'certas')::int, 0))), 0)::int as certas,
      coalesce(sum(
        greatest(0, coalesce((obj->>'certas')::int, 0)) +
        greatest(0, coalesce((obj->>'erradas')::int, 0)) +
        greatest(0, coalesce((obj->>'emBranco')::int, 0))
      ), 0)::int as total,
      coalesce(sum(greatest(0, coalesce((obj->>'minutos')::int, 0))), 0)::int as minutos
    from qs
  ),
  s_agregado as (
    select
      coalesce(sum(greatest(0, coalesce((obj->>'certas')::int, 0))), 0)::int as certas,
      coalesce(sum(greatest(
        greatest(0, coalesce((obj->>'totalQuestoes')::int, 0)),
        greatest(0, coalesce((obj->>'certas')::int, 0)) +
        greatest(0, coalesce((obj->>'erradas')::int, 0)) +
        greatest(0, coalesce((obj->>'emBranco')::int, 0)) +
        greatest(0, coalesce((obj->>'anuladas')::int, 0))
      )), 0)::int as total,
      coalesce(sum(greatest(0, coalesce((obj->>'minutos')::int, 0))), 0)::int as minutos,
      count(*)::int as quantidade,
      coalesce(sum(
        10 + case
          when (
            greatest(0, coalesce((obj->>'certas')::int, 0))::numeric /
            greatest(1,
              greatest(0, coalesce((obj->>'certas')::int, 0)) +
              greatest(0, coalesce((obj->>'erradas')::int, 0)) +
              greatest(0, coalesce((obj->>'emBranco')::int, 0))
            )
          ) >= 0.80 then 10
          when (
            greatest(0, coalesce((obj->>'certas')::int, 0))::numeric /
            greatest(1,
              greatest(0, coalesce((obj->>'certas')::int, 0)) +
              greatest(0, coalesce((obj->>'erradas')::int, 0)) +
              greatest(0, coalesce((obj->>'emBranco')::int, 0))
            )
          ) >= 0.60 then 5
          else 0
        end
      ), 0)::int as xp_simulados
    from sims
  ),
  tempo_sessoes as (
    select coalesce(sum(greatest(0, coalesce((obj->>'minutos')::int, 0))), 0)::int as minutos
    from sessoes_mes
  )
  select
    least(44640, qa.minutos + sa.minutos + ts.minutos),
    least(200000, qa.total + sa.total),
    least(200000, qa.certas + sa.certas),
    (select count(*)::int from revisoes_mes),
    sa.quantidade,
    least(1000000,
      floor(least(44640, qa.minutos + sa.minutos + ts.minutos) / 10.0)::int +
      floor(least(200000, qa.total + sa.total) / 10.0)::int * 2 +
      floor(least(200000, qa.certas + sa.certas) / 10.0)::int * 2 +
      (select count(*)::int from revisoes_mes) * 5 +
      sa.xp_simulados
    )
  into v_minutos, v_questoes, v_acertos, v_revisoes, v_simulados, v_xp
  from q_agregado qa, s_agregado sa, tempo_sessoes ts;

  v_nivel := greatest(1, floor(v_xp / 250.0)::int + 1);

  insert into public.ranking_mensal (
    user_id, nome_publico, mes, minutos, questoes, acertos,
    revisoes, simulados, xp, nivel, atualizado_em
  ) values (
    v_user_id,
    left(coalesce(nullif(btrim(p_nome_publico), ''), 'Usuário'), 120),
    v_mes,
    v_minutos,
    v_questoes,
    least(v_acertos, v_questoes),
    v_revisoes,
    v_simulados,
    v_xp,
    v_nivel,
    now()
  )
  on conflict (user_id, mes) do update set
    nome_publico = excluded.nome_publico,
    minutos = excluded.minutos,
    questoes = excluded.questoes,
    acertos = excluded.acertos,
    revisoes = excluded.revisoes,
    simulados = excluded.simulados,
    xp = excluded.xp,
    nivel = excluded.nivel,
    atualizado_em = excluded.atualizado_em
  returning * into v_resultado;

  return v_resultado;
end;
$$;

comment on function public.recalcular_meu_ranking(text) is
  'SECURITY DEFINER intencional: recalcula o ranking a partir dos dados do próprio auth.uid() sem permitir escrita direta do cliente em ranking_mensal.';
revoke all on function public.recalcular_meu_ranking(text) from PUBLIC, anon;
grant execute on function public.recalcular_meu_ranking(text) to authenticated, service_role;

-- O cliente pode ler o ranking, mas não pode alterar métricas diretamente.
revoke all on table public.ranking_mensal from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.ranking_mensal from authenticated;
grant select on table public.ranking_mensal to authenticated;

drop policy if exists "usuario publica proprio ranking" on public.ranking_mensal;
drop policy if exists "usuario atualiza proprio ranking" on public.ranking_mensal;