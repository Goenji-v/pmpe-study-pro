# Plano de recuperação — Study Pro Premium

Data do inventário: 2026-09-21

## Regra de ouro
- `main` é a fonte funcional e de segurança.
- `preview-premium` é referência visual/experimental.
- Não fazer merge geral da preview na main.
- Toda recuperação parte de `recovery/study-pro-premium`.
- Cada área entra em PR separada, com build e teste desktop/mobile.

## Proteções
- `backup/main-2026-09-21`
- `backup/preview-premium-2026-09-21`
- `recovery/study-pro-premium`

Merge-base analisado: `cf89ca72414dbcb905842a759e7c676ce8a58337`.
Depois dele, a preview tem 113 commits próprios e a main 141.

## Inventário

| Área | Situação | Decisão |
|---|---|---|
| Dashboard Hero Premium | Só na preview | Recuperar visualmente sobre o Dashboard atual |
| Cards compactos do Dashboard | Só na preview | Recuperar depois do Hero |
| Desempenho geral | Já existe no oficial em implementação React mais segura | Manter oficial |
| Meta semanal compacta | Só na preview; script antigo manipula DOM | Refazer nativamente em React |
| Fundo/arte da missão PMPE | Só na preview | Recuperar depois do Hero |
| Header Premium com busca/data | Só na preview | Recuperar apenas desktop, preservando mobile atual |
| Sidebar Premium | Parcialmente recuperada | Manter estrutura atual; avaliar só arte/quote e detalhes visuais |
| Arte de montanhas/frase da Sidebar | Só na preview | Opcional, desktop-only |
| Tema azul/claro/escuro | Igual nas duas | Não mexer |
| Temas/molduras da Loja | Já no oficial | Não mexer |
| Fundos compráveis para Dashboard | Só na preview | Recuperar em fase própria |
| Importador por URL/script | Existe nos dois | Manter oficial |
| Importador HTML/ZIP sem F12 | Só no oficial e mais novo | Manter oficial |
| Função Supabase importar curso público | Igual nas duas | Não mexer |
| Admin de parcerias | Oficial é mais novo | Manter oficial |
| Área do parceiro | Oficial é mais novo e mais restritivo | Manter oficial |
| IA Coach | Igual nas duas | Não mexer |
| Central de Estudos | Preview tem acabamento CSS diferente; main evoluiu lógica | Trazer só diferenças visuais selecionadas |
| Central de Questões | Preview divergiu muito e é monolítica | Manter arquitetura oficial; usar preview como referência visual |
| Banco de questões/favoritas/subassunto | Já existe no oficial | Não voltar à preview |
| Notificações | Oficial é mais novo | Manter oficial |
| Cronômetro de questões | Oficial é mais novo | Manter oficial |
| Demo Completo | Só preview, usa estado/dados de laboratório | Não migrar como funcionalidade |
| Revisões Premium da Demo | Só preview/laboratório | Usar como referência visual e reconstruir sobre a tela atual |
| Estatísticas Premium da Demo | Só preview/laboratório | Usar como referência visual |
| PWA/cache/error recovery | Oficial é mais novo | Manter oficial |
| Segurança/Supabase/RLS | Oficial é muito mais novo | Não substituir por arquivos antigos |

## O que realmente falta e vale recuperar

### Prioridade A — Dashboard
1. Hero Premium.
2. Arte/fundo da missão.
3. Cards compactos.
4. Meta semanal compacta reescrita em React com dados reais.
5. Header Premium somente no desktop.

### Prioridade B — Personalização
1. Fundos de Dashboard na Loja.
2. Aplicação segura do fundo equipado.
3. Administração dos fundos após revisar banco/storage/permissões.

### Prioridade C — Refinamentos
1. Diferenças visuais da Central de Estudos.
2. Visual Premium de Revisões aplicado sobre a tela produtiva.
3. Arte opcional no rodapé da Sidebar.

## O que não deve ser copiado diretamente
- `App.tsx`, `main.tsx`, autenticação, Supabase e runtime da preview.
- Página monolítica antiga da Central de Questões.
- Área antiga do parceiro.
- Administração antiga de parcerias.
- Scripts de aparência com `MutationObserver` quando já há componente React.
- Demo Completo como substituto de telas reais.

## Ordem segura
1. Hero + fundo da missão.
2. Cards compactos.
3. Meta semanal em React.
4. Header Premium desktop.
5. Testes desktop/mobile.
6. Fundos da Loja em PR separada.
7. Central de Estudos e Revisões, uma tela por PR.

Nada será enviado para `main` automaticamente.
