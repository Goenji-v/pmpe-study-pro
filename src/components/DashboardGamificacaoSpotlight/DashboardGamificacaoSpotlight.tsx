import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";

import "./DashboardGamificacaoSpotlight.css";

import { useApp } from "../../context/AppContext";
import { calcularGamificacao } from "../../services/gamificacaoService";

const XP_POR_NIVEL = 250;

export default function DashboardGamificacaoSpotlight() {
  const location = useLocation();
  const navigate = useNavigate();
  const { sessoes, questoes, revisoes, simulados } = useApp();
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

  useEffect(() => {
    if (location.pathname !== "/") {
      setDestino(null);
      return;
    }

    const localizarDestino = () => {
      const encontrado = document.querySelector<HTMLElement>(
        ".dashboard-pro-header > div:first-child"
      );
      setDestino(encontrado);
    };

    localizarDestino();

    if (document.querySelector(".dashboard-pro-header")) {
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
    <section className="dashboard-xp-spotlight" aria-label="Progresso de nível">
      <div className="dashboard-xp-topo">
        <div className="dashboard-xp-identidade">
          <span>NÍVEL {gamificacao.nivel}</span>
          <strong>{gamificacao.tituloNivel}</strong>
        </div>

        <div className="dashboard-xp-acoes">
          <b>{gamificacao.xp} XP</b>
          <button
            type="button"
            onClick={() => navigate("/conquistas")}
            title="Abrir Conquistas"
          >
            🏆 Conquistas <span aria-hidden="true">›</span>
          </button>
        </div>
      </div>

      <div className="dashboard-xp-meta">
        <span>Próximo: Nível {proximoNivel}</span>
        <small>{xpFaltante} XP para subir de nível</small>
      </div>

      <div
        className="dashboard-xp-barra"
        role="progressbar"
        aria-label={`Progresso para o nível ${proximoNivel}`}
        aria-valuemin={0}
        aria-valuemax={XP_POR_NIVEL}
        aria-valuenow={xpNoNivel}
      >
        <i style={{ width: `${progresso}%` }} />
      </div>
    </section>,
    destino
  );
}
