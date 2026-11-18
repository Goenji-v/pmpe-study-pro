# Auditoria de curso × edital e catálogo central — prévia de 18/11/2026

## Objetivo
Reduzir duplicações quando um estudante inicia sem edital, importa um curso e posteriormente
adota o edital oficial — sem apagar IDs, notas, aulas, revisões ou missões.

**Escopo atual:** somente branch `preview/study-pro-espelho-unico-20261111`.
Nenhuma migração em massa de conta, RLS ou atualização do banco foi executada.

## Etapa 1 — Achados da auditoria

1. `src/utils/uniaoGradeEstudos.ts` já consolida matérias, usa aliases/IDs legados,
   reaproveita materiais/aulas e associa curso ao edital. A heurística de conteúdos
   é primordialmente textual e pode deixar um assunto como complementar mesmo
   quando faz parte de uma família pedagógica conhecida.
2. `src/utils/migracaoEdital.ts` faz planejamento e relatório antes da troca:
   pontuação alta (>=0,90) pode preservar ID; 0,74+ pode ficar ambíguo.
   A primeira importação não utiliza exatamente a mesma etapa de migração que a troca.
3. `src/pages/MeuEdital/MeuEdital.tsx` já usa `aplicarEstadoEstruturalSeguro`,
   CAS/número de revisão e backup. A auditoria do catálogo foi adicionada ao
   fluxo de prévia, e impede a aplicação em conflito ou sem conferência.
4. `src/pages/Cursos/Cursos.tsx` alterava configurações e matérias em duas chamadas
   de estado separadas. Na prévia, a confirmação de curso passa por backup e
   `aplicarEstadoEstruturalSeguro` de um único estado, condicionado a sincronização segura.
5. `src/utils/revisoesAssuntoPrincipal.ts` e
   `src/utils/catalogoRevisoesIntegradas.ts` já aplicam um piloto de agrupamento de
   revisões. O novo catálogo central **não substitui ainda** aquela regra: a convergência
   será feita após validar os mapeamentos pedagogicamente.

## Etapa 2 — Catálogo piloto (sem conversão automática de IDs)
- `src/utils/catalogoAssuntosCentral.ts`
- Disciplina, família e subassunto têm identificadores estáveis distintos.
- Aliases exatos curados são identificados como possibilidades de vínculo do **mesmo subassunto**.
- Conectivos, tabela-verdade, negação, equivalências e tautologias
  pertencem à família `rlm.logica-proposicional`, mas têm IDs próprios.
- Lógica argumentativa pertence a outra família, apesar de usar conectivos.
- Dígrafos/encontros/sílabas são subtópicos de Fonologia, não o mesmo subtópico.
- "Segurança da Informação" diferencia aulas 1–4, aulas 5–9 e PDF material complementar.
- Windows mantém as três partes como aulas distintas; História e Legislação não fundem
  eventos ou leis diferentes.
- Estatuto identificado sob Direitos Humanos requer correção de **classificação**,
  nunca transferência silenciosa de histórico.

## Etapa 3 — Conciliação protegida de importação
- `src/utils/conciliacaoImportacaoCatalogo.ts` compara novas entradas com matérias já
  existentes, sem escrita. Identifica nomes iguais, aliases, parentesco pedagógico,
  títulos compostos, matérias divergentes, semelhança suspeita e repetição no próprio arquivo.
- `src/components/conciliacao/PainelConciliacaoCatalogo.tsx` mostra a análise em
  **Meu Edital → Gerar prévia** e em **Cursos → Conferir antes de importar**.
- Aprovação manual vinculada a assinatura da análise; qualquer edição de nomes/cadastro
  invalida a confirmação anterior. Bloqueio por conflito/offline/erro.
- A confirmação **não aplica** automaticamente os aliases sugeridos, nem altera IDs.
  Os algoritmos existentes de associação ainda precisam de uma etapa de homologação para
  usar oficialmente os IDs canônicos curados do catálogo.
- Importação de curso exige backup do estado completo e CAS; falha bloqueia aplicação.

## Etapa 4 — Critérios de teste antes de propor o oficial
1. Curso antigo + novo edital com "Conectivos" / "Conectivos lógicos":
   sugerir correspondência do mesmo subassunto; não duplicar automaticamente.
2. "Tabela-verdade" e "Equivalências":
   mesma família, subtópicos diferentes; sem fusão de aulas ou notas.
3. Importação duplicada no mesmo arquivo:
   detectar antes mesmo de haver uma grade anterior.
4. Estatuto em Direitos Humanos:
   reportar risco de classificação cruzada.
5. Mudança de assunto após prévia:
   invalidar confirmação e exigir nova análise.
6. Erro/offline/conflito de sincronização:
   impedir aplicação e preservar estado anterior.
7. Reimportação: idempotência de aulas e materiais da rotina existente,
   preservar histórico completo.

## Ponto de revisão do usuário (etapa 2)
**Não autorizar migração automática de vínculos** até conferir os pares difíceis,
sobretudo Lógica Proposicional × Lógica Argumentativa, Direitos Humanos × Estatuto,
fonologia e parte de Segurança da Informação. Títulos compostos são estruturas
com múltiplos subtópicos e precisam de conferência humana.

Esta auditoria registra comportamento do código e testes; não é prova de
sincronização real entre dois dispositivos ou de ausência de falhas em produção.
