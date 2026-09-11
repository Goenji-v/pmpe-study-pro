-- Ajustes de performance da evolução de mentoria.

create index if not exists reforcos_mentoria_item_idx
  on public.reforcos_mentoria(item_id);

create index if not exists reforcos_mentoria_turma_idx
  on public.reforcos_mentoria(turma_id);

drop policy if exists reforcos_mentoria_atualizar_aluno on public.reforcos_mentoria;
drop policy if exists reforcos_mentoria_atualizar_gestor on public.reforcos_mentoria;
drop policy if exists reforcos_mentoria_atualizar on public.reforcos_mentoria;

create policy reforcos_mentoria_atualizar
on public.reforcos_mentoria
for update
to authenticated
using (
  (user_id = (select auth.uid()) and status = 'pendente')
  or public.sou_admin()
  or private.sou_gestor_parceiro(parceiro_id)
)
with check (
  (user_id = (select auth.uid()) and status = 'concluido')
  or public.sou_admin()
  or private.sou_gestor_parceiro(parceiro_id)
);
