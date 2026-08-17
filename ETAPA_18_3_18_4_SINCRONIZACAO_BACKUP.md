# Etapa 18.3 + 18.4 — Sincronização protegida e backup completo

## 18.3 — Proteção local ↔ Supabase

- O estado em nuvem passa a carregar uma `syncRevision` monotônica.
- Toda alteração local é copiada para uma fila persistente antes do autosave.
- Offline não bloqueia o estudo: o snapshot pendente permanece no aparelho.
- Ao voltar a conexão, a fila só é enviada se a revisão-base ainda for a revisão atual da nuvem.
- Se outro aparelho já tiver avançado a revisão, nenhuma versão é sobrescrita: o Study Pro entra em estado de conflito.
- O cabeçalho permite escolher explicitamente "Nuvem" ou "Este aparelho"; o lado substituído é preservado em backup automático antes da resolução.
- Se não existir alteração local pendente, uma reconexão consulta a nuvem primeiro e recebe a versão mais nova, sem criar uma gravação artificial.
- Metadados locais registram a última revisão confirmada e a data da última sincronização.

## 18.4 — Exportação e restauração

- A tela Backup agora exporta o estado completo no Schema 18.
- O JSON inclui matérias, aulas, questões, sessões, revisões, simulados, banco de questões, configurações e missões concluídas.
- O arquivo recebe checksum FNV-1a para detectar alteração/corrupção acidental.
- Backups antigos V1/V2 continuam aceitos e são migrados quando a estrutura é válida.
- Antes da restauração, o arquivo é analisado e o usuário visualiza um resumo.
- Antes de substituir o estado atual, um backup automático local é criado.
- Restauração online grava a nova versão na nuvem antes de hidratar a interface.
- Restauração offline aplica localmente e entra na fila de sincronização.
- A tela lista até 10 backups automáticos de segurança e permite restaurá-los.
