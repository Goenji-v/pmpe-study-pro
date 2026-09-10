-- Modelo comercial B2B do Study Pro.
-- Aditivo e compatível: não remove nem altera usuários ou dados acadêmicos.

create table if not exists public.parceiros (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status text not null default 'ativo' check (status in ('ativo','suspenso','encerrado')),
  valor_aluno_centavos integer not null default 2000 check (valor_aluno_centavos >= 0),
  criado_por uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.parceiro_usuarios (
  parceiro_id uuid not null references public.parceiros(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  papel text not null check (papel in ('proprietario','gestor','professor')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  primary key (parceiro_id, user_id)
);

create table if not exists public.turmas (
  id uuid primary key default gen_random_uuid(),
  parceiro_id uuid not null references public.parceiros(id) on delete cascade,
  nome text not null check (length(trim(nome)) between 2 and 160),
  codigo text,
  inicia_em date,
  encerra_em date,
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (parceiro_id, codigo),
  check (encerra_em is null or inicia_em is null or encerra_em >= inicia_em)
);

create table if not exists public.licencas_acesso (
  id uuid primary key default gen_random_uuid(),
  parceiro_id uuid not null references public.parceiros(id) on delete restrict,
  turma_id uuid references public.turmas(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pendente' check (status in ('ativa','pendente','suspensa','cancelada','expirada')),
  inicio_em timestamptz not null default now(),
  expira_em timestamptz,
  motivo_bloqueio text,
  criado_por uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (expira_em is null or expira_em > inicio_em)
);

create unique index if not exists licencas_acesso_usuario_ativa_unica
  on public.licencas_acesso(user_id)
  where status in ('ativa','pendente','suspensa');
create index if not exists licencas_acesso_parceiro_status_idx on public.licencas_acesso(parceiro_id, status);
create index if not exists licencas_acesso_expiracao_idx on public.licencas_acesso(expira_em) where status = 'ativa';
create index if not exists turmas_parceiro_idx on public.turmas(parceiro_id);

create table if not exists public.faturamento_parceiros (
  id uuid primary key default gen_random_uuid(),
  parceiro_id uuid not null references public.parceiros(id) on delete restrict,
  competencia date not null check (competencia = date_trunc('month', competencia)::date),
  alunos_ativos integer not null check (alunos_ativos >= 0),
  valor_unitario_centavos integer not null check (valor_unitario_centavos >= 0),
  valor_total_centavos integer generated always as (alunos_ativos * valor_unitario_centavos) stored,
  fechado_em timestamptz not null default now(),
  fechado_por uuid not null references auth.users(id),
  unique (parceiro_id, competencia)
);

create table if not exists public.auditoria_acesso (
  id bigint generated always as identity primary key,
  parceiro_id uuid references public.parceiros(id) on delete set null,
  licenca_id uuid references public.licencas_acesso(id) on delete set null,
  ator_id uuid references auth.users(id) on delete set null,
  usuario_afetado_id uuid references auth.users(id) on delete set null,
  evento text not null check (evento in ('parceiro_criado','turma_criada','licenca_criada','licenca_ativada','licenca_suspensa','licenca_cancelada','licenca_expirada','papel_alterado','faturamento_fechado')),
  detalhes jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);
create index if not exists auditoria_acesso_parceiro_data_idx on public.auditoria_acesso(parceiro_id, criado_em desc);

alter table public.parceiros enable row level security;
alter table public.parceiro_usuarios enable row level security;
alter table public.turmas enable row level security;
alter table public.licencas_acesso enable row level security;
alter table public.faturamento_parceiros enable row level security;
alter table public.auditoria_acesso enable row level security;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.sou_gestor_parceiro(p_parceiro_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.parceiro_usuarios pu where pu.parceiro_id = p_parceiro_id and pu.user_id = auth.uid() and pu.ativo and pu.papel in ('proprietario','gestor','professor')) $$;
revoke all on function private.sou_gestor_parceiro(uuid) from public, anon;
grant execute on function private.sou_gestor_parceiro(uuid) to authenticated;

drop policy if exists parceiros_leitura_autorizada on public.parceiros;
create policy parceiros_leitura_autorizada on public.parceiros for select to authenticated
using (public.sou_admin() or private.sou_gestor_parceiro(id) or exists(select 1 from public.licencas_acesso l where l.parceiro_id=id and l.user_id=auth.uid()));
drop policy if exists parceiros_admin_escrita on public.parceiros;
create policy parceiros_admin_escrita on public.parceiros for all to authenticated using (public.sou_admin()) with check (public.sou_admin());

drop policy if exists parceiro_usuarios_leitura on public.parceiro_usuarios;
create policy parceiro_usuarios_leitura on public.parceiro_usuarios for select to authenticated using (user_id=auth.uid() or private.sou_gestor_parceiro(parceiro_id) or public.sou_admin());
drop policy if exists parceiro_usuarios_admin_escrita on public.parceiro_usuarios;
create policy parceiro_usuarios_admin_escrita on public.parceiro_usuarios for all to authenticated using (public.sou_admin()) with check (public.sou_admin());

drop policy if exists turmas_leitura on public.turmas;
create policy turmas_leitura on public.turmas for select to authenticated using (private.sou_gestor_parceiro(parceiro_id) or public.sou_admin() or exists(select 1 from public.licencas_acesso l where l.turma_id=id and l.user_id=auth.uid()));
drop policy if exists turmas_gestao on public.turmas;
create policy turmas_gestao on public.turmas for all to authenticated using (public.sou_admin() or private.sou_gestor_parceiro(parceiro_id)) with check (public.sou_admin() or private.sou_gestor_parceiro(parceiro_id));

drop policy if exists licencas_leitura on public.licencas_acesso;
create policy licencas_leitura on public.licencas_acesso for select to authenticated using (user_id=auth.uid() or private.sou_gestor_parceiro(parceiro_id) or public.sou_admin());
drop policy if exists licencas_gestao on public.licencas_acesso;
create policy licencas_gestao on public.licencas_acesso for all to authenticated using (public.sou_admin() or private.sou_gestor_parceiro(parceiro_id)) with check (public.sou_admin() or private.sou_gestor_parceiro(parceiro_id));

drop policy if exists faturamento_leitura on public.faturamento_parceiros;
create policy faturamento_leitura on public.faturamento_parceiros for select to authenticated using (public.sou_admin() or private.sou_gestor_parceiro(parceiro_id));
drop policy if exists faturamento_admin_escrita on public.faturamento_parceiros;
create policy faturamento_admin_escrita on public.faturamento_parceiros for all to authenticated using (public.sou_admin()) with check (public.sou_admin());

drop policy if exists auditoria_leitura on public.auditoria_acesso;
create policy auditoria_leitura on public.auditoria_acesso for select to authenticated using (public.sou_admin() or private.sou_gestor_parceiro(parceiro_id));
-- Eventos são gravados somente por funções controladas/service role.
revoke insert, update, delete on public.auditoria_acesso from anon, authenticated;

create or replace function public.meu_contexto_comercial()
returns jsonb language plpgsql stable security invoker set search_path = public
as $$
declare v_gestor record; v_licenca record;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado.'; end if;
  select pu.papel, p.id parceiro_id, p.nome parceiro_nome into v_gestor
  from public.parceiro_usuarios pu join public.parceiros p on p.id=pu.parceiro_id
  where pu.user_id=auth.uid() and pu.ativo and p.status='ativo' order by case pu.papel when 'proprietario' then 1 when 'gestor' then 2 else 3 end limit 1;
  if found then return jsonb_build_object('papel',v_gestor.papel,'parceiro_id',v_gestor.parceiro_id,'parceiro_nome',v_gestor.parceiro_nome,'status','ativa','acesso_permitido',true); end if;
  select l.*,p.nome parceiro_nome,t.nome turma_nome into v_licenca from public.licencas_acesso l join public.parceiros p on p.id=l.parceiro_id left join public.turmas t on t.id=l.turma_id where l.user_id=auth.uid() order by l.criado_em desc limit 1;
  if not found then return jsonb_build_object('papel','legado','status','legado','acesso_permitido',true); end if;
  return jsonb_build_object('papel','aluno','parceiro_id',v_licenca.parceiro_id,'parceiro_nome',v_licenca.parceiro_nome,'turma_id',v_licenca.turma_id,'turma_nome',v_licenca.turma_nome,'status',case when v_licenca.status='ativa' and v_licenca.expira_em is not null and v_licenca.expira_em<=now() then 'expirada' else v_licenca.status end,'inicio_em',v_licenca.inicio_em,'expira_em',v_licenca.expira_em,'motivo_bloqueio',v_licenca.motivo_bloqueio,'acesso_permitido',v_licenca.status='ativa' and v_licenca.inicio_em<=now() and (v_licenca.expira_em is null or v_licenca.expira_em>now()));
end $$;
revoke all on function public.meu_contexto_comercial() from public, anon;
grant execute on function public.meu_contexto_comercial() to authenticated;

create or replace function public.resumo_meu_parceiro()
returns jsonb language plpgsql stable security invoker set search_path = public
as $$ declare v_id uuid; begin
  select parceiro_id into v_id from public.parceiro_usuarios where user_id=auth.uid() and ativo order by case papel when 'proprietario' then 1 when 'gestor' then 2 else 3 end limit 1;
  if v_id is null then raise exception 'Perfil de parceiro não encontrado.'; end if;
  return (select jsonb_build_object('parceiro_id',p.id,'parceiro_nome',p.nome,'alunos_ativos',count(l.id) filter(where l.status='ativa' and l.inicio_em<=now() and (l.expira_em is null or l.expira_em>now())),'alunos_pendentes',count(l.id) filter(where l.status='pendente' or l.inicio_em>now()),'alunos_bloqueados',count(l.id) filter(where l.status in ('suspensa','cancelada','expirada') or (l.status='ativa' and l.expira_em<=now())),'valor_mensal',(count(l.id) filter(where l.status='ativa' and l.inicio_em<=now() and (l.expira_em is null or l.expira_em>now()))*p.valor_aluno_centavos)/100.0) from public.parceiros p left join public.licencas_acesso l on l.parceiro_id=p.id where p.id=v_id group by p.id);
end $$;
revoke all on function public.resumo_meu_parceiro() from public, anon;
grant execute on function public.resumo_meu_parceiro() to authenticated;

create or replace function public.listar_alunos_meu_parceiro()
returns table(licenca_id uuid,user_id uuid,nome text,turma text,status text,inicio_em timestamptz,expira_em timestamptz)
language sql stable security invoker set search_path = public
as $$ select l.id,l.user_id,coalesce(pf.nome,'Aluno'),coalesce(t.nome,'Sem turma'),case when l.status='ativa' and l.expira_em is not null and l.expira_em<=now() then 'expirada' else l.status end,l.inicio_em,l.expira_em from public.licencas_acesso l left join public.perfis pf on pf.id=l.user_id left join public.turmas t on t.id=l.turma_id where private.sou_gestor_parceiro(l.parceiro_id) order by pf.nome nulls last,l.criado_em desc $$;
revoke all on function public.listar_alunos_meu_parceiro() from public, anon;
grant execute on function public.listar_alunos_meu_parceiro() to authenticated;

-- Fecha licenças vencidas de forma idempotente; pode ser chamado por job seguro.
create or replace function public.expirar_licencas_vencidas()
returns integer language plpgsql security invoker set search_path = public
as $$ declare v_total integer; begin update public.licencas_acesso set status='expirada',motivo_bloqueio=coalesce(motivo_bloqueio,'Período contratado encerrado.'),atualizado_em=now() where status='ativa' and expira_em is not null and expira_em<=now(); get diagnostics v_total=row_count; return v_total; end $$;
revoke all on function public.expirar_licencas_vencidas() from public, anon, authenticated;
grant execute on function public.expirar_licencas_vencidas() to service_role;

comment on table public.licencas_acesso is 'Origem comercial, período e estado do acesso de cada aluno.';
comment on table public.faturamento_parceiros is 'Fechamento mensal imutável de alunos ativos por parceiro.';
