-- Study Pro PMPE — STAGING-ONLY backup restore prototype.
-- Tested ONLY on pmpe-study-pro-staging 2026-11-20.
-- DO NOT move into supabase/migrations or deploy to production without
-- complete browser/real JWT tests and an independent SECURITY DEFINER audit.
-- Operates on a previously saved backup owned by auth.uid().
-- Requires explicit confirmation text and expected cloud revision.
-- Saves original state in a separate backup in the same transaction.
-- UI is NOT yet connected; importing manual JSON backups still uses old flow.
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

  v_new := jsonb_set(v_snapshot, '{syncRevision}', to_jsonb(v_cur_revision + 1), true);
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
