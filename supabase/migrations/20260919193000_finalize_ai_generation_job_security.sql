-- Fase 2: depois que o backend novo estiver LIVE e validado,
-- remove do cliente autenticado qualquer escrita direta nos jobs de IA.
-- A leitura do próprio usuário continua protegida pela policy SELECT existente.

drop policy if exists geracoes_ia_jobs_insert_own on public.geracoes_ia_jobs;
drop policy if exists geracoes_ia_jobs_update_own on public.geracoes_ia_jobs;
drop policy if exists geracoes_ia_jobs_delete_own on public.geracoes_ia_jobs;

revoke all on table public.geracoes_ia_jobs
  from anon, authenticated, public;

grant select on table public.geracoes_ia_jobs
  to authenticated;

grant select, insert, update, delete
  on table public.geracoes_ia_jobs
  to service_role;

comment on table public.geracoes_ia_jobs is
  'Jobs persistentes de IA: cliente autenticado lê apenas os próprios registros; escrita interna exclusiva do backend.';
