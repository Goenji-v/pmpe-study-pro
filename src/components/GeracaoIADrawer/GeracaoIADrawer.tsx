import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import "./GeracaoIADrawer.css";

import {
  calcularProgressoAtividadeGeracaoIA,
  carregarAtividadeGeracaoIA,
  EVENTO_ATIVIDADE_GERACAO_IA,
  salvarAtividadeGeracaoIA,
  type AtividadeGeracaoIA,
} from "../../services/geracaoIAAtividadeService";
import {
  listarJobsGeracaoIA,
  type JobGeracaoIAPublico,
} from "../../services/gemini";

const INTERVALO_ATUALIZACAO_MS = 1_800;

export default function GeracaoIADrawer() {
  const navigate = useNavigate();
  const [atividade, setAtividade] = useState<AtividadeGeracaoIA | null>(
    carregarAtividadeGeracaoIA
  );
  const [jobs, setJobs] = useState<JobGeracaoIAPublico[]>([]);
  const [aberto, setAberto] = useState(false);
  const ultimoId = useRef<string | null>(atividade?.id ?? null);

  useEffect(() => {
    const atualizar = () => {
      const proxima = carregarAtividadeGeracaoIA();
      setAtividade(proxima);

      if (proxima && proxima.id !== ultimoId.current) {
        setAberto(true);
      }

      ultimoId.current = proxima?.id ?? null;
    };

    window.addEventListener(EVENTO_ATIVIDADE_GERACAO_IA, atualizar);
    window.addEventListener("storage", atualizar);

    return () => {
      window.removeEventListener(EVENTO_ATIVIDADE_GERACAO_IA, atualizar);
      window.removeEventListener("storage", atualizar);
    };
  }, []);

  useEffect(() => {
    if (!atividade?.id) {
      setJobs([]);
      return;
    }

    let ativo = true;

    const consultar = async () => {
      try {
        const encontrados = await listarJobsGeracaoIA(atividade.id);
        if (ativo) setJobs(encontrados);
      } catch {
        // O estado local continua visível caso a consulta esteja temporariamente indisponível.
      }
    };

    void consultar();

    const timer = window.setInterval(
      () => void consultar(),
      INTERVALO_ATUALIZACAO_MS
    );

    return () => {
      ativo = false;
      window.clearInterval(timer);
    };
  }, [atividade?.id]);

  const estadoServidor = useMemo(
    () => resumirJobsServidor(jobs),
    [jobs]
  );

  if (!atividade) return null;

  const prontaNoServidor =
    atividade.etapa !== "concluida" &&
    estadoServidor.pronta;
  const erroServidor =
    atividade.etapa !== "concluida"
      ? estadoServidor.erro
      : null;

  const ativa =
    !prontaNoServidor &&
    !erroServidor &&
    atividade.etapa !== "concluida" &&
    atividade.etapa !== "erro";

  const progresso =
    estadoServidor.temJobs
      ? estadoServidor.progresso
      : calcularProgressoAtividadeGeracaoIA(atividade);

  const rotulo =
    prontaNoServidor
      ? "IA finalizada"
      : erroServidor
        ? "A geração precisa de atenção"
        : estadoServidor.jobAtual
          ? obterRotuloJob(estadoServidor.jobAtual)
          : obterRotuloEtapa(atividade);

  const icone =
    atividade.etapa === "concluida" || prontaNoServidor
      ? "✓"
      : atividade.etapa === "erro" || erroServidor
        ? "!"
        : "✦";

  function abrirResultado() {
    setAberto(false);
    navigate("/resolver-simulado-ia");
  }

  function voltarGerador() {
    setAberto(false);
    navigate("/gerar-simulado-ia");
  }

  function dispensar() {
    salvarAtividadeGeracaoIA(null);
    setAtividade(null);
    setJobs([]);
    setAberto(false);
  }

  return (
    <>
      <button
        type="button"
        className={`geracao-ia-dock ${
          ativa
            ? "ativa"
            : erroServidor
              ? "erro"
              : prontaNoServidor
                ? "concluida"
                : atividade.etapa
        }`}
        onClick={() => setAberto(true)}
        aria-label="Abrir Central de Gerações"
      >
        <span className="geracao-ia-dock-icone" aria-hidden="true">
          {icone}
        </span>
        <span className="geracao-ia-dock-texto">
          <strong>
            {ativa
              ? "1 geração em andamento"
              : prontaNoServidor
                ? "Geração pronta"
                : rotulo}
          </strong>
          <small>{atividade.titulo}</small>
        </span>
        {ativa && (
          <span className="geracao-ia-dock-progresso">
            {progresso}%
          </span>
        )}
      </button>

      {aberto && (
        <div
          className="geracao-ia-overlay"
          onClick={() => setAberto(false)}
          role="presentation"
        >
          <aside
            className="geracao-ia-painel"
            role="dialog"
            aria-modal="false"
            aria-label="Central de Gerações"
            onClick={(evento) => evento.stopPropagation()}
          >
            <div className="geracao-ia-painel-topo">
              <div>
                <span className="geracao-ia-sobretitulo">
                  Central de Gerações
                </span>
                <h2>
                  {ativa
                    ? "Em geração"
                    : prontaNoServidor
                      ? "Pronta no servidor"
                      : rotulo}
                </h2>
              </div>
              <button
                type="button"
                className="geracao-ia-fechar"
                onClick={() => setAberto(false)}
                aria-label="Minimizar Central de Gerações"
              >
                —
              </button>
            </div>

            {ativa && (
              <p className="geracao-ia-explicacao">
                Pode fechar esta tela ou continuar estudando. O servidor
                continua a geração e a revisão independentemente desta página.
              </p>
            )}

            {prontaNoServidor && (
              <p className="geracao-ia-explicacao">
                A IA terminou no servidor. Abra a geração para o Study Pro
                organizar o caderno e liberar as questões para resolver.
              </p>
            )}

            <article
              className={`geracao-ia-card-global ${
                erroServidor
                  ? "erro"
                  : prontaNoServidor
                    ? "concluida"
                    : atividade.etapa
              }`}
            >
              <div className="geracao-ia-card-linha">
                <span className="geracao-ia-card-icone" aria-hidden="true">
                  {icone}
                </span>
                <div className="geracao-ia-card-conteudo">
                  <div className="geracao-ia-card-titulo">
                    <strong>{atividade.titulo}</strong>
                    <span>{rotulo}</span>
                  </div>
                  <p>
                    {atividade.quantidade} questão
                    {atividade.quantidade === 1 ? "" : "ões"} ·{" "}
                    {estadoServidor.jobAtual?.descricao || atividade.descricao}
                  </p>
                </div>
              </div>

              {ativa && (
                <>
                  <div className="geracao-ia-etapa-atual">
                    <span>
                      {estadoServidor.jobAtual
                        ? obterTextoJob(
                            estadoServidor.jobAtual,
                            estadoServidor.indiceAtual,
                            estadoServidor.totalJobs
                          )
                        : obterTextoEtapa(atividade)}
                    </span>
                    <strong>{progresso}%</strong>
                  </div>
                  <div
                    className="geracao-ia-barra"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progresso}
                  >
                    <span style={{ width: `${progresso}%` }} />
                  </div>
                  <div className="geracao-ia-passos" aria-label="Etapas da geração">
                    <span
                      className={
                        passoServidorAtivo(estadoServidor.jobAtual, "gerando")
                          ? "ativo"
                          : ""
                      }
                    >
                      Gerar
                    </span>
                    <span
                      className={
                        passoServidorAtivo(estadoServidor.jobAtual, "revisando")
                          ? "ativo"
                          : ""
                      }
                    >
                      Revisar
                    </span>
                    <span
                      className={
                        passoServidorAtivo(estadoServidor.jobAtual, "salvando")
                          ? "ativo"
                          : ""
                      }
                    >
                      Salvar
                    </span>
                  </div>
                </>
              )}

              {(erroServidor || atividade.etapa === "erro") && (
                <p className="geracao-ia-erro-texto">
                  {erroServidor || atividade.erro}
                </p>
              )}

              <div className="geracao-ia-painel-acoes">
                {atividade.etapa === "concluida" && (
                  <button
                    type="button"
                    className="primario"
                    onClick={abrirResultado}
                  >
                    Resolver agora
                  </button>
                )}

                {prontaNoServidor && (
                  <button
                    type="button"
                    className="primario"
                    onClick={voltarGerador}
                  >
                    Finalizar caderno
                  </button>
                )}

                {(erroServidor || atividade.etapa === "erro") && (
                  <button
                    type="button"
                    className="primario"
                    onClick={voltarGerador}
                  >
                    Retomar geração
                  </button>
                )}

                {!ativa && !prontaNoServidor && (
                  <button
                    type="button"
                    className="secundario"
                    onClick={dispensar}
                  >
                    Fechar
                  </button>
                )}

                {ativa && (
                  <button
                    type="button"
                    className="secundario"
                    onClick={() => setAberto(false)}
                  >
                    Continuar navegando
                  </button>
                )}
              </div>
            </article>
          </aside>
        </div>
      )}
    </>
  );
}

function resumirJobsServidor(
  jobs: JobGeracaoIAPublico[]
) {
  if (jobs.length === 0) {
    return {
      temJobs: false,
      pronta: false,
      erro: null as string | null,
      progresso: 0,
      jobAtual: null as JobGeracaoIAPublico | null,
      indiceAtual: 0,
      totalJobs: 0,
    };
  }

  const erro = jobs.find((job) => job.status === "erro");
  const atual = jobs.find(
    (job) => job.status === "fila" || job.status === "processando"
  );
  const pronta = !erro && jobs.every((job) => job.status === "concluida");
  const progresso = Math.round(
    jobs.reduce(
      (total, job) =>
        total +
        (job.status === "concluida"
          ? 100
          : Math.max(0, Math.min(100, job.progresso || 0))),
      0
    ) / jobs.length
  );

  return {
    temJobs: true,
    pronta,
    erro: erro?.erro || null,
    progresso,
    jobAtual: atual || erro || jobs[jobs.length - 1],
    indiceAtual: atual
      ? jobs.findIndex((job) => job.id === atual.id) + 1
      : jobs.length,
    totalJobs: jobs.length,
  };
}

function obterRotuloJob(
  job: JobGeracaoIAPublico
) {
  switch (job.etapa) {
    case "fila":
      return "Na fila";
    case "gerando":
      return "Gerando";
    case "revisando":
      return "Revisando qualidade";
    case "corrigindo":
      return "Corrigindo revisão";
    case "salvando":
      return "Finalizando";
    case "concluida":
      return "Finalizada";
    case "erro":
      return "Precisa de atenção";
  }
}

function obterTextoJob(
  job: JobGeracaoIAPublico,
  indice: number,
  total: number
) {
  const bloco =
    total > 1
      ? ` · bloco ${Math.max(1, indice)}/${total}`
      : "";

  switch (job.etapa) {
    case "fila":
      return `Aguardando a vez no servidor${bloco}`;
    case "gerando":
      return `A IA está criando as questões${bloco}`;
    case "revisando":
      return `Revisão independente de qualidade${bloco}`;
    case "corrigindo":
      return `Corrigindo uma revisão rejeitada${bloco}`;
    case "salvando":
      return `Salvando o lote aprovado${bloco}`;
    case "concluida":
      return "Lote concluído";
    case "erro":
      return "O lote precisa de atenção";
  }
}

function passoServidorAtivo(
  job: JobGeracaoIAPublico | null,
  passo: "gerando" | "revisando" | "salvando"
) {
  if (!job) return false;

  const ordem = {
    fila: 0,
    gerando: 1,
    revisando: 2,
    corrigindo: 2,
    salvando: 3,
    concluida: 4,
    erro: 0,
  } as const;

  const minimo =
    passo === "gerando"
      ? 1
      : passo === "revisando"
        ? 2
        : 3;

  return ordem[job.etapa] >= minimo;
}

function obterRotuloEtapa(
  atividade: AtividadeGeracaoIA
) {
  switch (atividade.etapa) {
    case "preparando":
      return "Preparando";
    case "gerando":
      return "Gerando";
    case "revisando":
      return "Revisando qualidade";
    case "corrigindo":
      return "Corrigindo revisão";
    case "salvando":
      return "Finalizando";
    case "concluida":
      return "Geração concluída";
    case "erro":
      return "A geração precisa de atenção";
  }
}

function obterTextoEtapa(
  atividade: AtividadeGeracaoIA
) {
  const bloco =
    atividade.blocosTotal > 1
      ? ` · bloco ${atividade.blocoAtual}/${atividade.blocosTotal}`
      : "";

  switch (atividade.etapa) {
    case "preparando":
      return "Preparando o pedido";
    case "gerando":
      return `A IA está criando as questões${bloco}`;
    case "revisando":
      return `Revisão independente de qualidade${bloco}`;
    case "corrigindo":
      return `Corrigindo uma revisão rejeitada${bloco}`;
    case "salvando":
      return "Organizando e salvando o caderno";
    default:
      return obterRotuloEtapa(atividade);
  }
}
