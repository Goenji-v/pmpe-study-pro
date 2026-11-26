import { type ReactNode, useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { useApp } from "../../context/AppContext";
import { enfileirar, filaVazia, sincronizarFsrs, type FilaFsrs, type PropostaFsrs } from "../../services/inteligenciaRevisao/sincronizacao";
import { filaFsrsLocal } from "../../services/inteligenciaRevisao/filaFsrsLocal";
import { diarioFsrsSupabase } from "../../services/inteligenciaRevisao/diarioFsrsSupabase";
import { observarQuestoesIA, observarSessoes } from "../../services/inteligenciaRevisao/eventos";
import { ContextoFsrs, type Status } from "./contextoFsrsCompartilhado";
import type { EscopoFsrs } from "../../services/inteligenciaRevisao/checkpoint";

export default function FsrsSyncProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const { configuracoes } = useApp();
  const usuarioId = usuario?.id;
  const pilotos = String(import.meta.env.VITE_FSRS_SYNC_CONTAS ?? "").split(",").map(id => id.trim());
  if (!usuarioId || !pilotos.includes(usuarioId)) return children;
  const epoca = configuracoes.dadosReiniciadosEm || "inicial";
  return <ContaFsrs key={JSON.stringify([usuarioId, epoca])} usuarioId={usuarioId} epoca={epoca}>{children}</ContaFsrs>;
}

function ContaFsrs({ usuarioId, epoca, children }: EscopoFsrs & { children: ReactNode }) {
  const { sessoes, questoes } = useApp();
  const escopo = useMemo(() => ({ usuarioId, epoca }), [usuarioId, epoca]);
  const [fila, setFila] = useState<FilaFsrs>(filaVazia);
  const [status, setStatus] = useState<Status>("aguardando");
  const serial = useRef<Promise<unknown>>(Promise.resolve());
  const ativa = useRef(false);
  useEffect(() => {
    ativa.current = true;
    return () => { ativa.current = false; };
  }, []);
  const serializar = useCallback(<T,>(operacao: () => Promise<T>) => {
    const tarefa = serial.current.then(() => {
      if (!ativa.current) throw new Error("Conta FSRS encerrada.");
      return operacao();
    });
    serial.current = tarefa.catch(() => undefined);
    return tarefa;
  }, []);
  const observacoes = useMemo(() => [
    ...observarSessoes(usuarioId, sessoes), ...observarQuestoesIA(usuarioId, questoes),
  ], [usuarioId, sessoes, questoes]);
  const sincronizar = useCallback(async (proposta?: PropostaFsrs) => {
    try {
      // Revalida a fila antes de cada envio, inclusive após falha de armazenamento.
      const local = await enfileirar(filaFsrsLocal, escopo, observacoes);
      if (!ativa.current) throw new Error("Conta FSRS encerrada.");
      setFila(local);
      if (!navigator.onLine) {
        setStatus("offline");
        if (proposta) throw new Error("Conecte-se para confirmar o checkpoint.");
        return "ok" as const;
      }
      let resultado = await sincronizarFsrs(filaFsrsLocal, diarioFsrsSupabase, escopo, proposta);
      if (ativa.current) {
        setFila(resultado.fila);
        setStatus("online");
      }
      if (proposta) return resultado.resultado;
      while (resultado.fila.pendentes.length && ativa.current && navigator.onLine) {
        resultado = await sincronizarFsrs(filaFsrsLocal, diarioFsrsSupabase, escopo);
        if (ativa.current) setFila(resultado.fila);
      }
      return resultado.resultado;
    } catch (erro) {
      if (ativa.current) setStatus(navigator.onLine ? "erro" : "offline");
      throw erro;
    }
  }, [escopo, observacoes]);

  useEffect(() => {
    // Salva eventos assim que o estado oficial muda, sem esperar uma conexão.
    void enfileirar(filaFsrsLocal, escopo, observacoes).then(local => {
      if (ativa.current) setFila(atual => (atual.confirmado?.revisao ?? 0) > (local.confirmado?.revisao ?? 0) ? atual : local);
    }).catch(() => { if (ativa.current) setStatus("erro"); });
    void serializar(() => sincronizar()).catch(() => undefined);
  }, [escopo, observacoes, serializar, sincronizar]);

  useEffect(() => {
    const tentar = () => { void serializar(() => sincronizar()).catch(() => undefined); };
    const offline = () => setStatus("offline");
    window.addEventListener("online", tentar);
    window.addEventListener("offline", offline);
    window.addEventListener("focus", tentar);
    const timer = window.setInterval(tentar, 30_000);
    return () => {
      window.removeEventListener("online", tentar);
      window.removeEventListener("offline", offline);
      window.removeEventListener("focus", tentar);
      window.clearInterval(timer);
    };
  }, [serializar, sincronizar]);
  const publicar = useCallback((proposta: PropostaFsrs) => serializar(() => sincronizar(proposta)), [serializar, sincronizar]);
  return <ContextoFsrs.Provider value={{ escopo, fila, status, publicar }}>{children}</ContextoFsrs.Provider>;
}
