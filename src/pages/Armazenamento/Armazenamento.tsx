import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FileText,
  HardDrive,
  Image as ImageIcon,
  LockKeyhole,
  Play,
  Trash2,
  UploadCloud,
  Video,
} from "lucide-react";

import { useApp } from "../../context/AppContext";
import {
  atualizarDuracaoVideoStudyStorage,
  enviarArquivoStudyStorage,
  excluirArquivoStudyStorage,
  listarArquivosStudyStorage,
  listarProgressosStudyStorage,
  obterStatusStudyStorage,
  obterUrlPrivadaStudyStorage,
  salvarProgressoVideoStudyStorage,
  type StudyStorageFile,
  type StudyStorageProgress,
  type StudyStorageStatus,
} from "../../services/studyProStorageService";

import "./Armazenamento.css";

export default function Armazenamento() {
  const { materias } = useApp();

  const [status, setStatus] =
    useState<StudyStorageStatus | null>(null);
  const [arquivos, setArquivos] =
    useState<StudyStorageFile[]>([]);
  const [progressos, setProgressos] =
    useState<Record<string, StudyStorageProgress>>({});
  const [arquivoUpload, setArquivoUpload] =
    useState<File | null>(null);
  const [materia, setMateria] = useState("");
  const [assunto, setAssunto] = useState("");
  const [percentualUpload, setPercentualUpload] =
    useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [videoAtual, setVideoAtual] =
    useState<StudyStorageFile | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const ultimoSegundoSalvo = useRef(0);

  const totalBytes = useMemo(
    () =>
      arquivos.reduce(
        (total, arquivo) => total + arquivo.sizeBytes,
        0
      ),
    [arquivos]
  );

  const carregar = useCallback(async () => {
    try {
      setCarregando(true);
      setErro("");

      const [estado, lista, listaProgressos] =
        await Promise.all([
          obterStatusStudyStorage(),
          listarArquivosStudyStorage(),
          listarProgressosStudyStorage(),
        ]);

      setStatus(estado);
      setArquivos(lista);
      setProgressos(
        Object.fromEntries(
          listaProgressos.map((item) => [
            item.fileId,
            item,
          ])
        )
      );
    } catch (falha) {
      setErro(obterMensagemErro(falha));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function enviarArquivo() {
    if (!arquivoUpload) {
      setErro("Escolha um arquivo para enviar.");
      return;
    }

    try {
      setErro("");
      setMensagem("");
      setEnviando(true);
      setPercentualUpload(0);

      const novo = await enviarArquivoStudyStorage({
        arquivo: arquivoUpload,
        materia: materia || undefined,
        assunto: assunto || undefined,
        onProgress: setPercentualUpload,
      });

      setArquivos((atuais) => [
        novo,
        ...atuais,
      ]);
      setArquivoUpload(null);
      setAssunto("");
      setPercentualUpload(100);
      setMensagem(
        "Arquivo salvo no seu armazenamento privado."
      );
    } catch (falha) {
      setErro(obterMensagemErro(falha));
    } finally {
      setEnviando(false);
    }
  }

  async function abrirArquivo(
    arquivo: StudyStorageFile
  ) {
    try {
      setErro("");
      const url =
        await obterUrlPrivadaStudyStorage(arquivo);

      if (arquivo.kind === "video") {
        setVideoAtual(arquivo);
        setVideoUrl(url);
        ultimoSegundoSalvo.current =
          progressos[arquivo.id]?.positionSeconds || 0;
        return;
      }

      window.open(
        url,
        "_blank",
        "noopener,noreferrer"
      );
    } catch (falha) {
      setErro(obterMensagemErro(falha));
    }
  }

  async function excluirArquivo(
    arquivo: StudyStorageFile
  ) {
    if (
      !window.confirm(
        `Excluir definitivamente "${arquivo.fileName}"?`
      )
    ) {
      return;
    }

    try {
      setErro("");
      await excluirArquivoStudyStorage(arquivo);
      setArquivos((atuais) =>
        atuais.filter(
          (item) => item.id !== arquivo.id
        )
      );

      if (videoAtual?.id === arquivo.id) {
        setVideoAtual(null);
        setVideoUrl("");
      }
    } catch (falha) {
      setErro(obterMensagemErro(falha));
    }
  }

  async function salvarProgresso(
    video: HTMLVideoElement,
    forcar = false
  ) {
    if (!videoAtual) return;

    const atual = Math.floor(video.currentTime || 0);
    const duracao = Number.isFinite(video.duration)
      ? Math.floor(video.duration)
      : undefined;

    if (
      !forcar &&
      Math.abs(atual - ultimoSegundoSalvo.current) < 15
    ) {
      return;
    }

    ultimoSegundoSalvo.current = atual;

    try {
      await salvarProgressoVideoStudyStorage(
        videoAtual.id,
        atual,
        duracao
      );

      const registro: StudyStorageProgress = {
        fileId: videoAtual.id,
        positionSeconds: atual,
        durationSeconds: duracao,
        completed:
          Boolean(duracao) &&
          atual >= Math.max(0, Number(duracao) - 15),
        updatedAt: new Date().toISOString(),
      };

      setProgressos((atuais) => ({
        ...atuais,
        [videoAtual.id]: registro,
      }));
    } catch (falha) {
      console.warn(
        "Falha ao salvar progresso do vídeo:",
        falha
      );
    }
  }

  function prepararVideo(
    video: HTMLVideoElement
  ) {
    if (!videoAtual) return;

    const salvo =
      progressos[videoAtual.id]?.positionSeconds || 0;

    if (
      salvo > 0 &&
      salvo < video.duration - 5
    ) {
      video.currentTime = salvo;
    }

    if (Number.isFinite(video.duration)) {
      void atualizarDuracaoVideoStudyStorage(
        videoAtual.id,
        video.duration
      );
    }
  }

  return (
    <div className="study-storage-page">
      <section className="study-storage-hero">
        <div>
          <span className="study-storage-kicker">
            <LockKeyhole size={16} />
            PRIVADO POR CONTA
          </span>
          <h1>Study Pro Storage</h1>
          <p>
            Seus vídeos, PDFs e imagens ficam vinculados ao
            seu usuário. Outros alunos não recebem acesso nem
            a listagem dos seus arquivos.
          </p>
        </div>

        <div className="study-storage-resumo">
          <HardDrive size={24} />
          <strong>{formatarBytes(totalBytes)}</strong>
          <span>{arquivos.length} arquivo(s)</span>
        </div>
      </section>

      {erro && (
        <div className="study-storage-alerta erro">
          {erro}
        </div>
      )}

      {mensagem && (
        <div className="study-storage-alerta sucesso">
          {mensagem}
        </div>
      )}

      <section className="study-storage-upload-card">
        <div className="study-storage-card-title">
          <UploadCloud size={22} />
          <div>
            <h2>Enviar arquivo</h2>
            <p>
              O arquivo grande vai direto ao provedor de
              armazenamento e não atravessa a Vercel.
            </p>
          </div>
        </div>

        {!status?.configured && !carregando && (
          <div className="study-storage-provider-pendente">
            A estrutura do Study Pro Storage está pronta.
            Falta somente conectar o primeiro provedor físico
            S3 compatível para liberar os uploads.
          </div>
        )}

        <div className="study-storage-form">
          <label>
            Arquivo
            <input
              type="file"
              accept=".mp4,.webm,.pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx"
              disabled={!status?.configured || enviando}
              onChange={(evento) =>
                setArquivoUpload(
                  evento.target.files?.[0] || null
                )
              }
            />
          </label>

          <label>
            Matéria
            <select
              value={materia}
              disabled={enviando}
              onChange={(evento) =>
                setMateria(evento.target.value)
              }
            >
              <option value="">
                Sem vínculo
              </option>
              {materias.map((item) => (
                <option
                  key={item.id}
                  value={item.nome}
                >
                  {item.nome}
                </option>
              ))}
            </select>
          </label>

          <label>
            Assunto
            <input
              value={assunto}
              disabled={enviando}
              placeholder="Ex.: Confederação do Equador"
              onChange={(evento) =>
                setAssunto(evento.target.value)
              }
            />
          </label>
        </div>

        {arquivoUpload && (
          <div className="study-storage-arquivo-selecionado">
            <strong>{arquivoUpload.name}</strong>
            <span>
              {formatarBytes(arquivoUpload.size)}
            </span>
          </div>
        )}

        {percentualUpload !== null && (
          <div className="study-storage-upload-progress">
            <div>
              <span>Upload</span>
              <strong>{percentualUpload}%</strong>
            </div>
            <progress
              max={100}
              value={percentualUpload}
            />
          </div>
        )}

        <button
          type="button"
          className="study-storage-upload-button"
          disabled={
            !status?.configured ||
            !arquivoUpload ||
            enviando
          }
          onClick={() => void enviarArquivo()}
        >
          <UploadCloud size={18} />
          {enviando
            ? "Enviando..."
            : "Enviar para meu armazenamento"}
        </button>

        {status && (
          <small className="study-storage-limite">
            Limite atual por arquivo:{" "}
            {formatarBytes(status.maxFileBytes)}
          </small>
        )}
      </section>

      {videoAtual && videoUrl && (
        <section className="study-storage-player-card">
          <div className="study-storage-player-heading">
            <div>
              <span>ASSISTINDO</span>
              <h2>{videoAtual.fileName}</h2>
              <p>
                {[videoAtual.materia, videoAtual.assunto]
                  .filter(Boolean)
                  .join(" • ") || "Arquivo privado"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setVideoAtual(null);
                setVideoUrl("");
              }}
            >
              Fechar
            </button>
          </div>

          <video
            key={videoAtual.id}
            className="study-storage-player"
            src={videoUrl}
            controls
            playsInline
            onLoadedMetadata={(evento) =>
              prepararVideo(evento.currentTarget)
            }
            onTimeUpdate={(evento) =>
              void salvarProgresso(
                evento.currentTarget
              )
            }
            onPause={(evento) =>
              void salvarProgresso(
                evento.currentTarget,
                true
              )
            }
            onEnded={(evento) =>
              void salvarProgresso(
                evento.currentTarget,
                true
              )
            }
          />
        </section>
      )}

      <section className="study-storage-lista-card">
        <div className="study-storage-lista-heading">
          <div>
            <h2>Meus arquivos</h2>
            <p>
              Cada conta consulta apenas os próprios registros.
            </p>
          </div>
        </div>

        {carregando ? (
          <div className="study-storage-vazio">
            Carregando armazenamento...
          </div>
        ) : arquivos.length === 0 ? (
          <div className="study-storage-vazio">
            Nenhum arquivo privado salvo ainda.
          </div>
        ) : (
          <div className="study-storage-grid">
            {arquivos.map((arquivo) => {
              const progresso =
                progressos[arquivo.id];
              const percentual =
                obterPercentualProgresso(
                  progresso,
                  arquivo
                );

              return (
                <article
                  key={arquivo.id}
                  className="study-storage-item"
                >
                  <div className="study-storage-item-icon">
                    {iconeArquivo(arquivo.kind)}
                  </div>

                  <div className="study-storage-item-corpo">
                    <strong title={arquivo.fileName}>
                      {arquivo.fileName}
                    </strong>
                    <span>
                      {formatarBytes(arquivo.sizeBytes)}
                      {arquivo.materia
                        ? ` • ${arquivo.materia}`
                        : ""}
                    </span>
                    {arquivo.assunto && (
                      <span>{arquivo.assunto}</span>
                    )}

                    {arquivo.kind === "video" &&
                      percentual !== null && (
                        <div className="study-storage-item-progress">
                          <progress
                            max={100}
                            value={percentual}
                          />
                          <small>
                            {percentual}% assistido
                          </small>
                        </div>
                      )}
                  </div>

                  <div className="study-storage-item-acoes">
                    <button
                      type="button"
                      onClick={() =>
                        void abrirArquivo(arquivo)
                      }
                    >
                      {arquivo.kind === "video" ? (
                        <>
                          <Play size={16} />
                          Assistir
                        </>
                      ) : (
                        "Abrir"
                      )}
                    </button>

                    <button
                      type="button"
                      className="perigo"
                      aria-label={`Excluir ${arquivo.fileName}`}
                      onClick={() =>
                        void excluirArquivo(arquivo)
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function iconeArquivo(
  kind: StudyStorageFile["kind"]
) {
  if (kind === "video") return <Video size={22} />;
  if (kind === "image") return <ImageIcon size={22} />;
  return <FileText size={22} />;
}

function obterPercentualProgresso(
  progresso: StudyStorageProgress | undefined,
  arquivo: StudyStorageFile
) {
  if (!progresso) return 0;

  const duracao =
    progresso.durationSeconds ||
    arquivo.durationSeconds;

  if (!duracao) return null;

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (progresso.positionSeconds / duracao) * 100
      )
    )
  );
}

function formatarBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const unidades = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB",
  ];
  const indice = Math.min(
    unidades.length - 1,
    Math.floor(
      Math.log(bytes) / Math.log(1024)
    )
  );
  const valor = bytes / 1024 ** indice;

  return `${valor.toLocaleString("pt-BR", {
    maximumFractionDigits:
      indice >= 3 ? 2 : 1,
  })} ${unidades[indice]}`;
}

function obterMensagemErro(
  valor: unknown
) {
  return valor instanceof Error
    ? valor.message
    : "Ocorreu um erro inesperado.";
}
