-- Simulados completos do professor/parceiro.
-- Reaproveita o motor de simulados oficiais já existente e acrescenta:
-- múltiplas turmas, resultado programado, integridade e painel agregado.

alter table public.simulados_oficiais
  add column if not exists descricao text,
  add column if not exists resultado_liberado_em timestamptz,
  add column if not exists exigir_tela_cheia boolean not null default true,
  add column if not exists registrar_integridade boolean not null default true;

create table if not exists public.simulados_oficiais_turmas (
  simulado_id uuid not null references public.simulados_oficiais(id) on delete cascade,
  turma_id uuid not null references public.turmas(id) on delete cascade,
  parceiro_id uuid not null references public.parceiros(id) on delete cascade,
  criado_por uuid not null default auth.uid() references auth.users(id),
  criado_em timestamptz not null default now(),
  primary key (simulado_id, turma_id)
);

create index if not exists simulados_oficiais_turmas_turma_idx on public.simulados_oficiais_turmas(turma_id, simulado_id);
create index if not exists simulados_oficiais_turmas_parceiro_idx on public.simulados_oficiais_turmas(parceiro_id, simulado_id);
create index if not exists simulados_oficiais_turmas_criado_por_idx on public.simulados_oficiais_turmas(criado_por);
create index if not exists simulados_oficiais_criado_por_idx on public.simulados_oficiais(criado_por);

alter table public.simulados_oficiais_turmas enable row level security;

revoke all on table public.simulados_oficiais_turmas from anon, authenticated;
grant select, insert, update, delete on table public.simulados_oficiais_turmas to authenticated;
grant all on table public.simulados_oficiais_turmas to service_role;

-- Corrige a validação antiga de turma, que comparava a coluna com ela mesma.
drop policy if exists simulados_oficiais_parceiro_insert on public.simulados_oficiais;
create policy simulados_oficiais_parceiro_insert
on public.simulados_oficiais for insert to authenticated
with check (
  parceiro_id is not null
  and turma_id is not null
  and private.sou_gestor_parceiro(parceiro_id)
  and exists (
    select 1 from public.turmas t
    where t.id = simulados_oficiais.turma_id
      and t.parceiro_id = simulados_oficiais.parceiro_id
  )
);

drop policy if exists simulados_oficiais_parceiro_update on public.simulados_oficiais;
create policy simulados_oficiais_parceiro_update
on public.simulados_oficiais for update to authenticated
using (parceiro_id is not null and private.sou_gestor_parceiro(parceiro_id))
with check (
  parceiro_id is not null
  and private.sou_gestor_parceiro(parceiro_id)
  and (
    turma_id is null
    or exists (
      select 1 from public.turmas t
      where t.id = simulados_oficiais.turma_id
        and t.parceiro_id = simulados_oficiais.parceiro_id
    )
  )
);

drop policy if exists simulados_oficiais_parceiro_delete on public.simulados_oficiais;
create policy simulados_oficiais_parceiro_delete
on public.simulados_oficiais for delete to authenticated
using (parceiro_id is not null and private.sou_gestor_parceiro(parceiro_id));

-- A leitura do simulado considera tanto a turma legada quanto a nova associação N:N.
drop policy if exists simulados_oficiais_leitura on public.simulados_oficiais;
create policy simulados_oficiais_leitura
on public.simulados_oficiais for select to authenticated
using (
  public.sou_admin()
  or (parceiro_id is null and status = 'publicado')
  or (parceiro_id is not null and private.sou_gestor_parceiro(parceiro_id))
  or (
    status = 'publicado'
    and exists (
      select 1
      from public.licencas_acesso l
      where l.user_id = (select auth.uid())
        and l.status = 'ativa'
        and l.inicio_em <= now()
        and (l.expira_em is null or l.expira_em > now())
        and (
          l.turma_id = simulados_oficiais.turma_id
          or exists (
            select 1 from public.simulados_oficiais_turmas st
            where st.simulado_id = simulados_oficiais.id
              and st.turma_id = l.turma_id
          )
        )
    )
  )
);

-- Associação simulado x turmas.
drop policy if exists simulados_turmas_leitura on public.simulados_oficiais_turmas;
create policy simulados_turmas_leitura
on public.simulados_oficiais_turmas for select to authenticated
using (
  public.sou_admin()
  or private.sou_gestor_parceiro(parceiro_id)
  or exists (
    select 1 from public.licencas_acesso l
    where l.user_id = (select auth.uid())
      and l.turma_id = simulados_oficiais_turmas.turma_id
      and l.status = 'ativa'
      and l.inicio_em <= now()
      and (l.expira_em is null or l.expira_em > now())
  )
);

drop policy if exists simulados_turmas_inserir on public.simulados_oficiais_turmas;
create policy simulados_turmas_inserir
on public.simulados_oficiais_turmas for insert to authenticated
with check (
  private.sou_gestor_parceiro(parceiro_id)
  and exists (
    select 1 from public.simulados_oficiais s
    where s.id = simulados_oficiais_turmas.simulado_id
      and s.parceiro_id = simulados_oficiais_turmas.parceiro_id
  )
  and exists (
    select 1 from public.turmas t
    where t.id = simulados_oficiais_turmas.turma_id
      and t.parceiro_id = simulados_oficiais_turmas.parceiro_id
  )
);

drop policy if exists simulados_turmas_excluir on public.simulados_oficiais_turmas;
create policy simulados_turmas_excluir
on public.simulados_oficiais_turmas for delete to authenticated
using (private.sou_gestor_parceiro(parceiro_id));

-- Professor precisa ler/editar o conteúdo do próprio simulado em rascunho.
drop policy if exists simulados_oficiais_questoes_leitura on public.simulados_oficiais_questoes;
create policy simulados_oficiais_questoes_leitura
on public.simulados_oficiais_questoes for select to authenticated
using (
  exists (
    select 1 from public.simulados_oficiais s
    where s.id = simulados_oficiais_questoes.simulado_id
      and (
        s.status = 'publicado'
        or public.sou_admin()
        or (s.parceiro_id is not null and private.sou_gestor_parceiro(s.parceiro_id))
      )
  )
);

drop policy if exists simulados_questoes_parceiro_delete on public.simulados_oficiais_questoes;
create policy simulados_questoes_parceiro_delete
on public.simulados_oficiais_questoes for delete to authenticated
using (
  exists (
    select 1 from public.simulados_oficiais s
    where s.id = simulados_oficiais_questoes.simulado_id
      and s.parceiro_id is not null
      and private.sou_gestor_parceiro(s.parceiro_id)
  )
);

-- Gabarito nunca é exposto ao aluno antes da correção.
drop policy if exists simulados_gabaritos_parceiro_select on public.simulados_oficiais_gabaritos;
create policy simulados_gabaritos_parceiro_select
on public.simulados_oficiais_gabaritos for select to authenticated
using (
  public.sou_admin()
  or exists (
    select 1 from public.simulados_oficiais s
    where s.id = simulados_oficiais_gabaritos.simulado_id
      and s.parceiro_id is not null
      and private.sou_gestor_parceiro(s.parceiro_id)
  )
);

drop policy if exists simulados_gabaritos_parceiro_update on public.simulados_oficiais_gabaritos;
create policy simulados_gabaritos_parceiro_update
on public.simulados_oficiais_gabaritos for update to authenticated
using (
  exists (
    select 1 from public.simulados_oficiais s
    where s.id = simulados_oficiais_gabaritos.simulado_id
      and s.parceiro_id is not null
      and private.sou_gestor_parceiro(s.parceiro_id)
  )
)
with check (
  exists (
    select 1 from public.simulados_oficiais s
    where s.id = simulados_oficiais_gabaritos.simulado_id
      and s.parceiro_id is not null
      and private.sou_gestor_parceiro(s.parceiro_id)
  )
);

drop policy if exists simulados_gabaritos_parceiro_delete on public.simulados_oficiais_gabaritos;
create policy simulados_gabaritos_parceiro_delete
on public.simulados_oficiais_gabaritos for delete to authenticated
using (
  exists (
    select 1 from public.simulados_oficiais s
    where s.id = simulados_oficiais_gabaritos.simulado_id
      and s.parceiro_id is not null
      and private.sou_gestor_parceiro(s.parceiro_id)
  )
);

-- Professor pode consultar resultados e tentativas de seus próprios simulados.
drop policy if exists simulados_oficiais_tentativas_leitura on public.simulados_oficiais_tentativas;
create policy simulados_oficiais_tentativas_leitura
on public.simulados_oficiais_tentativas for select to authenticated
using (
  usuario_id = (select auth.uid())
  or public.sou_admin()
  or exists (
    select 1 from public.simulados_oficiais s
    where s.id = simulados_oficiais_tentativas.simulado_id
      and s.parceiro_id is not null
      and private.sou_gestor_parceiro(s.parceiro_id)
  )
);

-- Criação atômica do simulado pelo professor.
create or replace function public.criar_simulado_meu_parceiro(
  p_nome text,
  p_descricao text,
  p_concurso text,
  p_banca text,
  p_duracao_minutos integer,
  p_abre_em timestamptz,
  p_encerra_em timestamptz,
  p_resultado_liberado_em timestamptz,
  p_turmas uuid[],
  p_questoes jsonb,
  p_bonificacoes jsonb default '[]'::jsonb,
  p_exigir_tela_cheia boolean default true,
  p_registrar_integridade boolean default true
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_parceiro uuid;
  v_simulado uuid;
  v_turma uuid;
  v_q jsonb;
  v_alt jsonb;
  v_numero integer := 0;
  v_resposta text;
begin
  if (select auth.uid()) is null then raise exception 'Usuário não autenticado.'; end if;

  select pu.parceiro_id into v_parceiro
  from public.parceiro_usuarios pu
  where pu.user_id = (select auth.uid())
    and pu.ativo
    and pu.papel in ('proprietario','gestor','professor')
  order by case pu.papel when 'proprietario' then 1 when 'gestor' then 2 else 3 end
  limit 1;

  if v_parceiro is null then raise exception 'Parceiro não autorizado.'; end if;
  if coalesce(length(trim(p_nome)),0) < 2 then raise exception 'Informe o nome do simulado.'; end if;
  if coalesce(array_length(p_turmas,1),0) = 0 then raise exception 'Selecione ao menos uma turma.'; end if;
  if not jsonb_typeof(coalesce(p_questoes,'[]'::jsonb)) = 'array' or jsonb_array_length(coalesce(p_questoes,'[]'::jsonb)) = 0 then
    raise exception 'Cadastre ao menos uma questão.';
  end if;
  if p_duracao_minutos < 1 or p_duracao_minutos > 1440 then raise exception 'Duração inválida.'; end if;
  if p_abre_em is not null and p_encerra_em is not null and p_encerra_em <= p_abre_em then
    raise exception 'O encerramento deve ser posterior à abertura.';
  end if;

  if exists (
    select 1 from unnest(p_turmas) x(id)
    left join public.turmas t on t.id=x.id
    where t.id is null or t.parceiro_id <> v_parceiro
  ) then raise exception 'Uma ou mais turmas não pertencem ao parceiro.'; end if;

  insert into public.simulados_oficiais(
    nome, descricao, concurso_alvo, banca, duracao_minutos, total_questoes,
    status, parceiro_id, turma_id, abre_em, encerra_em, resultado_liberado_em,
    bonificacoes, exigir_tela_cheia, registrar_integridade
  ) values (
    trim(p_nome), nullif(trim(coalesce(p_descricao,'')),''), coalesce(nullif(trim(p_concurso),''),'PMPE'),
    coalesce(nullif(trim(p_banca),''),'Não informada'), p_duracao_minutos, jsonb_array_length(p_questoes),
    'rascunho', v_parceiro, p_turmas[1], p_abre_em, p_encerra_em, p_resultado_liberado_em,
    coalesce(p_bonificacoes,'[]'::jsonb), p_exigir_tela_cheia, p_registrar_integridade
  ) returning id into v_simulado;

  foreach v_turma in array p_turmas loop
    insert into public.simulados_oficiais_turmas(simulado_id,turma_id,parceiro_id)
    values(v_simulado,v_turma,v_parceiro);
  end loop;

  for v_q in select value from jsonb_array_elements(p_questoes) loop
    v_numero := v_numero + 1;
    v_alt := coalesce(v_q->'alternativas','[]'::jsonb);
    if jsonb_typeof(v_alt) <> 'array' or jsonb_array_length(v_alt) < 2 then
      raise exception 'Questão % precisa ter ao menos duas alternativas.', v_numero;
    end if;
    v_resposta := upper(left(coalesce(v_q->>'respostaCorretaId',''),1));
    if v_resposta = '' or not exists (
      select 1 from jsonb_array_elements(v_alt) a where upper(left(coalesce(a->>'id',''),1)) = v_resposta
    ) then raise exception 'Gabarito inválido na questão %.', v_numero; end if;

    insert into public.simulados_oficiais_questoes(
      id, simulado_id, numero, materia, assunto, dificuldade, enunciado, alternativas, explicacao, ordem
    ) values (
      gen_random_uuid(), v_simulado, v_numero,
      coalesce(nullif(trim(v_q->>'materia'),''),'Não classificada'),
      coalesce(nullif(trim(v_q->>'assunto'),''),'Não classificado'),
      case when lower(v_q->>'dificuldade') in ('facil','dificil') then lower(v_q->>'dificuldade') else 'media' end,
      trim(coalesce(v_q->>'enunciado','')), v_alt,
      nullif(trim(coalesce(v_q->>'explicacao','')),''), v_numero
    );

    insert into public.simulados_oficiais_gabaritos(simulado_id,numero,resposta,anulada)
    values(v_simulado,v_numero,v_resposta,false);
  end loop;

  return v_simulado;
end
$$;

revoke all on function public.criar_simulado_meu_parceiro(text,text,text,text,integer,timestamptz,timestamptz,timestamptz,uuid[],jsonb,jsonb,boolean,boolean) from public, anon;
grant execute on function public.criar_simulado_meu_parceiro(text,text,text,text,integer,timestamptz,timestamptz,timestamptz,uuid[],jsonb,jsonb,boolean,boolean) to authenticated;

-- Painel agregado de resultados do professor, somente do próprio parceiro.
create or replace function public.painel_simulado_meu_parceiro(p_simulado_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_sim public.simulados_oficiais%rowtype;
  v_resultado jsonb;
begin
  select * into v_sim from public.simulados_oficiais where id=p_simulado_id;
  if not found or v_sim.parceiro_id is null or not (public.sou_admin() or private.sou_gestor_parceiro(v_sim.parceiro_id)) then
    raise exception 'Simulado não autorizado.';
  end if;

  select jsonb_build_object(
    'total_tentativas', count(*),
    'oficiais_concluidas', count(*) filter (where st.conta_ranking and st.finalizada),
    'treinos_concluidos', count(*) filter (where not st.conta_ranking and st.finalizada),
    'media_percentual', coalesce(round(avg((st.resultado->>'percentual')::numeric) filter (where st.conta_ranking and st.finalizada),2),0),
    'alertas_integridade', coalesce(sum((select count(*) from public.simulado_integridade_eventos e where e.tentativa_id=st.id)),0),
    'ranking', coalesce((
      select jsonb_agg(x order by x.certas desc, x.minutos asc, x.finalizada_em asc)
      from (
        select
          st2.usuario_id,
          coalesce(nullif(p.nome,''), split_part(coalesce(p.email,'Aluno'),'@',1), 'Aluno') as nome,
          coalesce(t.nome,'Sem turma') as turma,
          coalesce((st2.resultado->>'certas')::int,0) as certas,
          coalesce((st2.resultado->>'erradas')::int,0) as erradas,
          coalesce((st2.resultado->>'emBranco')::int,0) as em_branco,
          coalesce((st2.resultado->>'percentual')::numeric,0) as percentual,
          coalesce(st2.minutos_gastos,0) as minutos,
          st2.finalizada_em,
          (select count(*) from public.simulado_integridade_eventos e2 where e2.tentativa_id=st2.id) as alertas
        from public.simulados_oficiais_tentativas st2
        join public.perfis p on p.id=st2.usuario_id
        left join lateral (
          select tt.nome
          from public.licencas_acesso l2
          join public.turmas tt on tt.id=l2.turma_id
          where l2.user_id=st2.usuario_id
            and l2.parceiro_id=v_sim.parceiro_id
          order by l2.inicio_em desc
          limit 1
        ) t on true
        where st2.simulado_id=p_simulado_id
          and st2.conta_ranking
          and st2.finalizada
      ) x
    ),'[]'::jsonb)
  ) into v_resultado
  from public.simulados_oficiais_tentativas st
  where st.simulado_id=p_simulado_id;

  return v_resultado;
end
$$;

revoke all on function public.painel_simulado_meu_parceiro(uuid) from public, anon;
grant execute on function public.painel_simulado_meu_parceiro(uuid) to authenticated;

-- Início da prova respeita qualquer turma associada ao simulado.
create or replace function public.iniciar_simulado_oficial(p_simulado_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_simulado public.simulados_oficiais%rowtype;
  v_existente public.simulados_oficiais_tentativas%rowtype;
  v_id uuid;
  v_numero integer;
  v_ranking boolean;
  v_inicio timestamptz;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado.'; end if;
  select * into v_simulado from public.simulados_oficiais where id=p_simulado_id and status='publicado';
  if not found or (v_simulado.abre_em is not null and v_simulado.abre_em>now()) or (v_simulado.encerra_em is not null and v_simulado.encerra_em<=now()) then
    raise exception 'Simulado indisponível neste período.';
  end if;

  if v_simulado.parceiro_id is not null and not (
    public.sou_admin()
    or private.sou_gestor_parceiro(v_simulado.parceiro_id)
    or exists(
      select 1 from public.licencas_acesso l
      where l.user_id=auth.uid() and l.status='ativa'
        and l.inicio_em<=now() and (l.expira_em is null or l.expira_em>now())
        and l.parceiro_id=v_simulado.parceiro_id
        and (
          l.turma_id=v_simulado.turma_id
          or exists(select 1 from public.simulados_oficiais_turmas st where st.simulado_id=v_simulado.id and st.turma_id=l.turma_id)
        )
    )
  ) then raise exception 'Este simulado pertence a outra turma.'; end if;

  select * into v_existente from public.simulados_oficiais_tentativas
  where simulado_id=p_simulado_id and usuario_id=auth.uid() and not finalizada
  order by iniciada_em desc limit 1;
  if found then return jsonb_build_object('id',v_existente.id,'numero_tentativa',v_existente.numero_tentativa,'conta_ranking',v_existente.conta_ranking,'iniciada_em',v_existente.iniciada_em); end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_simulado_id::text||':'||auth.uid()::text,0));
  select * into v_existente from public.simulados_oficiais_tentativas
  where simulado_id=p_simulado_id and usuario_id=auth.uid() and not finalizada
  order by iniciada_em desc limit 1;
  if found then return jsonb_build_object('id',v_existente.id,'numero_tentativa',v_existente.numero_tentativa,'conta_ranking',v_existente.conta_ranking,'iniciada_em',v_existente.iniciada_em); end if;

  select coalesce(max(numero_tentativa),0)+1 into v_numero
  from public.simulados_oficiais_tentativas where simulado_id=p_simulado_id and usuario_id=auth.uid();
  v_ranking:=v_numero=1;
  insert into public.simulados_oficiais_tentativas(simulado_id,usuario_id,numero_tentativa,conta_ranking)
  values(p_simulado_id,auth.uid(),v_numero,v_ranking) returning id,iniciada_em into v_id,v_inicio;
  return jsonb_build_object('id',v_id,'numero_tentativa',v_numero,'conta_ranking',v_ranking,'iniciada_em',v_inicio);
end
$$;

-- SECURITY DEFINER é necessário para iniciar tentativas sem abrir INSERT direto ao aluno.
revoke all on function public.iniciar_simulado_oficial(uuid) from public, anon;
grant execute on function public.iniciar_simulado_oficial(uuid) to authenticated;
