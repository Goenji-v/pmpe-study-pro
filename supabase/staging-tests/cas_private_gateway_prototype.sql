-- STUDY PRO STAGING ONLY — PROTOTYPE, NOT AN AUTOMATIC PRODUCTION MIGRATION.
-- Validated on pmpe-study-pro-staging (isolated sync-only schema).
-- Precondition: public.salvar_estado_app_cas(bigint,jsonb) exists,
-- its body verifies auth.uid(), revision increments, and detects regressions.
-- This prototype moves that implementation to an unexposed internal schema.
-- Requires an independent review before applying to production.
begin;

alter function public.salvar_estado_app_cas(bigint,jsonb) set schema study_pro_internal;
alter function study_pro_internal.salvar_estado_app_cas(bigint,jsonb) security definer;
alter function study_pro_internal.salvar_estado_app_cas(bigint,jsonb) set search_path = '';

revoke all on function study_pro_internal.salvar_estado_app_cas(bigint,jsonb)
  from public, anon, authenticated;
grant usage on schema study_pro_internal to authenticated;
grant execute on function study_pro_internal.salvar_estado_app_cas(bigint,jsonb)
  to authenticated;

-- The exposed Data API function remains SECURITY INVOKER.
create function public.salvar_estado_app_cas(
  p_expected_revision bigint,
  p_estado jsonb
) returns table(ok boolean, revisao_atual bigint)
language sql
security invoker
set search_path = ''
as $cas_wrapper$
  select result.ok, result.revisao_atual
  from study_pro_internal.salvar_estado_app_cas(p_expected_revision,p_estado) as result;
$cas_wrapper$;

revoke all on function public.salvar_estado_app_cas(bigint,jsonb)
  from public, anon, authenticated;
grant execute on function public.salvar_estado_app_cas(bigint,jsonb)
  to authenticated;

-- The app can only read its own row; writes must go through CAS.
revoke insert,update,delete,truncate,trigger,references
  on public.configuracoes from authenticated,anon,public;

commit;

-- SECURITY REVIEW BEFORE PRODUCTION:
-- 1) Do not execute blindly: current production schema has unrelated integrations.
-- 2) Ensure the inner function retains explicit auth.uid ownership checks.
-- 3) Ensure its revision payload validation and history anti-regression are present.
-- 4) Test a real JWT over PostgREST and simultaneous clients.
-- 5) Confirm backup/import/recovery and every configuration consumer still work.
-- 6) Verify the internal schema is not exposed in Supabase Data API.
