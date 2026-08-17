# Correção da IA + Dashboard Premium

## IA
- `gemini.ts` não usa mais `http://localhost:3001` fixo.
- URLs da API foram centralizadas em `src/config/api.ts`.
- Local: usa `http://<host>:3001`.
- Produção: usa `VITE_API_URL`; se ausente, há fallback para `https://pmpe-study-pro-api.onrender.com`.
- Erro de rede agora mostra uma mensagem compreensível em vez de apenas `Failed to fetch`.
- IA Coach e Cronograma IA também usam a mesma configuração centralizada.

## Visual
- topo da Dashboard com três blocos premium: progresso, sequência e indicadores;
- próxima missão e plano tático com hierarquia visual mais forte;
- meta e ritmo de estudo refinados;
- fechamento em quatro cards: diagnóstico, último simulado, sessões recentes e IA Coach;
- responsividade para desktop, tablet e celular.

## Produção
No Vercel, prefira configurar `VITE_API_URL` com a URL real do serviço do Render.
Exemplo: `https://pmpe-study-pro-api.onrender.com`.
