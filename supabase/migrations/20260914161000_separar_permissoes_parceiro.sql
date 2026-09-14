create or replace function private.sou_operacao_parceiro(p_parceiro_id uuid)
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $$
  select exists(
    select 1
    from public.parceiro_usuarios pu
    where pu.parceiro_id = p_parceiro_id
      and pu.user_id = auth.uid()
      and pu.ativo
      and pu.papel in ('proprietario','gestor')
  )
$$;

create or replace function private.sou_proprietario_parceiro(p_parceiro_id uuid)
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $$
  select exists(
    select 1
    from public.parceiro_usuarios pu
    where pu.parceiro_id = p_parceiro_id
      and pu.user_id = auth.uid()
      and pu.ativo
      and pu.papel = 'proprietario'
  )
$$;

drop policy if exists turmas_gestao on public.turmas;
create policy turmas_gestao on public.turmas
for all
using (public.sou_admin() or private.sou_operacao_parceiro(parceiro_id))
with check (public.sou_admin() or private.sou_operacao_parceiro(parceiro_id));

drop policy if exists convites_gestao on public.convites_turma;
create policy convites_gestao on public.convites_turma
for all
using (public.sou_admin() or private.sou_operacao_parceiro(parceiro_id))
with check (public.sou_admin() or private.sou_operacao_parceiro(parceiro_id));

drop policy if exists licencas_gestao on public.licencas_acesso;
create policy licencas_gestao on public.licencas_acesso
for all
using (public.sou_admin() or private.sou_operacao_parceiro(parceiro_id))
with check (public.sou_admin() or private.sou_operacao_parceiro(parceiro_id));

drop policy if exists solicitacoes_gestao on public.solicitacoes_turma;
create policy solicitacoes_gestao on public.solicitacoes_turma
for update
using (public.sou_admin() or private.sou_operacao_parceiro(parceiro_id))
with check (public.sou_admin() or private.sou_operacao_parceiro(parceiro_id));

drop policy if exists solicitacoes_leitura on public.solicitacoes_turma;
create policy solicitacoes_leitura on public.solicitacoes_turma
for select
using (
  user_id = (select auth.uid())
  or public.sou_admin()
  or private.sou_operacao_parceiro(parceiro_id)
);

drop policy if exists auditoria_leitura on public.auditoria_acesso;
create policy auditoria_leitura on public.auditoria_acesso
for select
using (public.sou_admin() or private.sou_operacao_parceiro(parceiro_id));

drop policy if exists faturamento_leitura on public.faturamento_parceiros;
create policy faturamento_leitura on public.faturamento_parceiros
for select
using (public.sou_admin() or private.sou_proprietario_parceiro(parceiro_id));

drop policy if exists parceiro_usuarios_leitura on public.parceiro_usuarios;
create policy parceiro_usuarios_leitura on public.parceiro_usuarios
for select
using (
  user_id = auth.uid()
  or public.sou_admin()
  or private.sou_operacao_parceiro(parceiro_id)
);

create or replace function public.criar_turma_meu_parceiro(
  p_nome text,
  p_codigo text default null,
  p_inicia_em date default null,
  p_encerra_em date default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_parceiro_id uuid;
  v_id uuid;
  v_nome text := trim(coalesce(p_nome, ''));
  v_codigo text := nullif(trim(coalesce(p_codigo, '')), '');
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado.'; end if;

  select pu.parceiro_id into v_parceiro_id
  from public.parceiro_usuarios pu
  join public.parceiros p on p.id = pu.parceiro_id
  where pu.user_id = auth.uid()
    and pu.ativo
    and p.status = 'ativo'
    and pu.papel in ('proprietario','gestor')
  order by case pu.papel when 'proprietario' then 1 else 2 end
  limit 1;

  if v_parceiro_id is null then raise exception 'Somente proprietário ou gestor pode criar turmas.'; end if;
  if length(v_nome) < 2 or length(v_nome) > 160 then raise exception 'Nome da turma inválido.'; end if;
  if v_codigo is not null and length(v_codigo) > 80 then raise exception 'Código da turma inválido.'; end if;
  if p_inicia_em is not null and p_encerra_em is not null and p_encerra_em < p_inicia_em then
    raise exception 'A data de encerramento deve ser posterior ao início.';
  end if;

  insert into public.turmas(parceiro_id,nome,codigo,inicia_em,encerra_em)
  values(v_parceiro_id,v_nome,v_codigo,p_inicia_em,p_encerra_em)
  returning id into v_id;

  insert into public.auditoria_acesso(parceiro_id,ator_id,evento,detalhes)
  values(v_parceiro_id,auth.uid(),'turma_criada',jsonb_build_object('turma_id',v_id,'nome',v_nome,'origem','parceiro'));
  return v_id;
exception when unique_violation then
  raise exception 'Já existe uma turma com esse código nesta parceria.';
end;
$$;

create or replace function public.atualizar_turma_meu_parceiro(
  p_turma_id uuid,
  p_nome text,
  p_codigo text default null,
  p_inicia_em date default null,
  p_encerra_em date default null,
  p_ativa boolean default true
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_turma public.turmas%rowtype;
  v_nome text := trim(coalesce(p_nome, ''));
  v_codigo text := nullif(trim(coalesce(p_codigo, '')), '');
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado.'; end if;
  select t.* into v_turma from public.turmas t where t.id = p_turma_id;
  if not found then raise exception 'Turma não encontrada.'; end if;
  if not private.sou_operacao_parceiro(v_turma.parceiro_id) then raise exception 'Somente proprietário ou gestor pode alterar turmas.'; end if;
  if length(v_nome) < 2 or length(v_nome) > 160 then raise exception 'Nome da turma inválido.'; end if;
  if v_codigo is not null and length(v_codigo) > 80 then raise exception 'Código da turma inválido.'; end if;
  if p_inicia_em is not null and p_encerra_em is not null and p_encerra_em < p_inicia_em then raise exception 'A data de encerramento deve ser posterior ao início.'; end if;

  update public.turmas
  set nome=v_nome,codigo=v_codigo,inicia_em=p_inicia_em,encerra_em=p_encerra_em,ativa=p_ativa,atualizado_em=now()
  where id=p_turma_id;

  insert into public.auditoria_acesso(parceiro_id,ator_id,evento,detalhes)
  values(v_turma.parceiro_id,auth.uid(),'turma_atualizada',jsonb_build_object('turma_id',p_turma_id,'nome',v_nome,'codigo',v_codigo,'ativa',p_ativa,'origem','parceiro'));
exception when unique_violation then
  raise exception 'Já existe uma turma com esse código nesta parceria.';
end;
$$;

create or replace function public.duplicar_turma_meu_parceiro(p_turma_id uuid, p_nome text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_turma public.turmas%rowtype;
  v_nova_turma_id uuid;
  v_trilha public.trilhas_mentoria%rowtype;
  v_nova_trilha_id uuid;
  v_nome text := trim(coalesce(p_nome, ''));
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado.'; end if;
  select t.* into v_turma from public.turmas t where t.id=p_turma_id;
  if not found then raise exception 'Turma não encontrada.'; end if;
  if not private.sou_operacao_parceiro(v_turma.parceiro_id) then raise exception 'Somente proprietário ou gestor pode duplicar turmas.'; end if;
  if length(v_nome) < 2 or length(v_nome) > 160 then raise exception 'Nome da nova turma inválido.'; end if;

  insert into public.turmas(parceiro_id,nome,codigo,inicia_em,encerra_em,ativa)
  values(v_turma.parceiro_id,v_nome,null,v_turma.inicia_em,v_turma.encerra_em,true)
  returning id into v_nova_turma_id;

  insert into public.curso_parceiro_turmas(curso_id,turma_id,ativo,liberado_em,criado_por)
  select ct.curso_id,v_nova_turma_id,true,now(),auth.uid()
  from public.curso_parceiro_turmas ct
  where ct.turma_id=p_turma_id and ct.ativo;

  select tr.* into v_trilha
  from public.trilhas_mentoria tr
  where tr.turma_id=p_turma_id and tr.ativa
  order by tr.criado_em desc limit 1;

  if found then
    insert into public.trilhas_mentoria(parceiro_id,turma_id,nome,ativa,minutos_padrao,materias_por_dia,questoes_por_sessao,revisoes_por_dia,criado_por,intervalos_revisao,simulado_cada_dias,percentual_teoria)
    values(v_trilha.parceiro_id,v_nova_turma_id,v_trilha.nome,true,v_trilha.minutos_padrao,v_trilha.materias_por_dia,v_trilha.questoes_por_sessao,v_trilha.revisoes_por_dia,auth.uid(),v_trilha.intervalos_revisao,v_trilha.simulado_cada_dias,v_trilha.percentual_teoria)
    returning id into v_nova_trilha_id;

    insert into public.trilha_mentoria_itens(trilha_id,materia,assunto,ordem,ativo,minutos_estimados,questoes_alvo,prioridade,obrigatorio,tipo,instrucoes,material_url)
    select v_nova_trilha_id,item.materia,item.assunto,item.ordem,item.ativo,item.minutos_estimados,item.questoes_alvo,item.prioridade,item.obrigatorio,item.tipo,item.instrucoes,item.material_url
    from public.trilha_mentoria_itens item
    where item.trilha_id=v_trilha.id;
  end if;

  insert into public.auditoria_acesso(parceiro_id,ator_id,evento,detalhes)
  values(v_turma.parceiro_id,auth.uid(),'turma_criada',jsonb_build_object('turma_id',v_nova_turma_id,'nome',v_nome,'duplicada_de',p_turma_id,'origem','parceiro'));
  return v_nova_turma_id;
end;
$$;

create or replace function public.criar_convite_turma(p_turma_id uuid,p_validade_dias integer default 30,p_max_usos integer default null,p_duracao_meses integer default 12,p_exige_aprovacao boolean default true,p_titulo text default null)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare v_parceiro uuid; v_codigo text;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado.'; end if;
  select parceiro_id into v_parceiro from public.turmas where id=p_turma_id and ativa;
  if v_parceiro is null or not (public.sou_admin() or private.sou_operacao_parceiro(v_parceiro)) then raise exception 'Somente proprietário ou gestor pode criar convites.'; end if;
  if p_validade_dias not between 1 and 365 or p_duracao_meses not between 1 and 60 or (p_max_usos is not null and p_max_usos<1) then raise exception 'Parâmetros de convite inválidos.'; end if;
  v_codigo:=encode(extensions.gen_random_bytes(24),'hex');
  insert into public.convites_turma(parceiro_id,turma_id,codigo_hash,titulo,exige_aprovacao,duracao_meses,max_usos,expira_em,criado_por)
  values(v_parceiro,p_turma_id,encode(extensions.digest(v_codigo,'sha256'),'hex'),nullif(trim(p_titulo),''),p_exige_aprovacao,p_duracao_meses,p_max_usos,now()+make_interval(days=>p_validade_dias),auth.uid());
  insert into public.auditoria_acesso(parceiro_id,ator_id,evento,detalhes) values(v_parceiro,auth.uid(),'convite_criado',jsonb_build_object('turma_id',p_turma_id));
  return v_codigo;
end;
$$;

create or replace function public.alterar_status_convite_meu_parceiro(p_convite_id uuid,p_ativo boolean)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare v_convite public.convites_turma%rowtype;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado.'; end if;
  select * into v_convite from public.convites_turma where id=p_convite_id for update;
  if not found or not (public.sou_admin() or private.sou_operacao_parceiro(v_convite.parceiro_id)) then raise exception 'Convite não autorizado.'; end if;
  update public.convites_turma set ativo=p_ativo,atualizado_em=now() where id=v_convite.id;
  insert into public.auditoria_acesso(parceiro_id,ator_id,evento,detalhes)
  values(v_convite.parceiro_id,auth.uid(),case when p_ativo then 'convite_reativado' else 'convite_revogado' end,jsonb_build_object('convite_id',v_convite.id,'turma_id',v_convite.turma_id));
end;
$$;

create or replace function public.decidir_solicitacao(p_solicitacao_id uuid,p_decisao text,p_duracao_meses integer default 12)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare v public.solicitacoes_turma%rowtype; v_licenca uuid;
begin
  if p_decisao not in ('aprovar','recusar') or p_duracao_meses not between 1 and 60 then raise exception 'Decisão inválida.'; end if;
  select * into v from public.solicitacoes_turma where id=p_solicitacao_id for update;
  if not found or v.status<>'pendente' or not (public.sou_admin() or private.sou_operacao_parceiro(v.parceiro_id)) then raise exception 'Solicitação não autorizada ou já respondida.'; end if;
  update public.solicitacoes_turma set status=case when p_decisao='aprovar' then 'aprovada' else 'recusada' end,respondido_em=now(),respondido_por=auth.uid() where id=v.id;
  update public.licencas_acesso set status=case when p_decisao='aprovar' then 'ativa' else 'cancelada' end,inicio_em=now(),expira_em=case when p_decisao='aprovar' then now()+make_interval(months=>p_duracao_meses) else null end,motivo_bloqueio=case when p_decisao='recusar' then 'Solicitação recusada pelo responsável da turma.' else null end,atualizado_em=now() where user_id=v.user_id and parceiro_id=v.parceiro_id and status='pendente' returning id into v_licenca;
  insert into public.auditoria_acesso(parceiro_id,licenca_id,ator_id,usuario_afetado_id,evento,detalhes) values(v.parceiro_id,v_licenca,auth.uid(),v.user_id,case when p_decisao='aprovar' then 'solicitacao_aprovada' else 'solicitacao_recusada' end,jsonb_build_object('solicitacao_id',v.id,'turma_id',v.turma_id));
end;
$$;

create or replace function public.alterar_status_licenca(p_licenca_id uuid,p_status text,p_motivo text default null,p_expira_em timestamptz default null)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare v public.licencas_acesso%rowtype;
begin
  if p_status not in ('ativa','suspensa','cancelada') then raise exception 'Status inválido.'; end if;
  select * into v from public.licencas_acesso where id=p_licenca_id for update;
  if not found or not (public.sou_admin() or private.sou_operacao_parceiro(v.parceiro_id)) then raise exception 'Somente proprietário ou gestor pode alterar o acesso do aluno.'; end if;
  update public.licencas_acesso set status=p_status,motivo_bloqueio=case when p_status='ativa' then null else nullif(trim(p_motivo),'') end,expira_em=coalesce(p_expira_em,expira_em),atualizado_em=now() where id=v.id;
  insert into public.auditoria_acesso(parceiro_id,licenca_id,ator_id,usuario_afetado_id,evento,detalhes) values(v.parceiro_id,v.id,auth.uid(),v.user_id,case p_status when 'ativa' then 'licenca_ativada' when 'suspensa' then 'licenca_suspensa' else 'licenca_cancelada' end,jsonb_build_object('motivo',p_motivo));
end;
$$;

create or replace function public.mover_aluno_entre_turmas_meu_parceiro(p_licenca_id uuid,p_turma_destino_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare v_licenca public.licencas_acesso%rowtype; v_destino public.turmas%rowtype; v_turma_origem uuid;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado.'; end if;
  select * into v_licenca from public.licencas_acesso where id=p_licenca_id for update;
  if not found then raise exception 'Aluno não encontrado.'; end if;
  if not (public.sou_admin() or private.sou_operacao_parceiro(v_licenca.parceiro_id)) then raise exception 'Somente proprietário ou gestor pode mover alunos.'; end if;
  select * into v_destino from public.turmas where id=p_turma_destino_id and ativa;
  if not found then raise exception 'Turma de destino não encontrada ou inativa.'; end if;
  if v_destino.parceiro_id<>v_licenca.parceiro_id then raise exception 'A transferência entre parceiros diferentes precisa ser feita pelo suporte.'; end if;
  if v_licenca.turma_id=v_destino.id then return; end if;
  v_turma_origem:=v_licenca.turma_id;
  update public.licencas_acesso set turma_id=v_destino.id,atualizado_em=now() where id=v_licenca.id;
  delete from public.cronograma_mentoria_tarefas where user_id=v_licenca.user_id and status in ('pendente','em_andamento','atrasado') and data>=current_date;
  insert into public.auditoria_acesso(parceiro_id,licenca_id,ator_id,usuario_afetado_id,evento,detalhes)
  values(v_licenca.parceiro_id,v_licenca.id,auth.uid(),v_licenca.user_id,'aluno_movido_turma',jsonb_build_object('turma_origem_id',v_turma_origem,'turma_destino_id',v_destino.id,'turma_destino_nome',v_destino.nome));
end;
$$;

create or replace function public.listar_gestao_meu_parceiro()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_id uuid;
  v_papel text;
  v_operacional boolean;
  v_proprietario boolean;
begin
  select parceiro_id,papel into v_id,v_papel
  from public.parceiro_usuarios
  where user_id=auth.uid() and ativo
  order by case papel when 'proprietario' then 1 when 'gestor' then 2 else 3 end
  limit 1;
  if v_id is null then raise exception 'Perfil de parceiro não encontrado.'; end if;
  v_operacional := v_papel in ('proprietario','gestor');
  v_proprietario := v_papel='proprietario';

  return jsonb_build_object(
    'turmas',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'nome',t.nome,'codigo',t.codigo,'ativa',t.ativa) order by t.nome),'[]'::jsonb) from public.turmas t where t.parceiro_id=v_id),
    'convites',case when v_operacional then (select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'turma_id',c.turma_id,'turma_nome',t.nome,'titulo',c.titulo,'ativo',c.ativo,'usos',c.usos,'max_usos',c.max_usos,'expira_em',c.expira_em,'exige_aprovacao',c.exige_aprovacao) order by c.criado_em desc),'[]'::jsonb) from public.convites_turma c join public.turmas t on t.id=c.turma_id where c.parceiro_id=v_id) else '[]'::jsonb end,
    'solicitacoes',case when v_operacional then (select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'user_id',s.user_id,'nome',coalesce(pf.nome,'Aluno'),'email',pf.email,'turma_nome',t.nome,'status',s.status,'solicitado_em',s.solicitado_em) order by s.solicitado_em desc),'[]'::jsonb) from public.solicitacoes_turma s join public.turmas t on t.id=s.turma_id left join public.perfis pf on pf.id=s.user_id where s.parceiro_id=v_id) else '[]'::jsonb end,
    'auditoria',case when v_operacional then (select coalesce(jsonb_agg(x.item order by x.criado_em desc),'[]'::jsonb) from (select a.criado_em,jsonb_build_object('id',a.id,'evento',a.evento,'criado_em',a.criado_em,'usuario_nome',coalesce(pf.nome,'Sistema'),'detalhes',a.detalhes) item from public.auditoria_acesso a left join public.perfis pf on pf.id=a.usuario_afetado_id where a.parceiro_id=v_id order by a.criado_em desc limit 50) x) else '[]'::jsonb end,
    'faturamento',case when v_proprietario then (select coalesce(jsonb_agg(jsonb_build_object('competencia',f.competencia,'alunos_ativos',f.alunos_ativos,'valor_total',f.valor_total_centavos/100.0) order by f.competencia desc),'[]'::jsonb) from public.faturamento_parceiros f where f.parceiro_id=v_id) else '[]'::jsonb end
  );
end;
$$;

create or replace function public.resumo_meu_parceiro()
returns jsonb
language plpgsql
stable
set search_path to 'public'
as $$
declare v_id uuid; v_papel text;
begin
  select parceiro_id,papel into v_id,v_papel
  from public.parceiro_usuarios
  where user_id=auth.uid() and ativo
  order by case papel when 'proprietario' then 1 when 'gestor' then 2 else 3 end
  limit 1;
  if v_id is null then raise exception 'Perfil de parceiro não encontrado.'; end if;

  return (
    select jsonb_build_object(
      'parceiro_id',p.id,
      'parceiro_nome',p.nome,
      'alunos_ativos',count(l.id) filter(where l.status='ativa' and l.inicio_em<=now() and (l.expira_em is null or l.expira_em>now())),
      'alunos_pendentes',count(l.id) filter(where l.status='pendente' or l.inicio_em>now()),
      'alunos_bloqueados',count(l.id) filter(where l.status in ('suspensa','cancelada','expirada') or (l.status='ativa' and l.expira_em<=now())),
      'valor_mensal',case when v_papel='proprietario' then (count(l.id) filter(where l.status='ativa' and l.inicio_em<=now() and (l.expira_em is null or l.expira_em>now()))*p.valor_aluno_centavos)/100.0 else 0 end
    )
    from public.parceiros p
    left join public.licencas_acesso l on l.parceiro_id=p.id
    where p.id=v_id
    group by p.id
  );
end;
$$;
