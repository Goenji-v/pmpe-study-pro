import {
  useMemo,
  useState,
} from "react";

import "./Calendario.css";

import {
  useApp,
} from "../../context/AppContext";

type EventoCalendario = {
  id: string;
  tipo:
    | "sessao"
    | "questoes"
    | "revisao"
    | "simulado";
  titulo: string;
  detalhe: string;
  minutos: number;
  data: string;
  status?: "concluida" | "pendente" | "atrasada";
};

type ResumoDia = {
  chave: string;
  data: Date;
  eventos: EventoCalendario[];
  minutos: number;
  questoes: number;
  sessoes: number;
  revisoesConcluidas: number;
  revisoesPendentes: number;
  simulados: number;
};

const NOMES_MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const DIAS_SEMANA = [
  "Dom",
  "Seg",
  "Ter",
  "Qua",
  "Qui",
  "Sex",
  "Sáb",
];

export default function Calendario() {
  const {
    questoes,
    sessoes,
    revisoes,
    simulados,
  } = useApp();

  const hoje =
    inicioDoDia(
      new Date()
    );

  const [
    mesExibido,
    setMesExibido,
  ] = useState(
    new Date(
      hoje.getFullYear(),
      hoje.getMonth(),
      1
    )
  );

  const [
    diaSelecionado,
    setDiaSelecionado,
  ] = useState(
    formatarChaveData(
      hoje
    )
  );

  const eventos =
    useMemo(
      () =>
        montarEventos({
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

  const diasDoMes =
    useMemo(
      () =>
        montarDiasCalendario(
          mesExibido,
          eventos
        ),
      [
        mesExibido,
        eventos,
      ]
    );

  const resumoMes =
    useMemo(
      () =>
        calcularResumoMes(
          diasDoMes,
          mesExibido
        ),
      [
        diasDoMes,
        mesExibido,
      ]
    );

  const detalheDia =
    diasDoMes.find(
      (dia) =>
        dia.chave ===
        diaSelecionado
    ) ?? null;

  function mudarMes(
    quantidade: number
  ) {
    const novoMes =
      new Date(
        mesExibido.getFullYear(),
        mesExibido.getMonth() +
          quantidade,
        1
      );

    setMesExibido(
      novoMes
    );

    setDiaSelecionado(
      formatarChaveData(
        novoMes
      )
    );
  }

  function voltarHoje() {
    const agora =
      new Date();

    setMesExibido(
      new Date(
        agora.getFullYear(),
        agora.getMonth(),
        1
      )
    );

    setDiaSelecionado(
      formatarChaveData(
        agora
      )
    );
  }

  return (
    <section className="calendario-container">
      <div className="calendario-cabecalho">
        <div>
          <span className="calendario-etiqueta">
            VISÃO MENSAL
          </span>

          <h1>
            📅 Calendário de Estudos
          </h1>

          <p>
            Acompanhe sessões, questões,
            revisões e simulados por dia.
          </p>
        </div>

        <div className="calendario-controles">
          <button
            type="button"
            onClick={() =>
              mudarMes(-1)
            }
          >
            ‹
          </button>

          <strong>
            {
              NOMES_MESES[
                mesExibido.getMonth()
              ]
            }{" "}
            {
              mesExibido.getFullYear()
            }
          </strong>

          <button
            type="button"
            onClick={() =>
              mudarMes(1)
            }
          >
            ›
          </button>

          <button
            type="button"
            className="calendario-hoje"
            onClick={
              voltarHoje
            }
          >
            Hoje
          </button>
        </div>
      </div>

      <div className="calendario-resumo">
        <ResumoCard
          titulo="Dias ativos"
          valor={
            resumoMes.diasAtivos
          }
          detalhe="No mês"
        />

        <ResumoCard
          titulo="Tempo estudado"
          valor={formatarMinutos(
            resumoMes.minutos
          )}
          detalhe="Sessões + questões"
        />

        <ResumoCard
          titulo="Questões"
          valor={
            resumoMes.questoes
          }
          detalhe="Resolvidas"
        />

        <ResumoCard
          titulo="Revisões"
          valor={
            resumoMes.revisoes
          }
          detalhe="Concluídas"
        />

        <ResumoCard
          titulo="Simulados"
          valor={
            resumoMes.simulados
          }
          detalhe="Realizados"
        />
      </div>

      <div className="calendario-layout">
        <div className="calendario-painel">
          <div className="calendario-semana">
            {DIAS_SEMANA.map(
              (dia) => (
                <span key={dia}>
                  {dia}
                </span>
              )
            )}
          </div>

          <div className="calendario-grade">
            {diasDoMes.map(
              (dia) => {
                const pertenceAoMes =
                  dia.data.getMonth() ===
                  mesExibido.getMonth();

                const ehHoje =
                  dia.chave ===
                  formatarChaveData(
                    hoje
                  );

                const selecionado =
                  dia.chave ===
                  diaSelecionado;

                const possuiAtividade =
                  dia.sessoes > 0 ||
                  dia.questoes > 0 ||
                  dia.revisoesConcluidas >
                    0 ||
                  dia.simulados > 0;

                return (
                  <button
                    key={
                      dia.chave
                    }
                    type="button"
                    className={
                      `calendario-dia ${
                        pertenceAoMes
                          ? ""
                          : "calendario-dia-fora"
                      } ${
                        ehHoje
                          ? "calendario-dia-hoje"
                          : ""
                      } ${
                        selecionado
                          ? "calendario-dia-selecionado"
                          : ""
                      } ${
                        possuiAtividade
                          ? "calendario-dia-ativo"
                          : ""
                      }`
                    }
                    onClick={() =>
                      setDiaSelecionado(
                        dia.chave
                      )
                    }
                  >
                    <div className="calendario-dia-topo">
                      <strong>
                        {
                          dia.data.getDate()
                        }
                      </strong>

                      {dia.minutos >
                        0 && (
                        <span>
                          {formatarMinutosCurto(
                            dia.minutos
                          )}
                        </span>
                      )}
                    </div>

                    <div className="calendario-indicadores">
                      {dia.sessoes >
                        0 && (
                        <i className="indicador-sessao">
                          {dia.sessoes}
                        </i>
                      )}

                      {dia.questoes >
                        0 && (
                        <i className="indicador-questoes">
                          {
                            dia.questoes
                          }
                        </i>
                      )}

                      {dia.revisoesConcluidas >
                        0 && (
                        <i className="indicador-revisao">
                          {
                            dia.revisoesConcluidas
                          }
                        </i>
                      )}

                      {dia.simulados >
                        0 && (
                        <i className="indicador-simulado">
                          {
                            dia.simulados
                          }
                        </i>
                      )}
                    </div>

                    {dia.revisoesPendentes >
                      0 && (
                      <small>
                        {
                          dia.revisoesPendentes
                        }{" "}
                        revisão
                        {dia.revisoesPendentes >
                        1
                          ? "ões"
                          : ""}{" "}
                        pendente
                        {dia.revisoesPendentes >
                        1
                          ? "s"
                          : ""}
                      </small>
                    )}
                  </button>
                );
              }
            )}
          </div>

          <div className="calendario-legenda">
            <span>
              <i className="indicador-sessao" />
              Sessões
            </span>

            <span>
              <i className="indicador-questoes" />
              Questões
            </span>

            <span>
              <i className="indicador-revisao" />
              Revisões
            </span>

            <span>
              <i className="indicador-simulado" />
              Simulados
            </span>
          </div>
        </div>

        <aside className="calendario-detalhes">
          <div className="calendario-detalhes-topo">
            <div>
              <span>
                DIA SELECIONADO
              </span>

              <h2>
                {detalheDia
                  ? formatarDataCompleta(
                      detalheDia.data
                    )
                  : "Sem dia selecionado"}
              </h2>
            </div>

            {detalheDia && (
              <strong>
                {formatarMinutos(
                  detalheDia.minutos
                )}
              </strong>
            )}
          </div>

          {!detalheDia ||
          detalheDia.eventos.length ===
            0 ? (
            <div className="calendario-vazio">
              Nenhuma atividade registrada
              neste dia.
            </div>
          ) : (
            <>
              <div className="calendario-detalhes-resumo">
                <MiniResumo
                  titulo="Sessões"
                  valor={
                    detalheDia.sessoes
                  }
                />

                <MiniResumo
                  titulo="Questões"
                  valor={
                    detalheDia.questoes
                  }
                />

                <MiniResumo
                  titulo="Revisões"
                  valor={
                    detalheDia.revisoesConcluidas
                  }
                />

                <MiniResumo
                  titulo="Simulados"
                  valor={
                    detalheDia.simulados
                  }
                />
              </div>

              <div className="calendario-eventos">
                {detalheDia.eventos.map(
                  (evento) => (
                    <article
                      key={
                        evento.id
                      }
                      className={
                        `calendario-evento calendario-evento-${evento.tipo}`
                      }
                    >
                      <div className="calendario-evento-icone">
                        {iconeEvento(
                          evento.tipo
                        )}
                      </div>

                      <div>
                        <strong>
                          {
                            evento.titulo
                          }
                        </strong>

                        <p>
                          {
                            evento.detalhe
                          }
                        </p>

                        <span>
                          {evento.minutos >
                          0
                            ? formatarMinutos(
                                evento.minutos
                              )
                            : formatarStatus(
                                evento.status
                              )}
                        </span>
                      </div>
                    </article>
                  )
                )}
              </div>
            </>
          )}
        </aside>
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
  valor: string | number;
  detalhe: string;
}) {
  return (
    <article className="calendario-resumo-card">
      <span>{titulo}</span>
      <strong>{valor}</strong>
      <small>{detalhe}</small>
    </article>
  );
}

function MiniResumo({
  titulo,
  valor,
}: {
  titulo: string;
  valor: number;
}) {
  return (
    <div className="calendario-mini-resumo">
      <span>{titulo}</span>
      <strong>{valor}</strong>
    </div>
  );
}

function montarEventos({
  questoes,
  sessoes,
  revisoes,
  simulados,
}: {
  questoes: any[];
  sessoes: any[];
  revisoes: any[];
  simulados: any[];
}): EventoCalendario[] {
  const eventos:
    EventoCalendario[] = [];

  sessoes.forEach(
    (sessao) => {
      eventos.push({
        id:
          `sessao-${sessao.id}`,
        tipo:
          "sessao",
        titulo:
          sessao.materia ||
          "Sessão de estudo",
        detalhe:
          sessao.assunto ||
          sessao.tipo ||
          "Estudo",
        minutos:
          Number(
            sessao.minutos
          ) || 0,
        data:
          sessao.data,
      });
    }
  );

  questoes.forEach(
    (registro) => {
      const total =
        (Number(
          registro.certas
        ) || 0) +
        (Number(
          registro.erradas
        ) || 0);

      eventos.push({
        id:
          `questoes-${registro.id}`,
        tipo:
          "questoes",
        titulo:
          registro.materia ||
          "Questões",
        detalhe:
          `${registro.assunto || "Sem assunto"} • ${total} questões`,
        minutos:
          Number(
            registro.minutos
          ) || 0,
        data:
          registro.data,
      });
    }
  );

  revisoes.forEach(
    (revisao) => {
      const concluida =
        Boolean(
          revisao.concluida
        );

      const data =
        concluida &&
        revisao.dataConclusao
          ? revisao.dataConclusao
          : revisao.dataPrevista;

      const status =
        concluida
          ? "concluida"
          : inicioDoDia(
              new Date(
                revisao.dataPrevista
              )
            ).getTime() <
            inicioDoDia(
              new Date()
            ).getTime()
            ? "atrasada"
            : "pendente";

      eventos.push({
        id:
          `revisao-${revisao.id}-${status}`,
        tipo:
          "revisao",
        titulo:
          revisao.materia ||
          "Revisão",
        detalhe:
          `${revisao.assunto || "Sem assunto"} • Etapa ${revisao.etapa}`,
        minutos: 0,
        data,
        status,
      });
    }
  );

  simulados.forEach(
    (simulado) => {
      const total =
        (Number(
          simulado.certas
        ) || 0) +
        (Number(
          simulado.erradas
        ) || 0) +
        (Number(
          simulado.anuladas
        ) || 0);

      eventos.push({
        id:
          `simulado-${simulado.id}`,
        tipo:
          "simulado",
        titulo:
          simulado.nome ||
          "Simulado",
        detalhe:
          `${simulado.banca || "Sem banca"} • ${total} questões`,
        minutos:
          Number(
            simulado.minutos
          ) || 0,
        data:
          simulado.data,
      });
    }
  );

  return eventos;
}

function montarDiasCalendario(
  mes: Date,
  eventos:
    EventoCalendario[]
): ResumoDia[] {
  const primeiroDiaMes =
    new Date(
      mes.getFullYear(),
      mes.getMonth(),
      1
    );

  const inicioGrade =
    adicionarDias(
      primeiroDiaMes,
      -primeiroDiaMes.getDay()
    );

  const mapaEventos =
    new Map<
      string,
      EventoCalendario[]
    >();

  eventos.forEach(
    (evento) => {
      const chave =
        formatarChaveData(
          new Date(
            evento.data
          )
        );

      const lista =
        mapaEventos.get(
          chave
        ) ?? [];

      lista.push(
        evento
      );

      mapaEventos.set(
        chave,
        lista
      );
    }
  );

  return Array.from(
    {
      length: 42,
    },
    (
      _,
      indice
    ) => {
      const data =
        adicionarDias(
          inicioGrade,
          indice
        );

      const chave =
        formatarChaveData(
          data
        );

      const lista =
        mapaEventos.get(
          chave
        ) ?? [];

      const eventosAtivos =
        lista.filter(
          (evento) =>
            evento.tipo !==
              "revisao" ||
            evento.status ===
              "concluida"
        );

      return {
        chave,
        data,
        eventos: lista,

        minutos:
          eventosAtivos.reduce(
            (
              total,
              evento
            ) =>
              total +
              evento.minutos,
            0
          ),

        questoes:
          eventosAtivos
            .filter(
              (evento) =>
                evento.tipo ===
                "questoes"
            )
            .reduce(
              (
                total,
                evento
              ) => {
                const correspondencia =
                  evento.detalhe.match(
                    /(\d+)\s+questões/
                  );

                return (
                  total +
                  Number(
                    correspondencia?.[1] ||
                    0
                  )
                );
              },
              0
            ),

        sessoes:
          eventosAtivos.filter(
            (evento) =>
              evento.tipo ===
              "sessao"
          ).length,

        revisoesConcluidas:
          lista.filter(
            (evento) =>
              evento.tipo ===
                "revisao" &&
              evento.status ===
                "concluida"
          ).length,

        revisoesPendentes:
          lista.filter(
            (evento) =>
              evento.tipo ===
                "revisao" &&
              evento.status !==
                "concluida"
          ).length,

        simulados:
          eventosAtivos.filter(
            (evento) =>
              evento.tipo ===
              "simulado"
          ).length,
      };
    }
  );
}

function calcularResumoMes(
  dias:
    ResumoDia[],
  mes: Date
) {
  const diasDoMes =
    dias.filter(
      (dia) =>
        dia.data.getMonth() ===
          mes.getMonth() &&
        dia.data.getFullYear() ===
          mes.getFullYear()
    );

  return {
    diasAtivos:
      diasDoMes.filter(
        (dia) =>
          dia.sessoes > 0 ||
          dia.questoes > 0 ||
          dia.revisoesConcluidas >
            0 ||
          dia.simulados > 0
      ).length,

    minutos:
      diasDoMes.reduce(
        (
          total,
          dia
        ) =>
          total +
          dia.minutos,
        0
      ),

    questoes:
      diasDoMes.reduce(
        (
          total,
          dia
        ) =>
          total +
          dia.questoes,
        0
      ),

    revisoes:
      diasDoMes.reduce(
        (
          total,
          dia
        ) =>
          total +
          dia.revisoesConcluidas,
        0
      ),

    simulados:
      diasDoMes.reduce(
        (
          total,
          dia
        ) =>
          total +
          dia.simulados,
        0
      ),
  };
}

function formatarChaveData(
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

function formatarDataCompleta(
  data: Date
) {
  return data.toLocaleDateString(
    "pt-BR",
    {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }
  );
}

function formatarMinutos(
  minutosTotais: number
) {
  const minutos =
    Math.max(
      0,
      Math.round(
        minutosTotais
      )
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

function formatarMinutosCurto(
  minutosTotais: number
) {
  if (
    minutosTotais < 60
  ) {
    return `${minutosTotais}m`;
  }

  return `${Math.floor(
    minutosTotais / 60
  )}h`;
}

function formatarStatus(
  status?: EventoCalendario["status"]
) {
  if (
    status === "concluida"
  ) {
    return "Concluída";
  }

  if (
    status === "atrasada"
  ) {
    return "Atrasada";
  }

  if (
    status === "pendente"
  ) {
    return "Pendente";
  }

  return "";
}

function iconeEvento(
  tipo: EventoCalendario["tipo"]
) {
  const icones = {
    sessao: "⏱",
    questoes: "📝",
    revisao: "🔁",
    simulado: "🎯",
  };

  return icones[tipo];
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