import {
  useMemo,
} from "react";

import "./EstatisticasSessoes.css";

import { useApp } from "../../context/AppContext";

import type {
  SessaoEstudo,
} from "../../types/index";

type ResumoMateria = {
  materia: string;
  minutos: number;
  sessoes: number;
  percentual: number;
};

type ResumoAssunto = {
  chave: string;
  materia: string;
  assunto: string;
  minutos: number;
  sessoes: number;
};

type ResumoDia = {
  chave: string;
  rotulo: string;
  minutos: number;
};

export default function EstatisticasSessoes() {
  const { sessoes } = useApp();

  const estatisticas =
    useMemo(
      () =>
        calcularEstatisticas(
          sessoes
        ),
      [sessoes]
    );

  const maiorValorGrafico =
    Math.max(
      1,
      ...estatisticas.ultimosSeteDias.map(
        (dia) => dia.minutos
      )
    );

  return (
    <section className="estatisticas-sessoes-container">
      <div className="estatisticas-sessoes-cabecalho">
        <div>
          <h1>
            ⏱ Estatísticas de Sessões
          </h1>

          <p>
            Acompanhe o tempo estudado,
            frequência e distribuição das
            sessões.
          </p>
        </div>

        <div className="estatisticas-sessoes-total">
          <span>
            Sessões registradas
          </span>

          <strong>
            {estatisticas.totalSessoes}
          </strong>
        </div>
      </div>

      <div className="estatisticas-sessoes-resumo">
        <ResumoCard
          titulo="Hoje"
          valor={formatarMinutos(
            estatisticas.minutosHoje
          )}
          detalhe={`${estatisticas.sessoesHoje} sessão${
            estatisticas.sessoesHoje === 1
              ? ""
              : "ões"
          }`}
        />

        <ResumoCard
          titulo="Esta semana"
          valor={formatarMinutos(
            estatisticas.minutosSemana
          )}
          detalhe={`${estatisticas.sessoesSemana} sessões`}
        />

        <ResumoCard
          titulo="Este mês"
          valor={formatarMinutos(
            estatisticas.minutosMes
          )}
          detalhe={`${estatisticas.sessoesMes} sessões`}
        />

        <ResumoCard
          titulo="Tempo total"
          valor={formatarMinutos(
            estatisticas.minutosTotais
          )}
          detalhe={`${estatisticas.totalSessoes} sessões`}
        />

        <ResumoCard
          titulo="Média por sessão"
          valor={formatarMinutos(
            estatisticas.mediaPorSessao
          )}
          detalhe="Tempo médio registrado"
        />

        <ResumoCard
          titulo="Maior sessão"
          valor={formatarMinutos(
            estatisticas.maiorSessao
          )}
          detalhe="Maior tempo individual"
        />
      </div>

      {sessoes.length === 0 ? (
        <div className="estatisticas-sessoes-vazio">
          <h2>
            Nenhuma sessão registrada
          </h2>

          <p>
            Finalize uma sessão na Central
            de Estudos para gerar as
            estatísticas.
          </p>
        </div>
      ) : (
        <>
          <div className="estatisticas-sessoes-grid">
            <section className="estatisticas-sessoes-painel">
              <div className="estatisticas-sessoes-painel-topo">
                <div>
                  <h2>
                    📊 Últimos 7 dias
                  </h2>

                  <p>
                    Tempo estudado por dia.
                  </p>
                </div>

                <strong>
                  {formatarMinutos(
                    estatisticas.ultimosSeteDias.reduce(
                      (total, dia) =>
                        total +
                        dia.minutos,
                      0
                    )
                  )}
                </strong>
              </div>

              <div className="estatisticas-sessoes-grafico">
                {estatisticas.ultimosSeteDias.map(
                  (dia) => {
                    const altura =
                      dia.minutos === 0
                        ? 4
                        : Math.max(
                            10,
                            Math.round(
                              (dia.minutos /
                                maiorValorGrafico) *
                                100
                            )
                          );

                    return (
                      <div
                        key={dia.chave}
                        className="estatisticas-sessoes-coluna"
                      >
                        <span>
                          {formatarMinutosCurto(
                            dia.minutos
                          )}
                        </span>

                        <div className="estatisticas-sessoes-barra-area">
                          <div
                            style={{
                              height: `${altura}%`,
                            }}
                          />
                        </div>

                        <strong>
                          {dia.rotulo}
                        </strong>
                      </div>
                    );
                  }
                )}
              </div>
            </section>

            <section className="estatisticas-sessoes-painel">
              <div className="estatisticas-sessoes-painel-topo">
                <div>
                  <h2>
                    📚 Tempo por matéria
                  </h2>

                  <p>
                    Distribuição do tempo total.
                  </p>
                </div>
              </div>

              <div className="estatisticas-sessoes-materias">
                {estatisticas.porMateria.map(
                  (item) => (
                    <article
                      key={item.materia}
                      className="estatisticas-sessoes-materia"
                    >
                      <div className="estatisticas-sessoes-materia-topo">
                        <div>
                          <strong>
                            {item.materia}
                          </strong>

                          <span>
                            {item.sessoes} sessão${
                              item.sessoes === 1
                                ? ""
                                : "ões"
                            }
                          </span>
                        </div>

                        <strong>
                          {formatarMinutos(
                            item.minutos
                          )}
                        </strong>
                      </div>

                      <div className="estatisticas-sessoes-progresso">
                        <div
                          style={{
                            width: `${item.percentual}%`,
                          }}
                        />
                      </div>
                    </article>
                  )
                )}
              </div>
            </section>
          </div>

          <div className="estatisticas-sessoes-grid">
            <section className="estatisticas-sessoes-painel">
              <div className="estatisticas-sessoes-painel-topo">
                <div>
                  <h2>
                    🧠 Assuntos mais estudados
                  </h2>

                  <p>
                    Ranking por tempo acumulado.
                  </p>
                </div>
              </div>

              <div className="estatisticas-sessoes-ranking">
                {estatisticas.assuntosMaisEstudados.map(
                  (item, indice) => (
                    <article
                      key={item.chave}
                    >
                      <span>
                        {indice + 1}
                      </span>

                      <div>
                        <strong>
                          {item.assunto}
                        </strong>

                        <p>
                          {item.materia} •{" "}
                          {item.sessoes} sessão${
                            item.sessoes === 1
                              ? ""
                              : "ões"
                          }
                        </p>
                      </div>

                      <strong>
                        {formatarMinutos(
                          item.minutos
                        )}
                      </strong>
                    </article>
                  )
                )}
              </div>
            </section>

            <section className="estatisticas-sessoes-painel">
              <div className="estatisticas-sessoes-painel-topo">
                <div>
                  <h2>
                    🕘 Sessões mais recentes
                  </h2>

                  <p>
                    Últimos registros salvos.
                  </p>
                </div>
              </div>

              <div className="estatisticas-sessoes-recentes">
                {estatisticas.recentes.map(
                  (sessao) => (
                    <article
                      key={sessao.id}
                    >
                      <div>
                        <strong>
                          {sessao.materia}
                        </strong>

                        <p>
                          {sessao.assunto}
                        </p>

                        <span>
                          {formatarData(
                            sessao.data
                          )}
                        </span>
                      </div>

                      <strong>
                        {formatarMinutos(
                          sessao.minutos
                        )}
                      </strong>
                    </article>
                  )
                )}
              </div>
            </section>
          </div>
        </>
      )}
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
    <article className="estatisticas-sessoes-card">
      <span>
        {titulo}
      </span>

      <strong>
        {valor}
      </strong>

      <small>
        {detalhe}
      </small>
    </article>
  );
}

function calcularEstatisticas(
  sessoes: SessaoEstudo[]
) {
  const hoje =
    inicioDoDia(
      new Date()
    );

  const inicioSemana =
    obterInicioSemana(
      hoje
    );

  const inicioMes =
    new Date(
      hoje.getFullYear(),
      hoje.getMonth(),
      1
    );

  const minutosTotais =
    somarMinutos(sessoes);

  const sessoesHoje =
    filtrarPorPeriodo(
      sessoes,
      hoje,
      adicionarDias(
        hoje,
        1
      )
    );

  const sessoesSemana =
    filtrarPorPeriodo(
      sessoes,
      inicioSemana,
      adicionarDias(
        hoje,
        1
      )
    );

  const sessoesMes =
    filtrarPorPeriodo(
      sessoes,
      inicioMes,
      adicionarDias(
        hoje,
        1
      )
    );

  const maiorSessao =
    sessoes.reduce(
      (maior, sessao) =>
        Math.max(
          maior,
          Number(
            sessao.minutos
          ) || 0
        ),
      0
    );

  const menorSessao =
    sessoes.length === 0
      ? 0
      : sessoes.reduce(
          (menor, sessao) =>
            Math.min(
              menor,
              Number(
                sessao.minutos
              ) || 0
            ),
          Number(
            sessoes[0].minutos
          ) || 0
        );

  const mediaPorSessao =
    sessoes.length === 0
      ? 0
      : Math.round(
          minutosTotais /
            sessoes.length
        );

  const ultimosSeteDias =
    criarUltimosSeteDias(
      sessoes,
      hoje
    );

  const porMateria =
    calcularPorMateria(
      sessoes,
      minutosTotais
    );

  const assuntosMaisEstudados =
    calcularAssuntos(
      sessoes
    ).slice(0, 8);

  const recentes =
    [...sessoes]
      .sort(
        (a, b) =>
          dataDaSessao(
            b
          ).getTime() -
          dataDaSessao(
            a
          ).getTime()
      )
      .slice(0, 8);

  return {
    totalSessoes:
      sessoes.length,

    minutosTotais,

    minutosHoje:
      somarMinutos(
        sessoesHoje
      ),

    minutosSemana:
      somarMinutos(
        sessoesSemana
      ),

    minutosMes:
      somarMinutos(
        sessoesMes
      ),

    sessoesHoje:
      sessoesHoje.length,

    sessoesSemana:
      sessoesSemana.length,

    sessoesMes:
      sessoesMes.length,

    mediaPorSessao,
    maiorSessao,
    menorSessao,
    ultimosSeteDias,
    porMateria,
    assuntosMaisEstudados,
    recentes,
  };
}

function calcularPorMateria(
  sessoes: SessaoEstudo[],
  minutosTotais: number
): ResumoMateria[] {
  const mapa =
    new Map<
      string,
      {
        minutos: number;
        sessoes: number;
      }
    >();

  sessoes.forEach(
    (sessao) => {
      const materia =
        sessao.materia ||
        "Sem matéria";

      const atual =
        mapa.get(
          materia
        ) ?? {
          minutos: 0,
          sessoes: 0,
        };

      mapa.set(
        materia,
        {
          minutos:
            atual.minutos +
            (Number(
              sessao.minutos
            ) || 0),

          sessoes:
            atual.sessoes + 1,
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
      ]) => ({
        materia,

        minutos:
          dados.minutos,

        sessoes:
          dados.sessoes,

        percentual:
          minutosTotais === 0
            ? 0
            : Math.round(
                (dados.minutos /
                  minutosTotais) *
                  100
              ),
      })
    )
    .sort(
      (a, b) =>
        b.minutos -
        a.minutos
    );
}

function calcularAssuntos(
  sessoes: SessaoEstudo[]
): ResumoAssunto[] {
  const mapa =
    new Map<
      string,
      ResumoAssunto
    >();

  sessoes.forEach(
    (sessao) => {
      const materia =
        sessao.materia ||
        "Sem matéria";

      const assunto =
        sessao.assunto ||
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
          minutos: 0,
          sessoes: 0,
        };

      mapa.set(
        chave,
        {
          ...atual,

          minutos:
            atual.minutos +
            (Number(
              sessao.minutos
            ) || 0),

          sessoes:
            atual.sessoes + 1,
        }
      );
    }
  );

  return Array.from(
    mapa.values()
  ).sort(
    (a, b) =>
      b.minutos -
      a.minutos
  );
}

function criarUltimosSeteDias(
  sessoes: SessaoEstudo[],
  hoje: Date
): ResumoDia[] {
  return Array.from(
    {
      length: 7,
    },
    (_, indice) => {
      const data =
        adicionarDias(
          hoje,
          indice - 6
        );

      const chave =
        obterDataLocal(
          data
        );

      const minutos =
        sessoes
          .filter(
            (sessao) =>
              obterDataLocal(
                dataDaSessao(
                  sessao
                )
              ) === chave
          )
          .reduce(
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

      return {
        chave,
        rotulo:
          data
            .toLocaleDateString(
              "pt-BR",
              {
                weekday:
                  "short",
              }
            )
            .replace(".", ""),

        minutos,
      };
    }
  );
}

function filtrarPorPeriodo(
  sessoes: SessaoEstudo[],
  inicio: Date,
  fimExclusivo: Date
) {
  return sessoes.filter(
    (sessao) => {
      const data =
        dataDaSessao(
          sessao
        );

      return (
        data.getTime() >=
          inicio.getTime() &&
        data.getTime() <
          fimExclusivo.getTime()
      );
    }
  );
}

function somarMinutos(
  sessoes: SessaoEstudo[]
) {
  return sessoes.reduce(
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
}

function dataDaSessao(
  sessao: SessaoEstudo
) {
  const data =
    new Date(
      sessao.data
    );

  return Number.isNaN(
    data.getTime()
  )
    ? new Date()
    : data;
}

function obterInicioSemana(
  data: Date
) {
  const copia =
    inicioDoDia(
      data
    );

  const diaSemana =
    copia.getDay();

  const diferenca =
    diaSemana === 0
      ? -6
      : 1 - diaSemana;

  return adicionarDias(
    copia,
    diferenca
  );
}

function inicioDoDia(
  data: Date
) {
  const copia =
    new Date(
      data
    );

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
    new Date(
      data
    );

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

function formatarMinutosCurto(
  minutosTotais: number
) {
  if (
    minutosTotais === 0
  ) {
    return "0";
  }

  if (
    minutosTotais < 60
  ) {
    return `${minutosTotais}m`;
  }

  const horas =
    minutosTotais / 60;

  return `${horas.toFixed(
    horas % 1 === 0
      ? 0
      : 1
  )}h`;
}

function formatarData(
  valor: string
) {
  return new Date(
    valor
  ).toLocaleDateString(
    "pt-BR"
  );
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