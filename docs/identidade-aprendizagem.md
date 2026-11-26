# Identidade de aprendizagem — etapa 1A

Contrato local v1, sem persistência. A unidade é o assunto canônico no caminho matéria/módulo/assunto. Subassuntos já individualizados como assuntos usam seu próprio ID. Quando a grade individualiza uma aula em tópico, a unidade inclui o ID da aula. Um único vídeo de apoio pode compartilhar a unidade do assunto. O estado futuro de memória será por usuário e unidade.

A chave serializa os componentes em uma tupla JSON. Títulos e posição visual não participam. IDs legados resolvem para o caminho atual. Reorganizar módulos ou substituir IDs canônicos exige um mapa explícito de equivalência antes de transportar estados históricos. Vínculos ambíguos, ausentes ou puramente textuais ficam pendentes com sua referência original.

O produtor fornece o ID persistido da ocorrência e, quando necessário, da resposta individual. Projeções da mesma tentativa devem reutilizar origem, ocorrência e item. O registro devolve uma decisão pura para o chamador aplicar. Replays não duplicam a ocorrência e divergências retornam as duas versões. A segurança concorrente dependerá de unicidade transacional na futura persistência.

O instante real, a modalidade, a origem e a unidade constituem entrada para avaliação futura. A etapa não atribui rating nem agenda revisão. Testes sintéticos cobrem identidade, aliases, colisões e replay. Permanecem para integrações futuras os adaptadores de produtores e a reconciliação de históricos.
