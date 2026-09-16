import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import type { RegistroQuestao, Simulado } from "../../types/index";
import Dashboard from "./Dashboard";
import "./DashboardDesempenhoDonut.css";

export default function DashboardOficial() {
  const navigate = useNavigate();
  const { questoes, revisoes, simulados } = useApp();
  const [alvo, setAlvo] = useState<HTMLElement | null>(null);

  const desempenho = useMemo(() => {
    const simuladosContabilizaveis = filtrarSimuladosSemEspelhoQuestoes(simulados, questoes);

    const certas =
      questoes.reduce((total, registro) => total + Math.max(0, Number(registro.certas) || 0), 0) +
      simuladosContabilizaveis.reduce((total, simulado) => total + Math.max(0, Number(simulado.certas) || 0), 0);

    const erros =
      questoes.reduce((total, registro) => total + Math.max(0, Number(registro.erradas) || 0), 0) +
      simuladosContabilizaveis.reduce((total, simulado) => total + Math.max(0, Number(simulado.erradas) || 0), 0);

    const total = certas + erros;
    const aproveitamento = total === 0 ? 0 : Math.round((certas / total) * 100);
    const percentualErros = total === 0 ? 0 : Math.max(0, 100 - aproveitamento);
    const emRevisao = revisoes.filter((revisao) => !revisao.concluida).length;

    return { certas, erros, total, aproveitamento, percentualErros, emRevisao };
  }, [questoes, revisoes, simulados]);

  useEffect(() => {
    let cancelado = false;
    let tentativas = 0;
    let timer = 0;

    const localizarPainel = () => {
      if (cancelado) return;

      const painel = document.querySelector<HTMLElement>(".dashboard-pro-performance");
      if (painel) {
        painel.classList.add("dashboard-pro-performance-donut-ready");
        setAlvo(painel);
        return;
      }

      tentativas += 1;
      if (tentativas < 20) {
        timer = window.setTimeout(localizarPainel, 50);
      }
    };

    localizarPainel();

    return () => {
      cancelado = true;
      window.clearTimeout(timer);
      const painel = document.querySelector<HTMLElement>(".dashboard-pro-performance");
      painel?.classList.remove("dashboard-pro-performance-donut-ready");
    };
  }, []);

  return (
    <>
      <Dashboard />
      {alvo && createPortal(
        <DesempenhoGeral
          aproveitamento={desempenho.aproveitamento}
          percentualErros={desempenho.percentualErros}
          emRevisao={desempenho.emRevisao}
          totalQuestoes={desempenho.total}
          onDetalhes={() => navigate("/desempenho")}
        />,
        alvo
      )}
    </>
  );
}

function DesempenhoGeral({
  aproveitamento,
  percentualErros,
  emRevisao,
  totalQuestoes,
  onDetalhes,
}: {
  aproveitamento: number;
  percentualErros: number;
  emRevisao: number;
  totalQuestoes: number;
  onDetalhes: () => void;
}) {
  const mensagem = obterMensagemDesempenho(aproveitamento, totalQuestoes);
  const estiloDonut = {
    "--dashboard-donut-acertos": `${Math.max(0, Math.min(100, aproveitamento))}%`,
  } as CSSProperties;

  return (
    <div className="dashboard-geral-donut-card">
      <header className="dashboard-geral-donut-header">
        <div>
          <span className="dashboard-pro-kicker">DESEMPENHO</span>
          <h2>Desempenho geral</h2>
          <p>Seu esforço, traduzido em evolução.</p>
        </div>
        <button type="button" onClick={onDetalhes}>Ver detalhes ↗</button>
      </header>

      <div className="dashboard-geral-donut-content">
        <div className="dashboard-geral-donut-metricas">
          <div
            className="dashboard-geral-donut"
            style={estiloDonut}
            role="img"
            aria-label={`Aproveitamento geral de ${aproveitamento}%`}
          >
            <div className="dashboard-geral-donut-centro">
              <strong>{aproveitamento}<small>%</small></strong>
              <span>APROVEITAMENTO</span>
            </div>
          </div>

          <div className="dashboard-geral-donut-legenda">
            <div><i className="acertos" /><span>Acertos</span><strong>{aproveitamento}%</strong></div>
            <div><i className="revisao" /><span>Em revisão</span><strong>{emRevisao}</strong></div>
            <div><i className="erros" /><span>Erros</span><strong>{percentualErros}%</strong></div>
          </div>
        </div>

        <div className="dashboard-geral-donut-feedback">
          <span className="dashboard-geral-feedback-icone">⌁</span>
          <div>
            <h3>{mensagem.titulo}</h3>
            <p>{mensagem.texto}</p>
            <button
              type="button"
              className="dashboard-geral-feedback-cta"
              onClick={onDetalhes}
            >
              ↗ {mensagem.acao}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function obterMensagemDesempenho(aproveitamento: number, totalQuestoes: number) {
  if (totalQuestoes === 0) {
    return {
      titulo: "Seu desempenho começa na primeira questão",
      texto: "Resolva questões para o Study Pro montar seu aproveitamento geral e mostrar sua evolução.",
      acao: "Comece e acompanhe sua evolução",
    };
  }

  if (aproveitamento >= 80) {
    return {
      titulo: "Excelente desempenho",
      texto: `Seu aproveitamento atual é ${aproveitamento}%. Continue revisando os pontos mais difíceis para sustentar esse nível.`,
      acao: "Mantenha esse ritmo",
    };
  }

  if (aproveitamento >= 65) {
    return {
      titulo: "Você está no caminho certo",
      texto: `Seu aproveitamento atual é ${aproveitamento}%. Continue acompanhando seus resultados para evoluir com consistência.`,
      acao: "Continue com essa constância",
    };
  }

  if (aproveitamento >= 50) {
    return {
      titulo: "Boa evolução, com espaço para subir",
      texto: `Seu aproveitamento atual é ${aproveitamento}%. Revisar os erros mais recorrentes pode acelerar sua evolução.`,
      acao: "Ataque os pontos fracos",
    };
  }

  return {
    titulo: "Hora de reforçar a base",
    texto: `Seu aproveitamento atual é ${aproveitamento}%. Use as revisões e o histórico de erros para priorizar o que mais precisa de atenção.`,
    acao: "Transforme erros em revisão",
  };
}

function filtrarSimuladosSemEspelhoQuestoes(
  simulados: Simulado[],
  questoes: RegistroQuestao[]
): Simulado[] {
  const tentativasJaContabilizadas = new Set(
    questoes
      .map((registro) => registro.tentativaId)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
  );

  return simulados.filter(
    (simulado) => !simulado.tentativaId || !tentativasJaContabilizadas.has(simulado.tentativaId)
  );
}
