# Migração de Conteúdos — Etapa 6

Integra IA e Simulados à estrutura Matéria → Módulo → Assunto.

- Gerar Simulado IA seleciona módulo antes do assunto.
- O contexto enviado ao Gemini inclui matéria, módulo e assunto.
- Questões geradas preservam modulo e moduloId.
- Resolver Simulado IA exibe o caminho completo.
- Filtros de materiais preservam o módulo.
- IA Coach aceita módulo em ações e assuntos críticos.
- Dados antigos continuam válidos com fallback Geral.
- Não há SQL novo.
