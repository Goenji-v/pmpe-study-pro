-- Correção de RLS do módulo de cursos/parcerias.
-- Objetivo: eliminar recursão indireta entre curso_parceiro_cursos e curso_parceiro_turmas
-- e centralizar autorização em helpers privados SECURITY DEFINER.
-- Aplicado no Supabase em 2026-09-11.

create or replace function private.pode_ler_curso(p_curso_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select exists(
    select 1 from public.curso_parceiro_cursos c
    where c.id=p_curso_id and (
      public.sou_admin()
      or private.sou_gestor_parceiro(c.parceiro_id)
      or exists(
        select 1 from public.curso_parceiro_turmas ct
        join public.licencas_acesso l on l.turma_id=ct.turma_id
        where ct.curso_id=c.id and ct.ativo and l.user_id=(select auth.uid())
          and l.parceiro_id=c.parceiro_id and l.status='ativa' and l.inicio_em<=now()
          and (l.expira_em is null or l.expira_em>now())
      )
    )
  )
$$;

create or replace function private.sou_gestor_curso(p_curso_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select exists(select 1 from public.curso_parceiro_cursos c where c.id=p_curso_id and (public.sou_admin() or private.sou_gestor_parceiro(c.parceiro_id)))
$$;

create or replace function private.pode_ler_disciplina(p_disciplina_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select exists(select 1 from public.curso_parceiro_disciplinas d where d.id=p_disciplina_id and private.pode_ler_curso(d.curso_id))
$$;

create or replace function private.sou_gestor_disciplina(p_disciplina_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select exists(select 1 from public.curso_parceiro_disciplinas d where d.id=p_disciplina_id and private.sou_gestor_curso(d.curso_id))
$$;

create or replace function private.disciplina_pertence_parceiro(p_disciplina_id uuid,p_parceiro_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select exists(select 1 from public.curso_parceiro_disciplinas d join public.curso_parceiro_cursos c on c.id=d.curso_id where d.id=p_disciplina_id and c.parceiro_id=p_parceiro_id)
$$;

create or replace function private.pode_ler_modulo(p_modulo_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select exists(
    select 1 from public.curso_parceiro_modulos m
    left join public.curso_parceiro_disciplinas d on d.id=m.disciplina_id
    where m.id=p_modulo_id and (
      public.sou_admin() or private.sou_gestor_parceiro(m.parceiro_id)
      or (m.disciplina_id is not null and private.pode_ler_disciplina(d.id))
    )
  )
$$;

create or replace function private.sou_gestor_modulo(p_modulo_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select exists(select 1 from public.curso_parceiro_modulos m where m.id=p_modulo_id and (public.sou_admin() or private.sou_gestor_parceiro(m.parceiro_id)))
$$;

create or replace function private.pode_ler_aula(p_aula_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select exists(select 1 from public.curso_parceiro_aulas a where a.id=p_aula_id and private.pode_ler_modulo(a.modulo_id))
$$;

create or replace function private.sou_gestor_aula(p_aula_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
  select exists(select 1 from public.curso_parceiro_aulas a where a.id=p_aula_id and private.sou_gestor_modulo(a.modulo_id))
$$;

revoke all on function private.pode_ler_curso(uuid) from public,anon;
revoke all on function private.sou_gestor_curso(uuid) from public,anon;
revoke all on function private.pode_ler_disciplina(uuid) from public,anon;
revoke all on function private.sou_gestor_disciplina(uuid) from public,anon;
revoke all on function private.disciplina_pertence_parceiro(uuid,uuid) from public,anon;
revoke all on function private.pode_ler_modulo(uuid) from public,anon;
revoke all on function private.sou_gestor_modulo(uuid) from public,anon;
revoke all on function private.pode_ler_aula(uuid) from public,anon;
revoke all on function private.sou_gestor_aula(uuid) from public,anon;
grant execute on function private.pode_ler_curso(uuid),private.sou_gestor_curso(uuid),private.pode_ler_disciplina(uuid),private.sou_gestor_disciplina(uuid),private.disciplina_pertence_parceiro(uuid,uuid),private.pode_ler_modulo(uuid),private.sou_gestor_modulo(uuid),private.pode_ler_aula(uuid),private.sou_gestor_aula(uuid) to authenticated;

-- Policies centrais. As tabelas filhas deixam de consultar cadeias de tabelas protegidas diretamente.
drop policy if exists curso_cursos_leitura on public.curso_parceiro_cursos;
create policy curso_cursos_leitura on public.curso_parceiro_cursos for select to authenticated using(private.pode_ler_curso(id));

drop policy if exists curso_turmas_leitura on public.curso_parceiro_turmas;
create policy curso_turmas_leitura on public.curso_parceiro_turmas for select to authenticated using(private.pode_ler_curso(curso_id));
drop policy if exists curso_turmas_inserir on public.curso_parceiro_turmas;
create policy curso_turmas_inserir on public.curso_parceiro_turmas for insert to authenticated with check(private.sou_gestor_curso(curso_id));
drop policy if exists curso_turmas_atualizar on public.curso_parceiro_turmas;
create policy curso_turmas_atualizar on public.curso_parceiro_turmas for update to authenticated using(private.sou_gestor_curso(curso_id)) with check(private.sou_gestor_curso(curso_id));
drop policy if exists curso_turmas_excluir on public.curso_parceiro_turmas;
create policy curso_turmas_excluir on public.curso_parceiro_turmas for delete to authenticated using(private.sou_gestor_curso(curso_id));

drop policy if exists curso_disciplinas_leitura on public.curso_parceiro_disciplinas;
create policy curso_disciplinas_leitura on public.curso_parceiro_disciplinas for select to authenticated using(private.pode_ler_disciplina(id));
drop policy if exists curso_disciplinas_inserir on public.curso_parceiro_disciplinas;
create policy curso_disciplinas_inserir on public.curso_parceiro_disciplinas for insert to authenticated with check(private.sou_gestor_curso(curso_id));
drop policy if exists curso_disciplinas_atualizar on public.curso_parceiro_disciplinas;
create policy curso_disciplinas_atualizar on public.curso_parceiro_disciplinas for update to authenticated using(private.sou_gestor_disciplina(id)) with check(private.sou_gestor_curso(curso_id));
drop policy if exists curso_disciplinas_excluir on public.curso_parceiro_disciplinas;
create policy curso_disciplinas_excluir on public.curso_parceiro_disciplinas for delete to authenticated using(private.sou_gestor_disciplina(id));

drop policy if exists curso_modulos_leitura on public.curso_parceiro_modulos;
create policy curso_modulos_leitura on public.curso_parceiro_modulos for select to authenticated using(private.pode_ler_modulo(id));
drop policy if exists curso_aulas_leitura on public.curso_parceiro_aulas;
create policy curso_aulas_leitura on public.curso_parceiro_aulas for select to authenticated using(private.pode_ler_aula(id));

drop policy if exists curso_progresso_leitura on public.curso_parceiro_progresso;
create policy curso_progresso_leitura on public.curso_parceiro_progresso for select to authenticated using(user_id=(select auth.uid()) or private.sou_gestor_aula(aula_id));
drop policy if exists curso_progresso_inserir on public.curso_parceiro_progresso;
create policy curso_progresso_inserir on public.curso_parceiro_progresso for insert to authenticated with check(user_id=(select auth.uid()) and private.pode_ler_aula(aula_id));
drop policy if exists curso_progresso_atualizar on public.curso_parceiro_progresso;
create policy curso_progresso_atualizar on public.curso_parceiro_progresso for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and private.pode_ler_aula(aula_id));
drop policy if exists curso_progresso_excluir on public.curso_parceiro_progresso;
create policy curso_progresso_excluir on public.curso_parceiro_progresso for delete to authenticated using(user_id=(select auth.uid()));
