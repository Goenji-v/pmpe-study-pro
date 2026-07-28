import {
  useEffect,
  useMemo,
  useState,
} from "react";

import "./Simulados.css";

import { useApp } from "../../context/AppContext";
import { useToast } from "../../context/ToastContext";

import type { Simulado } from "../../types/index";

const CHAVE_RASCUNHO =
  "pmpe_rascunho_simulado";

export default function Simulados() {
  const { simulados, setSimulados } = useApp();
  const { showToast } = useToast();

  const rascunhoInicial =
    carregarRascunho();

  const [nome, setNome] =
    useState(
      rascunhoInicial.nome
    );

  const [banca, setBanca] =
    useState(
      rascunhoInicial.banca
    );

  const [certas, setCertas] =
    useState(
      rascunhoInicial.certas
    );

  const [erradas, setErradas] =
    useState(
      rascunhoInicial.erradas
    );

  const [anuladas, setAnuladas] =
    useState(
      rascunhoInicial.anuladas
    );

  const [minutos, setMinutos] =
    useState(
      rascunhoInicial.minutos
    );

  const [
    observacao,
    setObservacao,
  ] = useState(
    rascunhoInicial.observacao
  );

  useEffect(() => {
    const rascunho: RascunhoSimulado = {
      nome,
      banca,
      certas,
      erradas,
      anuladas,
      minutos,
      observacao,
    };

    localStorage.setItem(
      CHAVE_RASCUNHO,
      JSON.stringify(
        rascunho
      )
    );
  }, [
    nome,
    banca,
    certas,
    erradas,
    anuladas,
    minutos,
    observacao,
  ]);

  const metricas = useMemo(() => {
    const totalSimulados = simulados.length;

    const totalQuestoes = simulados.reduce(
      (total, simulado) =>
        total +
        simulado.certas +
        simulado.erradas +
        simulado.anuladas,
      0
    );

    const totalCertas = simulados.reduce(
      (total, simulado) =>
        total + simulado.certas,
      0
    );

    const aproveitamentoGeral =
      totalQuestoes === 0
        ? 0
        : Math.round(
            (totalCertas / totalQuestoes) * 100
          );

    const tempoTotal = simulados.reduce(
      (total, simulado) =>
        total + simulado.minutos,
      0
    );

    const melhorSimulado =
      simulados.length === 0
        ? null
        : [...simulados].sort(
            (a, b) =>
              calcularAproveitamento(b) -
              calcularAproveitamento(a)
          )[0];

    return {
      totalSimulados,
      totalQuestoes,
      aproveitamentoGeral,
      tempoTotal,
      melhorSimulado,
    };
  }, [simulados]);

  function calcularAproveitamento(
    simulado: Simulado
  ) {
    const total =
      simulado.certas +
      simulado.erradas +
      simulado.anuladas;

    if (total === 0) return 0;

    return Math.round(
      (simulado.certas / total) * 100
    );
  }

  function salvarSimulado() {
    const nomeLimpo = nome.trim();

    if (!nomeLimpo) {
      showToast(
        "Informe o nome do simulado.",
        "warning"
      );
      return;
    }

    if (
      certas < 0 ||
      erradas < 0 ||
      anuladas < 0 ||
      minutos < 0
    ) {
      showToast(
        "Os valores não podem ser negativos.",
        "error"
      );
      return;
    }

    const total =
      certas + erradas + anuladas;

    if (total === 0) {
      showToast(
        "Informe pelo menos uma questão.",
        "warning"
      );
      return;
    }

    const novoSimulado: Simulado = {
      id: crypto.randomUUID(),
      nome: nomeLimpo,
      banca,
      certas,
      erradas,
      anuladas,
      minutos,
      observacao: observacao.trim(),
      data: new Date().toISOString(),
    };

    setSimulados((anteriores) => [
      novoSimulado,
      ...anteriores,
    ]);

    limparFormulario();

    showToast(
      "Simulado salvo com sucesso.",
      "success"
    );
  }

  function excluirSimulado(id: string) {
    const confirmar = window.confirm(
      "Deseja excluir este simulado?"
    );

    if (!confirmar) return;

    setSimulados((anteriores) =>
      anteriores.filter(
        (simulado) => simulado.id !== id
      )
    );

    showToast(
      "Simulado excluído.",
      "info"
    );
  }

  function duplicarSimulado(
    simulado: Simulado
  ) {
    const copia: Simulado = {
      ...simulado,
      id: crypto.randomUUID(),
      nome: `${simulado.nome} - cópia`,
      data: new Date().toISOString(),
    };

    setSimulados((anteriores) => [
      copia,
      ...anteriores,
    ]);

    showToast(
      "Simulado duplicado.",
      "success"
    );
  }

  function limparFormulario() {
    setNome("");
    setBanca("AOCP");
    setCertas(0);
    setErradas(0);
    setAnuladas(0);
    setMinutos(0);
    setObservacao("");

    localStorage.removeItem(
      CHAVE_RASCUNHO
    );
  }

  function formatarTempo(minutosTotais: number) {
    const horas = Math.floor(
      minutosTotais / 60
    );

    const minutosRestantes =
      minutosTotais % 60;

    if (horas === 0) {
      return `${minutosRestantes}min`;
    }

    return `${horas}h ${minutosRestantes}min`;
  }

  function formatarData(data: string) {
    return new Date(data).toLocaleString(
      "pt-BR",
      {
        dateStyle: "short",
        timeStyle: "short",
      }
    );
  }

  function classeDesempenho(
    percentual: number
  ) {
    if (percentual >= 80) {
      return "simulado-bom";
    }

    if (percentual >= 60) {
      return "simulado-atencao";
    }

    return "simulado-critico";
  }

  return (
    <section className="simulados-container">
      <h1 className="simulados-title">
        🎯 Simulados
      </h1>

      <p className="simulados-subtitle">
        Registre seus simulados e acompanhe sua
        evolução geral.
      </p>

      <div className="simulados-resumo">
        <ResumoCard
          titulo="Simulados realizados"
          valor={metricas.totalSimulados}
        />

        <ResumoCard
          titulo="Questões resolvidas"
          valor={metricas.totalQuestoes}
        />

        <ResumoCard
          titulo="Aproveitamento"
          valor={`${metricas.aproveitamentoGeral}%`}
        />

        <ResumoCard
          titulo="Tempo total"
          valor={formatarTempo(
            metricas.tempoTotal
          )}
        />
      </div>

      <div className="simulados-grid">
        <div className="simulados-card">
          <h2>Novo simulado</h2>

          <div className="simulado-form-group">
            <label htmlFor="nomeSimulado">
              Nome
            </label>

            <input
              id="nomeSimulado"
              value={nome}
              onChange={(evento) =>
                setNome(evento.target.value)
              }
              placeholder="Exemplo: Simulado AOCP 01"
            />
          </div>

          <div className="simulado-form-group">
            <label htmlFor="bancaSimulado">
              Banca
            </label>

            <select
              id="bancaSimulado"
              value={banca}
              onChange={(evento) =>
                setBanca(evento.target.value)
              }
            >
              <option value="AOCP">AOCP</option>
              <option value="CEBRASPE">
                CEBRASPE
              </option>
              <option value="FGV">FGV</option>
              <option value="FCC">FCC</option>
              <option value="VUNESP">
                VUNESP
              </option>
              <option value="IBFC">IBFC</option>
              <option value="IDECAN">
                IDECAN
              </option>
              <option value="Outra">
                Outra
              </option>
            </select>
          </div>

          <div className="simulado-form-row">
            <div className="simulado-form-group">
              <label htmlFor="certasSimulado">
                Certas
              </label>

              <input
                id="certasSimulado"
                type="number"
                min={0}
                value={certas}
                onChange={(evento) =>
                  setCertas(
                    Math.max(
                      0,
                      Number(
                        evento.target.value
                      )
                    )
                  )
                }
              />
            </div>

            <div className="simulado-form-group">
              <label htmlFor="erradasSimulado">
                Erradas
              </label>

              <input
                id="erradasSimulado"
                type="number"
                min={0}
                value={erradas}
                onChange={(evento) =>
                  setErradas(
                    Math.max(
                      0,
                      Number(
                        evento.target.value
                      )
                    )
                  )
                }
              />
            </div>
          </div>

          <div className="simulado-form-row">
            <div className="simulado-form-group">
              <label htmlFor="anuladasSimulado">
                Anuladas
              </label>

              <input
                id="anuladasSimulado"
                type="number"
                min={0}
                value={anuladas}
                onChange={(evento) =>
                  setAnuladas(
                    Math.max(
                      0,
                      Number(
                        evento.target.value
                      )
                    )
                  )
                }
              />
            </div>

            <div className="simulado-form-group">
              <label htmlFor="minutosSimulado">
                Tempo em minutos
              </label>

              <input
                id="minutosSimulado"
                type="number"
                min={0}
                value={minutos}
                onChange={(evento) =>
                  setMinutos(
                    Math.max(
                      0,
                      Number(
                        evento.target.value
                      )
                    )
                  )
                }
              />
            </div>
          </div>

          <div className="simulado-form-group">
            <label htmlFor="observacaoSimulado">
              Observação
            </label>

            <textarea
              id="observacaoSimulado"
              value={observacao}
              onChange={(evento) =>
                setObservacao(
                  evento.target.value
                )
              }
              placeholder="Pontos fracos, dificuldade, matérias que precisam de revisão..."
            />
          </div>

          <button
            className="simulado-salvar"
            onClick={salvarSimulado}
          >
            Salvar simulado
          </button>
        </div>

        <div className="simulados-card">
          <h2>Diagnóstico</h2>

          {metricas.melhorSimulado ? (
            <>
              <div className="simulado-diagnostico-item">
                <span>Melhor resultado</span>

                <strong className="simulado-bom">
                  {
                    metricas.melhorSimulado
                      .nome
                  }
                </strong>
              </div>

              <div className="simulado-diagnostico-item">
                <span>
                  Melhor aproveitamento
                </span>

                <strong className="simulado-bom">
                  {calcularAproveitamento(
                    metricas.melhorSimulado
                  )}
                  %
                </strong>
              </div>

              <div className="simulado-diagnostico-item">
                <span>Média geral</span>

                <strong
                  className={classeDesempenho(
                    metricas.aproveitamentoGeral
                  )}
                >
                  {
                    metricas.aproveitamentoGeral
                  }
                  %
                </strong>
              </div>

              <div className="simulado-diagnostico-item">
                <span>
                  Total de questões
                </span>

                <strong>
                  {metricas.totalQuestoes}
                </strong>
              </div>

              <div className="simulado-recomendacao">
                <strong>
                  Recomendação
                </strong>

                <p>
                  {metricas.aproveitamentoGeral <
                  60
                    ? "Revise a teoria antes do próximo simulado e analise os assuntos com maior número de erros."
                    : metricas.aproveitamentoGeral <
                        80
                      ? "Seu resultado está intermediário. Revise os erros e faça outro simulado em até sete dias."
                      : "Seu desempenho está forte. Mantenha simulados regulares e aumente gradualmente a dificuldade."}
                </p>
              </div>
            </>
          ) : (
            <p className="simulado-vazio-texto">
              Cadastre um simulado para gerar
              seu diagnóstico.
            </p>
          )}
        </div>
      </div>

      <div className="simulados-card">
        <h2>Histórico de simulados</h2>

        {simulados.length === 0 ? (
          <p className="simulado-vazio-texto">
            Nenhum simulado salvo ainda.
          </p>
        ) : (
          <div className="simulados-lista">
            {simulados.map(
              (simulado: Simulado) => {
                const total =
                  simulado.certas +
                  simulado.erradas +
                  simulado.anuladas;

                const percentual =
                  calcularAproveitamento(
                    simulado
                  );

                return (
                  <article
                    key={simulado.id}
                    className="simulado-item"
                  >
                    <div className="simulado-item-conteudo">
                      <div className="simulado-item-topo">
                        <div>
                          <strong>
                            {simulado.nome}
                          </strong>

                          <span>
                            {simulado.banca} •{" "}
                            {formatarData(
                              simulado.data
                            )}
                          </span>
                        </div>

                        <strong
                          className={classeDesempenho(
                            percentual
                          )}
                        >
                          {percentual}%
                        </strong>
                      </div>

                      <div className="simulado-dados">
                        <span>
                          Total: {total}
                        </span>

                        <span className="simulado-bom">
                          Certas:{" "}
                          {simulado.certas}
                        </span>

                        <span className="simulado-critico">
                          Erradas:{" "}
                          {simulado.erradas}
                        </span>

                        <span>
                          Anuladas:{" "}
                          {simulado.anuladas}
                        </span>

                        <span>
                          Tempo:{" "}
                          {formatarTempo(
                            simulado.minutos
                          )}
                        </span>
                      </div>

                      {simulado.observacao && (
                        <p className="simulado-observacao">
                          {simulado.observacao}
                        </p>
                      )}
                    </div>

                    <div className="simulado-acoes">
                      <button
                        className="simulado-duplicar"
                        onClick={() =>
                          duplicarSimulado(
                            simulado
                          )
                        }
                      >
                        Duplicar
                      </button>

                      <button
                        className="simulado-excluir"
                        onClick={() =>
                          excluirSimulado(
                            simulado.id
                          )
                        }
                      >
                        Excluir
                      </button>
                    </div>
                  </article>
                );
              }
            )}
          </div>
        )}
      </div>
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
    <div className="simulado-resumo-card">
      <span>{titulo}</span>
      <strong>{valor}</strong>
    </div>
  );
}

type RascunhoSimulado = {
  nome: string;
  banca: string;
  certas: number;
  erradas: number;
  anuladas: number;
  minutos: number;
  observacao: string;
};

const rascunhoPadrao:
  RascunhoSimulado = {
    nome: "",
    banca: "AOCP",
    certas: 0,
    erradas: 0,
    anuladas: 0,
    minutos: 0,
    observacao: "",
  };

function carregarRascunho():
  RascunhoSimulado {
  const salvo =
    localStorage.getItem(
      CHAVE_RASCUNHO
    );

  if (!salvo) {
    return rascunhoPadrao;
  }

  try {
    const valor: unknown =
      JSON.parse(salvo);

    if (
      !valor ||
      typeof valor !== "object"
    ) {
      return rascunhoPadrao;
    }

    const rascunho =
      valor as Partial<
        RascunhoSimulado
      >;

    return {
      nome:
        typeof rascunho.nome ===
        "string"
          ? rascunho.nome
          : "",

      banca:
        typeof rascunho.banca ===
        "string"
          ? rascunho.banca
          : "AOCP",

      certas:
        numeroSeguro(
          rascunho.certas
        ),

      erradas:
        numeroSeguro(
          rascunho.erradas
        ),

      anuladas:
        numeroSeguro(
          rascunho.anuladas
        ),

      minutos:
        numeroSeguro(
          rascunho.minutos
        ),

      observacao:
        typeof rascunho.observacao ===
        "string"
          ? rascunho.observacao
          : "",
    };
  } catch {
    return rascunhoPadrao;
  }
}

function numeroSeguro(
  valor: unknown
): number {
  const numero =
    Number(valor);

  if (
    !Number.isFinite(numero) ||
    numero < 0
  ) {
    return 0;
  }

  return numero;
}