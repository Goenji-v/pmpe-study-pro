export type TipoMissaoPlano =
  | "conteudo"
  | "revisao"
  | "questoes"
  | "redacao"
  | "livre";

export type MissaoPlano = {
  id: string;
  numero: 1 | 2;
  materia: string;
  assunto: string;
  tipo: TipoMissaoPlano;
  urlAula?: string;
  urlQuestoes?: string;
};

export type DiaPlano = {
  numero: number;
  missoes: MissaoPlano[];
  revisao?: string;
  atividadeExtra?: string;
};

export type SemanaPlano = {
  numero: number;
  nome: string;
  dias: DiaPlano[];
};

function missao(
  semana: number,
  dia: number,
  numero: 1 | 2,
  materia: string,
  assunto: string,
  tipo: TipoMissaoPlano = "conteudo",
  urlAula?: string,
  urlQuestoes?: string
): MissaoPlano {
  return {
    id: `s${semana}-d${dia}-m${numero}`,
    numero,
    materia,
    assunto,
    tipo,
    urlAula,
    urlQuestoes,
  };
}

export const planoPMPE: SemanaPlano[] = [
  {
    numero: 1,
    nome: "Semana 01",
    dias: [
      {
        numero: 1,
        missoes: [
          missao(
            1,
            1,
            1,
            "Português",
            "Fonema e Letra",
            "conteudo",
            "https://rotapolicial.curseduca.pro/m/lessons/lingua-portuguesa1778770535857?classId=1938"
          ),
          missao(
            1,
            1,
            2,
            "Constitucional",
            "Dos princípios fundamentais",
            "conteudo",
            "https://areadoaluno.resumodoconcurseiro.com.br/courses/pmpe-direito-constitucional/lessons/aula-25/",
            "https://www.qconcursos.com/questoes-de-concursos/questoes?discipline_ids%5B%5D=3&examining_board_ids%5B%5D=379&my_questions=not_resolved&per_page=20&subject_ids%5B%5D=49"
          ),
        ],
        revisao: "Revisão do dia",
        atividadeExtra: "Aula ao vivo",
      },
      {
        numero: 2,
        missoes: [
          missao(
            1,
            2,
            1,
            "RLM",
            "Interpretação de problemas em concursos",
            "conteudo",
            "https://areadoaluno.resumodoconcurseiro.com.br/courses/pmpe-raciocinio-logico/lessons/interpretacao-de-problemas-em-concursos-matematica-e-raciocinio-logico-3-2-2/"
          ),
          missao(
            1,
            2,
            2,
            "Leis extravagantes",
            "Abuso de autoridade",
            "conteudo",
            "https://areadoaluno.resumodoconcurseiro.com.br/courses/pmpe-legislacao-extravagante-raiz/lessons/aula-32/",
            "https://www.qconcursos.com/questoes-de-concursos/questoes?discipline_ids%5B%5D=9&examining_board_ids%5B%5D=16&examining_board_ids%5B%5D=379&my_questions=not_resolved&per_page=20&subject_ids%5B%5D=17461"
          ),
        ],
        revisao: "Constitucional",
      },
      {
        numero: 3,
        missoes: [
          missao(
            1,
            3,
            1,
            "Informática",
            "Fundamentos da computação - I",
            "conteudo",
            "https://areadoaluno.resumodoconcurseiro.com.br/courses/pmpe-informatica/lessons/fundamentos-da-computacao-i-6/"
          ),
          missao(
            1,
            3,
            2,
            "História",
            "Ocupação, colonização, contatos iniciais e capitanias hereditárias",
            "conteudo",
            "https://areadoaluno.resumodoconcurseiro.com.br/courses/pmpe-historia-de-pernambuco/lessons/aula-11/"
          ),
        ],
        revisao: "Leis extravagantes",
        atividadeExtra: "Aula de redação",
      },
      {
        numero: 4,
        missoes: [
          missao(
            1,
            4,
            1,
            "Português",
            "Vogal, Consoante e Semivogal",
            "conteudo",
            "https://rotapolicial.curseduca.pro/m/lessons/lingua-portuguesa1778770535857?classId=1940"
          ),
          missao(
            1,
            4,
            2,
            "Constitucional",
            "Direito à vida e igualdade",
            "conteudo",
            "https://areadoaluno.resumodoconcurseiro.com.br/courses/pmpe-direito-constitucional/lessons/direito-a-vida-aula-resumo-2/",
            "https://www.qconcursos.com/questoes-de-concursos/questoes?discipline_ids%5B%5D=3&my_questions=not_resolved&per_page=20&subject_ids%5B%5D=16322&subject_ids%5B%5D=16324"
          ),
        ],
        revisao: "Informática",
      },
      {
        numero: 5,
        missoes: [
          missao(
            1,
            5,
            1,
            "RLM",
            "Operações básicas da matemática",
            "conteudo",
            "https://areadoaluno.resumodoconcurseiro.com.br/courses/pmpe-raciocinio-logico/lessons/operacoes-basicas-da-matematica-3-3-2/",
            "https://www.qconcursos.com/questoes-de-concursos/questoes?discipline_ids%5B%5D=13&my_questions=not_resolved&per_page=20&subject_ids%5B%5D=14553&subject_ids%5B%5D=20313&subject_ids%5B%5D=20314"
          ),
          missao(
            1,
            5,
            2,
            "Leis extravagantes",
            "Lei de tortura",
            "conteudo",
            "https://areadoaluno.resumodoconcurseiro.com.br/courses/pmpe-legislacao-extravagante-raiz/lessons/aula-33/",
            "https://www.qconcursos.com/questoes-de-concursos/questoes?discipline_ids%5B%5D=9&examining_board_ids%5B%5D=16&examining_board_ids%5B%5D=379&my_questions=not_resolved&per_page=20&subject_ids%5B%5D=17462"
          ),
        ],
        revisao: "História",
        atividadeExtra: "Aula ao vivo",
      },
      {
        numero: 6,
        missoes: [
          missao(
            1,
            6,
            1,
            "Informática",
            "Fundamentos da computação - II",
            "conteudo",
            "https://areadoaluno.resumodoconcurseiro.com.br/courses/pmpe-informatica/lessons/fundamentos-da-computacao-ii-6/"
          ),
          missao(
            1,
            6,
            2,
            "Direitos humanos",
            "Teoria geral dos direitos humanos",
            "conteudo",
            "https://areadoaluno.resumodoconcurseiro.com.br/courses/pmpe-direitos-humanos/lessons/teoria-geral-dos-direitos-humanos-evolucao-historica-e-geracoes-de-direitos-humanos-e-a-natureza-juridica-da-incorporacao-de-normas-internacionais-sobre-direitos-humanos-ao-direito-interno-brasileir-2/"
          ),
        ],
        revisao: "Português e RLM",
      },
      {
        numero: 7,
        missoes: [
          missao(
            1,
            7,
            1,
            "História",
            "A importância de Pernambuco e presença holandesa",
            "conteudo",
            "https://areadoaluno.resumodoconcurseiro.com.br/courses/pmpe-historia-de-pernambuco/lessons/aula-12/"
          ),
          missao(
            1,
            7,
            2,
            "Revisão da semana 01",
            "10 questões de cada tópico estudado na semana",
            "revisao"
          ),
        ],
      },
    ],
  },

  {
    numero: 2,
    nome: "Semana 02",
    dias: [
      {
        numero: 1,
        missoes: [
          missao(
            2,
            1,
            1,
            "Português",
            "Ditongo",
            "conteudo",
            "https://rotapolicial.curseduca.pro/m/lessons/lingua-portuguesa1778770535857?classId=1939"
          ),
          missao(
            2,
            1,
            2,
            "Constitucional",
            "Direito à liberdade, propriedade e segurança",
            "conteudo",
            "https://areadoaluno.resumodoconcurseiro.com.br/courses/pmpe-direito-constitucional/lessons/direito-a-liberdade-12-2/",
            "https://www.qconcursos.com/questoes-de-concursos/questoes?discipline_ids%5B%5D=3&examining_board_ids%5B%5D=379&per_page=20&subject_ids%5B%5D=16323&subject_ids%5B%5D=16327"
          ),
        ],
        revisao: "Revisão do dia",
      },
      {
        numero: 2,
        missoes: [
          missao(
            2,
            2,
            1,
            "RLM",
            "Princípios, classificação e estruturas",
            "conteudo",
            "https://areadoaluno.resumodoconcurseiro.com.br/courses/pmpe-raciocinio-logico/lessons/principios-classificacao-e-estruturas/"
          ),
          missao(
            2,
            2,
            2,
            "Leis extravagantes",
            "Revisão das leis já estudadas via questões",
            "revisao",
            "https://areadoaluno.resumodoconcurseiro.com.br/courses/pmpe-legislacao-extravagante-raiz/lessons/aula-32/",
            "https://www.qconcursos.com/questoes-de-concursos/questoes?discipline_ids%5B%5D=9&examining_board_ids%5B%5D=16&examining_board_ids%5B%5D=379&my_questions=not_resolved&per_page=20&subject_ids%5B%5D=17461"
          ),
        ],
        revisao: "Constitucional",
      },
      {
        numero: 3,
        missoes: [
          missao(
            2,
            3,
            1,
            "Informática",
            "Internet, intranet e extranet",
            "conteudo",
            "https://areadoaluno.resumodoconcurseiro.com.br/courses/pmpe-informatica/lessons/aula-internet-intranet-extranet-e-vpn/"
          ),
          missao(
            2,
            3,
            2,
            "História",
            "A presença holandesa, o governo Nassau e a insurreição pernambucana",
            "conteudo",
            "https://areadoaluno.resumodoconcurseiro.com.br/courses/pmpe-historia-de-pernambuco/lessons/aula-13/"
          ),
        ],
        revisao: "Leis extravagantes",
      },
      {
        numero: 4,
        missoes: [
          missao(
            2,
            4,
            1,
            "Português",
            "Tritongo e Hiato",
            "conteudo",
            "https://rotapolicial.curseduca.pro/m/lessons/lingua-portuguesa1778770535857?classId=1941"
          ),
          missao(
            2,
            4,
            2,
            "Constitucional",
            "Revisão geral",
            "revisao",
            undefined,
            "https://www.qconcursos.com/questoes-de-concursos/questoes?discipline_ids%5B%5D=3&examining_board_ids%5B%5D=379&per_page=20&subject_ids%5B%5D=16323&subject_ids%5B%5D=16327"
          ),
        ],
        revisao: "Informática",
      },
      {
        numero: 5,
        missoes: [
          missao(
            2,
            5,
            1,
            "RLM",
            "Conectivos, tabelas-verdade e negação",
            "conteudo",
            "https://areadoaluno.resumodoconcurseiro.com.br/courses/pmpe-raciocinio-logico/lessons/negacao-7/",
            "https://www.qconcursos.com/questoes-de-concursos/questoes?discipline_ids%5B%5D=13&my_questions=not_resolved&per_page=20&subject_ids%5B%5D=14553&subject_ids%5B%5D=20313&subject_ids%5B%5D=20314"
          ),
          missao(
            2,
            5,
            2,
            "Leis extravagantes",
            "Lei Maria da Penha",
            "conteudo",
            "https://areadoaluno.resumodoconcurseiro.com.br/courses/pmpe-legislacao-extravagante-raiz/lessons/aula-34/",
            "https://www.qconcursos.com/questoes-de-concursos/questoes?discipline_ids%5B%5D=10&examining_board_ids%5B%5D=379&per_page=20&subject_ids%5B%5D=23514"
          ),
        ],
        revisao: "História",
      },
      {
        numero: 6,
        missoes: [
          missao(
            2,
            6,
            1,
            "Informática",
            "Segurança da informação (PDF)",
            "conteudo",
            "https://areadoaluno.resumodoconcurseiro.com.br/courses/pmpe-informatica/lessons/seguranca-da-informacao-pdf-5/"
          ),
          missao(
            2,
            6,
            2,
            "Matéria com maior dificuldade",
            "Questões e resumos",
            "livre"
          ),
        ],
        revisao: "Português e RLM",
      },
      {
        numero: 7,
        missoes: [
          missao(
            2,
            7,
            1,
            "História",
            "Revisão dos assuntos já estudados",
            "revisao"
          ),
          missao(
            2,
            7,
            2,
            "Revisão da semana 01",
            "10 questões de cada tópico estudado na semana",
            "revisao"
          ),
        ],
      },
    ],
  },

  {
    numero: 3,
    nome: "Semana 03",
    dias: [
      {
        numero: 1,
        missoes: [
          missao(
            3,
            1,
            1,
            "Português",
            "Dígrafo e Encontro Consonantal - Parte 1",
            "conteudo",
            "https://rotapolicial.curseduca.pro/m/lessons/lingua-portuguesa1778770535857?classId=1942"
          ),
          missao(3, 1, 2, "Constitucional", "Remédios constitucionais"),
        ],
        revisao: "Revisão do dia",
      },
      {
        numero: 2,
        missoes: [
          missao(3, 2, 1, "RLM", "Equivalências"),
          missao(
            3,
            2,
            2,
            "Leis extravagantes",
            "Revisão das leis já estudadas via questões",
            "revisao"
          ),
        ],
        revisao: "Constitucional",
      },
      {
        numero: 3,
        missoes: [
          missao(
            3,
            3,
            1,
            "Informática",
            "Conceitos de proteção e segurança - aulas 1 a 4"
          ),
          missao(
            3,
            3,
            2,
            "História",
            "Guerra dos Mascates e Revolução Pernambucana"
          ),
        ],
        revisao: "Leis extravagantes",
      },
      {
        numero: 4,
        missoes: [
          missao(
            3,
            4,
            1,
            "Português",
            "Dígrafo e Encontro Consonantal - Parte 2",
            "conteudo",
            "https://rotapolicial.curseduca.pro/m/lessons/lingua-portuguesa1778770535857?classId=1943"
          ),
          missao(
            3,
            4,
            2,
            "Constitucional",
            "Direitos sociais"
          ),
        ],
        revisao: "Informática",
      },
      {
        numero: 5,
        missoes: [
          missao(3, 5, 1, "RLM", "Inferências e conclusões"),
          missao(3, 5, 2, "Leis extravagantes", "Lei de drogas"),
        ],
        revisao: "História",
      },
      {
        numero: 6,
        missoes: [
          missao(
            3,
            6,
            1,
            "Informática",
            "Conceitos de proteção e segurança - aulas 5 a 9"
          ),
          missao(
            3,
            6,
            2,
            "Matéria com maior dificuldade",
            "Questões e resumos",
            "livre"
          ),
        ],
        revisao: "Português e RLM",
      },
      {
        numero: 7,
        missoes: [
          missao(3, 7, 1, "História", "Confederação do Equador"),
          missao(
            3,
            7,
            2,
            "Revisão da semana 01",
            "10 questões de cada tópico estudado na semana",
            "revisao"
          ),
        ],
      },
    ],
  },

  {
    numero: 4,
    nome: "Semana 04",
    dias: [
      {
        numero: 1,
        missoes: [
          missao(
            4,
            1,
            1,
            "Português",
            "Sílaba - Parte 1",
            "conteudo",
            "https://rotapolicial.curseduca.pro/m/lessons/lingua-portuguesa1778770535857?classId=1944"
          ),
          missao(
            4,
            1,
            2,
            "Constitucional",
            "Revisão geral",
            "revisao"
          ),
        ],
        revisao: "Revisão do dia",
      },
      {
        numero: 2,
        missoes: [
          missao(4, 2, 1, "RLM", "Revisão geral", "revisao"),
          missao(
            4,
            2,
            2,
            "Leis extravagantes",
            "Revisão das leis já estudadas via questões",
            "revisao"
          ),
        ],
        revisao: "Constitucional",
      },
      {
        numero: 3,
        missoes: [
          missao(
            4,
            3,
            1,
            "Informática",
            "Revisão geral",
            "revisao"
          ),
          missao(4, 3, 2, "História", "A Revolução Praieira"),
        ],
        revisao: "Leis extravagantes",
      },
      {
        numero: 4,
        missoes: [
          missao(
            4,
            4,
            1,
            "Português",
            "Sílaba - Parte 2",
            "conteudo",
            "https://rotapolicial.curseduca.pro/m/lessons/lingua-portuguesa1778770535857?classId=2394"
          ),
          missao(
            4,
            4,
            2,
            "Constitucional",
            "Revisão geral",
            "revisao"
          ),
        ],
        revisao: "Informática",
      },
      {
        numero: 5,
        missoes: [
          missao(
            4,
            5,
            1,
            "RLM",
            "Conectivos, tabelas-verdade e negação",
            "revisao"
          ),
          missao(
            4,
            5,
            2,
            "Leis extravagantes",
            "Revisão geral",
            "revisao"
          ),
        ],
        revisao: "História",
      },
      {
        numero: 6,
        missoes: [
          missao(
            4,
            6,
            1,
            "Informática",
            "Segurança da informação (PDF)"
          ),
          missao(
            4,
            6,
            2,
            "Matéria com maior dificuldade",
            "Questões e resumos",
            "livre"
          ),
        ],
        revisao: "Português e RLM",
      },
      {
        numero: 7,
        missoes: [
          missao(
            4,
            7,
            1,
            "História",
            "Revisão dos assuntos já estudados",
            "revisao"
          ),
          missao(
            4,
            7,
            2,
            "Revisão das semanas 01 e 02",
            "10 questões de cada tópico estudado",
            "revisao"
          ),
        ],
      },
    ],
  },

  {
    numero: 5,
    nome: "Semana 05",
    dias: [
      {
        numero: 1,
        missoes: [
          missao(
            5,
            1,
            1,
            "Português",
            "Acentuação - Parte 01",
            "conteudo",
            "https://rotapolicial.curseduca.pro/m/lessons/lingua-portuguesa1778770535857?classId=1945"
          ),
          missao(
            5,
            1,
            2,
            "Constitucional",
            "Nacionalidade e direitos políticos"
          ),
        ],
        revisao: "Revisão do dia",
      },
      {
        numero: 2,
        missoes: [
          missao(5, 2, 1, "RLM", "Diagramas lógicos"),
          missao(
            5,
            2,
            2,
            "Leis extravagantes",
            "Crimes hediondos"
          ),
        ],
        revisao: "Constitucional",
      },
      {
        numero: 3,
        missoes: [
          missao(
            5,
            3,
            1,
            "Informática",
            "Evolução do armazenamento, armazenamento e tipos de nuvem"
          ),
          missao(5, 3, 2, "História", "Guerra dos Cabanos"),
        ],
        revisao: "Leis extravagantes",
      },
      {
        numero: 4,
        missoes: [
          missao(
            5,
            4,
            1,
            "Português",
            "Acentuação - Parte 02",
            "conteudo",
            "https://rotapolicial.curseduca.pro/m/lessons/lingua-portuguesa1778770535857?classId=1946"
          ),
          missao(
            5,
            4,
            2,
            "Constitucional",
            "Organização do Estado"
          ),
        ],
        revisao: "Informática",
      },
      {
        numero: 5,
        missoes: [
          missao(5, 5, 1, "RLM", "Revisão geral", "revisao"),
          missao(
            5,
            5,
            2,
            "Leis extravagantes",
            "Lei de racismo"
          ),
        ],
        revisao: "História",
      },
      {
        numero: 6,
        missoes: [
          missao(
            5,
            6,
            1,
            "Informática",
            "Computação em nuvem e conceitos de backup"
          ),
          missao(
            5,
            6,
            2,
            "Matéria com maior dificuldade",
            "Questões e resumos",
            "livre"
          ),
        ],
        revisao: "Português e RLM",
      },
      {
        numero: 7,
        missoes: [
          missao(5, 7, 1, "História", "Formação dos quilombos"),
          missao(
            5,
            7,
            2,
            "Revisão da semana",
            "10 questões de cada tópico estudado",
            "revisao"
          ),
        ],
      },
    ],
  },

  {
    numero: 6,
    nome: "Semana 06",
    dias: [
      {
        numero: 1,
        missoes: [
          missao(
            6,
            1,
            1,
            "Português",
            "Acentuação - Parte 03",
            "conteudo",
            "https://rotapolicial.curseduca.pro/m/lessons/lingua-portuguesa1778770535857?classId=1947"
          ),
          missao(6, 1, 2, "Constitucional", "Poder Executivo"),
        ],
        revisao: "Revisão do dia",
      },
      {
        numero: 2,
        missoes: [
          missao(6, 2, 1, "RLM", "Análise combinatória"),
          missao(
            6,
            2,
            2,
            "Leis extravagantes",
            "Crimes ambientais"
          ),
        ],
        revisao: "Constitucional",
      },
      {
        numero: 3,
        missoes: [
          missao(
            6,
            3,
            1,
            "Informática",
            "Área de trabalho e ambientes operacionais"
          ),
          missao(
            6,
            3,
            2,
            "História",
            "Revisão geral dos assuntos já estudados",
            "revisao"
          ),
        ],
        revisao: "Leis extravagantes",
      },
      {
        numero: 4,
        missoes: [
          missao(
            6,
            4,
            1,
            "Português",
            "Acentuação - Parte 04",
            "conteudo",
            "https://rotapolicial.curseduca.pro/m/lessons/lingua-portuguesa1778770535857?classId=2398"
          ),
          missao(
            6,
            4,
            2,
            "Constitucional",
            "Revisão geral via questões",
            "revisao"
          ),
        ],
        revisao: "Informática",
      },
      {
        numero: 5,
        missoes: [
          missao(6, 5, 1, "RLM", "Princípios da contagem"),
          missao(
            6,
            5,
            2,
            "Leis extravagantes",
            "Revisão: leia o conteúdo 'Vai cair na sua prova'",
            "revisao"
          ),
        ],
        revisao: "História",
      },
      {
        numero: 6,
        missoes: [
          missao(6, 6, 1, "Informática", "Word - aulas 1 e 2"),
          missao(
            6,
            6,
            2,
            "Matéria com maior dificuldade",
            "Questões e resumos",
            "livre"
          ),
        ],
        revisao: "Português e RLM",
      },
      {
        numero: 7,
        missoes: [
          missao(
            6,
            7,
            1,
            "História",
            "Revisão geral dos assuntos já estudados",
            "revisao"
          ),
          missao(
            6,
            7,
            2,
            "Revisão da semana",
            "10 questões de cada tópico estudado",
            "revisao"
          ),
        ],
      },
    ],
  },

  {
    numero: 7,
    nome: "Semana 07",
    dias: [
      {
        numero: 1,
        missoes: [
          missao(
            7,
            1,
            1,
            "Português",
            "Aula 01 - Os 5 Pilares do Português",
            "conteudo",
            "https://rotapolicial.curseduca.pro/m/lessons/lingua-portuguesa1778770535857?classId=1948"
          ),
          missao(
            7,
            1,
            2,
            "Constitucional",
            "Revisão geral via questões",
            "revisao"
          ),
        ],
        revisao: "Revisão do dia",
      },
      {
        numero: 2,
        missoes: [
          missao(
            7,
            2,
            1,
            "RLM",
            "Revisão geral via questões",
            "revisao"
          ),
          missao(
            7,
            2,
            2,
            "Leis extravagantes",
            "Revisão geral via questões",
            "revisao"
          ),
        ],
        revisao: "Constitucional",
      },
      {
        numero: 3,
        missoes: [
          missao(
            7,
            3,
            1,
            "Informática",
            "Revisão geral via questões",
            "revisao"
          ),
          missao(
            7,
            3,
            2,
            "História",
            "Revisão geral dos assuntos já estudados",
            "revisao"
          ),
        ],
        revisao: "Leis extravagantes",
      },
      {
        numero: 4,
        missoes: [
          missao(
            7,
            4,
            1,
            "Português",
            "Aula 02 - Morfologia: Visão Geral",
            "conteudo",
            "https://rotapolicial.curseduca.pro/m/lessons/lingua-portuguesa1778770535857?classId=1949"
          ),
          missao(
            7,
            4,
            2,
            "Constitucional",
            "Revisão geral via questões",
            "revisao"
          ),
        ],
        revisao: "Informática",
      },
      {
        numero: 5,
        missoes: [
          missao(
            7,
            5,
            1,
            "RLM",
            "Revisão geral via questões",
            "revisao"
          ),
          missao(
            7,
            5,
            2,
            "Leis extravagantes",
            "Revisão: leia o conteúdo 'Vai cair na sua prova'",
            "revisao"
          ),
        ],
        revisao: "História",
      },
      {
        numero: 6,
        missoes: [
          missao(
            7,
            6,
            1,
            "Informática",
            "Revisão geral via questões",
            "revisao"
          ),
          missao(
            7,
            6,
            2,
            "Matéria com maior dificuldade",
            "Questões e resumos",
            "livre"
          ),
        ],
        revisao: "Português e RLM",
      },
      {
        numero: 7,
        missoes: [
          missao(
            7,
            7,
            1,
            "História",
            "Revisão geral dos assuntos já estudados",
            "revisao"
          ),
          missao(
            7,
            7,
            2,
            "Revisão da semana",
            "10 questões de cada tópico estudado",
            "revisao"
          ),
        ],
      },
    ],
  },

  {
    numero: 8,
    nome: "Semana 08",
    dias: [
      {
        numero: 1,
        missoes: [
          missao(
            8,
            1,
            1,
            "Português",
            "Aula 03 - Morfologia: Os 3 Pilares",
            "conteudo",
            "https://rotapolicial.curseduca.pro/m/lessons/lingua-portuguesa1778770535857?classId=1950"
          ),
          missao(
            8,
            1,
            2,
            "Constitucional",
            "Revisão geral via questões",
            "revisao"
          ),
        ],
        revisao: "Revisão do dia",
      },
      {
        numero: 2,
        missoes: [
          missao(8, 2, 1, "RLM", "Revisão final", "revisao"),
          missao(
            8,
            2,
            2,
            "Leis extravagantes",
            "Revisão geral via questões",
            "revisao"
          ),
        ],
        revisao: "Constitucional",
      },
      {
        numero: 3,
        missoes: [
          missao(
            8,
            3,
            1,
            "Informática",
            "Revisão final",
            "revisao"
          ),
          missao(
            8,
            3,
            2,
            "História",
            "Revisão geral dos assuntos já estudados",
            "revisao"
          ),
        ],
        revisao: "Leis extravagantes",
      },
      {
        numero: 4,
        missoes: [
          missao(
            8,
            4,
            1,
            "Português",
            "Aula 04 - Classificação das Palavras: Variáveis e Invariáveis - Parte 1",
            "conteudo",
            "https://rotapolicial.curseduca.pro/m/lessons/lingua-portuguesa1778770535857?classId=1951"
          ),
          missao(
            8,
            4,
            2,
            "Constitucional",
            "Revisão geral via questões",
            "revisao"
          ),
        ],
        revisao: "Informática",
      },
      {
        numero: 5,
        missoes: [
          missao(8, 5, 1, "RLM", "Revisão final", "revisao"),
          missao(
            8,
            5,
            2,
            "Leis extravagantes",
            "Revisão: leia o conteúdo 'Vai cair na sua prova'",
            "revisao"
          ),
        ],
        revisao: "História",
      },
      {
        numero: 6,
        missoes: [
          missao(
            8,
            6,
            1,
            "Informática",
            "Revisão final",
            "revisao"
          ),
          missao(
            8,
            6,
            2,
            "Matéria com maior dificuldade",
            "Questões e resumos",
            "livre"
          ),
        ],
        revisao: "Português e RLM",
      },
      {
        numero: 7,
        missoes: [
          missao(8, 7, 1, "História", "Revisão final", "revisao"),
          missao(8, 7, 2, "Redação", "Produção de redação", "redacao"),
        ],
      },
    ],
  },
];