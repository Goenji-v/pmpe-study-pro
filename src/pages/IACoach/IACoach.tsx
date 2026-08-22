import {
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import "./IACoach.css";

import {
  useApp,
} from "../../context/AppContext";

import {
  carregarUltimoDiagnostico,
  gerarDiagnosticoCoach,
  type DiagnosticoCoachIA,
} from "../../services/iaCoachService";

type ResultadoIA = {
  id?: string;
  tipo?: "questoes" | "simulado";
  data?: string;
  certas?: number;
  erradas?: number;
  emBranco?: number;
  questoes?: Array<{
    materia?: string;
    assunto?: string;
    respostaCorreta?: string;
    id?: string;
  }>;
  respostas?: Record<
    string,
    string
  >;
};

type DiagnosticoMateria = {
  materia: string;
  certas: number;
  erradas: number;
  total: number;
  percentual: number;
  minutos: number;
  diasSemEstudar: number;
};

type DiagnosticoAssunto = {
  chave: string;
  materia: string;
  assunto: string;
  erros: number;
  acertos: number;
  total: number;
  percentual: number;
};

type RecomendacaoCoach = {
  prioridade:
    | "alta"
    | "media"
    | "baixa";

  titulo: string;
  descricao: string;
  acao: string;
};

const CHAVE_RESULTADOS_IA =
  "pmpe_resultados_simulados_ia";

const CHAVE_FILTRO_MATERIAIS =
  "pmpe_filtro_materiais";

export default function IACoach() {
  const navigate =
    useNavigate();

  const {
    questoes,
    sessoes,
    revisoes,
    simulados,
    configuracoes,
  } = useApp();

  const [
    diagnosticoIA,
    setDiagnosticoIA,
  ] =
    useState<
      DiagnosticoCoachIA | null
    >(
      carregarUltimoDiagnostico
    );

  const [
    gerandoIA,
    setGerandoIA,
  ] = useState(false);

  const [
    erroIA,
    setErroIA,
  ] = useState("");

  const dados = useMemo(
    () =>
      calcularCoach({
        questoes,
        sessoes,
        revisoes,
        simulados,
      }),
    [
      questoes,
      sessoes,
      revisoes,
      simulados,
    ]
  );

  async function gerarAnaliseIA() {
    if (gerandoIA) {
      return;
    }

    try {
      setGerandoIA(true);
      setErroIA("");

      const resultado =
        await gerarDiagnosticoCoach({
          nomeUsuario:
            configuracoes.nomeUsuario,

          concurso:
            configuracoes.concurso,

          banca:
            configuracoes.bancaPadrao,

          indiceGeral:
            dados.indiceGeral,

          aproveitamentoGeral:
            dados.aproveitamentoGeral,

          minutosSemana:
            dados.minutosSemana,

          diasAtivosSemana:
            dados.diasAtivosSemana,

          revisoesAtrasadas:
            dados.revisoesAtrasadas,

          revisoesPendentes:
            dados.revisoesPendentes,

          totalQuestoes:
            dados.totalQuestoes,

          materias:
            dados.materias.map(
              (item) => ({
                materia:
                  item.materia,

                percentual:
                  item.percentual,

                certas:
                  item.certas,

                erradas:
                  item.erradas,

                total:
                  item.total,

                minutos:
                  item.minutos,

                diasSemEstudar:
                  item.diasSemEstudar,
              })
            ),

          assuntosCriticos:
            dados.assuntosCriticos.map(
              (item) => ({
                materia:
                  item.materia,

                assunto:
                  item.assunto,

                percentual:
                  item.percentual,

                erros:
                  item.erros,

                total:
                  item.total,
              })
            ),

          metas: {
            minutosDia:
              configuracoes.metaMinutosDiaria,

            questoesDia:
              configuracoes.metaQuestoesDiaria,

            revisoesDia:
              configuracoes.metaRevisoesDiaria,
          },
        });

      setDiagnosticoIA(
        resultado
      );
    } catch (erro) {
      setErroIA(
        erro instanceof Error
          ? erro.message
          : "Erro ao gerar análise com IA."
      );
    } finally {
      setGerandoIA(false);
    }
  }

  function abrirMateriais(
    materia: string,
    assunto = ""
  ) {
    localStorage.setItem(
      CHAVE_FILTRO_MATERIAIS,
      JSON.stringify({
        materia,
        assunto,
      })
    );

    navigate("/materiais");
  }

  function abrirRevisoes() {
    navigate("/revisoes");
  }

  function abrirQuestoes() {
    navigate(
      "/gerar-simulado-ia"
    );
  }

  return (
    <section className="coach-container">
      <div className="coach-cabecalho">
        <div>
          <span className="coach-etiqueta">
            ANÁLISE AUTOMÁTICA
          </span>

          <h1>
            🤖 IA Coach
          </h1>

          <p>
            Diagnóstico baseado nas suas
            sessões, questões, simulados e
            revisões.
          </p>
        </div>

        <div className="coach-pontuacao">
          <span>
            Índice atual
          </span>

          <strong>
            {dados.indiceGeral}%
          </strong>

          <small>
            {classificarIndice(
              dados.indiceGeral
            )}
          </small>
        </div>
      </div>

      <section className="coach-painel coach-painel-ia">
        <div className="coach-ia-topo">
          <div>
            <span className="coach-etiqueta">
              GEMINI
            </span>

            <h2>
              Diagnóstico estratégico
            </h2>

            <p>
              A IA interpreta seus dados e
              monta um plano executável para
              hoje.
            </p>
          </div>

          <button
            type="button"
            className="coach-botao-primario"
            onClick={gerarAnaliseIA}
            disabled={gerandoIA}
          >
            {gerandoIA
              ? "Analisando..."
              : diagnosticoIA
                ? "Atualizar análise"
                : "Gerar análise com IA"}
          </button>
        </div>

        {erroIA && (
          <div className="coach-ia-erro">
            {erroIA}
          </div>
        )}

        {diagnosticoIA ? (
          <div className="coach-ia-conteudo">
            <div className="coach-ia-resumo">
              <div>
                <span>
                  Resumo
                </span>

                <p>
                  {
                    diagnosticoIA.resumo
                  }
                </p>
              </div>

              <div>
                <span>
                  Alerta principal
                </span>

                <p>
                  {
                    diagnosticoIA.alertaPrincipal
                  }
                </p>
              </div>

              <div>
                <span>
                  Foco do dia
                </span>

                <p>
                  {
                    diagnosticoIA.focoDoDia
                  }
                </p>
              </div>

              <div>
                <span>
                  Tempo total
                </span>

                <strong>
                  {formatarMinutos(
                    diagnosticoIA.tempoTotalMinutos
                  )}
                </strong>
              </div>
            </div>

            <div className="coach-ia-acoes">
              {diagnosticoIA.acoes.map(
                (acao) => (
                  <article
                    key={`${acao.ordem}-${acao.titulo}`}
                    className={`coach-ia-acao coach-${acao.prioridade}`}
                  >
                    <div className="coach-recomendacao-numero">
                      {acao.ordem}
                    </div>

                    <div>
                      <div className="coach-ia-acao-topo">
                        <strong>
                          {acao.titulo}
                        </strong>

                        <span>
                          {formatarTipoAcao(
                            acao.tipo
                          )}
                        </span>
                      </div>

                      <p>
                        {acao.motivo}
                      </p>

                      <small>
                        {acao.duracaoMinutos} min
                        {acao.quantidadeQuestoes > 0
                          ? ` • ${acao.quantidadeQuestoes} questões`
                          : ""}
                        {acao.materia
                          ? ` • ${acao.materia}`
                          : ""}
                        {acao.assunto
                          ? ` — ${acao.assunto}`
                          : ""}
                      </small>
                    </div>
                  </article>
                )
              )}
            </div>

            <div className="coach-ia-final">
              {
                diagnosticoIA.mensagemFinal
              }
            </div>
          </div>
        ) : (
          <div className="coach-vazio">
            Gere a primeira análise para
            receber um plano diário baseado
            nos seus dados reais.
          </div>
        )}
      </section>

      <div className="coach-resumo">
        <ResumoCard
          titulo="Tempo na semana"
          valor={formatarMinutos(
            dados.minutosSemana
          )}
          detalhe={`${dados.sessoesSemana} sessões`}
        />

        <ResumoCard
          titulo="Questões respondidas"
          valor={String(
            dados.totalQuestoes
          )}
          detalhe={`${dados.aproveitamentoGeral}% de aproveitamento`}
        />

        <ResumoCard
          titulo="Revisões atrasadas"
          valor={String(
            dados.revisoesAtrasadas
          )}
          detalhe={
            dados.revisoesAtrasadas > 0
              ? "Prioridade imediata"
              : "Nenhuma pendência crítica"
          }
        />

        <ResumoCard
          titulo="Dias ativos"
          valor={String(
            dados.diasAtivosSemana
          )}
          detalhe="Nos últimos 7 dias"
        />
      </div>

      <div className="coach-grid">
        <section className="coach-painel">
          <div className="coach-painel-topo">
            <div>
              <h2>
                🎯 Plano recomendado
              </h2>

              <p>
                Ordem de execução com base
                nos seus dados atuais.
              </p>
            </div>
          </div>

          <div className="coach-recomendacoes">
            {dados.recomendacoes.map(
              (
                recomendacao,
                indice
              ) => (
                <article
                  key={`${recomendacao.titulo}-${indice}`}
                  className={`coach-recomendacao coach-${recomendacao.prioridade}`}
                >
                  <div className="coach-recomendacao-numero">
                    {indice + 1}
                  </div>

                  <div className="coach-recomendacao-conteudo">
                    <div>
                      <strong>
                        {
                          recomendacao.titulo
                        }
                      </strong>

                      <span>
                        {
                          recomendacao.prioridade ===
                          "alta"
                            ? "Prioridade alta"
                            : recomendacao.prioridade ===
                                "media"
                              ? "Prioridade média"
                              : "Prioridade baixa"
                        }
                      </span>
                    </div>

                    <p>
                      {
                        recomendacao.descricao
                      }
                    </p>

                    <small>
                      Ação recomendada:{" "}
                      {
                        recomendacao.acao
                      }
                    </small>
                  </div>
                </article>
              )
            )}
          </div>

          <div className="coach-acoes">
            <button
              type="button"
              onClick={
                abrirRevisoes
              }
              className="coach-botao-secundario"
            >
              🔁 Abrir revisões
            </button>

            <button
              type="button"
              onClick={
                abrirQuestoes
              }
              className="coach-botao-primario"
            >
              🤖 Gerar treino IA
            </button>
          </div>
        </section>

        <section className="coach-painel">
          <div className="coach-painel-topo">
            <div>
              <h2>
                📊 Matérias
              </h2>

              <p>
                Desempenho combinado de
                questões e tempo estudado.
              </p>
            </div>
          </div>

          {dados.materias.length ===
          0 ? (
            <div className="coach-vazio">
              Ainda não há dados suficientes.
            </div>
          ) : (
            <div className="coach-materias">
              {dados.materias.map(
                (item) => (
                  <article
                    key={
                      item.materia
                    }
                    className="coach-materia"
                  >
                    <div className="coach-materia-topo">
                      <div>
                        <strong>
                          {
                            item.materia
                          }
                        </strong>

                        <span>
                          {item.total} questões
                          {" • "}
                          {formatarMinutos(
                            item.minutos
                          )}
                          {" • "}
                          {formatarDiasSemEstudar(
                            item.diasSemEstudar
                          )}
                        </span>
                      </div>

                      <strong
                        className={
                          item.percentual >=
                          70
                            ? "coach-positivo"
                            : item.percentual <
                                50
                              ? "coach-negativo"
                              : "coach-medio"
                        }
                      >
                        {
                          item.percentual
                        }
                        %
                      </strong>
                    </div>

                    <div className="coach-barra">
                      <div
                        style={{
                          width: `${item.percentual}%`,
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        abrirMateriais(
                          item.materia
                        )
                      }
                    >
                      Abrir materiais
                    </button>
                  </article>
                )
              )}
            </div>
          )}
        </section>
      </div>

      <div className="coach-grid">
        <section className="coach-painel">
          <div className="coach-painel-topo">
            <div>
              <h2>
                ⚠ Assuntos críticos
              </h2>

              <p>
                Conteúdos com maior risco de
                perda de pontos.
              </p>
            </div>
          </div>

          {dados.assuntosCriticos.length ===
          0 ? (
            <div className="coach-vazio">
              Nenhum assunto crítico foi
              identificado.
            </div>
          ) : (
            <div className="coach-assuntos">
              {dados.assuntosCriticos.map(
                (item) => (
                  <article
                    key={
                      item.chave
                    }
                  >
                    <div>
                      <strong>
                        {
                          item.assunto
                        }
                      </strong>

                      <span>
                        {
                          item.materia
                        }
                      </span>
                    </div>

                    <div>
                      <strong>
                        {
                          item.percentual
                        }
                        %
                      </strong>

                      <span>
                        {item.erros} erros
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        abrirMateriais(
                          item.materia,
                          item.assunto
                        )
                      }
                    >
                      Materiais
                    </button>
                  </article>
                )
              )}
            </div>
          )}
        </section>

        <section className="coach-painel">
          <div className="coach-painel-topo">
            <div>
              <h2>
                📈 Relatório da semana
              </h2>

              <p>
                Comparação entre esforço e
                desempenho.
              </p>
            </div>
          </div>

          <div className="coach-relatorio">
            <LinhaRelatorio
              titulo="Tempo estudado"
              valor={formatarMinutos(
                dados.minutosSemana
              )}
            />

            <LinhaRelatorio
              titulo="Média diária"
              valor={formatarMinutos(
                dados.mediaDiariaSemana
              )}
            />

            <LinhaRelatorio
              titulo="Aproveitamento"
              valor={`${dados.aproveitamentoGeral}%`}
            />

            <LinhaRelatorio
              titulo="Matéria mais forte"
              valor={
                dados.melhorMateria
                  ? `${dados.melhorMateria.materia} — ${dados.melhorMateria.percentual}%`
                  : "Sem dados"
              }
            />

            <LinhaRelatorio
              titulo="Matéria mais fraca"
              valor={
                dados.piorMateria
                  ? `${dados.piorMateria.materia} — ${dados.piorMateria.percentual}%`
                  : "Sem dados"
              }
            />

            <LinhaRelatorio
              titulo="Revisões pendentes"
              valor={String(
                dados.revisoesPendentes
              )}
            />
          </div>
        </section>
      </div>
    </section>
  );
}

function ResumoCard({
  titulo,
  valor,
  detalhe,
}: {
  titulo: string;
  valor: string;
  detalhe: string;
}) {
  return (
    <article className="coach-resumo-card">
      <span>{titulo}</span>
      <strong>{valor}</strong>
      <small>{detalhe}</small>
    </article>
  );
}

function LinhaRelatorio({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <div className="coach-relatorio-linha">
      <span>{titulo}</span>
      <strong>{valor}</strong>
    </div>
  );
}

function calcularCoach({
  questoes,
  sessoes,
  revisoes,
  simulados,
}: {
  questoes: any[];
  sessoes: any[];
  revisoes: any[];
  simulados: any[];
}) {
  const agora =
    new Date();

  const inicioSemana =
    adicionarDias(
      inicioDoDia(agora),
      -6
    );

  const sessoesSemana =
    sessoes.filter(
      (sessao) =>
        new Date(
          sessao.data
        ).getTime() >=
        inicioSemana.getTime()
    );

  const minutosSemana =
    sessoesSemana.reduce(
      (
        total,
        sessao
      ) =>
        total +
        (Number(
          sessao.minutos
        ) || 0),
      0
    );

  const diasAtivos =
    new Set(
      sessoesSemana.map(
        (sessao) =>
          obterDataLocal(
            new Date(
              sessao.data
            )
          )
      )
    );

  const diagnosticoMaterias =
    calcularMaterias(
      questoes,
      sessoes
    );

  const resultadosIA =
    carregarResultadosIA();

  const idsSimuladosRegistrados = new Set(
    simulados.flatMap((simulado) =>
      [simulado.id, simulado.tentativaId].filter(Boolean)
    )
  );
  const simuladosIAAindaNaoMigrados = resultadosIA.filter(
    (resultado) =>
      resultado.tipo !== "questoes" &&
      (!resultado.id || !idsSimuladosRegistrados.has(resultado.id))
  ).length;

  const assuntosCriticos =
    calcularAssuntosCriticos(
      resultadosIA
    );

  const totalQuestoes =
    questoes.reduce(
      (
        total,
        registro
      ) =>
        total +
        (Number(
          registro.certas
        ) || 0) +
        (Number(
          registro.erradas
        ) || 0),
      0
    );

  const totalCertas =
    questoes.reduce(
      (
        total,
        registro
      ) =>
        total +
        (Number(
          registro.certas
        ) || 0),
      0
    );

  const aproveitamentoGeral =
    totalQuestoes === 0
      ? calcularAproveitamentoIA(
          resultadosIA
        )
      : Math.round(
          (totalCertas /
            totalQuestoes) *
            100
        );

  const revisoesPendentes =
    revisoes.filter(
      (revisao) =>
        !revisao.concluida
    );

  const hoje =
    inicioDoDia(
      new Date()
    );

  const revisoesAtrasadas =
    revisoesPendentes.filter(
      (revisao) =>
        inicioDoDia(
          new Date(
            revisao.dataPrevista
          )
        ).getTime() <
        hoje.getTime()
    ).length;

  const melhorMateria =
    diagnosticoMaterias.length >
    0
      ? [...diagnosticoMaterias].sort(
          (a, b) =>
            b.percentual -
            a.percentual
        )[0]
      : null;

  const materiasComQuestoes =
    diagnosticoMaterias.filter(
      (item) =>
        item.total > 0
    );

  const piorMateria =
    materiasComQuestoes.length >
    0
      ? [...materiasComQuestoes].sort(
          (a, b) =>
            a.percentual -
            b.percentual
        )[0]
      : null;

  const indiceGeral =
    calcularIndiceGeral({
      aproveitamento:
        aproveitamentoGeral,

      minutosSemana,

      diasAtivos:
        diasAtivos.size,

      revisoesAtrasadas,
    });

  const recomendacoes =
    criarRecomendacoes({
      piorMateria,
      assuntosCriticos,
      minutosSemana,
      diasAtivos:
        diasAtivos.size,
      revisoesAtrasadas,
      aproveitamento:
        aproveitamentoGeral,
    });

  return {
    indiceGeral,
    minutosSemana,

    sessoesSemana:
      sessoesSemana.length,

    totalQuestoes,
    aproveitamentoGeral,
    revisoesAtrasadas,

    revisoesPendentes:
      revisoesPendentes.length,

    diasAtivosSemana:
      diasAtivos.size,

    mediaDiariaSemana:
      diasAtivos.size === 0
        ? 0
        : Math.round(
            minutosSemana /
              diasAtivos.size
          ),

    materias:
      diagnosticoMaterias,

    assuntosCriticos,
    melhorMateria,
    piorMateria,
    recomendacoes,

    totalSimulados:
      simulados.length + simuladosIAAindaNaoMigrados,
  };
}

function calcularMaterias(
  questoes: any[],
  sessoes: any[]
): DiagnosticoMateria[] {
  const mapa =
    new Map<
      string,
      {
        certas: number;
        erradas: number;
        minutos: number;
        ultimaData: number | null;
      }
    >();

  questoes.forEach(
    (registro) => {
      const materia =
        registro.materia ||
        "Sem matéria";

      const atual =
        mapa.get(
          materia
        ) ?? {
          certas: 0,
          erradas: 0,
          minutos: 0,
          ultimaData: null,
        };

      const data =
        new Date(
          registro.data
        ).getTime();

      mapa.set(
        materia,
        {
          ...atual,

          certas:
            atual.certas +
            (Number(
              registro.certas
            ) || 0),

          erradas:
            atual.erradas +
            (Number(
              registro.erradas
            ) || 0),

          ultimaData:
            Number.isFinite(data)
              ? Math.max(
                  atual.ultimaData || 0,
                  data
                )
              : atual.ultimaData,
        }
      );
    }
  );

  sessoes.forEach(
    (sessao) => {
      const materia =
        sessao.materia ||
        "Sem matéria";

      const atual =
        mapa.get(
          materia
        ) ?? {
          certas: 0,
          erradas: 0,
          minutos: 0,
          ultimaData: null,
        };

      const data =
        new Date(
          sessao.data
        ).getTime();

      mapa.set(
        materia,
        {
          ...atual,

          minutos:
            atual.minutos +
            (Number(
              sessao.minutos
            ) || 0),

          ultimaData:
            Number.isFinite(data)
              ? Math.max(
                  atual.ultimaData || 0,
                  data
                )
              : atual.ultimaData,
        }
      );
    }
  );

  return Array.from(
    mapa.entries()
  )
    .map(
      ([
        materia,
        dados,
      ]) => {
        const total =
          dados.certas +
          dados.erradas;

        return {
          materia,
          certas:
            dados.certas,
          erradas:
            dados.erradas,
          total,

          percentual:
            total === 0
              ? 0
              : Math.round(
                  (dados.certas /
                    total) *
                    100
                ),

          minutos:
            dados.minutos,

          diasSemEstudar:
            dados.ultimaData
              ? Math.max(
                  0,
                  Math.floor(
                    (
                      inicioDoDia(
                        new Date()
                      ).getTime() -
                      inicioDoDia(
                        new Date(
                          dados.ultimaData
                        )
                      ).getTime()
                    ) /
                    86_400_000
                  )
                )
              : 999,
        };
      }
    )
    .sort(
      (a, b) =>
        a.percentual -
        b.percentual
    );
}

function calcularAssuntosCriticos(
  resultados:
    ResultadoIA[]
): DiagnosticoAssunto[] {
  const mapa =
    new Map<
      string,
      DiagnosticoAssunto
    >();

  resultados.forEach(
    (resultado) => {
      const questoes =
        resultado.questoes ?? [];

      const respostas =
        resultado.respostas ?? {};

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
            mapa.get(
              chave
            ) ?? {
              chave,
              materia,
              assunto,
              erros: 0,
              acertos: 0,
              total: 0,
              percentual: 0,
            };

          const resposta =
            questao.id
              ? respostas[
                  questao.id
                ]
              : undefined;

          const acertou =
            Boolean(
              resposta &&
              resposta ===
                questao.respostaCorreta
            );

          const atualizado = {
            ...atual,

            erros:
              atual.erros +
              (acertou ? 0 : 1),

            acertos:
              atual.acertos +
              (acertou ? 1 : 0),

            total:
              atual.total + 1,
          };

          atualizado.percentual =
            Math.round(
              (atualizado.acertos /
                atualizado.total) *
                100
            );

          mapa.set(
            chave,
            atualizado
          );
        }
      );
    }
  );

  return Array.from(
    mapa.values()
  )
    .filter(
      (item) =>
        item.erros > 0
    )
    .sort(
      (a, b) =>
        a.percentual -
          b.percentual ||
        b.erros -
          a.erros
    )
    .slice(0, 8);
}

function criarRecomendacoes({
  piorMateria,
  assuntosCriticos,
  minutosSemana,
  diasAtivos,
  revisoesAtrasadas,
  aproveitamento,
}: {
  piorMateria:
    | DiagnosticoMateria
    | null;

  assuntosCriticos:
    DiagnosticoAssunto[];

  minutosSemana: number;
  diasAtivos: number;
  revisoesAtrasadas: number;
  aproveitamento: number;
}): RecomendacaoCoach[] {
  const lista:
    RecomendacaoCoach[] = [];

  if (
    revisoesAtrasadas > 0
  ) {
    lista.push({
      prioridade: "alta",

      titulo:
        "Eliminar revisões atrasadas",

      descricao:
        `Existem ${revisoesAtrasadas} revisões vencidas.`,

      acao:
        "Concluir primeiro as revisões vencidas.",
    });
  }

  if (
    assuntosCriticos.length > 0
  ) {
    const principal =
      assuntosCriticos[0];

    lista.push({
      prioridade: "alta",

      titulo:
        `Reforçar ${principal.assunto}`,

      descricao:
        `${principal.materia}: ${principal.erros} erros e ${principal.percentual}% de aproveitamento.`,

      acao:
        "Revisar o material e resolver 10 a 20 questões.",
    });
  } else if (
    piorMateria &&
    piorMateria.total > 0
  ) {
    lista.push({
      prioridade: "alta",

      titulo:
        `Reforçar ${piorMateria.materia}`,

      descricao:
        `A matéria está com ${piorMateria.percentual}% de aproveitamento.`,

      acao:
        "Fazer revisão direcionada e novo bloco de questões.",
    });
  }

  if (
    minutosSemana < 420
  ) {
    lista.push({
      prioridade: "media",

      titulo:
        "Aumentar o volume semanal",

      descricao:
        `Foram registrados ${formatarMinutos(minutosSemana)} nos últimos 7 dias.`,

      acao:
        "Buscar pelo menos 7 horas semanais.",
    });
  }

  if (diasAtivos < 5) {
    lista.push({
      prioridade: "media",

      titulo:
        "Melhorar consistência",

      descricao:
        `Houve estudo em ${diasAtivos} dos últimos 7 dias.`,

      acao:
        "Distribuir sessões menores em pelo menos 5 dias.",
    });
  }

  lista.push({
    prioridade:
      aproveitamento >= 75
        ? "baixa"
        : "media",

    titulo:
      aproveitamento >= 75
        ? "Subir dificuldade"
        : "Consolidar a base",

    descricao:
      `O aproveitamento geral está em ${aproveitamento}%.`,

    acao:
      aproveitamento >= 75
        ? "Introduzir questões médias e difíceis."
        : "Manter questões fáceis e médias antes de aumentar a dificuldade.",
  });

  return lista.slice(0, 5);
}

function calcularIndiceGeral({
  aproveitamento,
  minutosSemana,
  diasAtivos,
  revisoesAtrasadas,
}: {
  aproveitamento: number;
  minutosSemana: number;
  diasAtivos: number;
  revisoesAtrasadas: number;
}) {
  const notaDesempenho =
    aproveitamento * 0.55;

  const notaVolume =
    Math.min(
      100,
      (minutosSemana / 600) *
        100
    ) * 0.25;

  const notaConsistencia =
    Math.min(
      100,
      (diasAtivos / 7) *
        100
    ) * 0.2;

  const penalidade =
    Math.min(
      20,
      revisoesAtrasadas * 2
    );

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        notaDesempenho +
          notaVolume +
          notaConsistencia -
          penalidade
      )
    )
  );
}

function carregarResultadosIA():
  ResultadoIA[] {
  const salvo =
    localStorage.getItem(
      CHAVE_RESULTADOS_IA
    );

  if (!salvo) {
    return [];
  }

  try {
    const valor: unknown =
      JSON.parse(salvo);

    return Array.isArray(valor)
      ? (valor as ResultadoIA[])
      : [];
  } catch {
    return [];
  }
}

function calcularAproveitamentoIA(
  resultados: ResultadoIA[]
) {
  const totais =
    resultados.reduce<{
      certas: number;
      total: number;
    }>(
      (
        acumulado,
        resultado
      ) => {
        const certas =
          Number(
            resultado.certas
          ) || 0;

        const erradas =
          Number(
            resultado.erradas
          ) || 0;

        const emBranco =
          Number(
            resultado.emBranco
          ) || 0;

        return {
          certas:
            acumulado.certas +
            certas,

          total:
            acumulado.total +
            certas +
            erradas +
            emBranco,
        };
      },
      {
        certas: 0,
        total: 0,
      }
    );

  if (
    totais.total === 0
  ) {
    return 0;
  }

  return Math.round(
    (
      totais.certas /
      totais.total
    ) * 100
  );
}

function classificarIndice(
  valor: number
) {
  if (valor >= 80) {
    return "Desempenho forte";
  }

  if (valor >= 60) {
    return "Evolução consistente";
  }

  if (valor >= 40) {
    return "Atenção necessária";
  }

  return "Base ainda instável";
}

function formatarMinutos(
  minutosTotais: number
) {
  const minutosSeguros =
    Math.max(
      0,
      Math.round(
        minutosTotais
      )
    );

  const horas =
    Math.floor(
      minutosSeguros / 60
    );

  const minutos =
    minutosSeguros % 60;

  if (horas === 0) {
    return `${minutos}min`;
  }

  return `${horas}h ${minutos}min`;
}

function formatarTipoAcao(
  tipo: string
) {
  const nomes:
    Record<string, string> = {
      teoria: "Teoria",
      questoes: "Questões",
      revisao: "Revisão",
      simulado: "Simulado",
      misto: "Misto",
    };

  return nomes[tipo] ||
    "Misto";
}

function formatarDiasSemEstudar(
  dias: number
) {
  if (dias === 999) {
    return "sem estudo registrado";
  }

  if (dias === 0) {
    return "estudada hoje";
  }

  if (dias === 1) {
    return "há 1 dia";
  }

  return `há ${dias} dias`;
}

function inicioDoDia(
  data: Date
) {
  const copia =
    new Date(data);

  copia.setHours(
    0,
    0,
    0,
    0
  );

  return copia;
}

function adicionarDias(
  data: Date,
  quantidade: number
) {
  const copia =
    new Date(data);

  copia.setDate(
    copia.getDate() +
      quantidade
  );

  return copia;
}

function obterDataLocal(
  data: Date
) {
  const ano =
    data.getFullYear();

  const mes =
    String(
      data.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const dia =
    String(
      data.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${ano}-${mes}-${dia}`;
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
