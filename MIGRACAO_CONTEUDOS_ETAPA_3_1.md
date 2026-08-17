# Migração de Conteúdos — Etapa 3.1

Correção do fluxo Dashboard → Central de Estudos.

Mudanças:
- o Dashboard não inicia mais o cronômetro antes de abrir a Central;
- a missão é enviada por state do React Router;
- a Central resolve matéria, módulo e assunto por ID e por nome;
- os campos são preenchidos automaticamente;
- os metadados da missão (missaoId, semana, dia, links) são preservados;
- depois do preenchimento, o state de navegação é limpo para evitar reaplicação.

Não há alteração no Supabase nem SQL novo.
