import { randomUUID } from "node:crypto";
import type { GoogleGenAI } from "@google/genai";

import {
  extrairGabaritoComentado,
  extrairQuestoesBasicasComRecuperacao,
  questaoSimuladoPdfProntaParaCorrecao,
  questaoSimuladoPdfTemExtracaoConfiavel,
  resolverQuestaoExtraida,
  type ItemGabarito,
  type PayloadSimuladoPdf,
  type QuestaoSimuladoPdfProcessada,
} from "./processarSimuladoPdfPersistente.ts";
import { executarPipelineQuestaoAPorQuestao } from "./simuladoPdfPipeline.ts";

type EstadoE2E = {
  id: string;
  status: "processando" | "concluida" | "erro";
  etapa: string;
  progresso: number;
  descricao: string;
  erro: string | null;
  resultado?: {
    total: number;
    gabaritosCorretos: number;
    faltantes: number[];
    duplicados: number[];
    revisar: number;
    invalidas: number;
    confiancaMedia: number;
    materias: string[];
    alertas: string[];
    amostra: Array<{
      numero: number;
      materia: string;
      assunto: string;
      gabarito: string;
      status: string;
      confianca: number;
    }>;
  };
};

const estados = new Map<string, EstadoE2E>();
const letras = ["A", "B", "C", "D", "E"] as const;

type QuestaoFixture = {
  numero: number;
  materia: string;
  enunciado: string;
  alternativas: string[];
  resposta: string;
};

export function iniciarE2ESimuladoPdf(
  ai: GoogleGenAI,
  modelos: string[]
) {
  const id = randomUUID();
  const estado: EstadoE2E = {
    id,
    status: "processando",
    etapa: "preparando",
    progresso: 1,
    descricao: "Gerando PDF controlado de 60 questões.",
    erro: null,
  };
  estados.set(id, estado);

  void executarE2E(estado, ai, modelos).catch((erro) => {
    estado.status = "erro";
    estado.etapa = "erro";
    estado.erro =
      erro instanceof Error ? erro.message : String(erro);
    estado.descricao = "Teste E2E falhou.";
  });

  return estado;
}

export function obterE2ESimuladoPdf(id: string) {
  return estados.get(id) ?? null;
}

function montarQuestoesFixture(): QuestaoFixture[] {
  const modelos = [
    {
      materia: "Língua Portuguesa",
      enunciado:
        "Na frase 'Os candidatos estudam todos os dias', qual palavra exerce a função de verbo?",
      opcoes: ["estudam", "candidatos", "todos", "dias", "os"],
    },
    {
      materia: "História de Pernambuco",
      enunciado:
        "Em que ano ocorreu a Confederação do Equador, movimento com forte participação de Pernambuco?",
      opcoes: ["1824", "1817", "1889", "1930", "1964"],
    },
    {
      materia: "Raciocínio Lógico",
      enunciado:
        "Se a proposição p é verdadeira e a proposição q é falsa, qual é o valor lógico de p E q?",
      opcoes: ["Falso", "Verdadeiro", "Indeterminado", "Contraditório", "Equivalente"],
    },
    {
      materia: "Informática",
      enunciado:
        "Qual protocolo é usado normalmente para acesso seguro a páginas da Web?",
      opcoes: ["HTTPS", "FTP", "SMTP", "POP3", "Telnet"],
    },
    {
      materia: "Direito Constitucional",
      enunciado:
        "Qual remédio constitucional protege a liberdade de locomoção contra ilegalidade ou abuso de poder?",
      opcoes: [
        "Habeas corpus",
        "Habeas data",
        "Mandado de injunção",
        "Ação popular",
        "Mandado de segurança coletivo",
      ],
    },
    {
      materia: "Direitos Humanos",
      enunciado:
        "Em que ano a Declaração Universal dos Direitos Humanos foi adotada pela Assembleia Geral das Nações Unidas?",
      opcoes: ["1948", "1789", "1945", "1969", "1988"],
    },
  ];

  return Array.from({ length: 60 }, (_, indice) => {
    const numero = indice + 1;
    const modelo = modelos[Math.floor(indice / 10)];
    const rotacao = indice % 5;
    const alternativas = [
      ...modelo.opcoes.slice(rotacao),
      ...modelo.opcoes.slice(0, rotacao),
    ];
    const correta = alternativas.indexOf(modelo.opcoes[0]);

    return {
      numero,
      materia: modelo.materia,
      enunciado: `${modelo.enunciado} (item ${numero})`,
      alternativas,
      resposta: letras[correta],
    };
  });
}

function escaparPdf(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "?");
}

function quebrar(texto: string, maximo = 86) {
  const palavras = texto.split(/\s+/);
  const linhas: string[] = [];
  let linha = "";

  for (const palavra of palavras) {
    const proxima = linha ? `${linha} ${palavra}` : palavra;
    if (proxima.length > maximo) {
      if (linha) linhas.push(linha);
      linha = palavra;
    } else {
      linha = proxima;
    }
  }

  if (linha) linhas.push(linha);
  return linhas;
}

export function gerarPdfE2EControlado() {
  const questoes = montarQuestoesFixture();
  const linhas: string[] = [
    "STUDY PRO - TESTE E2E SIMULADO PDF",
    "60 questoes objetivas - cinco alternativas - gabarito ao final",
    "",
  ];

  for (const questao of questoes) {
    linhas.push(...quebrar(`${questao.numero}. ${questao.enunciado}`));
    questao.alternativas.forEach((alternativa, indice) => {
      linhas.push(`  ${letras[indice]}) ${alternativa}`);
    });
    linhas.push("");
  }

  linhas.push("GABARITO DEFINITIVO");
  linhas.push("Use este gabarito como fonte oficial para as 60 questoes.");

  for (let indice = 0; indice < questoes.length; indice += 10) {
    linhas.push(
      questoes
        .slice(indice, indice + 10)
        .map((questao) => `${questao.numero}-${questao.resposta}`)
        .join("   ")
    );
  }

  const linhasPorPagina = 48;
  const paginas: string[][] = [];
  for (let i = 0; i < linhas.length; i += linhasPorPagina) {
    paginas.push(linhas.slice(i, i + linhasPorPagina));
  }

  const objetos: string[] = [];
  const paginaIds: number[] = [];
  const conteudoIds: number[] = [];

  for (let i = 0; i < paginas.length; i += 1) {
    paginaIds.push(3 + i * 2);
    conteudoIds.push(4 + i * 2);
  }

  const fonteId = 3 + paginas.length * 2;

  objetos[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objetos[2] = `<< /Type /Pages /Count ${paginas.length} /Kids [${paginaIds
    .map((id) => `${id} 0 R`)
    .join(" ")}] >>`;

  paginas.forEach((pagina, indice) => {
    const paginaId = paginaIds[indice];
    const conteudoId = conteudoIds[indice];
    const comandos = [
      "BT",
      "/F1 9 Tf",
      "42 805 Td",
      "13 TL",
      ...pagina.flatMap((linha) => [
        `(${escaparPdf(linha)}) Tj`,
        "T*",
      ]),
      "ET",
    ].join("\n");

    objetos[paginaId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fonteId} 0 R >> >> /Contents ${conteudoId} 0 R >>`;
    objetos[conteudoId] =
      `<< /Length ${Buffer.byteLength(comandos, "ascii")} >>\nstream\n${comandos}\nendstream`;
  });

  objetos[fonteId] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (let id = 1; id <= fonteId; id += 1) {
    offsets[id] = Buffer.byteLength(pdf, "ascii");
    pdf += `${id} 0 obj\n${objetos[id]}\nendobj\n`;
  }

  const inicioXref = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${fonteId + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let id = 1; id <= fonteId; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${fonteId + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;

  return {
    bytes: Buffer.from(pdf, "ascii"),
    questoes,
  };
}

async function executarE2E(
  estado: EstadoE2E,
  ai: GoogleGenAI,
  modelos: string[]
) {
  const fixture = gerarPdfE2EControlado();
  const base64 = fixture.bytes.toString("base64");
  const arquivo = {
    nome: "study-pro-e2e-60q.pdf",
    base64,
  };
  const payload: PayloadSimuladoPdf = {
    tipo: "simulado_pdf",
    totalInformado: 60,
    prova: arquivo,
    comentado: arquivo,
  };

  estado.etapa = "gabarito";
  estado.progresso = 5;
  estado.descricao = "Extraindo o gabarito conhecido do PDF.";

  const itensGabarito = await extrairGabaritoComentado(
    ai,
    modelos,
    arquivo,
    60
  );
  const gabarito = new Map<number, ItemGabarito>(
    itensGabarito.map((item) => [item.numero, item])
  );

  if (gabarito.size !== 60) {
    throw new Error(
      `Gabarito incompleto no E2E: ${gabarito.size}/60 itens extraídos.`
    );
  }

  const pipeline = await executarPipelineQuestaoAPorQuestao({
    totalQuestoes: 60,
    temExtracao: questaoSimuladoPdfTemExtracaoConfiavel,
    estaPronta: questaoSimuladoPdfProntaParaCorrecao,
    extrair: (numeros) =>
      extrairQuestoesBasicasComRecuperacao(
        ai,
        modelos,
        payload,
        numeros
      ),
    resolver: (questao) =>
      resolverQuestaoExtraida(
        ai,
        modelos,
        questao,
        gabarito.get(questao.numero),
        true
      ),
    salvar: async ({ fase, progresso, descricao }) => {
      estado.etapa = fase;
      estado.progresso = progresso;
      estado.descricao = descricao;
    },
  });

  if (pipeline.pendentes.length > 0) {
    throw new Error(
      `E2E terminou com pendências: ${pipeline.pendentes.join(", ")}.`
    );
  }

  const porNumero = new Map(
    pipeline.itens.map((questao) => [questao.numero, questao] as const)
  );
  const faltantes = Array.from({ length: 60 }, (_, indice) => indice + 1)
    .filter((numero) => !porNumero.has(numero));
  const numeros = pipeline.itens.map((questao) => questao.numero);
  const duplicados = numeros.filter(
    (numero, indice) => numeros.indexOf(numero) !== indice
  );
  const esperado = new Map(
    fixture.questoes.map((questao) => [questao.numero, questao.resposta])
  );
  const gabaritosCorretos = pipeline.itens.filter(
    (questao) =>
      questao.gabarito === esperado.get(questao.numero)
  ).length;
  const revisar = pipeline.itens.filter(
    (questao) => questao.status === "revisar"
  ).length;
  const invalidas = pipeline.itens.filter(
    (questao) =>
      !questao.enunciado ||
      questao.alternativas.length < 5
  ).length;
  const confiancaMedia = Math.round(
    pipeline.itens.reduce(
      (total, questao) => total + Number(questao.confianca || 0),
      0
    ) / Math.max(1, pipeline.itens.length)
  );
  const materias = Array.from(
    new Set(
      pipeline.itens
        .map((questao) => questao.materia)
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  estado.status = "concluida";
  estado.etapa = "concluida";
  estado.progresso = 100;
  estado.descricao = "Teste E2E concluído.";
  estado.resultado = {
    total: pipeline.itens.length,
    gabaritosCorretos,
    faltantes,
    duplicados,
    revisar,
    invalidas,
    confiancaMedia,
    materias,
    alertas: [],
    amostra: pipeline.itens.slice(0, 6).map(
      (questao: QuestaoSimuladoPdfProcessada) => ({
        numero: questao.numero,
        materia: questao.materia,
        assunto: questao.assunto,
        gabarito: questao.gabarito,
        status: questao.status,
        confianca: questao.confianca,
      })
    ),
  };
}
