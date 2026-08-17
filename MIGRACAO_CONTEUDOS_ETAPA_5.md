# Migração de Conteúdos — Etapa 5

Integra Questões, Banco de Questões, Histórico e Estatísticas à estrutura
Matéria → Módulo → Assunto.

- novos registros guardam materiaId, modulo, moduloId e assuntoId;
- banco de questões seleciona módulo antes do assunto;
- histórico permite editar matéria, módulo e assunto;
- registros antigos sem módulo aparecem como Geral nas análises;
- estatísticas por assunto diferenciam módulos;
- progresso do edital usa a estrutura de módulos;
- nenhuma alteração SQL é necessária.
