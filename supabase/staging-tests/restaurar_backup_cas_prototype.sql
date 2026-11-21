-- Study Pro PMPE — STAGING-ONLY backup restore prototype.
-- Tested ONLY on pmpe-study-pro-staging 2026-11-20.
-- DO NOT move into supabase/migrations or deploy to production without
-- complete browser/real JWT tests and an independent SECURITY DEFINER audit.
-- Operates on a previously saved backup owned by auth.uid().
-- Requires explicit confirmation text and expected cloud revision.
-- Saves original state in a separate backup in the same transaction.
-- The STAGING timeline UI uses this RPC; browser E2E is still pending.
-- Importing manual JSON backups still uses the previous flow.
-- Precondition: schema and tables/backups/RLS exist and are compatible.

CREATE OR REPLACE FUNCTION study_pro_internal.restaurar_backup_cas_impl(p_backup_id uuid, p_expected_revision bigint, p_confirmacao text)
 RETURNS TABLE(ok boolean, revisao_atual bigint, backup_seguranca_id uuid, estado_restaurado jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_current jsonb;
  v_snapshot jsonb;
  v_new jsonb;
  v_cur_revision bigint;
  v_current_rev_text text;
  v_safety_id uuid;
  v_now timestamptz := now();
  v_materia jsonb;
  v_modulo jsonb;
  v_assunto jsonb;
  v_aula jsonb;
  v_ids_materias text[] := array[]::text[];
  v_ids_modulos text[];
  v_ids_assuntos text[];
  v_ids_aulas text[];
begin
  if v_uid is null then raise exception 'Autenticação obrigatória' using errcode = '42501'; end if;
  if p_confirmacao is distinct from 'CONFIRMO_RESTAURACAO'
     or p_expected_revision is null
     or p_expected_revision < 0
     or p_expected_revision = 9223372036854775807
     or p_backup_id is null
  then raise exception 'Parâmetros de restauração inválidos' using errcode = '22023'; end if;

  select c.dados -> 'appState', c.dados #>> '{appState,syncRevision}'
    into v_current, v_current_rev_text
  from public.configuracoes c where c.user_id = v_uid for update;
  if v_current is null then
    raise exception 'Estado atual indisponível; restauração cancelada' using errcode = '22023';
  end if;
  if v_current_rev_text is null or v_current_rev_text !~ '^[0-9]{1,19}$' then
    raise exception 'Revisão atual inválida; restauração cancelada' using errcode = '22023';
  end if;
  v_cur_revision := v_current_rev_text::bigint;
  if v_cur_revision <> p_expected_revision then
    return query select false, v_cur_revision, null::uuid, null::jsonb;
    return;
  end if;

  select b.dados -> 'estado' into v_snapshot
  from public.backups b where b.id = p_backup_id and b.user_id = v_uid;
  if v_snapshot is null
     or jsonb_typeof(v_snapshot) IS DISTINCT FROM 'object'
     or jsonb_typeof(v_snapshot -> 'sessoes') IS DISTINCT FROM 'array'
     or jsonb_typeof(v_snapshot -> 'revisoes') IS DISTINCT FROM 'array'
     or jsonb_typeof(v_snapshot -> 'questoes') IS DISTINCT FROM 'array'
     or jsonb_typeof(v_snapshot -> 'simulados') IS DISTINCT FROM 'array'
     or jsonb_typeof(v_snapshot -> 'missoesConcluidas') IS DISTINCT FROM 'array'
     or jsonb_typeof(v_snapshot -> 'bancoQuestoes') IS DISTINCT FROM 'array'
     or jsonb_typeof(v_snapshot -> 'simuladosGerados') IS DISTINCT FROM 'array'
     or jsonb_typeof(v_snapshot -> 'materias') IS DISTINCT FROM 'array'
     or jsonb_typeof(v_snapshot -> 'configuracoes') IS DISTINCT FROM 'object'
  then
    raise exception 'Backup indisponível ou incompleto' using errcode = '22023';
  end if;

  -- Do not commit an invalid state and leave frontend validation to discover it.
  -- Schema 18 is required: older backups must first be migrated and validated
  -- through an explicit safe flow, not automatically rewritten by this RPC.
  if jsonb_typeof(v_snapshot -> 'schemaVersion') is distinct from 'number'
     or v_snapshot ->> 'schemaVersion' is distinct from '18'
     or jsonb_typeof(v_snapshot -> 'versao') is distinct from 'number'
     or v_snapshot ->> 'versao' is distinct from '18'
  then
    raise exception 'Versão de backup incompatível; migração necessária' using errcode='22023';
  end if;

  if jsonb_typeof(v_snapshot #> '{configuracoes,metaQuestoesDiaria}') is distinct from 'number'
     or jsonb_typeof(v_snapshot #> '{configuracoes,metaMinutosDiaria}') is distinct from 'number'
     or jsonb_typeof(v_snapshot #> '{configuracoes,metaRevisoesDiaria}') is distinct from 'number'
  then
    raise exception 'Metas do backup ausentes ou inválidas' using errcode='22023';
  end if;
  if (v_snapshot #>> '{configuracoes,metaQuestoesDiaria}')::numeric < 0
     or (v_snapshot #>> '{configuracoes,metaMinutosDiaria}')::numeric < 0
     or (v_snapshot #>> '{configuracoes,metaRevisoesDiaria}')::numeric < 0
  then
    raise exception 'Metas negativas no backup' using errcode='22023';
  end if;
  if v_snapshot #> '{configuracoes,missoesPorDia}' is not null then
    if jsonb_typeof(v_snapshot #> '{configuracoes,missoesPorDia}') is distinct from 'number' then
      raise exception 'Quantidade de missões inválida' using errcode='22023';
    end if;
    if (v_snapshot #>> '{configuracoes,missoesPorDia}')::numeric < 1
       or (v_snapshot #>> '{configuracoes,missoesPorDia}')::numeric > 6
    then
      raise exception 'Quantidade de missões fora do limite' using errcode='22023';
    end if;
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(v_snapshot -> 'missoesConcluidas') as m(item)
    where pg_catalog.jsonb_typeof(m.item) is distinct from 'string'
  ) then
    raise exception 'Identificadores de missões inválidos' using errcode='22023';
  end if;

  -- Mirror the key integrity checks in validarIntegridadeEstado:
  -- materia/modulo/assunto/aula must have unique, nonempty IDs per parent.
  for v_materia in select value from pg_catalog.jsonb_array_elements(v_snapshot -> 'materias')
  loop
    if jsonb_typeof(v_materia) is distinct from 'object'
       or jsonb_typeof(v_materia -> 'id') is distinct from 'string'
       or jsonb_typeof(v_materia -> 'nome') is distinct from 'string'
       or pg_catalog.btrim(v_materia ->> 'id') = ''
       or pg_catalog.btrim(v_materia ->> 'nome') = ''
       or (v_materia ->> 'id') = any(v_ids_materias)
    then
      raise exception 'Matéria inválida ou repetida no backup' using errcode='22023';
    end if;
    v_ids_materias := pg_catalog.array_append(v_ids_materias, v_materia ->> 'id');
    if v_materia ? 'modulos' and jsonb_typeof(v_materia -> 'modulos') is distinct from 'array' then
      raise exception 'Módulos inválidos no backup' using errcode='22023';
    end if;
    v_ids_modulos := array[]::text[];
    for v_modulo in select value from pg_catalog.jsonb_array_elements(coalesce(v_materia -> 'modulos', '[]'::jsonb))
    loop
      if jsonb_typeof(v_modulo) is distinct from 'object'
         or jsonb_typeof(v_modulo -> 'id') is distinct from 'string'
         or jsonb_typeof(v_modulo -> 'nome') is distinct from 'string'
         or pg_catalog.btrim(v_modulo ->> 'id') = ''
         or pg_catalog.btrim(v_modulo ->> 'nome') = ''
         or jsonb_typeof(v_modulo -> 'assuntos') is distinct from 'array'
         or (v_modulo ->> 'id') = any(v_ids_modulos)
      then
        raise exception 'Módulo inválido ou repetido no backup' using errcode='22023';
      end if;
      v_ids_modulos := pg_catalog.array_append(v_ids_modulos, v_modulo ->> 'id');
      v_ids_assuntos := array[]::text[];
      for v_assunto in select value from pg_catalog.jsonb_array_elements(v_modulo -> 'assuntos')
      loop
        if jsonb_typeof(v_assunto) is distinct from 'object'
           or jsonb_typeof(v_assunto -> 'id') is distinct from 'string'
           or jsonb_typeof(v_assunto -> 'nome') is distinct from 'string'
           or pg_catalog.btrim(v_assunto ->> 'id') = ''
           or pg_catalog.btrim(v_assunto ->> 'nome') = ''
           or (v_assunto ->> 'id') = any(v_ids_assuntos)
        then
          raise exception 'Assunto inválido ou repetido no backup' using errcode='22023';
        end if;
        v_ids_assuntos := pg_catalog.array_append(v_ids_assuntos, v_assunto ->> 'id');
        if v_assunto ? 'aulas' and jsonb_typeof(v_assunto -> 'aulas') is distinct from 'array' then
          raise exception 'Aulas inválidas no backup' using errcode='22023';
        end if;
        v_ids_aulas := array[]::text[];
        for v_aula in select value from pg_catalog.jsonb_array_elements(coalesce(v_assunto -> 'aulas','[]'::jsonb))
        loop
          if jsonb_typeof(v_aula) is distinct from 'object'
             or jsonb_typeof(v_aula -> 'id') is distinct from 'string'
             or jsonb_typeof(v_aula -> 'nome') is distinct from 'string'
             or pg_catalog.btrim(v_aula ->> 'id') = ''
             or pg_catalog.btrim(v_aula ->> 'nome') = ''
             or (v_aula ->> 'id') = any(v_ids_aulas)
          then
            raise exception 'Aula inválida ou repetida no backup' using errcode='22023';
          end if;
          v_ids_aulas := pg_catalog.array_append(v_ids_aulas, v_aula ->> 'id');
        end loop;
      end loop;
    end loop;
  end loop;

  v_new := jsonb_set(v_snapshot, '{syncRevision}', to_jsonb(v_cur_revision + 1), true);

  -- Preserve the newest account reset generation (same rule as frontend).
  if (v_current #>> '{configuracoes,dadosReiniciadosEm}') is not null
     and (
       v_new #>> '{configuracoes,dadosReiniciadosEm}' is null
       or v_new #>> '{configuracoes,dadosReiniciadosEm}' <
          v_current #>> '{configuracoes,dadosReiniciadosEm}'
     )
  then
    v_new := jsonb_set(
      v_new, '{configuracoes,dadosReiniciadosEm}',
      to_jsonb(v_current #>> '{configuracoes,dadosReiniciadosEm}'), true
    );
    v_new := jsonb_set(
      v_new, '{configuracoes,armazenamentoPorConta}', 'true'::jsonb, true
    );
  end if;
  v_new := jsonb_set(v_new, '{atualizadoEm}', to_jsonb(v_now::text), true);
  v_new := jsonb_set(v_new, '{salvoEm}', to_jsonb(v_now::text), true);

  -- Backup safety copy is made in the SAME transaction, before changing appState.
  insert into public.backups (user_id,nome,versao,dados)
  values (v_uid,'Antes da restauração ' || to_char(v_now,'YYYY-MM-DD HH24:MI:SS') || ' ' || gen_random_uuid()::text,18,
    jsonb_build_object('tipo','backup_incremental','criadoEm',v_now,'syncRevision',v_cur_revision,
      'estado',v_current,'motivo','antes_restauracao_explicita','backupAlvo',p_backup_id))
  returning id into v_safety_id;

  update public.configuracoes c
  set dados = jsonb_set(coalesce(c.dados,'{}'::jsonb),'{appState}',v_new,true),
      updated_at = v_now
  where c.user_id = v_uid;

  return query select true, v_cur_revision + 1, v_safety_id, v_new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.restaurar_backup_cas(p_backup_id uuid, p_expected_revision bigint, p_confirmacao text)
 RETURNS TABLE(ok boolean, revisao_atual bigint, backup_seguranca_id uuid, estado_restaurado jsonb)
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select x.ok,x.revisao_atual,x.backup_seguranca_id,x.estado_restaurado
  from study_pro_internal.restaurar_backup_cas_impl(p_backup_id,p_expected_revision,p_confirmacao) x;
$function$
;

revoke all on function study_pro_internal.restaurar_backup_cas_impl(uuid,bigint,text)
  from public, anon, authenticated;
grant usage on schema study_pro_internal to authenticated;
grant execute on function study_pro_internal.restaurar_backup_cas_impl(uuid,bigint,text)
  to authenticated;
revoke all on function public.restaurar_backup_cas(uuid,bigint,text)
  from public, anon, authenticated;
grant execute on function public.restaurar_backup_cas(uuid,bigint,text)
  to authenticated;

-- TEST SUMMARY (all executed in ROLLBACK transaction):
-- Valid restore of an older snapshot succeeded with fresh syncRevision.
-- Pre-restore safety snapshot was persisted inside same transaction.
-- Safety snapshot could restore the previous newer state.
-- Wrong confirmation was rejected.
-- Replayed old expected revision was rejected.
-- Another user's backup ID was rejected.
-- No synthetic rows remained after rollback.
