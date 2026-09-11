-- Ajustes do Curso do Professor após advisor de performance.
create index if not exists curso_parceiro_cursos_criado_por_idx on public.curso_parceiro_cursos(criado_por);
create index if not exists curso_parceiro_turmas_criado_por_idx on public.curso_parceiro_turmas(criado_por);

-- Cursos: separar gestão de SELECT para não duplicar políticas permissivas.
drop policy if exists curso_cursos_gestao on public.curso_parceiro_cursos;
drop policy if exists curso_cursos_inserir on public.curso_parceiro_cursos;
create policy curso_cursos_inserir on public.curso_parceiro_cursos for insert to authenticated
with check (public.sou_admin() or private.sou_gestor_parceiro(parceiro_id));
drop policy if exists curso_cursos_atualizar on public.curso_parceiro_cursos;
create policy curso_cursos_atualizar on public.curso_parceiro_cursos for update to authenticated
using (public.sou_admin() or private.sou_gestor_parceiro(parceiro_id))
with check (public.sou_admin() or private.sou_gestor_parceiro(parceiro_id));
drop policy if exists curso_cursos_excluir on public.curso_parceiro_cursos;
create policy curso_cursos_excluir on public.curso_parceiro_cursos for delete to authenticated
using (public.sou_admin() or private.sou_gestor_parceiro(parceiro_id));

-- Disciplinas.
drop policy if exists curso_disciplinas_gestao on public.curso_parceiro_disciplinas;
drop policy if exists curso_disciplinas_inserir on public.curso_parceiro_disciplinas;
create policy curso_disciplinas_inserir on public.curso_parceiro_disciplinas for insert to authenticated
with check (exists (select 1 from public.curso_parceiro_cursos c where c.id=curso_id and (public.sou_admin() or private.sou_gestor_parceiro(c.parceiro_id))));
drop policy if exists curso_disciplinas_atualizar on public.curso_parceiro_disciplinas;
create policy curso_disciplinas_atualizar on public.curso_parceiro_disciplinas for update to authenticated
using (exists (select 1 from public.curso_parceiro_cursos c where c.id=curso_id and (public.sou_admin() or private.sou_gestor_parceiro(c.parceiro_id))))
with check (exists (select 1 from public.curso_parceiro_cursos c where c.id=curso_id and (public.sou_admin() or private.sou_gestor_parceiro(c.parceiro_id))));
drop policy if exists curso_disciplinas_excluir on public.curso_parceiro_disciplinas;
create policy curso_disciplinas_excluir on public.curso_parceiro_disciplinas for delete to authenticated
using (exists (select 1 from public.curso_parceiro_cursos c where c.id=curso_id and (public.sou_admin() or private.sou_gestor_parceiro(c.parceiro_id))));

-- Módulos.
drop policy if exists curso_modulos_gestao on public.curso_parceiro_modulos;
drop policy if exists curso_modulos_inserir on public.curso_parceiro_modulos;
create policy curso_modulos_inserir on public.curso_parceiro_modulos for insert to authenticated
with check (
  (public.sou_admin() or private.sou_gestor_parceiro(parceiro_id))
  and (disciplina_id is null or exists (
    select 1 from public.curso_parceiro_disciplinas d join public.curso_parceiro_cursos c on c.id=d.curso_id
    where d.id=disciplina_id and c.parceiro_id=curso_parceiro_modulos.parceiro_id
  ))
);
drop policy if exists curso_modulos_atualizar on public.curso_parceiro_modulos;
create policy curso_modulos_atualizar on public.curso_parceiro_modulos for update to authenticated
using (public.sou_admin() or private.sou_gestor_parceiro(parceiro_id))
with check (
  (public.sou_admin() or private.sou_gestor_parceiro(parceiro_id))
  and (disciplina_id is null or exists (
    select 1 from public.curso_parceiro_disciplinas d join public.curso_parceiro_cursos c on c.id=d.curso_id
    where d.id=disciplina_id and c.parceiro_id=curso_parceiro_modulos.parceiro_id
  ))
);
drop policy if exists curso_modulos_excluir on public.curso_parceiro_modulos;
create policy curso_modulos_excluir on public.curso_parceiro_modulos for delete to authenticated
using (public.sou_admin() or private.sou_gestor_parceiro(parceiro_id));

-- Aulas e materiais.
drop policy if exists curso_aulas_gestao on public.curso_parceiro_aulas;
drop policy if exists curso_aulas_inserir on public.curso_parceiro_aulas;
create policy curso_aulas_inserir on public.curso_parceiro_aulas for insert to authenticated
with check (exists (select 1 from public.curso_parceiro_modulos m where m.id=modulo_id and (public.sou_admin() or private.sou_gestor_parceiro(m.parceiro_id))));
drop policy if exists curso_aulas_atualizar on public.curso_parceiro_aulas;
create policy curso_aulas_atualizar on public.curso_parceiro_aulas for update to authenticated
using (exists (select 1 from public.curso_parceiro_modulos m where m.id=modulo_id and (public.sou_admin() or private.sou_gestor_parceiro(m.parceiro_id))))
with check (exists (select 1 from public.curso_parceiro_modulos m where m.id=modulo_id and (public.sou_admin() or private.sou_gestor_parceiro(m.parceiro_id))));
drop policy if exists curso_aulas_excluir on public.curso_parceiro_aulas;
create policy curso_aulas_excluir on public.curso_parceiro_aulas for delete to authenticated
using (exists (select 1 from public.curso_parceiro_modulos m where m.id=modulo_id and (public.sou_admin() or private.sou_gestor_parceiro(m.parceiro_id))));

-- Liberações por turma.
drop policy if exists curso_turmas_gestao on public.curso_parceiro_turmas;
drop policy if exists curso_turmas_inserir on public.curso_parceiro_turmas;
create policy curso_turmas_inserir on public.curso_parceiro_turmas for insert to authenticated
with check (exists (select 1 from public.curso_parceiro_cursos c where c.id=curso_id and (public.sou_admin() or private.sou_gestor_parceiro(c.parceiro_id))));
drop policy if exists curso_turmas_atualizar on public.curso_parceiro_turmas;
create policy curso_turmas_atualizar on public.curso_parceiro_turmas for update to authenticated
using (exists (select 1 from public.curso_parceiro_cursos c where c.id=curso_id and (public.sou_admin() or private.sou_gestor_parceiro(c.parceiro_id))))
with check (exists (select 1 from public.curso_parceiro_cursos c where c.id=curso_id and (public.sou_admin() or private.sou_gestor_parceiro(c.parceiro_id))));
drop policy if exists curso_turmas_excluir on public.curso_parceiro_turmas;
create policy curso_turmas_excluir on public.curso_parceiro_turmas for delete to authenticated
using (exists (select 1 from public.curso_parceiro_cursos c where c.id=curso_id and (public.sou_admin() or private.sou_gestor_parceiro(c.parceiro_id))));
