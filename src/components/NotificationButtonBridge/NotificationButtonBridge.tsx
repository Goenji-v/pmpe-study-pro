import { useEffect } from "react";

import "./NotificationButtonBridge.css";

const SELETOR_SINO = '.dashboard-pro-icon[aria-label="Notificações"]';

export default function NotificationButtonBridge() {
  useEffect(() => {
    function abrirCentral(evento: MouseEvent) {
      if (!(evento.target instanceof Element)) return;
      const botao = evento.target.closest(SELETOR_SINO);
      if (!botao) return;

      evento.preventDefault();
      window.dispatchEvent(new Event("pmpe:notificacoes:abrir"));
    }

    function atualizarContador(evento: Event) {
      const detalhe = (evento as CustomEvent<{ total?: number }>).detail;
      const total = Math.max(0, Number(detalhe?.total ?? 0));

      document.querySelectorAll<HTMLElement>(SELETOR_SINO).forEach((botao) => {
        botao.dataset.notificacoes = total > 9 ? "9+" : String(total);
      });
    }

    document.addEventListener("click", abrirCentral);
    window.addEventListener("pmpe:notificacoes:contador", atualizarContador);

    return () => {
      document.removeEventListener("click", abrirCentral);
      window.removeEventListener("pmpe:notificacoes:contador", atualizarContador);
    };
  }, []);

  return null;
}
