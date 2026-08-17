# PMPE Study Pro — Deploy no Vercel

Esta pasta está preparada para publicar o frontend Vite no Vercel.

## Arquitetura

- Frontend: Vercel
- Banco/autenticação: Supabase
- API Gemini: Render (`VITE_API_URL`)
- `GEMINI_API_KEY` permanece somente no backend/Render.

## 1. Teste local antes do deploy

```powershell
npm install
npm run build
npm run dev
```

O `npm run build` precisa terminar sem erro.

## 2. Variáveis de ambiente no Vercel

Cadastre no projeto Vercel, para Production (e Preview se desejar):

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_API_URL
```

Use em `VITE_API_URL` a URL pública real da API no Render.

Não cadastre `GEMINI_API_KEY` no frontend. Essa chave pertence somente ao serviço backend.

## 3. Configuração de build

O projeto é Vite e já possui:

- script de build: `npm run build`
- saída padrão: `dist`
- `vercel.json` com rewrite SPA para `/index.html`
- `package-lock.json` para instalação reproduzível

O Vercel normalmente detecta Vite automaticamente. Evite alterar Build Command ou Output Directory se a detecção estiver correta.

## 4. Publicar

### Pelo painel

1. Crie/abra o projeto no Vercel.
2. Importe o repositório que contém esta pasta.
3. Confirme Framework Preset = Vite.
4. Cadastre as variáveis acima.
5. Clique em Deploy.

### Pela CLI

```powershell
npx vercel
```

Para produção:

```powershell
npx vercel --prod
```

## 5. Checklist depois do deploy

Teste no endereço de produção:

- Login/Supabase
- Dashboard
- Conteúdos
- Plano de Estudos
- Domingo = somente Redação + Simulado
- Central de Estudos
- Revisões
- IA Coach
- Cronograma IA
- Gerador de questões IA
- Backup/exportação
- Status de sincronização
- F5 em uma rota interna
- Abrir no celular

## 6. Se a IA não responder

O frontend usa `VITE_API_URL`. Confirme:

1. a URL no Vercel aponta para o backend correto;
2. o backend Render está online;
3. `GEMINI_API_KEY` está configurada no Render;
4. o endpoint `/api/saude` do backend responde.

## 7. Segurança

Nunca envie em ZIP, GitHub ou código-fonte:

- `GEMINI_API_KEY`
- service role do Supabase
- senhas/tokens privados

A `VITE_SUPABASE_ANON_KEY` é a chave pública/anon destinada ao frontend; a segurança dos dados deve continuar protegida pelas políticas RLS do Supabase.
