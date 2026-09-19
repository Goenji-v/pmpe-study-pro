drop policy if exists curso_progresso_leitura
  on public.curso_parceiro_progresso;

create policy curso_progresso_leitura
on public.curso_parceiro_progresso
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.sou_admin()
);

revoke execute on function public.listar_alunos_meu_parceiro()
  from authenticated;
revoke execute on function public.listar_alunos_meu_parceiro_v2()
  from authenticated;
revoke execute on function public.listar_alunos_meu_parceiro_v3()
  from authenticated;
revoke execute on function public.listar_ranking_turma_parceiro(uuid, uuid, text)
  from authenticated;
revoke execute on function public.mover_aluno_entre_turmas_meu_parceiro(uuid, uuid)
  from authenticated;
