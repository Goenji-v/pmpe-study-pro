# Etapa 15 — Sincronização final

Implementado sobre a versão com Etapas 13/14 e módulos fechados por padrão.

## O que foi unificado
- Plano e Dashboard usam o mesmo cálculo de progresso.
- Plano, Dashboard e Central resolvem a mesma missão por IDs canônicos.
- Sessões, questões e revisões antigas são reconciliadas para matéria/módulo/assunto atuais.
- Português legado é convertido para o assunto canônico sem apagar histórico.
- Sessão em andamento é revalidada sem zerar cronômetro.
- Revisões pendentes duplicadas da mesma etapa/assunto são consolidadas; histórico concluído é preservado.
- Revisões importadas do Simulado IA passam a receber referências canônicas quando disponíveis.
- Hidratação do Supabase reconcilia o estado antes de gravar qualquer correção na nuvem.

## Fluxo final
Plano → Central → Conteúdo/Aula → Questões → Revisões → Dashboard → Supabase.
