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
