import { useEffect, useRef } from "react";

import { useToast } from "../../context/ToastContext";
import { registrarErroRuntime } from "../../services/seguranca/diagnosticoErroService";
import {
  ehErroChunkDinamico,
  tentarRecarregarChunkObsoletoUmaVez,
} from "../../utils/erroChunkDinamico";
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

    function tentarRecuperarChunk(erro: unknown) {
      return ehErroChunkDinamico(erro) && tentarRecarregarChunkObsoletoUmaVez();
    }

    function aoErro(evento: ErrorEvent) {
      const erro = evento.error ?? evento.message ?? "Erro de execução";
      if (tentarRecuperarChunk(erro)) return;

      registrarErroRuntime(erro, "window-error");
      avisar();
    }

    function aoRejeitar(evento: PromiseRejectionEvent) {
      if (tentarRecuperarChunk(evento.reason)) return;

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
