# Etapas 18.5 + 18.6 — Blindagem final

## 18.5 — Status visual de segurança

- Indicador global no Header para:
  - Carregando nuvem
  - Salvando
  - Sincronizado
  - Offline
  - Conflito de dados
  - Erro na nuvem
- Painel clicável com:
  - última sincronização;
  - último backup manual/automático;
  - alterações pendentes;
  - Schema 18;
  - ação de sincronizar;
  - resolução protegida de conflito;
  - atalho para Backup e segurança.
- Backups automáticos e manuais notificam o indicador global quando são criados.

## 18.6 — Proteção contra falhas

- ErrorBoundary global reforçado.
- Tela de recuperação sem apagar dados.
- Ações:
  - Tentar novamente;
  - Recarregar página;
  - Ir para Dashboard.
- Registro local de até 20 diagnósticos de erro.
- Captura de falhas assíncronas (`unhandledrejection`) e erros de runtime.
- Falhas assíncronas geram aviso não bloqueante e não alteram o estado salvo.
- Identificador de diagnóstico local em falhas de renderização.

## Garantias desta etapa

Não foram alterados:
- cronograma;
- domingos;
- curso de Português;
- adaptação inteligente;
- IDs das missões;
- estrutura de progresso.

## Validação

- 105 arquivos TS/TSX analisados.
- 0 erros de sintaxe.
- Arquivos críticos de cronograma/Português comparados byte a byte com a versão 18.3/18.4 e preservados.
- O build completo requer as dependências do projeto instaladas (`npm install`).
