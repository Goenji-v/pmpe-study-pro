-- Remove exposições apontadas pelo advisor sem mudar a lógica das RPCs.
revoke all on function public.definir_primeira_tentativa_simulado_oficial() from public, anon, authenticated;
revoke all on function public.iniciar_simulado_oficial(uuid) from public, anon;
grant execute on function public.iniciar_simulado_oficial(uuid) to authenticated;
revoke all on function public.finalizar_simulado_oficial(uuid, jsonb, integer) from public, anon;
grant execute on function public.finalizar_simulado_oficial(uuid, jsonb, integer) to authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

-- As RPCs administrativas continuam autenticadas e validam `sou_admin()`
-- internamente. Nunca são liberadas para anon.
revoke all on function public.admin_listar_usuarios() from public, anon;
grant execute on function public.admin_listar_usuarios() to authenticated;
revoke all on function public.admin_resumo() from public, anon;
grant execute on function public.admin_resumo() to authenticated;
