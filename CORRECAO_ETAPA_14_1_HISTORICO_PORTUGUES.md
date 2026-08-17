# Correção Etapa 14.1 — histórico de Português

## Problema identificado
A Etapa 14 passou a derivar as missões concluídas da árvore canônica de Conteúdos. Em versões antigas, parte do progresso de Português estava gravada por nomes de aulas/assuntos que não coincidiam exatamente com a nova estrutura agrupada.

Exemplos:
- `Sílaba - Parte 1` → assunto canônico `Sílaba` / aula `Parte 1`;
- `Acentuação - Parte 01` → assunto canônico `Acentuação gráfica` / aula `Acentuação - Parte 1`.

Se uma conclusão antiga não fosse reconhecida, a sincronização podia interpretar a aula como pendente e remover a missão correspondente do histórico.

## Correção
- A migração de Português agora usa os aliases do próprio Plano para encontrar a aula canônica pelo `aulaId`.
- O link da videoaula também é usado como fallback de correspondência.
- Antes de recalcular as missões, o sistema recupera evidências antigas de Português vindas de:
  - missões já concluídas;
  - sessões vinculadas às missões;
  - revisões já existentes.
- A recuperação ocorre antes da sincronização destrutiva, portanto um histórico antigo é convertido primeiro para a árvore canônica.
- Desmarcar uma aula depois da migração continua funcionando normalmente, porque a conclusão da missão é removida junto com a aula.

## Segurança
A correção não altera Histórico de Sessões, Questões, Simulados ou progresso das demais matérias.
