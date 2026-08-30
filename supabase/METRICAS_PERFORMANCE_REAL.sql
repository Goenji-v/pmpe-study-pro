-- Métricas reais de performance (Core Web Vitals) por sessão e rota.
-- Aplicado no projeto Supabase em 2026-08-30.

create table if not exists public.metricas_performance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  metrica text not null check (metrica in ('LCP','CLS','INP','TTFB')),
  valor double precision not null check (valor >= 0),
  classificacao text not null check (classificacao in ('bom','atencao','ruim')),
  rota text not null,
  viewport text,
  dispositivo text not null check (dispositivo in ('mobile','tablet','desktop')),
  user_agent text,
  app_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, session_id, rota, metrica)
);

alter table public.metricas_performance enable row level security;

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

drop policy if exists metricas_performance_ler_admin on public.metricas_performance;
create policy metricas_performance_ler_admin
on public.metricas_performance
for select
to authenticated
using ((select sou_admin()));

create index if not exists metricas_performance_created_idx
  on public.metricas_performance (created_at desc);
create index if not exists metricas_performance_dispositivo_metrica_idx
  on public.metricas_performance (dispositivo, metrica, created_at desc);
create index if not exists metricas_performance_rota_idx
  on public.metricas_performance (rota, created_at desc);
