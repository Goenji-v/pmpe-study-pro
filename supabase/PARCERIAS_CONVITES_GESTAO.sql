-- Convites, solicitações e gestão do parceiro.
-- Tokens de convite são retornados uma única vez e persistidos somente como SHA-256.

create table if not exists public.convites_turma (
  id uuid primary key default gen_random_uuid(),
  parceiro_id uuid not null references public.parceiros(id) on delete cascade,
  turma_id uuid not null references public.turmas(id) on delete cascade,
  codigo_hash text not null unique,
  titulo text,
  ativo boolean not null default true,
  exige_aprovacao boolean not null default true,
  duracao_meses integer not null default 12 check (duracao_meses between 1 and 60),
  max_usos integer check (max_usos is null or max_usos > 0),
  usos integer not null default 0 check (usos >= 0),
  expira_em timestamptz,
  criado_por uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (max_usos is null or usos <= max_usos)
);

create table if not exists public.solicitacoes_turma (
  id uuid primary key default gen_random_uuid(),
  convite_id uuid not null references public.convites_turma(id) on delete restrict,
  parceiro_id uuid not null references public.parceiros(id) on delete cascade,
  turma_id uuid not null references public.turmas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente','aprovada','recusada','cancelada')),
  solicitado_em timestamptz not null default now(),
  respondido_em timestamptz,
  respondido_por uuid references auth.users(id),
  observacao text,
  unique (turma_id, user_id)
);

create index if not exists convites_turma_parceiro_idx on public.convites_turma(parceiro_id, criado_em desc);
create index if not exists convites_turma_turma_idx on public.convites_turma(turma_id);
create index if not exists convites_turma_criado_por_idx on public.convites_turma(criado_por);
create index if not exists solicitacoes_turma_parceiro_status_idx on public.solicitacoes_turma(parceiro_id, status, solicitado_em desc);
create index if not exists solicitacoes_turma_convite_idx on public.solicitacoes_turma(convite_id);
create index if not exists solicitacoes_turma_user_idx on public.solicitacoes_turma(user_id);
create index if not exists solicitacoes_turma_respondido_por_idx on public.solicitacoes_turma(respondido_por) where respondido_por is not null;

alter table public.convites_turma enable row level security;
alter table public.solicitacoes_turma enable row level security;

grant select, insert, update, delete on public.convites_turma to authenticated;
grant select, insert, update, delete on public.solicitacoes_turma to authenticated;
grant all on public.convites_turma, public.solicitacoes_turma to service_role;

create policy convites_gestao on public.convites_turma for all to authenticated
using (public.sou_admin() or private.sou_gestor_parceiro(parceiro_id))
with check (public.sou_admin() or private.sou_gestor_parceiro(parceiro_id));

create policy solicitacoes_leitura on public.solicitacoes_turma for select to authenticated
using (user_id = (select auth.uid()) or public.sou_admin() or private.sou_gestor_parceiro(parceiro_id));

create policy solicitacoes_gestao on public.solicitacoes_turma for update to authenticated
using (public.sou_admin() or private.sou_gestor_parceiro(parceiro_id))
with check (public.sou_admin() or private.sou_gestor_parceiro(parceiro_id));

alter table public.auditoria_acesso drop constraint if exists auditoria_acesso_evento_check;
alter table public.auditoria_acesso add constraint auditoria_acesso_evento_check check (evento in (
  'parceiro_criado','turma_criada','convite_criado','solicitacao_criada','solicitacao_aprovada',
  'solicitacao_recusada','licenca_criada','licenca_ativada','licenca_suspensa','licenca_cancelada',
  'licenca_expirada','papel_alterado','faturamento_fechado'
));

create or replace function public.consultar_convite(p_codigo text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v record;
begin
  if length(coalesce(p_codigo,'')) < 32 then return null; end if;
  select c.id, p.nome parceiro_nome, t.nome turma_nome, c.titulo, c.exige_aprovacao,
         c.duracao_meses, c.expira_em, c.max_usos, c.usos
    into v
    from public.convites_turma c
    join public.parceiros p on p.id=c.parceiro_id
    join public.turmas t on t.id=c.turma_id
   where c.codigo_hash=encode(extensions.digest(p_codigo,'sha256'),'hex')
     and c.ativo and p.status='ativo' and t.ativa
     and (c.expira_em is null or c.expira_em>now())
     and (c.max_usos is null or c.usos<c.max_usos);
  if not found then return null; end if;
  return jsonb_build_object('convite_id',v.id,'parceiro_nome',v.parceiro_nome,'turma_nome',v.turma_nome,
    'titulo',v.titulo,'exige_aprovacao',v.exige_aprovacao,'duracao_meses',v.duracao_meses,'expira_em',v.expira_em);
end $$;
revoke all on function public.consultar_convite(text) from public;
grant execute on function public.consultar_convite(text) to anon, authenticated;
comment on function public.consultar_convite(text) is 'SECURITY DEFINER intencional: consulta pública limitada por token secreto; nunca expõe o hash nem dados de alunos.';

create or replace function public.criar_convite_turma(
  p_turma_id uuid, p_validade_dias integer default 30, p_max_usos integer default null,
  p_duracao_meses integer default 12, p_exige_aprovacao boolean default true, p_titulo text default null
) returns text language plpgsql security definer set search_path = ''
as $$
declare v_parceiro uuid; v_codigo text;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado.'; end if;
  select parceiro_id into v_parceiro from public.turmas where id=p_turma_id and ativa;
  if v_parceiro is null or not (public.sou_admin() or private.sou_gestor_parceiro(v_parceiro)) then raise exception 'Turma não autorizada.'; end if;
  if p_validade_dias not between 1 and 365 or p_duracao_meses not between 1 and 60 or (p_max_usos is not null and p_max_usos<1) then raise exception 'Parâmetros de convite inválidos.'; end if;
  v_codigo:=encode(extensions.gen_random_bytes(24),'hex');
  insert into public.convites_turma(parceiro_id,turma_id,codigo_hash,titulo,exige_aprovacao,duracao_meses,max_usos,expira_em,criado_por)
  values(v_parceiro,p_turma_id,encode(extensions.digest(v_codigo,'sha256'),'hex'),nullif(trim(p_titulo),''),p_exige_aprovacao,p_duracao_meses,p_max_usos,now()+make_interval(days=>p_validade_dias),auth.uid());
  insert into public.auditoria_acesso(parceiro_id,ator_id,evento,detalhes) values(v_parceiro,auth.uid(),'convite_criado',jsonb_build_object('turma_id',p_turma_id));
  return v_codigo;
end $$;
revoke all on function public.criar_convite_turma(uuid,integer,integer,integer,boolean,text) from public, anon;
grant execute on function public.criar_convite_turma(uuid,integer,integer,integer,boolean,text) to authenticated;

create or replace function public.solicitar_entrada_turma(p_codigo text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_convite public.convites_turma%rowtype; v_solicitacao uuid; v_licenca uuid; v_status text;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado.'; end if;
  select * into v_convite from public.convites_turma
   where codigo_hash=encode(extensions.digest(p_codigo,'sha256'),'hex') for update;
  if not found or not v_convite.ativo or (v_convite.expira_em is not null and v_convite.expira_em<=now())
     or (v_convite.max_usos is not null and v_convite.usos>=v_convite.max_usos) then raise exception 'Convite inválido ou encerrado.'; end if;
  if exists(select 1 from public.licencas_acesso where user_id=auth.uid() and status in ('ativa','pendente','suspensa') and parceiro_id<>v_convite.parceiro_id) then
    raise exception 'Sua conta já está vinculada a outra organização.';
  end if;
  insert into public.solicitacoes_turma(convite_id,parceiro_id,turma_id,user_id,status,solicitado_em,respondido_em,respondido_por)
  values(v_convite.id,v_convite.parceiro_id,v_convite.turma_id,auth.uid(),case when v_convite.exige_aprovacao then 'pendente' else 'aprovada' end,now(),case when v_convite.exige_aprovacao then null else now() end,case when v_convite.exige_aprovacao then null else auth.uid() end)
  on conflict(turma_id,user_id) do update set convite_id=excluded.convite_id,status=excluded.status,solicitado_em=now(),respondido_em=excluded.respondido_em,respondido_por=excluded.respondido_por
  returning id,status into v_solicitacao,v_status;
  insert into public.licencas_acesso(parceiro_id,turma_id,user_id,status,inicio_em,expira_em,criado_por)
  values(v_convite.parceiro_id,v_convite.turma_id,auth.uid(),case when v_convite.exige_aprovacao then 'pendente' else 'ativa' end,now(),case when v_convite.exige_aprovacao then null else now()+make_interval(months=>v_convite.duracao_meses) end,auth.uid())
  on conflict(user_id) where status in ('ativa','pendente','suspensa') do update set parceiro_id=excluded.parceiro_id,turma_id=excluded.turma_id,status=excluded.status,inicio_em=excluded.inicio_em,expira_em=excluded.expira_em,motivo_bloqueio=null,atualizado_em=now()
  returning id into v_licenca;
  update public.convites_turma set usos=usos+1,atualizado_em=now() where id=v_convite.id;
  insert into public.auditoria_acesso(parceiro_id,licenca_id,ator_id,usuario_afetado_id,evento,detalhes)
  values(v_convite.parceiro_id,v_licenca,auth.uid(),auth.uid(),case when v_status='aprovada' then 'licenca_ativada' else 'solicitacao_criada' end,jsonb_build_object('solicitacao_id',v_solicitacao,'turma_id',v_convite.turma_id));
  return jsonb_build_object('solicitacao_id',v_solicitacao,'status',v_status);
end $$;
revoke all on function public.solicitar_entrada_turma(text) from public, anon;
grant execute on function public.solicitar_entrada_turma(text) to authenticated;

create or replace function public.decidir_solicitacao(p_solicitacao_id uuid,p_decisao text,p_duracao_meses integer default 12)
returns void language plpgsql security definer set search_path = ''
as $$
declare v public.solicitacoes_turma%rowtype; v_licenca uuid;
begin
  if p_decisao not in ('aprovar','recusar') or p_duracao_meses not between 1 and 60 then raise exception 'Decisão inválida.'; end if;
  select * into v from public.solicitacoes_turma where id=p_solicitacao_id for update;
  if not found or v.status<>'pendente' or not (public.sou_admin() or private.sou_gestor_parceiro(v.parceiro_id)) then raise exception 'Solicitação não autorizada ou já respondida.'; end if;
  update public.solicitacoes_turma set status=case when p_decisao='aprovar' then 'aprovada' else 'recusada' end,respondido_em=now(),respondido_por=auth.uid() where id=v.id;
  update public.licencas_acesso set status=case when p_decisao='aprovar' then 'ativa' else 'cancelada' end,inicio_em=now(),expira_em=case when p_decisao='aprovar' then now()+make_interval(months=>p_duracao_meses) else null end,motivo_bloqueio=case when p_decisao='recusar' then 'Solicitação recusada pelo responsável da turma.' else null end,atualizado_em=now() where user_id=v.user_id and parceiro_id=v.parceiro_id and status='pendente' returning id into v_licenca;
  insert into public.auditoria_acesso(parceiro_id,licenca_id,ator_id,usuario_afetado_id,evento,detalhes) values(v.parceiro_id,v_licenca,auth.uid(),v.user_id,case when p_decisao='aprovar' then 'solicitacao_aprovada' else 'solicitacao_recusada' end,jsonb_build_object('solicitacao_id',v.id,'turma_id',v.turma_id));
end $$;
revoke all on function public.decidir_solicitacao(uuid,text,integer) from public, anon;
grant execute on function public.decidir_solicitacao(uuid,text,integer) to authenticated;

create or replace function public.alterar_status_licenca(p_licenca_id uuid,p_status text,p_motivo text default null,p_expira_em timestamptz default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare v public.licencas_acesso%rowtype;
begin
  if p_status not in ('ativa','suspensa','cancelada') then raise exception 'Status inválido.'; end if;
  select * into v from public.licencas_acesso where id=p_licenca_id for update;
  if not found or not (public.sou_admin() or private.sou_gestor_parceiro(v.parceiro_id)) then raise exception 'Licença não autorizada.'; end if;
  update public.licencas_acesso set status=p_status,motivo_bloqueio=case when p_status='ativa' then null else nullif(trim(p_motivo),'') end,expira_em=coalesce(p_expira_em,expira_em),atualizado_em=now() where id=v.id;
  insert into public.auditoria_acesso(parceiro_id,licenca_id,ator_id,usuario_afetado_id,evento,detalhes) values(v.parceiro_id,v.id,auth.uid(),v.user_id,case p_status when 'ativa' then 'licenca_ativada' when 'suspensa' then 'licenca_suspensa' else 'licenca_cancelada' end,jsonb_build_object('motivo',p_motivo));
end $$;
revoke all on function public.alterar_status_licenca(uuid,text,text,timestamptz) from public, anon;
grant execute on function public.alterar_status_licenca(uuid,text,text,timestamptz) to authenticated;

create or replace function public.listar_gestao_meu_parceiro()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_id uuid;
begin
  select parceiro_id into v_id from public.parceiro_usuarios where user_id=auth.uid() and ativo order by case papel when 'proprietario' then 1 when 'gestor' then 2 else 3 end limit 1;
  if v_id is null then raise exception 'Perfil de parceiro não encontrado.'; end if;
  return jsonb_build_object(
    'turmas',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'nome',t.nome,'codigo',t.codigo,'ativa',t.ativa) order by t.nome),'[]'::jsonb) from public.turmas t where t.parceiro_id=v_id),
    'convites',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'turma_id',c.turma_id,'turma_nome',t.nome,'titulo',c.titulo,'ativo',c.ativo,'usos',c.usos,'max_usos',c.max_usos,'expira_em',c.expira_em,'exige_aprovacao',c.exige_aprovacao) order by c.criado_em desc),'[]'::jsonb) from public.convites_turma c join public.turmas t on t.id=c.turma_id where c.parceiro_id=v_id),
    'solicitacoes',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'user_id',s.user_id,'nome',coalesce(pf.nome,'Aluno'),'email',pf.email,'turma_nome',t.nome,'status',s.status,'solicitado_em',s.solicitado_em) order by s.solicitado_em desc),'[]'::jsonb) from public.solicitacoes_turma s join public.turmas t on t.id=s.turma_id left join public.perfis pf on pf.id=s.user_id where s.parceiro_id=v_id),
    'auditoria',(select coalesce(jsonb_agg(x.item order by x.criado_em desc),'[]'::jsonb) from (select a.criado_em,jsonb_build_object('id',a.id,'evento',a.evento,'criado_em',a.criado_em,'usuario_nome',coalesce(pf.nome,'Sistema'),'detalhes',a.detalhes) item from public.auditoria_acesso a left join public.perfis pf on pf.id=a.usuario_afetado_id where a.parceiro_id=v_id order by a.criado_em desc limit 50) x),
    'faturamento',(select coalesce(jsonb_agg(jsonb_build_object('competencia',f.competencia,'alunos_ativos',f.alunos_ativos,'valor_total',f.valor_total_centavos/100.0) order by f.competencia desc),'[]'::jsonb) from public.faturamento_parceiros f where f.parceiro_id=v_id)
  );
end $$;
revoke all on function public.listar_gestao_meu_parceiro() from public, anon;
grant execute on function public.listar_gestao_meu_parceiro() to authenticated;

create or replace function public.listar_alunos_meu_parceiro_v2()
returns table(licenca_id uuid,user_id uuid,nome text,email text,turma text,status text,inicio_em timestamptz,expira_em timestamptz,minutos integer,questoes integer,acertos integer,nivel integer,ultima_atividade timestamptz)
language sql stable security invoker set search_path = public
as $$
  select l.id,l.user_id,coalesce(pf.nome,'Aluno'),pf.email,coalesce(t.nome,'Sem turma'),
    case when l.status='ativa' and l.expira_em is not null and l.expira_em<=now() then 'expirada' else l.status end,
    l.inicio_em,l.expira_em,coalesce(r.minutos,0),coalesce(r.questoes,0),coalesce(r.acertos,0),coalesce(r.nivel,1),r.atualizado_em
  from public.licencas_acesso l left join public.perfis pf on pf.id=l.user_id left join public.turmas t on t.id=l.turma_id
  left join public.ranking_mensal r on r.user_id=l.user_id and r.mes=to_char(current_date,'YYYY-MM')
  where private.sou_gestor_parceiro(l.parceiro_id) order by pf.nome nulls last,l.criado_em desc
$$;
revoke all on function public.listar_alunos_meu_parceiro_v2() from public, anon;
grant execute on function public.listar_alunos_meu_parceiro_v2() to authenticated;

comment on table public.convites_turma is 'Convites de parceria; apenas o hash do token é persistido.';
comment on table public.solicitacoes_turma is 'Pedido que comprova por qual convite e turma o aluno chegou.';
