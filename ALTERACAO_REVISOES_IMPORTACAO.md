# Migração inteligente de progresso e revisões

## Implementado

- Português continua como a única matéria com a trilha oficial do curso.
- Botão **Importar progresso** em Português.
- Importação por módulo + última aula já estudada.
- Todas as aulas anteriores são marcadas como concluídas sem criar novas revisões.
- Revisões pendentes geradas anteriormente para as aulas importadas são removidas.
- Cada aula de Português possui dois fluxos:
  - **Estudei agora**: conclui e cria ciclo de revisão 0-1-7-15.
  - **Já havia estudado**: conclui sem criar revisão.
- A origem da conclusão fica registrada como `estudo` ou `importado`.
- Dashboard mostra quantas aulas de Português foram importadas.
- A meta diária de revisões das Configurações também funciona como limite de distribuição da agenda.
- Página Revisões possui **Reorganizar agenda** para redistribuir pendências sem ultrapassar o limite diário.
- As outras matérias mantêm estrutura e conteúdo atuais.

## Observação de validação

A validação sintática/transpilação de todos os arquivos TypeScript/TSX foi executada com sucesso. O build completo não pôde ser executado neste ambiente porque o registry interno não disponibilizou uma dependência transitiva (`yargs-parser@21.1.1`) durante `npm ci`.
