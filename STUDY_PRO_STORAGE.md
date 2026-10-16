# Study Pro Storage

Camada privada para vídeos, PDFs, imagens e anexos do Study Pro.

## Arquitetura atual

```
Study Pro (React)
  -> API autenticada do Study Pro (Render)
     -> valida sessão Supabase
     -> valida que a chave pertence ao user_id
     -> gera token temporário assinado com ECDSA P-256
  -> Cloudflare Worker study-pro-storage
     -> verifica a assinatura com a chave pública
     -> acessa o R2 por binding interno
  -> R2 study-pro-private

Supabase
  -> metadados
  -> vínculo com matéria/assunto
  -> progresso do vídeo
  -> RLS por usuário
```

Não existem credenciais S3 no navegador. O bucket permanece sem acesso público.

## Upload de arquivos grandes

O navegador usa upload multipart através do Worker:

1. cria uma sessão multipart;
2. divide o arquivo em blocos de 32 MiB;
3. envia até 3 blocos em paralelo;
4. cada bloco possui até 3 tentativas;
5. conclui o multipart com os ETags;
6. a API confirma o tamanho do objeto antes de registrar no banco.

O limite configurado é 5 GiB por arquivo. Um vídeo de 3 GB entra nesse fluxo.

## Reprodução

A API só libera uma URL temporária depois de confirmar que o `object_key` está sob o namespace do usuário autenticado.

O Worker suporta HTTP Range para permitir seek/avanço em vídeos grandes sem baixar o arquivo inteiro.

## Privacidade

- `study_storage_files.user_id` é o dono do arquivo.
- RLS restringe SELECT/INSERT/UPDATE/DELETE a `auth.uid() = user_id`.
- `study_storage_video_progress` também é isolada por usuário.
- objetos seguem `<user_id>/private/YYYY/MM/<uuid>-arquivo.ext`.
- tokens do Worker incluem somente `key` e `exp`, são assinados pelo backend e expiram.
- o Worker conhece somente a chave pública.
- a chave privada fica apenas no backend.
- o bucket R2 permanece privado.

## Infra atual

- Bucket R2: `study-pro-private`
- Worker: `study-pro-storage`
- Endpoint Worker: `https://study-pro-storage.studypro-storage.workers.dev`
- Backend preview: `https://pmpe-study-pro-api-storage-preview.onrender.com`
- Frontend preview: branch `feat/study-pro-storage`

## Variáveis do backend

```
STUDY_STORAGE_WORKER_URL=https://study-pro-storage.studypro-storage.workers.dev
STUDY_STORAGE_BUCKET=study-pro-private
STUDY_STORAGE_PRIVATE_KEY_B64=<segredo do backend>
STUDY_STORAGE_MAX_FILE_BYTES=5368709120
STUDY_STORAGE_CHUNK_BYTES=33554432
```

Nunca colocar `STUDY_STORAGE_PRIVATE_KEY_B64` em variável `VITE_*`.

## Estado

Pronto:
- bucket privado;
- Worker + binding R2;
- autenticação assimétrica;
- upload multipart;
- retry;
- progresso de upload;
- leitura com Range;
- exclusão;
- tabelas/RLS no Supabase;
- central `/armazenamento`;
- player e retomada;
- vínculo matéria/assunto;
- API de preview isolada.

Antes do merge:
- testar um upload pequeno no preview;
- testar reprodução/seek;
- testar exclusão;
- depois testar uma live grande.
