-- Curso do Professor: Curso -> Disciplina -> Módulo -> Aula/Material
-- Liberação por turma e progresso individual do aluno.

create table if not exists public.curso_parceiro_cursos (
  id uuid primary key default gen_random_uuid(),
  parceiro_id uuid not null references public.parceiros(id) on delete cascade,
  nome text not null check (length(trim(nome)) between 2 and 160),
  descricao text,
  ativo boolean not null default true,
  criado_por uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists curso_parceiro_cursos_parceiro_idx on public.curso_parceiro_cursos(parceiro_id, ativo);

create table if not exists public.curso_parceiro_disciplinas (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.curso_parceiro_cursos(id) on delete cascade,
  titulo text not null check (length(trim(titulo)) between 2 and 160),
  descricao text,
  ordem integer not null default 1 check (ordem >= 1),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists curso_parceiro_disciplinas_curso_idx on public.curso_parceiro_disciplinas(curso_id, ordem) where ativo;

alter table public.curso_parceiro_modulos
  add column if not exists disciplina_id uuid references public.curso_parceiro_disciplinas(id) on delete cascade;
create index if not exists curso_parceiro_modulos_disciplina_idx on public.curso_parceiro_modulos(disciplina_id, ordem) where ativo;

create table if not exists public.curso_parceiro_turmas (
  curso_id uuid not null references public.curso_parceiro_cursos(id) on delete cascade,
  turma_id uuid not null references public.turmas(id) on delete cascade,
  ativo boolean not null default true,
  liberado_em timestamptz not null default now(),
  criado_por uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  primary key (curso_id, turma_id)
);
create index if not exists curso_parceiro_turmas_turma_idx on public.curso_parceiro_turmas(turma_id, ativo);

create table if not exists public.curso_parceiro_progresso (
  aula_id uuid not null references public.curso_parceiro_aulas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  concluida boolean not null default false,
  concluida_em timestamptz,
  ultimo_acesso_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (aula_id, user_id)
);
create index if not exists curso_parceiro_progresso_user_idx on public.curso_parceiro_progresso(user_id, concluida);

create or replace function private.validar_curso_turma_mesmo_parceiro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_curso_parceiro uuid;
  v_turma_parceiro uuid;
begin
  select c.parceiro_id into v_curso_parceiro from public.curso_parceiro_cursos c where c.id = new.curso_id;
  select t.parceiro_id into v_turma_parceiro from public.turmas t where t.id = new.turma_id;
  if v_curso_parceiro is null or v_turma_parceiro is null or v_curso_parceiro <> v_turma_parceiro then
    raise exception 'Curso e turma precisam pertencer ao mesmo parceiro.';
  end if;
  return new;
end
$$;

drop trigger if exists validar_curso_turma_mesmo_parceiro on public.curso_parceiro_turmas;
create trigger validar_curso_turma_mesmo_parceiro
before insert or update on public.curso_parceiro_turmas
for each row execute function private.validar_curso_turma_mesmo_parceiro();

alter table public.curso_parceiro_cursos enable row level security;
alter table public.curso_parceiro_disciplinas enable row level security;
alter table public.curso_parceiro_modulos enable row level security;
alter table public.curso_parceiro_aulas enable row level security;
alter table public.curso_parceiro_turmas enable row level security;
alter table public.curso_parceiro_progresso enable row level security;

revoke all on public.curso_parceiro_cursos from anon, authenticated;
revoke all on public.curso_parceiro_disciplinas from anon, authenticated;
revoke all on public.curso_parceiro_modulos from anon, authenticated;
revoke all on public.curso_parceiro_aulas from anon, authenticated;
revoke all on public.curso_parceiro_turmas from anon, authenticated;
revoke all on public.curso_parceiro_progresso from anon, authenticated;
grant select, insert, update, delete on public.curso_parceiro_cursos to authenticated;
grant select, insert, update, delete on public.curso_parceiro_disciplinas to authenticated;
grant select, insert, update, delete on public.curso_parceiro_modulos to authenticated;
grant select, insert, update, delete on public.curso_parceiro_aulas to authenticated;
grant select, insert, update, delete on public.curso_parceiro_turmas to authenticated;
grant select, insert, update, delete on public.curso_parceiro_progresso to authenticated;
grant all on public.curso_parceiro_cursos, public.curso_parceiro_disciplinas, public.curso_parceiro_modulos, public.curso_parceiro_aulas, public.curso_parceiro_turmas, public.curso_parceiro_progresso to service_role;

-- CURSOS
 drop policy if exists curso_cursos_leitura on public.curso_parceiro_cursos;
create policy curso_cursos_leitura on public.curso_parceiro_cursos
for select to authenticated
using (
  public.sou_admin()
  or private.sou_gestor_parceiro(parceiro_id)
  or exists (
    select 1
    from public.curso_parceiro_turmas ct
    join public.licencas_acesso l on l.turma_id = ct.turma_id
    where ct.curso_id = curso_parceiro_cursos.id
      and ct.ativo
      and l.user_id = (select auth.uid())
      and l.parceiro_id = curso_parceiro_cursos.parceiro_id
      and l.status = 'ativa'
      and l.inicio_em <= now()
      and (l.expira_em is null or l.expira_em > now())
  )
);
drop policy if exists curso_cursos_gestao on public.curso_parceiro_cursos;
create policy curso_cursos_gestao on public.curso_parceiro_cursos
for all to authenticated
using (public.sou_admin() or private.sou_gestor_parceiro(parceiro_id))
with check (public.sou_admin() or private.sou_gestor_parceiro(parceiro_id));

-- DISCIPLINAS
 drop policy if exists curso_disciplinas_leitura on public.curso_parceiro_disciplinas;
create policy curso_disciplinas_leitura on public.curso_parceiro_disciplinas
for select to authenticated
using (
  exists (
    select 1 from public.curso_parceiro_cursos c
    where c.id = curso_parceiro_disciplinas.curso_id
      and (
        public.sou_admin()
        or private.sou_gestor_parceiro(c.parceiro_id)
        or exists (
          select 1 from public.curso_parceiro_turmas ct
          join public.licencas_acesso l on l.turma_id = ct.turma_id
          where ct.curso_id = c.id and ct.ativo
            and l.user_id = (select auth.uid()) and l.parceiro_id = c.parceiro_id
            and l.status = 'ativa' and l.inicio_em <= now()
            and (l.expira_em is null or l.expira_em > now())
        )
      )
  )
);
drop policy if exists curso_disciplinas_gestao on public.curso_parceiro_disciplinas;
create policy curso_disciplinas_gestao on public.curso_parceiro_disciplinas
for all to authenticated
using (exists (select 1 from public.curso_parceiro_cursos c where c.id=curso_id and (public.sou_admin() or private.sou_gestor_parceiro(c.parceiro_id))))
with check (exists (select 1 from public.curso_parceiro_cursos c where c.id=curso_id and (public.sou_admin() or private.sou_gestor_parceiro(c.parceiro_id))));

-- MÓDULOS
 drop policy if exists curso_modulos_gestao on public.curso_parceiro_modulos;
drop policy if exists curso_modulos_leitura on public.curso_parceiro_modulos;
create policy curso_modulos_leitura on public.curso_parceiro_modulos
for select to authenticated
using (
  (disciplina_id is not null and exists (
    select 1
    from public.curso_parceiro_disciplinas d
    join public.curso_parceiro_cursos c on c.id=d.curso_id
    where d.id=curso_parceiro_modulos.disciplina_id
      and (
        public.sou_admin()
        or private.sou_gestor_parceiro(c.parceiro_id)
        or exists (
          select 1 from public.curso_parceiro_turmas ct
          join public.licencas_acesso l on l.turma_id=ct.turma_id
          where ct.curso_id=c.id and ct.ativo
            and l.user_id=(select auth.uid()) and l.parceiro_id=c.parceiro_id
            and l.status='ativa' and l.inicio_em<=now()
            and (l.expira_em is null or l.expira_em>now())
        )
      )
  ))
  or (disciplina_id is null and (public.sou_admin() or private.sou_gestor_parceiro(parceiro_id)))
);
create policy curso_modulos_gestao on public.curso_parceiro_modulos
for all to authenticated
using (public.sou_admin() or private.sou_gestor_parceiro(parceiro_id))
with check (
  (public.sou_admin() or private.sou_gestor_parceiro(parceiro_id))
  and (disciplina_id is null or exists (
    select 1 from public.curso_parceiro_disciplinas d
    join public.curso_parceiro_cursos c on c.id=d.curso_id
    where d.id=disciplina_id and c.parceiro_id=curso_parceiro_modulos.parceiro_id
  ))
);

-- AULAS / MATERIAIS
 drop policy if exists curso_aulas_gestao on public.curso_parceiro_aulas;
drop policy if exists curso_aulas_leitura on public.curso_parceiro_aulas;
create policy curso_aulas_leitura on public.curso_parceiro_aulas
for select to authenticated
using (
  exists (
    select 1
    from public.curso_parceiro_modulos m
    join public.curso_parceiro_disciplinas d on d.id=m.disciplina_id
    join public.curso_parceiro_cursos c on c.id=d.curso_id
    where m.id=curso_parceiro_aulas.modulo_id
      and (
        public.sou_admin()
        or private.sou_gestor_parceiro(c.parceiro_id)
        or exists (
          select 1 from public.curso_parceiro_turmas ct
          join public.licencas_acesso l on l.turma_id=ct.turma_id
          where ct.curso_id=c.id and ct.ativo
            and l.user_id=(select auth.uid()) and l.parceiro_id=c.parceiro_id
            and l.status='ativa' and l.inicio_em<=now()
            and (l.expira_em is null or l.expira_em>now())
        )
      )
  )
);
create policy curso_aulas_gestao on public.curso_parceiro_aulas
for all to authenticated
using (
  exists (select 1 from public.curso_parceiro_modulos m where m.id=modulo_id and (public.sou_admin() or private.sou_gestor_parceiro(m.parceiro_id)))
)
with check (
  exists (select 1 from public.curso_parceiro_modulos m where m.id=modulo_id and (public.sou_admin() or private.sou_gestor_parceiro(m.parceiro_id)))
);

-- LIBERAÇÃO POR TURMA
 drop policy if exists curso_turmas_leitura on public.curso_parceiro_turmas;
create policy curso_turmas_leitura on public.curso_parceiro_turmas
for select to authenticated
using (
  exists (select 1 from public.curso_parceiro_cursos c where c.id=curso_id and (public.sou_admin() or private.sou_gestor_parceiro(c.parceiro_id)))
  or exists (
    select 1 from public.licencas_acesso l
    where l.turma_id=curso_parceiro_turmas.turma_id
      and l.user_id=(select auth.uid()) and l.status='ativa'
      and l.inicio_em<=now() and (l.expira_em is null or l.expira_em>now())
  )
);
drop policy if exists curso_turmas_gestao on public.curso_parceiro_turmas;
create policy curso_turmas_gestao on public.curso_parceiro_turmas
for all to authenticated
using (exists (select 1 from public.curso_parceiro_cursos c where c.id=curso_id and (public.sou_admin() or private.sou_gestor_parceiro(c.parceiro_id))))
with check (exists (select 1 from public.curso_parceiro_cursos c where c.id=curso_id and (public.sou_admin() or private.sou_gestor_parceiro(c.parceiro_id))));

-- PROGRESSO
 drop policy if exists curso_progresso_leitura on public.curso_parceiro_progresso;
create policy curso_progresso_leitura on public.curso_parceiro_progresso
for select to authenticated
using (
  user_id=(select auth.uid())
  or exists (
    select 1
    from public.curso_parceiro_aulas a
    join public.curso_parceiro_modulos m on m.id=a.modulo_id
    join public.curso_parceiro_disciplinas d on d.id=m.disciplina_id
    join public.curso_parceiro_cursos c on c.id=d.curso_id
    where a.id=curso_parceiro_progresso.aula_id
      and (public.sou_admin() or private.sou_gestor_parceiro(c.parceiro_id))
  )
);
drop policy if exists curso_progresso_inserir on public.curso_parceiro_progresso;
create policy curso_progresso_inserir on public.curso_parceiro_progresso
for insert to authenticated
with check (
  user_id=(select auth.uid())
  and exists (
    select 1
    from public.curso_parceiro_aulas a
    join public.curso_parceiro_modulos m on m.id=a.modulo_id
    join public.curso_parceiro_disciplinas d on d.id=m.disciplina_id
    join public.curso_parceiro_cursos c on c.id=d.curso_id
    join public.curso_parceiro_turmas ct on ct.curso_id=c.id and ct.ativo
    join public.licencas_acesso l on l.turma_id=ct.turma_id and l.parceiro_id=c.parceiro_id
    where a.id=curso_parceiro_progresso.aula_id
      and l.user_id=(select auth.uid()) and l.status='ativa'
      and l.inicio_em<=now() and (l.expira_em is null or l.expira_em>now())
  )
);
drop policy if exists curso_progresso_atualizar on public.curso_parceiro_progresso;
create policy curso_progresso_atualizar on public.curso_parceiro_progresso
for update to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()));
drop policy if exists curso_progresso_excluir on public.curso_parceiro_progresso;
create policy curso_progresso_excluir on public.curso_parceiro_progresso
for delete to authenticated
using (user_id=(select auth.uid()));

create or replace function public.meus_cursos_mentoria()
returns jsonb
language sql
stable
security invoker
set search_path=public
as $$
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
  where c.ativo
    and exists (
      select 1
      from public.curso_parceiro_turmas ct
      join public.licencas_acesso l on l.turma_id=ct.turma_id
      where ct.curso_id=c.id and ct.ativo
        and l.user_id=(select auth.uid()) and l.parceiro_id=c.parceiro_id
        and l.status='ativa' and l.inicio_em<=now()
        and (l.expira_em is null or l.expira_em>now())
    )
$$;
revoke all on function public.meus_cursos_mentoria() from public, anon;
grant execute on function public.meus_cursos_mentoria() to authenticated;

create or replace function public.painel_cursos_meu_parceiro()
returns jsonb
language plpgsql
stable
security invoker
set search_path=public
as $$
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
$$;
revoke all on function public.painel_cursos_meu_parceiro() from public, anon;
grant execute on function public.painel_cursos_meu_parceiro() to authenticated;
