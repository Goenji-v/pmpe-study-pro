import { useEffect, useRef } from "react";

import { useToast } from "../../context/ToastContext";
import { registrarErroRuntime } from "../../services/seguranca/diagnosticoErroService";
import PerformanceMonitor from "../PerformanceMonitor/PerformanceMonitor";

export default function RuntimeErrorGuard() {
  const { showToast } = useToast();
  const ultimoAvisoRef = useRef(0);

  useEffect(() => {
    function avisar() {
      const agora = Date.now();
      if (agora - ultimoAvisoRef.current < 5000) return;

      ultimoAvisoRef.current = agora;
      showToast(
        "Uma falha foi detectada, mas seus dados locais foram preservados. Se algo não responder, recarregue a página.",
        "warning"
      );
    }

    function aoErro(evento: ErrorEvent) {
      registrarErroRuntime(
        evento.error ?? evento.message ?? "Erro de execução",
        "window-error"
      );
      avisar();
    }

    function aoRejeitar(evento: PromiseRejectionEvent) {
      registrarErroRuntime(evento.reason, "promise-rejection");
      avisar();
    }

    window.addEventListener("error", aoErro);
    window.addEventListener("unhandledrejection", aoRejeitar);

    return () => {
      window.removeEventListener("error", aoErro);
      window.removeEventListener("unhandledrejection", aoRejeitar);
    };
  }, [showToast]);

  return <PerformanceMonitor />;
}
