import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { useApp } from "../../context/AppContext";
import "./DashboardAdaptivePreview.css";

const TOTAL_PROVA_PMPE = 60;
const META_SEGURANCA_PMPE = 40;

type PrioridadeAdaptativa = {
  materia: string;
  percentual: number;
  total: number;
  nivel: "alta" | "media" | "manter";
};

export default function DashboardAdaptivePreview() {
  const navigate = useNavigate();
  const { questoes, revisoes, configuracoes } = useApp();

  const desempenho = useMemo(() => {
    const certas = questoes.reduce(
      (total, item) => total + Math.max(0, Number(item.certas) || 0),
      0
    );
    const erradas = questoes.reduce(
      (total, item) => total + Math.max(0, Number(item.erradas) || 0),
      0
    );
    const total = certas + erradas;
    const percentual = total > 0 ? Math.round((certas / total) * 100) : 0;
    const projecao = total > 0
      ? Math.round((certas / total) * TOTAL_PROVA_PMPE)
      : 0;

    return { certas, erradas, total, percentual, projecao };
  }, [questoes]);

  const prioridades = useMemo<PrioridadeAdaptativa[]>(() => {
    const mapa = new Map<string, { certas: number; erradas: number }>();

    questoes.forEach((item) => {
      const materia = String(item.materia || "").trim();
      if (!materia) return;

      const atual = mapa.get(materia) ?? { certas: 0, erradas: 0 };
      mapa.set(materia, {
        certas: atual.certas + Math.max(0, Number(item.certas) || 0),
        erradas: atual.erradas + Math.max(0, Number(item.erradas) || 0),
      });
    });

    return [...mapa.entries()]
      .map(([materia, dados]) => {
        const total = dados.certas + dados.erradas;
        const percentual = total > 0 ? Math.round((dados.certas / total) * 100) : 0;
        const nivel: PrioridadeAdaptativa["nivel"] =
          percentual < 60 ? "alta" : percentual < 75 ? "media" : "manter";

        return { materia, percentual, total, nivel };
      })
      .filter((item) => item.total > 0)
      .sort((a, b) => a.percentual - b.percentual || b.total - a.total)
      .slice(0, 3);
  }, [questoes]);

  const agora = new Date();
  agora.setHours(23, 59, 59, 999);

  const revisoesVencidas = revisoes
    .filter((item) => !item.concluida && new Date(item.dataPrevista).getTime() <= agora.getTime())
    .sort(
      (a, b) =>
        new Date(a.dataPrevista).getTime() - new Date(b.dataPrevista).getTime()
    );

  const prioridadePrincipal = prioridades[0] ?? null;
  const proximaRevisao = revisoesVencidas[0] ?? null;

  const recomendacao = proximaRevisao
    ? {
        selo: "REVISÃO PRIORITÁRIA",
        titulo: `${proximaRevisao.materia} — ${proximaRevisao.assunto}`,
        texto: `Você tem ${revisoesVencidas.length} revisão${revisoesVencidas.length === 1 ? "" : "ões"} para colocar em dia. Começar por esta tarefa protege sua retenção.`,
        acao: "Começar revisão",
        destino: "/revisoes",
      }
    : prioridadePrincipal
      ? {
          selo: "PRIORIDADE ADAPTATIVA",
          titulo: `Reforçar ${prioridadePrincipal.materia}`,
          texto: `Seu aproveitamento está em ${prioridadePrincipal.percentual}%. Faça uma bateria curta de questões antes de avançar para outro ponto.`,
          acao: "Fazer questões",
          destino: "/questoes",
        }
      : {
          selo: "PRÓXIMA AÇÃO",
          titulo: "Criar sua primeira leitura de desempenho",
          texto: "Resolva algumas questões para o Study Pro identificar automaticamente onde você precisa reforçar.",
          acao: "Abrir questões",
          destino: "/questoes",
        };

  const faltam = Math.max(0, META_SEGURANCA_PMPE - desempenho.projecao);
  const progressoMeta = desempenho.total > 0
    ? Math.min(100, Math.round((desempenho.projecao / META_SEGURANCA_PMPE) * 100))
    : 0;

  const itensPlano = prioridades.length > 0
    ? prioridades
    : [
        {
          materia: "Diagnóstico inicial",
          percentual: 0,
          total: 0,
          nivel: "alta" as const,
        },
      ];

  return (
    <section className="dashboard-adaptive-preview" aria-label="Planejamento adaptativo">
      <article className="dashboard-adaptive-goal">
        <div className="dashboard-adaptive-heading">
          <span className="dashboard-adaptive-kicker">META PMPE</span>
          <span className="dashboard-adaptive-live">● AO VIVO</span>
        </div>

        <div className="dashboard-adaptive-goal-main">
          <div>
            <strong>
              {desempenho.total > 0 ? desempenho.projecao : "—"}
              <small>/60</small>
            </strong>
            <span>projeção pelo seu histórico</span>
          </div>

          <div className="dashboard-adaptive-target">
            <span>Meta de segurança</span>
            <strong>{META_SEGURANCA_PMPE}/60</strong>
          </div>
        </div>

        <div className="dashboard-adaptive-progress">
          <div style={{ width: `${progressoMeta}%` }} />
        </div>

        <p>
          {desempenho.total === 0
            ? "Comece resolvendo questões para gerar sua projeção."
            : faltam === 0
              ? "Você já alcançou a meta de segurança desta prévia. Agora o foco é sustentar o desempenho."
              : `Faltam aproximadamente ${faltam} ponto${faltam === 1 ? "" : "s"} para chegar à meta de segurança.`}
        </p>
      </article>

      <article className="dashboard-adaptive-now">
        <div className="dashboard-adaptive-heading">
          <span className="dashboard-adaptive-kicker">O QUE FAÇO AGORA?</span>
          <span className="dashboard-adaptive-ai">IA</span>
        </div>

        <span className="dashboard-adaptive-tag">{recomendacao.selo}</span>
        <h2>{recomendacao.titulo}</h2>
        <p>{recomendacao.texto}</p>

        <button type="button" onClick={() => navigate(recomendacao.destino)}>
          ▶ {recomendacao.acao}
        </button>
      </article>

      <article className="dashboard-adaptive-plan">
        <div className="dashboard-adaptive-heading">
          <div>
            <span className="dashboard-adaptive-kicker">PLANEJAMENTO ADAPTATIVO</span>
            <h2>Prioridades inteligentes</h2>
          </div>
          <button type="button" onClick={() => navigate("/desempenho")}>
            Ver detalhes ↗
          </button>
        </div>

        <div className="dashboard-adaptive-list">
          {itensPlano.map((item, indice) => {
            const descricao =
              item.total === 0
                ? "Faça questões para liberar a análise automática."
                : item.nivel === "alta"
                  ? "Reforçar agora • teoria curta + questões"
                  : item.nivel === "media"
                    ? "Consolidar • bateria de questões"
                    : "Manter • revisão espaçada";

            return (
              <div className="dashboard-adaptive-item" key={item.materia}>
                <span className="dashboard-adaptive-rank">{String(indice + 1).padStart(2, "0")}</span>
                <div className="dashboard-adaptive-item-copy">
                  <strong>{item.materia}</strong>
                  <span>{descricao}</span>
                </div>
                <div className={`dashboard-adaptive-score ${item.nivel}`}>
                  <strong>{item.total > 0 ? `${item.percentual}%` : "—"}</strong>
                  <span>{item.nivel === "alta" ? "prioridade" : item.nivel === "media" ? "atenção" : "manter"}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="dashboard-adaptive-foot">
          <span>◎ Baseado em acertos, erros e revisões pendentes</span>
          <span>{configuracoes.concurso || "PMPE"}</span>
        </div>
      </article>
    </section>
  );
}
