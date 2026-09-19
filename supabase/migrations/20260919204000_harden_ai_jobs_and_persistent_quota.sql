-- Endurece os jobs persistentes de IA e cria cota persistente por usuário.
-- Esta migração é versionada para avaliação na prévia; não deve ser aplicada
-- automaticamente em produção nesta rodada.

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
    user_id,
    categoria,
    janela_inicio,
    quantidade,
    atualizada_em
  )
  values (
    v_user_id,
    p_categoria,
    v_janela_inicio,
    1,
    v_agora
  )
  on conflict (user_id, categoria, janela_inicio)
  do update
     set quantidade = public.ia_consumo_janelas.quantidade + 1,
         atualizada_em = excluded.atualizada_em
   where public.ia_consumo_janelas.quantidade < p_limite
  returning public.ia_consumo_janelas.quantidade
    into v_quantidade;

  if v_quantidade is null then
    select c.quantidade
      into v_quantidade
      from public.ia_consumo_janelas c
     where c.user_id = v_user_id
       and c.categoria = p_categoria
       and c.janela_inicio = v_janela_inicio;
  end if;

  delete from public.ia_consumo_janelas
   where user_id = v_user_id
     and janela_inicio < v_agora - interval '7 days';

  return query
  select
    v_quantidade <= p_limite,
    v_quantidade,
    p_limite,
    v_janela_inicio;
end;
$$;

revoke all on function public.consumir_cota_ia(text, integer, integer) from public, anon;
grant execute on function public.consumir_cota_ia(text, integer, integer) to authenticated;

-- O cliente continua podendo criar e consultar o próprio job, mas deixa de
-- controlar status, resultado, lease e campos internos de execução.
drop policy if exists geracoes_ia_jobs_update_own on public.geracoes_ia_jobs;
drop policy if exists geracoes_ia_jobs_delete_own on public.geracoes_ia_jobs;

revoke update, delete, truncate, trigger, references
  on public.geracoes_ia_jobs
  from authenticated;

revoke insert on public.geracoes_ia_jobs from authenticated;
grant insert (user_id, request_id, titulo, descricao, payload)
  on public.geracoes_ia_jobs
  to authenticated;

create or replace function public.reivindicar_geracao_ia_job(
  p_job_id uuid,
  p_execucao_id uuid,
  p_lease_segundos integer default 300
)
returns setof public.geracoes_ia_jobs
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_agora timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'Autenticação obrigatória.';
  end if;

  if p_execucao_id is null then
    raise exception 'Identificador de execução obrigatório.';
  end if;

  if p_lease_segundos < 30 or p_lease_segundos > 600 then
    raise exception 'Lease inválido.';
  end if;

  return query
  update public.geracoes_ia_jobs j
     set status = 'processando',
         execucao_id = p_execucao_id,
         lease_ate = v_agora + make_interval(secs => p_lease_segundos),
         iniciada_em = coalesce(j.iniciada_em, v_agora),
         atualizada_em = v_agora,
         erro = null
   where j.id = p_job_id
     and j.user_id = v_user_id
     and (
       j.status = 'fila'
       or (
         j.status = 'processando'
         and (j.lease_ate is null or j.lease_ate < v_agora)
       )
     )
  returning j.*;
end;
$$;

revoke all on function public.reivindicar_geracao_ia_job(uuid, uuid, integer)
  from public, anon;
grant execute on function public.reivindicar_geracao_ia_job(uuid, uuid, integer)
  to authenticated;

create or replace function public.atualizar_geracao_ia_job(
  p_job_id uuid,
  p_execucao_id uuid,
  p_status text,
  p_etapa text,
  p_progresso integer,
  p_descricao text default null,
  p_resultado jsonb default null,
  p_erro text default null,
  p_concluida_em timestamptz default null,
  p_lease_segundos integer default 300
)
returns setof public.geracoes_ia_jobs
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_agora timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'Autenticação obrigatória.';
  end if;

  if p_status not in ('processando', 'concluida', 'erro') then
    raise exception 'Transição de status inválida.';
  end if;

  if p_etapa not in ('gerando', 'revisando', 'corrigindo', 'salvando', 'concluida', 'erro') then
    raise exception 'Etapa inválida.';
  end if;

  if p_progresso < 0 or p_progresso > 100 then
    raise exception 'Progresso inválido.';
  end if;

  if p_status = 'concluida' and (p_etapa <> 'concluida' or p_progresso <> 100) then
    raise exception 'Conclusão inconsistente.';
  end if;

  if p_status = 'erro' and p_etapa <> 'erro' then
    raise exception 'Erro inconsistente.';
  end if;

  if p_status = 'processando' and p_etapa in ('concluida', 'erro') then
    raise exception 'Etapa terminal incompatível.';
  end if;

  if p_status = 'processando' and (p_lease_segundos < 30 or p_lease_segundos > 600) then
    raise exception 'Lease inválido.';
  end if;

  return query
  update public.geracoes_ia_jobs j
     set status = p_status,
         etapa = p_etapa,
         progresso = p_progresso,
         descricao = coalesce(left(p_descricao, 400), j.descricao),
         resultado = case
           when p_status = 'concluida' then p_resultado
           else j.resultado
         end,
         erro = case
           when p_status = 'erro' then left(coalesce(p_erro, 'Falha não especificada.'), 1200)
           when p_status = 'concluida' then null
           else j.erro
         end,
         atualizada_em = v_agora,
         concluida_em = case
           when p_status in ('concluida', 'erro') then coalesce(p_concluida_em, v_agora)
           else j.concluida_em
         end,
         lease_ate = case
           when p_status = 'processando'
             then v_agora + make_interval(secs => p_lease_segundos)
           else null
         end
   where j.id = p_job_id
     and j.user_id = v_user_id
     and j.status = 'processando'
     and j.execucao_id = p_execucao_id
  returning j.*;
end;
$$;

revoke all on function public.atualizar_geracao_ia_job(
  uuid, uuid, text, text, integer, text, jsonb, text, timestamptz, integer
) from public, anon;
grant execute on function public.atualizar_geracao_ia_job(
  uuid, uuid, text, text, integer, text, jsonb, text, timestamptz, integer
) to authenticated;

comment on table public.ia_consumo_janelas is
'Cotas persistentes de consumo da IA por usuário e janela. Não é acessível diretamente pelo cliente.';
