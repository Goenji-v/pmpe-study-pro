import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";

import "./DashboardGamificacaoSpotlight.css";
import "./DashboardMoedas.css";

import { useApp } from "../../context/AppContext";
import { obterEstadoEconomia } from "../../services/economiaGamificacao";
import { calcularGamificacao } from "../../services/gamificacaoService";
import { encontrarItemLoja } from "../../services/lojaGamificacao";

const XP_POR_NIVEL = 250;

export default function DashboardGamificacaoSpotlight() {
  const location = useLocation();
  const navigate = useNavigate();
  const { sessoes, questoes, revisoes, simulados, configuracoes } = useApp();
  const [destino, setDestino] = useState<HTMLElement | null>(null);

  const gamificacao = useMemo(
    () =>
      calcularGamificacao({
        sessoes,
        questoes,
        revisoes,
        simulados,
      }),
    [sessoes, questoes, revisoes, simulados]
  );

  const economia = useMemo(
    () => obterEstadoEconomia(configuracoes),
    [configuracoes]
  );

  const tituloEquipado = encontrarItemLoja(economia.tituloEquipado);
  const molduraEquipada = encontrarItemLoja(economia.molduraEquipada);
  const tituloVisivel =
    tituloEquipado?.tipo === "titulo" ? tituloEquipado.valorVisual : gamificacao.tituloNivel;
  const molduraVisual =
    molduraEquipada?.tipo === "moldura" ? molduraEquipada.valorVisual : "padrao";

  useEffect(() => {
    if (location.pathname !== "/") {
      setDestino(null);
      return;
    }

    const localizarDestino = () => {
      const encontrado = document.querySelector<HTMLElement>(
        ".dashboard-pro-header h1"
      );
      setDestino(encontrado);
    };

    localizarDestino();

    if (document.querySelector(".dashboard-pro-header h1")) {
      return;
    }

    const observer = new MutationObserver(localizarDestino);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [location.pathname]);

  if (location.pathname !== "/" || !destino) {
    return null;
  }

  const xpNoNivel = gamificacao.xp % XP_POR_NIVEL;
  const xpFaltante = XP_POR_NIVEL - xpNoNivel;
  const proximoNivel = gamificacao.nivel + 1;
  const progresso = Math.min(
    100,
    Math.max(0, Math.round((xpNoNivel / XP_POR_NIVEL) * 100))
  );

  return createPortal(
    <span
      className={`dashboard-xp-inline dashboard-moldura-${molduraVisual}`}
      aria-label="Progresso de nível e moedas"
    >
      <span className="dashboard-xp-inline-nivel">
        Nível {gamificacao.nivel}
        <small title={tituloVisivel}>{tituloVisivel}</small>
      </span>

      <span className="dashboard-xp-inline-progresso">
        <span className="dashboard-xp-inline-meta">
          <b>{gamificacao.xp} XP</b>
          <small>{xpFaltante} XP para o Nível {proximoNivel}</small>
        </span>
        <span
          className="dashboard-xp-inline-barra"
          role="progressbar"
          aria-label={`Progresso para o nível ${proximoNivel}`}
          aria-valuemin={0}
          aria-valuemax={XP_POR_NIVEL}
          aria-valuenow={xpNoNivel}
        >
          <i style={{ width: `${progresso}%` }} />
        </span>
      </span>

      <button
        type="button"
        className="dashboard-xp-inline-moedas"
        title="Abrir Loja Study Pro"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          navigate("/loja");
        }}
      >
        <span>🪙</span>
        <strong>{economia.moedas}</strong>
        <small>moedas</small>
      </button>

      <button
        type="button"
        className="dashboard-xp-inline-conquistas"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          navigate("/conquistas");
        }}
        title="Abrir Conquistas"
      >
        🏆 Conquistas
      </button>
    </span>,
    destino
  );
}
