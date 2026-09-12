export const subjects = [
  { id: 'constitucional', name: 'Direito Constitucional', short: 'DC', score: 88, progress: 67, lessons: 12, completed: 8, review: 2, topic: 'Princípios Fundamentais', last: 'Organização do Estado', color: 'blue', lessonUrl: 'https://www.youtube.com/', questionsUrl: 'https://www.qconcursos.com/questoes-de-concursos', parts: ['Parte 1 · Fundamentos da Constituição', 'Parte 2 · Princípios da República', 'Parte 3 · Separação dos Poderes', 'Parte 4 · Revisão do conteúdo'] },
  { id: 'portugues', name: 'Português', short: 'LP', score: 79, progress: 54, lessons: 24, completed: 13, review: 3, topic: 'Conectivos e coesão', last: 'Interpretação de texto', color: 'gold', lessonUrl: 'https://www.youtube.com/', questionsUrl: 'https://www.qconcursos.com/questoes-de-concursos', parts: ['Parte 1 · Introdução aos conectivos', 'Parte 2 · Coordenação', 'Parte 3 · Subordinação', 'Parte 4 · Coesão na prática'] },
  { id: 'legislacao', name: 'Legislação PMPE', short: 'PM', score: 76, progress: 42, lessons: 12, completed: 5, review: 1, topic: 'Revisão do módulo', last: 'Introdução à legislação', color: 'steel', lessonUrl: 'https://www.youtube.com/', questionsUrl: 'https://www.qconcursos.com/questoes-de-concursos', parts: ['Parte 1 · Leitura orientada', 'Parte 2 · Pontos principais', 'Parte 3 · Questões da norma', 'Parte 4 · Revisão final'] },
  { id: 'humanos', name: 'Direitos Humanos', short: 'DH', score: 69, progress: 38, lessons: 16, completed: 6, review: 2, topic: 'Revisão dos fundamentos', last: 'Introdução aos direitos', color: 'blue', lessonUrl: 'https://www.youtube.com/', questionsUrl: 'https://www.qconcursos.com/questoes-de-concursos', parts: ['Parte 1 · Conceitos essenciais', 'Parte 2 · Direitos fundamentais', 'Parte 3 · Aplicação prática', 'Parte 4 · Revisão'] },
  { id: 'logica', name: 'Raciocínio Lógico', short: 'RL', score: 62, progress: 30, lessons: 20, completed: 6, review: 4, topic: 'Sequências numéricas', last: 'Proposições lógicas', color: 'gold', lessonUrl: 'https://www.youtube.com/', questionsUrl: 'https://www.qconcursos.com/questoes-de-concursos', parts: ['Parte 1 · Identificar padrões', 'Parte 2 · Progressões simples', 'Parte 3 · Sequências combinadas', 'Parte 4 · Questões de prova'] },
  { id: 'historia', name: 'História de Pernambuco', short: 'HP', score: 83, progress: 50, lessons: 10, completed: 5, review: 1, topic: 'Revisão de História', last: 'Formação de Pernambuco', color: 'steel', lessonUrl: 'https://www.youtube.com/', questionsUrl: 'https://www.qconcursos.com/questoes-de-concursos', parts: ['Parte 1 · Formação histórica', 'Parte 2 · Período colonial', 'Parte 3 · Transformações políticas', 'Parte 4 · Revisão'] },
] as const;
export type Subject = typeof subjects[number];
export const weekly = [
  { day: 'Seg', hours: 2.2, questions: 35 }, { day: 'Ter', hours: 3.1, questions: 48 },
  { day: 'Qua', hours: 2.7, questions: 42 }, { day: 'Qui', hours: 3.8, questions: 61 },
  { day: 'Sex', hours: 3.5, questions: 57 }, { day: 'Sáb', hours: 2, questions: 31 },
  { day: 'Dom', hours: 1.5, questions: 26 },
];
export const initialTasks = [
  { id: 't1', title: 'Revisar Princípios Fundamentais', subject: 'Direito Constitucional', time: '08:00', date: '2026-09-11', done: true },
  { id: 't2', title: 'Resolver 20 questões de Português', subject: 'Português', time: '14:00', date: '2026-09-11', done: false },
  { id: 't3', title: 'Estudar Sequências numéricas', subject: 'Raciocínio Lógico', time: '19:00', date: '2026-09-11', done: false },
  { id: 't4', title: 'Revisão da semana', subject: 'Todas as disciplinas', time: '09:00', date: '2026-09-12', done: false },
  { id: 't5', title: 'Simulado PMPE', subject: 'Treino de prova', time: '09:00', date: '2026-09-13', done: false },
  { id: 't6', title: 'Revisar erros do simulado', subject: 'Raciocínio Lógico', time: '18:00', date: '2026-09-14', done: false },
];
export type DemoTask = typeof initialTasks[number];
export const reviewItems = [
  { id: 'r1', title: 'Proposições lógicas', subject: 'Raciocínio Lógico', status: 'Atrasadas', date: '10 set', minutes: 15 },
  { id: 'r2', title: 'Conectivos e coesão', subject: 'Português', status: 'Hoje', date: '11 set', minutes: 10 },
  { id: 'r3', title: 'Princípios Fundamentais', subject: 'Direito Constitucional', status: 'Hoje', date: '11 set', minutes: 20 },
  { id: 'r4', title: 'Revisão dos fundamentos', subject: 'Direitos Humanos', status: 'Próximas', date: '12 set', minutes: 15 },
  { id: 'r5', title: 'Revisão do módulo', subject: 'Legislação PMPE', status: 'Próximas', date: '14 set', minutes: 20 },
];
export const questions = [
  { id: 'q1', subject: 'Português', topic: 'Conectivos', board: 'Autoral', difficulty: 'Fácil', text: 'Em “Estudei bastante, portanto estou preparado”, o conectivo “portanto” expressa:', options: ['Oposição', 'Conclusão', 'Alternância', 'Condição'], answer: 1, explanation: '“Portanto” introduz uma conclusão relacionada à informação anterior.' },
  { id: 'q2', subject: 'Raciocínio Lógico', topic: 'Sequências', board: 'Autoral', difficulty: 'Fácil', text: 'Qual é o próximo número da sequência 2, 4, 8, 16, …?', options: ['18', '24', '32', '64'], answer: 2, explanation: 'Cada termo é o dobro do anterior. Portanto, 16 × 2 = 32.' },
  { id: 'q3', subject: 'Português', topic: 'Conectivos', board: 'Laboratório', difficulty: 'Média', text: 'Em “Embora estivesse cansado, continuou estudando”, a palavra “embora” indica:', options: ['Causa', 'Conclusão', 'Concessão', 'Finalidade'], answer: 2, explanation: 'A oração introduz uma circunstância que não impede a ação principal: uma concessão.' },
  { id: 'q4', subject: 'Raciocínio Lógico', topic: 'Sequências', board: 'Laboratório', difficulty: 'Média', text: 'Uma pessoa resolve 12 questões por dia. Mantendo o ritmo, quantas resolverá em 5 dias?', options: ['17', '50', '60', '72'], answer: 2, explanation: 'O total é 12 × 5 = 60 questões.' },
];
export type DemoQuestion = typeof questions[number];
export const materials = [
  { id: 'm1', title: 'Guia de revisão ativa', subject: 'Método de estudo', type: 'PDFs', pages: '3 tópicos', body: 'REVISÃO ATIVA\n\n1. Recorde antes de consultar\nFeche o material e escreva três ideias que você lembra da última aula.\n\n2. Pratique e compare\nResolva uma questão e explique por que escolheu a alternativa.\n\n3. Planeje a próxima revisão\nRegistre suas dúvidas e reserve um horário no cronograma.\n\nMaterial demonstrativo do Studio Pro.' },
  { id: 'm2', title: 'Conectivos: conclusão e concessão', subject: 'Português', type: 'Resumos', pages: '2 tópicos', body: 'CONECTIVOS\n\nConclusão: portanto, logo, por isso.\nExemplo: Estudei; portanto, estou preparado.\n\nConcessão: embora, ainda que.\nExemplo: Embora cansado, continuei.\n\nMaterial demonstrativo do Studio Pro.' },
  { id: 'm3', title: 'Sua rota de estudo', subject: 'Método de estudo', type: 'Mapas mentais', pages: '1 mapa', body: 'SUA ROTA\n\nPlanejar → Estudar → Praticar → Revisar\n\nPlanejar: escolher uma meta possível.\nEstudar: compreender uma ideia por vez.\nPraticar: testar o que aprendeu.\nRevisar: voltar aos pontos de dificuldade.\n\nMaterial demonstrativo do Studio Pro.' },
];
export type DemoMaterial = typeof materials[number];
export function normalize(text: string) { return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
