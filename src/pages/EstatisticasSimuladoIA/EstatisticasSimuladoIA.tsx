import {
  useEffect,
  useMemo,
  useState,
} from "react";

import "./EstatisticasSimuladoIA.css";

import type {
  QuestaoIA,
} from "../../types/index";

type LetraAlternativa =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E";

type RespostasUsuario = Record<
  string,
  LetraAlternativa
>;

type ResultadoSimuladoIA = {
  id: string;
  nome: string;
  data: string;

  total: number;
  certas: number;
  erradas: number;
  percentual: number;

  respostas: RespostasUsuario;
  questoes: QuestaoIA[];
  tipo?: "questoes" | "simulado";
};

type EstatisticaMateria = {
  materia: string;
  total: number;
  certas: number;
  erradas: number;
  percentual: number;
};

const CHAVE_RESULTADOS =
  "pmpe_resultados_simulados_ia";

export default function EstatisticasSimuladoIA() {
  const [resultados, setResultados] =
    useState<ResultadoSimuladoIA[]>(
      carregarResultados
    );

  useEffect(() => {
    function atualizarResultados() {
      setResultados(
        carregarResultados()
      );
    }

    window.addEventListener(
      "pmpe-simulado-ia-finalizado",
      atualizarResultados
    );

    window.addEventListener(
      "storage",
      atualizarResultados
    );

    window.addEventListener(
      "focus",
      atualizarResultados
    );

    return () => {
      window.removeEventListener(
        "pmpe-simulado-ia-finalizado",
        atualizarResultados
      );

      window.removeEventListener(
        "storage",
        atualizarResultados
      );

      window.removeEventListener(
        "focus",
        atualizarResultados
      );
    };
  }, []);

  const resumo = useMemo(() => {
    const totalSimulados =
      resultados.length;

    const totalQuestoes =
      resultados.reduce(
        (total, resultado) =>
          total + resultado.total,
        0
      );

    const totalCertas =
      resultados.reduce(
        (total, resultado) =>
          total + resultado.certas,
        0
      );

    const totalErradas =
      resultados.reduce(
        (total, resultado) =>
          total + resultado.erradas,
        0
      );

    const aproveitamento =
      totalQuestoes === 0
        ? 0
        : Math.round(
            (totalCertas /
              totalQuestoes) *
              100
          );

    return {
      totalSimulados,
      totalQuestoes,
      totalCertas,
      totalErradas,
      aproveitamento,
    };
  }, [resultados]);

  const materias = useMemo(
    () =>
      calcularEstatisticasMaterias(
        resultados
      ),
    [resultados]
  );

  const melhorMateria =
    materias.length > 0
      ? materias[0]
      : null;

  const piorMateria =
    materias.length > 0
      ? materias[materias.length - 1]
      : null;

  function excluirResultado(
    resultadoId: string
  ) {
    const confirmar =
      window.confirm(
        "Deseja excluir este resultado?"
      );

    if (!confirmar) {
      return;
    }

    const novaLista =
      resultados.filter(
        (resultado) =>
          resultado.id !== resultadoId
      );

    salvarResultados(novaLista);
    setResultados(novaLista);
  }

  function limparHistorico() {
    if (resultados.length === 0) {
      return;
    }

    const confirmar =
      window.confirm(
        "Deseja apagar todo o histórico de simulados IA?"
      );

    if (!confirmar) {
      return;
    }

    salvarResultados([]);

    setResultados([]);
  }

  if (resultados.length === 0) {
    return (
      <section className="estatisticas-ia-container">
        <div className="estatisticas-ia-vazio">
          <h1>
            📊 Estatísticas dos Simulados IA
          </h1>

          <p>
            Você ainda não finalizou nenhum
            simulado gerado por IA.
          </p>

          <a href="/resolver-simulado-ia">
            Resolver Simulado IA
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="estatisticas-ia-container">
      <div className="estatisticas-ia-cabecalho">
        <div>
          <h1>
            📊 Estatísticas dos Simulados IA
          </h1>

          <p>
            Análise dos resultados das
            questões geradas pelo Gemini.
          </p>
        </div>

        <button
          type="button"
          className="estatisticas-ia-limpar"
          onClick={limparHistorico}
        >
          Limpar histórico
        </button>
      </div>

      <div className="estatisticas-ia-cards">
        <ResumoCard
          titulo="Simulados"
          valor={resumo.totalSimulados}
          icone="🎯"
        />

        <ResumoCard
          titulo="Questões"
          valor={resumo.totalQuestoes}
          icone="📝"
        />

        <ResumoCard
          titulo="Acertos"
          valor={resumo.totalCertas}
          icone="✅"
          classe="positivo"
        />

        <ResumoCard
          titulo="Erros"
          valor={resumo.totalErradas}
          icone="❌"
          classe="negativo"
        />

        <ResumoCard
          titulo="Aproveitamento"
          valor={`${resumo.aproveitamento}%`}
          icone="📈"
        />
      </div>

      <div className="estatisticas-ia-grid">
        <div className="estatisticas-ia-painel">
          <h2>Diagnóstico</h2>

          <LinhaDiagnostico
            titulo="Melhor matéria"
            valor={
              melhorMateria
                ? `${melhorMateria.materia} — ${melhorMateria.percentual}%`
                : "Sem dados"
            }
            classe="positivo"
          />

          <LinhaDiagnostico
            titulo="Matéria mais fraca"
            valor={
              piorMateria
                ? `${piorMateria.materia} — ${piorMateria.percentual}%`
                : "Sem dados"
            }
            classe="negativo"
          />

          <LinhaDiagnostico
            titulo="Média geral"
            valor={`${resumo.aproveitamento}%`}
          />

          <LinhaDiagnostico
            titulo="Total de tentativas"
            valor={String(
              resumo.totalSimulados
            )}
          />
        </div>

        <div className="estatisticas-ia-painel">
          <h2>Desempenho por matéria</h2>

          <div className="estatisticas-ia-materias">
            {materias.map((materia) => (
              <article
                key={materia.materia}
                className="estatisticas-ia-materia"
              >
                <div className="estatisticas-ia-materia-topo">
                  <div>
                    <strong>
                      {materia.materia}
                    </strong>

                    <span>
                      {materia.certas} acertos •{" "}
                      {materia.erradas} erros
                    </span>
                  </div>

                  <strong
                    className={
                      materia.percentual >= 70
                        ? "positivo"
                        : materia.percentual < 50
                          ? "negativo"
                          : ""
                    }
                  >
                    {materia.percentual}%
                  </strong>
                </div>

                <div className="estatisticas-ia-barra">
                  <div
                    style={{
                      width: `${materia.percentual}%`,
                    }}
                  />
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="estatisticas-ia-painel">
        <div className="estatisticas-ia-painel-topo">
          <div>
            <h2>Histórico de simulados</h2>

            <p>
              Resultados ordenados do mais
              recente para o mais antigo.
            </p>
          </div>
        </div>

        <div className="estatisticas-ia-historico">
          {[...resultados]
            .sort(
              (a, b) =>
                new Date(b.data).getTime() -
                new Date(a.data).getTime()
            )
            .map((resultado, indice) => (
              <article
                key={resultado.id}
                className="estatisticas-ia-resultado"
              >
                <div className="estatisticas-ia-resultado-numero">
                  {indice + 1}
                </div>

                <div className="estatisticas-ia-resultado-info">
                  <strong>
                    {resultado.nome}
                  </strong>

                  <span>
                    {formatarData(
                      resultado.data
                    )}
                  </span>
                </div>

                <div className="estatisticas-ia-resultado-dados">
                  <span>
                    {resultado.certas}/
                    {resultado.total} acertos
                  </span>

                  <strong
                    className={
                      resultado.percentual >= 70
                        ? "positivo"
                        : resultado.percentual < 50
                          ? "negativo"
                          : ""
                    }
                  >
                    {resultado.percentual}%
                  </strong>
                </div>

                <button
                  type="button"
                  className="estatisticas-ia-excluir"
                  onClick={() =>
                    excluirResultado(
                      resultado.id
                    )
                  }
                >
                  Excluir
                </button>
              </article>
            ))}
        </div>
      </div>
    </section>
  );
}

function ResumoCard({
  titulo,
  valor,
  icone,
  classe = "",
}: {
  titulo: string;
  valor: string | number;
  icone: string;
  classe?: string;
}) {
  return (
    <article className="estatisticas-ia-resumo-card">
      <span className="estatisticas-ia-icone">
        {icone}
      </span>

      <div>
        <span>{titulo}</span>

        <strong className={classe}>
          {valor}
        </strong>
      </div>
    </article>
  );
}

function LinhaDiagnostico({
  titulo,
  valor,
  classe = "",
}: {
  titulo: string;
  valor: string;
  classe?: string;
}) {
  return (
    <div className="estatisticas-ia-diagnostico">
      <span>{titulo}</span>

      <strong className={classe}>
        {valor}
      </strong>
    </div>
  );
}

function carregarResultados():
  ResultadoSimuladoIA[] {
  return carregarTodosResultados().filter(
    (resultado) => resultado.tipo !== "questoes"
  );
}

function carregarTodosResultados(): ResultadoSimuladoIA[] {
  const salvo =
    localStorage.getItem(
      CHAVE_RESULTADOS
    );

  if (!salvo) {
    return [];
  }

  try {
    const valor: unknown =
      JSON.parse(salvo);

    if (!Array.isArray(valor)) {
      return [];
    }

    return valor as ResultadoSimuladoIA[];
  } catch {
    return [];
  }
}

function salvarResultados(
  resultados: ResultadoSimuladoIA[]
) {
  const sessoesDeQuestoes = carregarTodosResultados().filter(
    (resultado) => resultado.tipo === "questoes"
  );

  localStorage.setItem(
    CHAVE_RESULTADOS,
    JSON.stringify([...resultados, ...sessoesDeQuestoes])
  );
}

function calcularEstatisticasMaterias(
  resultados: ResultadoSimuladoIA[]
): EstatisticaMateria[] {
  const mapa = new Map<
    string,
    {
      total: number;
      certas: number;
      erradas: number;
    }
  >();

  resultados.forEach((resultado) => {
    resultado.questoes.forEach(
      (questao) => {
        const atual =
          mapa.get(
            questao.materia
          ) || {
            total: 0,
            certas: 0,
            erradas: 0,
          };

        const respostaUsuario =
          resultado.respostas[
            questao.id
          ];

        const acertou =
          respostaUsuario ===
          questao.respostaCorreta;

        mapa.set(
          questao.materia,
          {
            total:
              atual.total + 1,

            certas:
              atual.certas +
              (acertou ? 1 : 0),

            erradas:
              atual.erradas +
              (acertou ? 0 : 1),
          }
        );
      }
    );
  });

  return Array.from(
    mapa.entries()
  )
    .map(([materia, dados]) => ({
      materia,
      total: dados.total,
      certas: dados.certas,
      erradas: dados.erradas,

      percentual:
        dados.total === 0
          ? 0
          : Math.round(
              (dados.certas /
                dados.total) *
                100
            ),
    }))
    .sort(
      (a, b) =>
        b.percentual -
        a.percentual
    );
}

function formatarData(
  data: string
): string {
  return new Date(
    data
  ).toLocaleString("pt-BR");
}
