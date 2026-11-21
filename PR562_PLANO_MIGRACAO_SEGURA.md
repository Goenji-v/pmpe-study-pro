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

## Novo bloqueio confirmado — GoTrue real e histórico imutável (21/11/2026)

### Tentativa de teste Auth real

Foi implementado `scripts/qa/staging-real-auth-pr562.mjs`, usando exclusivamente a **chave pública** do staging, nunca uma service-role key. O script **não cria mais usuários automaticamente**: exige duas contas de QA pré-existentes e confirmadas, com `app_metadata.study_pro_qa=true` definido pelo administrador. Ao iniciar, recusa contas com histórico já existente e exige duas sessões GoTrue independentes da conta A para exercitar CAS, RLS e restauração transacional pela API.

As execuções efetivas no GitHub Actions registraram:
- `email_address_invalid` no primeiro ensaio (domínio reservado `example.com` rejeitado pelo provedor).
- Após ajustar o e-mail para domínio aceito: `over_email_send_rate_limit`, o limite de e-mails de confirmação do próprio Supabase Auth.
- **Nenhum usuário de teste foi criado** (`auth.users` com marcador `study-pro-pr562-authenticated-e2e-20261121`: zero). Não houve login real nem execução das etapas CAS/RLS pela sessão de e-mail.
- O workflow automático de inscrição foi **removido**, para evitar novas tentativas desnecessárias e preservar o limite de e-mails. O script permanece apenas como ferramenta de QA opt-in, desativado por `STUDY_PRO_AUTH_QA_ENABLED` na ausência de autorização/configuração.
- O login anônimo continua DESATIVADO; não mudar isso nem diminuir a proteção de e-mail por conveniência.

**Para fechar o E2E integrado:** providenciar via fluxo oficial de Auth Admin **contas temporárias de teste com e-mails confirmados**, ou infraestrutura de e-mail de QA (SMTP e inbox sob controle do proprietário), sem trocar senhas no chat e sem usar dados de alunos; configurar apenas no staging, executar testes com duas sessões reais e remover contas ao término. Sem isso, relatar o bloqueio como pendência — um job `success` que só registra o bloqueio **não comprova E2E real**.

### Nova correção anti-regressão

No Supabase staging, `study_pro_internal.tem_regressao_historico` comparava histórico por IDs mas ignorava toda a checagem quando `configuracoes.dadosReiniciadosEm` mudava. Um estado local desatualizado poderia remover sessões ao alterar apenas esse marcador.

O SQL isolado `supabase/staging-tests/proteger_ids_historico_cas.sql` foi atualizado: **a troca do marcador não desativa mais o bloqueio de regressão no CAS comum**. Para zerar a conta ou restaurar um histórico menor, usar obrigatoriamente a função de restauração transacional que salva a versão anterior primeiro.

Teste PostgreSQL real (transação com `ROLLBACK`): CAS com marcador alterado e sessão excluída foi rejeitado e salvou evidência; a RPC `public.restaurar_backup_cas` com confirmação aceitou a operação, criou backup de segurança e persistiu o estado solicitado. Nenhum dado de QA permaneceu.

**Atenção:** isto é uma política nova testada somente na prévia; antes de migrar para produção, revisar todos os pontos da interface que intencionalmente reduzem histórico e encaminhá-los à operação transacional confirmada.

### Procedimento seguro para liberar o teste integrado

1. **Somente no projeto Supabase STAGING** (`isjzyyoqvftrltkctanw`), administrador autorizado cria duas contas de QA via *Authentication → Users* / Auth Admin, com e-mail controlado, senha aleatória e confirmação de e-mail. Não desativar verificação de e-mail para o projeto.
2. Marcar ambas com `app_metadata.study_pro_qa=true` usando o Auth Admin na infraestrutura autorizada (não `user_metadata` editável pelo usuário). Não usar nenhuma conta existente com dados de estudo.
3. Fornecer ao executor de QA as quatro variáveis de segredo **em ambiente privado**, nunca em commit, chat, logs públicos ou variáveis `VITE_`: `STUDY_PRO_QA_EMAIL_A`, `STUDY_PRO_QA_PASSWORD_A`, `STUDY_PRO_QA_EMAIL_B`, `STUDY_PRO_QA_PASSWORD_B`.
4. O teste usa `STUDY_PRO_AUTH_QA_ENABLED=true`, `VITE_SUPABASE_URL=https://isjzyyoqvftrltkctanw.supabase.co` e a **chave pública** do staging em `VITE_SUPABASE_ANON_KEY`. O script valida a identidade das contas, o marcador de QA e a ausência de histórico antes de gravar.
5. Executar `node scripts/qa/staging-real-auth-pr562.mjs` em executor seguro. A execução deve **falhar** se não houver autenticação real, credenciais completas ou se a conta tiver histórico.
6. **Limpeza obrigatória:** revogar sessões, excluir as duas contas e registros de QA pelo Admin, confirmar zero contas/estados/backups de teste no staging e executar os Security Advisors. O script não faz exclusão automática de usuários nem gerencia credenciais administrativas.
7. Só após esse teste com API real, executar Playwright no navegador com as mesmas sessões de QA, incluindo teste de desconexão; manter a proteção da prévia Vercel ativa. Esta fase ainda não foi realizada.

### Validação adicional da restauração — registros de estudo malformados

O SQL staging `supabase/staging-tests/restaurar_backup_cas_prototype.sql` e o TypeScript `validarIntegridadeEstado` agora rejeitam itens nulos, IDs vazios e IDs repetidos em `sessoes`, `questoes`, `revisoes` e `simulados`. O SQL valida os registros **antes** de criar a cópia de segurança ou substituir o estado.

Teste SQL em transação revertida: **8 combinações inválidas bloqueadas** sem alterar revisão ou estado; backup válido aceito com cópia de segurança. Nenhum usuário ou dado fictício persistiu.

