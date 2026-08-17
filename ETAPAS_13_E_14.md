# Etapas 13 e 14 — Conteúdos canônicos e ligação com o Plano

## Etapa 13 — Limpeza e migração de Conteúdos

- A árvore de Conteúdos passa a ser alimentada somente por missões do tipo `conteudo`.
- Missões de `revisao`, `redacao`, `questoes` e `livre` continuam no Plano/Revisões, mas não viram matérias ou assuntos.
- A migração remove matérias e assuntos que nasceram apenas de tarefas operacionais do plano antigo.
- Conteúdos personalizados legítimos continuam preservados.
- Progresso, conclusão, notas, materiais e links válidos dos assuntos canônicos são preservados.
- Português continua usando a trilha oficial completa em `cursoPortugues.ts`, organizada em Módulo → Assunto → Aulas.
- O plano atual referencia 49 assuntos canônicos; a página Conteúdos mantém também os assuntos futuros já cadastrados na trilha completa de Português.

## Etapa 14 — Plano → matéria → assunto → aula

Cada missão de conteúdo agora recebe uma referência canônica:

- `materiaId`
- `moduloId`
- `assuntoId`
- `aulaId`, quando a missão aponta para uma aula específica

### Português

Exemplo:

`Fonema e Letra` → `Português` → `Módulo 0 - Fonologia` → `Fonemas, letras e sons da fala` → aula `Fonema e letra`.

Marcar ou finalizar essa missão conclui somente a aula correspondente. O assunto só é concluído quando todas as suas aulas forem concluídas.

### Outras matérias

Quando existe uma videoaula específica, a missão aponta para a aula interna do assunto. Quando não existe uma aula específica, a missão aponta diretamente para o assunto canônico.

## Sincronização

- Concluir uma aula atualiza a missão correspondente no Plano.
- Reabrir uma aula reabre somente a missão daquela aula.
- Concluir todas as aulas fecha o assunto e cria a revisão prevista pelo fluxo atual.
- Concluir diretamente um assunto marca as missões de conteúdo relacionadas.
- Ao carregar dados antigos, o estado das missões de conteúdo é reconciliado com a árvore canônica, sem reset manual.
- A Central de Estudos informa quando a sessão veio de uma missão vinculada e evita concluir todo um bloco de Português por engano.

## Validação aplicada

- 112 missões totais no plano.
- 60 missões de conteúdo.
- 52 missões operacionais.
- 49 assuntos canônicos referenciados pelas missões de conteúdo.
- 0 missões de conteúdo sem referência canônica.
- 0 referências quebradas após normalização/migração.
- 0 itens operacionais gerados na árvore canônica.
