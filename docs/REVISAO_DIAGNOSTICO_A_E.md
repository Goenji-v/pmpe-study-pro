# Revisão das correções A–E

Branch: `fix/diagnostico-a-e`, baseada em `cf0d759597af07d427b7ff6c42503bf1b16f1264` (`main` no início do trabalho).

As reproduções usam dados sintéticos, componentes React reais com DOM simulado e mocks nas fronteiras de autenticação, armazenamento e rede. Não foram aplicadas migrações remotas nem modificados dados reais.

| Item | Defeito confirmado | Comportamento corrigido |
| --- | --- | --- |
| A | Salvar ou restaurar padrões revertia o saldo atualizado de 25 para 10. | O formulário contém somente preferências editáveis e as aplica ao estado mais recente com atualização funcional. Economia, recompensas, metadados e edital atual são preservados. |
| B | Uma atividade espelhada em sessão e registro somava 60 minutos por matéria, contra 30 no total. | Central e Relatório usam a deduplicação consolidada. IDs prevalecem sobre nomes; aliases exatos mantêm compatibilidade; atividades e IDs distintos não são fundidos. |
| C | Consulta nominal e filtro atual escondiam PDFs cadastrados como Constitucional. | Filtros, agrupamentos e perfil recebem IDs e referências legadas. Alias exato reconhece Direito Constitucional; assuntos ambíguos não são associados por aproximação. Consultas mantêm escopo por usuário e percorrem todas as páginas; seleção entre assuntos homônimos usa IDs. |
| D | Cartão mostrava 321 minutos e 1 revisão; perfil mostrava 223 minutos e 6 revisões. | Uma fonte calcula ambos: 223 minutos e 140 questões no caso sintético. Ambos identificam separadamente 1 revisão pendente e 6 concluídas. O perfil mostra horas com arredondamento de duas casas. |
| E | Topo indicava 2 dias e cartão 0 para as mesmas atividades. | Topo, cartão, semana e conquistas usam a mesma regra de atividade e dia local. Hoje em andamento preserva ontem; um dia completo sem estudo zera a sequência atual. Recordes e conquistas já recebidas permanecem históricos; sessões vazias/futuras não concedem novas conquistas. |

O escopo das métricas do assunto é seu histórico integral. IDs legados conhecidos sobrevivem a renomeações e movimentações; IDs conflitantes e nomes ambíguos não são substituídos por aproximações. Revisões concluídas antigas sem data de conclusão contam como estado concluído nesse histórico, sem inventar uma data de atividade.

Validação reproduzível a partir da raiz do checkout:

```bash
node --require ./scripts/block-test-network.cjs --import tsx --test server/*.test.ts
npm run lint -- --deny-warnings --format=agent
SENTRY_AUTH_TOKEN= VERCEL_ENV=development npm run build:app
node scripts/check-build-budget.mjs
TZ=UTC node --require ./scripts/block-test-network.cjs --import tsx --test server/sequenciaAtividadesRegressao.test.ts server/sequenciaDashboardRegressao.test.ts
TZ=America/Sao_Paulo node --require ./scripts/block-test-network.cjs --import tsx --test server/sequenciaAtividadesRegressao.test.ts server/sequenciaDashboardRegressao.test.ts
```

O preload bloqueia fetch sem mock e conexões TCP, inclusive localhost, e marca a execução como falha mesmo se a exceção for capturada. IPC por socket Unix continua permitido para ferramentas locais. Não deve ser usado para suítes que deliberadamente precisam de um serviço integrado.

O build executa TypeScript e Vite com upload de source maps desativado para esta revisão. Não há publicação do aplicativo nessa validação.

Resultados finais: 536 testes passaram, zero falhas e zero testes ignorados (baseline: 499; 37 testes adicionais). Os 10 testes de sequência passaram em UTC e America/Sao_Paulo. Lint com --deny-warnings, TypeScript, build Vite, budget de frontend e git diff --check passaram. A suíte completa terminou com código 0 usando o bloqueio de rede, sem tentativas de acesso sem mock.

Pendências e limites: integração real com Supabase/Gemini não foi executada; faltam endpoint e credenciais de um ambiente de testes. Os E2Es existentes têm produção como destino padrão e não foram executados. As regressões novas não dependem dessas credenciais. Históricos legados ambíguos permanecem sem associação automática, sem migração remota. A API do GitHub foi bloqueada pelo proxy com HTTP 403 no CONNECT; abertura de PR depende desse acesso.

Arquivos alterados/adicionados:

- `scripts/block-test-network.cjs`
- `server/configuracoesConcorrentes.test.ts`
- `server/inteligenciaMinutosRegressao.test.ts`
- `server/materiaisIdentidade.test.ts`
- `server/metricasAssuntoIdentidade.test.ts`
- `server/metricasAssuntoUnificadas.test.ts`
- `server/sequenciaAtividadesRegressao.test.ts`
- `server/sequenciaDashboardRegressao.test.ts`
- `src/components/DashboardGamificacaoSpotlight/DashboardGamificacaoSpotlight.tsx`
- `src/components/MateriaisDoAssunto/MateriaisDoAssunto.tsx`
- `src/components/PerfilAssunto/PerfilAssunto.tsx`
- `src/hooks/useDiaLocalAtual.ts`
- `src/pages/CentralInteligencia/CentralInteligencia.tsx`
- `src/pages/CentroMateriais/CentroMateriais.tsx`
- `src/pages/Configuracoes/Configuracoes.tsx`
- `src/pages/Dashboard/Dashboard.tsx`
- `src/pages/Estudos/Estudos.tsx`
- `src/pages/RelatorioInteligente/RelatorioInteligente.tsx`
- `src/services/conquistasPermanentes.ts`
- `src/services/inteligencia/calcularCentralInteligencia.ts`
- `src/services/inteligencia/relatorioInteligenteService.ts`
- `src/services/inteligencia/types.ts`
- `src/services/materiaisService.ts`
- `src/utils/identidadeMateriaHistorico.ts`
- `src/utils/identidadeMateriais.ts`
- `src/utils/metricasAssunto.ts`
- `src/utils/metricasConsolidadas.ts`
- `src/utils/sequenciaAtividades.ts`
- `docs/REVISAO_DIAGNOSTICO_A_E.md`
