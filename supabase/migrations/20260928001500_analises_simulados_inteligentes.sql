-- Análises inteligentes dos simulados do próprio usuário.
-- Unifica Simulado IA e Simulado Oficial sem alterar a correção oficial.

create table if not exists public.analises_simulados (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  origem text not null check (origem in ('ia','oficial')),
  tentativa_id text not null,
  simulado_id text,
  nome text not null,
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (user_id, origem, tentativa_id)
);

create index if not exists analises_simulados_user_data_idx
  on public.analises_simulados(user_id, atualizado_em desc);

create index if not exists analises_simulados_simulado_idx
  on public.analises_simulados(user_id, origem, simulado_id)
  where simulado_id is not null;

alter table public.analises_simulados enable row level security;

drop policy if exists analises_simulados_ler_proprias on public.analises_simulados;
create policy analises_simulados_ler_proprias
on public.analises_simulados
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists analises_simulados_criar_proprias on public.analises_simulados;
create policy analises_simulados_criar_proprias
on public.analises_simulados
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists analises_simulados_atualizar_proprias on public.analises_simulados;
create policy analises_simulados_atualizar_proprias
on public.analises_simulados
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists analises_simulados_excluir_proprias on public.analises_simulados;
create policy analises_simulados_excluir_proprias
on public.analises_simulados
for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all privileges on table public.analises_simulados from anon;
revoke truncate, references, trigger
  on table public.analises_simulados from authenticated;
grant select, insert, update, delete
  on table public.analises_simulados to authenticated;

comment on table public.analises_simulados is
  'Diagnóstico inteligente de simulados, caderno de erros, marcações cognitivas e evolução do próprio aluno.';
