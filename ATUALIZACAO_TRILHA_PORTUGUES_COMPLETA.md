# Atualização — Trilha completa de Português

## Escopo
Português continua como trilha própria por módulos e aulas. As demais matérias mantêm a estrutura anterior.

## Implementado
- 5 módulos e aulas oficiais já cadastradas com links de videoaula.
- Importação de progresso sem gerar revisões antigas.
- Dois modos de conclusão: "Estudei agora" e "Já havia estudado".
- Revisões 0-1-7-15 com limite diário e reorganização de agenda.
- Dashboard com progresso, aulas importadas e próxima aula de Português.
- Métricas por aula: tempo, questões, aproveitamento e revisões pendentes.
- Métrica de tempo acumulado por módulo.
- Ações por aula no Conteúdos:
  - Estudar (abre Central de Estudos preenchida)
  - Vídeo
  - Questões (abre registro preenchido)
  - Materiais (abre Centro de Materiais preenchido e filtrado)
  - IA (abre gerador de questões preenchido)
  - Revisões
  - Resumo/Bizus
- Resumos, anotações e links de materiais continuam persistidos por assunto.

## Compatibilidade
Nenhuma matéria além de Português foi convertida para essa trilha. O núcleo foi preparado para reutilização futura sem exigir nova arquitetura.

## Validação
- Checagem de sintaxe/transpilação TypeScript/TSX: OK.
- Build completo não executado porque o registry do ambiente não disponibilizou `yargs-parser@21.1.1` durante `npm ci`.
