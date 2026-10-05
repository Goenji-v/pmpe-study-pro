import { useEffect, useState, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useApp } from "../../context/AppContext";
import {
  observarArmazenamentoLocal,
  obterEstadoArmazenamentoLocal,
  repetirGravacoesLocais,
} from "../../services/seguranca/protecaoSincronizacaoService";
import "./AvisoArmazenamento.css";

export default function AvisoArmazenamento() {
  const { usuario } = useAuth();
  const usuarioId = usuario?.id ?? "sem-usuario";
  const { statusNuvem, sincronizarAgora } = useApp();
  const [tentando, setTentando] = useState(false);
  const destino = useSyncExternalStore(
    observarArmazenamentoLocal,
    () => obterEstadoArmazenamentoLocal(usuarioId),
    () => "local" as const
  );
  const pendente = destino !== "local" && statusNuvem !== "sincronizado";

  useEffect(() => {
    if (destino === "local" || statusNuvem !== "sincronizado") return;

    // Quando a nuvem já confirmou a alteração, tentamos devolver caches
    // temporários ao localStorage. Mesmo que o navegador continue limitando
    // o armazenamento local, não há motivo para manter um alerta de risco:
    // a cópia autoritativa já está preservada no Supabase.
    repetirGravacoesLocais(usuarioId);
  }, [destino, statusNuvem, usuarioId]);

  useEffect(() => {
    if (!pendente) return;
    const protegerSaida = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protegerSaida);
    return () => window.removeEventListener("beforeunload", protegerSaida);
  }, [pendente]);

  if (!pendente) return null;

  async function tentarSalvar() {
    setTentando(true);
    try {
      repetirGravacoesLocais(usuarioId);
      if (statusNuvem !== "sincronizado") await sincronizarAgora();
    } catch {
      // O painel de sincronização informa o erro; o aviso local permanece.
    } finally {
      setTentando(false);
    }
  }

  return <aside className="aviso-armazenamento" role="alert">
    <strong>Armazenamento local limitado</strong>
    <p>{destino === "memoria"
      ? "O navegador não conseguiu gravar a cópia local. As alterações continuam na memória desta página."
      : "A cópia local está temporariamente nesta aba e pode desaparecer quando ela for fechada."}
      {" Não feche nem recarregue antes de confirmar a sincronização. Se continuar sem conexão, exporte um backup."}
    </p>
    <button type="button" onClick={() => void tentarSalvar()} disabled={tentando}>
      {tentando ? "Tentando salvar…" : "Tentar salvar novamente"}
    </button>
    {pendente && <Link to="/backup">Backup e segurança</Link>}
  </aside>;
}
