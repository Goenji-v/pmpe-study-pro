# Auditoria e reconstrução das Revisões V2 — cópia QA de 22/11/2026

> Estado: **inventário e protótipo isolado**, sem substituir o motor ativo nem alterar a conta oficial. A cópia QA foi importada pelo titular anteriormente; pode estar desatualizada frente à produção.

## Segurança e snapshot

Backup completo criado **no Supabase Staging** (`isjzyyoqvftrltkctanw`) antes da futura migração:
- Nome: `Pré-migração Revisões V2 QA — 2026-11-22`
- ID: `1c007bf8-f0d0-4f64-9412-c452b5ab4820`
- Contém estado integral (`appState`), 272 revisões, 352 sessões e sincronização base revisão 15.
- Nada foi excluído, normalizado nem regravado nas revisões da conta QA. Banco oficial `kibnmdwabpiwyprkrhvq` não alterado.

## Inventário de revisões

- 272 registros de revisão: 234 concluídos e 38 pendentes.
- 62 identidades de assunto, contando ID existente ou nome quando ID ausente.
- 10 registros antigos **sem `assuntoId`**: 8 de RLM/“Conectivos, tabelas-verdade e negação” e 2 de Português/“Sílaba”. Estes exigem revisão humana/canônica; **não atribuir automaticamente** à aula de conectivos nem mesclar com negação.
- 96 IDs de revisão com sufixo `:proxima`, alguns encadeados diversas vezes; IDs técnicos crescentes não representam novas aulas.
- Não há **dois pendentes com o mesmo par de IDs (matéria, assunto)** nesta cópia; há diferentes aulas e nomes legados a tratar.
- Etapas 1/2/3/4/5: 88/65/51/56/12 registros, respectivamente. Estes números são etapas do **motor anterior**, não podem virar etapas V2 cegamente.

| Disciplina (rótulo legado) | Registros | Concluídos | Pendentes |
|---|---:|---:|---:|
| Informática | 41 | 33 | 8 |
| Raciocínio Lógico e Matemática | 41 | 36 | 5 |
| Direito Constitucional | 38 | 34 | 4 |
| Legislação Extravagante | 32 | 32 | 0 |
| Português | 30 | 30 | 0 |
| História | 29 | 27 | 2 |
| Língua Portuguesa | 24 | 15 | 9 |
| Direitos Humanos | 15 | 12 | 3 |
| Redação | 9 | 6 | 3 |
| RLM | 8 | 8 | 0 |
| Estatuto PMPE (Pós Edital) | 5 | 1 | 4 |
| **Total** | **272** | **234** | **38** |

## Diagnóstico do motor antigo

Em `src/utils/revisoes.ts`:
- `INTERVALOS_REVISAO_DIAS` = 1, 5, 7, 14, 30 — não coincide com o fluxo pedido.
- `criarProximaRevisao` pula 1 dia para `dificil` e 3 para `media`, independentemente da etapa.
- `encontrarDataDisponivelParaRevisao` desloca para datas posteriores quando o limite diário está lotado.
- `avaliarRevisaoPorQuestoes` considera "fácil" acima de 80%, "média" de 60 a 79%, difícil abaixo de 60%; apenas o critério **60% mínimo** coincide com o fluxo novo.
- Recria um objeto de revisão com ID novo a cada conclusão, embora mantenha ID de aula. O histórico de etapas fica misturado à fila pendente.

Os dois itens de lógica argumentativa têm **`assuntoId` diferentes**, correspondendo às aulas teórica e de exercícios; não mesclar automaticamente. Se o curso trata exercícios como atividade da aula, deve haver decisão expressa no catálogo.

## Nova proposta codificada (isolada)

`src/utils/revisaoCicloV2.ts`:
- Chave estável: `(materiaId, aulaId)`; uma cadeia de revisão por aula e uma única próxima tarefa.
- Ao concluir aula, registra o marco de 4h já cumprido e programa D+1.
- D+1: revisão curta teórica; depois D+7 (baseado na data da aula).
- D+7: questões; **>=60%** segue D+14, **<60%** repete o mesmo marco em 4 dias (não duplica fila).
- D+14: questões; novamente **<60%** reforço do mesmo marco em 4 dias.
- Após D+14, não cria etapas extras sem regra do titular; etapas 4/5 legadas mantidas no inventário.
- Conclusão com `sessaoId` repetido é idempotente e não cria uma segunda revisão.
- `inventariarRevisoesLegadasV2` é somente leitura e preserva todos os IDs históricos; não reatribui etapas antigas automaticamente.

## Etapas obrigatórias antes de qualquer migração definitiva

1. Construir/validar tabela de equivalência por **aula**: disciplina → assunto do edital → aula do curso; não fundir duas aulas sem confirmação.
2. Mapear os 10 registros sem `assuntoId` e revisar outras mudanças de IDs entre curso e edital.
3. Fazer backup integral **atualizado da conta oficial** no momento da migração e validar sua recuperação (snapshot QA não substitui backup da produção).
4. Gerar um **dry-run com contagem e diffs**: cada registro histórico original deve permanecer recuperável, só uma pendência por aula canônica, sem regressão de sessões ou progresso.
5. Aplicar sob revisão CAS atômica **somente no Staging**, sem substituir todo o `appState` via autosave; migrar histórico para um modelo novo sem quebrar proteção anti-regressão.
6. Testar sincronização entre dispositivos, falha/offline, carga/backup, resultados 59%, 60%, 80%, revisões atrasadas e compatibilidade dos 38 pendentes.
7. Submeter para aprovação antes de alterar produção.
