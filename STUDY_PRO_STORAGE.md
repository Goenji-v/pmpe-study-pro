# Study Pro Storage

Camada privada e independente de provedor para vídeos, PDFs, imagens e outros arquivos do Study Pro.

## Arquitetura

```
Study Pro (React)
  -> API autenticada do Study Pro
     -> valida o usuário Supabase
     -> gera uma URL temporária de upload/leitura
  -> arquivo vai direto do navegador para um provedor S3 compatível
  -> metadados e progresso ficam no Supabase com RLS por usuário
```

O arquivo grande não atravessa a Vercel nem o servidor Express. Isso permite vídeos de vários GB sem aumentar o payload da aplicação.

## Privacidade

- `study_storage_files.user_id` é o dono do arquivo.
- A tabela usa RLS e só permite CRUD quando `auth.uid() = user_id`.
- O progresso de vídeo usa chave estrangeira composta `(file_id, user_id)`, impedindo gravar progresso em arquivo de outra conta.
- Os caminhos físicos começam em `<user_id>/private/`.
- A API confere esse prefixo antes de gerar URLs temporárias.
- Credenciais S3 ficam apenas no backend. Nunca usar variáveis `VITE_*` para segredos do Storage.
- O bucket físico deve ser privado.

## Provedores

A implementação usa API S3 compatível. Pode começar em Cloudflare R2 e depois migrar para MinIO ou outro servidor S3 compatível sem mudar o frontend.

Variáveis do backend:

```
STUDY_STORAGE_ENDPOINT=
STUDY_STORAGE_REGION=auto
STUDY_STORAGE_BUCKET=
STUDY_STORAGE_ACCESS_KEY_ID=
STUDY_STORAGE_SECRET_ACCESS_KEY=
STUDY_STORAGE_MAX_FILE_BYTES=5368709120
```

## R2

Para R2, crie um bucket privado e uma credencial limitada apenas ao bucket do Study Pro. O bucket precisa permitir CORS para os domínios oficiais/preview usados no upload direto via navegador.

A primeira versão usa PUT único e aceita até 5 GiB por arquivo. Um vídeo de 3 GB entra nesse fluxo. O próximo passo para maior tolerância a quedas de internet é multipart/resumable upload.

## MinIO / servidor próprio

O mesmo serviço pode apontar para um endpoint MinIO HTTPS. O backend só precisa receber o novo endpoint, região/bucket e credenciais. Os registros no Supabase continuam iguais.

## Estado desta implementação

Pronto:
- modelo de dados privado;
- RLS por dono;
- progresso de vídeos;
- API para upload, validação, leitura e exclusão;
- presigned URLs S3 v4;
- interface "Meu armazenamento";
- player com retomada do ponto assistido;
- vínculo opcional com matéria/assunto;
- upload direto com porcentagem.

Dependente de configuração externa:
- criar/escolher o primeiro bucket S3;
- cadastrar as credenciais no backend;
- configurar CORS do bucket;
- validar upload real de um vídeo grande;
- opcionalmente evoluir para multipart/resumable.
