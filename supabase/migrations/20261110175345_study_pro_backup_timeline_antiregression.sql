-- Study Pro: linha do tempo de backups + proteção anti-regressão.
-- Aplicada no Supabase em 2026-11-10.

create extension if not exists pg_cron with schema pg_catalog;

create schema if not exists study_pro_internal;
revoke all on schema study_pro_internal from public, anon, authenticated;

create unique index if not exists backups_user_nome_unique
  on public.backups(user_id, nome);

create or replace function study_pro_internal.tem_regressao_historico(
  p_atual jsonb,
  p_novo jsonb
)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    coalesce(p_atual #>> '{configuracoes,dadosReiniciadosEm}', '') =
    coalesce(p_novo  #>> '{configuracoes,dadosReiniciadosEm}', '')
    and (
      jsonb_array_length(coalesce(p_novo->'sessoes','[]'::jsonb))
        < jsonb_array_length(coalesce(p_atual->'sessoes','[]'::jsonb))
      or jsonb_array_length(coalesce(p_novo->'questoes','[]'::jsonb))
        < jsonb_array_length(coalesce(p_atual->'questoes','[]'::jsonb))
      or jsonb_array_length(coalesce(p_novo->'simulados','[]'::jsonb))
        < jsonb_array_length(coalesce(p_atual->'simulados','[]'::jsonb))
      or jsonb_array_length(coalesce(p_novo->'revisoes','[]'::jsonb))
        < jsonb_array_length(coalesce(p_atual->'revisoes','[]'::jsonb))
      or jsonb_array_length(coalesce(p_novo->'missoesConcluidas','[]'::jsonb))
        < jsonb_array_length(coalesce(p_atual->'missoesConcluidas','[]'::jsonb))
    );
$$;

create or replace function public.salvar_estado_app_cas(
  p_expected_revision bigint,
  p_estado jsonb
)
returns table(ok boolean, revisao_atual bigint)
language plpgsql
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_rows integer := 0;
  v_revisao bigint := 0;
  v_estado_atual jsonb;
  v_agora text := to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  select c.dados->'appState',
         case
           when coalesce(c.dados #>> '{appState,syncRevision}', '') ~ '^[0-9]+$'
             then (c.dados #>> '{appState,syncRevision}')::bigint
           else 0
         end
    into v_estado_atual, v_revisao
    from public.configuracoes c
    where c.user_id = v_uid
    for update;

  if v_estado_atual is not null
     and v_revisao = greatest(p_expected_revision, 0)
     and study_pro_internal.tem_regressao_historico(v_estado_atual, p_estado)
  then
    insert into public.backups(user_id,nome,versao,dados)
    values (
      v_uid,
      'Bloqueio anti-regressão — ' || v_agora,
      18,
      jsonb_build_object(
        'tipo','bloqueio_anti_regressao',
        'criadoEm',v_agora,
        'revisaoNuvem',v_revisao,
        'estadoNuvem',v_estado_atual,
        'estadoCandidato',p_estado,
        'motivo','histórico cumulativo menor que a nuvem'
      )
    );
    return query select false, v_revisao;
    return;
  end if;

  update public.configuracoes
     set dados = jsonb_set(coalesce(dados, '{}'::jsonb), '{appState}', p_estado, true),
         updated_at = now()
   where user_id = v_uid
     and (
       case
         when coalesce(dados #>> '{appState,syncRevision}', '') ~ '^[0-9]+$'
           then (dados #>> '{appState,syncRevision}')::bigint
         else 0
       end
     ) = greatest(p_expected_revision, 0);

  get diagnostics v_rows = row_count;

  if v_rows = 1 then
    return query
      select true,
             case
               when coalesce(p_estado->>'syncRevision', '') ~ '^[0-9]+$'
                 then (p_estado->>'syncRevision')::bigint
               else greatest(p_expected_revision, 0) + 1
             end;
    return;
  end if;

  if greatest(p_expected_revision, 0) = 0 then
    insert into public.configuracoes (user_id, dados)
    values (v_uid, jsonb_build_object('appState', p_estado))
    on conflict (user_id) do nothing;

    get diagnostics v_rows = row_count;

    if v_rows = 1 then
      return query
        select true,
               case
                 when coalesce(p_estado->>'syncRevision', '') ~ '^[0-9]+$'
                   then (p_estado->>'syncRevision')::bigint
                 else 1
               end;
      return;
    end if;
  end if;

  select
    case
      when coalesce(c.dados #>> '{appState,syncRevision}', '') ~ '^[0-9]+$'
        then (c.dados #>> '{appState,syncRevision}')::bigint
      else 0
    end
    into v_revisao
    from public.configuracoes c
    where c.user_id = v_uid;

  return query select false, coalesce(v_revisao, 0);
end;
$function$;

create or replace function study_pro_internal.criar_backup_oficial(
  p_tipo text
)
returns integer
language plpgsql
security invoker
set search_path = public, study_pro_internal
as $$
declare
  v_dia date := (clock_timestamp() at time zone 'America/Recife')::date;
  v_agora text := to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_count integer := 0;
  r record;
  v_nome text;
  v_revisao bigint;
  v_rev_meio_dia bigint;
begin
  if p_tipo not in ('backup_oficial_meio_dia','backup_oficial_fechamento') then
    raise exception 'tipo de backup oficial inválido';
  end if;

  for r in
    select user_id, dados->'appState' as estado
    from public.configuracoes
    where dados->'appState' is not null
  loop
    v_revisao := case
      when coalesce(r.estado->>'syncRevision','') ~ '^[0-9]+$'
        then (r.estado->>'syncRevision')::bigint
      else 0 end;

    if p_tipo = 'backup_oficial_meio_dia' then
      v_nome := 'Oficial ' || v_dia::text || ' 12h';

      if not exists (
        select 1 from public.backups b
        where b.user_id = r.user_id and b.nome = v_nome
      ) then
        insert into public.backups(user_id,nome,versao,dados)
        values (
          r.user_id, v_nome, 18,
          jsonb_build_object(
            'tipo', p_tipo,
            'diaLocal', v_dia::text,
            'criadoEm', v_agora,
            'syncRevision', v_revisao,
            'estado', r.estado,
            'resumo', jsonb_build_object(
              'sessoes', jsonb_array_length(coalesce(r.estado->'sessoes','[]'::jsonb)),
              'questoes', jsonb_array_length(coalesce(r.estado->'questoes','[]'::jsonb)),
              'revisoes', jsonb_array_length(coalesce(r.estado->'revisoes','[]'::jsonb)),
              'simulados', jsonb_array_length(coalesce(r.estado->'simulados','[]'::jsonb)),
              'missoesConcluidas', jsonb_array_length(coalesce(r.estado->'missoesConcluidas','[]'::jsonb))
            )
          )
        );
        v_count := v_count + 1;
      end if;
    else
      v_nome := 'Oficial ' || v_dia::text || ' 22h';

      select case
          when coalesce(b.dados->>'syncRevision','') ~ '^[0-9]+$'
            then (b.dados->>'syncRevision')::bigint
          else -1 end
        into v_rev_meio_dia
      from public.backups b
      where b.user_id = r.user_id
        and b.nome = 'Oficial ' || v_dia::text || ' 12h'
      order by b.created_at desc
      limit 1;

      if coalesce(v_rev_meio_dia,-1) <> v_revisao
         and not exists (
           select 1 from public.backups b
           where b.user_id = r.user_id and b.nome = v_nome
         )
      then
        insert into public.backups(user_id,nome,versao,dados)
        values (
          r.user_id, v_nome, 18,
          jsonb_build_object(
            'tipo', p_tipo,
            'diaLocal', v_dia::text,
            'criadoEm', v_agora,
            'syncRevision', v_revisao,
            'estado', r.estado,
            'resumo', jsonb_build_object(
              'sessoes', jsonb_array_length(coalesce(r.estado->'sessoes','[]'::jsonb)),
              'questoes', jsonb_array_length(coalesce(r.estado->'questoes','[]'::jsonb)),
              'revisoes', jsonb_array_length(coalesce(r.estado->'revisoes','[]'::jsonb)),
              'simulados', jsonb_array_length(coalesce(r.estado->'simulados','[]'::jsonb)),
              'missoesConcluidas', jsonb_array_length(coalesce(r.estado->'missoesConcluidas','[]'::jsonb))
            )
          )
        );
        v_count := v_count + 1;
      end if;
    end if;
  end loop;

  delete from public.backups
  where created_at < now() - interval '14 days'
    and dados->>'tipo' in (
      'backup_incremental',
      'backup_oficial_meio_dia',
      'backup_oficial_fechamento'
    );

  return v_count;
end;
$$;

do $$
declare v_jobid bigint;
begin
  for v_jobid in
    select jobid from cron.job
    where jobname in ('study-pro-backup-oficial-12h','study-pro-backup-fechamento-22h')
  loop
    perform cron.unschedule(v_jobid);
  end loop;
end $$;

select cron.schedule(
  'study-pro-backup-oficial-12h',
  '0 15 * * *',
  $$select study_pro_internal.criar_backup_oficial('backup_oficial_meio_dia');$$
);

select cron.schedule(
  'study-pro-backup-fechamento-22h',
  '0 1 * * *',
  $$select study_pro_internal.criar_backup_oficial('backup_oficial_fechamento');$$
);
