# Correção Etapa 3.4

Causa real identificada: o botão visível "Iniciar missão" pertence ao componente `MissaoDoDia`, não à função equivalente existente em `Dashboard.tsx`.

O componente antigo salvava dados em uma chave localStorage desatualizada (`pmpe_cronometro_estudo`), que a Central de Estudos atual não utiliza.

Correção:
- `MissaoDoDia` agora localiza matéria, módulo e assunto na estrutura atual;
- envia `materiaId`, `moduloId` e `assuntoId`;
- grava o prefill na chave que a Central realmente lê;
- também envia os dados por `location.state` como fallback;
- não inicia o cronômetro automaticamente.
