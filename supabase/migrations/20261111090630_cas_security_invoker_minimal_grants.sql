-- Mantém o CAS como SECURITY INVOKER e libera somente a função interna
-- necessária para comparar regressão de histórico.
--
-- A função de backup oficial continua inacessível ao papel authenticated.

alter function public.salvar_estado_app_cas(bigint, jsonb)
  security invoker;

alter function public.salvar_estado_app_cas(bigint, jsonb)
  set search_path = public, study_pro_internal, pg_temp;

revoke usage on schema study_pro_internal from public, anon;
grant usage on schema study_pro_internal to authenticated;

revoke execute on all functions in schema study_pro_internal
  from public, anon, authenticated;

grant execute on function study_pro_internal.tem_regressao_historico(jsonb, jsonb)
  to authenticated;

revoke execute on function public.salvar_estado_app_cas(bigint, jsonb)
  from public, anon;

grant execute on function public.salvar_estado_app_cas(bigint, jsonb)
  to authenticated;
