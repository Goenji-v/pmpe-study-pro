import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { iniciarSentryFrontend } from "./lib/sentry";
import {
  ehErroChunkDinamico,
  limparMarcadorRecuperacaoChunkDaUrl,
  tentarRecarregarChunkObsoletoUmaVez,
} from "./utils/erroChunkDinamico";

import "./global.css";
import "./styles/mobile.css";
import "./styles/visual-final.css";
import "./styles/visual-3d.css";
import "./styles/sidebar-organizado.css";
import "./styles/app-premium.css";
import "./styles/mobile-density.css";
import "./styles/mobile-dashboard-fixes.css";
import "./styles/visual-qa-final.css";
import "./styles/responsive-critical-fixes.css";
import "./components/BetaMonitor/BetaMonitorProducao.css";
import "./components/Sidebar/SidebarPremiumVisual.css";
import "./pages/Dashboard/DashboardHeroPremium.css";
import "./styles/premium-polish-final.css";
import "./components/StudyProIcons/StudyProIcons.css";

declare const __APP_VERSION__: string;

limparMarcadorRecuperacaoChunkDaUrl();
iniciarSentryFrontend();

const CHAVE_RECARGA_VERSAO = "study-pro:version-reload";
const INTERVALO_VERIFICACAO_VERSAO_MS = 60_000;

async function verificarNovaVersao() {
  if (!import.meta.env.PROD || __APP_VERSION__ === "local") return;

  try {
    const resposta = await fetch(
      `/version.json?t=${Date.now()}`,
      {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
        },
      }
    );

    if (!resposta.ok) return;

    const dados = (await resposta.json()) as {
      version?: unknown;
    };
    const publicada =
      typeof dados.version === "string"
        ? dados.version
        : "";

    if (!publicada || publicada === __APP_VERSION__) {
      sessionStorage.removeItem(CHAVE_RECARGA_VERSAO);
      return;
    }

    const assinatura =
      `${__APP_VERSION__}->${publicada}`;
    if (
      sessionStorage.getItem(CHAVE_RECARGA_VERSAO) ===
      assinatura
    ) {
      return;
    }

    sessionStorage.setItem(
      CHAVE_RECARGA_VERSAO,
      assinatura
    );
    window.location.reload();
  } catch {
    // Sem conexão ou endpoint indisponível: mantém a versão atual.
  }
}

function tentarRecuperarAssetAntigo(valor: unknown) {
  return ehErroChunkDinamico(valor) && tentarRecarregarChunkObsoletoUmaVez();
}

window.addEventListener(
  "error",
  (evento) => {
    const erro = evento instanceof ErrorEvent
      ? evento.error || evento.message || evento.filename
      : evento;
    if (tentarRecuperarAssetAntigo(erro)) evento.preventDefault();
  },
  true
);

window.addEventListener("unhandledrejection", (evento) => {
  if (tentarRecuperarAssetAntigo(evento.reason)) evento.preventDefault();
});

if (import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void verificarNovaVersao();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void verificarNovaVersao();
    }
  });

  window.setInterval(() => {
    if (document.visibilityState === "visible") {
      void verificarNovaVersao();
    }
  }, INTERVALO_VERIFICACAO_VERSAO_MS);
}

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/service-worker.js", { scope: "/" })
      .catch((erro) => {
        console.warn("Não foi possível registrar o modo aplicativo do Studio Pro.", erro);
      });
  });
}

ReactDOM.createRoot(
  document.getElementById("root")!
).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);