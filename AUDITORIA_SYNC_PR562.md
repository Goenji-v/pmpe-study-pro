# Study Pro — auditoria de sincronização (PR #562)

Data: 2026-11-20. Escopo: **somente leitura** no Supabase hospedado; nenhuma query de INSERT, UPDATE, DELETE, DDL ou chamada RPC de escrita executada contra produção.

## Ambientes conferidos
- `pmpe-study-pro`: ACTIVE_HEALTHY; considerado **produção**.
- `pmpe-study-pro-staging`: INACTIVE; não foi reiniciado nem recebeu dados de teste.
- Frontend: branch `fix/proteger-gravacoes-estruturais-cas` apenas; main não alterada.

## Resultado da inspeção do banco
1. `public.salvar_estado_app_cas(bigint, jsonb)` existe e é `SECURITY INVOKER` (não `SECURITY DEFINER`).
2. `authenticated` possui EXECUTE; `anon` **não** possui EXECUTE.
3. `configuracoes` e `backups` usam RLS, com políticas SELECT/INSERT/UPDATE/DELETE limitadas por `auth.uid() = user_id`.
4. A implementação SQL usa `SELECT ... FOR UPDATE`, compara `syncRevision`, recusa divergência de revisão e verifica regressão do tamanho de históricos.
5. **Risco residual:** `authenticated` possui UPDATE/INSERT diretos sobre `public.configuracoes` da própria conta. Isso significa que a política da tabela **não impõe CAS para qualquer cliente**: o cliente oficial passou a usar CAS em todos os fluxos identificados, mas um cliente alternativo com sessão válida ainda pode escrever o próprio snapshot diretamente. Um reforço no banco exige avaliar RLS, privilégios, demais usos da tabela e `SECURITY INVOKER` antes de qualquer alteração.
6. A função SQL aceita o `syncRevision` enviado em `p_estado` e não impõe por si só `p_estado.syncRevision = p_expected_revision + 1`; o frontend oficial calcula essa revisão corretamente. Esse é outro possível endurecimento do contrato RPC, a estudar em staging.

## Testes já realizados
- Vercel (commit `2085512`): build READY; `npm run build` com **599 testes aprovados e zero falhas**.
- Simulação de concorrência em `server/contaInicialProvider.test.ts`: a segunda tentativa baseada na mesma revisão é recusada.
- Simulação de perda de resposta após commit: retentativa com versão antiga é recusada e o estado mais novo é mantido.
- Verificações de código impedem reintroduzir `upsert` direto no serviço de estado completo.
- **Limitação:** os testes acima usam um Supabase simulado. Não foi realizado ensaio real de dois clientes contra Postgres isolado.

## Testes de integração pendentes (somente no staging isolado)
1. Reativar staging apenas quando apropriado, confirmar esquema e políticas, criar conta de teste sem vínculos com alunos.
2. Ler revisão R; executar duas chamadas CAS concorrentes com base em R; confirmar que uma é aceita e outra recusada.
3. Simular commit confirmado sem resposta e retentativa com a revisão R; confirmar rejeição sem perda do snapshot aceito.
4. Simular migração de schema e backup antes da escrita; verificar que conflito preserva ambas as versões.
5. Confirmar isolamento entre usuários (RLS) e persistência de IDs, missões, sessões, revisões e simulados.
6. Executar rollback apenas no staging, se necessário. Jamais usar a conta principal como cobaia.

## Critério de liberação
- PR #562 permanece em **draft**.
- Nenhum deploy/merge oficial até os testes de integração de staging e revisão do risco residual de privilégios diretos.


## Execução de testes reais no staging — 2026-11-20
- Projeto: `pmpe-study-pro-staging` (`isjzyyoqvftrltkctanw`), verificado como `ACTIVE_HEALTHY`.
- Banco estava sem tabelas do Study Pro e sem migrações registradas. Foi aplicada a migração **somente no staging** `staging_sync_harness_isolated`, criando duas tabelas mínimas (`configuracoes`, `backups`), a função interna de antirregressão e a função CAS adaptada diretamente da migração do repositório.
- Os esquemas das tabelas de teste reproduzem as colunas essenciais e as regras RLS do oficial; **a base não representa a instalação completa do Study Pro** e não recebeu foreign keys para `auth.users` (IDs fictícios são usados exclusivamente nos testes SQL).
- Testes transacionais realizados sob papel `authenticated`, com identidades fictícias e `ROLLBACK`:
  1. Primeira gravação com revisão base 0: aceita.
  2. Segunda tentativa com revisão 0 após a primeira: rejeitada; conteúdo preservado.
  3. Atualização com revisão correta 1: aceita.
  4. Regressão de histórico com revisão correta 2: rejeitada.
  5. RLS: segundo usuário não consegue selecionar dados do primeiro; consegue criar o próprio estado.
- Foram testes **sequenciais de versão obsoleta**, não duas conexões verdadeiramente simultâneas. Cenário de concorrência real e resposta de rede perdida ainda requerem prova adicional.
- Após os testes: `select count(*)` confirmou **0 linhas em configuracoes e 0 linhas em backups**.
- Supabase Security Advisors no staging: **0 avisos** na configuração desse harness.
- Não houve alteração no projeto `pmpe-study-pro` oficial.
- Ainda existem os riscos conhecidos da auditoria: escrita direta por `authenticated` em `configuracoes` e campo `syncRevision` do CAS não validado estritamente no SQL. Exigem uma etapa separada de hardening, primeiro no staging.

## Hardening adicional executado apenas no staging
- Migration `staging_cas_reject_invalid_revision_payload`: função `public.salvar_estado_app_cas` passa a exigir `p_expected_revision` válido (inteiro não negativo sem overflow), `p_estado` JSON objeto e `syncRevision` numérico exatamente igual a `p_expected_revision + 1`. Falha retorna SQLSTATE `22023` antes de qualquer gravação.
- Migration `staging_sync_remove_unneeded_direct_table_privileges`: revogadas de `authenticated` permissões `DELETE, TRUNCATE, TRIGGER, REFERENCES` em `configuracoes`; e `TRUNCATE, TRIGGER, REFERENCES` em `backups`. Preservadas permissões necessárias para CAS `SECURITY INVOKER`.
- Teste real sob papel `authenticated`, transação com `ROLLBACK`: quatro payloads inválidos recusados, criação e progressão válidas aceitas, retry antigo recusado, regressão de histórico bloqueada e RLS entre dois usuários preservado.
- **Teste de contorno (confirmado):** `authenticated` ainda consegue fazer `UPDATE public.configuracoes` da própria linha, alterando `syncRevision` sem RPC. A operação foi testada em transação revertida; confirma que **a proteção CAS ainda pode ser contornada por gravação direta**. Não afirmar proteção integral.
- Segurança Advisor do staging: 0 avisos reportados (isso não elimina o risco de UPDATE direto).
- Para bloquear UPDATE direto mantendo a RPC funcionando será necessária mudança arquitetural cuidadosamente auditada (p.ex. servidor autorizado/rota de escrita isolada) e novos testes de autorização. Não revogar UPDATE indiscriminadamente da RPC `SECURITY INVOKER`, pois isso quebra salvamento.
- Nenhuma das duas migrações novas foi aplicada à produção; devem ser revisadas e versionadas de maneira apropriada antes de qualquer rollout.

## Gate CAS privado (staging) — 2026-11-20

- A implementação SQL CAS existente foi movida do schema exposto `public` para `study_pro_internal`, com execução `SECURITY DEFINER` e `search_path = ''`. O corpo usa `auth.uid()` e somente tabelas/funções com nomes qualificados. **Esta implementação interna não deve ser exposta na Data API**.
- Um wrapper SQL `public.salvar_estado_app_cas(bigint,jsonb)` continua `SECURITY INVOKER`, permitido apenas a `authenticated`, delegando para a implementação privada.
- A role `authenticated` perdeu `INSERT/UPDATE/DELETE` direto em `public.configuracoes`, mantendo leitura RLS. Também revogados direitos extras de `anon`/`public` nessa tabela.
- Testes SQL reais sob `authenticated` com `ROLLBACK`: INSERT e UPDATE diretos negados; CAS normal aceito; revisão antiga negada; antirregressão negou perda de sessões; RLS bloqueou leitura de outra conta e permitiu salvamento da própria conta. Revisão adulterada recusada e `anon` sem EXECUTE.
- Verificações de permissões: `authenticated` SELECT=true, INSERT/UPDATE/DELETE=false; RPC pública executável por authenticated=true, anon=false; wrapper SECURITY DEFINER=false; função interna SECURITY DEFINER=true.
- Advisors de segurança do estágio: 0 alertas; tabelas após teste: 0 configurações, 0 backups.
- SQL do gate privado salvo em `supabase/staging-tests/cas_private_gateway_prototype.sql`, propositalmente fora de `supabase/migrations`, pois o protótipo **não está pronto para ser aplicado automaticamente à produção**.
- Limites: teste executado em harness mínimo sem todo esquema do Study Pro, e com sessão simulada via `set local role authenticated` e `request.jwt.claim.sub` em SQL; ainda faltam testes E2E com tokens reais via PostgREST, concorrência entre conexões independentes e compatibilidade com demais consumidores da tabela.
- Nenhuma mudança no banco oficial ou no site oficial.
