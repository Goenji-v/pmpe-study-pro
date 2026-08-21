import {
  useEffect,
  useMemo,
} from "react";

import "./Revisoes.css";

import { useApp } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

import {
  calcularDiasDiferenca,
  criarPrimeiraRevisao,
  criarProximaRevisao,
  formatarDataRevisao,
  statusDaRevisao,
  redistribuirRevisoesPendentes,
  reagendarRevisao,
} from "../../utils/revisoes";

import type { Materia, Revisao } from "../../types";
import { localizarReferenciaCanonica } from "../../services/conteudos/sincronizacaoCanonica";

type RevisaoIA = {
  id: string;
  materia: string;
  assunto: string;
  origem: "simulado-ia";
  criadaEm: string;
  concluida: boolean;
};

const CHAVE_REVISOES_IA_LEGADA =
  "pmpe_revisoes_ia";

function chaveRevisoesIA(
  userId: string
) {
  return `pmpe:${userId}:revisoes-ia`;
}

export default function Revisoes() {
  const {
    materias,
    revisoes,
    setRevisoes,
    configuracoes,
  } = useApp();

  const { usuario } =
    useAuth();

  const { showToast } =
    useToast();

  useEffect(() => {
    if (!usuario) {
      return;
    }

    importarRevisoesIA();

    function atualizarRevisoesIA() {
      importarRevisoesIA();
    }

    window.addEventListener(
      "pmpe-revisoes-ia-atualizadas",
      atualizarRevisoesIA
    );

    window.addEventListener(
      "storage",
      atualizarRevisoesIA
    );

    return () => {
      window.removeEventListener(
        "pmpe-revisoes-ia-atualizadas",
        atualizarRevisoesIA
      );

      window.removeEventListener(
        "storage",
        atualizarRevisoesIA
      );
    };
  }, [usuario?.id]);

  function importarRevisoesIA() {
    if (!usuario) {
      return;
    }

    const revisoesIA =
      carregarRevisoesIA(
        usuario.id
      );

    if (
      revisoesIA.length === 0
    ) {
      return;
    }

    const pendentesPorChave = new Map(
      revisoes
        .filter((revisao) => !revisao.concluida)
        .map((revisao) => [
          normalizar(`${revisao.materia}::${revisao.assunto}`),
          revisao,
        ])
    );

    const novasRevisoes: Revisao[] = [];
    const jaAgendadas: Revisao[] = [];
    let revisoesParaDistribuicao = [...revisoes];

    revisoesIA.forEach((revisaoIA) => {
      const chave = normalizar(
        `${revisaoIA.materia}::${revisaoIA.assunto}`
      );
      const existente = pendentesPorChave.get(chave);

      if (existente) {
        jaAgendadas.push(existente);
        return;
      }

      const novaRevisao = criarRevisaoInicialIA(
        revisaoIA,
        materias,
        revisoesParaDistribuicao,
        configuracoes.metaRevisoesDiaria
      );

      novasRevisoes.push(novaRevisao);
      revisoesParaDistribuicao = [novaRevisao, ...revisoesParaDistribuicao];
      pendentesPorChave.set(chave, novaRevisao);
    });

    /*
     * A fila do Simulado IA é consumida após a importação.
     * Sem isso, uma revisão excluída era recriada toda vez
     * que a página Revisões era aberta novamente.
     */
    limparFilaRevisoesIA(
      usuario.id
    );

    if (novasRevisoes.length === 0) {
      if (jaAgendadas.length > 0) {
        const primeira = jaAgendadas[0];
        showToast(
          `A revisão já estava agendada para ${formatarDataRevisao(primeira.dataPrevista)}.`,
          "info"
        );
      }
      return;
    }

    setRevisoes(
      (revisoesAnteriores) => [
        ...novasRevisoes,
        ...revisoesAnteriores,
      ]
    );

    const primeiraData = novasRevisoes
      .map((revisao) => revisao.dataPrevista)
      .sort()[0];

    showToast(
      `${novasRevisoes.length} revisão${
        novasRevisoes.length === 1
          ? ""
          : "ões"
      } do Simulado IA adicionada${
        novasRevisoes.length === 1
          ? ""
          : "s"
      } para ${formatarDataRevisao(primeiraData)}.${
        jaAgendadas.length > 0
          ? ` ${jaAgendadas.length} já estava${jaAgendadas.length === 1 ? "" : "m"} agendada${jaAgendadas.length === 1 ? "" : "s"}.`
          : ""
      }`,
      "success"
    );
  }

  const revisoesComModulo = useMemo(
    () =>
      revisoes.map((revisao) => {
        if (revisao.modulo || revisao.moduloId) {
          return revisao;
        }

        const materia = materias.find(
          (item) =>
            item.id === revisao.materiaId ||
            item.nome === revisao.materia
        );

        const modulo = materia?.modulos?.find(
          (item) =>
            item.assuntos.some(
              (assunto) =>
                assunto.id === revisao.assuntoId ||
                assunto.nome === revisao.assunto
            )
        );

        return modulo
          ? {
              ...revisao,
              modulo: modulo.nome,
              moduloId: modulo.id,
            }
          : {
              ...revisao,
              modulo: "Geral",
            };
      }),
    [materias, revisoes]
  );

  const revisoesPendentes =
    useMemo(
      () =>
        revisoesComModulo
          .filter(
            (revisao) =>
              !revisao.concluida
          )
          .sort(
            (a, b) =>
              new Date(
                a.dataPrevista
              ).getTime() -
              new Date(
                b.dataPrevista
              ).getTime()
          ),
      [revisoesComModulo]
    );

  const revisoesConcluidas =
    useMemo(
      () =>
        revisoesComModulo
          .filter(
            (revisao) =>
              revisao.concluida
          )
          .sort(
            (a, b) =>
              new Date(
                b.dataConclusao ||
                  b.dataPrevista
              ).getTime() -
              new Date(
                a.dataConclusao ||
                  a.dataPrevista
              ).getTime()
          ),
      [revisoesComModulo]
    );

  const atrasadas =
    useMemo(
      () =>
        revisoesPendentes.filter(
          (revisao) =>
            statusDaRevisao(
              revisao.dataPrevista
            ) === "atrasada"
        ),
      [revisoesPendentes]
    );

  const paraHoje =
    useMemo(
      () =>
        revisoesPendentes.filter(
          (revisao) =>
            statusDaRevisao(
              revisao.dataPrevista
            ) === "hoje"
        ),
      [revisoesPendentes]
    );

  const futuras =
    useMemo(
      () =>
        revisoesPendentes.filter(
          (revisao) =>
            statusDaRevisao(
              revisao.dataPrevista
            ) === "futura"
        ),
      [revisoesPendentes]
    );

  function concluirRevisao(
    revisao: Revisao,
    desempenho: "facil" | "media" | "dificil"
  ) {
    const agora =
      new Date().toISOString();

    const revisaoConcluida:
      Revisao = {
      ...revisao,
      concluida: true,
      dataConclusao: agora,
      desempenho,
    };

    setRevisoes((revisoesAnteriores) => {
      const listaAtualizada = revisoesAnteriores.map((item) =>
        item.id === revisao.id ? revisaoConcluida : item
      );

      const proximaRevisao = criarProximaRevisao(
        revisao,
        listaAtualizada,
        configuracoes.metaRevisoesDiaria
      );

      if (!proximaRevisao) return listaAtualizada;
      return [proximaRevisao, ...listaAtualizada];
    });

    if (revisao.etapa < 4) {
      showToast("Revisão concluída. Próxima etapa adicionada à agenda.", "success");
    } else {
      showToast("Ciclo de revisões finalizado.", "success");
    }
  }

  function reagendar(revisao: Revisao, dias: number) {
    setRevisoes((anteriores) =>
      anteriores.map((item) =>
        item.id === revisao.id ? reagendarRevisao(item, dias) : item
      )
    );
    showToast(`Revisão reagendada para daqui a ${dias} dia(s).`, "success");
  }

  function excluirRevisao(
    revisaoExcluida: Revisao
  ) {
    const confirmar =
      window.confirm(
        "Deseja excluir esta revisão?"
      );

    if (!confirmar) {
      return;
    }

    setRevisoes(
      (
        revisoesAnteriores
      ) =>
        revisoesAnteriores.filter(
          (revisao) =>
            revisao.id !==
            revisaoExcluida.id
        )
    );

    if (usuario) {
      removerDaFilaRevisoesIA(
        usuario.id,
        revisaoExcluida
      );
    }

    showToast(
      "Revisão excluída.",
      "info"
    );
  }

  function reorganizarAgenda() {
    const limite = configuracoes.metaRevisoesDiaria;
    if (limite <= 0) {
      showToast("Defina uma meta de revisões por dia maior que zero nas Configurações.", "warning");
      return;
    }

    const reorganizadas = redistribuirRevisoesPendentes(revisoes, limite);
    const datasAnteriores = new Map(
      revisoes.map((revisao) => [revisao.id, dataCalendario(revisao.dataPrevista)])
    );
    const alteradas = reorganizadas.filter(
      (revisao) =>
        !revisao.concluida &&
        datasAnteriores.get(revisao.id) !== dataCalendario(revisao.dataPrevista)
    ).length;

    if (alteradas === 0) {
      showToast(
        `Nenhuma mudança necessária: a agenda já respeita o limite de ${limite} revisões por dia.`,
        "info"
      );
      return;
    }

    setRevisoes(reorganizadas);
    showToast(
      `${alteradas} revisão${alteradas === 1 ? " foi reorganizada" : "ões foram reorganizadas"}.`,
      "success"
    );
  }

  return (
    <section className="revisoes-container">
      <h1 className="revisoes-title">
        🔁 Revisões
      </h1>

      <p className="revisoes-subtitle">
        Sistema automático 0-1-7-15, com distribuição conforme sua meta diária.
      </p>

      <div className="revisoes-toolbar">
        <span>Limite atual: <strong>{configuracoes.metaRevisoesDiaria || "sem limite"}</strong> revisão(ões)/dia</span>
        <button type="button" onClick={reorganizarAgenda}>Reorganizar agenda</button>
      </div>

      <div className="revisoes-resumo">
        <ResumoCard
          titulo="Atrasadas"
          valor={atrasadas.length}
          classe="resumo-atrasado"
        />

        <ResumoCard
          titulo="Hoje"
          valor={paraHoje.length}
          classe="resumo-hoje"
        />

        <ResumoCard
          titulo="Futuras"
          valor={futuras.length}
          classe="resumo-futuro"
        />

        <ResumoCard
          titulo="Concluídas"
          valor={
            revisoesConcluidas.length
          }
          classe="resumo-concluido"
        />
      </div>

      {revisoesPendentes.length ===
      0 ? (
        <div className="revisoes-vazio">
          <h2>
            Nenhuma revisão pendente
          </h2>

          <p>
            Marque assuntos como
            concluídos na página Estudos
            ou crie revisões após um
            Simulado IA.
          </p>
        </div>
      ) : (
        <>
          {atrasadas.length >
            0 && (
            <GrupoRevisoes
              titulo="🔴 Revisões atrasadas"
              revisoes={atrasadas}
              concluirRevisao={
                concluirRevisao
              }
              reagendarRevisao={reagendar}
              excluirRevisao={
                excluirRevisao
              }
            />
          )}

          {paraHoje.length >
            0 && (
            <GrupoRevisoes
              titulo="🟡 Revisões de hoje"
              revisoes={paraHoje}
              concluirRevisao={
                concluirRevisao
              }
              reagendarRevisao={reagendar}
              excluirRevisao={
                excluirRevisao
              }
            />
          )}

          {futuras.length >
            0 && (
            <GrupoRevisoes
              titulo="🟢 Próximas revisões"
              revisoes={futuras}
              concluirRevisao={
                concluirRevisao
              }
              reagendarRevisao={reagendar}
              excluirRevisao={
                excluirRevisao
              }
            />
          )}
        </>
      )}

      {revisoesConcluidas.length >
        0 && (
        <div className="revisoes-grupo">
          <h2>
            ✅ Histórico de revisões
          </h2>

          <div className="revisoes-lista">
            {revisoesConcluidas
              .slice(0, 10)
              .map(
                (revisao) => (
                  <div
                    key={
                      revisao.id
                    }
                    className="revisao-card revisao-concluida"
                  >
                    <div>
                      <strong>
                        {
                          revisao.materia
                        }
                      </strong>

                      {revisao.modulo && (
                        <small className="revisao-caminho">
                          {revisao.modulo}
                        </small>
                      )}

                      <p>
                        {
                          revisao.assunto
                        }
                      </p>

                      <span>
                        Etapa{" "}
                        {
                          revisao.etapa
                        }{" "}
                        concluída em{" "}
                        {formatarDataRevisao(
                          revisao.dataConclusao ||
                            revisao.dataPrevista
                        )}
                      </span>
                      {revisao.desempenho && (
                        <small className={`revisao-resultado resultado-${revisao.desempenho}`}>
                          Desempenho: {revisao.desempenho === "facil" ? "Fácil" : revisao.desempenho === "media" ? "Médio" : "Difícil"}
                        </small>
                      )}
                    </div>
                  </div>
                )
              )}
          </div>
        </div>
      )}
    </section>
  );
}

type ResumoCardProps = {
  titulo: string;
  valor: number;
  classe: string;
};

function ResumoCard({
  titulo,
  valor,
  classe,
}: ResumoCardProps) {
  return (
    <div
      className={`revisao-resumo-card ${classe}`}
    >
      <span>{titulo}</span>
      <strong>{valor}</strong>
    </div>
  );
}

type GrupoRevisoesProps = {
  titulo: string;
  revisoes: Revisao[];

  concluirRevisao: (
    revisao: Revisao,
    desempenho: "facil" | "media" | "dificil"
  ) => void;

  reagendarRevisao: (revisao: Revisao, dias: number) => void;

  excluirRevisao: (
    revisao: Revisao
  ) => void;
};

function GrupoRevisoes({
  titulo,
  revisoes,
  concluirRevisao,
  reagendarRevisao,
  excluirRevisao,
}: GrupoRevisoesProps) {
  return (
    <div className="revisoes-grupo">
      <h2>{titulo}</h2>

      <div className="revisoes-lista">
        {revisoes.map(
          (revisao) => {
            const diferenca =
              calcularDiasDiferenca(
                revisao.dataPrevista
              );

            return (
              <div
                key={revisao.id}
                className="revisao-card"
              >
                <div className="revisao-conteudo">
                  <strong>
                    {
                      revisao.materia
                    }
                  </strong>

                  {revisao.modulo && (
                    <small className="revisao-caminho">
                      {revisao.modulo}
                    </small>
                  )}

                  <p>
                    {
                      revisao.assunto
                    }
                  </p>

                  <span>
                    Etapa{" "}
                    {
                      revisao.etapa
                    }{" "}
                    •{" "}
                    {formatarDataRevisao(
                      revisao.dataPrevista
                    )}
                  </span>

                  <small>
                    {diferenca < 0
                      ? `Atrasada há ${Math.abs(
                          diferenca
                        )} dia(s)`
                      : diferenca ===
                          0
                        ? "Vence hoje"
                        : `Daqui a ${diferenca} dia(s)`}
                  </small>
                </div>

                <div className="revisao-acoes">
                  <div className="revisao-avaliacao" aria-label="Concluir e avaliar revisão">
                    <span>Concluir:</span>
                    <button type="button" className="avaliacao-dificil" onClick={() => concluirRevisao(revisao, "dificil")}>Difícil</button>
                    <button type="button" className="avaliacao-media" onClick={() => concluirRevisao(revisao, "media")}>Médio</button>
                    <button type="button" className="avaliacao-facil" onClick={() => concluirRevisao(revisao, "facil")}>Fácil</button>
                  </div>

                  <div className="revisao-reagendar">
                    <span>Reagendar:</span>
                    {[1, 3, 7].map((dias) => (
                      <button type="button" key={dias} onClick={() => reagendarRevisao(revisao, dias)}>+{dias}d</button>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="revisao-excluir"
                    onClick={() =>
                      excluirRevisao(
                        revisao
                      )
                    }
                  >
                    Excluir
                  </button>
                </div>
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}

function carregarRevisoesIA(
  userId: string
): RevisaoIA[] {
  const chaves = [
    chaveRevisoesIA(
      userId
    ),
    CHAVE_REVISOES_IA_LEGADA,
  ];

  const todas:
    RevisaoIA[] = [];

  chaves.forEach(
    (chave) => {
      const salvo =
        localStorage.getItem(
          chave
        );

      if (!salvo) {
        return;
      }

      try {
        const valor: unknown =
          JSON.parse(salvo);

        if (
          Array.isArray(valor)
        ) {
          todas.push(
            ...(
              valor as
                RevisaoIA[]
            )
          );
        }
      } catch {
        localStorage.removeItem(
          chave
        );
      }
    }
  );

  const unicas =
    new Map<
      string,
      RevisaoIA
    >();

  todas.forEach(
    (revisao) => {
      const chave =
        normalizar(
          `${revisao.materia}::${revisao.assunto}`
        );

      if (
        !unicas.has(chave)
      ) {
        unicas.set(
          chave,
          revisao
        );
      }
    }
  );

  return Array.from(
    unicas.values()
  );
}

function limparFilaRevisoesIA(
  userId: string
) {
  localStorage.removeItem(
    chaveRevisoesIA(
      userId
    )
  );

  localStorage.removeItem(
    CHAVE_REVISOES_IA_LEGADA
  );
}

function removerDaFilaRevisoesIA(
  userId: string,
  revisaoExcluida: Revisao
) {
  const chaveExcluida =
    normalizar(
      `${revisaoExcluida.materia}::${revisaoExcluida.assunto}`
    );

  [
    chaveRevisoesIA(
      userId
    ),
    CHAVE_REVISOES_IA_LEGADA,
  ].forEach(
    (chaveStorage) => {
      const salvo =
        localStorage.getItem(
          chaveStorage
        );

      if (!salvo) {
        return;
      }

      try {
        const valor: unknown =
          JSON.parse(salvo);

        if (
          !Array.isArray(valor)
        ) {
          localStorage.removeItem(
            chaveStorage
          );

          return;
        }

        const listaFiltrada =
          (
            valor as
              RevisaoIA[]
          ).filter(
            (item) =>
              normalizar(
                `${item.materia}::${item.assunto}`
              ) !==
              chaveExcluida
          );

        if (
          listaFiltrada.length ===
          0
        ) {
          localStorage.removeItem(
            chaveStorage
          );
        } else {
          localStorage.setItem(
            chaveStorage,
            JSON.stringify(
              listaFiltrada
            )
          );
        }
      } catch {
        localStorage.removeItem(
          chaveStorage
        );
      }
    }
  );
}

function criarRevisaoInicialIA(
  revisaoIA: RevisaoIA,
  materias: Materia[],
  revisoesExistentes: Revisao[],
  limiteDiario: number
): Revisao {
  const referencia = localizarReferenciaCanonica(materias, {
    materia: revisaoIA.materia,
    assunto: revisaoIA.assunto,
  });

  const revisao = criarPrimeiraRevisao({
    materiaId: referencia?.materia.id ?? `legado-${normalizar(revisaoIA.materia)}`,
    moduloId: referencia?.modulo.id,
    assuntoId: referencia?.assunto.id ?? `legado-${normalizar(revisaoIA.materia)}-${normalizar(revisaoIA.assunto)}`,
    materia: referencia?.materia.nome ?? revisaoIA.materia,
    modulo: referencia?.modulo.nome,
    assunto: referencia?.assunto.nome ?? revisaoIA.assunto,
    revisoesExistentes,
    limiteDiario,
  });

  return {
    ...revisao,
    id: `ia-${revisaoIA.id}`,
    dataCriacao: revisaoIA.criadaEm || revisao.dataCriacao,
  };
}

function dataCalendario(data: string) {
  const valor = new Date(data);
  return `${valor.getFullYear()}-${valor.getMonth() + 1}-${valor.getDate()}`;
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
