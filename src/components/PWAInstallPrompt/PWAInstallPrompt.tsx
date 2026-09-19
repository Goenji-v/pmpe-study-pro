import { useEffect, useState } from "react";
import "./PWAInstallPrompt.css";

type ResultadoInstalacao = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<ResultadoInstalacao>;
};

const CHAVE_DISPENSADO = "studio-pro:pwa-prompt-dispensado";
const SETE_DIAS = 7 * 24 * 60 * 60 * 1000;

function estaEmModoAplicativo() {
  const navegador = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navegador.standalone === true
  );
}

function foiDispensadoRecentemente() {
  const valor = localStorage.getItem(CHAVE_DISPENSADO);
  if (!valor) return false;

  const quando = Number(valor);
  return Number.isFinite(quando) && Date.now() - quando < SETE_DIAS;
}

export default function PWAInstallPrompt() {
  const [eventoInstalacao, setEventoInstalacao] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [mostrarIOS, setMostrarIOS] = useState(false);
  const [mostrarAjudaIOS, setMostrarAjudaIOS] = useState(false);

  useEffect(() => {
    if (estaEmModoAplicativo() || foiDispensadoRecentemente()) return;

    const ehIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (ehIOS) {
      const timer = window.setTimeout(() => setMostrarIOS(true), 1800);
      return () => window.clearTimeout(timer);
    }

    function aoPoderInstalar(evento: Event) {
      evento.preventDefault();
      setEventoInstalacao(evento as BeforeInstallPromptEvent);
    }

    function aoInstalar() {
      setEventoInstalacao(null);
      setMostrarIOS(false);
      localStorage.removeItem(CHAVE_DISPENSADO);
    }

    window.addEventListener("beforeinstallprompt", aoPoderInstalar);
    window.addEventListener("appinstalled", aoInstalar);

    return () => {
      window.removeEventListener("beforeinstallprompt", aoPoderInstalar);
      window.removeEventListener("appinstalled", aoInstalar);
    };
  }, []);

  function dispensar() {
    localStorage.setItem(CHAVE_DISPENSADO, String(Date.now()));
    setEventoInstalacao(null);
    setMostrarIOS(false);
  }

  async function instalar() {
    if (!eventoInstalacao) return;

    await eventoInstalacao.prompt();
    const escolha = await eventoInstalacao.userChoice;

    if (escolha.outcome === "accepted") {
      setEventoInstalacao(null);
      return;
    }

    dispensar();
  }

  if (!eventoInstalacao && !mostrarIOS) return null;

  return (
    <aside className="pwa-install" role="dialog" aria-label="Instalar Study Pro">
      <button
        type="button"
        className="pwa-install-fechar"
        aria-label="Fechar"
        onClick={dispensar}
      >
        ×
      </button>

      <img
        src="/assets/studio-pro-mark.svg?v=3"
        alt=""
        aria-hidden="true"
        className="pwa-install-logo"
      />

      <div className="pwa-install-conteudo">
        <strong>Instalar Study Pro</strong>

        {mostrarIOS ? (
          <>
            <span>Use o Study Pro como um aplicativo na tela inicial.</span>
            {mostrarAjudaIOS && (
              <small>
                No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.
              </small>
            )}
          </>
        ) : (
          <span>Abra mais rápido, em tela própria e direto pelo ícone do celular.</span>
        )}
      </div>

      {mostrarIOS ? (
        <button
          type="button"
          className="pwa-install-acao"
          onClick={() => setMostrarAjudaIOS((atual) => !atual)}
        >
          {mostrarAjudaIOS ? "Entendi" : "Como instalar"}
        </button>
      ) : (
        <button
          type="button"
          className="pwa-install-acao"
          onClick={() => void instalar()}
        >
          Instalar
        </button>
      )}
    </aside>
  );
}
