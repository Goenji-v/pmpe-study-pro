-- STAGING ONLY: strengthen CAS regression detection using persistent IDs.
-- Must NOT be added to supabase/migrations or run against production before
-- completing a release review and compatibility tests.
-- Existing anti-regression counted entries only. Replacing one old session
-- or review with another of the same count was incorrectly accepted.
create or replace function study_pro_internal.tem_regressao_historico(
  p_atual jsonb,
  p_novo jsonb
) returns boolean
language sql
immutable
set search_path = ''
as $fn$
  with colecoes as (
    select
      k.chave,
      case when pg_catalog.jsonb_typeof(p_atual -> k.chave) = 'array'
        then p_atual -> k.chave else '[]'::jsonb end as antiga,
      case when pg_catalog.jsonb_typeof(p_novo -> k.chave) = 'array'
        then p_novo -> k.chave else '[]'::jsonb end as nova
    from (values
      ('sessoes'),
      ('questoes'),
      ('revisoes'),
      ('simulados'),
      ('missoesConcluidas')
    ) as k(chave)
  )
  select
    coalesce(p_atual #>> '{configuracoes,dadosReiniciadosEm}', '') =
    coalesce(p_novo  #>> '{configuracoes,dadosReiniciadosEm}', '')
    and exists (
      select 1
      from colecoes c
      where
        pg_catalog.jsonb_array_length(c.nova) <
          pg_catalog.jsonb_array_length(c.antiga)
        or (
          -- Even at equal list length, losing an old ID is a regression.
          -- Existing objects may be edited while preserving their IDs.
          select pg_catalog.coalesce(
            pg_catalog.bool_or(
              case
                when c.chave = 'missoesConcluidas'
                     and pg_catalog.jsonb_typeof(item.value) = 'string'
                then not (c.nova @> pg_catalog.jsonb_build_array(item.value))
                when c.chave <> 'missoesConcluidas'
                     and pg_catalog.jsonb_typeof(item.value) = 'object'
                     and pg_catalog.jsonb_typeof(item.value -> 'id') = 'string'
                then not (c.nova @> pg_catalog.jsonb_build_array(
                  pg_catalog.jsonb_build_object('id', item.value ->> 'id')
                ))
                else false
              end
            ),
            false
          )
          from pg_catalog.jsonb_array_elements(c.antiga) as item(value)
        )
    );
$fn$;
