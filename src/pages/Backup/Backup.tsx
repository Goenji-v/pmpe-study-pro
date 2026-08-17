import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import "./Backup.css";

import { useApp } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { gerarMateriasDoPlano } from "../../utils/materiasDoPlano";
import { listarAssuntosDaMateria } from "../../services/conteudos/navegarConteudos";
import {
  montarEstadoNuvem,
  validarEMigrarEstado,
} from "../../services/sincronizacaoService";
import {
  baixarArquivoBackupStudyPro,
  criarArquivoBackupStudyPro,
  lerArquivoBackupStudyPro,
  type ArquivoBackupStudyPro,
} from "../../services/seguranca/backupManualService";
import {
  listarBackupsAutomaticosLocais,
  type BackupAutomaticoLocal,
} from "../../services/seguranca/backupAutomaticoService";

import type {
  RegistroQuestao,
} from "../../types/index";

const CHAVE_ULTIMO_BACKUP = "pmpe_ultimo_backup_schema18";

export default function Backup() {
  const {
    materias,
    setMaterias,
    questoes,
    setQuestoes,
    sessoes,
    setSessoes,
    revisoes,
    setRevisoes,
    simulados,
    setSimulados,
    bancoQuestoes,
    setBancoQuestoes,
    simuladosGerados,
    setSimuladosGerados,
    configuracoes,
    missoesConcluidas,
    setMissoesConcluidas,
    restaurarEstadoCompleto,
    statusNuvem,
    alteracoesPendentes,
    ultimaSincronizacao,
  } = useApp();

  const { usuario } = useAuth();
  const { showToast } = useToast();
  const inputArquivoRef = useRef<HTMLInputElement | null>(null);
  const [importando, setImportando] = useState(false);
  const [ultimoBackup, setUltimoBackup] = useState<string | null>(() =>
    localStorage.getItem(CHAVE_ULTIMO_BACKUP)
  );
  const [arquivoAnalisado, setArquivoAnalisado] =
    useState<ArquivoBackupStudyPro | null>(null);

  const backupsAutomaticos = useMemo(
    () =>
      usuario
        ? listarBackupsAutomaticosLocais(usuario.id)
        : [],
    [usuario?.id, ultimoBackup, statusNuvem]
  );

  const totalAssuntos = materias.reduce(
    (total, materia) => total + listarAssuntosDaMateria(materia).length,
    0
  );

  const assuntosConcluidos = materias.reduce(
    (total, materia) =>
      total + listarAssuntosDaMateria(materia).filter((assunto) => assunto.concluido).length,
    0
  );

  const revisoesPendentes = revisoes.filter((revisao) => !revisao.concluida).length;

  const totalRegistros =
    materias.length +
    questoes.length +
    sessoes.length +
    revisoes.length +
    simulados.length +
    bancoQuestoes.length +
    simuladosGerados.length +
    missoesConcluidas.length;

  function criarEstadoAtual() {
    return montarEstadoNuvem({
      materias,
      questoes,
      sessoes,
      revisoes,
      simulados,
      bancoQuestoes,
      simuladosGerados,
      configuracoes,
      missoesConcluidas,
    });
  }

  function exportarBackup() {
    try {
      const backup = criarArquivoBackupStudyPro(criarEstadoAtual());
      baixarArquivoBackupStudyPro(backup);

      localStorage.setItem(CHAVE_ULTIMO_BACKUP, backup.exportadoEm);
      setUltimoBackup(backup.exportadoEm);
      window.dispatchEvent(new Event("pmpe-backup-atualizado"));

      showToast("Backup completo exportado com sucesso.", "success");
    } catch (erro) {
      console.error("Erro ao exportar backup:", erro);
      showToast(
        erro instanceof Error ? erro.message : "Não foi possível exportar o backup.",
        "error"
      );
    }
  }

  function abrirSeletorArquivo() {
    inputArquivoRef.current?.click();
  }

  async function analisarArquivo(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!arquivo) return;

    if (!arquivo.name.toLowerCase().endsWith(".json")) {
      showToast("Selecione um arquivo JSON válido.", "warning");
      return;
    }

    try {
      setImportando(true);
      const backup = lerArquivoBackupStudyPro(await arquivo.text());
      setArquivoAnalisado(backup);
      showToast("Backup validado. Confira o resumo antes de restaurar.", "info");
    } catch (erro) {
      console.error("Erro ao analisar backup:", erro);
      setArquivoAnalisado(null);
      showToast(
        erro instanceof Error ? erro.message : "Não foi possível analisar o backup.",
        "error"
      );
    } finally {
      setImportando(false);
    }
  }

  async function confirmarRestauracaoArquivo() {
    if (!arquivoAnalisado) return;

    const confirmar = window.confirm(
      `Restaurar o backup de ${formatarDataHora(arquivoAnalisado.exportadoEm)}?\n\n` +
        `Matérias: ${arquivoAnalisado.resumo.materias}\n` +
        `Questões registradas: ${arquivoAnalisado.resumo.questoesRegistradas}\n` +
        `Sessões: ${arquivoAnalisado.resumo.sessoes}\n` +
        `Revisões: ${arquivoAnalisado.resumo.revisoes}\n` +
        `Missões concluídas: ${arquivoAnalisado.resumo.missoesConcluidas}\n\n` +
        "Antes da restauração, o estado atual será guardado em um backup automático."
    );

    if (!confirmar) return;

    try {
      setImportando(true);
      await restaurarEstadoCompleto(arquivoAnalisado.estado);
      setArquivoAnalisado(null);
      showToast("Backup restaurado com segurança.", "success");
    } catch (erro) {
      console.error("Erro ao restaurar backup:", erro);
      showToast(
        erro instanceof Error ? erro.message : "Não foi possível restaurar o backup.",
        "error"
      );
    } finally {
      setImportando(false);
    }
  }

  async function restaurarBackupAutomatico(backup: BackupAutomaticoLocal) {
    const estado = validarEMigrarEstado(backup.dados);

    if (!estado) {
      showToast("Este backup automático não passou na validação.", "error");
      return;
    }

    const confirmar = window.confirm(
      `Restaurar o backup automático de ${formatarDataHora(backup.criadoEm)}?\n\n` +
        "O estado atual será preservado em outro backup antes da restauração."
    );

    if (!confirmar) return;

    try {
      setImportando(true);
      await restaurarEstadoCompleto(estado);
      showToast("Backup automático restaurado com segurança.", "success");
    } catch (erro) {
      console.error("Erro ao restaurar backup automático:", erro);
      showToast(
        erro instanceof Error ? erro.message : "Não foi possível restaurar o backup automático.",
        "error"
      );
    } finally {
      setImportando(false);
    }
  }

  function limparDados() {
    const primeiraConfirmacao = window.confirm(
      "Tem certeza que deseja apagar os dados de estudo deste aparelho?"
    );
    if (!primeiraConfirmacao) return;

    const segundaConfirmacao = window.confirm(
      "Faça um backup antes de continuar. Deseja realmente apagar os registros?"
    );
    if (!segundaConfirmacao) return;

    setMaterias(gerarMateriasDoPlano());
    setQuestoes([]);
    setSessoes([]);
    setRevisoes([]);
    setSimulados([]);
    setBancoQuestoes([]);
    setSimuladosGerados([]);
    setMissoesConcluidas([]);

    showToast("Dados de estudo redefinidos. A alteração entrará na sincronização normal.", "info");
  }

  return (
    <section className="backup-container">
      <h1 className="backup-title">💾 Backup e segurança</h1>

      <p className="backup-subtitle">
        Exporte, restaure e proteja o estado completo do Study Pro.
      </p>

      <div className="backup-sync-card">
        <div>
          <span>Sincronização</span>
          <strong>{textoStatus(statusNuvem)}</strong>
        </div>
        <div>
          <span>Alterações pendentes</span>
          <strong>{alteracoesPendentes}</strong>
        </div>
        <div>
          <span>Última sincronização</span>
          <strong>{ultimaSincronizacao ? formatarDataHora(ultimaSincronizacao) : "Ainda não registrada"}</strong>
        </div>
      </div>

      <div className="backup-resumo-grid">
        <ResumoCard titulo="Matérias" valor={materias.length} detalhe={`${totalAssuntos} assuntos`} />
        <ResumoCard
          titulo="Questões registradas"
          valor={questoes.length}
          detalhe={`${calcularTotalQuestoes(questoes)} questões resolvidas`}
        />
        <ResumoCard titulo="Revisões" valor={revisoes.length} detalhe={`${revisoesPendentes} pendentes`} />
        <ResumoCard
          titulo="Simulados"
          valor={simulados.length + simuladosGerados.length}
          detalhe={`${bancoQuestoes.length} questões no banco`}
        />
      </div>

      <div className="backup-grid">
        <div className="backup-card">
          <h2>Exportar dados</h2>
          <p className="backup-card-text">
            Gera um JSON Schema 18 com matérias, aulas, histórico, revisões, simulados,
            configurações e missões concluídas. O arquivo recebe checksum de integridade.
          </p>

          <button className="backup-button backup-exportar" onClick={exportarBackup}>
            📤 Exportar backup completo
          </button>

          <div className="backup-info-box">
            <span>Último backup exportado</span>
            <strong>{ultimoBackup ? formatarDataHora(ultimoBackup) : "Nenhum backup registrado"}</strong>
          </div>
        </div>

        <div className="backup-card">
          <h2>Restaurar arquivo</h2>
          <p className="backup-card-text">
            O arquivo é validado antes de qualquer alteração. Backups antigos V1/V2 também são
            migrados para o formato atual quando possível.
          </p>

          <input
            ref={inputArquivoRef}
            type="file"
            accept=".json,application/json"
            onChange={analisarArquivo}
            className="backup-file-input"
          />

          <button
            className="backup-button backup-importar"
            onClick={abrirSeletorArquivo}
            disabled={importando}
          >
            {importando ? "Analisando..." : "📥 Selecionar backup"}
          </button>

          {arquivoAnalisado && (
            <div className="backup-preview-restauracao">
              <div className="backup-preview-header">
                <div>
                  <span>Backup validado</span>
                  <strong>{formatarDataHora(arquivoAnalisado.exportadoEm)}</strong>
                </div>
                <span className="backup-schema-badge">Schema {arquivoAnalisado.schemaVersion}</span>
              </div>

              <LinhaResumo titulo="Matérias" valor={arquivoAnalisado.resumo.materias} />
              <LinhaResumo titulo="Questões" valor={arquivoAnalisado.resumo.questoesRegistradas} />
              <LinhaResumo titulo="Sessões" valor={arquivoAnalisado.resumo.sessoes} />
              <LinhaResumo titulo="Revisões" valor={arquivoAnalisado.resumo.revisoes} />
              <LinhaResumo titulo="Missões concluídas" valor={arquivoAnalisado.resumo.missoesConcluidas} />

              <button
                className="backup-button backup-restaurar-confirmado"
                onClick={() => void confirmarRestauracaoArquivo()}
                disabled={importando}
              >
                Restaurar este backup
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="backup-card backup-automaticos-card">
        <div className="backup-section-heading">
          <div>
            <h2>Backups automáticos de segurança</h2>
            <p>
              Criados antes de migrações, restaurações, rollbacks e resolução de conflitos.
              São mantidas até 10 cópias locais.
            </p>
          </div>
          <strong>{backupsAutomaticos.length}/10</strong>
        </div>

        {backupsAutomaticos.length === 0 ? (
          <div className="backup-empty">Nenhum backup automático foi necessário ainda.</div>
        ) : (
          <div className="backup-auto-lista">
            {backupsAutomaticos.map((backup) => (
              <div className="backup-auto-item" key={backup.id}>
                <div>
                  <strong>{rotuloMotivo(backup.motivo)}</strong>
                  <span>{formatarDataHora(backup.criadoEm)} · origem schema {backup.schemaVersionOrigem}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void restaurarBackupAutomatico(backup)}
                  disabled={importando}
                >
                  Restaurar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="backup-grid backup-grid-inferior">
        <div className="backup-card">
          <h2>Conteúdo atual</h2>
          <div className="backup-lista">
            <LinhaResumo titulo="Assuntos" valor={totalAssuntos} />
            <LinhaResumo titulo="Assuntos concluídos" valor={assuntosConcluidos} />
            <LinhaResumo titulo="Sessões de estudo" valor={sessoes.length} />
            <LinhaResumo titulo="Missões concluídas" valor={missoesConcluidas.length} />
            <LinhaResumo titulo="Total de registros" valor={totalRegistros} />
          </div>
        </div>

        <div className="backup-card backup-danger-card">
          <h2>Zona de risco</h2>
          <p className="backup-card-text">
            Redefine os registros de estudo e restaura a estrutura atual do plano. Exporte um
            backup antes de usar.
          </p>
          <button className="backup-button backup-limpar" onClick={limparDados}>
            🗑 Redefinir dados de estudo
          </button>
        </div>
      </div>
    </section>
  );
}

type ResumoCardProps = {
  titulo: string;
  valor: string | number;
  detalhe: string;
};

function ResumoCard({ titulo, valor, detalhe }: ResumoCardProps) {
  return (
    <div className="backup-resumo-card">
      <span>{titulo}</span>
      <strong>{valor}</strong>
      <small>{detalhe}</small>
    </div>
  );
}

type LinhaResumoProps = {
  titulo: string;
  valor: string | number;
};

function LinhaResumo({ titulo, valor }: LinhaResumoProps) {
  return (
    <div className="backup-linha-resumo">
      <span>{titulo}</span>
      <strong>{valor}</strong>
    </div>
  );
}

function calcularTotalQuestoes(questoes: RegistroQuestao[]) {
  return questoes.reduce((total, registro) => total + registro.certas + registro.erradas, 0);
}

function formatarDataHora(data: string) {
  return new Date(data).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function textoStatus(status: string) {
  if (status === "sincronizado") return "Sincronizado";
  if (status === "salvando") return "Salvando...";
  if (status === "carregando") return "Carregando nuvem...";
  if (status === "offline") return "Offline — dados locais protegidos";
  if (status === "conflito") return "Conflito protegido — escolha uma versão no topo";
  return "Erro de sincronização";
}

function rotuloMotivo(motivo: string) {
  const rotulos: Record<string, string> = {
    antes_migracao_schema: "Antes de migração do schema",
    antes_reconciliacao_estrutural: "Antes de ajuste estrutural",
    antes_rollback: "Antes de rollback",
    antes_restauracao_manual: "Antes de restauração",
    antes_resolucao_conflito: "Antes de resolver conflito",
  };

  return rotulos[motivo] ?? "Backup de segurança";
}
