import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import "./HistoricoSessoes.css";

import { useApp } from "../../context/AppContext";
import { useToast } from "../../context/ToastContext";

import type {
  SessaoEstudo,
  TipoSessao,
} from "../../types/index";

export default function HistoricoSessoes() {
  const location = useLocation();
  const { sessoes, setSessoes } = useApp();
  const { showToast } = useToast();

  const [busca, setBusca] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<
    TipoSessao | ""
  >("");
  const [periodo, setPeriodo] = useState<
    "todos" | "hoje" | "semana" | "mes"
  >(() => {
    const estado = location.state as { periodo?: "todos" | "hoje" | "semana" | "mes" } | null;
    return estado?.periodo ?? "todos";
  });

  const [editandoId, setEditandoId] = useState<
    string | null
  >(null);

  const [sessaoEditada, setSessaoEditada] =
    useState<SessaoEstudo | null>(null);

  const sessoesFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return [...sessoes]
      .filter((sessao) => {
        const correspondeBusca =
          !termo ||
          sessao.materia
            .toLowerCase()
            .includes(termo) ||
          sessao.assunto
            .toLowerCase()
            .includes(termo) ||
          sessao.objetivo
            ?.toLowerCase()
            .includes(termo) ||
          sessao.observacao
            ?.toLowerCase()
            .includes(termo);

        const correspondeTipo =
          !tipoFiltro ||
          sessao.tipo === tipoFiltro;

        const correspondePeriodo =
          filtrarPorPeriodo(
            sessao.data,
            periodo
          );

        return (
          correspondeBusca &&
          correspondeTipo &&
          correspondePeriodo
        );
      })
      .sort(
        (a, b) =>
          new Date(b.data).getTime() -
          new Date(a.data).getTime()
      );
  }, [sessoes, busca, tipoFiltro, periodo]);

  const resumo = useMemo(() => {
    const totalMinutos =
      sessoesFiltradas.reduce(
        (total, sessao) =>
          total + sessao.minutos,
        0
      );

    const materiasUnicas = new Set(
      sessoesFiltradas.map(
        (sessao) => sessao.materia
      )
    ).size;

    const media =
      sessoesFiltradas.length === 0
        ? 0
        : Math.round(
            totalMinutos /
              sessoesFiltradas.length
          );

    return {
      totalMinutos,
      totalSessoes:
        sessoesFiltradas.length,
      materiasUnicas,
      media,
    };
  }, [sessoesFiltradas]);

  function iniciarEdicao(
    sessao: SessaoEstudo
  ) {
    setEditandoId(sessao.id);
    setSessaoEditada({
      ...sessao,
    });
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setSessaoEditada(null);
  }

  function salvarEdicao() {
    if (!sessaoEditada) return;

    if (
      !sessaoEditada.materia.trim() ||
      !sessaoEditada.assunto.trim()
    ) {
      showToast(
        "Matéria e assunto são obrigatórios.",
        "warning"
      );
      return;
    }

    if (sessaoEditada.minutos <= 0) {
      showToast(
        "O tempo precisa ser maior que zero.",
        "warning"
      );
      return;
    }

    setSessoes((anteriores) =>
      anteriores.map((sessao) =>
        sessao.id === sessaoEditada.id
          ? {
              ...sessaoEditada,
              materia:
                sessaoEditada.materia.trim(),
              assunto:
                sessaoEditada.assunto.trim(),
              objetivo:
                sessaoEditada.objetivo?.trim(),
              observacao:
                sessaoEditada.observacao?.trim(),
            }
          : sessao
      )
    );

    cancelarEdicao();

    showToast(
      "Sessão atualizada com sucesso.",
      "success"
    );
  }

  function excluirSessao(id: string) {
    const confirmar = window.confirm(
      "Deseja excluir esta sessão de estudo?"
    );

    if (!confirmar) return;

    setSessoes((anteriores) =>
      anteriores.filter(
        (sessao) => sessao.id !== id
      )
    );

    if (editandoId === id) {
      cancelarEdicao();
    }

    showToast(
      "Sessão excluída.",
      "info"
    );
  }

  function duplicarSessao(
    sessao: SessaoEstudo
  ) {
    const copia: SessaoEstudo = {
      ...sessao,
      id: crypto.randomUUID(),
      data: new Date().toISOString(),
      iniciadaEm: undefined,
      finalizadaEm: undefined,
    };

    setSessoes((anteriores) => [
      copia,
      ...anteriores,
    ]);

    showToast(
      "Sessão duplicada.",
      "success"
    );
  }

  return (
    <section className="historico-sessoes-container">
      <div className="historico-sessoes-cabecalho">
        <div>
          <h1>⏱ Histórico de Sessões</h1>

          <p>
            Consulte, edite e analise o tempo
            líquido registrado.
          </p>
        </div>
      </div>

      <div className="historico-sessoes-resumo">
        <ResumoCard
          titulo="Tempo acumulado"
          valor={formatarMinutos(
            resumo.totalMinutos
          )}
        />

        <ResumoCard
          titulo="Sessões"
          valor={resumo.totalSessoes}
        />

        <ResumoCard
          titulo="Média por sessão"
          valor={formatarMinutos(
            resumo.media
          )}
        />

        <ResumoCard
          titulo="Matérias estudadas"
          valor={resumo.materiasUnicas}
        />
      </div>

      <div className="historico-sessoes-filtros">
        <input
          value={busca}
          onChange={(evento) =>
            setBusca(evento.target.value)
          }
          placeholder="Pesquisar matéria, assunto ou observação..."
        />

        <select
          value={tipoFiltro}
          onChange={(evento) =>
            setTipoFiltro(
              evento.target.value as
                | TipoSessao
                | ""
            )
          }
        >
          <option value="">
            Todos os tipos
          </option>

          <option value="aula">
            Aula
          </option>

          <option value="estudo">
            Estudo
          </option>

          <option value="questoes">
            Questões
          </option>

          <option value="revisao">
            Revisão
          </option>

          <option value="leitura">
            Leitura/PDF
          </option>

          <option value="videoaula">
            Videoaula
          </option>

          <option value="simulado">
            Simulado
          </option>
        </select>

        <select
          value={periodo}
          onChange={(evento) =>
            setPeriodo(
              evento.target.value as
                | "todos"
                | "hoje"
                | "semana"
                | "mes"
            )
          }
        >
          <option value="todos">
            Todo o período
          </option>

          <option value="hoje">
            Hoje
          </option>

          <option value="semana">
            Esta semana
          </option>

          <option value="mes">
            Este mês
          </option>
        </select>
      </div>

      {sessoesFiltradas.length === 0 ? (
        <div className="historico-sessoes-vazio">
          <h2>Nenhuma sessão encontrada</h2>

          <p>
            Inicie uma sessão na Central de
            Estudos ou ajuste os filtros.
          </p>
        </div>
      ) : (
        <div className="historico-sessoes-lista">
          {sessoesFiltradas.map(
            (sessao) => {
              const estaEditando =
                editandoId === sessao.id;

              return (
                <article
                  key={sessao.id}
                  className="historico-sessao-card"
                >
                  {estaEditando &&
                  sessaoEditada ? (
                    <div className="historico-sessao-edicao">
                      <h2>
                        ✏ Editar sessão
                      </h2>

                      <div className="historico-sessao-form-grid">
                        <div className="historico-sessao-form-group">
                          <label>
                            Matéria
                          </label>

                          <input
                            value={
                              sessaoEditada.materia
                            }
                            onChange={(
                              evento
                            ) =>
                              setSessaoEditada(
                                {
                                  ...sessaoEditada,
                                  materia:
                                    evento
                                      .target
                                      .value,
                                }
                              )
                            }
                          />
                        </div>

                        <div className="historico-sessao-form-group">
                          <label>
                            Assunto
                          </label>

                          <input
                            value={
                              sessaoEditada.assunto
                            }
                            onChange={(
                              evento
                            ) =>
                              setSessaoEditada(
                                {
                                  ...sessaoEditada,
                                  assunto:
                                    evento
                                      .target
                                      .value,
                                }
                              )
                            }
                          />
                        </div>
                      </div>

                      <div className="historico-sessao-form-grid">
                        <div className="historico-sessao-form-group">
                          <label>
                            Tipo
                          </label>

                          <select
                            value={
                              sessaoEditada.tipo ||
                              "estudo"
                            }
                            onChange={(
                              evento
                            ) =>
                              setSessaoEditada(
                                {
                                  ...sessaoEditada,
                                  tipo:
                                    evento
                                      .target
                                      .value as TipoSessao,
                                }
                              )
                            }
                          >
                            <option value="aula">
                              Aula
                            </option>

                            <option value="estudo">
                              Estudo
                            </option>

                            <option value="questoes">
                              Questões
                            </option>

                            <option value="revisao">
                              Revisão
                            </option>

                            <option value="leitura">
                              Leitura/PDF
                            </option>

                            <option value="videoaula">
                              Videoaula
                            </option>

                            <option value="simulado">
                              Simulado
                            </option>
                          </select>
                        </div>

                        <div className="historico-sessao-form-group">
                          <label>
                            Minutos
                          </label>

                          <input
                            type="number"
                            min={1}
                            value={
                              sessaoEditada.minutos
                            }
                            onChange={(
                              evento
                            ) =>
                              setSessaoEditada(
                                {
                                  ...sessaoEditada,
                                  minutos:
                                    Math.max(
                                      1,
                                      Number(
                                        evento
                                          .target
                                          .value
                                      )
                                    ),
                                }
                              )
                            }
                          />
                        </div>
                      </div>

                      <div className="historico-sessao-form-group">
                        <label>
                          Objetivo
                        </label>

                        <textarea
                          value={
                            sessaoEditada.objetivo ||
                            ""
                          }
                          onChange={(
                            evento
                          ) =>
                            setSessaoEditada(
                              {
                                ...sessaoEditada,
                                objetivo:
                                  evento.target
                                    .value,
                              }
                            )
                          }
                        />
                      </div>

                      <div className="historico-sessao-form-group">
                        <label>
                          Observação
                        </label>

                        <textarea
                          value={
                            sessaoEditada.observacao ||
                            ""
                          }
                          onChange={(
                            evento
                          ) =>
                            setSessaoEditada(
                              {
                                ...sessaoEditada,
                                observacao:
                                  evento.target
                                    .value,
                              }
                            )
                          }
                        />
                      </div>

                      <div className="historico-sessao-acoes">
                        <button
                          className="historico-sessao-salvar"
                          onClick={
                            salvarEdicao
                          }
                        >
                          Salvar alteração
                        </button>

                        <button
                          className="historico-sessao-cancelar"
                          onClick={
                            cancelarEdicao
                          }
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="historico-sessao-topo">
                        <div>
                          <span className="historico-sessao-tipo">
                            {formatarTipo(
                              sessao.tipo ||
                                "estudo"
                            )}
                          </span>

                          <h2>
                            {sessao.materia}
                          </h2>

                          <p>
                            {sessao.assunto}
                          </p>
                        </div>

                        <strong className="historico-sessao-tempo">
                          {formatarMinutos(
                            sessao.minutos
                          )}
                        </strong>
                      </div>

                      <div className="historico-sessao-detalhes">
                        <span>
                          📅{" "}
                          {formatarDataHora(
                            sessao.data
                          )}
                        </span>

                        {sessao.iniciadaEm &&
                          sessao.finalizadaEm && (
                            <span>
                              🕒{" "}
                              {formatarFaixaHorario(
                                sessao.iniciadaEm,
                                sessao.finalizadaEm
                              )}
                            </span>
                          )}
                      </div>

                      {sessao.objetivo && (
                        <div className="historico-sessao-texto">
                          <strong>
                            Objetivo
                          </strong>

                          <p>
                            {sessao.objetivo}
                          </p>
                        </div>
                      )}

                      {sessao.observacao && (
                        <div className="historico-sessao-texto">
                          <strong>
                            Observação
                          </strong>

                          <p>
                            {
                              sessao.observacao
                            }
                          </p>
                        </div>
                      )}

                      <div className="historico-sessao-acoes">
                        <button
                          className="historico-sessao-editar"
                          onClick={() =>
                            iniciarEdicao(
                              sessao
                            )
                          }
                        >
                          ✏ Editar
                        </button>

                        <button
                          className="historico-sessao-duplicar"
                          onClick={() =>
                            duplicarSessao(
                              sessao
                            )
                          }
                        >
                          📄 Duplicar
                        </button>

                        <button
                          className="historico-sessao-excluir"
                          onClick={() =>
                            excluirSessao(
                              sessao.id
                            )
                          }
                        >
                          🗑 Excluir
                        </button>
                      </div>
                    </>
                  )}
                </article>
              );
            }
          )}
        </div>
      )}
    </section>
  );
}

type ResumoCardProps = {
  titulo: string;
  valor: string | number;
};

function ResumoCard({
  titulo,
  valor,
}: ResumoCardProps) {
  return (
    <div className="historico-sessoes-resumo-card">
      <span>{titulo}</span>
      <strong>{valor}</strong>
    </div>
  );
}

function filtrarPorPeriodo(
  data: string,
  periodo:
    | "todos"
    | "hoje"
    | "semana"
    | "mes"
) {
  if (periodo === "todos") {
    return true;
  }

  const dataSessao = new Date(data);
  const agora = new Date();

  if (periodo === "hoje") {
    return (
      obterDataLocal(dataSessao) ===
      obterDataLocal(agora)
    );
  }

  if (periodo === "semana") {
    return (
      dataSessao >= obterInicioDaSemana()
    );
  }

  return (
    dataSessao.getMonth() ===
      agora.getMonth() &&
    dataSessao.getFullYear() ===
      agora.getFullYear()
  );
}

function formatarTipo(
  tipo: TipoSessao
) {
  const tipos: Record<
    TipoSessao,
    string
  > = {
    aula: "🎓 Aula",
    estudo: "📚 Estudo",
    questoes: "📝 Questões",
    revisao: "🔁 Revisão",
    leitura: "📄 Leitura/PDF",
    videoaula: "🎥 Videoaula",
    simulado: "🎯 Simulado",
    redacao: "✍️ Redação",
  };

  return tipos[tipo];
}

function formatarMinutos(
  minutosTotais: number
) {
  const horas = Math.floor(
    minutosTotais / 60
  );

  const minutos =
    minutosTotais % 60;

  if (horas === 0) {
    return `${minutos}min`;
  }

  return `${horas}h ${minutos}min`;
}

function formatarDataHora(
  data: string
) {
  return new Date(data).toLocaleString(
    "pt-BR",
    {
      dateStyle: "short",
      timeStyle: "short",
    }
  );
}

function formatarFaixaHorario(
  inicio: string,
  fim: string
) {
  const formatador =
    new Intl.DateTimeFormat(
      "pt-BR",
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );

  return `${formatador.format(
    new Date(inicio)
  )} → ${formatador.format(
    new Date(fim)
  )}`;
}

function obterDataLocal(
  data = new Date()
) {
  const ano = data.getFullYear();

  const mes = String(
    data.getMonth() + 1
  ).padStart(2, "0");

  const dia = String(
    data.getDate()
  ).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function obterInicioDaSemana() {
  const hoje = new Date();

  const diaSemana =
    hoje.getDay();

  const diferenca =
    diaSemana === 0
      ? 6
      : diaSemana - 1;

  hoje.setDate(
    hoje.getDate() - diferenca
  );

  hoje.setHours(0, 0, 0, 0);

  return hoje;
}
