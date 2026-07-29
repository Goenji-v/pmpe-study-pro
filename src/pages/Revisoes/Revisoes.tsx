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
  criarProximaRevisao,
  formatarDataRevisao,
  statusDaRevisao,
} from "../../utils/revisoes";

import type { Revisao } from "../../types";

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
    revisoes,
    setRevisoes,
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

    const chavesExistentes =
      new Set(
        revisoes.map(
          (revisao) =>
            normalizar(
              `${revisao.materia}::${revisao.assunto}`
            )
        )
      );

    const novasRevisoes =
      revisoesIA
        .filter(
          (revisaoIA) => {
            const chave =
              normalizar(
                `${revisaoIA.materia}::${revisaoIA.assunto}`
              );

            if (
              chavesExistentes.has(
                chave
              )
            ) {
              return false;
            }

            chavesExistentes.add(
              chave
            );

            return true;
          }
        )
        .map(
          criarRevisaoInicialIA
        );

    /*
     * A fila do Simulado IA é consumida após a importação.
     * Sem isso, uma revisão excluída era recriada toda vez
     * que a página Revisões era aberta novamente.
     */
    limparFilaRevisoesIA(
      usuario.id
    );

    if (
      novasRevisoes.length === 0
    ) {
      return;
    }

    setRevisoes(
      (revisoesAnteriores) => [
        ...novasRevisoes,
        ...revisoesAnteriores,
      ]
    );

    showToast(
      `${novasRevisoes.length} revisão${
        novasRevisoes.length === 1
          ? ""
          : "ões"
      } do Simulado IA adicionada${
        novasRevisoes.length === 1
          ? ""
          : "s"
      }.`,
      "success"
    );
  }

  const revisoesPendentes =
    useMemo(
      () =>
        revisoes
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
      [revisoes]
    );

  const revisoesConcluidas =
    useMemo(
      () =>
        revisoes
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
      [revisoes]
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
    revisao: Revisao
  ) {
    const agora =
      new Date().toISOString();

    const revisaoConcluida:
      Revisao = {
      ...revisao,
      concluida: true,
      dataConclusao: agora,
    };

    const proximaRevisao =
      criarProximaRevisao(
        revisao
      );

    setRevisoes(
      (
        revisoesAnteriores
      ) => {
        const listaAtualizada =
          revisoesAnteriores.map(
            (item) =>
              item.id ===
              revisao.id
                ? revisaoConcluida
                : item
          );

        if (
          !proximaRevisao
        ) {
          return listaAtualizada;
        }

        return [
          proximaRevisao,
          ...listaAtualizada,
        ];
      }
    );

    if (proximaRevisao) {
      showToast(
        `Revisão concluída. Próxima etapa agendada para ${formatarDataRevisao(
          proximaRevisao.dataPrevista
        )}.`,
        "success"
      );
    } else {
      showToast(
        "Ciclo de revisões finalizado.",
        "success"
      );
    }
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

  return (
    <section className="revisoes-container">
      <h1 className="revisoes-title">
        🔁 Revisões
      </h1>

      <p className="revisoes-subtitle">
        Sistema automático de revisões
        em 24 horas, 7 dias, 30 dias e
        90 dias.
      </p>

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
    revisao: Revisao
  ) => void;

  excluirRevisao: (
    revisao: Revisao
  ) => void;
};

function GrupoRevisoes({
  titulo,
  revisoes,
  concluirRevisao,
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
                  <button
                    type="button"
                    className="revisao-concluir"
                    onClick={() =>
                      concluirRevisao(
                        revisao
                      )
                    }
                  >
                    Concluir revisão
                  </button>

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
  revisaoIA: RevisaoIA
): Revisao {
  const dataBase =
    new Date();

  dataBase.setHours(
    0,
    0,
    0,
    0
  );

  return {
    id: `ia-${revisaoIA.id}`,

    materia:
      revisaoIA.materia,

    assunto:
      revisaoIA.assunto,

    etapa: 1,

    dataPrevista:
      dataBase.toISOString(),

    concluida: false,
  } as Revisao;
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