# Ajuste — Calendário configurável + revisão por assunto

## Cronograma
- Configurações ganhou `Missões por dia (segunda a sábado)`, de 1 a 6.
- O plano preserva a ordem e os IDs das missões existentes e apenas redistribui a exibição no calendário.
- Segunda a sábado recebem exatamente o número configurado de missões.
- Domingo continua exclusivo para Redação + Simulado.
- Os botões do plano usam nomes reais dos dias da semana.
- Ao abrir o Plano, o sistema parte da semana atual de progresso e do dia da semana atual.
- Com 1 missão/dia, as 131 missões úteis são distribuídas em 22 semanas; com 2 missões/dia, permanecem em 11 semanas.

## Central de Estudos — Revisão
- Revisão agora exige matéria e permite selecionar módulo + assunto canônico.
- O formato pode ser `Teoria` ou `Questões`.
- Revisão por questões exige total de questões, acertos, banca e dificuldade na finalização.
- Acertos e erros da revisão por questões entram também no histórico de questões do assunto, sem duplicar o tempo estudado.
- O formato da revisão fica salvo dentro da sessão ativa, inclusive após recarregar a página.

## Compatibilidade
- Histórico e IDs das missões de conteúdo foram preservados.
- Configurações antigas sem `missoesPorDia` assumem 1 missão/dia e são normalizadas no próximo save/sync.
- Schema permanece 18.
