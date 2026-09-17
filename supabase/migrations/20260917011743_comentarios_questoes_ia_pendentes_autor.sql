drop policy if exists questao_comentarios_inserir_proprio on public.questao_comentarios;

create policy questao_comentarios_inserir_proprio
on public.questao_comentarios
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'visivel'
  and exists (
    select 1
    from public.questoes_catalogo q
    where q.id = questao_comentarios.questao_id
      and (
        q.status = 'ativa'
        or (
          q.status = 'pendente'
          and q.criado_por = (select auth.uid())
        )
      )
  )
);
