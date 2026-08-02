create table if not exists public.ranking_mensal (
  user_id uuid not null references auth.users(id) on delete cascade,
  nome_publico text not null default 'Usuário',
  mes text not null,
  minutos integer not null default 0 check (minutos >= 0),
  questoes integer not null default 0 check (questoes >= 0),
  acertos integer not null default 0 check (acertos >= 0 and acertos <= questoes),
  revisoes integer not null default 0 check (revisoes >= 0),
  simulados integer not null default 0 check (simulados >= 0),
  xp integer not null default 0 check (xp >= 0),
  nivel integer not null default 1 check (nivel >= 1),
  atualizado_em timestamptz not null default now(),
  primary key (user_id, mes)
);

alter table public.ranking_mensal enable row level security;

drop policy if exists "ranking visivel para autenticados" on public.ranking_mensal;
create policy "ranking visivel para autenticados"
on public.ranking_mensal for select
to authenticated
using (true);

drop policy if exists "usuario publica proprio ranking" on public.ranking_mensal;
create policy "usuario publica proprio ranking"
on public.ranking_mensal for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "usuario atualiza proprio ranking" on public.ranking_mensal;
create policy "usuario atualiza proprio ranking"
on public.ranking_mensal for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists ranking_mensal_mes_xp_idx
on public.ranking_mensal (mes, xp desc, minutos desc, acertos desc);
