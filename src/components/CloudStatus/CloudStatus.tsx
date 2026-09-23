import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useApp,
} from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import { listarBackupsAutomaticosLocais } from "../../services/seguranca/backupAutomaticoService";

import "./CloudStatus.css";

const CHAVE_ULTIMO_BACKUP_MANUAL = "pmpe_ultimo_backup_schema18";

function dataMaisRecente(datas: Array<string | null | undefined>) {
  return datas
    .filter((data): data is string => typeof data === "string" && data.length > 0)
    .sort((a, b) => b.localeCompare(a))[0] ?? null;
}

function formatarDataHora(data: string | null) {
  if (!data) return "Ainda não registrado";

  const valor = new Date(data);
  if (Number.isNaN(valor.getTime())) return "Data indisponível";

  return valor.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CloudStatus() {
  const {
    statusNuvem,
    erroNuvem,
    alteracoesPendentes,
    ultimaSincronizacao,
    sincronizarAgora,
    resolverConflitoSincronizacao,
  } = useApp();
  const { usuario } = useAuth();
  const usuarioId = usuario?.id;

  const [executando, setExecutando] = useState(false);
  const [painelAberto, setPainelAberto] = useState(false);
  const [versaoBackup, setVersaoBackup] = useState(0);

  useEffect(() => {
    const atualizar = () => setVersaoBackup((valor) => valor + 1);
    window.addEventListener("pmpe-backup-atualizado", atualizar);
    return () => window.removeEventListener("pmpe-backup-atualizado", atualizar);
  }, []);

  const ultimoBackup = useMemo(() => {
    const manual = localStorage.getItem(CHAVE_ULTIMO_BACKUP_MANUAL);
    const automatico = usuarioId
      ? listarBackupsAutomaticosLocais(usuarioId)[0]?.criadoEm ?? null
      : null;

    return dataMaisRecente([manual, automatico]);
    // versaoBackup e statusNuvem são gatilhos explícitos para reler o localStorage.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioId, versaoBackup, statusNuvem]);

  async function sincronizar() {
    if (executando) return;

    try {
      setExecutando(true);
      await sincronizarAgora();
    } catch {
      // O estado visual e a mensagem já são controlados pelo AppContext.
    } finally {
      setExecutando(false);
    }
  }

  async function resolver(preferencia: "nuvem" | "local") {
    if (executando) return;

    const texto = preferencia === "nuvem"
      ? "Usar a versão da nuvem? Isso substituirá o estado atual deste aparelho. Antes da troca, as duas versões serão preservadas em backup local e no Supabase."
      : "Usar a versão deste aparelho? Isso substituirá o estado atual da nuvem. Antes da troca, as duas versões serão preservadas em backup local e no Supabase.";

    if (!window.confirm(texto)) return;

    try {
      setExecutando(true);
      await resolverConflitoSincronizacao(preferencia);
    } catch {
      // O erro permanece disponível no AppContext/console.
    } finally {
      setExecutando(false);
    }
  }

  const texto =
    statusNuvem === "carregando"
      ? "Carregando nuvem"
      : statusNuvem === "salvando"
        ? "Salvando"
        : statusNuvem === "offline"
          ? alteracoesPendentes > 0
            ? `Offline · ${alteracoesPendentes} pendente${alteracoesPendentes > 1 ? "s" : ""}`
            : "Offline"
          : statusNuvem === "conflito"
            ? "Conflito de dados"
            : statusNuvem === "erro"
              ? "Erro na nuvem"
              : "Sincronizado";

  const detalheStatus =
    erroNuvem ||
    (statusNuvem === "sincronizado"
      ? "Dados confirmados no Supabase."
      : "A sincronização está sendo acompanhada pelo Study Pro.");

  return (
    <div className="cloud-status-wrap">
      <button
        type="button"
        className={`cloud-status cloud-status-${statusNuvem}`}
        onClick={() => setPainelAberto((aberto) => !aberto)}
        aria-expanded={painelAberto}
        title={detalheStatus}
      >
        <span className="cloud-status-dot" />
        <strong>{texto}</strong>
        <span className="cloud-status-chevron" aria-hidden="true">⌄</span>
      </button>

      {painelAberto && (
        <div className="cloud-status-painel">
          <div className="cloud-status-painel-cabecalho">
            <div>
              <span>SEGURANÇA DOS DADOS</span>
              <strong>{texto}</strong>
            </div>
            <span className={`cloud-status-badge cloud-status-badge-${statusNuvem}`}>
              Schema 18
            </span>
          </div>

          <div className="cloud-status-metricas">
            <div>
              <span>Última sincronização</span>
              <strong>{formatarDataHora(ultimaSincronizacao)}</strong>
            </div>
            <div>
              <span>Último backup</span>
              <strong>{formatarDataHora(ultimoBackup)}</strong>
            </div>
            <div>
              <span>Alterações pendentes</span>
              <strong>{alteracoesPendentes}</strong>
            </div>
          </div>

          <p className="cloud-status-mensagem">{detalheStatus}</p>

          <div className="cloud-status-painel-acoes">
            {(statusNuvem === "erro" || statusNuvem === "offline") && (
              <button
                type="button"
                onClick={() => void sincronizar()}
                disabled={executando || statusNuvem === "offline"}
              >
                Sincronizar agora
              </button>
            )}

            {statusNuvem === "conflito" && (
              <>
                <p className="cloud-status-mensagem">
                  As versões são realmente diferentes. Escolher uma versão substitui a outra; o Study Pro fará backup das duas antes da troca.
                </p>
                <button
                  type="button"
                  onClick={() => void resolver("nuvem")}
                  disabled={executando}
                >
                  Usar nuvem
                </button>
                <button
                  type="button"
                  onClick={() => void resolver("local")}
                  disabled={executando}
                >
                  Usar este aparelho
                </button>
              </>
            )}

            <a href="/backup">Ver backups e segurança</a>
          </div>
        </div>
      )}
    </div>
  );
}
