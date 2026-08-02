import {
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import "./PlanoEstudos.css";

import {
  planoPMPE,
  type DiaPlano,
  type MissaoPlano,
} from "../../data/planoPMPE";

import {
  useApp,
} from "../../context/AppContext";

import {
  useCronometro,
} from "../../context/CronometroContext";

export default function PlanoEstudos() {
  const navigate =
    useNavigate();

  const {
    materias,
    missoesConcluidas:
      concluidas,
    setMissoesConcluidas:
      setConcluidas,
    definirConclusaoAssunto,
  } = useApp();

  const {
    iniciar,
  } = useCronometro();

  const [
    semanaSelecionada,
    setSemanaSelecionada,
  ] = useState(1);

  const [
    diaSelecionado,
    setDiaSelecionado,
  ] = useState(1);

  const semana = planoPMPE.find(
    (item) =>
      item.numero ===
      semanaSelecionada
  );

  const dia = semana?.dias.find(
    (item) =>
      item.numero ===
      diaSelecionado
  );

  const todasAsMissoes =
    useMemo(
      () =>
        planoPMPE.flatMap(
          (itemSemana) =>
            itemSemana.dias.flatMap(
              (itemDia) =>
                itemDia.missoes
            )
        ),
      []
    );

  const totalMissoes =
    todasAsMissoes.length;

  const progressoGeral =
    useMemo(() => {
      if (totalMissoes === 0) {
        return 0;
      }

      const idsValidos = new Set(
        todasAsMissoes.map(
          (missao) => missao.id
        )
      );

      const concluidasValidas =
        concluidas.filter((id) =>
          idsValidos.has(id)
        ).length;

      return Math.round(
        (concluidasValidas /
          totalMissoes) *
          100
      );
    }, [
      concluidas,
      todasAsMissoes,
      totalMissoes,
    ]);

  const progressoSemana =
    useMemo(() => {
      if (!semana) {
        return 0;
      }

      const idsDaSemana =
        semana.dias.flatMap(
          (itemDia) =>
            itemDia.missoes.map(
              (missao) =>
                missao.id
            )
        );

      if (
        idsDaSemana.length === 0
      ) {
        return 0;
      }

      const feitas =
        idsDaSemana.filter((id) =>
          concluidas.includes(id)
        ).length;

      return Math.round(
        (feitas /
          idsDaSemana.length) *
          100
      );
    }, [semana, concluidas]);

  function selecionarSemana(
    numeroSemana: number
  ) {
    setSemanaSelecionada(
      numeroSemana
    );

    setDiaSelecionado(1);
  }

  function alternarConclusao(
    id: string
  ) {
    const missao =
      todasAsMissoes.find(
        (item) => item.id === id
      );

    if (!missao) {
      window.alert(
        "Não foi possível localizar esta missão."
      );

      return;
    }

    const concluindo =
      !concluidas.includes(id);

    const materiaRelacionada = materias.find(
      (materia) =>
        normalizarTexto(materia.nome) ===
        normalizarTexto(missao.materia)
    );

    const assuntoRelacionado = materiaRelacionada?.assuntos.find(
      (assunto) =>
        normalizarTexto(assunto.nome) ===
        normalizarTexto(missao.assunto)
    );

    if (materiaRelacionada && assuntoRelacionado) {
      definirConclusaoAssunto(
        materiaRelacionada.id,
        assuntoRelacionado.id,
        concluindo
      );
    } else {
      setConcluidas((anteriores) =>
        concluindo
          ? Array.from(new Set([...anteriores, id]))
          : anteriores.filter((item) => item !== id)
      );
    }

    window.dispatchEvent(
      new Event(
        "pmpe-plano-atualizado"
      )
    );

    window.dispatchEvent(
      new Event(
        "pmpe-materias-atualizadas"
      )
    );
  }

  function abrirLink(
    url?: string
  ) {
    if (!url) {
      window.alert(
        "Este conteúdo não possui link cadastrado."
      );

      return;
    }

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function iniciarEstudo(
    missao: MissaoPlano
  ) {
    const tipoSessao =
      missao.tipo ===
      "revisao"
        ? "revisao"
        : missao.tipo ===
            "questoes"
          ? "questoes"
          : "aula";

    const iniciada =
      iniciar({
        materia:
          missao.materia,

        assunto:
          missao.assunto,

        tipo:
          tipoSessao,

        objetivo:
          `Semana ${semanaSelecionada} — ` +
          `Dia ${diaSelecionado} — ` +
          `Missão ${missao.numero}`,

        missaoId:
          missao.id,

        semana:
          semanaSelecionada,

        dia:
          diaSelecionado,

        urlAula:
          missao.urlAula,

        urlQuestoes:
          missao.urlQuestoes,
      });

    if (iniciada) {
      navigate(
        "/central-estudos"
      );
    }
  }

  return (
    <section className="plano-container">
      <div className="plano-cabecalho">
        <div>
          <h1>
            📅 Plano Tático PMPE
          </h1>

          <p>
            Oito semanas baseadas no
            planejamento RDC.
          </p>
        </div>

        <div className="plano-progresso-geral">
          <span>
            Progresso geral
          </span>

          <strong>
            {progressoGeral}%
          </strong>
        </div>
      </div>

      <div className="plano-semanas">
        {planoPMPE.map(
          (itemSemana) => {
            const idsDaSemana =
              itemSemana.dias.flatMap(
                (itemDia) =>
                  itemDia.missoes.map(
                    (missao) =>
                      missao.id
                  )
              );

            const feitas =
              idsDaSemana.filter(
                (id) =>
                  concluidas.includes(
                    id
                  )
              ).length;

            const percentual =
              idsDaSemana.length === 0
                ? 0
                : Math.round(
                    (feitas /
                      idsDaSemana.length) *
                      100
                  );

            return (
              <button
                key={
                  itemSemana.numero
                }
                type="button"
                className={
                  `plano-semana-botao ${
                    semanaSelecionada ===
                    itemSemana.numero
                      ? "plano-semana-ativa"
                      : ""
                  }`
                }
                onClick={() =>
                  selecionarSemana(
                    itemSemana.numero
                  )
                }
              >
                <span>
                  {itemSemana.nome}
                </span>

                <strong>
                  {percentual}%
                </strong>
              </button>
            );
          }
        )}
      </div>

      <div className="plano-resumo-semana">
        <div>
          <h2>
            {semana?.nome ||
              "Semana"}
          </h2>

          <p>
            Selecione o dia e execute
            as missões na ordem.
          </p>
        </div>

        <strong>
          {progressoSemana}%
        </strong>
      </div>

      <div className="plano-dias">
        {semana?.dias.map(
          (itemDia: DiaPlano) => {
            const concluidasDia =
              itemDia.missoes.filter(
                (missao) =>
                  concluidas.includes(
                    missao.id
                  )
              ).length;

            return (
              <button
                key={itemDia.numero}
                type="button"
                className={
                  `plano-dia-botao ${
                    diaSelecionado ===
                    itemDia.numero
                      ? "plano-dia-ativo"
                      : ""
                  }`
                }
                onClick={() =>
                  setDiaSelecionado(
                    itemDia.numero
                  )
                }
              >
                <span>
                  Dia {itemDia.numero}
                </span>

                <small>
                  {concluidasDia}/
                  {
                    itemDia.missoes
                      .length
                  }
                </small>
              </button>
            );
          }
        )}
      </div>

      {dia && (
        <div className="plano-conteudo-dia">
          <div className="plano-titulo-dia">
            <h2>
              Semana{" "}
              {semanaSelecionada} —
              Dia {diaSelecionado}
            </h2>

            <span>
              {
                dia.missoes.filter(
                  (missao) =>
                    concluidas.includes(
                      missao.id
                    )
                ).length
              }
              /{dia.missoes.length}{" "}
              concluídas
            </span>
          </div>

          <div className="plano-missoes-grid">
            {dia.missoes.map(
              (
                missao: MissaoPlano
              ) => {
                const concluida =
                  concluidas.includes(
                    missao.id
                  );

                return (
                  <article
                    key={missao.id}
                    className={
                      `plano-missao-card ${
                        concluida
                          ? "plano-missao-concluida"
                          : ""
                      }`
                    }
                  >
                    <div className="plano-missao-topo">
                      <span>
                        Missão{" "}
                        {missao.numero}
                      </span>

                      <span className="plano-tipo">
                        {formatarTipo(
                          missao.tipo
                        )}
                      </span>
                    </div>

                    <h3>
                      {missao.materia}
                    </h3>

                    <p>
                      {missao.assunto}
                    </p>

                    <div className="plano-missao-acoes">
                      {missao.urlAula && (
                        <button
                          type="button"
                          className="plano-aula"
                          onClick={() =>
                            abrirLink(
                              missao.urlAula
                            )
                          }
                        >
                          🎥 Aula RDC
                        </button>
                      )}

                      {missao.urlQuestoes && (
                        <button
                          type="button"
                          className="plano-questoes"
                          onClick={() =>
                            abrirLink(
                              missao.urlQuestoes
                            )
                          }
                        >
                          📝 Questões
                        </button>
                      )}

                      <button
                        type="button"
                        className="plano-estudar"
                        onClick={() =>
                          iniciarEstudo(
                            missao
                          )
                        }
                      >
                        ⏱ Estudar
                      </button>

                      <button
                        type="button"
                        className={
                          concluida
                            ? "plano-desmarcar"
                            : "plano-concluir"
                        }
                        onClick={() =>
                          alternarConclusao(
                            missao.id
                          )
                        }
                      >
                        {concluida
                          ? "↩ Desmarcar"
                          : "✓ Concluir"}
                      </button>
                    </div>
                  </article>
                );
              }
            )}
          </div>

          {(dia.revisao ||
            dia.atividadeExtra) && (
            <div className="plano-extras">
              {dia.revisao && (
                <div>
                  <strong>
                    🔁 Revisão
                  </strong>

                  <span>
                    {dia.revisao}
                  </span>
                </div>
              )}

              {dia.atividadeExtra && (
                <div>
                  <strong>
                    📌 Atividade extra
                  </strong>

                  <span>
                    {
                      dia.atividadeExtra
                    }
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function normalizarTexto(
  texto: string
) {
  return texto
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .trim()
    .toLowerCase()
    .replace(
      /\s+/g,
      " "
    );
}

function formatarTipo(
  tipo: MissaoPlano["tipo"]
) {
  const nomes: Record<
    MissaoPlano["tipo"],
    string
  > = {
    conteudo: "Conteúdo",
    revisao: "Revisão",
    questoes: "Questões",
    redacao: "Redação",
    livre: "Livre",
  };

  return nomes[tipo];
}