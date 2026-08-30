-- Otimiza as policies RLS de metricas_performance para evitar
-- reavaliar auth.uid() linha a linha em consultas/escritas maiores.
-- Mantém exatamente a mesma regra de autorização.

drop policy if exists metricas_performance_inserir_proprio on public.metricas_performance;
create policy metricas_performance_inserir_proprio
on public.metricas_performance
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists metricas_performance_atualizar_proprio on public.metricas_performance;
create policy metricas_performance_atualizar_proprio
on public.metricas_performance
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
