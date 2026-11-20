# Study Pro — staging isolado para ensaio de sincronização (PR #562)

## Escopo e fronteiras
- Ambiente **único de destino**: Supabase `pmpe-study-pro-staging` (`isjzyyoqvftrltkctanw`).
- Banco oficial `pmpe-study-pro` foi consultado **somente para metadados de estrutura** (`pg_catalog`, `information_schema`, políticas, nomes de buckets e definição de funções). Não foram copiadas linhas de usuários, sessões, questões, pagamentos, arquivos ou segredos.
- A estrutura do banco staging foi recriada **vazia** a partir do catálogo de produção; não representa um dump de dados nem é um mecanismo automático para atualizar produção.
- Não ativar backups automáticos, `pg_cron` de produção ou qualquer rotina de envio externo no staging.
- A PR permanece em rascunho; **nunca fazer merge/deploy oficial sem aprovação do proprietário**.

## Estrutura do banco staging
1. Harness de CAS com `configuracoes` e `backups`, RLS de proprietário e gate privado `study_pro_internal.salvar_estado_app_cas`. `public.salvar_estado_app_cas` é wrapper `SECURITY INVOKER`. A permissão direta de INSERT/UPDATE/DELETE de `configuracoes` está revogada de `authenticated`.
2. Estruturas das outras 68 tabelas públicas derivadas dos metadados do banco oficial, com colunas, defaults, identidade, constraints, relações, índices e RLS ativo. Total alvo **70 tabelas públicas**.
3. Políticas RLS das demais tabelas, privilégios de tabela limitados a SELECT/INSERT/UPDATE/DELETE por função e papéis, espelhando as regras existentes, sem habilitar TRUNCATE para clientes.
4. Funções `public` (exceto CAS substituída pelo gate), `private`, `api_private` reconstruídas com base em suas definições, e grants explícitos iguais aos direitos de execução de `authenticated`/`anon` no oficial. Os schemas privados não estão expostos pelo Data API.
5. Triggers das 70 tabelas e trigger de criação de perfil `on_auth_user_created` na tabela `auth.users`.
6. Quatro buckets de Storage replicados **apenas como metadados**, vazios: `fundos-dashboard`, `imagens-publicas`, `loja-wallpapers`, `materiais`. As 14 políticas de Storage também foram reproduzidas.
7. Duas Edge Functions implantadas do código na branch de testes: `importar-curso-publico` e `publicar-questoes-ia`, ambas com verificação JWT ativa. A função legada `e2e-simulado-pdf-20260930` não foi implantada (não é parte das funcionalidades normais). Nenhuma credencial externa de produção foi transferida.

## Isolamento do Vercel
- Branch Preview `fix/proteger-gravacoes-estruturais-cas` possui `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` exclusivos do staging.
- `VITE_STUDY_PRO_STAGING_GUARD=true` bloqueia no código uma URL Supabase diferente da do staging.
- `VITE_API_URL=https://study-pro-staging-api.invalid` **desabilita intencionalmente chamadas ao backend Render oficial**, até que um servidor API staging separado esteja operacional. O frontend bloqueia inicialização se receber outra URL de API sob a guarda. Assim, geração de IA e análises por backend externo não funcionarão na prévia por enquanto.
- `VITE_SENTRY_DSN` vazio exclusivamente nessa branch para evitar misturar eventos de teste ao monitoramento oficial.
- Configurações globais de produção não foram alteradas. **Deploys antigos** não devem ser usados para testes.

## Limitações / critérios de liberação
- Staging é **schema-only**: não contém cursos reais, questões oficiais nem materiais de alunos. Fluxos dependentes de dados públicos podem aparecer vazios até que sejam criadas **fixtures fictícias**.
- A configuração de Auth HTTP (registro por e-mail, confirmação e redirecionamentos) deve ser verificada em um navegador com conta fictícia. Testes SQL com `SET ROLE authenticated` e claims simulados **não equivalem a JWT real via PostgREST**.
- Ainda requer teste ponta a ponta com dois clientes navegadores, reconexão, recuperação de backup, fluxos de IA com backend staging próprio e revisão independente das funções SECURITY DEFINER.
- Nada foi aplicado ao banco ou site oficial. A PR #562 é exclusivamente de avaliação.

## Ensaio final
Registrar separadamente os testes no PostgreSQL staging (em transação revertida), a verificação de tabelas/políticas/grants/funções, o estado do deployment Vercel, e quaisquer bloqueios remanescentes. Não afirmar cobertura integral de navegador sem efetivamente executá-la.

## Ensaio com autenticação HTTP real (PR #562)

- Teste temporário `server/stagingAuthHttp.test.ts`, executado no build Vercel **somente quando** `STAGING_AUTH_HTTP_TEST_ENABLED=true` e a URL/guard indicarem staging exatamente.
- Credenciais para duas contas fictícias armazenadas apenas como variáveis criptografadas da branch; não são commitadas nem expostas no frontend.
- Fase `signup`: cadastro de contas exclusivamente no Supabase staging via GoTrue HTTPS.
- Fase `login`: autenticação real via GoTrue com duas sessões do usuário A (PC/celular) e usuário B independente; RPC CAS concorrente via PostgREST, RLS de outra conta, escrita direta recusada, revisão antiga e antirregressão. Uma falha de teste falha o build.
- Após executar, desativar a variável de teste da branch e eliminar as duas contas fictícias do Auth staging (incluindo dados associados por cascade).
- Nenhuma conta real nem as credenciais de produção devem ser usadas. A verificação ainda não substitui Playwright em dois dispositivos físicos.

- Contas fictícias usam o domínio reservado `example.com`; o Auth hospedado rejeitou `example.invalid` na primeira tentativa. Nunca usar endereço pessoal ou dados reais neste ensaio.

## Resultado da etapa Auth HTTP — 20/11/2026
- Teste real sem sessão em `server/stagingPublicHttp.test.ts`: GoTrue `/auth/v1/health` respondeu HTTP 200; chamadas HTTP anônimas de leitura `configuracoes` e `perfis` e a RPC CAS foram recusadas. **PASS** no build Vercel.
- Tentativa opt-in de criação de duas contas via API pública GoTrue em `server/stagingAuthHttp.test.ts`: domínios de documentação foram rejeitados como inválidos; tentativa com e-mails de teste randômicos chegou ao limite de envio de e-mails (`email rate limit exceeded`). Portanto, **não há alegação de login real validado**.
- `STAGING_AUTH_HTTP_TEST_ENABLED` foi desativado na branch e as seis variáveis temporárias do ensaio (modo, enable, emails e senhas) foram neutralizadas. Esse teste permanece no código com `skip` por padrão.
- As tentativas de Auth não criaram usuário permanente: verificação do staging mostrou 0 contas de teste, 0 linhas de `configuracoes` e 0 linhas de `backups`.
- A extensão de diagnóstico SQL `http` e o schema temporário `staging_test_http` foram desinstalados do staging após a investigação.
- Build `1e025a20`: **602 testes aprovados, 1 teste opt-in pulado, 0 falhas**, deployment Vercel READY.
- Security Advisors staging: 0 alertas.
- **Pendente para liberação**: obter uma conta fictícia por fluxo suportado pelo Supabase Auth sem atingir a cota de e-mail; executar login real e duas sessões autenticadas, sincronização na UI, restauração de backups e simulação de perda de conexão; teste Playwright não foi realizado.
- Nenhuma alteração no banco/site oficial; PR continua draft.
