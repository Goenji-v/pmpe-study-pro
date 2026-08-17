import type { Assunto, AulaAssunto, Modulo, Prioridade } from "../types";

export const CURSO_PORTUGUES_NOME = "Português";

type AulaBase = [id: string, nome: string, classId: number];

const urlDaAula = (classId: number) =>
  `https://rotapolicial.curseduca.pro/m/lessons/lingua-portuguesa1778770535857?classId=${classId}`;

function criarAssunto(
  id: string,
  nome: string,
  prioridade: Prioridade,
  aulasBase: AulaBase[]
): Assunto {
  const aulas: AulaAssunto[] = aulasBase.map(([aulaId, aulaNome, classId], ordem) => ({
    id: aulaId,
    nome: aulaNome,
    url: urlDaAula(classId),
    ordem,
    concluida: false,
  }));

  return {
    id,
    nome,
    prioridade,
    concluido: false,
    aulas,
    tarefas: [{
      id: `${id}-tarefa-questoes`,
      nome: "Fazer questões do assunto",
      tipo: "questoes",
      ordem: 0,
      concluida: false,
    }],
    // Compatibilidade enquanto Central, Dashboard e Plano ainda usam um link único.
    aula: aulas[0]?.url,
  };
}

export const cursoPortuguesModulos: Modulo[] = [
  {
    id: "portugues-modulo-0-fonologia",
    nome: "Módulo 0 - Fonologia",
    ordem: 0,
    assuntos: [
      criarAssunto("portugues-fonemas-letras", "Fonemas, letras e sons da fala", "media", [
        ["portugues-fonema-letra", "Fonema e letra", 1938],
        ["portugues-vogal-consoante-semivogal", "Vogal, consoante e semivogal", 1940],
      ]),
      criarAssunto("portugues-encontros-vocalicos", "Encontros vocálicos", "media", [
        ["portugues-ditongo", "Ditongo", 1939],
        ["portugues-tritongo-hiato", "Tritongo e hiato", 1941],
      ]),
      criarAssunto("portugues-digrafo-encontro-consonantal", "Dígrafo e encontro consonantal", "media", [
        ["portugues-digrafo-encontro-consonantal-1", "Parte 1", 1942],
        ["portugues-digrafo-encontro-consonantal-2", "Parte 2", 1943],
      ]),
      criarAssunto("portugues-silaba", "Sílaba", "media", [
        ["portugues-silaba-1", "Parte 1", 1944],
        ["portugues-silaba-2", "Parte 2", 2394],
      ]),
    ],
  },
  {
    id: "portugues-modulo-1-ortografia-acentuacao",
    nome: "Módulo 1 - Ortografia e Acentuação",
    ordem: 1,
    assuntos: [
      criarAssunto("portugues-acentuacao", "Acentuação gráfica", "alta", [
        ["portugues-acentuacao-1", "Acentuação - Parte 1", 1945],
        ["portugues-acentuacao-2", "Acentuação - Parte 2", 1946],
        ["portugues-acentuacao-3", "Acentuação - Parte 3", 1947],
        ["portugues-acentuacao-4", "Acentuação - Parte 4", 2398],
      ]),
    ],
  },
  {
    id: "portugues-modulo-2-classes-palavras",
    nome: "Módulo 2 - Classes de Palavras",
    ordem: 2,
    assuntos: [
      criarAssunto("portugues-fundamentos-morfologia", "Fundamentos da morfologia", "alta", [
        ["portugues-5-pilares", "Aula 1 - Os 5 pilares do Português", 1948],
        ["portugues-morfologia-visao-geral", "Aula 2 - Morfologia: visão geral", 1949],
        ["portugues-morfologia-3-pilares", "Aula 3 - Morfologia: os 3 pilares", 1950],
        ["portugues-classes-variaveis-invariaveis-1", "Aula 4 - Palavras variáveis e invariáveis - Parte 1", 1951],
        ["portugues-10-classes-palavras-2", "Aula 5 - As 10 classes de palavras - Parte 2", 1952],
      ]),
      criarAssunto("portugues-substantivos", "Substantivos", "alta", [
        ["portugues-substantivos-visao-geral", "Aula 6 - Visão geral", 1953],
        ["portugues-substantivo-comum-proprio", "Aula 7 - Comum e próprio", 1954],
        ["portugues-substantivo-concreto-abstrato", "Aula 8 - Concreto e abstrato", 1955],
        ["portugues-substantivo-simples-composto-primitivo-derivado", "Aula 9 - Simples, composto, primitivo e derivado", 1956],
        ["portugues-substantivo-coletivo", "Aula 10 - Coletivo", 1957],
        ["portugues-substantivo-genero", "Aula 11 - Flexões de gênero", 1958],
        ["portugues-substantivo-numero-1", "Aula 12 - Flexões de número - Parte 1", 1959],
        ["portugues-substantivo-numero-2", "Aula 13 - Flexões de número - Parte 2", 1960],
        ["portugues-substantivo-composto-numero-1", "Aula 14 - Plural dos compostos", 1961],
      ]),
      criarAssunto("portugues-adjetivos", "Adjetivos", "alta", [
        ["portugues-adjetivo-2", "Adjetivo - Parte 2", 2440],
        ["portugues-adjetivo-3", "Adjetivo - Parte 3", 2441],
        ["portugues-adjetivo-4", "Adjetivo - Parte 4", 2442],
      ]),
      criarAssunto("portugues-pronomes", "Pronomes", "alta", [
        ["portugues-pronomes-obliquos-tonicos", "Pronomes oblíquos tônicos", 2559],
        ["portugues-pronomes-tratamento", "Pronomes de tratamento", 2560],
        ["portugues-pronomes-possessivos", "Pronomes possessivos", 2561],
        ["portugues-pronomes-demonstrativos", "Pronomes demonstrativos", 2562],
        ["portugues-pronomes", "Pronomes - visão geral", 2566],
        ["portugues-pronomes-relativos-1", "Pronomes relativos - Parte 1", 2563],
        ["portugues-pronomes-relativos-2", "Pronomes relativos - Parte 2", 2564],
        ["portugues-pronomes-relativos-3", "Pronomes relativos - Parte 3", 2565],
      ]),
      criarAssunto("portugues-verbos", "Verbos", "alta", [
        ["portugues-verbo-1", "Verbo - Parte 1", 2567],
        ["portugues-verbo-2", "Verbo - Parte 2", 2568],
        ["portugues-tempos-modos-verbais-1", "Tempos e modos verbais - Parte 1", 2569],
        ["portugues-tempos-modos-verbais-2", "Tempos e modos verbais - Parte 2", 2570],
      ]),
    ],
  },
  {
    id: "portugues-modulo-3-sintaxe-basica",
    nome: "Módulo 3 - Sintaxe Básica",
    ordem: 3,
    assuntos: [
      criarAssunto("portugues-sintaxe", "Fundamentos da sintaxe", "alta", [
        ["portugues-sintaxe-1", "Sintaxe - Parte 1", 2403],
        ["portugues-sintaxe-2", "Sintaxe - Parte 2", 2404],
      ]),
      criarAssunto("portugues-crase", "Crase", "alta", [
        ["portugues-crase-1", "Crase - Parte 1", 2399],
        ["portugues-crase-2", "Crase - Parte 2", 2400],
        ["portugues-crase-3", "Crase - Parte 3", 2401],
        ["portugues-crase-4", "Crase - Parte 4", 2402],
      ]),
      criarAssunto("portugues-sujeito", "Tipos de sujeito", "alta", [
        ["portugues-sujeito-composto", "Sujeito composto", 2420],
        ["portugues-sujeito-oculto-1", "Sujeito oculto - Parte 1", 2421],
        ["portugues-sujeito-oculto-2", "Sujeito oculto - Parte 2", 2422],
        ["portugues-sujeito-inexistente-1", "Sujeito inexistente - Parte 1", 2423],
        ["portugues-sujeito-inexistente-2", "Sujeito inexistente - Parte 2", 2424],
        ["portugues-reforco-sujeito", "Reforço de sujeito", 2425],
      ]),
      criarAssunto("portugues-predicado", "Tipos de predicado", "alta", [
        ["portugues-predicado-verbal", "Predicado verbal", 2427],
        ["portugues-predicado-nominal", "Predicado nominal", 2428],
        ["portugues-predicado-verbo-nominal", "Predicado verbo-nominal", 2429],
      ]),
      criarAssunto("portugues-complementos-adjuntos", "Complementos e adjuntos", "alta", [
        ["portugues-complemento-objeto-adjunto", "Complemento nominal, objeto e adjuntos", 2430],
        ["portugues-objeto-indireto-complemento-nominal", "Objeto indireto x complemento nominal", 2431],
        ["portugues-complemento-nominal-adjunto-adnominal", "Complemento nominal x adjunto adnominal", 2432],
      ]),
      criarAssunto("portugues-aposto-vocativo", "Aposto e vocativo", "alta", [
        ["portugues-aposto", "Aposto", 2433],
        ["portugues-vocativo", "Vocativo", 2434],
      ]),
    ],
  },
  {
    id: "portugues-modulo-4-concordancia",
    nome: "Módulo 4 - Concordância",
    ordem: 4,
    assuntos: [
      criarAssunto("portugues-concordancia-verbal", "Concordância verbal", "alta", [
        ["portugues-concordancia-verbal-1", "Parte 1", 2435],
        ["portugues-concordancia-verbal-2", "Parte 2", 2436],
        ["portugues-concordancia-verbal-3", "Parte 3", 2437],
        ["portugues-concordancia-verbal-4", "Parte 4", 2438],
        ["portugues-concordancia-verbal-5", "Parte 5", 2439],
      ]),
    ],
  },
];

export const cursoPortuguesAssuntos = cursoPortuguesModulos.flatMap((modulo) => modulo.assuntos);
