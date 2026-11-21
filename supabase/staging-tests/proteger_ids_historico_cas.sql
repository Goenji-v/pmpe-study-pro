-- STAGING ONLY: protect retained study history by persistent IDs.
-- Do not deploy to production without a coordinated, reviewed migration.
-- Replaces quadratic per-ID JSONB containment with set-based EXCEPT,
-- preserving performance for large study histories.
create or replace function study_pro_internal.tem_regressao_historico(
  p_atual jsonb,
  p_novo jsonb
) returns boolean
language sql
immutable
set search_path = ''
as $fn$
  with colecoes as materialized (
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
  ),
  antigos as (
    select c.chave,
      case when c.chave = 'missoesConcluidas'
        then case when pg_catalog.jsonb_typeof(item.value) = 'string'
          then item.value #>> '{}' else null end
        when pg_catalog.jsonb_typeof(item.value) = 'object'
          and pg_catalog.jsonb_typeof(item.value -> 'id') = 'string'
        then item.value ->> 'id'
        else null
      end as id
    from colecoes c
    cross join lateral pg_catalog.jsonb_array_elements(c.antiga) item(value)
  ),
  novos as (
    select c.chave,
      case when c.chave = 'missoesConcluidas'
        then case when pg_catalog.jsonb_typeof(item.value) = 'string'
          then item.value #>> '{}' else null end
        when pg_catalog.jsonb_typeof(item.value) = 'object'
          and pg_catalog.jsonb_typeof(item.value -> 'id') = 'string'
        then item.value ->> 'id'
        else null
      end as id
    from colecoes c
    cross join lateral pg_catalog.jsonb_array_elements(c.nova) item(value)
  )
  select
    coalesce(p_atual #>> '{configuracoes,dadosReiniciadosEm}', '') =
    coalesce(p_novo  #>> '{configuracoes,dadosReiniciadosEm}', '')
    and (
      exists (
        select 1 from colecoes c
        where pg_catalog.jsonb_array_length(c.nova) <
              pg_catalog.jsonb_array_length(c.antiga)
      )
      or exists (
        select 1
        from (
          select chave, id from antigos where id is not null
          except
          select chave, id from novos where id is not null
        ) as removidos
      )
    );
$fn$;
