import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import "./ResolverSimuladoIA.css";

import type {
  QuestaoIA,
} from "../../types/index";

type LetraAlternativa =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E";

type RespostasUsuario = Record<
  string,
  LetraAlternativa
>;

type ResultadoSimuladoIA = {
  id: string;
  nome: string;
  data: string;

  total: number;
  certas: number;
  erradas: number;
  emBranco: number;
  percentual: number;

  respostas: RespostasUsuario;
  questoes: QuestaoIA[];
};

type DiagnosticoAssunto = {
  chave: string;
  materia: string;
  assunto: string;

  total: number;
  certas: number;
  erradas: number;
  emBranco: number;
  percentual: number;
};

type RevisaoIA = {
  id: string;
  materia: string;
  assunto: string;
  origem: "simulado-ia";
  criadaEm: string;
  concluida: boolean;
};

const CHAVE_QUESTOES_IA =
  "pmpe_questoes_ia";

const CHAVE_RESULTADOS_IA =
  "pmpe_resultados_simulados_ia";

const CHAVE_REVISOES_IA =
  "pmpe_revisoes_ia";

export default function ResolverSimuladoIA() {
  const navigate = useNavigate();

  const [questoes, setQuestoes] =
    useState<QuestaoIA[]>([]);

  const [
    respostas,
    setRespostas,
  ] = useState<RespostasUsuario>({});

  const [
    questaoAtual,
    setQuestaoAtual,
  ] = useState(0);

  const [
    finalizado,
    setFinalizado,
  ] = useState(false);

  const [
    carregando,
    setCarregando,
  ] = useState(true);

  const [
    mensagem,
    setMensagem,
  ] = useState("");

  useEffect(() => {
    carregarQuestoes();
  }, []);

  const resultado = useMemo(() => {
    if (!finalizado) {
      return {
        certas: 0,
        erradas: 0,
        emBranco: 0,
        percentual: 0,
      };
    }

    return calcularResultado(
      questoes,
      respostas
    );
  }, [
    finalizado,
    questoes,
    respostas,
  ]);

  const diagnostico = useMemo(
    () =>
      finalizado
        ? calcularDiagnostico(
            questoes,
            respostas
          )
        : [],
    [
      finalizado,
      questoes,
      respostas,
    ]
  );

  const assuntosCriticos =
    diagnostico.filter(
      (item) =>
        item.erradas > 0 ||
        item.emBranco > 0
    );

  const questao =
    questoes[questaoAtual];

  const totalRespondidas =
    Object.keys(respostas).length;

  const percentualRespondido =
    questoes.length === 0
      ? 0
      : Math.round(
          (totalRespondidas /
            questoes.length) *
            100
        );

  function carregarQuestoes() {
    const salvo =
      localStorage.getItem(
        CHAVE_QUESTOES_IA
      );

    if (!salvo) {
      setQuestoes([]);
      setCarregando(false);
      return;
    }

    try {
      const valor: unknown =
        JSON.parse(salvo);

      setQuestoes(
        Array.isArray(valor)
          ? (valor as QuestaoIA[])
          : []
      );
    } catch {
      setQuestoes([]);
    } finally {
      setCarregando(false);
    }
  }

  function responder(
    questaoId: string,
    letra: LetraAlternativa
  ) {
    if (finalizado) {
      return;
    }

    setRespostas(
      (anteriores) => ({
        ...anteriores,
        [questaoId]: letra,
      })
    );
  }

  function avancar() {
    if (
      questaoAtual <
      questoes.length - 1
    ) {
      setQuestaoAtual(
        (atual) => atual + 1
      );
    }
  }

  function voltar() {
    if (questaoAtual > 0) {
      setQuestaoAtual(
        (atual) => atual - 1
      );
    }
  }

  function irParaQuestao(
    indice: number
  ) {
    setQuestaoAtual(indice);
  }

  function finalizarSimulado() {
    if (
      totalRespondidas <
      questoes.length
    ) {
      const faltam =
        questoes.length -
        totalRespondidas;

      const confirmar =
        window.confirm(
          `Ainda faltam ${faltam} questão${
            faltam === 1 ? "" : "ões"
          }. Deseja finalizar mesmo assim?`
        );

      if (!confirmar) {
        return;
      }
    }

    const novoResultado =
      montarResultadoSalvo(
        questoes,
        respostas
      );

    salvarResultado(
      novoResultado
    );

    setFinalizado(true);
    setMensagem(
      "Simulado finalizado e salvo nas Estatísticas IA."
    );
  }

  function salvarResultado(
    novoResultado:
      ResultadoSimuladoIA
  ) {
    const salvo =
      localStorage.getItem(
        CHAVE_RESULTADOS_IA
      );

    let resultados:
      ResultadoSimuladoIA[] = [];

    if (salvo) {
      try {
        const valor: unknown =
          JSON.parse(salvo);

        if (Array.isArray(valor)) {
          resultados =
            valor as ResultadoSimuladoIA[];
        }
      } catch {
        resultados = [];
      }
    }

    localStorage.setItem(
      CHAVE_RESULTADOS_IA,
      JSON.stringify([
        novoResultado,
        ...resultados,
      ])
    );

    window.dispatchEvent(
      new Event(
        "pmpe-simulado-ia-finalizado"
      )
    );
  }

  function refazerSimulado() {
    setRespostas({});
    setQuestaoAtual(0);
    setFinalizado(false);
    setMensagem("");
  }

  function treinarErros() {
    const questoesParaTreino =
      questoes.filter(
        (item) =>
          respostas[item.id] !==
          item.respostaCorreta
      );

    if (
      questoesParaTreino.length === 0
    ) {
      setMensagem(
        "Você não possui questões erradas ou em branco."
      );

      return;
    }

    const novasQuestoes =
      questoesParaTreino.map(
        (item) => ({
          ...item,
          id: crypto.randomUUID(),
        })
      );

    localStorage.setItem(
      CHAVE_QUESTOES_IA,
      JSON.stringify(
        novasQuestoes
      )
    );

    setQuestoes(
      novasQuestoes
    );

    setRespostas({});
    setQuestaoAtual(0);
    setFinalizado(false);

    setMensagem(
      `Treino criado com ${novasQuestoes.length} questão${
        novasQuestoes.length === 1
          ? ""
          : "ões"
      }.`
    );
  }

  function criarRevisoes() {
    if (
      assuntosCriticos.length === 0
    ) {
      setMensagem(
        "Não há assuntos com erro para revisar."
      );

      return;
    }

    const revisoesAtuais =
      carregarRevisoesIA();

    const chavesAtuais =
      new Set(
        revisoesAtuais.map(
          (revisao) =>
            normalizar(
              `${revisao.materia}::${revisao.modulo || "Geral"}::${revisao.assunto}`
            )
        )
      );

    const novasRevisoes:
      RevisaoIA[] = [];

    assuntosCriticos.forEach(
      (item) => {
        const chave =
          normalizar(
            `${item.materia}::${item.modulo || "Geral"}::${item.assunto}`
          );

        if (
          chavesAtuais.has(chave)
        ) {
          return;
        }

        novasRevisoes.push({
          id: crypto.randomUUID(),
          materia: item.materia,
          modulo: item.modulo,
          moduloId: item.moduloId,
          assunto: item.assunto,
          origem: "simulado-ia",
          criadaEm:
            new Date().toISOString(),
          concluida: false,
        });

        chavesAtuais.add(chave);
      }
    );

    localStorage.setItem(
      CHAVE_REVISOES_IA,
      JSON.stringify([
        ...novasRevisoes,
        ...revisoesAtuais,
      ])
    );

    window.dispatchEvent(
      new Event(
        "pmpe-revisoes-ia-atualizadas"
      )
    );

    setMensagem(
      novasRevisoes.length > 0
        ? `${novasRevisoes.length} revisão${
            novasRevisoes.length === 1
              ? ""
              : "ões"
          } criada${
            novasRevisoes.length === 1
              ? ""
              : "s"
          }.`
        : "Esses assuntos já estavam na fila de revisões."
    );
  }

  function abrirMateriais(
    item?: DiagnosticoAssunto
  ) {
    if (item) {
      localStorage.setItem(
        "pmpe_filtro_materiais",
        JSON.stringify({
          materia: item.materia,
          modulo: item.modulo,
          assunto: item.assunto,
        })
      );
    }

    navigate("/materiais");
  }

  function excluirQuestoes() {
    const confirmar =
      window.confirm(
        "Deseja excluir as questões geradas por IA?"
      );

    if (!confirmar) {
      return;
    }

    localStorage.removeItem(
      CHAVE_QUESTOES_IA
    );

    setQuestoes([]);
    setRespostas({});
    setFinalizado(false);
    setMensagem("");
  }

  if (carregando) {
    return (
      <section className="resolver-ia-container">
        <div className="resolver-ia-vazio">
          Carregando questões...
        </div>
      </section>
    );
  }

  if (questoes.length === 0) {
    return (
      <section className="resolver-ia-container">
        <div className="resolver-ia-vazio">
          <h1>
            Nenhuma questão gerada
          </h1>

          <p>
            Gere questões com o Gemini
            antes de iniciar o simulado.
          </p>

          <button
            type="button"
            onClick={() =>
              navigate(
                "/gerar-simulado-ia"
              )
            }
          >
            Gerar Simulado IA
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="resolver-ia-container">
      <div className="resolver-ia-cabecalho">
        <div>
          <h1>
            🤖 Simulado Inteligente
          </h1>

          <p>
            Questões inéditas geradas
            pelo Gemini.
          </p>
        </div>

        <div className="resolver-ia-status">
          <span>
            Respondidas
          </span>

          <strong>
            {totalRespondidas}/
            {questoes.length}
          </strong>
        </div>
      </div>

      {mensagem && (
        <div className="resolver-ia-mensagem">
          {mensagem}
        </div>
      )}

      {!finalizado && (
        <div className="resolver-ia-progresso">
          <div
            style={{
              width:
                `${percentualRespondido}%`,
            }}
          />
        </div>
      )}

      {finalizado && (
        <>
          <div className="resolver-ia-resultado resolver-ia-resultado-cinco">
            <div>
              <span>
                Resultado
              </span>

              <strong>
                {resultado.percentual}%
              </strong>
            </div>

            <div>
              <span>
                Acertos
              </span>

              <strong className="resolver-ia-certas">
                {resultado.certas}
              </strong>
            </div>

            <div>
              <span>
                Erros
              </span>

              <strong className="resolver-ia-erradas">
                {resultado.erradas}
              </strong>
            </div>

            <div>
              <span>
                Em branco
              </span>

              <strong className="resolver-ia-branco">
                {resultado.emBranco}
              </strong>
            </div>

            <div>
              <span>
                Total
              </span>

              <strong>
                {questoes.length}
              </strong>
            </div>
          </div>

          <section className="resolver-ia-diagnostico">
            <div className="resolver-ia-diagnostico-topo">
              <div>
                <span>
                  DIAGNÓSTICO
                </span>

                <h2>
                  Desempenho por assunto
                </h2>

                <p>
                  Os assuntos com menor
                  aproveitamento aparecem
                  primeiro.
                </p>
              </div>

              <div className="resolver-ia-diagnostico-acoes">
                <button
                  type="button"
                  className="resolver-ia-revisar"
                  onClick={
                    criarRevisoes
                  }
                >
                  🔁 Criar revisões
                </button>

                <button
                  type="button"
                  className="resolver-ia-treinar"
                  onClick={
                    treinarErros
                  }
                >
                  🎯 Treinar erros
                </button>

                <button
                  type="button"
                  className="resolver-ia-materiais"
                  onClick={() =>
                    abrirMateriais()
                  }
                >
                  📚 Centro de Materiais
                </button>
              </div>
            </div>

            <div className="resolver-ia-diagnostico-grid">
              {diagnostico.map(
                (item) => (
                  <article
                    key={item.chave}
                    className={[
                      "resolver-ia-diagnostico-card",

                      item.percentual >= 70
                        ? "bom"
                        : item.percentual < 50
                          ? "fraco"
                          : "medio",
                    ].join(" ")}
                  >
                    <div className="resolver-ia-diagnostico-conteudo">
                      <strong>
                        {item.materia}
                      </strong>

                      <span>
                        {item.assunto}
                      </span>

                      <div className="resolver-ia-diagnostico-barra">
                        <div
                          style={{
                            width: `${item.percentual}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="resolver-ia-diagnostico-numeros">
                      <strong>
                        {item.percentual}%
                      </strong>

                      <span>
                        {item.certas} certas
                        {" • "}
                        {item.erradas} erros
                        {" • "}
                        {item.emBranco} em branco
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          abrirMateriais(item)
                        }
                      >
                        Abrir materiais
                      </button>
                    </div>
                  </article>
                )
              )}
            </div>
          </section>
        </>
      )}

      <div className="resolver-ia-layout">
        <aside className="resolver-ia-navegacao">
          <h2>
            Questões
          </h2>

          <div className="resolver-ia-numeros">
            {questoes.map(
              (
                item,
                indice
              ) => {
                const respondida =
                  Boolean(
                    respostas[item.id]
                  );

                const correta =
                  finalizado &&
                  respostas[item.id] ===
                    item.respostaCorreta;

                const emBranco =
                  finalizado &&
                  !respostas[item.id];

                const errada =
                  finalizado &&
                  Boolean(
                    respostas[item.id]
                  ) &&
                  respostas[item.id] !==
                    item.respostaCorreta;

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={[
                      questaoAtual ===
                      indice
                        ? "ativa"
                        : "",

                      respondida &&
                      !finalizado
                        ? "respondida"
                        : "",

                      correta
                        ? "correta"
                        : "",

                      errada
                        ? "errada"
                        : "",

                      emBranco
                        ? "em-branco"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() =>
                      irParaQuestao(
                        indice
                      )
                    }
                  >
                    {indice + 1}
                  </button>
                );
              }
            )}
          </div>

          <div className="resolver-ia-legenda">
            <span>
              <i className="legenda-atual" />
              Atual
            </span>

            <span>
              <i className="legenda-respondida" />
              Respondida
            </span>

            {finalizado && (
              <>
                <span>
                  <i className="legenda-correta" />
                  Correta
                </span>

                <span>
                  <i className="legenda-errada" />
                  Errada
                </span>

                <span>
                  <i className="legenda-branco" />
                  Em branco
                </span>
              </>
            )}
          </div>
        </aside>

        <main className="resolver-ia-questao-card">
          <div className="resolver-ia-questao-topo">
            <span>
              Questão{" "}
              {questaoAtual + 1}
              de {questoes.length}
            </span>

            <div>
              <span>
                {questao.materia}
              </span>

              <span>
                {questao.dificuldade}
              </span>

              <span>
                {questao.banca}
              </span>
            </div>
          </div>

          <p className="resolver-ia-assunto">
            {questao.assunto}
          </p>

          <h2 className="resolver-ia-enunciado">
            {questao.enunciado}
          </h2>

          <div className="resolver-ia-alternativas">
            {(
              Object.entries(
                questao.alternativas
              ) as [
                LetraAlternativa,
                string
              ][]
            ).map(
              ([
                letra,
                texto,
              ]) => {
                const selecionada =
                  respostas[
                    questao.id
                  ] === letra;

                const alternativaCorreta =
                  finalizado &&
                  letra ===
                    questao.respostaCorreta;

                const alternativaErrada =
                  finalizado &&
                  selecionada &&
                  letra !==
                    questao.respostaCorreta;

                return (
                  <button
                    key={letra}
                    type="button"
                    disabled={finalizado}
                    className={[
                      "resolver-ia-alternativa",

                      selecionada
                        ? "selecionada"
                        : "",

                      alternativaCorreta
                        ? "alternativa-correta"
                        : "",

                      alternativaErrada
                        ? "alternativa-errada"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() =>
                      responder(
                        questao.id,
                        letra
                      )
                    }
                  >
                    <strong>
                      {letra}
                    </strong>

                    <span>
                      {texto}
                    </span>
                  </button>
                );
              }
            )}
          </div>

          {finalizado && (
            <div className="resolver-ia-explicacao">
              <h3>
                Explicação
              </h3>

              <p>
                {
                  questao.explicacao
                }
              </p>

              <strong>
                Gabarito:{" "}
                {
                  questao.respostaCorreta
                }
              </strong>
            </div>
          )}

          <div className="resolver-ia-acoes">
            <button
              type="button"
              onClick={voltar}
              disabled={
                questaoAtual === 0
              }
              className="resolver-ia-secundario"
            >
              ← Anterior
            </button>

            {questaoAtual <
            questoes.length - 1 ? (
              <button
                type="button"
                onClick={avancar}
                className="resolver-ia-primario"
              >
                Próxima →
              </button>
            ) : !finalizado ? (
              <button
                type="button"
                onClick={
                  finalizarSimulado
                }
                className="resolver-ia-finalizar"
              >
                Finalizar simulado
              </button>
            ) : (
              <button
                type="button"
                onClick={refazerSimulado}
                className="resolver-ia-primario"
              >
                Refazer simulado
              </button>
            )}
          </div>
        </main>
      </div>

      <div className="resolver-ia-rodape">
        {!finalizado && (
          <button
            type="button"
            onClick={
              finalizarSimulado
            }
            className="resolver-ia-finalizar"
          >
            Finalizar agora
          </button>
        )}

        <button
          type="button"
          onClick={
            excluirQuestoes
          }
          className="resolver-ia-excluir"
        >
          Excluir questões
        </button>
      </div>
    </section>
  );
}

function calcularResultado(
  questoes: QuestaoIA[],
  respostas: RespostasUsuario
) {
  const certas =
    questoes.filter(
      (questao) =>
        respostas[questao.id] ===
        questao.respostaCorreta
    ).length;

  const emBranco =
    questoes.filter(
      (questao) =>
        !respostas[questao.id]
    ).length;

  const erradas =
    questoes.length -
    certas -
    emBranco;

  const percentual =
    questoes.length === 0
      ? 0
      : Math.round(
          (certas /
            questoes.length) *
            100
        );

  return {
    certas,
    erradas,
    emBranco,
    percentual,
  };
}

function montarResultadoSalvo(
  questoes: QuestaoIA[],
  respostas: RespostasUsuario
): ResultadoSimuladoIA {
  const resultado =
    calcularResultado(
      questoes,
      respostas
    );

  return {
    id: crypto.randomUUID(),
    nome: "Simulado gerado por IA",
    data:
      new Date().toISOString(),
    total: questoes.length,
    certas:
      resultado.certas,
    erradas:
      resultado.erradas,
    emBranco:
      resultado.emBranco,
    percentual:
      resultado.percentual,
    respostas,
    questoes,
  };
}

function calcularDiagnostico(
  questoes: QuestaoIA[],
  respostas: RespostasUsuario
): DiagnosticoAssunto[] {
  const mapa =
    new Map<
      string,
      Omit<
        DiagnosticoAssunto,
        "percentual"
      >
    >();

  questoes.forEach(
    (questao) => {
      const materia =
        questao.materia ||
        "Sem matéria";

      const assunto =
        questao.assunto ||
        "Sem assunto";

      const chave =
        normalizar(
          `${materia}::${assunto}`
        );

      const atual =
        mapa.get(chave) ?? {
          chave,
          materia,
          assunto,
          total: 0,
          certas: 0,
          erradas: 0,
          emBranco: 0,
        };

      const resposta =
        respostas[questao.id];

      const acertou =
        resposta ===
        questao.respostaCorreta;

      mapa.set(chave, {
        ...atual,

        total:
          atual.total + 1,

        certas:
          atual.certas +
          (acertou ? 1 : 0),

        erradas:
          atual.erradas +
          (
            resposta &&
            !acertou
              ? 1
              : 0
          ),

        emBranco:
          atual.emBranco +
          (!resposta ? 1 : 0),
      });
    }
  );

  return Array.from(
    mapa.values()
  )
    .map((item) => ({
      ...item,

      percentual:
        item.total === 0
          ? 0
          : Math.round(
              (item.certas /
                item.total) *
                100
            ),
    }))
    .sort(
      (a, b) =>
        a.percentual -
        b.percentual
    );
}

function carregarRevisoesIA():
  RevisaoIA[] {
  const salvo =
    localStorage.getItem(
      CHAVE_REVISOES_IA
    );

  if (!salvo) {
    return [];
  }

  try {
    const valor: unknown =
      JSON.parse(salvo);

    return Array.isArray(valor)
      ? (valor as RevisaoIA[])
      : [];
  } catch {
    return [];
  }
}

function normalizar(
  texto: string
) {
  return texto
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}