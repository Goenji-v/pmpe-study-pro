alter table public.curso_parceiro_cursos
  add column if not exists status text,
  add column if not exists publicado_em timestamptz,
  add column if not exists arquivado_em timestamptz;

update public.curso_parceiro_cursos
set status = case when ativo then 'publicado' else 'arquivado' end
where status is null;

update public.curso_parceiro_cursos
set publicado_em = coalesce(publicado_em, criado_em)
where status = 'publicado' and publicado_em is null;

update public.curso_parceiro_cursos
set arquivado_em = coalesce(arquivado_em, atualizado_em, criado_em)
where status = 'arquivado' and arquivado_em is null;

alter table public.curso_parceiro_cursos
  alter column status set default 'rascunho',
  alter column status set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.curso_parceiro_cursos'::regclass
      and conname = 'curso_parceiro_cursos_status_check'
  ) then
    alter table public.curso_parceiro_cursos
      add constraint curso_parceiro_cursos_status_check
      check (status in ('rascunho','publicado','arquivado'));
  end if;
end $$;

create or replace function private.pode_ler_curso(p_curso_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1
    from public.curso_parceiro_cursos c
    where c.id = p_curso_id
      and (
        public.sou_admin()
        or private.sou_gestor_parceiro(c.parceiro_id)
        or (
          c.status = 'publicado'
          and c.ativo
          and exists (
            select 1
            from public.curso_parceiro_turmas ct
            join public.licencas_acesso l
              on l.turma_id = ct.turma_id
             and l.parceiro_id = c.parceiro_id
            where ct.curso_id = c.id
              and ct.ativo
              and l.user_id = auth.uid()
              and l.status = 'ativa'
              and l.inicio_em <= now()
              and (l.expira_em is null or l.expira_em > now())
          )
        )
      )
  )
$function$;

create or replace function public.meus_cursos_mentoria()
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'nome', c.nome,
      'descricao', c.descricao,
      'disciplinas', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', d.id,
          'titulo', d.titulo,
          'descricao', d.descricao,
          'ordem', d.ordem,
          'modulos', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', m.id,
              'titulo', m.titulo,
              'descricao', m.descricao,
              'ordem', m.ordem,
              'aulas', coalesce((
                select jsonb_agg(jsonb_build_object(
                  'id', a.id,
                  'titulo', a.titulo,
                  'descricao', a.descricao,
                  'tipo', a.tipo,
                  'url', a.url,
                  'duracao_minutos', a.duracao_minutos,
                  'ordem', a.ordem,
                  'concluida', coalesce(p.concluida,false),
                  'concluida_em', p.concluida_em
                ) order by a.ordem)
                from public.curso_parceiro_aulas a
                left join public.curso_parceiro_progresso p on p.aula_id=a.id and p.user_id=(select auth.uid())
                where a.modulo_id=m.id and a.ativo
              ), '[]'::jsonb)
            ) order by m.ordem)
            from public.curso_parceiro_modulos m
            where m.disciplina_id=d.id and m.ativo
          ), '[]'::jsonb)
        ) order by d.ordem)
        from public.curso_parceiro_disciplinas d
        where d.curso_id=c.id and d.ativo
      ), '[]'::jsonb)
    ) order by c.criado_em)
  , '[]'::jsonb)
  from public.curso_parceiro_cursos c
  where c.status = 'publicado'
    and c.ativo
    and exists (
      select 1
      from public.curso_parceiro_turmas ct
      join public.licencas_acesso l on l.turma_id=ct.turma_id
      where ct.curso_id=c.id and ct.ativo
        and l.user_id=(select auth.uid()) and l.parceiro_id=c.parceiro_id
        and l.status='ativa' and l.inicio_em<=now()
        and (l.expira_em is null or l.expira_em>now())
    )
$function$;

create or replace function public.painel_cursos_meu_parceiro()
returns jsonb
language plpgsql
stable
set search_path to 'public'
as $function$
declare
  v_parceiro uuid;
begin
  select pu.parceiro_id into v_parceiro
  from public.parceiro_usuarios pu
  where pu.user_id=(select auth.uid()) and pu.ativo and pu.papel in ('proprietario','gestor','professor')
  order by case pu.papel when 'proprietario' then 1 when 'gestor' then 2 else 3 end
  limit 1;
  if v_parceiro is null then raise exception 'Perfil de parceiro não encontrado.'; end if;

  return jsonb_build_object(
    'parceiro_id', v_parceiro,
    'turmas', coalesce((
      select jsonb_agg(jsonb_build_object('id',t.id,'nome',t.nome,'ativa',t.ativa) order by t.nome)
      from public.turmas t where t.parceiro_id=v_parceiro
    ), '[]'::jsonb),
    'cursos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',c.id,'nome',c.nome,'descricao',c.descricao,'ativo',c.ativo,
        'status',c.status,'publicado_em',c.publicado_em,'arquivado_em',c.arquivado_em,
        'possui_progresso',exists(
          select 1
          from public.curso_parceiro_progresso pr
          join public.curso_parceiro_aulas aa on aa.id=pr.aula_id
          join public.curso_parceiro_modulos mm on mm.id=aa.modulo_id
          join public.curso_parceiro_disciplinas dd on dd.id=mm.disciplina_id
          where dd.curso_id=c.id
        ),
        'turma_ids',coalesce((select jsonb_agg(ct.turma_id) from public.curso_parceiro_turmas ct where ct.curso_id=c.id and ct.ativo),'[]'::jsonb),
        'disciplinas',coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',d.id,'titulo',d.titulo,'descricao',d.descricao,'ordem',d.ordem,'ativo',d.ativo,
            'modulos',coalesce((
              select jsonb_agg(jsonb_build_object(
                'id',m.id,'titulo',m.titulo,'descricao',m.descricao,'ordem',m.ordem,'ativo',m.ativo,
                'aulas',coalesce((
                  select jsonb_agg(jsonb_build_object('id',a.id,'titulo',a.titulo,'descricao',a.descricao,'tipo',a.tipo,'url',a.url,'duracao_minutos',a.duracao_minutos,'ordem',a.ordem,'ativo',a.ativo) order by a.ordem)
                  from public.curso_parceiro_aulas a where a.modulo_id=m.id
                ),'[]'::jsonb)
              ) order by m.ordem)
              from public.curso_parceiro_modulos m where m.disciplina_id=d.id
            ),'[]'::jsonb)
          ) order by d.ordem)
          from public.curso_parceiro_disciplinas d where d.curso_id=c.id
        ),'[]'::jsonb),
        'progresso',coalesce((
          with aulas_curso as (
            select a.id
            from public.curso_parceiro_aulas a
            join public.curso_parceiro_modulos m on m.id=a.modulo_id and m.ativo
            join public.curso_parceiro_disciplinas d on d.id=m.disciplina_id and d.ativo
            where d.curso_id=c.id and a.ativo
          ), alunos as (
            select distinct l.user_id, coalesce(p.nome,'Aluno') nome, coalesce(t.nome,'Sem turma') turma
            from public.curso_parceiro_turmas ct
            join public.licencas_acesso l on l.turma_id=ct.turma_id and l.parceiro_id=c.parceiro_id
            left join public.perfis p on p.id=l.user_id
            left join public.turmas t on t.id=l.turma_id
            where ct.curso_id=c.id and ct.ativo and l.status='ativa' and l.inicio_em<=now() and (l.expira_em is null or l.expira_em>now())
          )
          select jsonb_agg(jsonb_build_object(
            'user_id',al.user_id,'nome',al.nome,'turma',al.turma,
            'concluidas',(select count(*) from public.curso_parceiro_progresso pr join aulas_curso ac on ac.id=pr.aula_id where pr.user_id=al.user_id and pr.concluida),
            'total_aulas',(select count(*) from aulas_curso),
            'percentual',coalesce(round(100.0*(select count(*) from public.curso_parceiro_progresso pr join aulas_curso ac on ac.id=pr.aula_id where pr.user_id=al.user_id and pr.concluida)/nullif((select count(*) from aulas_curso),0),1),0)
          ) order by al.nome)
          from alunos al
        ),'[]'::jsonb)
      ) order by c.criado_em)
      from public.curso_parceiro_cursos c where c.parceiro_id=v_parceiro
    ), '[]'::jsonb)
  );
end
$function$;

create or replace function public.alterar_status_curso_parceiro(p_curso_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_curso public.curso_parceiro_cursos%rowtype;
  v_agora timestamptz := now();
begin
  if p_status not in ('rascunho','publicado','arquivado') then
    raise exception 'Status de curso inválido.';
  end if;

  select * into v_curso from public.curso_parceiro_cursos where id=p_curso_id;
  if not found then raise exception 'Curso não encontrado.'; end if;
  if not (public.sou_admin() or private.sou_gestor_parceiro(v_curso.parceiro_id)) then
    raise exception 'Sem permissão para alterar este curso.';
  end if;

  if p_status = 'publicado' then
    if not exists (
      select 1
      from public.curso_parceiro_aulas a
      join public.curso_parceiro_modulos m on m.id=a.modulo_id and m.ativo
      join public.curso_parceiro_disciplinas d on d.id=m.disciplina_id and d.ativo
      where d.curso_id=p_curso_id and a.ativo
    ) then
      raise exception 'Adicione ao menos uma aula ativa antes de publicar o curso.';
    end if;
    if exists (
      select 1
      from public.curso_parceiro_aulas a
      join public.curso_parceiro_modulos m on m.id=a.modulo_id and m.ativo
      join public.curso_parceiro_disciplinas d on d.id=m.disciplina_id and d.ativo
      where d.curso_id=p_curso_id and a.ativo
        and (a.url is null or a.url !~* '^https://')
    ) then
      raise exception 'Todas as aulas ativas precisam ter um link HTTPS válido antes da publicação.';
    end if;
  end if;

  update public.curso_parceiro_cursos
  set status=p_status,
      ativo=(p_status <> 'arquivado'),
      publicado_em=case when p_status='publicado' then coalesce(publicado_em,v_agora) else publicado_em end,
      arquivado_em=case when p_status='arquivado' then v_agora when p_status='rascunho' then null else arquivado_em end,
      atualizado_em=v_agora
  where id=p_curso_id;

  return jsonb_build_object('id',p_curso_id,'status',p_status);
end
$function$;

create or replace function public.duplicar_curso_parceiro(p_curso_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_origem public.curso_parceiro_cursos%rowtype;
  v_novo_curso uuid;
  v_nova_disciplina uuid;
  v_novo_modulo uuid;
  r_d record;
  r_m record;
  r_a record;
  v_user uuid := auth.uid();
begin
  select * into v_origem from public.curso_parceiro_cursos where id=p_curso_id;
  if not found then raise exception 'Curso não encontrado.'; end if;
  if not (public.sou_admin() or private.sou_gestor_parceiro(v_origem.parceiro_id)) then
    raise exception 'Sem permissão para duplicar este curso.';
  end if;
  if v_user is null then raise exception 'Usuário não autenticado.'; end if;

  insert into public.curso_parceiro_cursos(parceiro_id,nome,descricao,ativo,status,criado_por)
  values(v_origem.parceiro_id, v_origem.nome || ' (cópia)', v_origem.descricao, true, 'rascunho', v_user)
  returning id into v_novo_curso;

  for r_d in select * from public.curso_parceiro_disciplinas where curso_id=p_curso_id order by ordem,criado_em loop
    insert into public.curso_parceiro_disciplinas(curso_id,titulo,descricao,ordem,ativo)
    values(v_novo_curso,r_d.titulo,r_d.descricao,r_d.ordem,r_d.ativo)
    returning id into v_nova_disciplina;

    for r_m in select * from public.curso_parceiro_modulos where disciplina_id=r_d.id order by ordem,criado_em loop
      insert into public.curso_parceiro_modulos(parceiro_id,disciplina_id,titulo,descricao,ordem,ativo,criado_por)
      values(v_origem.parceiro_id,v_nova_disciplina,r_m.titulo,r_m.descricao,r_m.ordem,r_m.ativo,v_user)
      returning id into v_novo_modulo;

      for r_a in select * from public.curso_parceiro_aulas where modulo_id=r_m.id order by ordem,criado_em loop
        insert into public.curso_parceiro_aulas(modulo_id,titulo,descricao,tipo,url,duracao_minutos,ordem,ativo)
        values(v_novo_modulo,r_a.titulo,r_a.descricao,r_a.tipo,r_a.url,r_a.duracao_minutos,r_a.ordem,r_a.ativo);
      end loop;
    end loop;
  end loop;

  return v_novo_curso;
end
$function$;

create or replace function private.proteger_exclusao_estrutura_curso()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_curso_id uuid;
  v_status text;
  v_tem_progresso boolean := false;
begin
  if tg_table_name = 'curso_parceiro_cursos' then
    v_curso_id := old.id;
    select exists(
      select 1 from public.curso_parceiro_progresso pr
      join public.curso_parceiro_aulas a on a.id=pr.aula_id
      join public.curso_parceiro_modulos m on m.id=a.modulo_id
      join public.curso_parceiro_disciplinas d on d.id=m.disciplina_id
      where d.curso_id=old.id
    ) into v_tem_progresso;
  elsif tg_table_name = 'curso_parceiro_disciplinas' then
    v_curso_id := old.curso_id;
    select exists(
      select 1 from public.curso_parceiro_progresso pr
      join public.curso_parceiro_aulas a on a.id=pr.aula_id
      join public.curso_parceiro_modulos m on m.id=a.modulo_id
      where m.disciplina_id=old.id
    ) into v_tem_progresso;
  elsif tg_table_name = 'curso_parceiro_modulos' then
    select d.curso_id into v_curso_id from public.curso_parceiro_disciplinas d where d.id=old.disciplina_id;
    select exists(
      select 1 from public.curso_parceiro_progresso pr
      join public.curso_parceiro_aulas a on a.id=pr.aula_id
      where a.modulo_id=old.id
    ) into v_tem_progresso;
  elsif tg_table_name = 'curso_parceiro_aulas' then
    select d.curso_id into v_curso_id
    from public.curso_parceiro_modulos m
    join public.curso_parceiro_disciplinas d on d.id=m.disciplina_id
    where m.id=old.modulo_id;
    select exists(select 1 from public.curso_parceiro_progresso pr where pr.aula_id=old.id) into v_tem_progresso;
  end if;

  select c.status into v_status from public.curso_parceiro_cursos c where c.id=v_curso_id;

  if v_status = 'publicado' then
    raise exception 'Curso publicado: arquive ou pause o item em vez de excluir. O progresso dos alunos foi preservado.';
  end if;
  if v_tem_progresso then
    raise exception 'Este item possui progresso de alunos e não pode ser excluído. O progresso foi preservado.';
  end if;

  return old;
end
$function$;

drop trigger if exists proteger_exclusao_curso_parceiro on public.curso_parceiro_cursos;
create trigger proteger_exclusao_curso_parceiro
before delete on public.curso_parceiro_cursos
for each row execute function private.proteger_exclusao_estrutura_curso();

drop trigger if exists proteger_exclusao_disciplina_parceiro on public.curso_parceiro_disciplinas;
create trigger proteger_exclusao_disciplina_parceiro
before delete on public.curso_parceiro_disciplinas
for each row execute function private.proteger_exclusao_estrutura_curso();

drop trigger if exists proteger_exclusao_modulo_parceiro on public.curso_parceiro_modulos;
create trigger proteger_exclusao_modulo_parceiro
before delete on public.curso_parceiro_modulos
for each row execute function private.proteger_exclusao_estrutura_curso();

drop trigger if exists proteger_exclusao_aula_parceiro on public.curso_parceiro_aulas;
create trigger proteger_exclusao_aula_parceiro
before delete on public.curso_parceiro_aulas
for each row execute function private.proteger_exclusao_estrutura_curso();

revoke all on function public.alterar_status_curso_parceiro(uuid,text) from public;
grant execute on function public.alterar_status_curso_parceiro(uuid,text) to authenticated;
revoke all on function public.duplicar_curso_parceiro(uuid) from public;
grant execute on function public.duplicar_curso_parceiro(uuid) to authenticated;