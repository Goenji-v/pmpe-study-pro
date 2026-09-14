-- Mantem a auditoria restrita, mas inclui os eventos ja usados pelas
-- funcoes atuais de gestao do parceiro. Sem estes valores, operacoes como
-- revogar/reativar convite falham depois de atualizar o registro principal.

alter table public.auditoria_acesso
  drop constraint if exists auditoria_acesso_evento_check;

alter table public.auditoria_acesso
  add constraint auditoria_acesso_evento_check
  check (evento in (
    'parceiro_criado',
    'turma_criada',
    'turma_atualizada',
    'convite_criado',
    'convite_revogado',
    'convite_reativado',
    'solicitacao_criada',
    'solicitacao_aprovada',
    'solicitacao_recusada',
    'licenca_criada',
    'licenca_ativada',
    'licenca_suspensa',
    'licenca_cancelada',
    'licenca_expirada',
    'papel_alterado',
    'parceiro_usuario_autorizado',
    'parceiro_usuario_desativado',
    'aluno_movido_turma',
    'faturamento_fechado'
  ));
