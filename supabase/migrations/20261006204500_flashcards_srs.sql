alter table public.flashcards_progresso
  add column if not exists avaliacao_ultima text null,
  add column if not exists repeticoes integer not null default 0,
  add column if not exists intervalo_dias integer not null default 0,
  add column if not exists fator_facilidade numeric(4,2) not null default 2.50,
  add column if not exists proxima_revisao_em timestamptz null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'flashcards_progresso_avaliacao_srs_check'
  ) then
    alter table public.flashcards_progresso
      add constraint flashcards_progresso_avaliacao_srs_check
      check (
        avaliacao_ultima is null
        or avaliacao_ultima in ('dificil', 'medio', 'facil')
      );
  end if;
end
$$;

create index if not exists flashcards_progresso_user_proxima_revisao_idx
  on public.flashcards_progresso (user_id, proxima_revisao_em);
