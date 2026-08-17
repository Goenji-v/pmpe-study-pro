# Migração de Conteúdos — Etapa 3

Esta etapa integra a estrutura Matéria → Módulo → Assunto com:

- Central de Estudos;
- Plano de Estudos;
- Dashboard;
- Cronômetro e finalização de sessões;
- criação automática de revisões.

## Alterações principais

### Central de Estudos
- seleção em três níveis: matéria, módulo e assunto;
- sessão ativa armazena `materiaId`, `modulo`, `moduloId` e `assuntoId`;
- troca de matéria seleciona o primeiro módulo disponível;
- troca de módulo limpa o assunto anterior;
- sessões antigas sem módulo continuam válidas.

### Plano de Estudos
- missões localizam o assunto dentro dos módulos da matéria;
- ao iniciar uma missão, o módulo e os IDs são enviados ao cronômetro;
- ao concluir/desmarcar, a alteração é aplicada no módulo correto;
- missões antigas, que ainda não possuem módulo definido no plano, continuam funcionando por busca compatível.

### Dashboard
- progresso do edital é calculado pela árvore de módulos;
- iniciar a próxima missão usa o CronometroContext, em vez de gravar um estado paralelo no localStorage;
- a próxima missão leva matéria, módulo e assunto para a Central de Estudos.

### Cronômetro, sessões, questões e revisões
- novas sessões registram módulo e IDs;
- blocos de questões finalizados registram módulo;
- revisões novas recebem `moduloId` e nome do módulo;
- marcação de assunto concluído atualiza a árvore e o espelho legado.

## Compatibilidade

- dados antigos sem módulo continuam sendo tratados como módulo Geral;
- o campo `materia.assuntos` permanece temporariamente sincronizado;
- não há alteração SQL obrigatória nesta etapa;
- ranking, administração, autenticação, IA e simulados não foram alterados.

## Validação

A sintaxe dos arquivos TypeScript/TSX modificados foi validada. O build completo deve ser executado localmente:

```powershell
npm install
npm run build
npm run dev
```

Não publique no Vercel antes de testar os fluxos de Central de Estudos, Plano e Dashboard com uma conta existente.
