import { useEffect, useMemo, useState } from "react";

import {
  listarErrosClienteBeta,
  listarFeedbackBeta,
  type ErroClienteBeta,
  type FeedbackBeta,
} from "../../services/betaService";

import "./BetaMonitor.css";

export default function BetaMonitor() {
  const [feedbacks, setFeedbacks] = useState<FeedbackBeta[]>([]);
  const [erros, setErros] = useState<ErroClienteBeta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  async function carregar() {
    try {
      setCarregando(true);
      setErro("");
      const [novosFeedbacks, novosErros] = await Promise.all([
        listarFeedbackBeta(40),
        listarErrosClienteBeta(40),
      ]);
      setFeedbacks(novosFeedbacks);
      setErros(novosErros);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao carregar dados do beta.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  const bugs = useMemo(
    () => feedbacks.filter((item) => item.categoria === "bug").length,
    [feedbacks]
  );

  return (
    <section className="beta-monitor">
      <header className="beta-monitor-topo">
        <div>
          <span>BETA / PRÉ-LANÇAMENTO</span>
          <h2>Feedback e erros reais</h2>
          <p>Últimos registros enviados pelos testadores e falhas capturadas automaticamente.</p>
        </div>
        <button type="button" onClick={() => void carregar()} disabled={carregando}>
          {carregando ? "Atualizando..." : "Atualizar"}
        </button>
      </header>

      <div className="beta-monitor-resumo">
        <article><strong>{feedbacks.length}</strong><span>feedbacks</span></article>
        <article><strong>{bugs}</strong><span>bugs relatados</span></article>
        <article><strong>{erros.length}</strong><span>erros capturados</span></article>
      </div>

      {erro && <div className="beta-monitor-erro">{erro}</div>}

      <div className="beta-monitor-grid">
        <section>
          <h3>Feedback recente</h3>
          {feedbacks.length === 0 ? (
            <div className="beta-monitor-vazio">Nenhum feedback recebido ainda.</div>
          ) : (
            <div className="beta-monitor-lista">
              {feedbacks.slice(0, 12).map((item) => (
                <article key={item.id}>
                  <div className="beta-monitor-item-topo">
                    <span className={`beta-monitor-tag ${item.categoria}`}>{rotuloCategoria(item.categoria)}</span>
                    <small>{formatarData(item.created_at)}</small>
                  </div>
                  <p>{item.mensagem}</p>
                  <footer>{item.pagina || "rota não informada"} · {item.viewport || "viewport desconhecida"}</footer>
                </article>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3>Erros automáticos</h3>
          {erros.length === 0 ? (
            <div className="beta-monitor-vazio">Nenhuma falha capturada.</div>
          ) : (
            <div className="beta-monitor-lista">
              {erros.slice(0, 12).map((item) => (
                <article key={item.id}>
                  <div className="beta-monitor-item-topo">
                    <span className="beta-monitor-tag erro">{item.origem}</span>
                    <small>{formatarData(item.created_at)}</small>
                  </div>
                  <p>{item.mensagem}</p>
                  <footer>{item.rota || "rota não informada"} · {item.viewport || "viewport desconhecida"}</footer>
                  <code>{item.incident_id}</code>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function rotuloCategoria(categoria: FeedbackBeta["categoria"]) {
  if (categoria === "bug") return "Bug";
  if (categoria === "visual") return "Visual";
  if (categoria === "ideia") return "Sugestão";
  return "Outro";
}

function formatarData(valor: string) {
  const data = new Date(valor);
  return Number.isNaN(data.getTime())
    ? "—"
    : data.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
}
