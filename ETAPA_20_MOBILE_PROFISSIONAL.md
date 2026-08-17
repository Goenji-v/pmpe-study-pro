# Etapa 20 — Mobile profissional

Esta etapa adiciona uma camada responsiva sem alterar regras de negócio, cronograma, histórico, sincronização ou dados do usuário.

## Ajustes

- Sidebar vira menu lateral deslizante em telas pequenas.
- Botão fixo para abrir/fechar o menu.
- Overlay para fechar o menu ao tocar fora.
- Menu fecha automaticamente após navegar.
- Dashboard reorganizado para 1/2 colunas conforme a largura.
- Card do cronômetro e cards de métricas adaptados para toque.
- Plano de Estudos sem rolagem horizontal forçada.
- Dias/semanas e missões reorganizados em grids responsivos.
- Domingo Redação + Simulado passa para layout em coluna no celular.
- Central de Estudos passa para uma coluna em telas pequenas.
- Botões de atividade, ações e links ficam adequados para toque.
- Conteúdos, Revisões, Configurações e Backup recebem ajustes responsivos.
- Inputs usam 16px no mobile para evitar zoom automático em navegadores móveis.
- Safe-area inferior considerada em aparelhos com barra/recorte.

## Arquivos funcionais alterados

- `src/components/Sidebar/Sidebar.tsx`
- `src/components/Sidebar/Sidebar.css`
- `src/styles/mobile.css` (novo)
- `src/main.tsx`

## Compatibilidade

A Etapa 20 foi aplicada sobre a versão mais recente, incluindo as correções de calendário, revisão, Dashboard, busca, início direto de missão e salvamento separado de Redação/Simulado.
