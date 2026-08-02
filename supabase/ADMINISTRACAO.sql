-- PMPE Study Pro — módulo administrativo
-- Execute depois de GAMIFICACAO_RANKING.sql.

create table if not exists public.administradores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);

alter table public.administradores enable row level security;

-- A tabela não fica diretamente visível para usuários comuns.
drop policy if exists "admin ve proprio cadastro" on public.administradores;
create policy "admin ve proprio cadastro"
on public.administradores for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.sou_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.administradores
    where user_id = auth.uid()
  );
$$;

revoke all on function public.sou_admin() from public;
grant execute on function public.sou_admin() to authenticated;

create or replace function public.admin_resumo()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  mes_atual text := to_char(now(), 'YYYY-MM');
  resultado jsonb;
begin
  if not public.sou_admin() then
    raise exception 'Acesso administrativo negado';
  end if;

  select jsonb_build_object(
    'total_usuarios', (select count(*) from auth.users),
    'novos_no_mes', (
      select count(*) from auth.users
      where created_at >= date_trunc('month', now())
    ),
    'ativos_no_mes', (
      select count(distinct user_id)
      from public.ranking_mensal
      where mes = mes_atual and (minutos > 0 or questoes > 0 or xp > 0)
    ),
    'minutos_no_mes', coalesce((select sum(minutos) from public.ranking_mensal where mes = mes_atual), 0),
    'questoes_no_mes', coalesce((select sum(questoes) from public.ranking_mensal where mes = mes_atual), 0),
    'acertos_no_mes', coalesce((select sum(acertos) from public.ranking_mensal where mes = mes_atual), 0)
  ) into resultado;

  return resultado;
end;
$$;

revoke all on function public.admin_resumo() from public;
grant execute on function public.admin_resumo() to authenticated;

create or replace function public.admin_listar_usuarios()
returns table (
  user_id uuid,
  nome_publico text,
  email text,
  criado_em timestamptz,
  ultimo_login_em timestamptz,
  email_confirmado_em timestamptz,
  banido_ate timestamptz,
  minutos_mes integer,
  questoes_mes integer,
  acertos_mes integer,
  xp_mes integer,
  nivel integer
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  mes_atual text := to_char(now(), 'YYYY-MM');
begin
  if not public.sou_admin() then
    raise exception 'Acesso administrativo negado';
  end if;

  return query
  select
    u.id,
    coalesce(r.nome_publico, u.raw_user_meta_data->>'nome', split_part(u.email, '@', 1), 'Usuário'),
    coalesce(u.email, ''),
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at,
    u.banned_until,
    coalesce(r.minutos, 0),
    coalesce(r.questoes, 0),
    coalesce(r.acertos, 0),
    coalesce(r.xp, 0),
    coalesce(r.nivel, 1)
  from auth.users u
  left join public.ranking_mensal r
    on r.user_id = u.id and r.mes = mes_atual
  order by u.created_at desc;
end;
$$;

revoke all on function public.admin_listar_usuarios() from public;
grant execute on function public.admin_listar_usuarios() to authenticated;

-- DEPOIS DE EXECUTAR ESTE SCRIPT:
-- 1. Descubra seu UUID em Authentication > Users.
-- 2. Troque o UUID abaixo e execute a linha separadamente:
-- insert into public.administradores (user_id)
-- values ('SEU-UUID-AQUI')
-- on conflict (user_id) do nothing;
