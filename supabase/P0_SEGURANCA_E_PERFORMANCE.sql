-- Correções P0 de segurança e performance aplicadas no Supabase em 2026-08-28.
-- Objetivos:
-- 1) impedir execução anônima da função de ranking;
-- 2) evitar reavaliação de auth.uid()/sou_admin() por linha nas políticas RLS;
-- 3) consolidar políticas SELECT permissivas duplicadas;
-- 4) adicionar índice para a FK notificacoes.feedback_id.

revoke execute on function public.recalcular_meu_ranking(text) from public, anon;
grant execute on function public.recalcular_meu_ranking(text) to authenticated, service_role;

drop policy if exists beta_feedback_inserir_proprio on public.beta_feedback;
create policy beta_feedback_inserir_proprio
on public.beta_feedback for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists beta_feedback_ler_proprio on public.beta_feedback;
drop policy if exists beta_feedback_admin_ler on public.beta_feedback;
drop policy if exists beta_feedback_ler_autorizado on public.beta_feedback;
create policy beta_feedback_ler_autorizado
on public.beta_feedback for select
to authenticated
using (
  (select auth.uid()) = user_id
  or (select public.sou_admin())
);

drop policy if exists beta_feedback_admin_atualizar on public.beta_feedback;
create policy beta_feedback_admin_atualizar
on public.beta_feedback for update
to authenticated
using ((select public.sou_admin()))
with check ((select public.sou_admin()));

drop policy if exists erros_cliente_inserir_proprio on public.erros_cliente;
create policy erros_cliente_inserir_proprio
on public.erros_cliente for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists erros_cliente_ler_proprio on public.erros_cliente;
drop policy if exists erros_cliente_admin_ler on public.erros_cliente;
drop policy if exists erros_cliente_ler_autorizado on public.erros_cliente;
create policy erros_cliente_ler_autorizado
on public.erros_cliente for select
to authenticated
using (
  (select auth.uid()) = user_id
  or (select public.sou_admin())
);

drop policy if exists notificacoes_ler_proprias on public.notificacoes;
create policy notificacoes_ler_proprias
on public.notificacoes for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists notificacoes_atualizar_proprias on public.notificacoes;
create policy notificacoes_atualizar_proprias
on public.notificacoes for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists notificacoes_admin_inserir on public.notificacoes;
create policy notificacoes_admin_inserir
on public.notificacoes for insert
to authenticated
with check ((select public.sou_admin()));

create index if not exists notificacoes_feedback_id_idx
  on public.notificacoes (feedback_id);
