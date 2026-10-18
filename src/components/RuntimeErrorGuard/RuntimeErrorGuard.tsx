import { useEffect, useRef } from "react";

import { useToast } from "../../context/ToastContext";
import { registrarErroRuntime } from "../../services/seguranca/diagnosticoErroService";
import {
  ehErroChunkDinamico,
  tentarRecarregarChunkObsoletoUmaVez,
} from "../../utils/erroChunkDinamico";
import PerformanceMonitor from "../PerformanceMonitor/PerformanceMonitor";
import { deveAdiarAtualizacaoAutomatica } from "../../utils/atualizacaoSegura";


function criarErroComLocalizacao(evento: ErrorEvent) {
  const mensagem = evento.message || "Erro de execução";
  const partes = [
    evento.filename || "",
    evento.lineno > 0 ? `linha ${evento.lineno}` : "",
    evento.colno > 0 ? `coluna ${evento.colno}` : "",
  ].filter(Boolean);

  return new Error(
    partes.length
      ? `${mensagem} — ${partes.join(":")}`
      : mensagem
  );
}

export default function RuntimeErrorGuard() {
  const { showToast } = useToast();
  const ultimoAvisoRef = useRef(0);

  useEffect(() => {
    function avisar() {
      const agora = Date.now();
      if (agora - ultimoAvisoRef.current < 5000) return;

      ultimoAvisoRef.current = agora;
      showToast(
        deveAdiarAtualizacaoAutomatica(window.location.pathname)
          ? "Uma falha foi detectada. Se estiver em uma prova, faça backup das respostas antes de sair ou atualizar."
          : "Uma falha foi detectada. Se algo não responder, tente recarregar a página.",
        "warning"
      );
    }

    function tentarRecuperarChunk(erro: unknown) {
      return ehErroChunkDinamico(erro) &&
        !deveAdiarAtualizacaoAutomatica(window.location.pathname) &&
        tentarRecarregarChunkObsoletoUmaVez();
    }

    function aoErro(evento: ErrorEvent) {
      const erro =
        evento.error ??
        criarErroComLocalizacao(evento);

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
