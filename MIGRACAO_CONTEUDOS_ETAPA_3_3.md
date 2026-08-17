# Migração de Conteúdos — Etapa 3.3

Correção definitiva do preenchimento da missão iniciada pelo Dashboard.

## Alterações
- o Dashboard grava a missão temporariamente em `sessionStorage`;
- a Central de Estudos lê a missão uma única vez ao carregar;
- Matéria, Módulo e Assunto são resolvidos pelos IDs e, como fallback, pelos nomes;
- missões antigas com tipo `estudo` são convertidas para `aula`;
- o cronômetro permanece parado até o clique em **Iniciar sessão**;
- o transporte antigo por `location.state` continua aceito para compatibilidade.

Não há alteração de SQL ou Supabase.
