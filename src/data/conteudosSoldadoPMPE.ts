type Topico = {
  chave: string;
  nome: string;
  aliases?: string[];
  aulas?: [id: number, nome: string, modulo?: number][];
  resumo?: string;
  fonte?: [nome: string, url: string];
};

type Disciplina = {
  id: string;
  nome: string;
  aliases: string[];
  moduloRdc: number;
  modulos: { id: string; nome: string; topicos: Topico[] }[];
};

const constituicao: Topico["fonte"] = [
  "Constituição Federal", "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
];
const eca: Topico["fonte"] = [
  "Estatuto da Criança e do Adolescente", "https://www.planalto.gov.br/ccivil_03/leis/l8069.htm",
];
const libreOffice: Topico["fonte"] = [
  "Guias do LibreOffice em português", "https://documentation.libreoffice.org/pt-br/portugues/",
];

// Anexo II do Edital 001/2026 (Soldado). Os IDs numéricos são links de
// aulas conferidas no índice do RDC, na área de membros do curso PMPE.
export const CONTEUDOS_SOLDADO_PMPE: Disciplina[] = [
  {
    id: "portugues", nome: "Português", aliases: ["Língua Portuguesa"], moduloRdc: 2,
    modulos: [
      { id: "leitura", nome: "Leitura, textos e sentido", topicos: [
        { chave: "interpretacao", nome: "Compreensão e interpretação de textos", aulas: [[5, "Compreensão e interpretação de textos"]] },
        { chave: "generos", nome: "Tipologias e gêneros textuais", aliases: ["Tipos e gêneros textuais"], aulas: [[6, "Tipos e gêneros textuais"]] },
        { chave: "figuras", nome: "Figuras de linguagem", aulas: [[24, "Figuras de linguagem"]] },
        { chave: "relacoes-semanticas", nome: "Relações semânticas entre orações, períodos ou parágrafos", aliases: ["Relações semânticas estabelecidas entre orações, períodos ou parágrafos"], resumo: "Identifique o sentido do conectivo no contexto. Compare causa (porque), concessão (embora), conclusão (portanto), oposição (mas), alternância (ou) e adição (além disso)." },
        { chave: "coesao", nome: "Mecanismos de coesão textual", aliases: ["Coesão textual"], aulas: [[135, "Resolução de questões de coesão textual", 17]] },
        { chave: "significacao", nome: "Significação das palavras", aulas: [[23, "Semântica e estilística"]] },
        { chave: "variacao", nome: "Variação linguística", resumo: "Compare a variação de região, grupo social, época e situação comunicativa. Identifique quando o enunciado pede adequação ao contexto ou à norma-padrão." },
      ] },
      { id: "gramatica", nome: "Ortografia, morfologia e sintaxe", topicos: [
        { chave: "ortografia", nome: "Ortografia oficial", aliases: ["Ortografia"], aulas: [[7, "Ortografia"]] },
        { chave: "acentuacao", nome: "Acentuação gráfica", resumo: "Classifique a palavra pela posição da sílaba tônica e aplique a regra correspondente. Todas as proparoxítonas recebem acento, como lâmpada." },
        { chave: "classes", nome: "Emprego das classes de palavras", aulas: [[8, "Artigo, substantivo e adjetivo"], [9, "Advérbio, numeral e pronome"], [10, "Preposição, conjunção e interjeição"], [11, "Verbos"]] },
        { chave: "crase", nome: "Emprego do sinal indicativo de crase", aliases: ["Crase", "Uso do sinal grave indicativo de crase"], aulas: [[20, "Uso do sinal grave indicativo de crase"]] },
        { chave: "sintaxe", nome: "Sintaxe da oração e do período", aulas: [[17, "Análise sintática - Parte 1"], [18, "Análise sintática - Parte 2"], [12, "Coordenação entre orações"], [13, "Subordinação entre orações"], [15, "Orações subordinadas adverbiais"]] },
        { chave: "que-se", nome: "Funções do “que” e do “se”", resumo: "Em “o livro que li”, que é pronome relativo. Em “espero que venha”, é conjunção integrante. Em “vendem-se casas”, se é partícula apassivadora. Em “precisa-se de funcionários”, indetermina o sujeito." },
        { chave: "pontuacao", nome: "Emprego dos sinais de pontuação e suas funções no texto", aliases: ["Pontuação"], aulas: [[16, "Pontuação"]] },
        { chave: "concordancia", nome: "Concordância nominal e verbal", aliases: ["Concordância verbal e nominal"], aulas: [[19, "Concordância verbal e nominal"]] },
        { chave: "regencia", nome: "Regência nominal e verbal", aulas: [[143, "Resolução de questões de regência", 17]] },
        { chave: "colocacao", nome: "Colocação pronominal", aulas: [[21, "Colocação pronominal"]] },
        { chave: "formacao", nome: "Processos de formação de palavras", resumo: "Distinga derivação de composição. Infeliz tem prefixação, felizmente tem sufixação e guarda-chuva é composição por justaposição." },
      ] },
    ],
  },
  {
    id: "historia-pe", nome: "História de Pernambuco", aliases: ["História", "História PE"], moduloRdc: 3,
    modulos: [{ id: "pernambuco", nome: "Formação, movimentos e cultura de Pernambuco", topicos: [
      { chave: "ocupacao", nome: "Ocupação e colonização de Pernambuco", aliases: ["Ocupação e colonização: contatos iniciais, Capitanias Hereditárias e Duarte Coelho", "Ocupação, colonização, contatos iniciais e capitanias hereditárias"], aulas: [[26, "Ocupação, colonização, capitanias hereditárias e Duarte Coelho"]] },
      { chave: "acucar", nome: "A importância do açúcar para a economia local", aliases: ["Economia açucareira"], resumo: "Relacione os engenhos, a mão de obra escravizada e o comércio atlântico. Identifique o papel do porto do Recife no escoamento da produção." },
      { chave: "olinda-recife", nome: "Formação de Olinda e Recife", resumo: "Olinda se consolidou como núcleo administrativo da capitania. O Recife cresceu em torno do porto e do comércio açucareiro.", fonte: ["IPHAN • Formação urbana do Brasil", "https://portal.iphan.gov.br/uploads/publicacao/arq_formacao_do_brasil.pdf"] },
      { chave: "holandeses", nome: "A presença holandesa e o governo de Maurício de Nassau", aliases: ["A presença holandesa, o governo Nassau e a insurreição pernambucana"], aulas: [[28, "Presença holandesa, governo Nassau e Insurreição Pernambucana"]] },
      { chave: "quilombos", nome: "Formação dos quilombos", aulas: [[34, "Formação dos quilombos"]] },
      { chave: "insurreicao", nome: "Insurreição Pernambucana", aulas: [[350, "Insurreição Pernambucana"]] },
      { chave: "mascates", nome: "Guerra dos Mascates", aulas: [[29, "Guerra dos Mascates"]] },
      { chave: "revolucao", nome: "Revolução Pernambucana", aulas: [[30, "Revolução Pernambucana"]] },
      { chave: "equador", nome: "Confederação do Equador", aulas: [[31, "Confederação do Equador"]] },
      { chave: "cabanos", nome: "Guerra dos Cabanos", aulas: [[33, "Guerra dos Cabanos"]] },
      { chave: "praieira", nome: "Revolução Praieira", aliases: ["A Revolução Praieira", "Revolução Praiera"], aulas: [[32, "Revolução Praieira"]] },
      { chave: "republica", nome: "Pernambuco durante o período republicano", aliases: ["Pernambuco e a República"], aulas: [[35, "Pernambuco e a República"]] },
      { chave: "cultura", nome: "Manifestações da cultura popular pernambucana", resumo: "Revise frevo, maracatu, culinária e festas populares.", aulas: [[36, "Movimentos culturais e herança afrodescendente"]] },
      { chave: "afro", nome: "Aspectos afro-brasileiros em Pernambuco", resumo: "Estude a herança afrodescendente nas manifestações culturais pernambucanas.", aulas: [[36, "Movimentos culturais e herança afrodescendente"]] },
    ] }],
  },
  {
    id: "rlm", nome: "Raciocínio Lógico e Matemática", aliases: ["RLM", "Raciocínio Lógico", "Raciocínio lógico Matemático"], moduloRdc: 4,
    modulos: [
      { id: "logica", nome: "Lógica proposicional e argumentação", topicos: [
        { chave: "proposicoes", nome: "Proposições lógicas", aulas: [[71, "Proposições lógicas"]] },
        { chave: "conectivos", nome: "Conectivos lógicos", aulas: [[72, "Conectivos lógicos"], [74, "Negação de proposições"], [76, "Tabela verdade"]] },
        { chave: "quantificadores", nome: "Quantificadores lógicos", aulas: [[80, "Quantificadores lógicos"]] },
        { chave: "falacias", nome: "Falácias", aliases: ["Falácias lógicas"], aulas: [[83, "Falácias"]] },
        { chave: "argumentacao", nome: "Lógica de argumentação: analogias, inferências, deduções e validade", aliases: ["Lógica argumentativa"], aulas: [[79, "Lógica argumentativa"], [82, "Argumentos válidos e inválidos"]] },
        { chave: "equivalencia", nome: "Equivalências lógicas", aliases: ["Equivalências"], aulas: [[77, "Equivalências lógicas"]] },
        { chave: "implicacao", nome: "Implicação lógica", aliases: ["Implicação"], resumo: "Uma premissa implica uma conclusão quando é impossível que a premissa seja verdadeira e a conclusão falsa." },
        { chave: "diagramas", nome: "Diagramas lógicos", aulas: [[425, "Diagramas lógicos"]] },
      ] },
      { id: "contagem", nome: "Análise combinatória", topicos: [
        { chave: "contagem", nome: "Princípios da contagem", aliases: ["Princípios de contagem"], aulas: [[577, "Princípios da contagem - problemas aritméticos"]] },
        { chave: "multiplicativo", nome: "Princípio multiplicativo", resumo: "Multiplique as opções para cada etapa. Com 3 camisas e 4 calças, há 3 × 4 = 12 pares." },
        { chave: "permutacao", nome: "Permutação", aliases: ["Permutações", "Permutação simples"], resumo: "Ordene todos os elementos distintos. Cinco livros em fila podem ser ordenados de 5! = 120 maneiras." },
        { chave: "arranjo", nome: "Arranjo", aliases: ["Arranjos", "Arranjo simples"], resumo: "Selecione parte dos elementos com ordem. Entre cinco candidatos, há 5 × 4 = 20 escolhas para presidente e vice." },
        { chave: "combinacao", nome: "Combinação", aliases: ["Combinações", "Combinação simples", "Análise combinatória (combinação)"], aulas: [[580, "Análise combinatória (combinação)"], [581, "Exercícios de análise combinatória"]] },
      ] },
      { id: "probabilidade", nome: "Probabilidade", topicos: [
        { chave: "probabilidade", nome: "Probabilidade simples", aliases: ["Probabilidade", "Noções de probabilidade", "Cálculo de probabilidade"], aulas: [[426, "Probabilidade simples"]] },
        { chave: "uniao", nome: "Probabilidade da união", aliases: ["Probalidade da união"], aulas: [[651, "Probabilidade da união"]] },
        { chave: "condicional", nome: "Probabilidade condicional", aulas: [[652, "Probabilidade condicional"], [653, "Exercícios de probabilidade"]] },
      ] },
    ],
  },
  {
    id: "informatica", nome: "Informática", aliases: ["Noções de Informática"], moduloRdc: 5,
    modulos: [
      { id: "fundamentos", nome: "Internet, segurança e organização de arquivos", topicos: [
        { chave: "internet", nome: "Internet e intranet", aliases: ["Internet, intranet e extranet", "Internet, Intranet, Extranet e VPN"], aulas: [[39, "Internet, intranet, extranet e VPN"]] },
        { chave: "servicos", nome: "Navegadores, serviços de internet e computação em nuvem", aulas: [[64, "Programas de navegação e sincronização"], [50, "Computação em nuvem"]] },
        { chave: "seguranca", nome: "Proteção e segurança da informação", aliases: ["Segurança da informação"], aulas: [[40, "Conceitos e princípios de segurança"], [46, "Engenharia social, phishing e pharming"]] },
        { chave: "criptografia", nome: "Criptografia e autenticação", resumo: "Criptografia protege a informação por transformação dos dados. Autenticação verifica a identidade apresentada. Revise senhas e autenticação multifator." },
        { chave: "backup", nome: "Armazenamento, backup e restauração de dados", aulas: [[51, "Backup, tipos e características"]], resumo: "Compare backups completo, incremental e diferencial. Restauração é a recuperação dos dados a partir de uma cópia." },
        { chave: "perifericos", nome: "Organização de computadores, arquivos e periféricos", aliases: ["Conceitos de organização e gerenciamento de arquivos, pastas e programas, instalação de periféricos"], aulas: [[37, "Fundamentos da computação - I"], [38, "Fundamentos da computação - II"], [52, "Gerenciamento de arquivos e instalação de periféricos"]] },
      ] },
      { id: "sistemas", nome: "Windows 11 e suítes de escritório", topicos: [
        { chave: "win11", nome: "Windows 11 em português", fonte: ["Microsoft • Explorador de Arquivos", "https://support.microsoft.com/pt-br/windows/experience/fileexplorer/file-explorer-in-windows"], resumo: "Revise Explorador, Configurações e Painel de Controle. Pratique copiar, mover, renomear e exibir extensões de arquivos." },
        { chave: "cmd", nome: "Prompt de Comando", fonte: ["Microsoft Learn • Comandos do Windows", "https://learn.microsoft.com/pt-br/windows-server/administration/windows-commands/windows-commands"], resumo: "dir lista o diretório, cd muda de diretório, mkdir cria uma pasta, copy copia arquivos, move move arquivos e ren renomeia." },
        { chave: "word", nome: "Word 2019", aulas: [[56, "Word - Parte I"], [57, "Word - Parte II"], [58, "Word - Parte III"], [59, "Word - Parte IV"]] },
        { chave: "excel", nome: "Excel 2019", aulas: [[60, "Excel - Parte I"], [61, "Excel - Parte II"], [62, "Excel - Parte III"], [63, "Funções do Excel e PowerPoint"]] },
        { chave: "powerpoint", nome: "PowerPoint 2019", aulas: [[63, "Funções do Excel e PowerPoint"]], fonte: ["Microsoft • Apresentações no PowerPoint", "https://support.microsoft.com/pt-br/powerpoint/training/give-a-presentation-in-powerpoint"] },
        { chave: "writer", nome: "LibreOffice 7: Writer", fonte: libreOffice, resumo: "Crie e formate documentos ODT com estilos, tabelas e exportação em PDF." },
        { chave: "calc", nome: "LibreOffice 7: Calc", fonte: libreOffice, resumo: "Revise referências de células, fórmulas, funções, tabelas e gráficos. Em B2:B4, pratique =SOMA(B2:B4)." },
        { chave: "impress", nome: "LibreOffice 7: Impress", fonte: libreOffice, resumo: "Pratique layouts de slides, transições, modo de apresentação e exportação." },
      ] },
    ],
  },
  {
    id: "constitucional", nome: "Direito Constitucional", aliases: ["Constitucional"], moduloRdc: 7,
    modulos: [{ id: "constituicao", nome: "Constituição: direitos, Estado e Poderes", topicos: [
      { chave: "principios", nome: "Princípios fundamentais", aliases: ["Dos princípios fundamentais"], aulas: [[86, "Princípios fundamentais"]] },
      { chave: "garantias", nome: "Direitos e garantias fundamentais", aulas: [[586, "Direitos e garantias fundamentais"], [92, "Remédios constitucionais"], [93, "Direitos sociais"], [94, "Nacionalidade"], [95, "Direitos políticos"]] },
      { chave: "competencias", nome: "Repartição de competências entre União, Estados e Municípios", aulas: [[96, "Organização político-administrativa do Estado"]], fonte: constituicao, resumo: "Compare os arts. 21 a 24 e 30 da Constituição, distinguindo competências materiais, legislativas e municipais." },
      { chave: "administracao", nome: "Administração Pública e servidores públicos", fonte: constituicao, resumo: "Estude os princípios e regras do art. 37 e o regime constitucional dos servidores nos arts. 39 a 41." },
      { chave: "militares", nome: "Militares dos Estados, do Distrito Federal e dos Territórios", fonte: constituicao, resumo: "Revise o art. 42 e sua relação com o regime constitucional dos militares estaduais." },
      { chave: "legislativo", nome: "Poder Legislativo", aulas: [[99, "Poder Legislativo"]] },
      { chave: "executivo", nome: "Poder Executivo", aulas: [[97, "Poder Executivo"]] },
      { chave: "judiciario", nome: "Poder Judiciário", aulas: [[98, "Poder Judiciário"]] },
      { chave: "funcoes", nome: "Funções Essenciais à Justiça", fonte: constituicao, resumo: "Nos arts. 127 a 135, diferencie Ministério Público, Advocacia Pública, advocacia e Defensoria Pública." },
      { chave: "defesa", nome: "Defesa do Estado e das instituições democráticas", aulas: [[100, "Defesa do Estado e das instituições democráticas"]] },
      { chave: "jurisprudencia", nome: "Súmulas e jurisprudência de Direito Constitucional", resumo: "Pesquise as teses dos Tribunais Superiores por assunto do edital e anote o alcance e as exceções." },
    ] }],
  },
  {
    id: "direitos-humanos", nome: "Direitos Humanos", aliases: ["Noções de Direitos Humanos"], moduloRdc: 8,
    modulos: [{ id: "dh", nome: "Fundamentos e tratados de Direitos Humanos", topicos: [
      { chave: "teoria", nome: "Teoria geral dos Direitos Humanos", aulas: [[101, "Teoria geral dos Direitos Humanos"]] },
      { chave: "evolucao", nome: "Evolução histórica e gerações de Direitos Humanos", aliases: ["Gerações de direitos humanos"], aulas: [[421, "Evolução histórica e gerações de Direitos Humanos"]] },
      { chave: "tratados", nome: "Incorporação e hierarquia dos tratados de Direitos Humanos", aliases: ["Incorporação e hierarquia dos tratados internacionais de Direitos Humanos no Brasil"], aulas: [[422, "Incorporação dos tratados internacionais de Direitos Humanos"]] },
      { chave: "dudh", nome: "Declaração Universal dos Direitos Humanos (ONU, 1948)", aliases: ["Declaração Universal dos Direitos Humanos", "Declaração Universal dos Direitos Humanos (DUDH)"], aulas: [[102, "Declaração Universal dos Direitos Humanos"]] },
      { chave: "pacto", nome: "Convenção Americana sobre Direitos Humanos", aliases: ["Convenção Americana sobre Direitos Humanos - Pacto de San José da Costa Rica", "Pacto de San José da Costa Rica"], aulas: [[423, "Pacto de San José da Costa Rica"]] },
    ] }],
  },
  {
    id: "leis-extravagantes", nome: "Legislação Extravagante", aliases: ["Leis extravagantes", "Legislação especial"], moduloRdc: 9,
    modulos: [
      { id: "leis", nome: "Leis penais especiais e estatutos", topicos: [
        { chave: "abuso", nome: "Lei de Abuso de Autoridade", aliases: ["Abuso de autoridade", "Lei nº 13.869/2019 - Lei de Abuso de Autoridade", "Lei de Abuso de Autoridade (Lei n°13.869/19)"], aulas: [[103, "Lei de Abuso de Autoridade"]] },
        { chave: "tortura", nome: "Lei de Tortura", aliases: ["Lei nº 9.455/1997 - Lei de Tortura", "Lei de Tortura (Lei n° 9.455/97)"], aulas: [[104, "Lei de Tortura"]] },
        { chave: "maria-penha", nome: "Lei Maria da Penha", aliases: ["Maria da Penha", "Lei nº 11.340/2006 - Lei Maria da Penha", "Maria da Penha (Lei nº 11.340/06)"], aulas: [[105, "Lei Maria da Penha"]] },
        { chave: "racismo", nome: "Lei de Racismo", aliases: ["Crimes resultantes de preconceito de raça ou de cor", "Lei nº 7.716/1989 - Crimes resultantes de Preconceito de Raça ou de Cor"], aulas: [[108, "Crimes resultantes de preconceito de raça ou de cor"]] },
        { chave: "ambientais", nome: "Crimes ambientais", aliases: ["Lei nº 9.605/1998 - Crimes Ambientais", "Crimes ambientais (9.605)"], aulas: [[109, "Crimes ambientais"]] },
        { chave: "hediondos", nome: "Crimes hediondos", aliases: ["Lei nº 8.072/1990 - Crimes Hediondos", "Crimes Hediondos (Lei n° 8.072/90)"], aulas: [[107, "Crimes hediondos"]] },
        { chave: "drogas", nome: "Lei de Drogas (Lei 11.343/2006)", aliases: ["Lei de drogas", "Lei de Drogas (Lei nº 11.343/26)", "Lei nº 11.343/2006 - Lei de Drogas"], aulas: [[106, "Lei de Drogas"]] },
        { chave: "eca", nome: "ECA: ato infracional e atuação policial", aliases: ["Estatuto da Criança e do Adolescente: pontos pertinentes à atividade policial"], aulas: [[110, "Estatuto da Criança e do Adolescente"]], fonte: eca, resumo: "Estude garantias do adolescente, apreensão, apresentação, Conselho Tutelar e crimes e infrações administrativas pertinentes à atividade policial." },
        { chave: "idoso", nome: "Estatuto da Pessoa Idosa", aliases: ["Estatuto do idoso", "Lei nº 10.741/2003 - Estatuto da Pessoa Idosa: atuação policial e crimes em espécie"], aulas: [[437, "Estatuto da Pessoa Idosa"]] },
        { chave: "juventude", nome: "Estatuto da Juventude", aliases: ["Lei nº 12.852/2013 - Estatuto da Juventude"], aulas: [[642, "Estatuto da Juventude"]] },
        { chave: "jurisprudencia", nome: "Súmulas e jurisprudência de Direitos Humanos e Legislação", resumo: "Pesquise as teses dos Tribunais Superiores por tratado ou lei do edital. Compare o texto legal e a regra firmada." },
      ] },
    ],
  },
  {
    id: "estatuto-pmpe", nome: "Estatuto PMPE", aliases: ["Estatuto PMPE (Pós Edital)", "Estatuto dos Policiais Militares de Pernambuco"], moduloRdc: 19,
    modulos: [{ id: "estatuto", nome: "Estatuto dos Policiais Militares de Pernambuco", topicos: [
      { chave: "disposicoes", nome: "Disposições preliminares", aulas: [[129, "Disposições preliminares"]] },
      { chave: "hierarquia", nome: "Hierarquia e disciplina", aulas: [[130, "Hierarquia e disciplina"]] },
      { chave: "funcoes", nome: "Cargo e funções da PMPE", aulas: [[131, "Cargo e funções da PMPE"]] },
      { chave: "deveres", nome: "Obrigações e deveres", aulas: [[132, "Obrigações e deveres"]] },
      { chave: "crimes", nome: "Crimes militares", aulas: [[341, "Crimes militares"]] },
      { chave: "prerrogativas", nome: "Direitos e prerrogativas", aulas: [[342, "Direitos e prerrogativas"]] },
      { chave: "afastamentos", nome: "Férias, licenças e afastamentos", aulas: [[343, "Férias, licenças e afastamentos"]] },
      { chave: "protecao", nome: "Sistema de proteção social", aulas: [[344, "Sistema de proteção social"]] },
    ] }],
  },
  {
    id: "redacao", nome: "Redação", aliases: ["Produção textual"], moduloRdc: 16,
    modulos: [{ id: "texto", nome: "Redação dissertativo-argumentativa", topicos: [
      { chave: "estrutura", nome: "Texto dissertativo-argumentativo", aliases: ["O texto dissertativo argumentativo"], aulas: [[116, "O texto dissertativo argumentativo"]] },
      { chave: "tese", nome: "Tema, tese e planejamento", aulas: [[117, "A abordagem temática"], [118, "A tese"], [659, "Planejamento textual"]] },
      { chave: "argumentacao", nome: "Argumentação e desenvolvimento", aulas: [[120, "Estrutura técnica de argumentação"], [122, "Desenvolvimento e fundamentação"], [123, "Aprofundamento de argumentos"]] },
      { chave: "conclusao", nome: "Conclusão e revisão da redação", aulas: [[128, "A conclusão"], [660, "Gramática e redação"], [661, "Checklist da redação"]] },
    ] }],
  },
];
