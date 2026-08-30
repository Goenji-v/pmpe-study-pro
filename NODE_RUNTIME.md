# Runtime Node.js

O projeto usa Node.js 24 LTS nos ambientes de CI e deploy.

- `package.json`: `engines.node = 24.x`
- `.node-version`: `24`
- GitHub Actions: Node 24
- `@types/node`: permanece na linha 24 para manter os tipos alinhados ao runtime

Node.js 26 só deve ser adotado quando a linha 26 estiver em LTS e os ambientes de produção tiverem sido validados nessa versão.
