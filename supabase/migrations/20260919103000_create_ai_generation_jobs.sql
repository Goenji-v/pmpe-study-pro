create table if not exists public.geracoes_ia_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id text not null,
  status text not null default 'fila'
    check (status in ('fila','processando','concluida','erro')),
  etapa text not null default 'fila'
    check (etapa in ('fila','gerando','revisando','corrigindo','salvando','concluida','erro')),
  progresso integer not null default 0
    check (progresso between 0 and 100),
  titulo text not null default '',
  descricao text not null default '',
  payload jsonb not null default '{}'::jsonb,
  resultado jsonb,
  erro text,
  criada_em timestamptz not null default now(),
  iniciada_em timestamptz,
  atualizada_em timestamptz not null default now(),
  concluida_em timestamptz,
  execucao_id uuid,
  lease_ate timestamptz,
  unique (user_id, request_id)
);

alter table public.geracoes_ia_jobs
  add column if not exists execucao_id uuid,
  add column if not exists lease_ate timestamptz;

create index if not exists geracoes_ia_jobs_user_status_idx
  on public.geracoes_ia_jobs (user_id, status, atualizada_em desc);

create index if not exists geracoes_ia_jobs_lease_idx
  on public.geracoes_ia_jobs (status, lease_ate)
  where status in ('fila','processando');

alter table public.geracoes_ia_jobs enable row level security;

drop policy if exists geracoes_ia_jobs_select_own on public.geracoes_ia_jobs;
create policy geracoes_ia_jobs_select_own
on public.geracoes_ia_jobs
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists geracoes_ia_jobs_insert_own on public.geracoes_ia_jobs;
create policy geracoes_ia_jobs_insert_own
on public.geracoes_ia_jobs
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists geracoes_ia_jobs_update_own on public.geracoes_ia_jobs;
create policy geracoes_ia_jobs_update_own
on public.geracoes_ia_jobs
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists geracoes_ia_jobs_delete_own on public.geracoes_ia_jobs;
create policy geracoes_ia_jobs_delete_own
on public.geracoes_ia_jobs
for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.geracoes_ia_jobs from anon;
grant select, insert, update, delete on public.geracoes_ia_jobs to authenticated;

comment on table public.geracoes_ia_jobs is
'Jobs persistentes de geração/revisão de questões IA por usuário, permitindo continuar o processamento após o navegador sair da tela.';

comment on column public.geracoes_ia_jobs.execucao_id is
'Token da execução atual; impede que uma instância antiga finalize o mesmo job após failover.';

comment on column public.geracoes_ia_jobs.lease_ate is
'Prazo até o qual a execução atual mantém a posse do job.';
