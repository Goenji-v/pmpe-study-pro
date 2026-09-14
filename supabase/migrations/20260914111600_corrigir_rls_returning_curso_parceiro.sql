drop policy if exists curso_cursos_leitura on public.curso_parceiro_cursos;
create policy curso_cursos_leitura
on public.curso_parceiro_cursos
for select
to authenticated
using (
  public.sou_admin()
  or private.sou_gestor_parceiro(parceiro_id)
  or private.pode_ler_curso(id)
);

drop policy if exists curso_disciplinas_leitura on public.curso_parceiro_disciplinas;
create policy curso_disciplinas_leitura
on public.curso_parceiro_disciplinas
for select
to authenticated
using (
  private.sou_gestor_curso(curso_id)
  or private.pode_ler_disciplina(id)
);

drop policy if exists curso_modulos_leitura on public.curso_parceiro_modulos;
create policy curso_modulos_leitura
on public.curso_parceiro_modulos
for select
to authenticated
using (
  public.sou_admin()
  or private.sou_gestor_parceiro(parceiro_id)
  or private.pode_ler_modulo(id)
);

drop policy if exists curso_aulas_leitura on public.curso_parceiro_aulas;
create policy curso_aulas_leitura
on public.curso_parceiro_aulas
for select
to authenticated
using (
  private.sou_gestor_modulo(modulo_id)
  or private.pode_ler_aula(id)
);
