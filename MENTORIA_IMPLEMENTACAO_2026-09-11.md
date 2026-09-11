# Mentoria — implementação 2026-09-11

Esta branch transforma a área de parceiro em uma plataforma de mentoria orientada por trilha e cronograma personalizado.

## Entregas

- RLS de cursos/turmas sem recursão indireta.
- RLS de disciplinas, módulos, aulas e progresso com helpers privados.
- Trilhas enriquecidas com duração, questões, prioridade e estratégia de revisão.
- Disponibilidade semanal por aluno.
- Preferências individuais de cronograma.
- Motor determinístico de cronograma com preservação de histórico.
- Reforço de assunto pelo professor.
- Revisões automáticas ao concluir conteúdo.
- Painel individual do aluno para o mentor.
- Cronograma de mentoria no fluxo do aluno.
- Fallback para o Cronograma IA legado quando não existir mentoria ativa.
- Auditoria e histórico de recálculos.

## Segurança

Ações privilegiadas usam RPCs validadas. Tabelas públicas novas têm RLS e grants explícitos. Tarefas, auditoria e histórico de recálculo não recebem escrita direta de usuários autenticados.

## Compatibilidade

O fluxo antigo continua disponível para contas sem trilha de mentoria. Nenhum histórico acadêmico foi removido durante a implantação.
