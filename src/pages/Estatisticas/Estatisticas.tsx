import "./Estatisticas.css";

import {
  BarChart,
  Bar,
  CartesianGrid,
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useApp } from "../../context/AppContext";

import {
  calcularAproveitamentoGeral,
  calcularResumoPorAssunto,
  calcularResumoPorMateria,
  calcularTotalQuestoes,
} from "../../utils/analytics";

type EvolucaoDia = {
  data: string;
  certas: number;
  erradas: number;
  total: number;
  aproveitamento: number;
};

export default function Estatisticas() {
  const { questoes } = useApp();

  const resumoMaterias = calcularResumoPorMateria(questoes);
  const resumoAssuntos = calcularResumoPorAssunto(questoes);

  const totalQuestoes = calcularTotalQuestoes(questoes);
  const aproveitamentoGeral = calcularAproveitamentoGeral(questoes);

  const totalCertas = questoes.reduce(
    (total, registro) => total + registro.certas,
    0
  );

  const totalErradas = questoes.reduce(
    (total, registro) => total + registro.erradas,
    0
  );

  const evolucaoPorDia = calcularEvolucaoPorDia();

  function calcularEvolucaoPorDia(): EvolucaoDia[] {
    const mapa = new Map<
      string,
      {
        certas: number;
        erradas: number;
      }
    >();

    questoes.forEach((registro) => {
      const data = registro.data.slice(0, 10);

      const atual = mapa.get(data) || {
        certas: 0,
        erradas: 0,
      };

      mapa.set(data, {
        certas: atual.certas + registro.certas,
        erradas: atual.erradas + registro.erradas,
      });
    });

    return Array.from(mapa.entries())
      .map(([data, valores]) => {
        const total = valores.certas + valores.erradas;

        const aproveitamento =
          total === 0
            ? 0
            : Math.round((valores.certas / total) * 100);

        return {
          data: formatarData(data),
          certas: valores.certas,
          erradas: valores.erradas,
          total,
          aproveitamento,
        };
      })
      .sort((a, b) => {
        const [diaA, mesA] = a.data.split("/");
        const [diaB, mesB] = b.data.split("/");

        return (
          Number(mesA) * 31 +
          Number(diaA) -
          (Number(mesB) * 31 + Number(diaB))
        );
      });
  }

  function formatarData(data: string) {
    const [, mes, dia] = data.split("-");

    return `${dia}/${mes}`;
  }

  function corDesempenho(percentual: number) {
    if (percentual >= 80) return "desempenho-bom";
    if (percentual >= 60) return "desempenho-atencao";

    return "desempenho-critico";
  }

  if (questoes.length === 0) {
    return (
      <section className="estatisticas-container">
        <h1 className="estatisticas-title">📊 Estatísticas</h1>

        <p className="estatisticas-subtitle">
          Acompanhe sua evolução por matéria e assunto.
        </p>

        <div className="estatisticas-vazio">
          <h2>Nenhum dado disponível</h2>

          <p>
            Registre questões para visualizar gráficos e análises.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="estatisticas-container">
      <h1 className="estatisticas-title">📊 Estatísticas</h1>

      <p className="estatisticas-subtitle">
        Análise consolidada do seu desempenho.
      </p>

      <div className="estatisticas-cards">
        <div className="estatistica-card">
          <span>Total de questões</span>
          <strong>{totalQuestoes}</strong>
        </div>

        <div className="estatistica-card">
          <span>Aproveitamento geral</span>
          <strong>{aproveitamentoGeral}%</strong>
        </div>

        <div className="estatistica-card">
          <span>Total de acertos</span>
          <strong className="texto-verde">{totalCertas}</strong>
        </div>

        <div className="estatistica-card">
          <span>Total de erros</span>
          <strong className="texto-vermelho">{totalErradas}</strong>
        </div>
      </div>

      <div className="graficos-grid">
        <div className="grafico-card">
          <h2>Aproveitamento por matéria</h2>

          <p className="grafico-descricao">
            Percentual acumulado de acertos em cada disciplina.
          </p>

          <div className="grafico-area">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={resumoMaterias}
                margin={{
                  top: 20,
                  right: 20,
                  left: 0,
                  bottom: 40,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                />

                <XAxis
                  dataKey="materia"
                  stroke="#94a3b8"
                  angle={-20}
                  textAnchor="end"
                  height={70}
                  interval={0}
                />

                <YAxis
                  stroke="#94a3b8"
                  domain={[0, 100]}
                />

                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: 10,
                  }}
                  formatter={(value) => [`${value}%`, "Aproveitamento"]}
                />

                <Bar
                  dataKey="aproveitamento"
                  fill="#3b82f6"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grafico-card">
          <h2>Evolução por dia</h2>

          <p className="grafico-descricao">
            Aproveitamento diário nos blocos de questões.
          </p>

          <div className="grafico-area">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={evolucaoPorDia}
                margin={{
                  top: 20,
                  right: 20,
                  left: 0,
                  bottom: 20,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                />

                <XAxis
                  dataKey="data"
                  stroke="#94a3b8"
                />

                <YAxis
                  stroke="#94a3b8"
                  domain={[0, 100]}
                />

                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: 10,
                  }}
                  formatter={(value) => [`${value}%`, "Aproveitamento"]}
                />

                <Line
                  type="monotone"
                  dataKey="aproveitamento"
                  stroke="#22c55e"
                  strokeWidth={3}
                  dot={{
                    fill: "#22c55e",
                    strokeWidth: 2,
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="estatisticas-tabelas">
        <div className="estatisticas-painel">
          <h2>🏆 Ranking de matérias</h2>

          <div className="ranking-estatisticas">
            {resumoMaterias.map((materia, indice) => (
              <div
                className="ranking-estatistica-item"
                key={materia.materia}
              >
                <div>
                  <strong>
                    {indice + 1}º {materia.materia}
                  </strong>

                  <p>
                    {materia.total} questões · {materia.certas} certas ·{" "}
                    {materia.erradas} erradas
                  </p>
                </div>

                <span
                  className={corDesempenho(
                    materia.aproveitamento
                  )}
                >
                  {materia.aproveitamento}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="estatisticas-painel">
          <h2>🎯 Desempenho por assunto</h2>

          <div className="ranking-estatisticas">
            {resumoAssuntos.slice(0, 10).map((assunto) => (
              <div
                className="ranking-estatistica-item"
                key={`${assunto.materia}-${assunto.assunto}`}
              >
                <div>
                  <strong>{assunto.assunto}</strong>

                  <p>
                    {assunto.materia} · {assunto.modulo} · {assunto.total} questões
                  </p>
                </div>

                <span
                  className={corDesempenho(
                    assunto.aproveitamento
                  )}
                >
                  {assunto.aproveitamento}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}