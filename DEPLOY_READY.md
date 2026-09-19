# Study Pro — publicação da estabilização

Branch de entrega: `fix/stabilization-2026-09-19`  
PR: #261  
Frontend: Vercel  
Backend: Render  
Banco/Auth: Supabase

## Regra principal

Não usar `supabase db push` nesta publicação. O histórico antigo de timestamps das migrações no repositório não coincide integralmente com o histórico registrado no projeto de produção. Aplicar somente as duas migrações novas desta rodada, na ordem abaixo.

## Pré-flight

1. Confirmar Quality Gate verde no HEAD do PR.
2. Confirmar que a cota de builds do Vercel voltou a permitir novos deploys.
3. No Render de produção, configurar com **Save only**:
   - `SUPABASE_SERVICE_ROLE_KEY` — segredo exclusivo do backend.
   - `SUPABASE_ANON_KEY` — chave pública de validação de sessão.
   - `NODE_VERSION=24.21.0`.
   - manter `FRONTEND_URL=https://pmpe-study-pro-two.vercel.app`.
4. Não expor `SUPABASE_SERVICE_ROLE_KEY` com prefixo `VITE_` nem no frontend.

## Publicação em duas fases

### Fase 1 — preparação não destrutiva

Aplicar somente:

`supabase/migrations/20260919190000_harden_ai_generation_security.sql`

Essa fase:
- cria `ia_consumo_janelas`;
- cria `consumir_cota_ia`;
- garante acesso da `service_role`;
- **não remove** as permissões atuais do cliente em `geracoes_ia_jobs`.

Depois da aplicação, confirmar que a tabela e a função existem.

### Fase 2 — publicar código

1. Mesclar o PR #261 na `main`.
2. Vercel e Render iniciam os deploys.
3. O backend novo falha cedo se `SUPABASE_SERVICE_ROLE_KEY` estiver ausente, evitando promover uma API parcialmente quebrada.
4. O E2E Production espera:
   - frontend com o SHA atual;
   - `/api/saude` do Render com o mesmo SHA.
5. Só continuar quando o deploy do Render estiver `LIVE`, o Vercel estiver `READY` e o primeiro job E2E estiver verde.

### Fase 3 — bloquear escrita direta do cliente

Aplicar somente:

`supabase/migrations/20260919193000_finalize_ai_generation_job_security.sql`

Depois conferir:
- `authenticated`: somente `SELECT` em `geracoes_ia_jobs`;
- policy `geracoes_ia_jobs_select_own` permanece ativa;
- `service_role`: `SELECT/INSERT/UPDATE/DELETE`;
- `anon`: sem acesso;
- geração persistente continua funcionando.

## Validação funcional

Validar com conta E2E dedicada:
- login e recarregamento;
- Dashboard sem sobreposição;
- questão → resposta → correção → salvamento;
- retomada de geração;
- revisão atrasada/hoje/futura;
- indicadores atualizados;
- Área do Parceiro e permissões;
- mobile sem overflow horizontal.

Não usar contas nem registros reais de alunos para testes destrutivos.

## Rollback

Se o código novo falhar **antes da Fase 3**:
- reverter/promover o último deploy estável no Vercel;
- rollback/redeploy do último backend estável no Render;
- a Fase 1 é compatível com o código antigo e pode permanecer sem impacto funcional.

Se houver falha **depois da Fase 3**:
1. restaurar temporariamente as permissões anteriores de `geracoes_ia_jobs` apenas se for necessário voltar ao backend antigo;
2. restaurar as policies `insert/update/delete own` da migração original;
3. reverter frontend/backend;
4. investigar antes de tentar nova publicação.

Não apagar `ia_consumo_janelas` durante rollback; ela é aditiva e não interfere no fluxo antigo.

## Pós-deploy

- Executar Security Advisor do Supabase.
- Conferir logs do Render por 5xx/429 anormais.
- Conferir E2E Production completo.
- Confirmar que nenhum segredo foi exposto em logs.
- Manter o PR/commit de release registrado para rollback.
