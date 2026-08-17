# Etapa 17 — Adaptação inteligente controlada

## Objetivo

Adicionar inteligência ao cronograma sem voltar a bagunçar a sequência fixa que já foi validada nas Etapas 13–16.

A Etapa 17 **não troca dias de conteúdo, não remove matérias e não utiliza o domingo para reforço**. A adaptação atua somente em espaços flexíveis e nas propostas da IA.

## Diagnóstico móvel de 14 dias

O sistema calcula um ranking por matéria usando os registros reais do usuário:

- desempenho em questões — peso principal;
- revisões atualmente atrasadas;
- dias sem registro de estudo;
- volume recente de questões;
- quantidade de sessões e revisões para estimar a confiança do diagnóstico.

Cada matéria recebe:

- prioridade de reforço de 0 a 100;
- confiança dos dados de 0 a 100%;
- aproveitamento recente;
- número de questões;
- revisões atrasadas;
- justificativas objetivas.

## Regra de segurança

A sequência de conteúdo do Plano Tático permanece imutável.

A prioridade calculada pode atuar apenas em:

1. missões do tipo `livre`;
2. cards antigos chamados `Matéria com maior dificuldade`;
3. propostas geradas na tela Cronograma com IA.

O ID original da missão é mantido. Isso preserva histórico e conclusão no Supabase.

## Exemplo

Se nos últimos 14 dias Português tiver 40% de acertos em 10 questões e uma revisão atrasada, enquanto RLM estiver em 90%, um slot flexível que antes mostrava:

`Matéria com maior dificuldade — Questões e resumos`

passa a mostrar:

`Português — Reforço direcionado · 40% de acertos em 10 questões`

Nenhuma missão fixa de Constitucional, RLM, História, Informática ou Leis Extravagantes é deslocada.

## Domingo

Domingo continua sendo regra fixa:

1. Redação semanal
2. Simulado semanal

A opção de desativar o domingo estratégico foi removida do questionário da IA. A API recebe `domingoEstrategico: true` de forma explícita.

## Plano Tático

Foi adicionado um painel no topo com:

- matéria prioritária;
- pontuação de prioridade;
- confiança;
- janela de análise;
- ranking das 3 matérias que mais precisam de reforço;
- motivo principal da escolha.

## Cronograma IA

A tela de Cronograma com IA ganhou um diagnóstico de 14 dias. A prioridade enviada ao Gemini segue esta ordem:

1. ajuste semanal manual/ativo, quando existir;
2. prioridade calculada pelos dados recentes;
3. matéria de maior dificuldade declarada no perfil.

Isso mantém o sistema assistido, mas reduz a dependência de o usuário atualizar manualmente qual matéria está pior.

## Validação

- utilitário adaptativo compilado com TypeScript em modo estrito;
- arquivos TS/TSX alterados passaram por verificação sintática do compilador TypeScript;
- teste controlado confirmou que uma matéria com 40% de acertos e revisão atrasada supera uma matéria com 90% de acertos;
- missão flexível preserva o ID original e troca somente matéria/descrição de execução;
- `planoPMPE.ts` não foi alterado nesta etapa, preservando as 11 semanas e o domingo exclusivo da Etapa 16.
