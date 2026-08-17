# Migração de Conteúdos — Etapa 2

Implementada a interface Matéria → Módulo → Assunto na página Conteúdos.

Inclui:
- criação de módulos;
- edição/renomeação de módulos;
- exclusão segura de módulo vazio;
- criação de assunto dentro de módulo;
- movimentação de assuntos entre módulos;
- progresso por módulo e por matéria;
- pesquisa por matéria, módulo ou assunto;
- manutenção do espelho legado `materia.assuntos` para compatibilidade temporária;
- preservação do editor de resumo, anotações e materiais.

Validação local do pacote:
O build não pôde completar neste ambiente porque as dependências instaladas não incluem as definições `vite/client` e `node`. Rode `npm install` e `npm run build` no projeto local antes de publicar.
