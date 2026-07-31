# Alterações realizadas

## Correções

- Corrigidos os imports da página `CentralInteligencia` para os arquivos reais `types.ts` e `utils.ts`.
- Removida a pasta duplicada acidental `src/src`, que continha uma segunda cópia incompleta da Central de Inteligência.
- Verificados todos os imports relativos de arquivos TypeScript/TSX; nenhum caminho relativo ficou sem destino.

## Melhorias adicionadas

- Adicionado `ErrorBoundary` global para impedir que um erro isolado deixe o site inteiro em tela branca.
- Adicionada página 404 para rotas inexistentes.
- Adicionadas mensagens claras de recuperação e botões para recarregar ou voltar ao início.

## Validação

Não foi possível executar `npm install` no ambiente de análise porque o espelho interno do registro NPM não disponibilizou um pacote transitivo. Por isso, o build final deve ser confirmado localmente com:

```bash
npm install
npm run build
```
