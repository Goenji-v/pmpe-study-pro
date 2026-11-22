-- PR #562: delete one explicitly selected study-session by atomic CAS.
-- Only staging QA until PR reviewed and promoted.
create or replace function study_pro_internal.excluir_sessao_historico_cas(
  p_expected_revision bigint,
  p_sessao_id text
)
returns table(ok boolean, revisao_atual bigint, estado jsonb)
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid := auth.uid();
  v_estado jsonb;
  v_revisao bigint;
  v_sessoes jsonb;
  v_novas jsonb;
  v_agora text := to_char(pg_catalog.clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if v_uid is null then raise exception 'authentication required'; end if;
  if p_sessao_id is null or length(p_sessao_id) < 1 or length(p_sessao_id) > 128 then
    raise exception 'session identifier invalid';
  end if;
  select c.dados->'appState',
         case when coalesce(c.dados #>> '{appState,syncRevision}','') ~ '^[0-9]+$'
              then (c.dados #>> '{appState,syncRevision}')::bigint else 0 end
    into v_estado, v_revisao
    from public.configuracoes c
   where c.user_id = v_uid
     for update;
  if v_estado is null then
    return query select false, 0::bigint, null::jsonb; return;
  end if;
  if v_revisao <> greatest(p_expected_revision, 0) then
    return query select false, v_revisao, null::jsonb; return;
  end if;
  if pg_catalog.jsonb_typeof(v_estado->'sessoes') <> 'array' then
    raise exception 'invalid saved session history';
  end if;
  v_sessoes := v_estado->'sessoes';
  if not exists (
    select 1 from pg_catalog.jsonb_array_elements(v_sessoes) a(item)
    where a.item->>'id' = p_sessao_id
  ) then
    raise exception 'session not found in cloud; reload before deleting';
  end if;
  select coalesce(pg_catalog.jsonb_agg(a.item order by a.ord),'[]'::jsonb)
    into v_novas
    from pg_catalog.jsonb_array_elements(v_sessoes) with ordinality a(item,ord)
   where a.item->>'id' is distinct from p_sessao_id;

  -- Backup the complete state before an intentional, bounded deletion.
  insert into public.backups(user_id,nome,versao,dados)
  values (
    v_uid,
    'Exclusão segura de sessão — ' || v_agora || ' — ' || pg_catalog.gen_random_uuid()::text,
    18,
    pg_catalog.jsonb_build_object(
      'tipo','exclusao_sessao_cas',
      'criadoEm',v_agora,
      'sessaoId',p_sessao_id,
      'syncRevision',v_revisao,
      'estado',v_estado
    )
  );
  v_estado := pg_catalog.jsonb_set(v_estado, '{sessoes}', v_novas, true);
  v_estado := pg_catalog.jsonb_set(v_estado, '{syncRevision}', pg_catalog.to_jsonb(v_revisao+1), true);
  v_estado := pg_catalog.jsonb_set(v_estado, '{atualizadoEm}', pg_catalog.to_jsonb(v_agora), true);
  v_estado := pg_catalog.jsonb_set(v_estado, '{salvoEm}', pg_catalog.to_jsonb(v_agora), true);
  update public.configuracoes
     set dados=pg_catalog.jsonb_set(coalesce(dados,'{}'::jsonb),'{appState}',v_estado,true),
         updated_at=now()
   where user_id=v_uid;
  return query select true, v_revisao+1, v_estado;
end;
$fn$;

revoke all on function study_pro_internal.excluir_sessao_historico_cas(bigint,text) from public, anon, authenticated;
grant execute on function study_pro_internal.excluir_sessao_historico_cas(bigint,text) to authenticated;

create or replace function public.excluir_sessao_historico_cas(
  p_expected_revision bigint,
  p_sessao_id text
)
returns table(ok boolean, revisao_atual bigint, estado jsonb)
language sql
security invoker
set search_path = ''
as $fn$
  select * from study_pro_internal.excluir_sessao_historico_cas(p_expected_revision,p_sessao_id);
$fn$;
revoke all on function public.excluir_sessao_historico_cas(bigint,text) from public, anon;
grant execute on function public.excluir_sessao_historico_cas(bigint,text) to authenticated;
