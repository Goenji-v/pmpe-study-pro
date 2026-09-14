-- Cronograma individual do aluno: congela a rota da mentoria sem perder histórico/progresso.

alter table public.preferencias_cronograma_aluno
  add column if not exists modo_mentoria text not null default 'turma',
  add column if not exists trilha_personalizada_id uuid references public.trilhas_mentoria(id) on delete set null,
  add column if not exists rota_personalizada jsonb not null default '[]'::jsonb,
  add column if not exists personalizado_em timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'preferencias_cronograma_aluno_modo_mentoria_check'
      and conrelid = 'public.preferencias_cronograma_aluno'::regclass
  ) then
    alter table public.preferencias_cronograma_aluno
      add constraint preferencias_cronograma_aluno_modo_mentoria_check
      check (modo_mentoria in ('turma','personalizado'));
  end if;
end $$;

create or replace function private.itens_cronograma_mentoria_aluno(
  p_user_id uuid,
  p_trilha_id uuid
)
returns table(
  id uuid,
  materia text,
  assunto text,
  ordem integer,
  minutos_estimados integer,
  questoes_alvo integer,
  prioridade integer,
  obrigatorio boolean,
  tipo text,
  instrucoes text,
  material_url text,
  ativo boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with estado as (
    select
      coalesce(p.modo_mentoria, 'turma') as modo,
      p.trilha_personalizada_id,
      coalesce(p.rota_personalizada, '[]'::jsonb) as rota
    from (select 1) base
    left join public.preferencias_cronograma_aluno p on p.user_id = p_user_id
  ),
  personalizado as (
    select
      (x->>'id')::uuid as id,
      coalesce(x->>'materia','') as materia,
      coalesce(x->>'assunto','') as assunto,
      greatest(1, coalesce((x->>'ordem')::integer, 1)) as ordem,
      greatest(5, coalesce((x->>'minutos_estimados')::integer, 60)) as minutos_estimados,
      greatest(0, coalesce((x->>'questoes_alvo')::integer, 20)) as questoes_alvo,
      greatest(0, least(100, coalesce((x->>'prioridade')::integer, 50))) as prioridade,
      coalesce((x->>'obrigatorio')::boolean, true) as obrigatorio,
      case when x->>'tipo' in ('teoria','questoes','misto') then x->>'tipo' else 'misto' end as tipo,
      nullif(x->>'instrucoes','') as instrucoes,
      nullif(x->>'material_url','') as material_url,
      coalesce((x->>'ativo')::boolean, true) as ativo
    from estado e
    cross join lateral jsonb_array_elements(e.rota) x
    where e.modo = 'personalizado'
      and e.trilha_personalizada_id = p_trilha_id
      and jsonb_array_length(e.rota) > 0
  ),
  coletivo as (
    select
      i.id,
      i.materia,
      i.assunto,
      coalesce(ra.ordem, i.ordem) as ordem,
      i.minutos_estimados,
      i.questoes_alvo,
      i.prioridade,
      i.obrigatorio,
      i.tipo,
      i.instrucoes,
      i.material_url,
      coalesce(ra.ativo, true) as ativo
    from public.trilha_mentoria_itens i
    left join public.trilha_mentoria_rotas_aluno ra
      on ra.item_id = i.id
     and ra.user_id = p_user_id
    where i.trilha_id = p_trilha_id
      and i.ativo
      and not exists (
        select 1
        from estado e
        where e.modo = 'personalizado'
          and e.trilha_personalizada_id = p_trilha_id
          and jsonb_array_length(e.rota) > 0
      )
  )
  select * from personalizado
  union all
  select * from coletivo
$$;

revoke all on function private.itens_cronograma_mentoria_aluno(uuid,uuid) from public;

do $$
begin
  if to_regprocedure('private.recalcular_cronograma_mentoria_base(uuid,date,integer,text,text)') is null then
    alter function private.recalcular_cronograma_mentoria_core(uuid,date,integer,text,text)
      rename to recalcular_cronograma_mentoria_base;
  end if;
end $$;

create or replace function private.recalcular_cronograma_mentoria_core(
  p_user_id uuid,
  p_inicio date,
  p_dias integer,
  p_motivo text,
  p_origem text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_base jsonb;
  v_parceiro uuid;
  v_turma uuid;
  v_trilha uuid;
  v_minutos_padrao integer;
  v_materias_padrao integer;
  v_questoes_padrao integer;
  v_percentual_padrao integer;
  v_modo text;
  v_trilha_personalizada uuid;
  v_rota jsonb;
  v_max_materias integer;
  v_questoes_sessao integer;
  v_percentual_teoria integer;
  v_inicio date := coalesce(p_inicio,current_date);
  v_total_dias integer := greatest(1,least(coalesce(p_dias,30),90));
  v_fim date;
  v_data date;
  v_dow integer;
  v_disp_ativo boolean;
  v_minutos integer;
  v_usado integer;
  v_restante integer;
  v_ordem integer;
  v_min_tarefa integer;
  v_min_teoria integer;
  v_min_questoes integer;
  v_questoes integer;
  v_slot integer;
  v_item record;
  v_descartadas integer := 0;
  v_criadas integer := 0;
begin
  v_base := private.recalcular_cronograma_mentoria_base(
    p_user_id,p_inicio,p_dias,p_motivo,p_origem
  );

  v_fim := v_inicio + (v_total_dias - 1);

  select l.parceiro_id,l.turma_id,t.id,t.minutos_padrao,t.materias_por_dia,
         t.questoes_por_sessao,t.percentual_teoria
    into v_parceiro,v_turma,v_trilha,v_minutos_padrao,v_materias_padrao,
         v_questoes_padrao,v_percentual_padrao
  from public.licencas_acesso l
  join public.trilhas_mentoria t
    on t.parceiro_id=l.parceiro_id and t.turma_id=l.turma_id and t.ativa
  where l.user_id=p_user_id
    and l.status='ativa'
    and l.inicio_em<=now()
    and (l.expira_em is null or l.expira_em>now())
  order by t.criado_em desc
  limit 1;

  select p.modo_mentoria,p.trilha_personalizada_id,p.rota_personalizada,
         p.max_materias_dia,p.questoes_por_sessao,p.percentual_teoria
    into v_modo,v_trilha_personalizada,v_rota,
         v_max_materias,v_questoes_sessao,v_percentual_teoria
  from public.preferencias_cronograma_aluno p
  where p.user_id=p_user_id;

  if coalesce(v_modo,'turma') <> 'personalizado'
     or v_trilha_personalizada is distinct from v_trilha
     or jsonb_array_length(coalesce(v_rota,'[]'::jsonb))=0 then
    return v_base || jsonb_build_object('modo_cronograma','turma');
  end if;

  v_max_materias := coalesce(v_max_materias,v_materias_padrao,1);
  v_questoes_sessao := coalesce(v_questoes_sessao,v_questoes_padrao,20);
  v_percentual_teoria := coalesce(v_percentual_teoria,v_percentual_padrao,67);

  update public.cronograma_mentoria_tarefas
  set status='reagendado', atualizado_em=now()
  where user_id=p_user_id
    and data between v_inicio and v_fim
    and status in ('pendente','em_andamento','atrasado')
    and coalesce(metadados->>'conteudo_principal','false')='true';
  get diagnostics v_descartadas = row_count;

  for v_data in select generate_series(v_inicio,v_fim,'1 day'::interval)::date loop
    v_dow := extract(dow from v_data)::integer;

    select d.ativo,d.minutos_disponiveis
      into v_disp_ativo,v_minutos
    from public.disponibilidade_estudo_aluno d
    where d.user_id=p_user_id and d.dia_semana=v_dow;

    if not found then
      v_minutos := case when v_dow=0 then 0 else v_minutos_padrao end;
    elsif not v_disp_ativo then
      v_minutos := 0;
    end if;
    if coalesce(v_minutos,0)<5 then continue; end if;

    select coalesce(sum(t.minutos_planejados),0)::integer,
           coalesce(max(t.ordem),0)+1
      into v_usado,v_ordem
    from public.cronograma_mentoria_tarefas t
    where t.user_id=p_user_id
      and t.data=v_data
      and t.status<>'reagendado';

    v_restante := greatest(0,v_minutos-v_usado);
    if v_restante<5 then continue; end if;

    for v_slot in 1..greatest(1,v_max_materias) loop
      exit when v_restante<5 or v_ordem>50;

      select i.*
        into v_item
      from private.itens_cronograma_mentoria_aluno(p_user_id,v_trilha) i
      where i.ativo
        and not exists (
          select 1 from public.progresso_trilha_mentoria p
          where p.item_id=i.id and p.user_id=p_user_id
        )
        and not exists (
          select 1
          from public.cronograma_mentoria_tarefas ct
          where ct.user_id=p_user_id
            and ct.item_id=i.id
            and ct.status not in ('reagendado','pulado')
            and coalesce(ct.metadados->>'conteudo_principal','false')='true'
        )
      order by i.ordem,i.prioridade desc
      limit 1;

      exit when not found;

      v_min_tarefa := least(v_item.minutos_estimados,v_restante);
      exit when v_min_tarefa<5;

      if v_item.tipo='teoria' then
        v_questoes:=0;
        v_min_teoria:=v_min_tarefa;
        v_min_questoes:=0;
      elsif v_item.tipo='questoes' then
        v_questoes:=coalesce(nullif(v_item.questoes_alvo,0),v_questoes_sessao);
        v_min_teoria:=0;
        v_min_questoes:=v_min_tarefa;
      else
        v_questoes:=coalesce(nullif(v_item.questoes_alvo,0),v_questoes_sessao);
        v_min_teoria:=round(v_min_tarefa*v_percentual_teoria/100.0)::integer;
        v_min_questoes:=v_min_tarefa-v_min_teoria;
      end if;

      insert into public.cronograma_mentoria_tarefas(
        user_id,parceiro_id,turma_id,trilha_id,item_id,data,ordem,tipo,
        minutos_planejados,questoes_planejadas,status,origem,data_original,metadados
      )
      values(
        p_user_id,v_parceiro,v_turma,v_trilha,v_item.id,v_data,v_ordem,v_item.tipo,
        v_min_tarefa,v_questoes,'pendente',
        case when p_origem='mentor' then 'mentor' when p_motivo='geracao_inicial' then 'automatico' else 'recalculo' end,
        v_data,
        jsonb_build_object(
          'materia',v_item.materia,
          'assunto',v_item.assunto,
          'prioridade',v_item.prioridade,
          'instrucoes',v_item.instrucoes,
          'material_url',v_item.material_url,
          'conteudo_principal',true,
          'cronograma_personalizado',true,
          'percentual_teoria',v_percentual_teoria,
          'minutos_teoria',v_min_teoria,
          'minutos_questoes',v_min_questoes
        )
      );

      v_criadas:=v_criadas+1;
      v_ordem:=v_ordem+1;
      v_restante:=v_restante-v_min_tarefa;
    end loop;
  end loop;

  insert into public.auditoria_mentoria(
    parceiro_id,turma_id,user_id,ator_id,evento,entidade,entidade_id,detalhes
  )
  values(
    v_parceiro,v_turma,p_user_id,(select auth.uid()),
    'cronograma_personalizado_recalculado','cronograma',p_user_id::text,
    jsonb_build_object(
      'inicio',v_inicio,'fim',v_fim,
      'tarefas_coletivas_descartadas',v_descartadas,
      'tarefas_personalizadas_criadas',v_criadas,
      'motivo',p_motivo
    )
  );

  return v_base || jsonb_build_object(
    'modo_cronograma','personalizado',
    'tarefas_coletivas_descartadas',v_descartadas,
    'tarefas_personalizadas_criadas',v_criadas
  );
end
$$;

create or replace function public.personalizar_meu_cronograma_mentoria(
  p_inicio date default current_date,
  p_dias integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user uuid := (select auth.uid());
  v_parceiro uuid;
  v_turma uuid;
  v_trilha uuid;
  v_materias integer;
  v_questoes integer;
  v_percentual integer;
  v_intervalos integer[];
  v_simulado integer;
  v_rota jsonb;
  v_total integer;
begin
  if v_user is null then raise exception 'Usuário não autenticado.'; end if;

  select l.parceiro_id,l.turma_id,t.id,t.materias_por_dia,t.questoes_por_sessao,
         t.percentual_teoria,t.intervalos_revisao,t.simulado_cada_dias
    into v_parceiro,v_turma,v_trilha,v_materias,v_questoes,v_percentual,v_intervalos,v_simulado
  from public.licencas_acesso l
  join public.trilhas_mentoria t
    on t.parceiro_id=l.parceiro_id and t.turma_id=l.turma_id and t.ativa
  where l.user_id=v_user
    and l.status='ativa'
    and l.inicio_em<=now()
    and (l.expira_em is null or l.expira_em>now())
  order by t.criado_em desc
  limit 1;

  if v_trilha is null then raise exception 'Não existe trilha ativa para personalizar.'; end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',i.id,
        'materia',i.materia,
        'assunto',i.assunto,
        'ordem',i.ordem,
        'minutos_estimados',i.minutos_estimados,
        'questoes_alvo',i.questoes_alvo,
        'prioridade',i.prioridade,
        'obrigatorio',i.obrigatorio,
        'tipo',i.tipo,
        'instrucoes',i.instrucoes,
        'material_url',i.material_url,
        'ativo',i.ativo
      )
      order by i.ordem,i.prioridade desc
    ),
    '[]'::jsonb
  )
  into v_rota
  from private.itens_cronograma_mentoria_aluno(v_user,v_trilha) i
  where i.ativo;

  v_total := jsonb_array_length(v_rota);
  if v_total = 0 then raise exception 'A trilha ainda não possui conteúdos ativos para personalizar.'; end if;

  insert into public.preferencias_cronograma_aluno(
    user_id,max_materias_dia,questoes_por_sessao,percentual_teoria,intervalos_revisao,
    simulado_cada_dias,data_inicio,modo_mentoria,trilha_personalizada_id,
    rota_personalizada,personalizado_em,atualizado_em
  )
  values(
    v_user,v_materias,v_questoes,v_percentual,v_intervalos,
    v_simulado,coalesce(p_inicio,current_date),'personalizado',v_trilha,
    v_rota,now(),now()
  )
  on conflict (user_id) do update
  set modo_mentoria='personalizado',
      trilha_personalizada_id=excluded.trilha_personalizada_id,
      rota_personalizada=excluded.rota_personalizada,
      personalizado_em=excluded.personalizado_em,
      atualizado_em=now();

  perform private.recalcular_cronograma_mentoria_core(
    v_user,coalesce(p_inicio,current_date),greatest(1,least(coalesce(p_dias,30),90)),
    'cronograma_personalizado','aluno'
  );

  insert into public.auditoria_mentoria(
    parceiro_id,turma_id,user_id,ator_id,evento,entidade,entidade_id,detalhes
  )
  values(
    v_parceiro,v_turma,v_user,v_user,'cronograma_personalizado','cronograma',
    v_user::text,jsonb_build_object('trilha_id',v_trilha,'itens_congelados',v_total)
  );

  return jsonb_build_object(
    'sucesso',true,'modo','personalizado','trilha_id',v_trilha,'itens',v_total
  );
end
$$;

create or replace function public.voltar_meu_cronograma_para_turma(
  p_inicio date default current_date,
  p_dias integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user uuid := (select auth.uid());
  v_parceiro uuid;
  v_turma uuid;
  v_trilha uuid;
begin
  if v_user is null then raise exception 'Usuário não autenticado.'; end if;

  select l.parceiro_id,l.turma_id,t.id
    into v_parceiro,v_turma,v_trilha
  from public.licencas_acesso l
  join public.trilhas_mentoria t
    on t.parceiro_id=l.parceiro_id and t.turma_id=l.turma_id and t.ativa
  where l.user_id=v_user
    and l.status='ativa'
    and l.inicio_em<=now()
    and (l.expira_em is null or l.expira_em>now())
  order by t.criado_em desc
  limit 1;

  if v_trilha is null then raise exception 'Não existe trilha ativa para este aluno.'; end if;

  update public.preferencias_cronograma_aluno
  set modo_mentoria='turma',
      trilha_personalizada_id=null,
      rota_personalizada='[]'::jsonb,
      personalizado_em=null,
      atualizado_em=now()
  where user_id=v_user;

  perform private.recalcular_cronograma_mentoria_core(
    v_user,coalesce(p_inicio,current_date),greatest(1,least(coalesce(p_dias,30),90)),
    'retorno_cronograma_turma','aluno'
  );

  insert into public.auditoria_mentoria(
    parceiro_id,turma_id,user_id,ator_id,evento,entidade,entidade_id,detalhes
  )
  values(
    v_parceiro,v_turma,v_user,v_user,'cronograma_retorno_turma','cronograma',
    v_user::text,jsonb_build_object('trilha_id',v_trilha)
  );

  return jsonb_build_object('sucesso',true,'modo','turma','trilha_id',v_trilha);
end
$$;

revoke all on function public.personalizar_meu_cronograma_mentoria(date,integer) from public;
revoke all on function public.voltar_meu_cronograma_para_turma(date,integer) from public;
grant execute on function public.personalizar_meu_cronograma_mentoria(date,integer) to authenticated;
grant execute on function public.voltar_meu_cronograma_para_turma(date,integer) to authenticated;

create or replace function private.bloquear_exclusao_item_cronograma_personalizado()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if exists (
    select 1
    from public.preferencias_cronograma_aluno p
    where p.modo_mentoria='personalizado'
      and p.trilha_personalizada_id=old.trilha_id
      and p.rota_personalizada @> jsonb_build_array(jsonb_build_object('id',old.id::text))
  ) then
    raise exception 'Este conteúdo faz parte de um cronograma personalizado de aluno. Desative-o ou peça ao aluno para voltar à rota da turma antes de excluir.';
  end if;
  return old;
end
$$;

drop trigger if exists bloquear_exclusao_item_cronograma_personalizado on public.trilha_mentoria_itens;
create trigger bloquear_exclusao_item_cronograma_personalizado
before delete on public.trilha_mentoria_itens
for each row execute function private.bloquear_exclusao_item_cronograma_personalizado();

create or replace function public.minha_trilha_mentoria()
returns jsonb
language sql
stable
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'id',t.id,
    'nome',t.nome,
    'parceiro_id',t.parceiro_id,
    'turma_id',t.turma_id,
    'minutos_padrao',t.minutos_padrao,
    'materias_por_dia',t.materias_por_dia,
    'questoes_por_sessao',t.questoes_por_sessao,
    'revisoes_por_dia',t.revisoes_por_dia,
    'intervalos_revisao',t.intervalos_revisao,
    'simulado_cada_dias',t.simulado_cada_dias,
    'percentual_teoria',t.percentual_teoria,
    'modo_cronograma',
      case
        when pca.modo_mentoria='personalizado'
         and pca.trilha_personalizada_id=t.id
         and jsonb_array_length(coalesce(pca.rota_personalizada,'[]'::jsonb))>0
        then 'personalizado'
        else 'turma'
      end,
    'personalizado_em',
      case
        when pca.modo_mentoria='personalizado' and pca.trilha_personalizada_id=t.id
        then pca.personalizado_em
        else null
      end,
    'itens',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',i.id,
          'materia',i.materia,
          'assunto',i.assunto,
          'ordem',i.ordem,
          'minutos_estimados',i.minutos_estimados,
          'questoes_alvo',i.questoes_alvo,
          'prioridade',i.prioridade,
          'obrigatorio',i.obrigatorio,
          'tipo',i.tipo,
          'instrucoes',i.instrucoes,
          'material_url',i.material_url,
          'concluido',p.item_id is not null,
          'concluido_em',p.concluido_em
        ) order by i.ordem,i.prioridade desc
      )
      from private.itens_cronograma_mentoria_aluno((select auth.uid()),t.id) i
      left join public.progresso_trilha_mentoria p
        on p.item_id=i.id and p.user_id=(select auth.uid())
      where i.ativo
    ),'[]'::jsonb),
    'reforcos',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',r.id,'item_id',r.item_id,'materia',r.materia,'assunto',r.assunto,'motivo',r.motivo,
          'minutos_extra',r.minutos_extra,'questoes_extra',r.questoes_extra,'revisao_em_dias',r.revisao_em_dias,
          'prioridade',r.prioridade,'criado_em',r.criado_em
        ) order by r.prioridade desc,r.criado_em
      )
      from public.reforcos_mentoria r
      where r.trilha_id=t.id and r.user_id=(select auth.uid()) and r.status='pendente'
    ),'[]'::jsonb),
    'disponibilidade',coalesce((
      select jsonb_agg(
        jsonb_build_object('dia_semana',d.dia_semana,'ativo',d.ativo,'minutos_disponiveis',d.minutos_disponiveis)
        order by d.dia_semana
      )
      from public.disponibilidade_estudo_aluno d
      where d.user_id=(select auth.uid())
    ),'[]'::jsonb),
    'preferencias',
      case when pca.user_id is null then null else jsonb_build_object(
        'max_materias_dia',pca.max_materias_dia,
        'questoes_por_sessao',pca.questoes_por_sessao,
        'percentual_teoria',pca.percentual_teoria,
        'intervalos_revisao',pca.intervalos_revisao,
        'simulado_cada_dias',pca.simulado_cada_dias,
        'data_inicio',pca.data_inicio,
        'data_prova',pca.data_prova
      ) end
  )
  from public.trilhas_mentoria t
  join public.licencas_acesso l
    on l.parceiro_id=t.parceiro_id and l.turma_id=t.turma_id
  left join public.preferencias_cronograma_aluno pca
    on pca.user_id=(select auth.uid())
  where l.user_id=(select auth.uid())
    and l.status='ativa'
    and l.inicio_em<=now()
    and (l.expira_em is null or l.expira_em>now())
    and t.ativa
  order by t.criado_em desc
  limit 1
$$;
