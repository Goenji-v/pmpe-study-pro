create table if not exists public.simulado_pdf_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id text not null,
  status text not null default 'fila'
    check (status in ('fila','processando','concluida','erro','cancelada')),
  etapa text not null default 'fila'
    check (etapa in ('fila','baixando','analisando','validando','concluida','erro','cancelada')),
  progresso integer not null default 0
    check (progresso between 0 and 100),
  nome text not null default 'Simulado em PDF',
  total_questoes integer not null
    check (total_questoes between 1 and 200),
  caderno_path text not null,
  caderno_nome text not null,
  comentado_path text,
  comentado_nome text,
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

create index if not exists simulado_pdf_jobs_user_status_idx
  on public.simulado_pdf_jobs (user_id, status, atualizada_em desc);

create index if not exists simulado_pdf_jobs_lease_idx
  on public.simulado_pdf_jobs (status, lease_ate)
  where status in ('fila','processando');

alter table public.simulado_pdf_jobs enable row level security;

drop policy if exists simulado_pdf_jobs_select_own on public.simulado_pdf_jobs;
create policy simulado_pdf_jobs_select_own
on public.simulado_pdf_jobs
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists simulado_pdf_jobs_insert_own on public.simulado_pdf_jobs;
create policy simulado_pdf_jobs_insert_own
on public.simulado_pdf_jobs
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists simulado_pdf_jobs_update_own on public.simulado_pdf_jobs;
create policy simulado_pdf_jobs_update_own
on public.simulado_pdf_jobs
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists simulado_pdf_jobs_delete_own on public.simulado_pdf_jobs;
create policy simulado_pdf_jobs_delete_own
on public.simulado_pdf_jobs
for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all privileges on table public.simulado_pdf_jobs from anon;
revoke truncate, references, trigger
  on table public.simulado_pdf_jobs from authenticated;
grant select, insert, update, delete
  on table public.simulado_pdf_jobs to authenticated;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'analises_simulados_origem_check'
      and conrelid = 'public.analises_simulados'::regclass
  ) then
    alter table public.analises_simulados
      drop constraint analises_simulados_origem_check;
  end if;
end $$;

alter table public.analises_simulados
  add constraint analises_simulados_origem_check
  check (origem in ('ia','oficial','pdf'));

comment on table public.simulado_pdf_jobs is
  'Processamento persistente de simulados enviados em PDF, com progresso e retomada por usuário.';
