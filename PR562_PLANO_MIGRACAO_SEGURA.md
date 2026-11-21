# PR #562 — Plano de implantação segura do Study Pro

**Estado:** BLOQUEADO PARA PRODUÇÃO ATÉ VALIDAÇÃO INTEGRADA E APROVAÇÃO DO PROPRIETÁRIO.  
**Data da auditoria:** 21/11/2026.  
**Escopo:** controle CAS de sincronização e restauração protegida de backups.  
**Local de trabalho:** branch `fix/proteger-gravacoes-estruturais-cas`, PR #562 (DRAFT).

## Fatos auditados sem modificar o ambiente oficial

| Verificação | Staging `isjzyyoqvftrltkctanw` | Produção `kibnmdwabpiwyprkrhvq` |
|---|---|---|
| `public.salvar_estado_app_cas(bigint,jsonb)` | Wrapper `SECURITY INVOKER` para função interna privilegiada | Função PL/pgSQL direta, sem `SECURITY DEFINER` |
| `study_pro_internal.salvar_estado_app_cas` | Presente, revisão de entrada validada estritamente | Ausente |
| `public.restaurar_backup_cas(uuid,bigint,text)` | Presente, protótipo staging-only | Ausente |
| `authenticated` pode INSERT/UPDATE/DELETE em `configuracoes` | **NÃO** | **SIM** |
| `authenticated` pode SELECT em `configuracoes` | SIM | SIM |

**Implicação:** a produção ainda permite que a própria conta grave diretamente em `configuracoes` sem passar pelo CAS. Não é acesso a dados de outras contas; é um desvio das regras de concorrência/versão. A PR não deve ser promovida antes de uma migração de privilégios coordenada. Nenhuma dessas permissões foi alterada em produção nesta auditoria.

## Já testado, mas somente fora de produção

- Função CAS privada e bloqueio de gravação direta no staging.
- HTTP com JWT real emitido pelo GoTrue em sessão anônima temporária; o provedor anônimo foi desabilitado novamente e as contas fictícias excluídas.
- SQL transacional com usuários fictícios, isolação entre contas, escrita concorrente, rejeição de versões obsoletas e rollback integral dos dados de teste.
- Restauração de histórico, JSON importado e backup local com criação de checkpoint de propriedade da conta; rejeição de checksum corrompido.
- SQL do staging rejeita snapshots malformados, preserva marcador de reinício, cria backup de segurança antes da mudança e permite restaurar o estado anterior.
- Backup legado com `schemaVersion=17` deve ser migrado para checkpoint com schema 18; o SQL estrito recusa restaurar diretamente o snapshot legado.
- Navegador real local (Playwright, transporte Supabase simulado): **30 cenários de restauração + 1 teste em dois BrowserContexts independentes + 6 testes de navegação, todos aprovados** em [Actions #44894318433](https://github.com/Goenji-v/pmpe-study-pro/actions/runs/44894318433).
- Projeto staging verificado após os testes: sem contas de QA, sem estados de aluno e sem backups fictícios. Security Advisors: 0 alertas.

## Etapas obrigatórias para liberar uma implantação

1. **Teste integrado de verdade:** duas sessões independentes autenticadas no Supabase staging, navegadores com chamadas reais à API, criar registros, simular gravação simultânea, restauração via interface, queda de rede e retorno. A suíte local usa mocks e não substitui essa validação. A prévia Vercel é protegida e atualmente redireciona o navegador CI não autenticado ao login da plataforma.
2. **Revisão de código SQL e autorização:** revisão independente de todos os caminhos `SECURITY DEFINER`, `search_path`, `auth.uid()`, RLS, limites de recursos e dependências de triggers; auditoria dos outros consumidores de `configuracoes` antes de remover os grants de escrita direta.
3. **Migração de banco revisada e reproduzida:** criar funções internas CAS/restauração, wrappers `SECURITY INVOKER` e grants, preservando a assinatura de RPC usada pelo frontend. Só então revogar `INSERT/UPDATE/DELETE` diretos de `authenticated` em `public.configuracoes`. Executar primeiro em clone do esquema com fixtures e com transação/rollback documentados.
4. **Plano de proteção de dados:** exportar e verificar um snapshot/salvamento recuperável da base oficial, registrar versão/DDL existente das funções e ACLs para reversão **sem reescrever estados de alunos**. NUNCA restaurar um dump antigo de estados por cima de atualizações concorrentes.
5. **Compatibilidade e configuração do cliente:** a restauração da PR só é ativada com `VITE_STUDY_PRO_STAGING_GUARD=true` **e** URL explícita do staging. Publicar o frontend atual em produção NÃO ativa automaticamente esse recurso. A flag e o guarda de URL devem ser reprojetados, revisados e testados para operação em produção antes do lançamento — sem permitir misturar URLs e credenciais de staging/produção.
6. **Rollout controlado:** preparar horário de implantação, não permitir cliente novo com função de banco antiga, verificar respostas CAS e RLS com conta dedicada, observar erros de sincronização, revisar rollback de código e **não** fazer rollback do histórico do aluno por sobrescrita.
7. **Aprovação do proprietário:** somente após relatório completo de testes reais e plano de reversão aprovado. Manter a PR como DRAFT até este ponto.

## Não fazer

- Não aplicar `supabase/staging-tests/restaurar_backup_cas_prototype.sql` diretamente ao projeto oficial.
- Não habilitar Anonymous Sign-Ins em produção para facilitar testes.
- Não remover proteção da prévia Vercel sem uma alternativa de acesso restrito.
- Não copiar contas ou histórico reais para staging.
- Não fazer merge em `main` nem aplicar migrations/revogar privilégios do banco oficial sem aprovação expressa.

## Como validar a prévia

- [PR #562](https://github.com/Goenji-v/pmpe-study-pro/pull/562)
- [Última execução Playwright aprovada desta rodada](https://github.com/Goenji-v/pmpe-study-pro/actions/runs/44894318433)
- A Vercel gera um deploy separado para cada commit; conferir o `READY` do **HEAD** da PR antes de encaminhar um link de revisão.
