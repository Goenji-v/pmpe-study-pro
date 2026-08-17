# Migração de Conteúdos — Etapa 4

Esta etapa adapta Revisões e Centro de Materiais à estrutura:

Matéria → Módulo → Assunto → Materiais

## Revisões
- novas revisões continuam preservando `modulo` e `moduloId`;
- revisões antigas sem módulo são associadas ao módulo correto quando o assunto é localizado;
- quando não for possível localizar, o fallback exibido é `Geral`;
- a tela passa a mostrar o módulo entre a matéria e o assunto;
- o ciclo de próximas revisões preserva os dados do módulo.

## Centro de Materiais
- cadastro passa a exigir Matéria, Módulo e Assunto;
- filtros passam a aceitar Matéria e Módulo;
- biblioteca passa a agrupar por Matéria → Módulo → Assunto;
- materiais antigos aparecem no módulo `Geral`;
- IDs e nome do módulo são armazenados dentro da coluna JSON `dados`, mantendo compatibilidade com a tabela existente;
- não há SQL obrigatório nesta etapa.

## Compatibilidade
- não remove colunas antigas;
- materiais antigos continuam abrindo;
- revisões antigas continuam aparecendo;
- nenhuma mudança em autenticação, ranking, IA ou administração.

## Validação local
No computador, execute:

npm install
npm run build
npm run dev

O build não pôde ser concluído no ambiente de geração porque o registro interno do NPM não disponibilizou uma dependência. O TypeScript global também não encontrou os tipos locais `vite/client` e `node`, que são instalados normalmente pelo `npm install` no seu computador.
