import "dotenv/config";
import cors from "cors";
import { randomUUID } from "node:crypto";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { GoogleGenAI } from "@google/genai";
import {
  ErroJsonInvalidoIA,
  parsearJsonDaIA,
} from "./jsonIa.ts";
import { executarComFallbackGemini } from "./retryGemini.ts";
import { parametrosExtracaoGemini, resolverModelosGemini } from "./modelosGemini.ts";
import { montarPromptGeracaoQuestoesIA } from "./promptQuestoesIA.ts";

const app = express();

const PORT = Number(
  process.env.PORT || 3001
);

const { modelo, modeloFallback } = resolverModelosGemini(process.env);

const apiKey =
  process.env.GEMINI_API_KEY;

const supabaseUrl =
  process.env.SUPABASE_URL ||
  "https://kibnmdwabpiwyprkrhvq.supabase.co";

if (!apiKey) {
  throw new Error(
    "GEMINI_API_KEY não foi configurada no arquivo .env."
  );
}

const ai = new GoogleGenAI({
  apiKey,
});

app.use(
  cors({
    origin: true,
    credentials: false,
  })
);

app.use(
  express.json({
    limit: "40mb",
  })
);

app.get(
  "/api/saude",
  (_req, res) => {
    res.json({
      ok: true,
      modelo,
      modeloFallback,
      chaveCarregada:
        Boolean(apiKey),
    });
  }
);

app.get(
  "/api/modelos",
  async (_req, res) => {
    try {
      const pagina =
        await ai.models.list({
          config: {
            pageSize: 100,
          },
        });

      const modelos:
        string[] = [];

      for await (
        const item of pagina
      ) {
        if (item.name) {
          modelos.push(
            item.name
          );
        }
      }

      res.json({
        total:
          modelos.length,
        modelos,
      });
    } catch (erro) {
      console.error(
        "Erro ao listar modelos:",
        erro
      );

      res.status(500).json({
        erro:
          erro instanceof Error
            ? erro.message
            : "Erro ao listar modelos.",
      });
    }
  }
);

app.post(
  "/api/gerar",
  async (req, res) => {
    try {
      const {
        assunto = "Crase",
        quantidade = 5,
        banca = "AOCP",
        enunciadosEvitar = [],
        etapa = "geração",
      } = req.body;

      const listaEvitar = Array.isArray(enunciadosEvitar)
        ? enunciadosEvitar
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim().slice(0, 500))
            .filter(Boolean)
            .slice(0, 120)
        : [];

      const prompt = etapa === "revisão"
        ? String(assunto)
        : montarPromptGeracaoQuestoesIA({
            assunto: String(assunto),
            quantidade: Number(quantidade),
            banca: String(banca),
            enunciadosEvitar: listaEvitar,
          });

      const resposta =
        await ai.models.generateContent({
          model: modelo,

          contents: prompt,
        });

      if (!resposta.text) {
        throw new Error(
          "O Gemini não retornou texto."
        );
      }

      const texto =
        limparJson(
          resposta.text
        );

      try {
        const questoes =
          JSON.parse(texto);

        if (
          !Array.isArray(
            questoes
          )
        ) {
          throw new Error(
            "A resposta não é uma lista de questões."
          );
        }

        res.json({
          sucesso: true,
          questoes,
        });
      } catch (erroJson) {
        console.error(
          "JSON inválido retornado pela IA:",
          texto
        );

        res.status(500).json({
          sucesso: false,

          erro:
            erroJson instanceof Error
              ? erroJson.message
              : "A IA retornou um JSON inválido.",

          resposta:
            texto,
        });
      }
    } catch (erro) {
      console.error(
        "Erro Gemini:",
        erro
      );

      res.status(500).json({
        sucesso: false,

        erro:
          erro instanceof Error
            ? erro.message
            : "Erro desconhecido.",
      });
    }
  }
);

app.post(
  "/api/coach",
  async (req, res) => {
    try {
      const dados =
        validarDadosCoach(
          req.body
        );

      const resposta =
        await ai.models.generateContent({
          model: modelo,

          contents: montarPromptCoach(
            dados
          ),
        });

      if (!resposta.text) {
        throw new Error(
          "O Gemini não retornou o diagnóstico."
        );
      }

      const texto =
        limparJson(
          resposta.text
        );

      let diagnostico:
        DiagnosticoCoachIA;

      try {
        diagnostico =
          JSON.parse(texto) as
            DiagnosticoCoachIA;
      } catch {
        console.error(
          "Diagnóstico inválido retornado pela IA:",
          texto
        );

        throw new Error(
          "A IA retornou um diagnóstico em formato inválido."
        );
      }

      res.json({
        sucesso: true,
        diagnostico:
          normalizarDiagnostico(
            diagnostico
          ),
      });
    } catch (erro) {
      console.error(
        "Erro no IA Coach:",
        erro
      );

      res.status(500).json({
        sucesso: false,

        erro:
          erro instanceof Error
            ? erro.message
            : "Erro ao gerar o diagnóstico.",
      });
    }
  }
);

/*
COLE ESTA ROTA NO server/index.ts ANTES DO app.listen(...)
*/

app.post(
  "/api/cronograma",
  async (req, res) => {
    try {
      const dados =
        req.body as {
          nomeUsuario?: string;
          concurso?: string;
          banca?: string;
          periodo?: "hoje" | "7-dias";
          tempoDisponivelMinutos?: number;
          perfilEstudo?: {
            diasPorSemana?: number;
            materiaMaiorDificuldade?: string;
            nivelAtual?: string;
            formatoPreferido?: string;
            domingoEstrategico?: boolean;
            observacao?: string;
            modo?: "assistido";
          };
          metas?: unknown;
          questoes?: unknown[];
          sessoes?: unknown[];
          revisoes?: unknown[];
          simulados?: unknown[];
          missoesPendentes?: unknown[];
        };

      const periodo =
        dados.periodo === "7-dias"
          ? "7-dias"
          : "hoje";

      const tempoDisponivel =
        Math.max(
          20,
          Math.min(
            600,
            Number(
              dados.tempoDisponivelMinutos
            ) || 120
          )
        );

      const quantidadeDias =
        periodo === "7-dias"
          ? 7
          : 1;

      const resposta =
        await ai.models.generateContent({
          model: modelo,

          contents: `
Você é um planejador estratégico para concursos públicos brasileiros.

Monte um cronograma realista e executável.

NOME:
${dados.nomeUsuario || "Estudante"}

CONCURSO:
${dados.concurso || "Concurso"}

BANCA:
${dados.banca || "AOCP"}

PERÍODO:
${periodo}

QUANTIDADE DE DIAS:
${quantidadeDias}

TEMPO DISPONÍVEL POR DIA:
${tempoDisponivel} minutos

PERFIL E PREFERÊNCIAS DO ESTUDANTE:
${JSON.stringify(dados.perfilEstudo || {}, null, 2)}

METAS:
${JSON.stringify(dados.metas || {}, null, 2)}

REGISTROS DE QUESTÕES:
${JSON.stringify((dados.questoes || []).slice(-80), null, 2)}

SESSÕES:
${JSON.stringify((dados.sessoes || []).slice(-80), null, 2)}

REVISÕES:
${JSON.stringify((dados.revisoes || []).slice(0, 80), null, 2)}

SIMULADOS:
${JSON.stringify((dados.simulados || []).slice(-20), null, 2)}

MISSÕES PENDENTES DO PLANO:
${JSON.stringify((dados.missoesPendentes || []).slice(0, 80), null, 2)}

CRITÉRIOS:
- priorize revisões atrasadas;
- priorize matérias com baixo aproveitamento;
- inclua missões pendentes quando forem coerentes;
- respeite o tempo disponível por dia;
- não concentre todo o período em uma única matéria;
- use quantidades de questões realistas;
- considere explicitamente a matéria de maior dificuldade e o formato preferido;
- se domingoEstrategico for verdadeiro, reserve o domingo para redação e simulado;
- trate o resultado apenas como proposta assistida, sem declarar que o plano original foi substituído;
- para o período de 7 dias, distribua tarefas entre os dias 1 e 7;
- para hoje, use dia 1;
- não invente missãoId: use somente IDs existentes nas missões pendentes;
- se não houver dados suficientes, use o plano pendente e as metas.

Retorne SOMENTE JSON válido:

{
  "titulo": "Cronograma estratégico",
  "periodo": "${periodo}",
  "resumo": "resumo direto",
  "objetivoPrincipal": "objetivo central",
  "tempoTotalMinutos": 120,
  "tarefas": [
    {
      "id": "tarefa-1",
      "ordem": 1,
      "dia": 1,
      "titulo": "nome da tarefa",
      "materia": "Português",
      "assunto": "Interpretação de textos",
      "tipo": "teoria",
      "duracaoMinutos": 30,
      "quantidadeQuestoes": 0,
      "justificativa": "motivo baseado nos dados",
      "missaoId": "s1-d1-m1"
    }
  ],
  "geradoEm": "${new Date().toISOString()}"
}

Tipos permitidos:
"teoria", "questoes", "revisao", "simulado", "redacao", "misto".

Regras:
- não use markdown;
- não use blocos com crases;
- não escreva nada fora do JSON;
- gere no mínimo 2 tarefas;
- gere no máximo 5 tarefas por dia.
`,
        });

      if (!resposta.text) {
        throw new Error(
          "O Gemini não retornou o cronograma."
        );
      }

      const texto =
        resposta.text
          .replace(
            /```json/gi,
            ""
          )
          .replace(
            /```/g,
            ""
          )
          .trim();

      const cronograma =
        JSON.parse(texto);

      if (
        !cronograma ||
        !Array.isArray(
          cronograma.tarefas
        )
      ) {
        throw new Error(
          "A IA retornou um cronograma inválido."
        );
      }

      const tarefas =
        cronograma.tarefas
          .slice(
            0,
            quantidadeDias * 5
          )
          .map(
            (
              tarefa: any,
              indice: number
            ) => ({
              id:
                String(
                  tarefa.id ||
                  crypto.randomUUID()
                ),

              ordem:
                indice + 1,

              dia:
                Math.max(
                  1,
                  Math.min(
                    quantidadeDias,
                    Number(
                      tarefa.dia
                    ) || 1
                  )
                ),

              titulo:
                String(
                  tarefa.titulo ||
                  `Tarefa ${indice + 1}`
                ),

              materia:
                String(
                  tarefa.materia ||
                  "Estudo"
                ),

              assunto:
                String(
                  tarefa.assunto ||
                  "Conteúdo prioritário"
                ),

              tipo:
                [
                  "teoria",
                  "questoes",
                  "revisao",
                  "simulado",
                  "redacao",
                  "misto",
                ].includes(
                  tarefa.tipo
                )
                  ? tarefa.tipo
                  : "misto",

              duracaoMinutos:
                Math.max(
                  5,
                  Math.round(
                    Number(
                      tarefa.duracaoMinutos
                    ) || 20
                  )
                ),

              quantidadeQuestoes:
                Math.max(
                  0,
                  Math.round(
                    Number(
                      tarefa.quantidadeQuestoes
                    ) || 0
                  )
                ),

              justificativa:
                String(
                  tarefa.justificativa ||
                  "Tarefa recomendada com base nos dados atuais."
                ),

              missaoId:
                tarefa.missaoId
                  ? String(
                      tarefa.missaoId
                    )
                  : undefined,
            })
          );

      res.json({
        sucesso: true,

        cronograma: {
          titulo:
            String(
              cronograma.titulo ||
              "Cronograma estratégico"
            ),

          periodo,

          resumo:
            String(
              cronograma.resumo ||
              "Plano montado com base nos dados atuais."
            ),

          objetivoPrincipal:
            String(
              cronograma.objetivoPrincipal ||
              "Executar as prioridades do período."
            ),

          tempoTotalMinutos:
            tarefas.reduce(
              (
                total: number,
                tarefa: any
              ) =>
                total +
                tarefa.duracaoMinutos,
              0
            ),

          tarefas,

          geradoEm:
            new Date()
              .toISOString(),
        },
      });
    } catch (erro) {
      console.error(
        "Erro no cronograma IA:",
        erro
      );

      res.status(500).json({
        sucesso: false,

        erro:
          erro instanceof Error
            ? erro.message
            : "Erro ao gerar cronograma.",
      });
    }
  }
);

app.post(
  "/api/analisar-prova",
  exigirAdministrador,
  async (req, res) => {
    const diagnosticoId = obterDiagnosticoId(req);
    const inicio = Date.now();

    try {
      const entrada = validarEntradaAnaliseProva(req.body);
      registrarDiagnosticoImportacao(diagnosticoId, "requisicao_iniciada", {
        provaKb: tamanhoBase64EmKb(entrada.prova.base64),
        gabaritoKb: entrada.gabarito
          ? tamanhoBase64EmKb(entrada.gabarito.base64)
          : 0,
        assuntosEdital: entrada.mapaEdital.length,
      });

      const analise = await analisarProvaCompleta(entrada, diagnosticoId);

      registrarDiagnosticoImportacao(diagnosticoId, "requisicao_concluida", {
        duracaoMs: Date.now() - inicio,
        totalDetectadas: analise.totalDetectadas,
        totalEsperadas: analise.totalEsperadas,
      });

      res.json({
        sucesso: true,
        diagnosticoId,
        analise,
      });
    } catch (erro) {
      console.error("[importacao-prova]", {
        diagnosticoId,
        etapa: "requisicao_falhou",
        duracaoMs: Date.now() - inicio,
        erro: erro instanceof Error ? erro.message : String(erro),
        stack: erro instanceof Error ? erro.stack : undefined,
      });

      res.status(500).json({
        sucesso: false,
        diagnosticoId,
        erro:
          erro instanceof Error
            ? erro.message
            : "Erro ao analisar a prova.",
      });
    }
  }
);

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `API Gemini online na porta ${PORT}`
    );

    console.log(
      `Modelo configurado: ${modelo}`
    );
  }
);

type ArquivoPdfAnalise = {
  nome: string;
  mimeType: "application/pdf";
  base64: string;
};

type ItemMapaEditalAnalise = {
  materiaId: string;
  materia: string;
  moduloId: string;
  modulo: string;
  assuntoId: string;
  assunto: string;
};

type EntradaAnaliseProva = {
  prova: ArquivoPdfAnalise;
  gabarito: ArquivoPdfAnalise | null;
  metadados: {
    concursoAlvo: string;
    editalAlvo: string;
    concursoOrigem: string;
    cargoOrigem: string;
    anoOrigem: number;
    banca: string;
  };
  mapaEdital: ItemMapaEditalAnalise[];
};

type StatusItemGabarito = "valida" | "anulada";

type ItemGabaritoExtraido = {
  numero: number;
  resposta: string;
  status: StatusItemGabarito;
};

type GabaritoExtraido = {
  totalQuestoes: number;
  itens: ItemGabaritoExtraido[];
  alertas: string[];
};

type IntervaloQuestoes = {
  inicio: number;
  fim: number;
};

const TAMANHO_BLOCO_QUESTOES = 10;
const CONCORRENCIA_ANALISE_BLOCOS = 2;

async function exigirAdministrador(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const autorizacao = req.header("authorization") ?? "";
    const chavePublica = req.header("x-supabase-anon-key") ?? "";

    if (!autorizacao.startsWith("Bearer ") || chavePublica.length < 20) {
      res.status(401).json({
        sucesso: false,
        erro: "Sessão administrativa não informada.",
      });
      return;
    }

    const cabecalhos = {
      apikey: chavePublica,
      Authorization: autorizacao,
      "Content-Type": "application/json",
    };

    const usuarioResposta = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: cabecalhos,
    });

    if (!usuarioResposta.ok) {
      res.status(401).json({
        sucesso: false,
        erro: "Sessão expirada ou inválida.",
      });
      return;
    }

    const adminResposta = await fetch(`${supabaseUrl}/rest/v1/rpc/sou_admin`, {
      method: "POST",
      headers: cabecalhos,
      body: "{}",
    });

    const ehAdministrador = adminResposta.ok
      ? (await adminResposta.json()) === true
      : false;

    if (!ehAdministrador) {
      res.status(403).json({
        sucesso: false,
        erro: "A importação de provas é restrita ao administrador.",
      });
      return;
    }

    next();
  } catch (erro) {
    console.error("Falha ao validar administrador:", erro);
    res.status(503).json({
      sucesso: false,
      erro: "Não foi possível validar a permissão administrativa.",
    });
  }
}

function validarEntradaAnaliseProva(valor: unknown): EntradaAnaliseProva {
  const entrada = objetoSeguro(valor);
  const metadados = objetoSeguro(entrada.metadados);
  const mapaBruto = Array.isArray(entrada.mapaEdital) ? entrada.mapaEdital : [];

  return {
    prova: validarPdfAnalise(entrada.prova, "prova"),
    gabarito: entrada.gabarito
      ? validarPdfAnalise(entrada.gabarito, "gabarito")
      : null,
    metadados: {
      concursoAlvo: textoSeguro(metadados.concursoAlvo, "PMPE"),
      editalAlvo: textoSeguro(metadados.editalAlvo, "PMPE 2024"),
      concursoOrigem: textoSeguro(metadados.concursoOrigem, "Concurso não informado"),
      cargoOrigem: textoSeguro(metadados.cargoOrigem, "Cargo não informado"),
      anoOrigem: Math.max(1980, Math.min(2100, Math.round(numeroSeguro(metadados.anoOrigem)))),
      banca: textoSeguro(metadados.banca, "Não informada"),
    },
    mapaEdital: mapaBruto.slice(0, 600).map((item) => {
      const mapa = objetoSeguro(item);
      return {
        materiaId: textoSeguro(mapa.materiaId, ""),
        materia: textoSeguro(mapa.materia, ""),
        moduloId: textoSeguro(mapa.moduloId, ""),
        modulo: textoSeguro(mapa.modulo, ""),
        assuntoId: textoSeguro(mapa.assuntoId, ""),
        assunto: textoSeguro(mapa.assunto, ""),
      };
    }),
  };
}

function validarPdfAnalise(valor: unknown, rotulo: string): ArquivoPdfAnalise {
  const arquivo = objetoSeguro(valor);
  const nome = textoSeguro(arquivo.nome, `${rotulo}.pdf`);
  const base64 = textoSeguro(arquivo.base64, "");

  if (!base64) {
    throw new Error(`O PDF de ${rotulo} não foi enviado.`);
  }

  if (base64.length > 17_000_000) {
    throw new Error(`O PDF de ${rotulo} ultrapassa o limite permitido.`);
  }

  return {
    nome,
    mimeType: "application/pdf",
    base64,
  };
}

function obterDiagnosticoId(req: Request) {
  const recebido = req.get("X-Importacao-Id")?.trim() ?? "";

  if (/^[a-zA-Z0-9-]{8,80}$/.test(recebido)) {
    return recebido;
  }

  return randomUUID();
}

function tamanhoBase64EmKb(base64: string) {
  return Math.round((base64.length * 3) / 4 / 1024);
}

function registrarDiagnosticoImportacao(
  diagnosticoId: string,
  etapa: string,
  detalhes: Record<string, unknown> = {}
) {
  console.info("[importacao-prova]", {
    diagnosticoId,
    etapa,
    ...detalhes,
  });
}

async function analisarProvaCompleta(
  entrada: EntradaAnaliseProva,
  diagnosticoId: string
) {
  if (!entrada.gabarito) {
    throw new Error(
      "O gabarito definitivo é obrigatório para validar a quantidade e as anulações."
    );
  }

  registrarDiagnosticoImportacao(diagnosticoId, "gabarito_iniciado");
  const gabarito = await extrairGabaritoDefinitivo(entrada.gabarito);
  registrarDiagnosticoImportacao(diagnosticoId, "gabarito_concluido", {
    totalQuestoes: gabarito.totalQuestoes,
    anuladas: gabarito.itens.filter((item) => item.status === "anulada").length,
  });
  const intervalos = criarIntervalosQuestoes(gabarito.totalQuestoes);
  const resultados = await mapearComConcorrencia(
    intervalos,
    CONCORRENCIA_ANALISE_BLOCOS,
    async (intervalo) => {
      const rotulo = `${intervalo.inicio}-${intervalo.fim}`;
      const inicioBloco = Date.now();
      registrarDiagnosticoImportacao(diagnosticoId, "bloco_iniciado", {
        bloco: rotulo,
      });

      try {
        const resultado = await analisarBlocoComRecuperacao(
          entrada,
          gabarito,
          intervalo,
          diagnosticoId
        );
        registrarDiagnosticoImportacao(diagnosticoId, "bloco_concluido", {
          bloco: rotulo,
          duracaoMs: Date.now() - inicioBloco,
          questoes: resultado.questoes.length,
        });
        return resultado;
      } catch (erro) {
        registrarDiagnosticoImportacao(diagnosticoId, "bloco_falhou", {
          bloco: rotulo,
          duracaoMs: Date.now() - inicioBloco,
          erro: erro instanceof Error ? erro.message : String(erro),
        });
        throw erro;
      }
    }
  );

  const porNumero = new Map<
    number,
    ReturnType<typeof normalizarAnaliseProva>["questoes"][number]
  >();

  for (const resultado of resultados) {
    for (const questao of resultado.questoes) {
      if (!porNumero.has(questao.numeroOriginal)) {
        porNumero.set(questao.numeroOriginal, questao);
      }
    }
  }

  const faltantes = numerosFaltantes(
    porNumero.keys(),
    gabarito.totalQuestoes
  );

  if (faltantes.length > 0) {
    throw new Error(
      `A análise ficou incompleta: faltaram as questões ${formatarNumeros(faltantes)}. Nada foi liberado para a fila editorial.`
    );
  }

  const mapaGabarito = new Map(
    gabarito.itens.map((item) => [item.numero, item] as const)
  );
  const questoes = Array.from(porNumero.values())
    .sort((a, b) => a.numeroOriginal - b.numeroOriginal)
    .map((questao) => aplicarGabaritoDefinitivo(
      questao,
      mapaGabarito.get(questao.numeroOriginal)
    ));

  const alertas = deduplicarTextos([
    `Gabarito definitivo conferido: ${gabarito.totalQuestoes} questões, ${gabarito.itens.filter((item) => item.status === "anulada").length} anuladas.`,
    ...gabarito.alertas,
    ...resultados.flatMap((resultado) => resultado.alertas),
  ]);

  const analise = normalizarAnaliseProva({ alertas, questoes });

  return {
    ...analise,
    totalEsperadas: gabarito.totalQuestoes,
  };
}

async function extrairGabaritoDefinitivo(
  arquivo: ArquivoPdfAnalise
): Promise<GabaritoExtraido> {
  const primeiraLeitura = await gerarJsonComPdf({
    prompt: montarPromptGabarito(),
    arquivo,
    maxOutputTokens: 8192,
    rotulo: "gabarito definitivo",
  });
  let gabarito = normalizarGabarito(primeiraLeitura);

  const faltantes = numerosFaltantes(
    gabarito.itens.map((item) => item.numero),
    gabarito.totalQuestoes
  );

  if (faltantes.length > 0) {
    const recuperacao = await gerarJsonComPdf({
      prompt: montarPromptGabarito(faltantes, gabarito.totalQuestoes),
      arquivo,
      maxOutputTokens: 8192,
      rotulo: "itens ausentes do gabarito definitivo",
    });
    const complemento = normalizarGabarito(
      recuperacao,
      gabarito.totalQuestoes
    );
    gabarito = mesclarGabaritos(gabarito, complemento);
  }

  const aindaFaltantes = numerosFaltantes(
    gabarito.itens.map((item) => item.numero),
    gabarito.totalQuestoes
  );

  if (aindaFaltantes.length > 0) {
    throw new Error(
      `Não foi possível ler o gabarito completo. Faltaram os itens ${formatarNumeros(aindaFaltantes)}.`
    );
  }

  return gabarito;
}

async function analisarBlocoComRecuperacao(
  entrada: EntradaAnaliseProva,
  gabarito: GabaritoExtraido,
  intervalo: IntervaloQuestoes,
  diagnosticoId: string
) {
  try {
    return await analisarBlocoUmaVez(entrada, gabarito, intervalo);
  } catch (erro) {
    if (
      !(erro instanceof ErroJsonInvalidoIA) ||
      intervalo.inicio >= intervalo.fim
    ) {
      throw erro;
    }

    const meio = Math.floor((intervalo.inicio + intervalo.fim) / 2);
    const partes = [
      { inicio: intervalo.inicio, fim: meio },
      { inicio: meio + 1, fim: intervalo.fim },
    ];

    registrarDiagnosticoImportacao(diagnosticoId, "bloco_subdividido", {
      bloco: `${intervalo.inicio}-${intervalo.fim}`,
      motivo: "json_invalido",
      novosBlocos: partes.map((parte) => `${parte.inicio}-${parte.fim}`),
    });

    const resultados = await mapearComConcorrencia(
      partes,
      1,
      (parte) =>
        analisarBlocoComRecuperacao(
          entrada,
          gabarito,
          parte,
          diagnosticoId
        )
    );

    return mesclarAnalisesDeBlocos(resultados);
  }
}

async function analisarBlocoUmaVez(
  entrada: EntradaAnaliseProva,
  gabarito: GabaritoExtraido,
  intervalo: IntervaloQuestoes
) {
  const primeiraLeitura = await gerarJsonComPdf({
    prompt: montarPromptAnaliseBloco(entrada, gabarito, intervalo),
    arquivo: entrada.prova,
    maxOutputTokens: 32768,
    rotulo: `questões ${intervalo.inicio} a ${intervalo.fim}`,
  });
  const primeiraAnalise = filtrarAnaliseDoBloco(
    normalizarAnaliseProva(primeiraLeitura),
    intervalo
  );

  const faltantes = numerosFaltantesNoIntervalo(
    primeiraAnalise.questoes.map((questao) => questao.numeroOriginal),
    intervalo
  );

  if (faltantes.length === 0) {
    return primeiraAnalise;
  }

  const recuperacao = await gerarJsonComPdf({
    prompt: montarPromptAnaliseBloco(
      entrada,
      gabarito,
      intervalo,
      faltantes
    ),
    arquivo: entrada.prova,
    maxOutputTokens: 24576,
    rotulo: `questões ausentes ${formatarNumeros(faltantes)}`,
  });
  const segundaAnalise = filtrarAnaliseDoBloco(
    normalizarAnaliseProva(recuperacao),
    intervalo
  );
  const porNumero = new Map(
    [...primeiraAnalise.questoes, ...segundaAnalise.questoes]
      .map((questao) => [questao.numeroOriginal, questao] as const)
  );
  const aindaFaltantes = numerosFaltantesNoIntervalo(
    porNumero.keys(),
    intervalo
  );

  if (aindaFaltantes.length > 0) {
    throw new Error(
      `O PDF não permitiu extrair integralmente as questões ${formatarNumeros(aindaFaltantes)}.`
    );
  }

  return {
    ...primeiraAnalise,
    questoes: Array.from(porNumero.values())
      .sort((a, b) => a.numeroOriginal - b.numeroOriginal),
    alertas: deduplicarTextos([
      ...primeiraAnalise.alertas,
      ...segundaAnalise.alertas,
    ]),
  };
}

function mesclarAnalisesDeBlocos(
  resultados: ReturnType<typeof normalizarAnaliseProva>[]
) {
  const porNumero = new Map(
    resultados
      .flatMap((resultado) => resultado.questoes)
      .map((questao) => [questao.numeroOriginal, questao] as const)
  );

  return {
    totalDetectadas: porNumero.size,
    totalComGabarito: Array.from(porNumero.values())
      .filter((questao) => Boolean(questao.respostaCorretaId)).length,
    anuladasDetectadas: Array.from(porNumero.values())
      .filter((questao) => questao.statusSugerido === "anulada").length,
    foraDoEdital: Array.from(porNumero.values())
      .filter((questao) => questao.compatibilidadeEdital === "fora").length,
    alertas: deduplicarTextos(
      resultados.flatMap((resultado) => resultado.alertas)
    ),
    questoes: Array.from(porNumero.values())
      .sort((a, b) => a.numeroOriginal - b.numeroOriginal),
  };
}

async function gerarJsonComPdf({
  prompt,
  arquivo,
  maxOutputTokens,
  rotulo,
}: {
  prompt: string;
  arquivo: ArquivoPdfAnalise;
  maxOutputTokens: number;
  rotulo: string;
}): Promise<unknown> {
  const resposta = await executarComFallbackGemini(
    (modeloAtual) => ai.models.generateContent({
      model: modeloAtual,
      contents: [{
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: arquivo.mimeType,
              data: arquivo.base64,
            },
          },
        ],
      }],
      config: {
        ...parametrosExtracaoGemini(modeloAtual),
        responseMimeType: "application/json",
        maxOutputTokens,
      },
    }),
    {
      rotulo,
      modelos: [modelo, modeloFallback],
      tentativasPorModelo: [2, 3],
      aoTentarNovamente: (dados) => {
        console.warn("[gemini-retry]", dados);
      },
      aoTrocarModelo: (dados) => {
        console.warn("[gemini-fallback]", dados);
      },
    }
  );

  const motivoTermino = resposta.candidates?.[0]?.finishReason;

  if (motivoTermino === "MAX_TOKENS") {
    throw new Error(`A leitura de ${rotulo} atingiu o limite de resposta.`);
  }

  if (!resposta.text) {
    throw new Error(`A IA não retornou a leitura de ${rotulo}.`);
  }

  return parsearJsonDaIA(resposta.text, rotulo);
}

function montarPromptGabarito(
  numerosEspecificos: number[] = [],
  totalConhecido = 0
) {
  const escopo = numerosEspecificos.length > 0
    ? `Extraia SOMENTE estes números que faltaram: ${numerosEspecificos.join(", ")}. O total conhecido da prova é ${totalConhecido}.`
    : "Extraia todos os itens, do primeiro ao último, sem pular números.";

  return `
Você está lendo exclusivamente o GABARITO DEFINITIVO de uma prova de concurso.
O PDF pode ser um documento nativo, uma digitalização ou uma captura de tela com uma tabela lateral.

${escopo}

REGRAS OBRIGATÓRIAS:
- Informe o total real de questões da prova.
- Para resposta válida, use somente A, B, C, D ou E.
- Marca X, círculo vermelho com X, asterisco, traço no lugar da letra, "ANULADA" ou "NULA" significa status "anulada" e resposta vazia.
- Não transforme questão anulada em alternativa.
- Não use conhecimento próprio para corrigir o gabarito: transcreva o documento.
- Cada número deve aparecer uma única vez.
- Retorne somente JSON válido, sem markdown, neste formato exato:
{
  "totalQuestoes": 60,
  "itens": [
    { "numero": 1, "resposta": "A", "status": "valida" },
    { "numero": 2, "resposta": "", "status": "anulada" }
  ],
  "alertas": []
}
`;
}

function montarPromptAnaliseBloco(
  entrada: EntradaAnaliseProva,
  gabarito: GabaritoExtraido,
  intervalo: IntervaloQuestoes,
  numerosEspecificos: number[] = []
) {
  const numeros = numerosEspecificos.length > 0
    ? numerosEspecificos
    : Array.from(
        { length: intervalo.fim - intervalo.inicio + 1 },
        (_, indice) => intervalo.inicio + indice
      );
  const itensGabarito = gabarito.itens.filter((item) =>
    numeros.includes(item.numero)
  );

  return `
Você é um revisor editorial de questões de concursos públicos brasileiros.

O PDF anexado é o caderno completo da prova. Trabalhe apenas com as questões ${numeros.join(", ")}.

OBJETIVO:
1. Extraia exatamente ${numeros.length} questões: ${numeros.join(", ")}.
2. Preserve literalmente o enunciado e todas as alternativas exibidas no PDF.
3. Não resuma, não complete trechos e não misture texto de questões vizinhas.
4. Relacione cada questão ao mapa do edital-alvo.
5. Identifique matéria, módulo, assunto, subassunto, norma e dispositivo.
6. Sinalize possível desatualização ou controvérsia, mas não trate sua memória como fonte oficial.
7. Nunca aprove uma questão. Toda questão aparentemente válida deve voltar como "pendente" para revisão humana.

GABARITO DEFINITIVO JÁ CONFERIDO PARA ESTE BLOCO:
${JSON.stringify(itensGabarito, null, 2)}

O gabarito acima é a única fonte para respostaCorretaId e anulação. Se o item estiver anulado, use respostaCorretaId vazia e statusSugerido "anulada".

METADADOS:
${JSON.stringify(entrada.metadados, null, 2)}

MAPA CANÔNICO DO EDITAL-ALVO:
${JSON.stringify(entrada.mapaEdital, null, 2)}

REGRAS DE COMPATIBILIDADE:
- "direta": o assunto aparece expressamente no mapa;
- "implicita": está inequivocamente abrangido por um item mais amplo;
- "relacionada": ajuda no tema, mas excede o conteúdo exigido;
- "fora": pertence a história, geografia, legislação ou conteúdo específico de outro estado/cargo;
- "incerta": o enquadramento exige decisão humana.

REGRAS DE STATUS:
- "anulada": somente quando o gabarito definitivo acima indicar anulação;
- "desatualizada": somente quando houver forte evidência de norma superada; explique o risco;
- "duvidosa": ambiguidade, mais de uma resposta, erro de extração ou controvérsia;
- "pendente": todos os demais casos, pois ainda aguardam aprovação humana.

Use IDs do mapa somente quando houver correspondência real. Caso contrário, deixe os IDs vazios.
Não misture História ou legislação local de outro estado com Pernambuco.
Use dificuldade somente "facil", "media" ou "dificil".
Use confiança somente "alta", "media" ou "baixa".
Retorne somente JSON válido, sem markdown, neste formato exato:
{
  "alertas": [],
  "questoes": [
    {
      "numeroOriginal": 1,
      "materiaId": "",
      "materia": "Português",
      "moduloId": "",
      "modulo": "Interpretação de texto",
      "assuntoId": "",
      "assunto": "Compreensão textual",
      "subassunto": "",
      "dificuldade": "media",
      "enunciado": "texto integral da questão",
      "alternativas": [
        { "id": "A", "texto": "texto integral" },
        { "id": "B", "texto": "texto integral" }
      ],
      "respostaCorretaId": "A",
      "explicacao": "explicação objetiva",
      "compatibilidadeEdital": "direta",
      "confiancaClassificacao": "alta",
      "statusSugerido": "pendente",
      "norma": "",
      "dispositivo": "",
      "motivoStatus": ""
    }
  ]
}
`;
}

function normalizarGabarito(
  valor: unknown,
  totalPadrao = 0
): GabaritoExtraido {
  const raiz = objetoSeguro(valor);
  const itensBrutos = Array.isArray(raiz.itens) ? raiz.itens : [];
  const porNumero = new Map<number, ItemGabaritoExtraido>();

  for (const itemBruto of itensBrutos) {
    const item = objetoSeguro(itemBruto);
    const numero = Math.round(numeroSeguro(item.numero));
    const respostaBruta = textoSeguro(item.resposta, "").toUpperCase();
    const statusBruto = textoSeguro(item.status, "valida").toLowerCase();
    const anulada = statusBruto === "anulada" ||
      ["X", "*", "ANULADA", "NULA"].includes(respostaBruta);

    if (numero < 1 || numero > 300 || porNumero.has(numero)) continue;

    const resposta = anulada ? "" : respostaBruta.charAt(0);
    if (!anulada && !/[A-E]/.test(resposta)) continue;

    porNumero.set(numero, {
      numero,
      resposta,
      status: anulada ? "anulada" : "valida",
    });
  }

  const maiorNumero = Math.max(0, ...porNumero.keys());
  const totalDeclarado = Math.round(numeroSeguro(raiz.totalQuestoes));
  const totalQuestoes = Math.max(
    1,
    Math.min(300, totalPadrao || totalDeclarado || maiorNumero)
  );
  const alertas = Array.isArray(raiz.alertas)
    ? deduplicarTextos(
        raiz.alertas.map((item) => textoSeguro(item, "")).filter(Boolean)
      )
    : [];

  return {
    totalQuestoes,
    itens: Array.from(porNumero.values())
      .filter((item) => item.numero <= totalQuestoes)
      .sort((a, b) => a.numero - b.numero),
    alertas,
  };
}

function mesclarGabaritos(
  principal: GabaritoExtraido,
  complemento: GabaritoExtraido
): GabaritoExtraido {
  const porNumero = new Map(
    [...principal.itens, ...complemento.itens]
      .map((item) => [item.numero, item] as const)
  );

  return {
    totalQuestoes: principal.totalQuestoes,
    itens: Array.from(porNumero.values())
      .filter((item) => item.numero <= principal.totalQuestoes)
      .sort((a, b) => a.numero - b.numero),
    alertas: deduplicarTextos([
      ...principal.alertas,
      ...complemento.alertas,
    ]),
  };
}

function aplicarGabaritoDefinitivo(
  questao: ReturnType<typeof normalizarAnaliseProva>["questoes"][number],
  gabarito?: ItemGabaritoExtraido
): ReturnType<typeof normalizarAnaliseProva>["questoes"][number] {
  if (!gabarito) return questao;

  if (gabarito.status === "anulada") {
    return {
      ...questao,
      respostaCorretaId: "",
      statusSugerido: "anulada",
      motivoStatus: "Questão anulada no gabarito definitivo.",
    };
  }

  return {
    ...questao,
    respostaCorretaId: gabarito.resposta,
    statusSugerido: questao.statusSugerido === "anulada"
      ? "pendente"
      : questao.statusSugerido,
  };
}

function filtrarAnaliseDoBloco(
  analise: ReturnType<typeof normalizarAnaliseProva>,
  intervalo: IntervaloQuestoes
) {
  const porNumero = new Map(
    analise.questoes
      .filter((questao) =>
        questao.numeroOriginal >= intervalo.inicio &&
        questao.numeroOriginal <= intervalo.fim
      )
      .map((questao) => [questao.numeroOriginal, questao] as const)
  );

  return {
    ...analise,
    questoes: Array.from(porNumero.values())
      .sort((a, b) => a.numeroOriginal - b.numeroOriginal),
    alertas: deduplicarTextos(analise.alertas),
  };
}

function criarIntervalosQuestoes(total: number): IntervaloQuestoes[] {
  const intervalos: IntervaloQuestoes[] = [];

  for (let inicio = 1; inicio <= total; inicio += TAMANHO_BLOCO_QUESTOES) {
    intervalos.push({
      inicio,
      fim: Math.min(total, inicio + TAMANHO_BLOCO_QUESTOES - 1),
    });
  }

  return intervalos;
}

function numerosFaltantes(
  numerosPresentes: Iterable<number>,
  total: number
) {
  return numerosFaltantesNoIntervalo(numerosPresentes, {
    inicio: 1,
    fim: total,
  });
}

function numerosFaltantesNoIntervalo(
  numerosPresentes: Iterable<number>,
  intervalo: IntervaloQuestoes
) {
  const presentes = new Set(numerosPresentes);
  const faltantes: number[] = [];

  for (let numero = intervalo.inicio; numero <= intervalo.fim; numero += 1) {
    if (!presentes.has(numero)) faltantes.push(numero);
  }

  return faltantes;
}

function formatarNumeros(numeros: number[]) {
  return numeros.slice(0, 20).join(", ") +
    (numeros.length > 20 ? ` e mais ${numeros.length - 20}` : "");
}

function deduplicarTextos(textos: string[]) {
  const vistos = new Set<string>();

  return textos.filter((texto) => {
    const normalizado = texto.replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
    if (!normalizado || vistos.has(normalizado)) return false;
    vistos.add(normalizado);
    return true;
  });
}

async function mapearComConcorrencia<T, R>(
  itens: T[],
  limite: number,
  executar: (item: T, indice: number) => Promise<R>
): Promise<R[]> {
  const resultados = new Array<R>(itens.length);
  let proximoIndice = 0;

  async function trabalhador() {
    while (proximoIndice < itens.length) {
      const indice = proximoIndice;
      proximoIndice += 1;
      resultados[indice] = await executar(itens[indice], indice);
    }
  }

  const quantidadeTrabalhadores = Math.min(
    Math.max(1, limite),
    itens.length
  );

  await Promise.all(
    Array.from({ length: quantidadeTrabalhadores }, () => trabalhador())
  );

  return resultados;
}

function normalizarAnaliseProva(valor: unknown) {
  const raiz = objetoSeguro(valor);
  const questoesBrutas = Array.isArray(raiz.questoes) ? raiz.questoes : [];

  const questoes = questoesBrutas.slice(0, 150).map((item, indice) => {
    const questao = objetoSeguro(item);
    const alternativasBrutas = Array.isArray(questao.alternativas)
      ? questao.alternativas
      : [];

    const alternativas = alternativasBrutas.slice(0, 8).map((alternativa, alternativaIndice) => {
      const itemAlternativa = objetoSeguro(alternativa);
      return {
        id: textoSeguro(
          itemAlternativa.id,
          String.fromCharCode(65 + alternativaIndice)
        ).toUpperCase(),
        texto: textoSeguro(itemAlternativa.texto, ""),
      };
    }).filter((alternativa) => alternativa.texto);

    const statusSugerido = normalizarOpcao(
      questao.statusSugerido,
      ["pendente", "anulada", "desatualizada", "duvidosa"] as const,
      "duvidosa"
    );

    return {
      numeroOriginal: Math.max(1, Math.round(numeroSeguro(questao.numeroOriginal) || indice + 1)),
      materiaId: textoSeguro(questao.materiaId, ""),
      materia: textoSeguro(questao.materia, "Não classificada"),
      moduloId: textoSeguro(questao.moduloId, ""),
      modulo: textoSeguro(questao.modulo, ""),
      assuntoId: textoSeguro(questao.assuntoId, ""),
      assunto: textoSeguro(questao.assunto, "Não classificado"),
      subassunto: textoSeguro(questao.subassunto, ""),
      dificuldade: normalizarOpcao(
        questao.dificuldade,
        ["facil", "media", "dificil"] as const,
        "media"
      ),
      enunciado: textoSeguro(questao.enunciado, `Questão ${indice + 1}`),
      alternativas,
      respostaCorretaId: statusSugerido === "anulada"
        ? ""
        : textoSeguro(questao.respostaCorretaId, "").toUpperCase().charAt(0),
      explicacao: textoSeguro(questao.explicacao, ""),
      compatibilidadeEdital: normalizarOpcao(
        questao.compatibilidadeEdital,
        ["direta", "implicita", "relacionada", "fora", "incerta"] as const,
        "incerta"
      ),
      confiancaClassificacao: normalizarOpcao(
        questao.confiancaClassificacao,
        ["alta", "media", "baixa"] as const,
        "baixa"
      ),
      statusSugerido,
      norma: textoSeguro(questao.norma, ""),
      dispositivo: textoSeguro(questao.dispositivo, ""),
      motivoStatus: textoSeguro(questao.motivoStatus, ""),
    };
  }).filter((questao) => questao.enunciado && questao.alternativas.length >= 2);

  const alertas = Array.isArray(raiz.alertas)
    ? deduplicarTextos(
        raiz.alertas
          .slice(0, 20)
          .map((item) => textoSeguro(item, ""))
          .filter(Boolean)
      )
    : [];

  return {
    totalDetectadas: questoes.length,
    totalComGabarito: questoes.filter((questao) => questao.respostaCorretaId).length,
    anuladasDetectadas: questoes.filter((questao) => questao.statusSugerido === "anulada").length,
    foraDoEdital: questoes.filter((questao) => questao.compatibilidadeEdital === "fora").length,
    alertas,
    questoes,
  };
}

function objetoSeguro(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object"
    ? valor as Record<string, unknown>
    : {};
}

function normalizarOpcao<const T extends readonly string[]>(
  valor: unknown,
  opcoes: T,
  padrao: T[number]
): T[number] {
  return typeof valor === "string" && opcoes.includes(valor)
    ? valor as T[number]
    : padrao;
}

type PrioridadeCoach =
  | "alta"
  | "media"
  | "baixa";

type AcaoCoachIA = {
  ordem: number;
  prioridade:
    PrioridadeCoach;
  titulo: string;
  motivo: string;
  duracaoMinutos: number;
  quantidadeQuestoes: number;
  tipo:
    | "teoria"
    | "questoes"
    | "revisao"
    | "simulado"
    | "misto";
  materia?: string;
  assunto?: string;
};

type DiagnosticoCoachIA = {
  resumo: string;
  alertaPrincipal: string;
  focoDoDia: string;
  tempoTotalMinutos: number;
  mensagemFinal: string;
  acoes: AcaoCoachIA[];
};

type DadosCoach = {
  nomeUsuario: string;
  concurso: string;
  banca: string;
  indiceGeral: number;
  aproveitamentoGeral: number;
  minutosSemana: number;
  diasAtivosSemana: number;
  revisoesAtrasadas: number;
  revisoesPendentes: number;
  totalQuestoes: number;
  materias: Array<{
    materia: string;
    percentual: number;
    certas: number;
    erradas: number;
    total: number;
    minutos: number;
    diasSemEstudar?: number;
  }>;
  assuntosCriticos: Array<{
    materia: string;
    assunto: string;
    percentual: number;
    erros: number;
    total: number;
  }>;
  metas: {
    minutosDia: number;
    questoesDia: number;
    revisoesDia: number;
  };
};

function validarDadosCoach(
  valor: unknown
): DadosCoach {
  if (
    !valor ||
    typeof valor !== "object"
  ) {
    throw new Error(
      "Dados do Coach não foram enviados."
    );
  }

  const dados =
    valor as Partial<DadosCoach>;

  return {
    nomeUsuario:
      textoSeguro(
        dados.nomeUsuario,
        "Estudante"
      ),

    concurso:
      textoSeguro(
        dados.concurso,
        "Concurso"
      ),

    banca:
      textoSeguro(
        dados.banca,
        "AOCP"
      ),

    indiceGeral:
      numeroSeguro(
        dados.indiceGeral
      ),

    aproveitamentoGeral:
      numeroSeguro(
        dados.aproveitamentoGeral
      ),

    minutosSemana:
      numeroSeguro(
        dados.minutosSemana
      ),

    diasAtivosSemana:
      numeroSeguro(
        dados.diasAtivosSemana
      ),

    revisoesAtrasadas:
      numeroSeguro(
        dados.revisoesAtrasadas
      ),

    revisoesPendentes:
      numeroSeguro(
        dados.revisoesPendentes
      ),

    totalQuestoes:
      numeroSeguro(
        dados.totalQuestoes
      ),

    materias:
      Array.isArray(
        dados.materias
      )
        ? dados.materias.slice(0, 12)
        : [],

    assuntosCriticos:
      Array.isArray(
        dados.assuntosCriticos
      )
        ? dados.assuntosCriticos.slice(0, 10)
        : [],

    metas: {
      minutosDia:
        numeroSeguro(
          dados.metas?.minutosDia
        ),

      questoesDia:
        numeroSeguro(
          dados.metas?.questoesDia
        ),

      revisoesDia:
        numeroSeguro(
          dados.metas?.revisoesDia
        ),
    },
  };
}

function montarPromptCoach(
  dados: DadosCoach
) {
  return `
Você é um coach estratégico para concursos públicos brasileiros.

Sua função é analisar os dados reais do estudante e montar um plano de execução objetivo para hoje.

Não invente dados.
Não use linguagem motivacional genérica.
Não repita números sem interpretar.
Priorize revisões atrasadas, matérias fracas, assuntos críticos, consistência e metas.
Considere que o usuário tem tempo limitado e precisa de ações executáveis.

DADOS DO ESTUDANTE:

Nome:
${dados.nomeUsuario}

Concurso:
${dados.concurso}

Banca:
${dados.banca}

Índice geral:
${dados.indiceGeral}%

Aproveitamento geral:
${dados.aproveitamentoGeral}%

Tempo estudado nos últimos 7 dias:
${dados.minutosSemana} minutos

Dias ativos nos últimos 7 dias:
${dados.diasAtivosSemana}

Questões registradas:
${dados.totalQuestoes}

Revisões atrasadas:
${dados.revisoesAtrasadas}

Revisões pendentes:
${dados.revisoesPendentes}

Metas diárias:
- ${dados.metas.minutosDia} minutos
- ${dados.metas.questoesDia} questões
- ${dados.metas.revisoesDia} revisões

DESEMPENHO POR MATÉRIA:
${JSON.stringify(dados.materias, null, 2)}

ASSUNTOS CRÍTICOS:
${JSON.stringify(dados.assuntosCriticos, null, 2)}

Retorne SOMENTE JSON válido no formato:

{
  "resumo": "diagnóstico direto em até 3 frases",
  "alertaPrincipal": "principal risco atual",
  "focoDoDia": "objetivo central de hoje",
  "tempoTotalMinutos": 90,
  "mensagemFinal": "frase curta, específica e útil",
  "acoes": [
    {
      "ordem": 1,
      "prioridade": "alta",
      "titulo": "nome da ação",
      "motivo": "justificativa baseada nos dados",
      "duracaoMinutos": 25,
      "quantidadeQuestoes": 10,
      "tipo": "revisao",
      "materia": "nome da matéria",
      "assunto": "nome do assunto"
    }
  ]
}

Regras:
- gere de 3 a 5 ações;
- a soma das durações deve ser realista;
- use prioridade apenas "alta", "media" ou "baixa";
- use tipo apenas "teoria", "questoes", "revisao", "simulado" ou "misto";
- quantidadeQuestoes pode ser 0;
- não use markdown;
- não use crases;
- não escreva nada fora do JSON.
`;
}

function normalizarDiagnostico(
  diagnostico:
    DiagnosticoCoachIA
): DiagnosticoCoachIA {
  const acoes =
    Array.isArray(
      diagnostico.acoes
    )
      ? diagnostico.acoes
          .slice(0, 5)
          .map(
            (
              acao,
              indice
            ) => ({
              ordem:
                indice + 1,

              prioridade:
                acao.prioridade ===
                  "alta" ||
                acao.prioridade ===
                  "media" ||
                acao.prioridade ===
                  "baixa"
                  ? acao.prioridade
                  : "media",

              titulo:
                textoSeguro(
                  acao.titulo,
                  `Ação ${indice + 1}`
                ),

              motivo:
                textoSeguro(
                  acao.motivo,
                  "Ação recomendada com base nos dados atuais."
                ),

              duracaoMinutos:
                Math.max(
                  0,
                  Math.round(
                    numeroSeguro(
                      acao.duracaoMinutos
                    )
                  )
                ),

              quantidadeQuestoes:
                Math.max(
                  0,
                  Math.round(
                    numeroSeguro(
                      acao.quantidadeQuestoes
                    )
                  )
                ),

              tipo:
                normalizarTipo(
                  acao.tipo
                ),

              materia:
                acao.materia
                  ? textoSeguro(
                      acao.materia,
                      ""
                    )
                  : undefined,

              assunto:
                acao.assunto
                  ? textoSeguro(
                      acao.assunto,
                      ""
                    )
                  : undefined,
            })
          )
      : [];

  return {
    resumo:
      textoSeguro(
        diagnostico.resumo,
        "Diagnóstico gerado com base nos dados atuais."
      ),

    alertaPrincipal:
      textoSeguro(
        diagnostico.alertaPrincipal,
        "Não há alerta crítico identificado."
      ),

    focoDoDia:
      textoSeguro(
        diagnostico.focoDoDia,
        "Executar o plano recomendado."
      ),

    tempoTotalMinutos:
      Math.max(
        0,
        Math.round(
          numeroSeguro(
            diagnostico.tempoTotalMinutos
          )
        )
      ),

    mensagemFinal:
      textoSeguro(
        diagnostico.mensagemFinal,
        "Execute a primeira ação antes de adicionar novas tarefas."
      ),

    acoes,
  };
}

function normalizarTipo(
  valor: unknown
):
  | "teoria"
  | "questoes"
  | "revisao"
  | "simulado"
  | "misto" {
  return valor === "teoria" ||
    valor === "questoes" ||
    valor === "revisao" ||
    valor === "simulado" ||
    valor === "misto"
    ? valor
    : "misto";
}

function limparJson(
  texto: string
) {
  return texto
    .replace(
      /```json/gi,
      ""
    )
    .replace(
      /```/g,
      ""
    )
    .trim();
}

function textoSeguro(
  valor: unknown,
  padrao: string
) {
  return typeof valor ===
      "string" &&
    valor.trim()
    ? valor.trim()
    : padrao;
}

function numeroSeguro(
  valor: unknown
) {
  const numero =
    Number(valor);

  return Number.isFinite(
    numero
  )
    ? numero
    : 0;
}
