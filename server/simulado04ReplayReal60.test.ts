import assert from "node:assert/strict";
import test from "node:test";
import { analisarSimuladoStudyPro } from "../src/utils/analiseSimuladoStudyPro.ts";
import { validarGabaritoExplicitoDoCaderno } from "./gabaritoExplicitoPdf.ts";
import {
  assuntoHistoricoDaAlternativaConfirmada,
  validarSecoesDisciplinasDoPdf,
  materiaDoNumero,
} from "./estruturaDisciplinasSimuladoPdf.ts";

/**
 * Snapshot técnico reduzido da análise real do Simulado 04, salva no
 * banco do Study Pro em 09/10/2026 ANTES da correção das matérias.
 * Somente número/matéria/assunto/subassunto/gabarito, sem IDs de usuário,
 * respostas pessoais, PDF ou tokens. Este teste não chama o Gemini e não
 * mede a acurácia de uma execução nova.
 */
const anterior = [
  {
    "n": 1,
    "materia": "Português",
    "assunto": "Ortografia e Fonética",
    "subassunto": "Acentuação, Dígrafos e Fonemas",
    "g": "B"
  },
  {
    "n": 2,
    "materia": "Português",
    "assunto": "Orações Subordinadas Adverbiais",
    "subassunto": "Orações Adverbiais Proporcionais",
    "g": "D"
  },
  {
    "n": 3,
    "materia": "Português",
    "assunto": "Sinônimos e Antônimos",
    "subassunto": "Sentido das palavras",
    "g": "C"
  },
  {
    "n": 4,
    "materia": "Português",
    "assunto": "Crase",
    "subassunto": "Crase obrigatória",
    "g": "A"
  },
  {
    "n": 5,
    "materia": "Português",
    "assunto": "Concordância Verbal",
    "subassunto": "Concordância com sujeito simples e numerais",
    "g": "C"
  },
  {
    "n": 6,
    "materia": "Português",
    "assunto": "Compreensão e interpretação de textos",
    "subassunto": "Inferência e análise de informações",
    "g": "D"
  },
  {
    "n": 7,
    "materia": "Português",
    "assunto": "Compreensão e Interpretação de Textos",
    "subassunto": "Identificação da finalidade do texto",
    "g": "E"
  },
  {
    "n": 8,
    "materia": "Português",
    "assunto": "Compreensão e Interpretação de Textos",
    "subassunto": "Ideia central e posicionamento do autor",
    "g": "E"
  },
  {
    "n": 9,
    "materia": "Português",
    "assunto": "Orações reduzidas e conectivos",
    "subassunto": "Orações reduzidas de gerúndio e conjunções aditivas",
    "g": "B"
  },
  {
    "n": 10,
    "materia": "Português",
    "assunto": "Significação das palavras",
    "subassunto": "Sentido denotativo e conotativo",
    "g": "C"
  },
  {
    "n": 11,
    "materia": "História",
    "assunto": "Brasil Colônia",
    "subassunto": "Ciclo do Açúcar",
    "g": "A"
  },
  {
    "n": 12,
    "materia": "História",
    "assunto": "Brasil Colônia",
    "subassunto": "Ciclo do Açúcar",
    "g": "D"
  },
  {
    "n": 13,
    "materia": "História",
    "assunto": "Brasil Colônia",
    "subassunto": "Administração Colonial",
    "g": "C"
  },
  {
    "n": 14,
    "materia": "História",
    "assunto": "Brasil Colônia",
    "subassunto": "Resistência à escravidão e Quilombo dos Palmares",
    "g": "E"
  },
  {
    "n": 15,
    "materia": "História e Literatura",
    "assunto": "Intelectuais Pernambucanos",
    "subassunto": "Gilberto Freyre e Ariano Suassuna",
    "g": "E"
  },
  {
    "n": 16,
    "materia": "História",
    "assunto": "Brasil Colônia",
    "subassunto": "Revoltas Nativistas",
    "g": "A"
  },
  {
    "n": 17,
    "materia": "História",
    "assunto": "Brasil Colônia / Reino Unido",
    "subassunto": "Revolução Pernambucana de 1817",
    "g": "D"
  },
  {
    "n": 18,
    "materia": "História",
    "assunto": "Brasil Império",
    "subassunto": "Primeiro Reinado",
    "g": "A"
  },
  {
    "n": 19,
    "materia": "História",
    "assunto": "Brasil Império",
    "subassunto": "Primeiro Reinado",
    "g": "B"
  },
  {
    "n": 20,
    "materia": "Conhecimentos Gerais",
    "assunto": "Patrimônio Cultural",
    "subassunto": "Patrimônio Vivo de Pernambuco",
    "g": "B"
  },
  {
    "n": 21,
    "materia": "Raciocínio Lógico",
    "assunto": "Conectivos Lógicos",
    "subassunto": "Simbologia e Operadores",
    "g": "D"
  },
  {
    "n": 22,
    "materia": "Raciocínio Lógico",
    "assunto": "Lógica de Argumentação",
    "subassunto": "Implicação Lógica",
    "g": "C"
  },
  {
    "n": 23,
    "materia": "Raciocínio Lógico",
    "assunto": "Lógica de Proposições Categóricas",
    "subassunto": "Diagramas Lógicos",
    "g": "D"
  },
  {
    "n": 24,
    "materia": "Raciocínio Lógico",
    "assunto": "Lógica de Proposições",
    "subassunto": "Equivalência Lógica e Quantificadores",
    "g": "C"
  },
  {
    "n": 25,
    "materia": "Raciocínio Lógico",
    "assunto": "Equivalências e Negações Lógicas",
    "subassunto": "Negação de proposições compostas",
    "g": "A"
  },
  {
    "n": 26,
    "materia": "Matemática",
    "assunto": "Princípio Fundamental da Contagem",
    "subassunto": "Princípio Aditivo",
    "g": "A"
  },
  {
    "n": 27,
    "materia": "Raciocínio Lógico",
    "assunto": "Equivalências Lógicas",
    "subassunto": "Equivalência da condicional (P -> Q <=> ~Q -> ~P ou ~P v Q)",
    "g": "A"
  },
  {
    "n": 28,
    "materia": "Matemática",
    "assunto": "Combinação Simples",
    "subassunto": "Princípio Fundamental da Contagem",
    "g": "E"
  },
  {
    "n": 29,
    "materia": "Matemática",
    "assunto": "Combinação Simples",
    "subassunto": "Combinação de n elementos tomados p a p",
    "g": "A"
  },
  {
    "n": 30,
    "materia": "Raciocínio Lógico",
    "assunto": "Equivalências Lógicas",
    "subassunto": "Equivalência da Bicondicional",
    "g": "D"
  },
  {
    "n": 31,
    "materia": "Informática",
    "assunto": "Conceitos de Internet e Intranet",
    "subassunto": "Definições e características",
    "g": "E"
  },
  {
    "n": 32,
    "materia": "Informática",
    "assunto": "Memórias",
    "subassunto": "Memórias Voláteis e Não Voláteis",
    "g": "B"
  },
  {
    "n": 33,
    "materia": "Informática",
    "assunto": "Ameaças Virtuais",
    "subassunto": "Phishing",
    "g": "E"
  },
  {
    "n": 34,
    "materia": "Informática",
    "assunto": "Windows 7",
    "subassunto": "Gerenciamento de arquivos e pastas",
    "g": "A"
  },
  {
    "n": 35,
    "materia": "Informática",
    "assunto": "Microsoft PowerPoint",
    "subassunto": "Macros",
    "g": "B"
  },
  {
    "n": 36,
    "materia": "Informática",
    "assunto": "Microsoft Word",
    "subassunto": "Atalhos de teclado",
    "g": "A"
  },
  {
    "n": 37,
    "materia": "Informática",
    "assunto": "MS-Excel",
    "subassunto": "Formatação Condicional",
    "g": "D"
  },
  {
    "n": 38,
    "materia": "Informática",
    "assunto": "LibreOffice",
    "subassunto": "LibreOffice Calc",
    "g": "A"
  },
  {
    "n": 39,
    "materia": "Informática",
    "assunto": "Ameaças e Fraudes",
    "subassunto": "Phishing",
    "g": "E"
  },
  {
    "n": 40,
    "materia": "Informática",
    "assunto": "Microsoft Windows 10",
    "subassunto": "Gerenciamento de arquivos e pastas",
    "g": "C"
  },
  {
    "n": 41,
    "materia": "Direito Constitucional",
    "assunto": "Fundamentos da República",
    "subassunto": "Dignidade da pessoa humana",
    "g": "A"
  },
  {
    "n": 42,
    "materia": "Direito Constitucional",
    "assunto": "Direitos e deveres individuais e coletivos",
    "subassunto": "Artigo 5º da CF/88",
    "g": "E"
  },
  {
    "n": 43,
    "materia": "Direito Constitucional",
    "assunto": "Nacionalidade",
    "subassunto": "Cargos privativos de brasileiro nato",
    "g": "B"
  },
  {
    "n": 44,
    "materia": "Direito Constitucional",
    "assunto": "Direitos Políticos",
    "subassunto": "Alistabilidade e Elegibilidade",
    "g": "A"
  },
  {
    "n": 45,
    "materia": "Direito Constitucional",
    "assunto": "Direitos Sociais",
    "subassunto": "Proteção ao trabalho do menor",
    "g": "D"
  },
  {
    "n": 46,
    "materia": "Direito Constitucional",
    "assunto": "Repartição de Competências",
    "subassunto": "Competência Legislativa Concorrente",
    "g": "B"
  },
  {
    "n": 47,
    "materia": "Direito Administrativo",
    "assunto": "Servidores Públicos",
    "subassunto": "Regras Constitucionais",
    "g": "C"
  },
  {
    "n": 48,
    "materia": "Direito Administrativo",
    "assunto": "Servidores Públicos",
    "subassunto": "Estabilidade",
    "g": "E"
  },
  {
    "n": 49,
    "materia": "Direito Constitucional",
    "assunto": "Poder Executivo",
    "subassunto": "Presidente da República",
    "g": "A"
  },
  {
    "n": 50,
    "materia": "Direito Administrativo",
    "assunto": "Regime Jurídico dos Servidores Públicos",
    "subassunto": "Mandato Eletivo, Disponibilidade e Segurança Pública",
    "g": "C"
  },
  {
    "n": 51,
    "materia": "Direito Constitucional",
    "assunto": "Teoria Geral dos Direitos Fundamentais",
    "subassunto": "Diferença entre Direitos Humanos e Direitos Fundamentais",
    "g": "C"
  },
  {
    "n": 52,
    "materia": "Direito Constitucional",
    "assunto": "Direitos Humanos",
    "subassunto": "Dimensões dos Direitos Fundamentais",
    "g": "C"
  },
  {
    "n": 53,
    "materia": "Direito Constitucional",
    "assunto": "Tratados Internacionais de Direitos Humanos",
    "subassunto": "Hierarquia dos Tratados Internacionais",
    "g": "D"
  },
  {
    "n": 54,
    "materia": "Direitos Humanos",
    "assunto": "Direitos Fundamentais",
    "subassunto": "Proibição da escravidão",
    "g": "D"
  },
  {
    "n": 55,
    "materia": "Direito Penal",
    "assunto": "Crimes Hediondos",
    "subassunto": "Lei 8.072/1990",
    "g": "C"
  },
  {
    "n": 56,
    "materia": "Direito Penal",
    "assunto": "Lei de Drogas (Lei nº 11.343/06)",
    "subassunto": "Tráfico de drogas e procedimento",
    "g": "B"
  },
  {
    "n": 57,
    "materia": "Direito Penal",
    "assunto": "Crimes de Tortura",
    "subassunto": "Lei 9.455/1997",
    "g": "A"
  },
  {
    "n": 58,
    "materia": "Direito Penal",
    "assunto": "Crimes resultantes de preconceito de raça ou de cor",
    "subassunto": "Crime de apologia ao nazismo",
    "g": "D"
  },
  {
    "n": 59,
    "materia": "Direito Administrativo",
    "assunto": "Situações Especiais",
    "subassunto": "Reversão e Ausência",
    "g": "A"
  },
  {
    "n": 60,
    "materia": "Direito Administrativo",
    "assunto": "Obrigações Policiais Militares",
    "subassunto": "Ética e Deveres",
    "g": "E"
  }
] as const;

// Transcrição independente da página GABARITO 04 do próprio caderno.
const gabaritoOficial = [
  "B D C A B D E B B C",
  "A D C E E A D A B B",
  "D C D C A A A E A D",
  "E B E A B C D A E B",
  "A E B A D B E E A E",
  "C C D D B B D D C E",
].flatMap((linha) => linha.split(" "));
const materiasImpressas = [
  "Língua Portuguesa",
  "História de Pernambuco",
  "Raciocínio Lógico",
  "Informática",
  "Direito Constitucional",
  "Direitos Humanos e Legislação Extravagante",
] as const;
const secoes = validarSecoesDisciplinasDoPdf(
  { secoes: materiasImpressas.map((materia, i) => ({
    inicio: 1 + i * 10,
    fim: (i + 1) * 10,
    materia,
    cabecalho: materia,
  })) },
  60
);
const gabaritoConfirmado = validarGabaritoExplicitoDoCaderno({
  secaoGabaritoEncontrada: true,
  cabecalho: "GABARITO 04",
  itens: gabaritoOficial.map((resposta, indice) => ({
    numero: indice + 1, resposta, anulada: false,
  })),
}, 60);

test("QA real anterior: 60 questões, 9 divergências no gabarito e 11 rótulos de matéria", () => {
  assert.equal(anterior.length, 60);
  assert.deepEqual(anterior.map((item) => item.n),
    Array.from({ length: 60 }, (_, i) => i + 1));
  assert.equal(gabaritoOficial.length, 60);
  assert.equal(gabaritoConfirmado.length, 60);
  assert.equal(anterior.filter((item) => item.g !== gabaritoOficial[item.n - 1]).length, 9);
  assert.equal(new Set(anterior.map((item) => item.materia)).size, 11);
  // No relatório antigo "Português" era a forma abreviada aceita
  // para Língua Portuguesa. Na prova o cabeçalho completo é mantido.
  assert.equal(anterior.filter((item) =>
    item.materia === (item.n <= 10
      ? "Português"
      : materiasImpressas[Math.floor((item.n - 1) / 10)])
  ).length, 34);
  assert.equal(anterior.filter((item) =>
    item.n >= 11 && item.n <= 20 && item.materia === "História de Pernambuco"
  ).length, 0);
  assert.equal(anterior.filter((item) =>
    item.n >= 51 && item.n <= 60 &&
    item.materia === "Direitos Humanos e Legislação Extravagante"
  ).length, 0);
});

test("dry-run: corrigir somente a associação documental gera seis disciplinas de dez", () => {
  assert.equal(secoes.length, 6);
  for (const item of anterior) {
    assert.equal(
      materiaDoNumero(secoes, item.n),
      materiasImpressas[Math.floor((item.n - 1) / 10)]
    );
  }

  // Reprodução sem efeitos colaterais: ajusta os metadados produzidos
  // pela execução antiga com os documentos de referência, e testa
  // o mesmo analisador usado no diagnóstico. Não equivale a reexecutar IA.
  const questoes = anterior.map((item) => {
    const materia = materiaDoNumero(secoes, item.n)!;
    const gabarito = gabaritoConfirmado[item.n - 1].resposta;
    let assunto = item.assunto;
    if (item.n === 18 || item.n === 19) {
      const encontrado = assuntoHistoricoDaAlternativaConfirmada({
        materia,
        enunciado: item.n === 18
          ? "Considerando estas informações, elas se referem à"
          : "O texto acima refere-se a:",
        alternativas: [
          { id: "A", texto: item.n === 18 ? "Confederação do Equador." : "Revolução Liberal" },
          { id: "B", texto: item.n === 19 ? "Confederação do Equador." : "Insurreição Pernambucana." },
        ],
        gabarito,
        gabaritoConfirmado: true,
      });
      assert.equal(encontrado, "Confederação do Equador");
      assunto = encontrado!;
    }
    return {
      id: `qa-${item.n}`,
      numero: item.n,
      materia,
      assunto,
      subassunto: item.n === 18 || item.n === 19 ? undefined : item.subassunto,
      dificuldade: "Média" as const,
      enunciado: `Questão ${item.n} — teste com metadados`,
      alternativas: "ABCDE".split("").map(id => ({ id, texto: `Letra ${id}` })),
      gabarito,
    };
  });
  const respostas = Object.fromEntries(questoes.map((item) => [item.id,item.gabarito]));
  const diagnostico = analisarSimuladoStudyPro({
    tentativaId: "teste-replay-qa-60",
    nome: "QA offline, não contabilizar",
    data: "2026-10-09",
    questoes,
    respostas,
  });
  assert.equal(diagnostico.resumo.totalQuestoes, 60);
  assert.equal(diagnostico.resumo.totalAcertos, 60);
  assert.equal(diagnostico.materias.length, 6);
  assert.equal(diagnostico.correcao.length, 60);
  for (const materia of materiasImpressas) {
    const total = diagnostico.materias.find((item) => item.materia === materia);
    assert.ok(total, `Disciplina ausente: ${materia}`);
    assert.equal(total.avaliadas, 10);
  }
  for (const numero of [18,19]) {
    assert.equal(diagnostico.correcao[numero-1].assunto, "Confederação do Equador");
  }
});
