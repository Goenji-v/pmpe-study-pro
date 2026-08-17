# Correção — Dashboard, calendário real e rotas 404

## Problemas corrigidos

1. O Dashboard usava `/plano-estudos`, mas a rota real do Plano é `/plano`.
2. O Dashboard usava `/conteudos`, mas a rota real de Conteúdos é `/estudos`.
3. A área **Missão de hoje** usava a próxima missão pendente da fila. Assim, depois de concluir o sábado, ela já podia mostrar a Redação de domingo ainda no sábado.

## Comportamento novo

- O Dashboard consulta o **dia real da semana**.
- Ele mostra somente a missão pendente do dia atual dentro da semana em andamento.
- Se as missões de hoje já foram concluídas, mostra **Missão de hoje concluída** e não antecipa a missão de amanhã.
- No domingo, Redação/Simulado abrem o domingo correto no Plano.
- Missões normais continuam abrindo a Central de Estudos.
- Foram mantidos aliases `/plano-estudos` e `/conteudos` para links antigos não caírem mais em 404.
