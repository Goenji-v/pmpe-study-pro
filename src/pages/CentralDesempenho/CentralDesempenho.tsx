import {
  useState,
} from "react";

import "./CentralDesempenho.css";

import Estatisticas from "../Estatisticas/Estatisticas";
import HistoricoSessoes from "../HistoricoSessoes/HistoricoSessoes";
import EstatisticasSessoes from "../EstatisticasSessoes/EstatisticasSessoes";
import EstatisticasSimuladoIA from "../EstatisticasSimuladoIA/EstatisticasSimuladoIA";

type AbaDesempenho =
  | "geral"
  | "historico"
  | "sessoes"
  | "ia";

export default function CentralDesempenho() {
  const [
    abaAtiva,
    setAbaAtiva,
  ] = useState<AbaDesempenho>(
    "geral"
  );

  return (
    <section className="central-desempenho-container">
      <div className="central-desempenho-cabecalho">
        <div>
          <h1>
            📊 Central de Desempenho
          </h1>

          <p>
            Acompanhe questões, sessões,
            histórico e simulados IA em um
            único lugar.
          </p>
        </div>
      </div>

      <div
        className="central-desempenho-abas"
        role="tablist"
        aria-label="Áreas de desempenho"
      >
        <BotaoAba
          ativo={
            abaAtiva ===
            "geral"
          }
          icone="📈"
          texto="Visão geral"
          onClick={() =>
            setAbaAtiva(
              "geral"
            )
          }
        />

        <BotaoAba
          ativo={
            abaAtiva ===
            "historico"
          }
          icone="📅"
          texto="Histórico"
          onClick={() =>
            setAbaAtiva(
              "historico"
            )
          }
        />

        <BotaoAba
          ativo={
            abaAtiva ===
            "sessoes"
          }
          icone="⏱"
          texto="Sessões"
          onClick={() =>
            setAbaAtiva(
              "sessoes"
            )
          }
        />

        <BotaoAba
          ativo={
            abaAtiva ===
            "ia"
          }
          icone="🤖"
          texto="Simulados IA"
          onClick={() =>
            setAbaAtiva(
              "ia"
            )
          }
        />
      </div>

      <div className="central-desempenho-conteudo">
        {abaAtiva ===
          "geral" && (
          <Estatisticas />
        )}

        {abaAtiva ===
          "historico" && (
          <HistoricoSessoes />
        )}

        {abaAtiva ===
          "sessoes" && (
          <EstatisticasSessoes />
        )}

        {abaAtiva ===
          "ia" && (
          <EstatisticasSimuladoIA />
        )}
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
      aria-selected={
        ativo
      }
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