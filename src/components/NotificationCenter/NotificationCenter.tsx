import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useApp } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import { useAdminStatus } from "../../hooks/useAdminStatus";
import {
  listarFeedbackBeta,
  type FeedbackBeta,
} from "../../services/betaService";
import {
  listarNotificacoes,
  marcarNotificacaoLida,
  marcarTodasNotificacoesLidas,
  type NotificacaoInterna,
} from "../../services/notificacoesService";
import {
  criarPlanoCalendario,
  normalizarMissoesPorDia,
  obterDiaAtualPlano,
} from "../../utils/planoCalendario";
import { getSemanaAtual } from "../../utils/planoUtils";

import "./NotificationCenter.css";

type AvisoRapido = {
  titulo: string;
  mensagem: string;
  rota?: string;
};

export default function NotificationCenter() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { administrador } = useAdminStatus();
  const { configuracoes, missoesConcluidas } = useApp();

  const [aberto, setAberto] = useState(false);
  const [notificacoes, setNotificacoes] = useState<NotificacaoInterna[]>([]);
  const [feedbacksPendentes, setFeedbacksPendentes] = useState<FeedbackBeta[]>([]);
  const [aviso, setAviso] = useState<AvisoRapido | null>(null);
  const [sumindo, setSumindo] = useState(false);

  const plano = useMemo(
    () => criarPlanoCalendario(normalizarMissoesPorDia(configuracoes.missoesPorDia ?? 1)),
    [configuracoes.missoesPorDia]
  );

  const missaoHoje = useMemo(() => {
    const semana = getSemanaAtual(missoesConcluidas, plano, configuracoes.semanaAtualPlano);
    const dia = obterDiaAtualPlano();
    const concluidas = new Set(missoesConcluidas);
    const semanaAtual = plano.find((item) => item.numero === semana);
    const diaAtual = semanaAtual?.dias.find((item) => item.numero === dia);
    const missao = diaAtual?.missoes.find((item) => !concluidas.has(item.id));
    return missao ? { semana, dia, missao } : null;
  }, [configuracoes.semanaAtualPlano, missoesConcluidas, plano]);

  async function carregar() {
    if (!usuario?.id) return;

    try {
      const novas = await listarNotificacoes(50);
      setNotificacoes(novas);

      if (administrador) {
        const feedbacks = await listarFeedbackBeta(100);
        setFeedbacksPendentes(feedbacks.filter((item) => item.status === "em_analise"));
      } else {
        setFeedbacksPendentes([]);
      }
    } catch (error) {
      console.warn("Não foi possível atualizar notificações:", error);
    }
  }

  useEffect(() => {
    void carregar();
    const intervalo = window.setInterval(() => void carregar(), 60000);
    const aoFocar = () => void carregar();
    window.addEventListener("focus", aoFocar);
    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener("focus", aoFocar);
    };
  }, [usuario?.id, administrador]);

  useEffect(() => {
    const abrir = () => {
      setAberto(true);
      void carregar();
    };
    window.addEventListener("pmpe:notificacoes:abrir", abrir);
    return () => window.removeEventListener("pmpe:notificacoes:abrir", abrir);
  }, [usuario?.id, administrador]);

  useEffect(() => {
    if (!usuario?.id) return;

    const chaveSessao = `pmpe:${usuario.id}:aviso-entrada`;
    if (sessionStorage.getItem(chaveSessao)) return;

    sessionStorage.setItem(chaveSessao, "1");

    const timer = window.setTimeout(() => {
      if (missaoHoje) {
        mostrarAviso({
          titulo: "Missão de hoje",
          mensagem: `${missaoHoje.missao.materia} — ${missaoHoje.missao.assunto}`,
          rota: "/plano",
        });
      }
    }, 900);

    return () => window.clearTimeout(timer);
  }, [usuario?.id, missaoHoje?.missao.id]);

  useEffect(() => {
    if (!administrador || !usuario?.id || feedbacksPendentes.length === 0) return;

    const maisNovo = feedbacksPendentes[0];
    const chave = `pmpe:${usuario.id}:ultimo-feedback-admin-visto`;
    if (localStorage.getItem(chave) === maisNovo.id) return;

    localStorage.setItem(chave, maisNovo.id);
    mostrarAviso({
      titulo: "Novo feedback no beta",
      mensagem: `Você tem ${feedbacksPendentes.length} feedback${feedbacksPendentes.length === 1 ? "" : "s"} em análise.`,
      rota: "/admin",
    });
  }, [administrador, usuario?.id, feedbacksPendentes]);

  function mostrarAviso(novoAviso: AvisoRapido) {
    setSumindo(false);
    setAviso(novoAviso);
    window.setTimeout(() => setSumindo(true), 8000);
    window.setTimeout(() => {
      setAviso((atual) => (atual === novoAviso ? null : atual));
      setSumindo(false);
    }, 10000);
  }

  async function abrirNotificacao(item: NotificacaoInterna) {
    try {
      if (!item.lida) {
        await marcarNotificacaoLida(item.id);
        setNotificacoes((atuais) =>
          atuais.map((notificacao) =>
            notificacao.id === item.id ? { ...notificacao, lida: true } : notificacao
          )
        );
      }
    } catch (error) {
      console.warn("Falha ao marcar notificação como lida:", error);
    }

    setAberto(false);
    if (item.rota) navigate(item.rota);
  }

  async function marcarTodas() {
    try {
      await marcarTodasNotificacoesLidas();
      setNotificacoes((atuais) => atuais.map((item) => ({ ...item, lida: true })));
    } catch (error) {
      console.warn("Falha ao marcar notificações como lidas:", error);
    }
  }

  const naoLidas = notificacoes.filter((item) => !item.lida).length;
  const totalPendencias = naoLidas + (administrador ? feedbacksPendentes.length : 0);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("pmpe:notificacoes:contador", { detail: { total: totalPendencias } })
    );
  }, [totalPendencias]);

  return (
    <>
      {aviso && (
        <button
          type="button"
          className={`notificacao-toast ${sumindo ? "sumindo" : ""}`}
          onClick={() => {
            setAviso(null);
            if (aviso.rota) navigate(aviso.rota);
          }}
        >
          <span className="notificacao-toast-icone">🔔</span>
          <span>
            <strong>{aviso.titulo}</strong>
            <small>{aviso.mensagem}</small>
          </span>
        </button>
      )}

      {aberto && (
        <div className="notificacoes-overlay" role="presentation" onMouseDown={() => setAberto(false)}>
          <aside className="notificacoes-painel" onMouseDown={(evento) => evento.stopPropagation()}>
            <header>
              <div>
                <span>CENTRAL</span>
                <h2>Notificações</h2>
              </div>
              <button type="button" onClick={() => setAberto(false)} aria-label="Fechar">×</button>
            </header>

            {missaoHoje && (
              <button className="notificacao-item destaque" type="button" onClick={() => { setAberto(false); navigate("/plano"); }}>
                <strong>Missão de hoje</strong>
                <span>{missaoHoje.missao.materia} — {missaoHoje.missao.assunto}</span>
                <small>Semana {missaoHoje.semana}</small>
              </button>
            )}

            {administrador && feedbacksPendentes.length > 0 && (
              <button className="notificacao-item admin" type="button" onClick={() => { setAberto(false); navigate("/admin"); }}>
                <strong>Feedbacks aguardando análise</strong>
                <span>{feedbacksPendentes.length} solicitação{feedbacksPendentes.length === 1 ? "" : "ões"} pendente{feedbacksPendentes.length === 1 ? "" : "s"}.</span>
                <small>Abrir Administração</small>
              </button>
            )}

            <div className="notificacoes-lista">
              {notificacoes.length === 0 ? (
                <div className="notificacoes-vazio">Nenhuma outra notificação.</div>
              ) : (
                notificacoes.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={`notificacao-item ${item.lida ? "lida" : "nao-lida"}`}
                    onClick={() => void abrirNotificacao(item)}
                  >
                    <strong>{item.titulo}</strong>
                    <span>{item.mensagem}</span>
                    <small>{formatarData(item.created_at)}</small>
                  </button>
                ))
              )}
            </div>

            {naoLidas > 0 && (
              <footer>
                <button type="button" onClick={() => void marcarTodas()}>Marcar todas como lidas</button>
              </footer>
            )}
          </aside>
        </div>
      )}
    </>
  );
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
