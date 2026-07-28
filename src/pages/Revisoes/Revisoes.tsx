import {
  useEffect,
  useMemo,
} from "react";

import "./Revisoes.css";

import { useApp } from "../../context/AppContext";
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

const CHAVE_REVISOES_IA =
  "pmpe_revisoes_ia";

export default function Revisoes() {
  const {
    revisoes,
    setRevisoes,
  } = useApp();

  const { showToast } =
    useToast();

  useEffect(() => {
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
  }, []);

  function importarRevisoesIA() {
    const revisoesIA =
      carregarRevisoesIA();

    if (
      revisoesIA.length === 0
    ) {
      return;
    }

    setRevisoes(
      (revisoesAnteriores) => {
        const chavesExistentes =
          new Set(
            revisoesAnteriores.map(
              (revisao) =>
                normalizar(
                  `${revisao.materia}::${revisao.assunto}`
                )
            )
          );

        const novasRevisoes:
          Revisao[] = [];

        revisoesIA.forEach(
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
              return;
            }

            novasRevisoes.push(
              criarRevisaoInicialIA(
                revisaoIA
              )
            );

            chavesExistentes.add(
              chave
            );
          }
        );

        if (
          novasRevisoes.length ===
          0
        ) {
          return revisoesAnteriores;
        }

        window.setTimeout(
          () => {
            showToast(
              `${novasRevisoes.length} revisão${
                novasRevisoes.length ===
                1
                  ? ""
                  : "ões"
              } do Simulado IA adicionada${
                novasRevisoes.length ===
                1
                  ? ""
                  : "s"
              }.`,
              "success"
            );
          },
          0
        );

        return [
          ...novasRevisoes,
          ...revisoesAnteriores,
        ];
      }
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
    id: string
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
            revisao.id !== id
        )
    );

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
    id: string
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
                        revisao.id
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