# Etapa 1 — Estrutura dos conteúdos

Implementado o modelo:

`Matéria → Módulo → Assunto → Aulas e Tarefas`

## Regras desta etapa

- O assunto é a unidade que conta no edital.
- Videoaulas são partes internas do assunto.
- Tarefas de teoria, leitura, questões, revisão e redação não contam isoladamente no edital.
- O campo legado `assunto.aula` foi mantido temporariamente para compatibilidade com as telas ainda não migradas.

## Português

As videoaulas do curso do Professor Nascimento foram agrupadas em assuntos reais. Exemplos:

- Acentuação gráfica: 4 aulas.
- Substantivos: 9 aulas.
- Pronomes: 8 aulas.
- Verbos: 4 aulas.
- Crase: 4 aulas.
- Concordância verbal: 5 aulas.

O reconciliador reaproveita a conclusão das antigas aulas que eram armazenadas como assuntos separados.

## Interface

- Cada assunto mostra a quantidade de aulas e tarefas.
- As etapas podem ser expandidas dentro do assunto.
- A próxima videoaula abre a primeira aula interna ainda não concluída.
- Assuntos personalizados permitem adicionar/remover aulas e tarefas pelo editor.
- A trilha oficial de Português preserva as videoaulas canônicas.

## Próxima etapa

Implementar os estados `pendente`, `em andamento` e `concluído`, além da conclusão individual das aulas sem concluir automaticamente o assunto.
