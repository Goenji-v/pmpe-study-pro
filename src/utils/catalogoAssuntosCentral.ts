/**
 * Catálogo central de IDENTIDADES pedagógicas — piloto da prévia.
 *
 * FAMÍLIA (assunto principal) != SUBASSUNTO != NOME ALTERNATIVO.
 * Compartilhar família permite sugerir revisão integrada; não autoriza
 * fundir aulas, apagar registros, afirmar conclusão ou reutilizar o mesmo ID.
 * Os IDs desta tabela são constantes da aplicação, NÃO IDs de registros do aluno.
 */
export type SubassuntoCatalogo = {
  id: string;
  nome: string;
  nomesAlternativos: readonly string[];
  tipo?: "conteudo" | "material";
};
export type FamiliaCatalogo = {
  id: string;
  nome: string;
  disciplinaId: string;
  nomesAlternativos: readonly string[];
  subassuntos: readonly SubassuntoCatalogo[];
};
export type DisciplinaCatalogo = {
  id: string;
  nome: string;
  nomesAlternativos: readonly string[];
};

export const DISCIPLINAS_CATALOGO: readonly DisciplinaCatalogo[] = [
  { id:"portugues",nome:"Língua Portuguesa",nomesAlternativos:["Português","Gramática"] },
  { id:"rlm",nome:"Raciocínio Lógico e Matemática",nomesAlternativos:["RLM","Raciocínio lógico","Matemática"] },
  { id:"informatica",nome:"Informática",nomesAlternativos:["Noções de informática","Tecnologia da informação"] },
  { id:"constitucional",nome:"Direito Constitucional",nomesAlternativos:["Constitucional"] },
  { id:"humanos",nome:"Direitos Humanos",nomesAlternativos:["Noções de direitos humanos"] },
  { id:"legislacao",nome:"Legislação Extravagante",nomesAlternativos:["Legislação","Legislação especial","Leis especiais"] },
  { id:"estatuto-pmpe",nome:"Estatuto PMPE",nomesAlternativos:["Estatuto dos Militares de Pernambuco","Estatuto dos Policiais Militares de Pernambuco"] },
  { id:"historia-pe",nome:"História de Pernambuco",nomesAlternativos:["História PE","História"] },
  { id:"redacao",nome:"Redação",nomesAlternativos:["Produção textual","Redação dissertativa"] },
] as const;

export const FAMILIAS_CATALOGO: readonly FamiliaCatalogo[] = [
  {
    id:"rlm.logica-proposicional",nome:"Lógica proposicional",disciplinaId:"rlm",
    nomesAlternativos:["Lógica das proposições","Lógica sentencial"],
    subassuntos:[
      {id:"rlm.prop",nome:"Proposições lógicas",nomesAlternativos:["Proposições","Proposições simples e compostas"]},
      {id:"rlm.conectivos",nome:"Conectivos lógicos",nomesAlternativos:["Conectivos","Operadores lógicos","Conjunção, disjunção, condicional e bicondicional"]},
      {id:"rlm.tabela",nome:"Tabelas-verdade",nomesAlternativos:["Tabela verdade","Tabela lógica","Tabelas verdade"]},
      {id:"rlm.negacao",nome:"Negação de proposições",nomesAlternativos:["Negação","Negação lógica","Negação de conectivos"]},
      {id:"rlm.equivalencia",nome:"Equivalências lógicas",nomesAlternativos:["Equivalência lógica","Equivalência e implicação lógica","Proposições equivalentes"]},
      {id:"rlm.tautologia",nome:"Tautologias, contradições e contingências",nomesAlternativos:["Tautologia","Contradição e contingência"]},
    ],
  },
  {id:"rlm.argumentativa",nome:"Lógica argumentativa",disciplinaId:"rlm",
   nomesAlternativos:["Argumentação lógica"],subassuntos:[
     {id:"rlm.argumentos",nome:"Argumentos, inferências e conclusões",nomesAlternativos:["Lógica argumentativa","Exercícios - Lógica argumentativa","Exercícios de lógica argumentativa","Inferências e conclusões"]},
   ]},
  {id:"rlm.combinatoria",nome:"Análise combinatória",disciplinaId:"rlm",
   nomesAlternativos:["Combinatória"],subassuntos:[{id:"rlm.combinacao",nome:"Combinação simples",nomesAlternativos:["Combinações simples"]}]},
  {id:"portugues.fonologia",nome:"Fonologia e sílaba",disciplinaId:"portugues",
   nomesAlternativos:["Fonologia"],subassuntos:[
     {id:"pt.fonemas",nome:"Fonemas, letras e sons",nomesAlternativos:["Fonemas, letras e sons da fala","Fonema e letra","Fonemas"]},
     {id:"pt.digrafos",nome:"Dígrafos",nomesAlternativos:["Dígrafo"]},
     {id:"pt.encontro-consonantal",nome:"Encontros consonantais",nomesAlternativos:["Encontro consonantal"]},
     {id:"pt.encontro-vocalico",nome:"Encontros vocálicos",nomesAlternativos:["Encontro vocálico","Ditongo, tritongo e hiato"]},
     {id:"pt.silaba",nome:"Sílaba e divisão silábica",nomesAlternativos:["Sílaba","Monossílabos","Separação silábica","Classificação silábica"]},
   ]},
  {id:"portugues.oracoes",nome:"Orações subordinadas",disciplinaId:"portugues",
   nomesAlternativos:["Orações subordinadas (visão geral)"],subassuntos:[
    {id:"pt.oracoes-geral",nome:"Orações subordinadas (geral)",nomesAlternativos:["Orações subordinadas"]},
    {id:"pt.oracoes-adverbiais",nome:"Orações subordinadas adverbiais",nomesAlternativos:["Subordinadas adverbiais"]},
   ]},
  {id:"portugues.acentuacao",nome:"Acentuação gráfica",disciplinaId:"portugues",nomesAlternativos:[],
   subassuntos:[{id:"pt.acentuacao",nome:"Acentuação gráfica",nomesAlternativos:["Regras de acentuação"]}]},
  {id:"portugues.crase",nome:"Crase",disciplinaId:"portugues",nomesAlternativos:[],
   subassuntos:[{id:"pt.crase",nome:"Crase",nomesAlternativos:["Uso do sinal grave indicativo de Crase","Uso do acento grave"]}]},
  {id:"portugues.pontuacao",nome:"Pontuação",disciplinaId:"portugues",nomesAlternativos:[],
   subassuntos:[{id:"pt.pontuacao",nome:"Pontuação",nomesAlternativos:["Uso da vírgula"]}]},
  {id:"informatica.seguranca",nome:"Segurança da Informação",disciplinaId:"informatica",
   nomesAlternativos:["Conceitos de proteção e segurança"],subassuntos:[
    {id:"inf.seg-aulas-1-4",nome:"Conceitos de proteção e segurança — aulas 1 a 4",nomesAlternativos:["Conceitos de proteção e segurança - aulas 1 a 4"]},
    {id:"inf.seg-aulas-5-9",nome:"Conceitos de proteção e segurança — aulas 5 a 9",nomesAlternativos:["Conceitos de proteção e segurança - aulas 5 a 9"]},
    {id:"inf.seg-pdf",nome:"Material de segurança da informação (PDF)",nomesAlternativos:["Segurança da informação (PDF)"],tipo:"material"},
   ]},
  {id:"informatica.windows",nome:"Windows",disciplinaId:"informatica",
   nomesAlternativos:["Sistema operacional Windows"],subassuntos:[
    {id:"inf.windows-1",nome:"Windows — parte I",nomesAlternativos:["Windows - Parte I: Conceito e componentes do sistema","Windows Parte I"]},
    {id:"inf.windows-2",nome:"Windows — parte II",nomesAlternativos:["Windows - Parte II: Sistema de arquivos, multiboot e versões","Windows Parte II"]},
    {id:"inf.windows-3",nome:"Windows — parte III",nomesAlternativos:["Windows - Parte III: Nomes, símbolos proibidos, painel de controle e novidades do Windows 10","Windows Parte III"]},
   ]},
  {id:"informatica.excel",nome:"Microsoft Excel",disciplinaId:"informatica",nomesAlternativos:["Excel"],
   subassuntos:[{id:"inf.excel",nome:"Microsoft Excel",nomesAlternativos:["Excel"]}]},
  {id:"informatica.word",nome:"Microsoft Word",disciplinaId:"informatica",nomesAlternativos:["Word"],
   subassuntos:[{id:"inf.word",nome:"Microsoft Word",nomesAlternativos:["Word"]}]},
  {id:"constitucional.direitos",nome:"Direitos e garantias fundamentais",disciplinaId:"constitucional",
   nomesAlternativos:["Direitos e deveres individuais e coletivos"],subassuntos:[
     {id:"dc.vida",nome:"Direito à vida",nomesAlternativos:["Direito a vida"]},
     {id:"dc.liberdade",nome:"Direito à liberdade",nomesAlternativos:["Direito a liberdade"]},
     {id:"dc.sociais",nome:"Direitos sociais",nomesAlternativos:["Direitos sociais - artigo 6º"]},
     {id:"dc.remedios",nome:"Remédios constitucionais",nomesAlternativos:["Remédios Constitucionais"]},
   ]},
  {id:"constitucional.nacionalidade",nome:"Nacionalidade",disciplinaId:"constitucional",nomesAlternativos:[],
   subassuntos:[{id:"dc.nacionalidade",nome:"Direito de nacionalidade",nomesAlternativos:["Direito a nacionalidade","Nacionalidade"]}]},
  {id:"constitucional.politicos",nome:"Direitos políticos",disciplinaId:"constitucional",nomesAlternativos:[],
   subassuntos:[{id:"dc.politicos",nome:"Direitos políticos e partidos políticos",nomesAlternativos:["Direitos Políticos e partidos políticos"]}]},
  {id:"humanos.teoria",nome:"Teoria geral dos Direitos Humanos",disciplinaId:"humanos",nomesAlternativos:[],
   subassuntos:[{id:"dh.teoria",nome:"Teoria geral dos Direitos Humanos",nomesAlternativos:["Teoria geral dos Direitos Humanos: conceito, terminologia, estrutura normativa, fundamento, classificação e especificidades"]}]},
  {id:"humanos.historia",nome:"Evolução histórica dos Direitos Humanos",disciplinaId:"humanos",nomesAlternativos:[],
   subassuntos:[{id:"dh.evolucao",nome:"Evolução histórica e gerações de direitos humanos",nomesAlternativos:["Gerações de direitos humanos"]}]},
  {id:"humanos.dudh",nome:"Declaração Universal dos Direitos Humanos",disciplinaId:"humanos",nomesAlternativos:["DUDH"],
   subassuntos:[{id:"dh.dudh",nome:"Declaração Universal dos Direitos Humanos (DUDH)",nomesAlternativos:["Declaração Universal dos Direitos Humanos"]}]},
  {id:"legislacao.drogas",nome:"Lei de Drogas",disciplinaId:"legislacao",nomesAlternativos:["Lei 11.343/2006"],
   subassuntos:[{id:"leg.drogas",nome:"Lei de Drogas",nomesAlternativos:["Lei de Drogas (Lei 11.343/26)","Lei de Drogas (Lei 11.343/2006)"]}]},
  {id:"legislacao.tortura",nome:"Lei de Tortura",disciplinaId:"legislacao",nomesAlternativos:["Lei 9.455/1997"],
   subassuntos:[{id:"leg.tortura",nome:"Lei de Tortura",nomesAlternativos:["Lei de Tortura (Lei 9.455/97)"]}]},
  {id:"legislacao.abuso",nome:"Lei de Abuso de Autoridade",disciplinaId:"legislacao",nomesAlternativos:["Lei 13.869/2019"],
   subassuntos:[{id:"leg.abuso",nome:"Lei de Abuso de Autoridade",nomesAlternativos:["Lei de Abuso de Autoridade (Lei 13.869/19)"]}]},
  {id:"legislacao.maria",nome:"Lei Maria da Penha",disciplinaId:"legislacao",nomesAlternativos:["Lei 11.340/2006"],
   subassuntos:[{id:"leg.maria",nome:"Lei Maria da Penha",nomesAlternativos:[]}]},
  {id:"estatuto-pmpe.legislacao",nome:"Estatuto dos Policiais Militares de Pernambuco",disciplinaId:"estatuto-pmpe",
   nomesAlternativos:["Estatuto dos Militares do Estado de Pernambuco","Estatuto dos Policiais Militares do Estado de Pernambuco (Lei 6.783/74)"],
   subassuntos:[
    {id:"est.preliminares",nome:"Disposições preliminares",nomesAlternativos:["Em Produção - Disposições preliminares"]},
    {id:"est.hierarquia",nome:"Hierarquia e disciplina",nomesAlternativos:["Em Produção - Hierarquia e disciplina"]},
    {id:"est.funcoes",nome:"Cargo e funções da PMPE",nomesAlternativos:["Em Produção - Cargo e funções da PMPE"]},
   ]},
  {id:"historia-pe.mascates",nome:"Guerra dos Mascates",disciplinaId:"historia-pe",nomesAlternativos:[],
   subassuntos:[{id:"hist.mascates",nome:"Guerra dos Mascates",nomesAlternativos:[]}]},
  {id:"historia-pe.equador",nome:"Confederação do Equador",disciplinaId:"historia-pe",nomesAlternativos:[],
   subassuntos:[{id:"hist.equador",nome:"Confederação do Equador",nomesAlternativos:[]}]},
  {id:"historia-pe.acucar",nome:"Economia Açucareira",disciplinaId:"historia-pe",nomesAlternativos:[],
   subassuntos:[{id:"hist.acucar",nome:"Economia Açucareira",nomesAlternativos:[]}]},
  {id:"historia-pe.holandeses",nome:"Presença Holandesa e Insurreição Pernambucana",disciplinaId:"historia-pe",nomesAlternativos:[],
   subassuntos:[
    {id:"hist.presenca",nome:"Presença Holandesa e governo de Nassau",nomesAlternativos:["Presença Holandesa","Governo de Maurício de Nassau"]},
    {id:"hist.insurreicao",nome:"Insurreição Pernambucana",nomesAlternativos:[]},
   ]},
  {id:"redacao.dissertacao",nome:"Texto dissertativo-argumentativo",disciplinaId:"redacao",nomesAlternativos:[],
   subassuntos:[{id:"redacao.texto",nome:"O texto dissertativo argumentativo",nomesAlternativos:[]},
    {id:"redacao.tese",nome:"A tese",nomesAlternativos:[]},
    {id:"redacao.tema",nome:"A abordagem temática",nomesAlternativos:[]}]},
] as const;

export function normalizarNomeCatalogo(valor: string): string {
  return String(valor || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function identificarDisciplinaCatalogo(nome: string): DisciplinaCatalogo | null {
  const normal = normalizarNomeCatalogo(nome);
  return DISCIPLINAS_CATALOGO.find((item) =>
    [item.nome, ...item.nomesAlternativos].some((alias) => normalizarNomeCatalogo(alias) === normal)
  ) ?? null;
}
export type IdentificacaoCatalogo = {
  tipo: "subassunto" | "familia" | "composto" | "nao_identificado";
  disciplinaId: string | null;
  familiaId: string | null;
  idsSubassuntos: string[];
  nomeFamilia: string | null;
  confianca: "alta" | "revisar" | "nenhuma";
};
/**
 * Apenas igualdade normalizada, aliases CURADOS e títulos compostos conhecidos.
 * Nunca inferir que "tabela verdade" == "equivalência lógica".
 * Não equiparar conteúdos de disciplinas diferentes.
 */
export function identificarConteudoCatalogo(disciplina: string, nome: string): IdentificacaoCatalogo {
  const alvo = normalizarNomeCatalogo(nome);
  const disciplinaCanonica = identificarDisciplinaCatalogo(disciplina);
  const disciplinaId = disciplinaCanonica?.id ?? null;
  const vazio: IdentificacaoCatalogo = {
    tipo:"nao_identificado",disciplinaId,familiaId:null,idsSubassuntos:[],nomeFamilia:null,confianca:"nenhuma"
  };
  if (!alvo || !disciplinaId) return vazio;
  for (const familia of FAMILIAS_CATALOGO.filter((f) => f.disciplinaId === disciplinaId)) {
    for (const sub of familia.subassuntos) {
      if ([sub.nome,...sub.nomesAlternativos].some((x)=>normalizarNomeCatalogo(x)===alvo)) {
        return {tipo:"subassunto",disciplinaId,familiaId:familia.id,idsSubassuntos:[sub.id],nomeFamilia:familia.nome,confianca:"alta"};
      }
    }
    // Um nome principal representa uma família, não uma aula equivalente a todas.
    if ([familia.nome,...familia.nomesAlternativos].some((x)=>normalizarNomeCatalogo(x)===alvo)) {
      return {tipo:"familia",disciplinaId,familiaId:familia.id,idsSubassuntos:[],nomeFamilia:familia.nome,confianca:"revisar"};
    }
  }
  // Uma aula de História que inclui Nassau E Insurreição não equivale
  // somente à Presença Holandesa. Preservar as duas unidades distintas.
  if (disciplinaId==="historia-pe" &&
      /presenca holandesa/.test(alvo) && /insurreicao pernambucana/.test(alvo)) {
    return {tipo:"composto",disciplinaId,familiaId:"historia-pe.holandeses",
      idsSubassuntos:["hist.presenca","hist.insurreicao"],
      nomeFamilia:"Presença Holandesa e Insurreição Pernambucana",confianca:"revisar"};
  }
  // Títulos compostos reais identificados na conta. Exigem confirmação manual.
  if (disciplinaId==="rlm" && /conectiv/.test(alvo) && /tabelas? (da )?verdade/.test(alvo) && /negac/.test(alvo)) {
    return {tipo:"composto",disciplinaId,familiaId:"rlm.logica-proposicional",
      idsSubassuntos:["rlm.conectivos","rlm.tabela","rlm.negacao"],nomeFamilia:"Lógica proposicional",confianca:"revisar"};
  }
  if (disciplinaId==="portugues" && /digraf/.test(alvo) && /encontro consonantal/.test(alvo)) {
    return {tipo:"composto",disciplinaId,familiaId:"portugues.fonologia",
      idsSubassuntos:["pt.digrafos","pt.encontro-consonantal"],nomeFamilia:"Fonologia e sílaba",confianca:"revisar"};
  }
  return vazio;
}
