# Etapa 18.1 + 18.2 — Segurança de dados e migração

## 18.1 — Schema versionado + backup automático

- O estado principal passa a usar `schemaVersion: 18`.
- `versao` continua existindo para compatibilidade com versões antigas.
- Estados antigos (incluindo V1/V2) são detectados antes de qualquer alteração.
- Antes de migrar, o estado bruto é copiado para um backup automático local.
- Os backups ficam isolados por usuário e possuem:
  - ID;
  - data/hora;
  - motivo;
  - versão de origem/destino;
  - checksum;
  - cópia integral do estado anterior.
- O sistema tenta manter até 10 cópias. Se a cota do navegador for menor, remove somente as mais antigas até o backup novo caber.
- Se nem uma cópia puder ser salva, a migração nem começa.

> Nesta fase o backup automático é local. A interface para exportar/restaurar e a camada adicional de nuvem entram nas próximas subetapas da Etapa 18.

## 18.2 — Migração segura + validação + rollback

A sequência de migração agora é:

1. detectar a versão antiga;
2. criar backup automático;
3. migrar para schema 18;
4. validar a integridade do estado;
5. somente então salvar no Supabase.

A validação bloqueia, entre outros casos:

- coleções principais ausentes;
- schema incompatível;
- IDs duplicados de matéria, módulo, assunto ou aula no mesmo nível;
- configurações/metas inválidas;
- estado não serializável.

Correções automáticas de estrutura feitas durante o carregamento também passam por um fluxo protegido:

`backup → validação → save → hidratação da interface`

Se a gravação estrutural falhar, o sistema tenta restaurar o estado anterior automaticamente. O backup local permanece disponível mesmo se o rollback de nuvem não puder ser confirmado.

## O que não mudou

- cronograma de 11 semanas;
- domingo de Redação + Simulado;
- 26 blocos de Português;
- adaptação inteligente da Etapa 17;
- progresso, questões, sessões, revisões e simulados.

## Arquivos principais

- `src/services/seguranca/schemaVersion.ts`
- `src/services/seguranca/backupAutomaticoService.ts`
- `src/services/sincronizacaoService.ts`
- `src/context/AppContext.tsx`

## Validação executada

- migração simulada V2 → schema 18: OK;
- backup criado antes da migração: OK;
- estado inválido: migração cancelada e nuvem intacta;
- falha simulada de save estrutural: rollback confirmado;
- serviços novos verificados com TypeScript (`noUnusedLocals` e `noUnusedParameters`): 0 erros;
- 102 arquivos TS/TSX verificados para erros de sintaxe: 0 erros.
