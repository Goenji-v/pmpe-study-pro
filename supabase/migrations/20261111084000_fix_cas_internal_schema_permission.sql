-- Corrige o CAS da sincronização para acessar a função interna de
-- anti-regressão sem expor o schema study_pro_internal ao cliente.
--
-- A função continua restrita ao usuário autenticado via auth.uid().

alter function public.salvar_estado_app_cas(bigint, jsonb)
  security definer;

alter function public.salvar_estado_app_cas(bigint, jsonb)
  set search_path = public, study_pro_internal, pg_temp;

revoke all on function public.salvar_estado_app_cas(bigint, jsonb)
  from public, anon;

grant execute on function public.salvar_estado_app_cas(bigint, jsonb)
  to authenticated;
