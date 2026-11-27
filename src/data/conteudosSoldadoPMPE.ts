type AulaRdc = [id: number, nome: string, modulo?: number, titulosAnteriores?: string[]];
type AssuntoRdc = [chave: string, nome: string, aulas: AulaRdc[], aliases?: string[]];

export type DisciplinaRdc = {
  id: string;
  nome: string;
  aliases: string[];
  moduloRdc: number;
  assuntos: AssuntoRdc[];
};

// Títulos e links do índice de aulas do RDC. As partes de uma mesma aula
// ficam no assunto principal, na ordem do curso.
export const CONTEUDOS_SOLDADO_PMPE: DisciplinaRdc[] = [
  {
    id: "portugues", nome: "Português", aliases: ["Língua Portuguesa"], moduloRdc: 2,
    assuntos: [
      ["interpretacao", "Compreensão e interpretação de textos", [[5, "Compreensão e interpretação de textos"]]],
      ["generos", "Tipos e gêneros textuais", [[6, "Tipos e gêneros textuais"], [133, "Exercícios de tipologia textual", 17]], ["Tipologias e gêneros textuais"]],
      ["ortografia", "Ortografia", [[7, "Ortografia"], [134, "Exercícios de ortografia", 17]], ["Ortografia oficial"]],
      ["classes", "Classes de palavras", [[8, "Artigo, substantivo e adjetivo"], [9, "Advérbio, numeral e pronome"], [10, "Preposição, conjunção e interjeição"], [139, "Exercícios de classes de palavras", 17]], ["Emprego das classes de palavras"]],
      ["verbos", "Verbos", [[11, "Verbos"], [136, "Exercícios de tempos e modos verbais", 17]], ["Verbo"]],
      ["coordenacao", "Coordenação entre orações", [[12, "Coordenação entre orações"], [138, "Exercícios de orações coordenadas", 17]], ["Orações coordenadas"]],
      ["subordinacao", "Orações subordinadas", [[13, "Subordinação entre orações"], [14, "Orações subordinadas"], [15, "Orações subordinadas adverbiais"], [140, "Exercícios de orações subordinadas", 17]]],
      ["pontuacao", "Pontuação", [[16, "Pontuação"], [141, "Exercícios de pontuação", 17]], ["Emprego dos sinais de pontuação e suas funções no texto"]],
      ["sintaxe", "Análise sintática", [[17, "Análise sintática - Parte 1"], [18, "Análise sintática - Parte 2"], [137, "Exercícios de morfossintaxe", 17]], ["Sintaxe da oração e do período"]],
      ["concordancia", "Concordância verbal e nominal", [[19, "Concordância verbal e nominal"], [142, "Exercícios de concordância nominal", 17]], ["Concordância nominal e verbal"]],
      ["crase", "Crase", [[20, "Uso do sinal grave indicativo de crase"], [144, "Exercícios de crase", 17]], ["Emprego do sinal indicativo de crase"]],
      ["colocacao", "Colocação pronominal", [[21, "Colocação pronominal"], [145, "Exercícios de colocação pronominal", 17]]],
      ["reescritura", "Reescritura de frases e textos", [[22, "Reescritura de frases e textos"]]],
      ["significacao", "Semântica e estilística", [[23, "Semântica e estilística"]], ["Significação das palavras"]],
      ["coesao", "Coesão textual", [[135, "Exercícios de coesão textual", 17]], ["Mecanismos de coesão textual"]],
      ["figuras", "Figuras de linguagem", [[24, "Figuras de linguagem"]]],
      ["regencia", "Regência nominal e verbal", [[143, "Exercícios de regência nominal e verbal", 17]]],
    ],
  },
  {
    id: "historia-pe", nome: "História de Pernambuco", aliases: ["História", "História PE"], moduloRdc: 3,
    assuntos: [
      ["orientacao", "Como estudar História de Pernambuco", [[25, "Explicações iniciais de como estudar História de Pernambuco"]]],
      ["ocupacao", "Ocupação e colonização de Pernambuco", [[26, "Ocupação, colonização, contatos iniciais, capitanias hereditárias e Duarte Coelho"]], ["Ocupação, colonização, contatos iniciais e capitanias hereditárias", "Ocupação e colonização: contatos iniciais, Capitanias Hereditárias e Duarte Coelho"]],
      ["importancia", "A importância de Pernambuco", [[27, "A importância de Pernambuco"]]],
      ["holandeses", "Presença holandesa e governo Nassau", [[28, "Presença holandesa, governo Nassau e Insurreição Pernambucana"]], ["A presença holandesa e o governo de Maurício de Nassau", "A presença holandesa, o governo Nassau e a insurreição pernambucana"]],
      ["quilombos", "Formação dos quilombos", [[34, "Formação dos quilombos"]]],
      ["insurreicao", "Insurreição Pernambucana", [[350, "Insurreição Pernambucana"]]],
      ["mascates", "Guerra dos Mascates", [[29, "Guerra dos Mascates"]]],
      ["revolucao", "Revolução Pernambucana", [[30, "Revolução Pernambucana"]]],
      ["equador", "Confederação do Equador", [[31, "Confederação do Equador"]]],
      ["cabanos", "Guerra dos Cabanos", [[33, "Guerra dos Cabanos"]]],
      ["praieira", "Revolução Praieira", [[32, "Revolução Praieira"]], ["A Revolução Praieira", "Revolução Praiera"]],
      ["republica", "Pernambuco e a República", [[35, "Pernambuco e a República"]], ["Pernambuco durante o período republicano"]],
      ["cultura", "Movimentos culturais e herança afrodescendente", [[36, "Movimentos culturais e herança afrodescendente"]], ["Manifestações da cultura popular pernambucana"]],
    ],
  },
  {
    id: "rlm", nome: "Raciocínio Lógico e Matemática", aliases: ["RLM", "Raciocínio Lógico", "Raciocínio lógico Matemático"], moduloRdc: 4,
    assuntos: [
      ["interpretacao", "Interpretação de problemas em concursos", [[418, "Interpretação de problemas em concursos"]]],
      ["operacoes", "Operações básicas da matemática", [[419, "Operações básicas da matemática"]]],
      ["proposicoes", "Proposições lógicas", [[71, "Proposições lógicas"], [73, "Exercícios de proposições e conectivos lógicos"]]],
      ["conectivos", "Conectivos lógicos", [[72, "Conectivos lógicos"]]],
      ["negacao", "Negação de proposições", [[74, "Negação de proposições"], [75, "Exercícios de negação"]]],
      ["tabela-verdade", "Tabela-verdade", [[76, "Tabela-verdade"]]],
      ["equivalencia", "Equivalências lógicas", [[77, "Equivalências lógicas"], [78, "Exercícios de equivalências lógicas"]], ["Equivalências"]],
      ["argumentacao", "Lógica argumentativa", [[79, "Lógica argumentativa"], [82, "Lógica argumentativa - Argumentos válidos e inválidos"], [84, "Exercícios de lógica argumentativa"]]],
      ["quantificadores", "Quantificadores lógicos", [[80, "Quantificadores lógicos"], [81, "Exercícios de quantificadores lógicos"]]],
      ["falacias", "Falácias", [[83, "Falácias"]], ["Falácias lógicas"]],
      ["tautologias", "Tautologias, contradições e contingências", [[85, "Tautologias, contradições e contingências"]]],
      ["diagramas", "Diagramas lógicos", [[425, "Diagramas lógicos"], [579, "Diagramas lógicos - Problemas matriciais"]]],
      ["probabilidade", "Probabilidade", [[426, "Probabilidade simples"], [651, "Probabilidade da união"], [652, "Probabilidade condicional"], [653, "Resolução de questões de probabilidade"]]],
      ["conjuntos", "Conjuntos", [[576, "Exercício aplicado de conjuntos"]]],
      ["contagem", "Princípios da contagem", [[577, "Princípios da contagem - Problemas aritméticos"]], ["Princípios de contagem"]],
      ["sequencias", "Sequências lógicas", [[578, "Sequências lógicas"]]],
      ["combinacao", "Análise combinatória", [
        [580, "Análise combinatória (combinação)"],
        [581, "Exercícios de análise combinatória: arranjo, permutação e combinação", undefined, ["Exercícios de análise combinatória"]],
      ], ["Combinação", "Combinação simples", "Análise combinatória: combinação"]],
    ],
  },
  {
    id: "informatica", nome: "Informática", aliases: ["Noções de Informática"], moduloRdc: 5,
    assuntos: [
      ["fundamentos", "Fundamentos da computação", [[37, "Fundamentos da computação - Parte I"], [38, "Fundamentos da computação - Parte II"]]],
      ["internet", "Internet, intranet, extranet e VPN", [[39, "Internet, intranet, extranet e VPN"]], ["Internet e intranet", "Internet, intranet e extranet"]],
      ["seguranca", "Segurança da informação", [[40, "Conceitos e princípios"], [41, "Disponibilidade, integridade, confidencialidade e autenticidade"], [42, "Política de senhas"], [43, "Visão geral dos malwares"], [44, "Vírus, trojan, ransomware e rootkit"], [45, "Backdoor, worm, bot, spyware e hijacker"], [46, "Engenharia social, spam, phishing e pharming"], [47, "Principais tipos de ataques"], [48, "Aplicativos de segurança, IDS, IPS, antivírus e firewall"]], ["Proteção e segurança da informação"]],
      ["nuvem", "Armazenamento e computação em nuvem", [[49, "Armazenamento e tipos de nuvem"], [50, "Conceito e tipos de computação em nuvem"]]],
      ["backup", "Backup", [[51, "Conceito, tipos e características de backup"]]],
      ["perifericos", "Gerenciamento de arquivos e instalação de periféricos", [[52, "Organização de arquivos, pastas e programas e instalação de periféricos"]]],
      ["windows", "Windows", [[53, "Windows - Parte I"], [54, "Windows - Parte II"], [55, "Windows - Parte III"]]],
      ["word", "Word", [[56, "Word - Parte I"], [57, "Word - Parte II"], [58, "Word - Parte III"], [59, "Word - Parte IV"]], ["Word 2019", "Word - aulas 1 e 2"]],
      ["excel", "Excel e PowerPoint", [[60, "Excel - Parte I"], [61, "Excel - Parte II"], [62, "Excel - Parte III"], [63, "Excel - Parte IV e PowerPoint"]], ["Excel 2019", "Microsoft Excel"]],
      ["redes", "Redes de computadores", [[64, "Navegadores e sincronização"], [65, "Contas, navegação anônima e gerenciador de tarefas"], [66, "Complementos, cache, cookies, histórico e atalhos"], [67, "Conteúdo da internet e buscadores"], [68, "Buscas avançadas - Parte I"], [69, "Buscas avançadas - Parte II"], [70, "Grupos de discussão, redes sociais e questões"]]],
    ],
  },
  {
    id: "constitucional", nome: "Direito Constitucional", aliases: ["Constitucional"], moduloRdc: 7,
    assuntos: [
      ["principios", "Princípios fundamentais", [[86, "Princípios fundamentais"]], ["Dos princípios fundamentais"]],
      ["garantias", "Direitos e garantias fundamentais", [[586, "Direitos e garantias fundamentais - Resumão"]]],
      ["vida", "Direito à vida", [[87, "Direito à vida"]]],
      ["igualdade", "Direito à igualdade", [[88, "Direito à igualdade"]]],
      ["liberdade", "Direito à liberdade", [[89, "Direito à liberdade"]]],
      ["propriedade", "Direito à propriedade", [[90, "Direito à propriedade"]]],
      ["seguranca", "Direito à segurança", [[91, "Direito à segurança"]]],
      ["remedios", "Remédios constitucionais", [[92, "Remédios constitucionais"]]],
      ["sociais", "Direitos sociais", [[93, "Direitos sociais"]]],
      ["nacionalidade", "Direito de nacionalidade", [[94, "Direito de nacionalidade"]]],
      ["politicos", "Direitos políticos e partidos políticos", [[95, "Direitos políticos e partidos políticos"]]],
      ["competencias", "Organização político-administrativa do Estado", [[96, "Organização político-administrativa do Estado"]], ["Organização do Estado"]],
      ["executivo", "Poder Executivo", [[97, "Poder Executivo"]]],
      ["judiciario", "Poder Judiciário", [[98, "Poder Judiciário"]]],
      ["legislativo", "Poder Legislativo", [[99, "Poder Legislativo"]]],
      ["defesa", "Defesa do Estado e das instituições democráticas", [[100, "Defesa do Estado e das instituições democráticas"]]],
    ],
  },
  {
    id: "direitos-humanos", nome: "Direitos Humanos", aliases: ["Noções de Direitos Humanos"], moduloRdc: 8,
    assuntos: [
      ["teoria", "Teoria geral dos Direitos Humanos", [[101, "Teoria geral dos Direitos Humanos"]]],
      ["evolucao", "Evolução histórica e gerações de Direitos Humanos", [[421, "Evolução histórica e gerações de Direitos Humanos"]]],
      ["tratados", "Incorporação dos tratados de Direitos Humanos", [[422, "Incorporação dos tratados internacionais de Direitos Humanos"]], ["Incorporação e hierarquia dos tratados internacionais de Direitos Humanos no Brasil"]],
      ["dudh", "Declaração Universal dos Direitos Humanos", [[102, "Declaração Universal dos Direitos Humanos"]], ["Declaração Universal dos Direitos Humanos (ONU, 1948)"]],
      ["pacto", "Convenção Americana sobre Direitos Humanos", [[423, "Pacto de San José da Costa Rica"]], ["Convenção Americana sobre Direitos Humanos - Pacto de San José da Costa Rica"]],
    ],
  },
  {
    id: "leis-extravagantes", nome: "Legislação Extravagante", aliases: ["Leis extravagantes", "Legislação especial"], moduloRdc: 9,
    assuntos: [
      ["abuso", "Lei de Abuso de Autoridade", [[103, "Lei de Abuso de Autoridade"]], ["Abuso de autoridade", "Lei nº 13.869/2019 - Lei de Abuso de Autoridade"]],
      ["tortura", "Lei de Tortura", [[104, "Lei de Tortura"]], ["Lei nº 9.455/1997 - Lei de Tortura"]],
      ["maria-penha", "Lei Maria da Penha", [[105, "Lei Maria da Penha"]], ["Maria da Penha", "Lei nº 11.340/2006 - Lei Maria da Penha"]],
      ["drogas", "Lei de Drogas", [[106, "Lei de Drogas"]], ["Lei de Drogas (Lei 11.343/2006)", "Lei nº 11.343/2006 - Lei de Drogas"]],
      ["hediondos", "Crimes hediondos", [[107, "Crimes hediondos"]], ["Lei nº 8.072/1990 - Crimes Hediondos"]],
      ["racismo", "Lei de Racismo", [[108, "Crimes resultantes de preconceito de raça ou de cor"]], ["Lei nº 7.716/1989 - Crimes resultantes de Preconceito de Raça ou de Cor"]],
      ["ambientais", "Crimes ambientais", [[109, "Crimes ambientais"]], ["Lei nº 9.605/1998 - Crimes Ambientais"]],
      ["eca", "Estatuto da Criança e do Adolescente", [[110, "Estatuto da Criança e do Adolescente"]], ["ECA: ato infracional e atuação policial", "Estatuto da Criança e do Adolescente: pontos pertinentes à atividade policial"]],
      ["idoso", "Estatuto da Pessoa Idosa", [[437, "Estatuto da Pessoa Idosa"]], ["Estatuto do idoso", "Lei nº 10.741/2003 - Estatuto da Pessoa Idosa: atuação policial e crimes em espécie"]],
      ["juventude", "Estatuto da Juventude", [[642, "Estatuto da Juventude"]], ["Lei nº 12.852/2013 - Estatuto da Juventude"]],
    ],
  },
  {
    id: "estatuto-pmpe", nome: "Estatuto PMPE", aliases: ["Estatuto PMPE (Pós Edital)", "Estatuto dos Policiais Militares de Pernambuco"], moduloRdc: 19,
    assuntos: [
      ["disposicoes", "Disposições preliminares", [[129, "Disposições preliminares"]]],
      ["hierarquia", "Hierarquia e disciplina", [[130, "Hierarquia e disciplina"]]],
      ["funcoes", "Cargo e funções da PMPE", [[131, "Cargo e funções da PMPE"]]],
      ["deveres", "Obrigações e deveres", [[132, "Obrigações e deveres"]]],
      ["crimes", "Crimes militares", [[341, "Crimes militares"]]],
      ["prerrogativas", "Direitos e prerrogativas", [[342, "Direitos e prerrogativas"]]],
      ["afastamentos", "Férias, licenças e afastamentos", [[343, "Férias, licenças e afastamentos"]]],
      ["protecao", "Sistema de proteção social", [[344, "Sistema de proteção social"]]],
    ],
  },
  {
    id: "redacao", nome: "Redação", aliases: ["Produção textual"], moduloRdc: 16,
    assuntos: [
      ["estrutura", "Texto dissertativo-argumentativo", [[116, "O texto dissertativo argumentativo"]]],
      ["tese", "Tema, tese e planejamento", [[117, "A abordagem temática"], [118, "A tese"], [659, "Planejamento textual"]]],
      ["argumentacao", "Argumentação e desenvolvimento", [[119, "Antecipação argumentativa"], [120, "Estrutura técnica de argumentação"], [122, "Desenvolvimento e fundamentação - Parte 1"], [123, "Argumentos (aprofundamento)"], [124, "Desenvolvimento - Parte 2"], [127, "Lacunas argumentativas"]]],
      ["perfil-prova", "Redação na prova", [[125, "O perfil de redação em carreiras policiais"], [126, "O que a banca penaliza?"]]],
      ["conclusao", "Conclusão e revisão da redação", [[657, "Retomada textual"], [658, "Desfecho e suas variações"], [128, "A conclusão"], [660, "Gramática e redação"], [661, "Checklist da redação"]]],
    ],
  },
];
