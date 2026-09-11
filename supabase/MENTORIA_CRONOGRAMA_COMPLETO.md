# Mentoria e cronograma automático — estado aplicado no Supabase

Aplicado no projeto `pmpe-study-pro` em 2026-09-11.

## Estrutura existente aproveitada

- `trilhas_mentoria`
- `trilha_mentoria_itens`
- `trilha_mentoria_rotas_aluno`
- `progresso_trilha_mentoria`
- `reforcos_mentoria`

## Campos adicionados

### `trilhas_mentoria`
- `intervalos_revisao integer[]` — padrão `{1,7,30}`
- `simulado_cada_dias integer`
- `percentual_teoria integer` — padrão `67`

### `trilha_mentoria_itens`
- `minutos_estimados`
- `questoes_alvo`
- `prioridade`
- `obrigatorio`
- `tipo` (`teoria`, `questoes`, `misto`)
- `instrucoes`
- `material_url`

### `reforcos_mentoria`
- `minutos_extra`
- `questoes_extra`
- `revisao_em_dias`
- `prioridade`

## Novas tabelas

- `disponibilidade_estudo_aluno`
- `preferencias_cronograma_aluno`
- `cronograma_mentoria_tarefas`
- `recalculos_cronograma_mentoria`
- `auditoria_mentoria`

Todas as tabelas expostas no schema `public` possuem RLS e grants explícitos. Escrita direta em tarefas, recálculos e auditoria fica bloqueada para `authenticated`; ações sensíveis passam por RPCs.

## RPCs públicas

- `minha_trilha_mentoria()`
- `listar_trilhas_meu_parceiro()`
- `painel_cronograma_aluno_meu_parceiro(user_id)`
- `salvar_trilha_mentoria(...)`
- `criar_reforco_mentoria(...)`
- `recalcular_meu_cronograma_mentoria(...)`
- `recalcular_cronograma_aluno_mentor(...)`
- `atualizar_status_tarefa_mentoria(...)`

As operações privilegiadas são implementadas por funções auxiliares no schema `private`, com validação de `auth.uid()` e vínculo com parceiro/aluno.

## Motor determinístico

Prioridade ao preencher cada dia:

1. revisões vencidas;
2. reforços adicionados pelo mentor;
3. simulado programado;
4. próximos itens da trilha.

O motor respeita a disponibilidade diária do aluno e o limite de matérias por dia. Um recálculo nunca apaga tarefas concluídas: tarefas futuras pendentes/em andamento/atrasadas são marcadas como `reagendado` e um novo conjunto é criado.

Ao concluir um conteúdo principal:

- grava/atualiza `progresso_trilha_mentoria`;
- cria revisões automaticamente no calendário configurado (padrão 1/7/30 dias);
- registra auditoria.

Ao concluir um reforço, o próprio `reforcos_mentoria` é marcado como concluído.

## Testes executados

Foi realizado teste transacional com `ROLLBACK` simulando um usuário autenticado:

- geração de 7 dias;
- leitura pelo painel do mentor;
- conclusão de tarefa;
- criação de progresso;
- criação automática de 3 revisões (1/7/30).

O teste passou sem deixar dados de teste no banco.

## Frontend desta branch

- editor avançado da trilha em `/parceiro/mentoria`;
- painel individual em `/parceiro/aluno/:userId`;
- cronograma automático para aluno vinculado à mentoria;
- fallback para o Cronograma IA legado quando o aluno não possui trilha;
- ponte de sincronização entre cronômetro e tarefa da mentoria.
