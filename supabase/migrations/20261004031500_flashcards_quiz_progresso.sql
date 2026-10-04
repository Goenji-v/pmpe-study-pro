create table if not exists public.flashcards_progresso (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  questao_id text not null,
  materia text not null,
  topico text not null,
  tentativas integer not null default 0 check (tentativas >= 0),
  acertos integer not null default 0 check (acertos >= 0),
  erros integer not null default 0 check (erros >= 0),
  ultima_acertou boolean not null default false,
  ultima_modalidade text null check (
    ultima_modalidade is null
    or ultima_modalidade in ('flashcards', 'quiz')
  ),
  ultima_resposta_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, questao_id)
);

create index if not exists flashcards_progresso_user_materia_topico_idx
  on public.flashcards_progresso (user_id, materia, topico);

alter table public.flashcards_progresso enable row level security;

drop policy if exists "flashcards_select_proprio" on public.flashcards_progresso;
create policy "flashcards_select_proprio"
  on public.flashcards_progresso
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "flashcards_insert_proprio" on public.flashcards_progresso;
create policy "flashcards_insert_proprio"
  on public.flashcards_progresso
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "flashcards_update_proprio" on public.flashcards_progresso;
create policy "flashcards_update_proprio"
  on public.flashcards_progresso
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "flashcards_delete_proprio" on public.flashcards_progresso;
create policy "flashcards_delete_proprio"
  on public.flashcards_progresso
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.flashcards_progresso from anon;
grant select, insert, update, delete on table public.flashcards_progresso to authenticated;
