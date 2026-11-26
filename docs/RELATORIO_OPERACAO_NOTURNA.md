# Operação noturna do Estude Pro

Branch local preview/fsrs-revisoes-20261123. A árvore do ponto de partida local 71b9185 coincide com a do remoto f0a45cbe em 07302f6a58c5548fca99c0c25eab9a1200b8ee27. O motor legado segue como agenda oficial. A interface nova exige Vite em desenvolvimento e VITE_PLANO_ADAPTATIVO=true.

## Estado das missões

| Missão | Entrega e limite |
|---|---|
| 01 · Identidade e integridade | Adaptadores de sessões e questões IA, replay ordenado, deduplicação e quarentena de divergências. Registros sem vínculo permanecem preservados. Blocos de revisão e referências sem IDs ficam pendentes. |
| 02 · Desempenho | Regras versionadas para amostra, anulações, recorrência, dificuldade e quatro avaliações candidatas. Estudo passivo e resultados insuficientes não atualizam o cartão. |
| 03 · Memória | Estado por usuário e unidade, logs, dificuldade, estabilidade, retenção estimada e vencimento. Diários JSON versionados reidratam por replay determinístico. A primeira revisão após estudo confirmado começa no dia seguinte. Persistência transacional definitiva pendente. |
| 04 · Prioridades | Prazo, risco, desempenho, dificuldade recorrente, relevância no edital e prova próxima, com desempate por identidade e diversidade de matérias no mesmo prazo. |
| 05 · Distribuição | Uma revisão por unidade, preferência de data, janela horária, limites de minutos e quantidade, reserva para compromissos, descanso e revisão oficial sem equivalente adaptativo. Revisões fora do prazo ficam explícitas. Horários são sugestões dentro de uma janela diária. |
| 06 · Sobrecarga | Horizontes de 7/15/30 dias, quatro estados, capacidade, demanda sem vaga e estimativa de um ciclo adicional com uma resposta Good hipotética. |
| 07 · Pedagogia | Recomendações determinísticas e justificadas, com navegação para a Central de Estudos. O contrato para complemento Gemini é tipado e permanece sem chamadas. |
| 08 · Laboratório | Doze perfis, três horizontes e dois motores. O apêndice contém a execução de referência. |
| 09 · Calendário | Dia, semana e 30 dias, compromissos do plano ativo, revisões agrupadas por matéria no dia e volumes estimados. O calendário oficial permanece disponível. |
| 10 · Interface | Filtros, histórico medido, retenção estimada, dificuldade, evolução por matéria e assunto, preferências locais e formulários responsivos. |
| 11 · Integração | Revisões e Calendário usam a mesma projeção. A Central abre a revisão oficial ou um treino com referência canônica e registra a sessão que o motor lê. As preferências são locais por conta. Resta validar persistência transacional e concorrência real entre dispositivos. |
| 12 · Testes funcionais | Desktop e celular com dados sintéticos. O fluxo autenticado usa respostas Supabase interceptadas no navegador. |
| 13 · Regressão e otimização | Verificações locais registradas abaixo. A validação da infraestrutura remota fica para uma operação autorizada. |

## Decisões e arquivos

- src/services/inteligenciaRevisao contém avaliação, adaptação de eventos, memória, agenda, projeção e simulação. src/services/conteudos fornece a chave de ocorrência e o vínculo autorizado do edital.
- src/components/PlanejamentoAdaptativo contém a interface e seus adaptadores. App.tsx registra o laboratório em desenvolvimento. As páginas Revisões e Calendário carregam o painel pela flag. Central de Estudos, CronometroContext e SessaoEstudo preservam o ID opcional da aula durante o registro habitual.
- server/inteligenciaRevisao.test.ts cobre evidência, replay, reconciliação, agenda, fuso, ano novo e simulação. scripts/testar-revisoes-locais.mjs e scripts/simular-revisoes.ts reproduzem as verificações. O manifesto e o lockfile fixam as dependências. As capturas ficam fora do Git.
- TS-FSRS 6.0.0, MIT, requer Node 24. A dependência transitiva fixa é srs-kit 1.0.0, BSD-3-Clause. O modelo é FSRS-7 e o fuzz está desativado. A auditoria npm de dependências de execução reportou zero vulnerabilidades conhecidas no catálogo consultado. OR-Tools e Cal.diy serviram de referência conceitual para modelar capacidade e restrições. O calendário existente e a projeção React cobriram as visões necessárias sem incluir FullCalendar.
- A agenda usa America/Sao_Paulo e as avaliações usam instantes ISO com fuso explícito. Questões manuais da Central vêm da sessão. Questões IA entram pelo registro da tentativa por assunto e a sessão-espelho fica no histórico oficial. Simulados ficam no planejamento e na análise sem avaliação FSRS automática. A classificação supõe que acertos e erros recebidos excluam anuladas.
- O primeiro ponto de recuperação é 341c460. Para comparar, use git diff 71b9185..HEAD. Desligar a flag restaura a experiência oficial. Para reverter o código, use git revert nos commits posteriores ao ponto de partida, em ordem inversa.

## Reproduzir no checkout FSRS

    $env:Path="$(Resolve-Path ../runtime/node_modules/node-win-x64/bin);$env:Path"
    $env:VITE_PLANO_ADAPTATIVO='true'
    $env:VITE_API_URL='http://127.0.0.1:5187'
    $env:VITE_SUPABASE_URL='http://127.0.0.1:5187'
    $env:VITE_SUPABASE_ANON_KEY='synthetic'
    $env:VITE_SENTRY_DSN=''
    $env:SENTRY_AUTH_TOKEN=''
    node_modules/.bin/vite.cmd --host 127.0.0.1 --port 5187 --strictPort

Abra http://127.0.0.1:5187/laboratorio-revisoes. Em outra sessão, com o mesmo Node no PATH, execute node scripts/testar-revisoes-locais.mjs. O script usa Edge e grava capturas em .evidencias-fsrs/. Para simular, execute node --import tsx scripts/simular-revisoes.ts. O build direto por node_modules/.bin/vite.cmd build evita o upload ao Sentry. No sandbox Windows, a suíte completa usa uma unidade temporária para que o esbuild leia os fixtures.

Antes de publicar em staging, valide a infraestrutura remota em operação autorizada, repita o fluxo autenticado com uma conta sintética, escolha a estratégia de gravação com chave única transacional e compare o impacto na carga antes de ativar a agenda nova. O bloqueio intencional da Vercel foi preservado.

## Validação final local

- Node v24.22.3, lint aprovado, TypeScript aprovado, 640 testes aprovados e zero falhas. Todos os 632 testes da baseline continuam na suíte.
- Build Vite local com destinos loopback e credenciais sintéticas aprovado. Build simulado de preview com URL bloqueada rejeitado pela proteção esperada. Sem upload ao Sentry.
- Playwright aprovou Edge desktop e a emulação Pixel 5. Foram verificados navegação, ausência de overflow, filtros, vazio, janela inválida, recuperação após erro, alteração de data, configuração de limites, sobrecarga, calendário, cancelamento e conclusão sintética. Nenhuma requisição externa ocorreu no laboratório. O fluxo autenticado sintético iniciou e concluiu uma sessão na Central, refletiu 80% no histórico e leu a preferência salva em Revisões ao abrir o Calendário. Requisições de Auth/REST foram interceptadas e as externas bloqueadas.
- Capturas em .evidencias-fsrs/desktop-revisoes.png, mobile-revisoes.png, desktop-calendario.png, mobile-calendario.png e central-autenticada.png.
- O computador permanece ligado. A validação remota, a persistência definitiva e a concorrência entre dispositivos seguem pendentes. Nenhum push ou deploy foi realizado.

## Simulações de referência

Cada linha representa dois experimentos com 18 unidades sintéticas, as mesmas regras de disponibilidade e o mesmo desempenho por perfil. O legado usa criarProximaRevisao com o fim do ciclo de cinco etapas. Para ambos os motores, o FSRS estima retenção no final sobre os resultados medidos. Tempos são observações desta máquina e variam entre execuções. Os números são hipóteses de planejamento e não estimam efeito pedagógico de uma intervenção real.

Cada célula contém concluídas / atrasadas / pico diário / retenção estimada (unidades medidas) / sem vaga na última semana projetada / duplicadas neutralizadas / tempo. A métrica sem vaga é específica da projeção adaptativa. O zero nessa coluna para o legado não indica ausência de backlog.

| Perfil | Dias | Legado | Adaptativo |
|---|---:|---|---|
| Iniciante | 30 | 85 / 60 / 4 / 91.7% (18) / 0 / 0 / 36 ms | 86 / 52 / 4 / 93.0% (18) / 0 / 0 / 118 ms |
| Iniciante | 60 | 90 / 64 / 4 / 82.6% (18) / 0 / 0 / 6 ms | 133 / 58 / 4 / 93.8% (18) / 0 / 0 / 187 ms |
| Iniciante | 90 | 90 / 64 / 4 / 78.9% (18) / 0 / 0 / 5 ms | 159 / 61 / 4 / 93.3% (18) / 0 / 0 / 284 ms |
| Intermediário | 30 | 65 / 14 / 5 / 95.6% (18) / 0 / 0 / 4 ms | 42 / 9 / 5 / 92.0% (18) / 0 / 0 / 46 ms |
| Intermediário | 60 | 85 / 15 / 5 / 96.5% (18) / 0 / 0 / 6 ms | 60 / 10 / 5 / 93.6% (18) / 0 / 0 / 108 ms |
| Intermediário | 90 | 90 / 15 / 5 / 93.9% (18) / 0 / 0 / 6 ms | 70 / 13 / 5 / 94.1% (18) / 0 / 0 / 167 ms |
| Avançado | 30 | 58 / 6 / 6 / 97.9% (18) / 0 / 0 / 4 ms | 36 / 6 / 6 / 91.9% (18) / 0 / 0 / 40 ms |
| Avançado | 60 | 76 / 6 / 6 / 97.8% (18) / 0 / 0 / 8 ms | 54 / 9 / 6 / 96.7% (18) / 0 / 0 / 95 ms |
| Avançado | 90 | 90 / 6 / 6 / 98.2% (18) / 0 / 0 / 6 ms | 54 / 9 / 6 / 94.2% (18) / 0 / 0 / 142 ms |
| Baixo desempenho | 30 | 90 / 77 / 4 / 20.0% (18) / 0 / 0 / 5 ms | 97 / 90 / 4 / 25.1% (18) / 10 / 0 / 59 ms |
| Baixo desempenho | 60 | 90 / 77 / 4 / 17.1% (18) / 0 / 0 / 5 ms | 197 / 190 / 4 / 14.5% (18) / 6 / 0 / 171 ms |
| Baixo desempenho | 90 | 90 / 77 / 4 / 16.2% (18) / 0 / 0 / 4 ms | 301 / 294 / 4 / 11.0% (18) / 8 / 0 / 362 ms |
| Alto desempenho | 30 | 58 / 10 / 5 / 98.1% (18) / 0 / 0 / 4 ms | 36 / 7 / 5 / 91.9% (18) / 0 / 0 / 39 ms |
| Alto desempenho | 60 | 76 / 10 / 5 / 97.8% (18) / 0 / 0 / 5 ms | 54 / 9 / 5 / 97.3% (18) / 0 / 0 / 89 ms |
| Alto desempenho | 90 | 90 / 10 / 5 / 98.2% (18) / 0 / 0 / 7 ms | 54 / 9 / 5 / 95.2% (18) / 0 / 0 / 143 ms |
| Pouca disponibilidade | 30 | 25 / 24 / 1 / 89.1% (17) / 0 / 0 / 3 ms | 25 / 24 / 1 / 88.8% (18) / 10 / 0 / 26 ms |
| Pouca disponibilidade | 60 | 50 / 49 / 1 / 95.3% (18) / 0 / 0 / 5 ms | 44 / 41 / 1 / 93.5% (18) / 0 / 0 / 68 ms |
| Pouca disponibilidade | 90 | 76 / 75 / 1 / 97.3% (18) / 0 / 0 / 7 ms | 57 / 48 / 1 / 95.5% (18) / 0 / 0 / 119 ms |
| Fila acumulada | 30 | 78 / 78 / 3 / 93.9% (18) / 0 / 0 / 4 ms | 72 / 54 / 3 / 91.9% (18) / 0 / 0 / 50 ms |
| Fila acumulada | 60 | 90 / 90 / 3 / 85.2% (18) / 0 / 0 / 5 ms | 111 / 78 / 3 / 91.9% (18) / 0 / 0 / 128 ms |
| Fila acumulada | 90 | 90 / 90 / 3 / 81.1% (18) / 0 / 0 / 5 ms | 144 / 105 / 3 / 94.8% (18) / 0 / 0 / 230 ms |
| Prova próxima | 30 | 61 / 41 / 3 / 96.2% (18) / 0 / 0 / 4 ms | 44 / 17 / 3 / 92.7% (18) / 0 / 0 / 43 ms |
| Prova próxima | 60 | 80 / 45 / 3 / 95.2% (18) / 0 / 0 / 5 ms | 63 / 23 / 3 / 94.7% (18) / 0 / 0 / 111 ms |
| Prova próxima | 90 | 90 / 47 / 3 / 94.2% (18) / 0 / 0 / 6 ms | 71 / 26 / 3 / 94.0% (18) / 0 / 0 / 166 ms |
| Mudança de edital | 30 | 65 / 21 / 4 / 96.0% (18) / 0 / 0 / 5 ms | 42 / 13 / 4 / 91.9% (18) / 0 / 0 / 46 ms |
| Mudança de edital | 60 | 84 / 24 / 4 / 96.8% (18) / 0 / 0 / 6 ms | 61 / 15 / 4 / 94.3% (18) / 0 / 0 / 112 ms |
| Mudança de edital | 90 | 90 / 24 / 4 / 94.6% (18) / 0 / 0 / 6 ms | 69 / 18 / 4 / 93.8% (18) / 0 / 0 / 171 ms |
| Atrasos recorrentes | 30 | 55 / 48 / 3 / 91.2% (18) / 0 / 0 / 3 ms | 55 / 49 / 3 / 91.4% (18) / 1 / 0 / 43 ms |
| Atrasos recorrentes | 60 | 90 / 83 / 3 / 87.7% (18) / 0 / 0 / 5 ms | 101 / 85 / 3 / 93.7% (18) / 0 / 0 / 118 ms |
| Atrasos recorrentes | 90 | 90 / 83 / 3 / 82.3% (18) / 0 / 0 / 5 ms | 126 / 93 / 3 / 92.1% (18) / 0 / 0 / 225 ms |
| Eventos duplicados | 30 | 65 / 21 / 4 / 96.0% (18) / 0 / 83 / 5 ms | 42 / 13 / 4 / 91.9% (18) / 0 / 60 / 48 ms |
| Eventos duplicados | 60 | 84 / 24 / 4 / 96.8% (18) / 0 / 102 / 6 ms | 61 / 15 / 4 / 94.3% (18) / 0 / 79 / 129 ms |
| Eventos duplicados | 90 | 90 / 24 / 4 / 94.6% (18) / 0 / 108 / 7 ms | 69 / 18 / 4 / 93.8% (18) / 0 / 87 / 197 ms |
| Revisões críticas | 30 | 52 / 52 / 2 / 30.7% (18) / 0 / 0 / 3 ms | 52 / 52 / 2 / 30.7% (18) / 14 / 0 / 34 ms |
| Revisões críticas | 60 | 90 / 90 / 2 / 20.0% (18) / 0 / 0 / 5 ms | 102 / 102 / 2 / 20.2% (18) / 12 / 0 / 98 ms |
| Revisões críticas | 90 | 90 / 90 / 2 / 17.9% (18) / 0 / 0 / 5 ms | 154 / 154 / 2 / 16.1% (18) / 12 / 0 / 212 ms |

## Consolidação local do FSRS

### Contrato e limites da persistência

A projeção pode salvar um checkpoint experimental em IndexedDB. A unidade de gravação contém diário observado, avaliações, cartões, casos pendentes e agendamentos. Um checkpoint reúne somente uma conta e uma época de dados. A época segue o marcador de reinício da conta. A gravação troca o checkpoint por inteiro sob uma transação de leitura e escrita com confirmação após commit. A revisão esperada faz o papel do CAS. Repetir a mesma proposta devolve a revisão gravada, inclusive quando o cliente perdeu a resposta. Revisões divergentes, fonte defasada, calendário retroativo e perda de observações existentes são recusados.

A agenda da interface continua sendo calculada a partir do estado oficial hidratado, das preferências locais e do relógio. Após recarregar, o checkpoint anterior permanece disponível como evidência e o painel recalcula o plano com o histórico oficial. Avaliações concluídas do legado sem evidência detalhada continuam no legado sem gerar rating FSRS. Referências ambíguas e versões de eventos conflitantes são preservadas. A época antiga nunca é apagada nem reutilizada automaticamente.

IndexedDB garante atomicidade entre abas da mesma origem e perfil do navegador. O teste de dois clientes usa um transporte compartilhado sintético com as mesmas regras CAS. Não se deve inferir a partir dele sincronização real entre aparelhos. O transporte local não usa a RPC salvar_estado_app_cas. O fluxo legado continua dono de sessões e do histórico oficial.

### Protocolo para a futura sincronização entre dispositivos

1. Resolver o dono pela sessão autenticada e a época pela conta. Ler o snapshot legado somente após sincronização confirmada e registrar seu syncRevision como revisaoLegado.
2. Derivar o checkpoint do snapshot confirmado, usando o diário observado como fonte de replay. Persistir o diário e o resultado como uma unidade. Em transporte JSON, reconstruir os cartões pelo replay da versão fixada e validar com as entradas arquivadas.
3. Implementar TransporteFsrs numa transação autenticada que compare a revisão do checkpoint e a revisão/época do estado oficial. Separar a tabela do appState e impor unicidade por usuário e época. Negar gravações diretas e acesso cruzado. A transação deve rejeitar propostas vindas de uma revisão legada desatualizada e reapresentar o último estado ao cliente.
4. Em conflito, recarregar a fonte oficial via os mecanismos existentes de resolução, comparar os diários e reaplicar apenas alterações conciliáveis. Nunca sobrescrever o outro aparelho após um novo GET sem examinar a divergência. Em resposta perdida ou interrupção, aguardar a conexão e reapresentar a proposta idêntica antes de tentar outra.
5. Conservar observações históricas e aliases. Se um novo catálogo alterar identidade ou um fluxo autorizado remover uma sessão, tratar a transformação como reconciliação explícita com trilha de origem. A proteção de perda de histórico recusa essas diferenças até serem tratadas.

### Piloto e rollback

- Com VITE_PLANO_ADAPTATIVO falso ou ausente, a aplicação usa as telas oficiais. Com VITE_PLANO_ADAPTATIVO=true em dev, há projeção em sombra. Checkpoints exigem também o ID exato em VITE_FSRS_CHECKPOINT_CONTAS, uma lista separada por vírgulas. Essa seleção controla a interface experimental local, e a autenticação futura precisa ser verificada no servidor.
- Para testar, inicie o Vite com os destinos loopback descritos acima e inclua o UUID sintético 00000000-0000-4000-8000-000000000101 na lista. Use FSRS_TESTAR_CHECKPOINT=1 ao executar o teste Playwright. FSRS_PORT pode selecionar outra porta local.
- Em homologação futura, validar primeiro uma conta de teste e comparar a agenda em sombra por pelo menos um ciclo de revisão. Só ampliar após verificar duplicidade zero, nenhum histórico perdido, conflitos visíveis, atraso por capacidade e minutos reais de aula. Validar a política por conta no backend antes de qualquer gravação remota.
- Para rollback local, retire a conta da lista e reinicie o Vite. Para esconder toda a projeção, desligue VITE_PLANO_ADAPTATIVO. Os checkpoints ficam guardados por época para diagnóstico. Preferências e registros oficiais continuam sob os mecanismos existentes.

### Iniciante em 90 dias

| Cenário | Revisões | Atrasadas | Retenção estimada | Minutos de revisão | Minutos de aula | Pico diário total |
|---|---:|---:|---:|---:|---:|---:|
| Adaptativo original | 159 | 61 | 93,27% | 1908 | 0 reservados | 48 |
| Adaptativo com aulas | 146 | 68 | 93,37% | 1752 | 540 | 72 |
| Legado com aulas | 90 | 83 | 79,92% | 1080 | 540 | 72 |

Os três cenários respeitam 4 revisões e 72 minutos por dia. O original deixou menos de 30 minutos livres em 25 dias com revisão e matriculou unidades sem debitar aulas. A variante reserva aulas antes de distribuir revisões. Ambos os motores concluíram as 18 aulas de 30 minutos. O adaptativo com aulas completou 56 revisões a mais que o legado e gastou mais 672 minutos de revisão. A carga de revisão, os atrasos e a margem para aulas são métricas de piloto, pois o ganho de retenção depende do modelo e do perfil sintético.

Reproduza com node --import tsx scripts/analisar-carga-iniciante.ts. A nova opção na simulação não altera as premissas do apêndice anterior, que continua reproduzindo a referência de 159 revisões.

### Validação e recuperação desta etapa

Node 24.22.3. Lint e TypeScript aprovados. Os 14 testes direcionados passaram. A suíte completa passou com 646 testes, seis acima da baseline de 640, sem falhas. Build local direto aprovado e configuração sintética com URL bloqueada rejeitada como previsto.

O Playwright verificou desktop, celular e a conta sintética autenticada. A Central concluiu uma aula com dado persistido no CAS simulado, abriu a revisão, registrou o resultado e confirmou o histórico após recarregar. Duas abas disputaram a mesma revisão do IndexedDB e só uma avançou. O reagendamento e os cartões reidratados foram lidos após novo recarregamento. Uma falha de clonagem injetada entre leitura e gravação abortou a transação e preservou a revisão anterior. Esse teste cobre o aborto transacional, sem simular desligamento físico. A evidência visual continua na pasta .evidencias-fsrs.

Ponto de recuperação da persistência local: 98ca60a. A consolidação de agenda e carga está no commit seguinte. Não houve instalação de dependências nesta etapa. A persistência compartilhada real, autorização do transporte remoto e ensaio entre dispositivos físicos seguem pendentes, conforme o protocolo acima.

## Sincronização multidispositivo

Migração local: supabase/migrations/20261126083243_fsrs_sincronizacao_compartilhada.sql. O estado oficial da conta continua no CAS existente. O novo diário fica separado, com chave por proprietário e época de dados, em schema interno. O RPC exige auth.uid(), autorização pela lista de pilotos e uma época compatível com a linha confirmada do appState. A função interna restringe search_path. RLS habilitada, acesso direto revogado e RPC indisponível para anon.

Cada dispositivo guarda eventos no IndexedDB antes de tentar a rede. A união no PostgreSQL acontece sob bloqueio da linha da conta, preserva variantes conflitantes e só incrementa a revisão de eventos ao incorporar observações. O cliente remove somente observações que recebeu confirmadas por inteiro. Repetições, perdas de resposta, erros e ACK atrasado não descartam pendências. A reconexão, o foco e a verificação periódica retomam a troca. Se a época mudou, o lote anterior fica separado para análise e nenhum evento volta automaticamente ao perfil reiniciado.

O checkpoint compartilhado é opcional e tem CAS independente. Sua confirmação exige as mesmas revisões do diário e do estado legado, além da igualdade dos conjuntos de observações. Um checkpoint obsoleto fica indisponível para leitura corrente, e o motor reidrata pelo diário. Um conflito de checkpoint não cancela eventos válidos do mesmo lote. Variantes da mesma ocorrência ficam em quarentena no replay. Eventos distintos permanecem no diário mesmo se o motor registrar uma única avaliação para a mesma unidade e instante. A agenda oficial e o histórico legado continuam operacionais. A projeção é calculada no navegador a partir da união das observações e das preferências. Preferências locais explícitas continuam locais. O último checkpoint válido aparece para consulta e fornece a retenção padrão quando não há preferência local.

O diário JSON ordenado privilegia uma transação simples nesta fase. A troca usa lotes de até 250 observações e a migração limita o diário a 8 MiB por conta e época. Deve-se medir tempo de bloqueio, volume e latência antes de ampliar o piloto. Se o limite for atingido, o servidor rejeita a gravação e o cliente retém a fila.

### Reprodução local

1. A partir de work/fsrs com Node 24, instale somente a ferramenta de teste fora das dependências da aplicação com npm install --prefix .ferramentas-fsrs --no-save --no-package-lock --ignore-scripts @electric-sql/pglite@0.6.0. Rode node --import tsx scripts/testar-fsrs-postgres-local.mjs.
2. Para repetir o navegador, inicie o Vite em 127.0.0.1:5189. Use VITE_PLANO_ADAPTATIVO=true, VITE_FSRS_SYNC_CONTAS=00000000-0000-4000-8000-000000000101 e, para o checkpoint exclusivamente local da etapa anterior, VITE_FSRS_CHECKPOINT_CONTAS com o mesmo ID. Use VITE_SUPABASE_URL e VITE_API_URL iguais a http://127.0.0.1:5189 e VITE_SUPABASE_ANON_KEY=synthetic. Deixe as variáveis de Sentry vazias.
3. Em outra sessão, defina FSRS_BROWSER_SQL_PORT=5189 e repita o script Postgres para usar IndexedDB e o cliente Supabase de dois contextos independentes. Depois execute node scripts/testar-revisoes-locais.mjs com FSRS_PORT=5189, FSRS_TESTAR_CHECKPOINT=1 e FSRS_TESTAR_SYNC=1 para verificar a ponte no aplicativo autenticado.
4. O script Postgres prepara localmente os papéis e as funções mínimas de Auth. PGlite usa uma instância embutida e serializa as transações internamente. Os dois clientes e o navegador exercitam interleaving, retry e CAS. Contenção real entre conexões Supabase e autenticação PostgREST real ficam para staging.

### Procedimento futuro de staging

1. Em operação separada, confirme o projeto isjzyyoqvftrltkctanw, a branch FSRS e a autorização de migração staging. Com a URL de conexão desse banco fornecida como STAGING_DB_URL por mecanismo de segredos, use a CLI 3.4.0 e execute supabase db push --remote="$env:STAGING_DB_URL" --skip-vault --dry-run. Prossiga com supabase db push --remote="$env:STAGING_DB_URL" --skip-vault somente se o plano listar exclusivamente 20261126083243_fsrs_sincronizacao_compartilhada.sql. Divergência de histórico exige reconciliação prévia.
2. Crie dois usuários de teste. Abra a conta piloto no fluxo legado até que seu appState esteja sincronizado. Por via administrativa, grave em study_pro_internal.fsrs_pilotos somente o UUID dessa conta com ativo = true. Deixe a segunda conta fora da lista. Confirme que os privilégios coincidem com o arquivo versionado e que anon não executa o RPC.
3. Com a prévia integralmente validada e autorizada em etapa separada, configure VITE_PLANO_ADAPTATIVO=true e VITE_FSRS_SYNC_CONTAS com apenas o UUID da conta piloto. Restrinja as variáveis à branch FSRS. Este procedimento não autoriza alterar o bloqueio atual nem usar credenciais ou dados reais.
4. Na mesma conta sintética, abra computador e celular com perfis de navegador independentes. Registre revisões diferentes para o mesmo assunto, uma em cada aparelho offline. Feche e reabra um dos perfis antes de reconectar. Reconecte ambos e confirme dois IDs no diário, zero pendências e duas avaliações aceitas para instantes distintos. Reenvie uma tentativa e simule resposta perdida no ambiente de teste. A contagem precisa continuar em dois.
5. Com o mesmo checkpoint base, confirme duas agendas diferentes simultaneamente. Uma deve avançar e a outra receber conflito. Verifique que ambas as telas convergem para a mesma revisão do diário. Teste sessão de outro usuário, token ausente, permissão direta e época antiga. Faça também um teste explícito de dois clientes PostgreSQL simultâneos no banco exclusivo de staging.
6. Rollback imediato: marque ativo = false para o piloto no servidor. Remova o UUID e a flag de compartilhamento da prévia ao publicar a revisão de rollback autorizada. As filas, os checkpoints e o estado legado permanecem disponíveis. Revise discrepâncias em leitura antes de reativar. Nenhuma etapa de rollback exige excluir dados ou tabelas.

### Resultado local desta etapa

- Node 24.22.3. Lint, TypeScript e build Vite direto passaram. A suíte completa aprovou 649 testes, preservando os 646 anteriores. O cenário de preview com a URL bloqueada continuou a falhar pelo motivo esperado.
- A migração foi executada somente no PostgreSQL embutido local. Verificações de propriedade, RLS, anon, época, retry e CAS passaram.
- Dois contextos Playwright independentes, desktop e Pixel 5, enfileiraram offline, recarregaram e reconectaram. Um perdeu o ACK após o commit. O replay final em ambos encontrou dois eventos e duas avaliações para instantes distintos, sem pendências.
- O fluxo sintético autenticado validou a ponte com o CAS legado, a sincronização de aula e revisão e a confirmação do checkpoint compartilhado. As configurações de isolamento e o bloqueio da Vercel permanecem preservados.
