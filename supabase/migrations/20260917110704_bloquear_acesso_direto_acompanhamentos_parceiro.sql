drop policy if exists acompanhamentos_parceiro_aluno_bloqueio_direto on public.acompanhamentos_parceiro_aluno;

create policy acompanhamentos_parceiro_aluno_bloqueio_direto
on public.acompanhamentos_parceiro_aluno
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

comment on policy acompanhamentos_parceiro_aluno_bloqueio_direto
on public.acompanhamentos_parceiro_aluno
is 'Bloqueia acesso direto via API para anon/authenticated. Operacoes autorizadas continuam exclusivamente pelos RPCs SECURITY DEFINER que validam o vinculo do parceiro.';
