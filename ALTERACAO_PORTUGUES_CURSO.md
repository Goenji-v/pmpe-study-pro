# Alteração — Trilha oficial de Português

## O que mudou

- A matéria **Português** passou a usar exclusivamente a grade do curso Rota Policial informada pelo usuário.
- Foram cadastrados **5 módulos e 66 aulas**, cada uma com link direto da videoaula.
- As demais matérias continuam usando a estrutura anterior.
- Contas que já possuem dados passam por migração automática ao carregar o app.
- Questões, sessões, simulados e histórico antigos não são apagados pela migração.
- Notas/progresso de aulas com correspondência exata são preservados.
- A estrutura da trilha de Português é fixa; módulos/aulas oficiais não podem ser excluídos ou movidos pela tela de Conteúdos.
- A Central de Estudos agora carrega automaticamente o link da aula ao selecionar um assunto.
- O Dashboard ganhou o card **Trilha de Português**, com progresso geral e acesso à próxima aula não concluída.
- As 16 missões de Português existentes no plano de 8 semanas foram atualizadas para as 16 primeiras aulas da nova trilha, removendo os links antigos de Português do RDC.

## Estrutura

1. Módulo 0 - Fonologia — 8 aulas
2. Módulo 1 - Ortografia e Acentuação — 4 aulas
3. Módulo 2 - Classes de Palavras — 29 aulas
4. Módulo 3 - Sintaxe Básica — 20 aulas
5. Módulo 4 - Concordância — 5 aulas

Total: **66 aulas**.

## Arquivos principais alterados

- `src/data/cursoPortugues.ts` (novo)
- `src/data/planoPMPE.ts`
- `src/utils/materiasDoPlano.ts`
- `src/context/AppContext.tsx`
- `src/pages/Estudos/Estudos.tsx`
- `src/pages/Estudos/Estudos.css`
- `src/pages/CentralEstudos/CentralEstudos.tsx`
- `src/pages/Dashboard/Dashboard.tsx`
- `src/pages/Dashboard/Dashboard.css`
- `src/pages/PlanoEstudos/PlanoEstudos.tsx`
