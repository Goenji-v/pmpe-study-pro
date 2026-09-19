-- Endurece os jobs persistentes de IA e cria cota persistente por usuário.
-- Preparada para avaliação; não aplicada em produção nesta rodada.

create table if not exists public.ia_consumo_janelas (
  user_id uuid not null references auth.users(id) on delete cascade,
  categoria text not null check (categoria in ('geral', 'importacao')),
  janela_inicio timestamptz not null,
  quantidade integer not null default 0 check (quantidade >= 0),
  atualizada_em timestamptz not null default now(),
  primary key (user_id, categoria, janela_inicio)
);

alter table public.ia_consumo_janelas enable row level security;
revoke all on public.ia_consumo_janelas from anon, authenticated;

create or replace function public.consumir_cota_ia(
  p_categoria text,
  p_janela_segundos integer,
  p_limite integer
)
returns table (
  permitido boolean,
  quantidade integer,
  limite integer,
  janela_inicio timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_agora timestamptz := now();
  v_janela_inicio timestamptz;
  v_quantidade integer;
begin
  if v_user_id is null then
    raise exception 'Autenticação obrigatória.';
  end if;
  if p_categoria not in ('geral', 'importacao') then
    raise exception 'Categoria de cota inválida.';
  end if;
  if p_janela_segundos < 60 or p_janela_segundos > 86400 then
    raise exception 'Janela de cota inválida.';
  end if;
  if p_limite < 1 or p_limite > 1000 then
    raise exception 'Limite de cota inválido.';
  end if;

  v_janela_inicio := to_timestamp(
    floor(extract(epoch from v_agora) / p_janela_segundos) * p_janela_segundos
  );

  insert into public.ia_consumo_janelas (
    user_id, categoria, janela_inicio, quantidade, atualizada_em
  )
  values (v_user_id, p_categoria, v_janela_inicio, 1, v_agora)
  on conflict (user_id, categoria, janela_inicio)
  do update
     set quantidade = public.ia_consumo_janelas.quantidade + 1,
         atualizada_em = excluded.atualizada_em
   where public.ia_consumo_janelas.quantidade < p_limite
  returning public.ia_consumo_janelas.quantidade into v_quantidade;

  if v_quantidade is null then
    select c.quantidade into v_quantidade
      from public.ia_consumo_janelas c
     where c.user_id = v_user_id
       and c.categoria = p_categoria
       and c.janela_inicio = v_janela_inicio;
  end if;

  delete from public.ia_consumo_janelas
   where user_id = v_user_id
     and janela_inicio < v_agora - interval '7 days';

  return query
  select v_quantidade <= p_limite, v_quantidade, p_limite, v_janela_inicio;
end;
$$;

revoke all on function public.consumir_cota_ia(text, integer, integer) from public, anon;
grant execute on function public.consumir_cota_ia(text, integer, integer) to authenticated;

-- O navegador pode criar e consultar apenas o próprio job. Estado interno,
-- resultado, lease e exclusão passam a ser escritos exclusivamente pelo backend
-- com a credencial de serviço, que nunca é exposta ao cliente.
drop policy if exists geracoes_ia_jobs_update_own on public.geracoes_ia_jobs;
drop policy if exists geracoes_ia_jobs_delete_own on public.geracoes_ia_jobs;

revoke update, delete, truncate, trigger, references
  on public.geracoes_ia_jobs
  from authenticated;

revoke insert on public.geracoes_ia_jobs from authenticated;
grant insert (user_id, request_id, titulo, descricao, payload)
  on public.geracoes_ia_jobs
  to authenticated;

comment on table public.ia_consumo_janelas is
'Cotas persistentes de consumo da IA por usuário e janela. Sem acesso direto pelo cliente.';
comment on table public.geracoes_ia_jobs is
'Jobs persistentes de IA: cliente autenticado lê/cria o próprio job; transições internas são exclusivas do backend.';
