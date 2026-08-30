import { useEffect, useMemo, useState } from "react";

import {
  atualizarStatusErrosCliente,
  atualizarStatusFeedbackBeta,
  listarErrosClienteBeta,
  listarFeedbackBeta,
  type ErroClienteBeta,
  type FeedbackBeta,
  type StatusErroCliente,
  type StatusFeedbackBeta,
} from "../../services/betaService";
import type { UsuarioAdmin } from "../../services/adminService";
import { descreverAmbiente } from "../../utils/monitoramentoErro";

import "./BetaMonitor.css";

type GrupoErro = {
  chave: string;
  itens: ErroClienteBeta[];
  ultimo: ErroClienteBeta;
  usuariosAfetados: number;
  status: StatusErroCliente;
};

export default function BetaMonitor({ usuarios }: { usuarios: UsuarioAdmin[] }) {
  const [feedbacks, setFeedbacks] = useState<FeedbackBeta[]>([]);
  const [erros, setErros] = useState<ErroClienteBeta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [atualizandoId, setAtualizandoId] = useState<string | null>(null);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [mostrarResolvidos, setMostrarResolvidos] = useState(false);

  async function carregar() {
    try {
      setCarregando(true);
      setErro("");
      const [novosFeedbacks, novosErros] = await Promise.all([
        listarFeedbackBeta(60),
        listarErrosClienteBeta(100),
      ]);
      setFeedbacks(novosFeedbacks);
      setErros(novosErros);
      setRespostas((atuais) => {
        const proximas = { ...atuais };
        novosFeedbacks.forEach((item) => {
          if (proximas[item.id] === undefined) proximas[item.id] = item.resposta_admin ?? "";
        });
        return proximas;
      });
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao carregar dados do beta.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  const usuariosPorId = useMemo(
    () => new Map(usuarios.map((usuario) => [usuario.userId, usuario])),
    [usuarios]
  );

  const bugs = useMemo(
    () => feedbacks.filter((item) => item.categoria === "bug").length,
    [feedbacks]
  );

  const pendentes = useMemo(
    () => feedbacks.filter((item) => item.status === "em_analise").length,
    [feedbacks]
  );

  const gruposErros = useMemo<GrupoErro[]>(() => {
    const mapa = new Map<string, ErroClienteBeta[]>();

    erros.forEach((item) => {
      const chave = item.fingerprint || item.incident_id;
      mapa.set(chave, [...(mapa.get(chave) ?? []), item]);
    });

    return [...mapa.entries()]
      .map(([chave, itens]) => {
        const ordenados = [...itens].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const aberto = ordenados.some((item) => item.status === "aberto");
        const status: StatusErroCliente = aberto ? "aberto" : "resolvido";

        return {
          chave,
          itens: ordenados,
          ultimo: ordenados[0],
          usuariosAfetados: new Set(ordenados.map((item) => item.user_id)).size,
          status,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.ultimo.created_at).getTime() -
          new Date(a.ultimo.created_at).getTime()
      );
  }, [erros]);

  const errosAbertos = gruposErros.filter((grupo) => grupo.status === "aberto").length;
  const gruposVisiveis = mostrarResolvidos
    ? gruposErros
    : gruposErros.filter((grupo) => grupo.status === "aberto");

  async function mudarStatus(item: FeedbackBeta, status: StatusFeedbackBeta) {
    try {
      setAtualizandoId(item.id);
      setErro("");
      await atualizarStatusFeedbackBeta(item, status, respostas[item.id] ?? "");
      const agora = new Date().toISOString();
      setFeedbacks((atuais) =>
        atuais.map((feedback) =>
          feedback.id === item.id
            ? {
                ...feedback,
                status,
                resposta_admin: (respostas[item.id] ?? "").trim() || null,
                atualizado_em: agora,
                resolvido_em: status === "concluido" || status === "rejeitado" ? agora : null,
              }
            : feedback
        )
      );
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível atualizar o feedback.");
    } finally {
      setAtualizandoId(null);
    }
  }

  async function mudarStatusErro(grupo: GrupoErro, status: StatusErroCliente) {
    try {
      setAtualizandoId(grupo.chave);
      setErro("");
      const ids = grupo.itens.map((item) => item.id);
      await atualizarStatusErrosCliente(ids, status);
      const resolvidoEm = status === "resolvido" ? new Date().toISOString() : null;
      setErros((atuais) =>
        atuais.map((item) =>
          ids.includes(item.id)
            ? { ...item, status, resolvido_em: resolvidoEm }
            : item
        )
      );
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível atualizar o erro.");
    } finally {
      setAtualizandoId(null);
    }
  }

  return (
    <section className="beta-monitor">
      <header className="beta-monitor-topo">
        <div>
          <span>BETA / PRODUÇÃO</span>
          <h2>Feedback e erros reais</h2>
          <p>Monitore falhas reais por rota, versão, navegador e dispositivo.</p>
        </div>
        <button type="button" onClick={() => void carregar()} disabled={carregando}>
          {carregando ? "Atualizando..." : "Atualizar"}
        </button>
      </header>

      <div className="beta-monitor-resumo">
        <article><strong>{feedbacks.length}</strong><span>feedbacks</span></article>
        <article><strong>{pendentes}</strong><span>em análise</span></article>
        <article><strong>{bugs}</strong><span>bugs relatados</span></article>
        <article><strong>{errosAbertos}</strong><span>erros abertos</span></article>
      </div>

      {erro && <div className="beta-monitor-erro">{erro}</div>}

      <div className="beta-monitor-grid">
        <section>
          <h3>Solicitações dos testadores</h3>
          {feedbacks.length === 0 ? (
            <div className="beta-monitor-vazio">Nenhum feedback recebido ainda.</div>
          ) : (
            <div className="beta-monitor-lista">
              {feedbacks.slice(0, 20).map((item) => {
                const usuario = usuariosPorId.get(item.user_id);
                const fechado = item.status === "concluido" || item.status === "rejeitado";
                return (
                  <article key={item.id} className={`beta-monitor-feedback ${item.status}`}>
                    <div className="beta-monitor-item-topo">
                      <div className="beta-monitor-tags">
                        <span className={`beta-monitor-tag ${item.categoria}`}>{rotuloCategoria(item.categoria)}</span>
                        <span className={`beta-monitor-status ${item.status}`}>{rotuloStatus(item.status)}</span>
                      </div>
                      <small>{formatarData(item.created_at)}</small>
                    </div>

                    <div className="beta-monitor-autor">
                      <strong>{usuario?.nome || "Usuário"}</strong>
                      <span>{usuario?.email || item.user_id}</span>
                    </div>

                    <p>{item.mensagem}</p>
                    <footer>{item.pagina || "rota não informada"} · {item.viewport || "viewport desconhecida"}</footer>

                    <label className="beta-monitor-resposta">
                      <span>Resposta para o testador</span>
                      <textarea
                        rows={2}
                        maxLength={1500}
                        value={respostas[item.id] ?? ""}
                        disabled={fechado || atualizandoId === item.id}
                        onChange={(evento) =>
                          setRespostas((atuais) => ({ ...atuais, [item.id]: evento.target.value }))
                        }
                        placeholder="Opcional: explique o que foi feito ou por que não será aplicado."
                      />
                    </label>

                    <div className="beta-monitor-acoes">
                      {item.status === "em_analise" && (
                        <>
                          <button type="button" className="aprovar" disabled={atualizandoId === item.id} onClick={() => void mudarStatus(item, "aprovado")}>Aprovar</button>
                          <button type="button" className="rejeitar" disabled={atualizandoId === item.id} onClick={() => void mudarStatus(item, "rejeitado")}>Rejeitar</button>
                        </>
                      )}
                      {item.status === "aprovado" && (
                        <>
                          <button type="button" className="concluir" disabled={atualizandoId === item.id} onClick={() => void mudarStatus(item, "concluido")}>Concluir</button>
                          <button type="button" className="rejeitar" disabled={atualizandoId === item.id} onClick={() => void mudarStatus(item, "rejeitado")}>Rejeitar</button>
                        </>
                      )}
                      {fechado && (
                        <span className="beta-monitor-finalizado">{item.status === "concluido" ? "Solicitação concluída" : "Solicitação rejeitada"}</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <div className="beta-monitor-secao-topo">
            <div>
              <h3>Erros automáticos</h3>
              <small>{gruposErros.length} tipos · {erros.length} ocorrências</small>
            </div>
            <button type="button" onClick={() => setMostrarResolvidos((valor) => !valor)}>
              {mostrarResolvidos ? "Ocultar resolvidos" : "Ver resolvidos"}
            </button>
          </div>

          {gruposVisiveis.length === 0 ? (
            <div className="beta-monitor-vazio">
              {gruposErros.length === 0 ? "Nenhuma falha capturada." : "Nenhum erro aberto."}
            </div>
          ) : (
            <div className="beta-monitor-lista">
              {gruposVisiveis.slice(0, 20).map((grupo) => {
                const item = grupo.ultimo;
                const usuario = usuariosPorId.get(item.user_id);
                return (
                  <article key={grupo.chave} className={`beta-monitor-erro-card ${grupo.status}`}>
                    <div className="beta-monitor-item-topo">
                      <div className="beta-monitor-tags">
                        <span className="beta-monitor-tag erro">{item.origem}</span>
                        <span className={`beta-monitor-status ${grupo.status}`}>
                          {grupo.status === "aberto" ? "Aberto" : "Resolvido"}
                        </span>
                      </div>
                      <small>{formatarData(item.created_at)}</small>
                    </div>

                    <div className="beta-monitor-autor">
                      <strong>{usuario?.nome || "Usuário"}</strong>
                      <span>{usuario?.email || item.user_id}</span>
                    </div>

                    <p>{item.mensagem}</p>
                    <div className="beta-monitor-meta">
                      <span>{item.rota || "rota não informada"}</span>
                      <span>{item.viewport || "viewport desconhecida"}</span>
                      <span>{descreverAmbiente(item.user_agent)}</span>
                      <span>versão {item.app_version || "desconhecida"}</span>
                    </div>
                    <footer>
                      {grupo.itens.length} ocorrência{grupo.itens.length === 1 ? "" : "s"} · {grupo.usuariosAfetados} usuário{grupo.usuariosAfetados === 1 ? "" : "s"}
                    </footer>
                    <code>{grupo.chave}</code>

                    {(item.stack || item.user_agent) && (
                      <details className="beta-monitor-detalhes">
                        <summary>Detalhes técnicos</summary>
                        {item.user_agent && <code>{item.user_agent}</code>}
                        {item.stack && <pre>{item.stack}</pre>}
                      </details>
                    )}

                    <div className="beta-monitor-acoes">
                      {grupo.status === "aberto" ? (
                        <button type="button" className="concluir" disabled={atualizandoId === grupo.chave} onClick={() => void mudarStatusErro(grupo, "resolvido")}>Marcar resolvido</button>
                      ) : (
                        <button type="button" className="aprovar" disabled={atualizandoId === grupo.chave} onClick={() => void mudarStatusErro(grupo, "aberto")}>Reabrir</button>
                      )}
                    </div>
                  </article>
                );
              })}
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

function rotuloStatus(status: StatusFeedbackBeta) {
  if (status === "aprovado") return "Aprovado";
  if (status === "concluido") return "Concluído";
  if (status === "rejeitado") return "Rejeitado";
  return "Em análise";
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
