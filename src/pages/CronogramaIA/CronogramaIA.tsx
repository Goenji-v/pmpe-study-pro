import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import "./CronogramaIA.css";

import {
  useApp,
} from "../../context/AppContext";

import {
  planoPMPE,
} from "../../data/planoPMPE";

import {
  excluirCronogramaIA,
  gerarCronogramaIA,
  listarCronogramasIA,
  type CronogramaGeradoIA,
  type PeriodoCronogramaIA,
  type TarefaCronogramaIA,
} from "../../services/cronogramaIAService";

export default function CronogramaIA() {
  const navigate =
    useNavigate();

  const {
    questoes,
    sessoes,
    revisoes,
    simulados,
    configuracoes,
    missoesConcluidas,
  } = useApp();

  const [
    periodo,
    setPeriodo,
  ] =
    useState<PeriodoCronogramaIA>(
      "hoje"
    );

  const [
    tempoDisponivel,
    setTempoDisponivel,
  ] = useState(
    configuracoes.metaMinutosDiaria ||
    120
  );

  const [
    gerando,
    setGerando,
  ] = useState(false);

  const [
    carregando,
    setCarregando,
  ] = useState(true);

  const [
    erro,
    setErro,
  ] = useState("");

  const [
    cronogramas,
    setCronogramas,
  ] =
    useState<
      CronogramaGeradoIA[]
    >([]);

  const [
    cronogramaAtual,
    setCronogramaAtual,
  ] =
    useState<
      CronogramaGeradoIA | null
    >(null);

  const missoesPendentes =
    useMemo(
      () =>
        planoPMPE.flatMap(
          (semana) =>
            semana.dias.flatMap(
              (dia) =>
                dia.missoes
                  .filter(
                    (missao) =>
                      !missoesConcluidas.includes(
                        missao.id
                      )
                  )
                  .map(
                    (missao) => ({
                      id:
                        missao.id,
                      semana:
                        semana.numero,
                      dia:
                        dia.numero,
                      numero:
                        missao.numero,
                      materia:
                        missao.materia,
                      assunto:
                        missao.assunto,
                      tipo:
                        missao.tipo,
                    })
                  )
            )
        ),
      [
        missoesConcluidas,
      ]
    );

  useEffect(() => {
    void carregarHistorico();
  }, []);

  async function carregarHistorico() {
    try {
      setCarregando(true);
      setErro("");

      const lista =
        await listarCronogramasIA();

      setCronogramas(lista);

      if (
        lista.length > 0
      ) {
        setCronogramaAtual(
          lista[0]
        );
      }
    } catch (erroCarregamento) {
      setErro(
        obterMensagemErro(
          erroCarregamento
        )
      );
    } finally {
      setCarregando(false);
    }
  }

  async function gerar() {
    if (gerando) {
      return;
    }

    if (
      tempoDisponivel < 20
    ) {
      setErro(
        "Informe pelo menos 20 minutos disponíveis."
      );

      return;
    }

    try {
      setGerando(true);
      setErro("");

      const novo =
        await gerarCronogramaIA({
          nomeUsuario:
            configuracoes.nomeUsuario,

          concurso:
            configuracoes.concurso,

          banca:
            configuracoes.bancaPadrao,

          periodo,

          tempoDisponivelMinutos:
            tempoDisponivel,

          metas: {
            minutosDia:
              configuracoes.metaMinutosDiaria,

            questoesDia:
              configuracoes.metaQuestoesDiaria,

            revisoesDia:
              configuracoes.metaRevisoesDiaria,
          },

          questoes:
            questoes.map(
              (item) => ({
                materia:
                  item.materia,
                assunto:
                  item.assunto,
                certas:
                  item.certas,
                erradas:
                  item.erradas,
                minutos:
                  item.minutos,
                data:
                  item.data,
              })
            ),

          sessoes:
            sessoes.map(
              (item) => ({
                materia:
                  item.materia,
                assunto:
                  item.assunto,
                tipo:
                  item.tipo,
                minutos:
                  item.minutos,
                data:
                  item.data,
              })
            ),

          revisoes:
            revisoes.map(
              (item) => ({
                id:
                  item.id,
                materia:
                  item.materia,
                assunto:
                  item.assunto,
                etapa:
                  item.etapa,
                dataPrevista:
                  item.dataPrevista,
                concluida:
                  item.concluida,
              })
            ),

          simulados:
            simulados.map(
              (item) => ({
                nome:
                  item.nome,
                banca:
                  item.banca,
                certas:
                  item.certas,
                erradas:
                  item.erradas,
                anuladas:
                  item.anuladas,
                minutos:
                  item.minutos,
                data:
                  item.data,
              })
            ),

          missoesPendentes:
            missoesPendentes.slice(
              0,
              80
            ),
        });

      setCronogramaAtual(
        novo
      );

      setCronogramas(
        (anteriores) => [
          novo,
          ...anteriores,
        ]
      );
    } catch (erroGeracao) {
      setErro(
        obterMensagemErro(
          erroGeracao
        )
      );
    } finally {
      setGerando(false);
    }
  }

  async function excluir(
    cronograma:
      CronogramaGeradoIA
  ) {
    if (!cronograma.id) {
      return;
    }

    const confirmar =
      window.confirm(
        `Excluir "${cronograma.titulo}"?`
      );

    if (!confirmar) {
      return;
    }

    try {
      await excluirCronogramaIA(
        cronograma.id
      );

      const novaLista =
        cronogramas.filter(
          (item) =>
            item.id !==
            cronograma.id
        );

      setCronogramas(
        novaLista
      );

      if (
        cronogramaAtual?.id ===
        cronograma.id
      ) {
        setCronogramaAtual(
          novaLista[0] ??
          null
        );
      }
    } catch (erroExclusao) {
      setErro(
        obterMensagemErro(
          erroExclusao
        )
      );
    }
  }

  function iniciarTarefa(
    tarefa:
      TarefaCronogramaIA
  ) {
    const cronometro = {
      ativo: true,
      pausado: false,
      materia:
        tarefa.materia,
      assunto:
        tarefa.assunto,
      tipo:
        tarefa.tipo ===
        "revisao"
          ? "revisao"
          : tarefa.tipo ===
              "questoes"
            ? "questoes"
            : "estudo",
      objetivo:
        tarefa.titulo,
      iniciadaEm:
        new Date()
          .toISOString(),
      pausadaEm: null,
      segundosPausados: 0,
      missaoId:
        tarefa.missaoId,
    };

    localStorage.setItem(
      "pmpe_cronometro_estudo",
      JSON.stringify(
        cronometro
      )
    );

    window.dispatchEvent(
      new Event(
        "pmpe-cronometro-atualizado"
      )
    );

    navigate(
      "/central-estudos"
    );
  }

  return (
    <section className="cronograma-container">
      <div className="cronograma-cabecalho">
        <div>
          <span className="cronograma-etiqueta">
            PLANEJAMENTO INTELIGENTE
          </span>

          <h1>
            🧠 Cronograma com IA
          </h1>

          <p>
            O Gemini combina desempenho,
            revisões, missões pendentes e
            tempo disponível.
          </p>
        </div>

        <div className="cronograma-configuracao">
          <label>
            Período
          </label>

          <select
            value={periodo}
            onChange={(evento) =>
              setPeriodo(
                evento.target
                  .value as
                  PeriodoCronogramaIA
              )
            }
          >
            <option value="hoje">
              Hoje
            </option>

            <option value="7-dias">
              Próximos 7 dias
            </option>
          </select>

          <label>
            {periodo ===
            "hoje"
              ? "Minutos disponíveis hoje"
              : "Minutos disponíveis por dia"}
          </label>

          <input
            type="number"
            min={20}
            max={600}
            value={
              tempoDisponivel
            }
            onChange={(evento) =>
              setTempoDisponivel(
                Math.max(
                  0,
                  Number(
                    evento.target.value
                  )
                )
              )
            }
          />

          <button
            type="button"
            onClick={gerar}
            disabled={gerando}
          >
            {gerando
              ? "Montando cronograma..."
              : "Gerar cronograma"}
          </button>
        </div>
      </div>

      {erro && (
        <div className="cronograma-erro">
          {erro}
        </div>
      )}

      <div className="cronograma-resumo">
        <ResumoCard
          titulo="Missões pendentes"
          valor={
            missoesPendentes.length
          }
        />

        <ResumoCard
          titulo="Revisões abertas"
          valor={
            revisoes.filter(
              (item) =>
                !item.concluida
            ).length
          }
        />

        <ResumoCard
          titulo="Tempo escolhido"
          valor={formatarMinutos(
            tempoDisponivel
          )}
        />

        <ResumoCard
          titulo="Cronogramas salvos"
          valor={
            cronogramas.length
          }
        />
      </div>

      <div className="cronograma-layout">
        <main className="cronograma-principal">
          {carregando ? (
            <div className="cronograma-vazio">
              Carregando cronogramas...
            </div>
          ) : !cronogramaAtual ? (
            <div className="cronograma-vazio">
              <h2>
                Nenhum cronograma gerado
              </h2>

              <p>
                Escolha o período e o tempo
                disponível para começar.
              </p>
            </div>
          ) : (
            <>
              <div className="cronograma-plano-topo">
                <div>
                  <span>
                    {cronogramaAtual.periodo ===
                    "hoje"
                      ? "PLANO DE HOJE"
                      : "PLANO DE 7 DIAS"}
                  </span>

                  <h2>
                    {
                      cronogramaAtual.titulo
                    }
                  </h2>

                  <p>
                    {
                      cronogramaAtual.resumo
                    }
                  </p>
                </div>

                <strong>
                  {formatarMinutos(
                    cronogramaAtual.tempoTotalMinutos
                  )}
                </strong>
              </div>

              <div className="cronograma-objetivo">
                <span>
                  Objetivo principal
                </span>

                <strong>
                  {
                    cronogramaAtual.objetivoPrincipal
                  }
                </strong>
              </div>

              <div className="cronograma-dias">
                {agruparPorDia(
                  cronogramaAtual.tarefas
                ).map(
                  (grupo) => (
                    <section
                      key={
                        grupo.dia
                      }
                      className="cronograma-dia"
                    >
                      <div className="cronograma-dia-titulo">
                        <h3>
                          {cronogramaAtual.periodo ===
                          "hoje"
                            ? "Hoje"
                            : `Dia ${grupo.dia}`}
                        </h3>

                        <span>
                          {formatarMinutos(
                            grupo.tarefas.reduce(
                              (
                                total,
                                tarefa
                              ) =>
                                total +
                                tarefa.duracaoMinutos,
                              0
                            )
                          )}
                        </span>
                      </div>

                      <div className="cronograma-tarefas">
                        {grupo.tarefas.map(
                          (tarefa) => (
                            <article
                              key={
                                tarefa.id
                              }
                              className={`cronograma-tarefa cronograma-${tarefa.tipo}`}
                            >
                              <div className="cronograma-numero">
                                {
                                  tarefa.ordem
                                }
                              </div>

                              <div className="cronograma-tarefa-conteudo">
                                <div className="cronograma-tarefa-topo">
                                  <div>
                                    <strong>
                                      {
                                        tarefa.titulo
                                      }
                                    </strong>

                                    <span>
                                      {
                                        tarefa.materia
                                      }
                                      {" — "}
                                      {
                                        tarefa.assunto
                                      }
                                    </span>
                                  </div>

                                  <small>
                                    {
                                      tarefa.duracaoMinutos
                                    }{" "}
                                    min
                                  </small>
                                </div>

                                <p>
                                  {
                                    tarefa.justificativa
                                  }
                                </p>

                                <div className="cronograma-tarefa-rodape">
                                  <span>
                                    {formatarTipo(
                                      tarefa.tipo
                                    )}

                                    {tarefa.quantidadeQuestoes >
                                    0
                                      ? ` • ${tarefa.quantidadeQuestoes} questões`
                                      : ""}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      iniciarTarefa(
                                        tarefa
                                      )
                                    }
                                  >
                                    ▶ Iniciar
                                  </button>
                                </div>
                              </div>
                            </article>
                          )
                        )}
                      </div>
                    </section>
                  )
                )}
              </div>
            </>
          )}
        </main>

        <aside className="cronograma-historico">
          <h2>
            Histórico
          </h2>

          {cronogramas.length ===
          0 ? (
            <p>
              Nenhum cronograma salvo.
            </p>
          ) : (
            <div className="cronograma-historico-lista">
              {cronogramas.map(
                (cronograma) => (
                  <article
                    key={
                      cronograma.id ||
                      cronograma.geradoEm
                    }
                    className={
                      cronogramaAtual?.id ===
                      cronograma.id
                        ? "ativo"
                        : ""
                    }
                  >
                    <button
                      type="button"
                      className="cronograma-abrir"
                      onClick={() =>
                        setCronogramaAtual(
                          cronograma
                        )
                      }
                    >
                      <strong>
                        {
                          cronograma.titulo
                        }
                      </strong>

                      <span>
                        {formatarData(
                          cronograma.geradoEm
                        )}
                        {" • "}
                        {cronograma.periodo ===
                        "hoje"
                          ? "Hoje"
                          : "7 dias"}
                      </span>
                    </button>

                    <button
                      type="button"
                      className="cronograma-excluir"
                      onClick={() =>
                        excluir(
                          cronograma
                        )
                      }
                    >
                      ×
                    </button>
                  </article>
                )
              )}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function ResumoCard({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string | number;
}) {
  return (
    <article className="cronograma-resumo-card">
      <span>{titulo}</span>
      <strong>{valor}</strong>
    </article>
  );
}

function agruparPorDia(
  tarefas:
    TarefaCronogramaIA[]
) {
  const mapa =
    new Map<
      number,
      TarefaCronogramaIA[]
    >();

  tarefas.forEach(
    (tarefa) => {
      const dia =
        Math.max(
          1,
          tarefa.dia || 1
        );

      const lista =
        mapa.get(dia) ??
        [];

      lista.push(
        tarefa
      );

      mapa.set(
        dia,
        lista
      );
    }
  );

  return Array.from(
    mapa.entries()
  )
    .sort(
      ([a], [b]) =>
        a - b
    )
    .map(
      ([
        dia,
        lista,
      ]) => ({
        dia,
        tarefas:
          [...lista].sort(
            (a, b) =>
              a.ordem -
              b.ordem
          ),
      })
    );
}

function formatarTipo(
  tipo:
    TarefaCronogramaIA["tipo"]
) {
  const nomes = {
    teoria:
      "Teoria",
    questoes:
      "Questões",
    revisao:
      "Revisão",
    simulado:
      "Simulado",
    redacao:
      "Redação",
    misto:
      "Misto",
  };

  return nomes[tipo];
}

function formatarMinutos(
  total: number
) {
  const minutos =
    Math.max(
      0,
      Math.round(total)
    );

  const horas =
    Math.floor(
      minutos / 60
    );

  const restante =
    minutos % 60;

  if (horas === 0) {
    return `${restante}min`;
  }

  return `${horas}h ${restante}min`;
}

function formatarData(
  data: string
) {
  return new Date(
    data
  ).toLocaleString(
    "pt-BR",
    {
      dateStyle:
        "short",
      timeStyle:
        "short",
    }
  );
}

function obterMensagemErro(
  erro: unknown
) {
  return erro instanceof Error
    ? erro.message
    : "Ocorreu um erro inesperado.";
}