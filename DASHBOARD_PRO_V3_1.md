# Dashboard Pro V3.1

Alterações desta versão:

- substitui o bloco "Seu ritmo de estudo" por um gráfico semanal fino;
- barras = minutos estudados por dia (Seg a Dom);
- linha = taxa de acertos diária;
- usa os dados reais de sessões e registros de questões;
- evita duplicar o tempo de questões quando há sessão correspondente;
- revisão da Dashboard agora mostra apenas status prioritários: Atrasada, Hoje e Amanhã;
- ícone de calendário e seta de navegação em cada revisão;
- clicar na revisão abre a página de Revisões;
- mantém Meta do Dia como estava.

Validação recomendada:

npm install
npm run build
npm run dev

No ambiente de geração o build não concluiu por ausência local de vite/client e @types/node.
