import {
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import "./Backup.css";

import { useApp } from "../../context/AppContext";
import { useToast } from "../../context/ToastContext";

import {
  migrarMateriasParaModulos,
} from "../../services/conteudos/migrarEstruturaConteudos";

import {
  listarAssuntosDaMateria,
} from "../../services/conteudos/navegarConteudos";

import type {
  ConfiguracoesApp,
  Materia,
  QuestaoBanco,
  RegistroQuestao,
  Revisao,
  SessaoEstudo,
  Simulado,
  SimuladoGerado,
} from "../../types/index";

type BackupDados = {
  versao: number;
  exportadoEm: string;

  dados: {
    materias: Materia[];
    questoes: RegistroQuestao[];
    sessoes: SessaoEstudo[];
    revisoes: Revisao[];
    simulados: Simulado[];
    bancoQuestoes: QuestaoBanco[];
    simuladosGerados: SimuladoGerado[];
    configuracoes: ConfiguracoesApp;
  };
};

const CHAVE_ULTIMO_BACKUP = "pmpe_ultimo_backup";

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
    setConfiguracoes,
  } = useApp();

  const { showToast } = useToast();

  const inputArquivoRef =
    useRef<HTMLInputElement | null>(null);

  const [importando, setImportando] =
    useState(false);

  const [ultimoBackup, setUltimoBackup] =
    useState<string | null>(() =>
      localStorage.getItem(
        CHAVE_ULTIMO_BACKUP
      )
    );

  const totalAssuntos = materias.reduce(
    (total, materia) =>
      total + listarAssuntosDaMateria(materia).length,
    0
  );

  const assuntosConcluidos = materias.reduce(
    (total, materia) =>
      total +
      listarAssuntosDaMateria(materia).filter(
        (assunto) => assunto.concluido
      ).length,
    0
  );

  const revisoesPendentes = revisoes.filter(
    (revisao) => !revisao.concluida
  ).length;

  const totalRegistros =
    materias.length +
    questoes.length +
    sessoes.length +
    revisoes.length +
    simulados.length +
    bancoQuestoes.length +
    simuladosGerados.length;

  function criarDadosBackup(): BackupDados {
    return {
      versao: 2,
      exportadoEm: new Date().toISOString(),

      dados: {
        materias,
        questoes,
        sessoes,
        revisoes,
        simulados,
        bancoQuestoes,
        simuladosGerados,
        configuracoes,
      },
    };
  }

  function exportarBackup() {
    try {
      const backup = criarDadosBackup();

      const conteudo = JSON.stringify(
        backup,
        null,
        2
      );

      const arquivo = new Blob(
        [conteudo],
        {
          type: "application/json;charset=utf-8",
        }
      );

      const url =
        URL.createObjectURL(arquivo);

      const link =
        document.createElement("a");

      const dataArquivo =
        formatarDataArquivo(new Date());

      link.href = url;

      link.download =
        `pmpe-study-pro-backup-${dataArquivo}.json`;

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      const agora =
        new Date().toISOString();

      localStorage.setItem(
        CHAVE_ULTIMO_BACKUP,
        agora
      );

      setUltimoBackup(agora);

      showToast(
        "Backup exportado com sucesso.",
        "success"
      );
    } catch (erro) {
      console.error(
        "Erro ao exportar backup:",
        erro
      );

      showToast(
        "Não foi possível exportar o backup.",
        "error"
      );
    }
  }

  function abrirSeletorArquivo() {
    inputArquivoRef.current?.click();
  }

  async function importarBackup(
    evento: ChangeEvent<HTMLInputElement>
  ) {
    const arquivo =
      evento.target.files?.[0];

    evento.target.value = "";

    if (!arquivo) return;

    if (
      !arquivo.name
        .toLowerCase()
        .endsWith(".json")
    ) {
      showToast(
        "Selecione um arquivo JSON válido.",
        "warning"
      );

      return;
    }

    try {
      setImportando(true);

      const texto = await arquivo.text();

      const backupDesconhecido: unknown =
        JSON.parse(texto);

      const backup =
        validarBackup(
          backupDesconhecido
        );

      const confirmar = window.confirm(
        "A importação substituirá os dados atuais do aplicativo. Deseja continuar?"
      );

      if (!confirmar) {
        setImportando(false);
        return;
      }

      setMaterias(
        migrarMateriasParaModulos(
          backup.dados.materias
        )
      );

      setQuestoes(
        backup.dados.questoes
      );

      setSessoes(
        backup.dados.sessoes
      );

      setRevisoes(
        backup.dados.revisoes
      );

      setSimulados(
        backup.dados.simulados
      );

      setBancoQuestoes(
        backup.dados.bancoQuestoes
      );

      setSimuladosGerados(
        backup.dados.simuladosGerados
      );

      setConfiguracoes(
        backup.dados.configuracoes
      );

      showToast(
        "Backup importado com sucesso.",
        "success"
      );
    } catch (erro) {
      console.error(
        "Erro ao importar backup:",
        erro
      );

      showToast(
        erro instanceof Error
          ? erro.message
          : "Não foi possível importar o backup.",
        "error"
      );
    } finally {
      setImportando(false);
    }
  }

  function limparDados() {
    const primeiraConfirmacao =
      window.confirm(
        "Tem certeza que deseja apagar todos os dados do aplicativo?"
      );

    if (!primeiraConfirmacao) return;

    const segundaConfirmacao =
      window.confirm(
        "Esta ação não pode ser desfeita. Faça um backup antes de continuar. Deseja realmente apagar tudo?"
      );

    if (!segundaConfirmacao) return;

    setMaterias([]);
    setQuestoes([]);
    setSessoes([]);
    setRevisoes([]);
    setSimulados([]);
    setBancoQuestoes([]);
    setSimuladosGerados([]);

    showToast(
      "Todos os dados foram apagados.",
      "info"
    );
  }

  function restaurarMateriasPadrao() {
    const confirmar = window.confirm(
      "Deseja restaurar as matérias padrão? Os demais dados permanecerão salvos."
    );

    if (!confirmar) return;

    localStorage.removeItem(
      "pmpe_materias"
    );

    window.location.reload();
  }

  return (
    <section className="backup-container">
      <h1 className="backup-title">
        💾 Backup
      </h1>

      <p className="backup-subtitle">
        Exporte, restaure e proteja os dados
        do seu aplicativo.
      </p>

      <div className="backup-resumo-grid">
        <ResumoCard
          titulo="Matérias"
          valor={materias.length}
          detalhe={`${totalAssuntos} assuntos`}
        />

        <ResumoCard
          titulo="Questões registradas"
          valor={questoes.length}
          detalhe={`${calcularTotalQuestoes(
            questoes
          )} questões resolvidas`}
        />

        <ResumoCard
          titulo="Revisões"
          valor={revisoes.length}
          detalhe={`${revisoesPendentes} pendentes`}
        />

        <ResumoCard
          titulo="Simulados"
          valor={
            simulados.length +
            simuladosGerados.length
          }
          detalhe={`${bancoQuestoes.length} questões no banco`}
        />
      </div>

      <div className="backup-grid">
        <div className="backup-card">
          <h2>Exportar dados</h2>

          <p className="backup-card-text">
            Cria um arquivo JSON contendo
            matérias, histórico, revisões,
            simulados, banco de questões e
            configurações.
          </p>

          <button
            className="backup-button backup-exportar"
            onClick={exportarBackup}
          >
            📤 Exportar backup
          </button>

          <div className="backup-info-box">
            <span>
              Último backup exportado
            </span>

            <strong>
              {ultimoBackup
                ? formatarDataHora(
                    ultimoBackup
                  )
                : "Nenhum backup registrado"}
            </strong>
          </div>
        </div>

        <div className="backup-card">
          <h2>Importar dados</h2>

          <p className="backup-card-text">
            Selecione um backup exportado
            anteriormente. Os dados atuais
            serão substituídos.
          </p>

          <input
            ref={inputArquivoRef}
            type="file"
            accept=".json,application/json"
            onChange={importarBackup}
            className="backup-file-input"
          />

          <button
            className="backup-button backup-importar"
            onClick={abrirSeletorArquivo}
            disabled={importando}
          >
            {importando
              ? "Importando..."
              : "📥 Importar backup"}
          </button>

          <div className="backup-aviso">
            <strong>Atenção</strong>

            <p>
              Faça um backup dos dados atuais
              antes de importar outro arquivo.
            </p>
          </div>
        </div>
      </div>

      <div className="backup-grid">
        <div className="backup-card">
          <h2>Conteúdo atual</h2>

          <div className="backup-lista">
            <LinhaResumo
              titulo="Matérias"
              valor={materias.length}
            />

            <LinhaResumo
              titulo="Assuntos"
              valor={totalAssuntos}
            />

            <LinhaResumo
              titulo="Assuntos concluídos"
              valor={assuntosConcluidos}
            />

            <LinhaResumo
              titulo="Registros de questões"
              valor={questoes.length}
            />

            <LinhaResumo
              titulo="Sessões de estudo"
              valor={sessoes.length}
            />

            <LinhaResumo
              titulo="Revisões"
              valor={revisoes.length}
            />

            <LinhaResumo
              titulo="Simulados manuais"
              valor={simulados.length}
            />

            <LinhaResumo
              titulo="Simulados gerados"
              valor={
                simuladosGerados.length
              }
            />

            <LinhaResumo
              titulo="Banco de questões"
              valor={bancoQuestoes.length}
            />

            <LinhaResumo
              titulo="Total de registros"
              valor={totalRegistros}
            />
          </div>
        </div>

        <div className="backup-card backup-danger-card">
          <h2>Zona de risco</h2>

          <p className="backup-card-text">
            Utilize estas opções somente
            quando souber exatamente o que
            está fazendo.
          </p>

          <button
            className="backup-button backup-restaurar"
            onClick={restaurarMateriasPadrao}
          >
            Restaurar matérias padrão
          </button>

          <button
            className="backup-button backup-limpar"
            onClick={limparDados}
          >
            🗑 Apagar todos os dados
          </button>
        </div>
      </div>

      <div className="backup-observacao">
        <strong>
          Sobre os futuros PDFs
        </strong>

        <p>
          Quando adicionarmos a biblioteca de
          simulados em PDF, os arquivos ficarão
          no IndexedDB. Nesta primeira versão,
          o backup inclui somente os dados
          armazenados no LocalStorage.
        </p>
      </div>
    </section>
  );
}

type ResumoCardProps = {
  titulo: string;
  valor: string | number;
  detalhe: string;
};

function ResumoCard({
  titulo,
  valor,
  detalhe,
}: ResumoCardProps) {
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

function LinhaResumo({
  titulo,
  valor,
}: LinhaResumoProps) {
  return (
    <div className="backup-linha-resumo">
      <span>{titulo}</span>
      <strong>{valor}</strong>
    </div>
  );
}

function calcularTotalQuestoes(
  questoes: RegistroQuestao[]
) {
  return questoes.reduce(
    (total, registro) =>
      total +
      registro.certas +
      registro.erradas,
    0
  );
}

function formatarDataArquivo(
  data: Date
) {
  const ano = data.getFullYear();

  const mes = String(
    data.getMonth() + 1
  ).padStart(2, "0");

  const dia = String(
    data.getDate()
  ).padStart(2, "0");

  const horas = String(
    data.getHours()
  ).padStart(2, "0");

  const minutos = String(
    data.getMinutes()
  ).padStart(2, "0");

  return `${ano}-${mes}-${dia}-${horas}-${minutos}`;
}

function formatarDataHora(
  data: string
) {
  return new Date(data).toLocaleString(
    "pt-BR",
    {
      dateStyle: "short",
      timeStyle: "short",
    }
  );
}

function validarBackup(
  valor: unknown
): BackupDados {
  if (
    typeof valor !== "object" ||
    valor === null
  ) {
    throw new Error(
      "O arquivo selecionado não contém um backup válido."
    );
  }

  const backup =
    valor as Partial<BackupDados>;

  if (
    ![1, 2].includes(backup.versao ?? 0) ||
    typeof backup.exportadoEm !==
      "string" ||
    typeof backup.dados !==
      "object" ||
    backup.dados === null
  ) {
    throw new Error(
      "Formato de backup incompatível."
    );
  }

  const dados =
    backup.dados as Partial<
      BackupDados["dados"]
    >;

  if (
    !Array.isArray(dados.materias) ||
    !Array.isArray(dados.questoes) ||
    !Array.isArray(dados.sessoes) ||
    !Array.isArray(dados.revisoes) ||
    !Array.isArray(dados.simulados) ||
    !Array.isArray(
      dados.bancoQuestoes
    ) ||
    !Array.isArray(
      dados.simuladosGerados
    ) ||
    typeof dados.configuracoes !==
      "object" ||
    dados.configuracoes === null
  ) {
    throw new Error(
      "O backup está incompleto ou corrompido."
    );
  }

  return {
    ...(backup as BackupDados),
    versao: 2,
    dados: {
      ...(dados as BackupDados["dados"]),
      materias: migrarMateriasParaModulos(
        dados.materias
      ),
    },
  };
}