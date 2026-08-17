# Etapa 3 — Sincronização entre telas

## Implementado

- Resolver único para relacionar missões do plano a módulo, assunto e aula.
- Compatibilidade por nome e URL da videoaula.
- Dashboard abre o assunto correto e a aula pendente.
- Plano abre a aula vinculada mesmo quando o nome antigo era uma parte do assunto.
- Central seleciona a primeira aula não concluída.
- Conclusão explícita na Central chama a mesma regra usada em Conteúdos.
- A criação de revisão permanece centralizada e sem duplicidade.

## Regra preservada

Finalizar uma sessão registra tempo e missão. O conteúdo só é concluído quando houver ação explícita ou quando todas as aulas forem marcadas.
