# Changelog

## 4.0.0-m1 — Administração

- Adicionada rota protegida `/admin`.
- Criado painel com total de usuários, novos cadastros, usuários ativos, horas, questões e acertos do mês.
- Criada listagem administrativa de contas com pesquisa, último login, confirmação de e-mail, status, XP e atividade mensal.
- Adicionado controle de visibilidade do menu administrativo.
- Adicionadas RPCs protegidas e tabela de administradores no Supabase.
- E-mails e informações privadas ficam disponíveis apenas por funções administrativas protegidas.

## Etapas 13 e 14 — Conteúdos canônicos e Plano integrado

- Conteúdos agora ignora revisões, redação, questões avulsas e tarefas livres ao gerar a árvore do edital.
- Migração remove falsos assuntos operacionais sem apagar progresso ou conteúdos personalizados válidos.
- Missões de conteúdo passaram a possuir referências canônicas por ID para matéria, módulo, assunto e aula.
- Português passou a sincronizar cada missão com sua aula interna, sem concluir o assunto inteiro prematuramente.
- Finalização de missão na Central atualiza a mesma aula/assunto usada por Conteúdos.
- Progresso de missões antigas é reconciliado automaticamente com a árvore canônica.

## Etapa 15 — Sincronização final
- Criada resolução canônica única para Plano, Dashboard e Central de Estudos.
- Sessões, questões e revisões antigas são reconciliadas por IDs de Conteúdos.
- Hidratação do Supabase reconcilia histórico antes de salvar correções.
- Plano e Dashboard passam a compartilhar o mesmo cálculo de progresso.
- Sessões em andamento vindas do Plano são revalidadas sem perder o cronômetro.
- Revisões pendentes duplicadas da mesma etapa/assunto são consolidadas.
- Revisões do Simulado IA recebem IDs canônicos quando o conteúdo é localizado.

## Etapa 16 — Cronograma contínuo
- Domingo passou a ser exclusivo para Redação + Simulado.
- Missões normais que alcançariam o domingo continuam na segunda seguinte, sem quebrar a sequência.
- Plano ampliado para 11 semanas.
- Português compactado em 26 lotes de 2–4 aulas conforme o tamanho do assunto.
- Missões de Português agrupadas usam múltiplas referências canônicas e só concluem após todas as aulas do lote.
- IDs antigos preservados para proteger histórico e progresso.

## Etapa 17 — Adaptação inteligente controlada
- Criado diagnóstico móvel de 14 dias por matéria.
- Prioridade semanal considera aproveitamento, revisões atrasadas, volume de questões e tempo sem contato.
- Índice de confiança informa quando a amostra ainda é pequena.
- Plano Tático exibe ranking das 3 matérias que mais precisam de reforço.
- Missões flexíveis de "Matéria com maior dificuldade" passam a apontar automaticamente para a prioridade calculada.
- Sequência fixa de conteúdo não é reordenada nem removida.
- Domingo permanece bloqueado como Redação + Simulado.
- Cronograma IA recebe a prioridade baseada em dados mesmo sem alteração manual do perfil.
- Questionário da IA não permite mais desativar o domingo estratégico.

## Etapa 18.1 + 18.2 — Segurança e migração
- Schema do estado elevado para 18 com compatibilidade legada.
- Backup automático local antes de migrações estruturais.
- Validação de integridade antes de qualquer persistência migrada.
- Migração antiga V1/V2 para o schema atual protegida por backup.
- Correções estruturais são salvas antes de hidratar a interface.
- Rollback automático para o estado anterior se um save estrutural falhar.

## Etapa 18.3 + 18.4 — Sincronização protegida e backup completo
- Criada revisão monotônica de sincronização para reduzir sobrescritas entre aparelhos.
- Alterações locais entram em snapshot pendente antes do autosave.
- Modo offline mantém o estudo funcional e sincroniza quando a conexão retorna.
- Conflitos entre revisão local e Supabase bloqueiam overwrite silencioso e exigem escolha explícita.
- Resolução de conflito cria backup automático do lado que será substituído.
- Backup manual passou para Schema 18 e inclui missões concluídas.
- Arquivos exportados recebem checksum de integridade.
- Importação antiga V1/V2 continua compatível via migração segura.
- Restauração cria backup prévio e valida o estado antes de aplicar.
- Backups automáticos locais passaram a aparecer na tela de Backup com opção de restauração.

## Etapas 18.5 + 18.6
- Status global de sincronização ampliado com detalhes de backup e pendências.
- Indicador de segurança clicável no Header.
- ErrorBoundary reforçado com tentativa de recuperação da interface.
- Registro local de diagnóstico de falhas.
- Captura de erros assíncronos e promises rejeitadas.
- Cronograma, Português e adaptação inteligente preservados.

## Etapa 20 — Mobile profissional
- Navegação mobile com sidebar deslizante e overlay.
- Dashboard, Plano, Central, Conteúdos, Revisões e páginas de sistema responsivos.
- Domingo adaptado para telas pequenas.
- Nenhuma regra de negócio ou histórico alterado.
