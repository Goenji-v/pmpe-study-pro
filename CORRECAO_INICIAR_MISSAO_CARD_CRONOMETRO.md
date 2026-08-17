# Correção — iniciar missão pelo card do cronômetro

- O botão ocioso do card do cronômetro deixou de ser apenas "Abrir Central".
- Quando existe uma missão válida para o dia, o card mostra a matéria e o assunto planejados.
- O botão passa a ser "Iniciar missão" e usa a mesma rotina da Missão de Hoje:
  1. resolve os IDs canônicos da missão;
  2. inicia a sessão no CronometroContext;
  3. abre a Central de Estudos já com matéria, módulo e assunto preenchidos;
  4. preserva o mesmo missaoId para sincronização com Plano/Conteúdos.
- Domingo continua abrindo o bloco de Redação + Simulado.
- Se a missão do dia já foi concluída, o card oferece "Ver dia de hoje".
- Se já existe uma sessão ativa, o botão continua levando à Central sem substituir a sessão.
