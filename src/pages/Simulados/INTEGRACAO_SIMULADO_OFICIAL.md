Fluxo integrado:

ADM → Simulados → seção Simulado Oficial → preencher concurso/banca/data/tempo → enviar PDF da prova + PDF do gabarito → Analisar com IA → revisar questões → publicar.

Aluno → Simulados → Simulados Oficiais → selecionar prova → iniciar tentativa → resolver com cronômetro e eliminação → finalizar → correção server-side → resultado por matéria/assunto → Desempenho/Ranking.

Os PDFs de origem devem ficar em bucket privado `simulados-oficiais`; o gabarito permanece privado. A primeira tentativa oficial (`conta_ranking = true`) é a única usada no ranking; tentativas posteriores continuam no histórico.
