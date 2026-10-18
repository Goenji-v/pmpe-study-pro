import { useEstadoNavegacao } from "../../hooks/useEstadoNavegacao";

import "./CentralDesempenho.css";

import { lazy, Suspense } from "react";

const Estatisticas = lazy(() => import("../Estatisticas/Estatisticas"));
const HistoricoSessoes = lazy(() => import("../HistoricoSessoes/HistoricoSessoes"));
const EstatisticasSessoes = lazy(() => import("../EstatisticasSessoes/EstatisticasSessoes"));
const EstatisticasSimuladoIA = lazy(() => import("../EstatisticasSimuladoIA/EstatisticasSimuladoIA"));
const SimuladosOficiaisDesempenho = lazy(
  () => import("../../components/SimuladosOficiaisDesempenho/SimuladosOficiaisDesempenho")
);

type AbaDesempenho =
  | "geral"
  | "historico"
  | "sessoes"
  | "ia";

export default function CentralDesempenho() {
  const [
    abaAtiva,
    setAbaAtiva,
  ] = useEstadoNavegacao<AbaDesempenho>(
    "desempenho:aba", "geral"
  );

  return (
    <section className="central-desempenho-container">
      <div className="central-desempenho-cabecalho">
        <div>
          <h1>
            📊 Central de Desempenho
          </h1>

          <p>
            Visão geral, estatísticas,
            histórico, sessões e simulados IA
            reunidos em um único lugar.
          </p>
        </div>
      </div>

      <div
        className="central-desempenho-abas"
        role="tablist"
        aria-label="Áreas de desempenho"
      >
        <BotaoAba
          ativo={abaAtiva === "geral"}
          icone="📈"
          texto="Visão geral e estatísticas"
          onClick={() => setAbaAtiva("geral")}
        />

        <BotaoAba
          ativo={abaAtiva === "historico"}
          icone="📅"
          texto="Histórico"
          onClick={() => setAbaAtiva("historico")}
        />

        <BotaoAba
          ativo={abaAtiva === "sessoes"}
          icone="⏱"
          texto="Sessões"
          onClick={() => setAbaAtiva("sessoes")}
        />

        <BotaoAba
          ativo={abaAtiva === "ia"}
          icone="🤖"
          texto="Simulados IA"
          onClick={() => setAbaAtiva("ia")}
        />
      </div>

      <div className="central-desempenho-conteudo">
        <Suspense fallback={<p role="status" aria-live="polite">Carregando indicadores de desempenho…</p>}>
        {abaAtiva === "geral" && (
          <>
            <Estatisticas />
            <SimuladosOficiaisDesempenho />
          </>
        )}

        {abaAtiva === "historico" && <HistoricoSessoes />}
        {abaAtiva === "sessoes" && <EstatisticasSessoes />}
        {abaAtiva === "ia" && <EstatisticasSimuladoIA />}
        </Suspense>
      </div>
    </section>
  );
}

function BotaoAba({
  ativo,
  icone,
  texto,
  onClick,
}: {
  ativo: boolean;
  icone: string;
  texto: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={ativo}
      className={
        ativo
          ? "central-desempenho-aba central-desempenho-aba-ativa"
          : "central-desempenho-aba"
      }
      onClick={onClick}
    >
      <span>{icone}</span>
      <strong>{texto}</strong>
    </button>
  );
}
