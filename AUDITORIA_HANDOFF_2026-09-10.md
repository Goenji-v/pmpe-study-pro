# Auditoria do handoff - 2026-09-10

## Escopo auditado

- Repositório: `Goenji-v/pmpe-study-pro`
- Branch de referência: `feat/simulados-oficiais-integrado` (PR #143)
- Vercel: projeto `pmpe-study-pro`, time `pmpe-study-pro`
- Supabase: projeto `pmpe-study-pro` (`kibnmdwabpiwyprkrhvq`)

## Estado confirmado

- Frontend React 19 + TypeScript + Vite.
- API Express separada em `server/secureEntry.ts` / `server/index.ts`.
- Supabase Auth e PostgreSQL; 31 tabelas no schema `public`, todas com RLS ativa.
- GitHub integrado ao Vercel e previews automáticos por branch/PR.
- Funcionalidades existentes: edital, cursos, disciplinas/assuntos, missões, cronograma IA, questões, simulados, revisões, materiais, estatísticas, gamificação, painel administrativo, backup e autenticação.
- O assunto já aparece como referência em vários fluxos, mas ainda não existe uma entidade relacional única que conecte todo o ciclo acadêmico e comercial.

## Divergências e riscos encontrados

1. O Vercel identifica o framework como `brunch`, embora o projeto seja Vite.
2. O projeto Vercel está no plano Hobby, enquanto o handoff exige plano compatível com operação comercial.
3. O `main` não contém o PR #143, embora o preview mais recente use essa branch.
4. A suíte do `main` possui 2 falhas em `economiaGamificacao.test.ts` (timezone e bônus de meta).
5. O advisor de segurança do Supabase aponta RPCs `SECURITY DEFINER` executáveis por `anon` e outras funções privilegiadas expostas a `authenticated`.
6. O recurso de proteção contra senhas vazadas está desativado no Supabase Auth.
7. Não existem entidades B2B para parceiros, turmas, licenças, faturamento mensal ou auditoria comercial.
8. O README ainda é o texto padrão do Vite e não documenta operação, ambiente ou deploy.
9. Há uso híbrido de Supabase e armazenamento local; deve ser preservado onde já é parte do modelo de sincronização, sem criar uma segunda fonte de verdade para o B2B.

## Estratégia segura

1. Corrigir baseline de testes e consolidar a branch do PR #143.
2. Adicionar modelo B2B compatível e aditivo, sem apagar usuários ou tabelas existentes.
3. Criar camada de acesso e painel do parceiro com RLS por organização.
4. Bloquear a aplicação quando a licença estiver inativa/expirada, preservando admin.
5. Criar relatório mensal imutável por parceiro e trilha de auditoria.
6. Integrar o modelo acadêmico existente gradualmente, usando assunto como chave canônica.
7. Executar testes unitários, build e testes de isolamento antes de qualquer migração em produção.

## Mudanças de produção que exigem validação antes de aplicar

- Migração do modelo B2B e novas policies.
- Revogação de execução de RPCs privilegiadas.
- Ativação de proteção contra senhas vazadas.
- Alteração do plano Vercel para uso comercial.
