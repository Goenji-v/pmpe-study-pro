import "dotenv/config";
import cors from "cors";
import express from "express";
import { GoogleGenAI } from "@google/genai";

const app = express();

const PORT = Number(
  process.env.PORT || 3001
);

const modelo =
  process.env.GEMINI_MODEL ||
  "gemini-3.1-flash-lite";

const apiKey =
  process.env.GEMINI_API_KEY;

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
    limit: "2mb",
  })
);

app.get(
  "/api/saude",
  (_req, res) => {
    res.json({
      ok: true,
      modelo,
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
      } = req.body;

      const resposta =
        await ai.models.generateContent({
          model: modelo,

          contents: `
Você é um especialista em concursos públicos brasileiros.

Crie exatamente ${quantidade} questões.

Matéria:
${assunto}

Banca:
${banca}

Retorne SOMENTE um JSON válido.

Formato obrigatório:

[
  {
    "id": "1",
    "materia": "Português",
    "assunto": "Crase",
    "banca": "AOCP",
    "dificuldade": "Média",
    "enunciado": "texto",
    "alternativas": {
      "A": "texto",
      "B": "texto",
      "C": "texto",
      "D": "texto",
      "E": "texto"
    },
    "respostaCorreta": "A",
    "explicacao": "texto"
  }
]

Regras:
- não escreva markdown;
- não escreva blocos com crases;
- não escreva comentários;
- retorne apenas o JSON;
- use exatamente cinco alternativas;
- use apenas uma resposta correta.
`,
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
