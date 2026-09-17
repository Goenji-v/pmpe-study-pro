-- O modelo atual de parceria não usa mentoria individual, trilhas ou cronograma
-- imposto pelo parceiro. Preservamos funções e dados para histórico/rollback,
-- mas retiramos esses fluxos da API disponível aos usuários autenticados.
-- O RPC meus_cursos_mentoria() NÃO é alterado: apesar do nome legado, ele
-- continua sendo a API ativa que entrega o curso do parceiro ao aluno.

revoke execute on function public.atualizar_status_tarefa_mentoria(uuid, text) from public, anon, authenticated;
revoke execute on function public.concluir_acompanhamento_aluno_parceiro(uuid) from public, anon, authenticated;
revoke execute on function public.criar_acompanhamento_aluno_parceiro(uuid, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.criar_reforco_mentoria(uuid, uuid, text, integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.listar_acompanhamentos_aluno_parceiro(uuid) from public, anon, authenticated;
revoke execute on function public.listar_trilhas_meu_parceiro() from public, anon, authenticated;
revoke execute on function public.minha_trilha_mentoria() from public, anon, authenticated;
revoke execute on function public.painel_aluno_meu_parceiro(uuid) from public, anon, authenticated;
revoke execute on function public.painel_cronograma_aluno_meu_parceiro(uuid) from public, anon, authenticated;
revoke execute on function public.personalizar_meu_cronograma_mentoria(date, integer) from public, anon, authenticated;
revoke execute on function public.recalcular_meu_cronograma_mentoria(date, integer, text) from public, anon, authenticated;
revoke execute on function public.salvar_trilha_mentoria(uuid, text, integer, integer, integer, integer, integer[], integer, integer, jsonb) from public, anon, authenticated;
revoke execute on function public.voltar_meu_cronograma_para_turma(date, integer) from public, anon, authenticated;

-- Mantém acesso administrativo de backend para suporte, auditoria e eventual
-- migração dos dados históricos sem reabrir os endpoints ao cliente.
grant execute on function public.atualizar_status_tarefa_mentoria(uuid, text) to service_role;
grant execute on function public.concluir_acompanhamento_aluno_parceiro(uuid) to service_role;
grant execute on function public.criar_acompanhamento_aluno_parceiro(uuid, text, text, boolean) to service_role;
grant execute on function public.criar_reforco_mentoria(uuid, uuid, text, integer, integer, integer) to service_role;
grant execute on function public.listar_acompanhamentos_aluno_parceiro(uuid) to service_role;
grant execute on function public.listar_trilhas_meu_parceiro() to service_role;
grant execute on function public.minha_trilha_mentoria() to service_role;
grant execute on function public.painel_aluno_meu_parceiro(uuid) to service_role;
grant execute on function public.painel_cronograma_aluno_meu_parceiro(uuid) to service_role;
grant execute on function public.personalizar_meu_cronograma_mentoria(date, integer) to service_role;
grant execute on function public.recalcular_meu_cronograma_mentoria(date, integer, text) to service_role;
grant execute on function public.salvar_trilha_mentoria(uuid, text, integer, integer, integer, integer, integer[], integer, integer, jsonb) to service_role;
grant execute on function public.voltar_meu_cronograma_para_turma(date, integer) to service_role;
