drop policy if exists metricas_performance_ler_proprio
  on public.metricas_performance;

create policy metricas_performance_ler_proprio
  on public.metricas_performance
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
