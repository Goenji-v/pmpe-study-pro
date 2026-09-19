-- Fase 1: prepara a cota persistente e a escrita privilegiada do backend.
-- Esta fase é intencionalmente não destrutiva para o cliente atual.
-- Ordem de rollout:
-- 1) configurar SUPABASE_SERVICE_ROLE_KEY no Render;
-- 2) aplicar esta migração;
-- 3) publicar o backend novo;
-- 4) somente depois aplicar 20260919193000_finalize_ai_generation_job_security.sql.

grant select, insert, update, delete
  on table public.geracoes_ia_jobs
  to service_role;

create table if not exists public.ia_consumo_janelas (
  user_id uuid not null references auth.users(id) on delete cascade,
  categoria text not null
    check (categoria in ('geral', 'importacao')),
  janela_inicio timestamptz not null,
  quantidade integer not null default 0
    check (quantidade >= 0),
  atualizada_em timestamptz not null default now(),
  primary key (user_id, categoria, janela_inicio)
);

alter table public.ia_consumo_janelas enable row level security;

revoke all on table public.ia_consumo_janelas from anon, authenticated, public;
grant select, insert, update, delete
  on table public.ia_consumo_janelas
  to service_role;

create index if not exists ia_consumo_janelas_limpeza_idx
  on public.ia_consumo_janelas (janela_inicio);

create or replace function public.consumir_cota_ia(
  p_user_id uuid,
  p_categoria text,
  p_janela_segundos integer,
  p_limite integer
)
returns table (
  permitido boolean,
  usados integer,
  limite integer,
  retry_after_segundos integer
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_agora timestamptz := now();
  v_inicio timestamptz;
  v_fim timestamptz;
  v_usados integer;
begin
  if p_user_id is null then
    raise exception 'usuario obrigatorio';
  end if;

  if p_categoria not in ('geral', 'importacao') then
    raise exception 'categoria invalida';
  end if;

  if p_janela_segundos < 60 or p_janela_segundos > 86400 then
    raise exception 'janela invalida';
  end if;

  if p_limite < 1 or p_limite > 1000 then
    raise exception 'limite invalido';
  end if;

  v_inicio := to_timestamp(
    floor(extract(epoch from v_agora) / p_janela_segundos) * p_janela_segundos
  );
  v_fim := v_inicio + make_interval(secs => p_janela_segundos);

  insert into public.ia_consumo_janelas (
    user_id,
    categoria,
    janela_inicio,
    quantidade,
    atualizada_em
  )
  values (
    p_user_id,
    p_categoria,
    v_inicio,
    1,
    v_agora
  )
  on conflict (user_id, categoria, janela_inicio)
  do update
    set quantidade = public.ia_consumo_janelas.quantidade + 1,
        atualizada_em = excluded.atualizada_em
  returning quantidade into v_usados;

  delete from public.ia_consumo_janelas
   where user_id = p_user_id
     and janela_inicio < v_agora - interval '2 days';

  permitido := v_usados <= p_limite;
  usados := v_usados;
  limite := p_limite;
  retry_after_segundos := greatest(
    1,
    ceil(extract(epoch from (v_fim - v_agora)))::integer
  );

  return next;
end;
$$;

revoke all on function public.consumir_cota_ia(uuid, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consumir_cota_ia(uuid, text, integer, integer)
  to service_role;

comment on table public.ia_consumo_janelas is
  'Contadores persistentes de uso de IA por usuário e janela; acesso exclusivo do backend.';

comment on function public.consumir_cota_ia(uuid, text, integer, integer) is
  'Incrementa atomicamente a cota de IA. Executável somente pela service_role.';
