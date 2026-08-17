# Migração de Conteúdos — Etapa 1

## Objetivo

Preparar o projeto para a hierarquia:

`Matéria → Módulo → Assunto → Materiais`

sem alterar ainda a interface das páginas e sem quebrar dados antigos.

## Implementado

- Novo tipo `Modulo`.
- `Materia.modulos` introduzido com compatibilidade temporária por `Materia.assuntos`.
- Campos opcionais `modulo` e `moduloId` nos registros relacionados.
- Migração automática de matérias antigas para um módulo determinístico chamado `Geral`.
- Preservação dos IDs atuais de matérias e assuntos.
- Migração idempotente: carregar novamente não duplica módulos.
- Reconciliação entre o espelho legado `assuntos` e a nova árvore `modulos` enquanto as telas antigas ainda estiverem em uso.
- Estado de nuvem atualizado de versão 1 para versão 2.
- Leitura de estados versão 1 e versão 2.
- Salvamento somente como versão 2.
- Backup exportado como versão 2 e importação compatível com versões 1 e 2.
- Funções centralizadas para navegar, localizar e calcular progresso na árvore.
- Atualização da conclusão de assunto no `AppContext` para manter módulos e espelho legado sincronizados.

## Novos arquivos

- `src/services/conteudos/tiposCompatibilidade.ts`
- `src/services/conteudos/navegarConteudos.ts`
- `src/services/conteudos/migrarEstruturaConteudos.ts`
- `src/services/conteudos/validarConteudos.ts`

## Arquivos alterados

- `src/types/index.ts`
- `src/utils/materiasDoPlano.ts`
- `src/services/sincronizacaoService.ts`
- `src/context/AppContext.tsx`
- `src/pages/Backup/Backup.tsx`

## Comportamento esperado

Ao carregar uma conta antiga:

```text
Matéria
└── assuntos antigos
```

é convertida em memória para:

```text
Matéria
└── Geral
    └── assuntos antigos
```

Na sincronização seguinte, o estado é salvo como versão 2. Nenhuma alteração SQL é necessária nesta etapa, porque a tabela `configuracoes` continua armazenando o estado em JSON.

## Validações executadas

- Sintaxe de todos os arquivos TS/TSX validada.
- Teste de criação do módulo Geral.
- Teste de preservação de IDs.
- Teste de idempotência.
- Teste de sincronização de edições feitas por telas antigas.
- Teste de inclusão de assunto novo pelo formato legado.

## Limitação do ambiente

O `npm run build` não pôde ser concluído porque o registro interno de pacotes retornou erro 404 para uma dependência do NPM. Execute localmente:

```bash
npm install
npm run build
npm run dev
```

## Próxima etapa

Migrar a página Conteúdos para exibir e gerenciar:

- módulos;
- progresso por módulo;
- criação, edição e exclusão de módulo;
- criação e movimentação de assuntos dentro de módulos.
