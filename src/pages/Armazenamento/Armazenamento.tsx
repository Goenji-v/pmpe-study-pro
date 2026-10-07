import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ExternalLink,
  FileText,
  Link2,
  LockKeyhole,
  Play,
  Trash2,
  UploadCloud,
  Video,
} from "lucide-react";
import {
  useNavigate,
} from "react-router-dom";

import { useApp } from "../../context/AppContext";
import {
  adicionarAulaPrivada,
  listarAulasPrivadas,
  obterEmbedUrlAula,
  removerAulaPrivada,
  temAcessoBibliotecaPrivada,
  type PrivateLesson,
  type PrivateLessonSource,
} from "../../services/privateLessonsService";
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
  const navigate = useNavigate();
  const { materias } = useApp();

  const [acesso, setAcesso] =
    useState<boolean | null>(null);
  const [aulas, setAulas] =
    useState<PrivateLesson[]>([]);
  const [aulaAtual, setAulaAtual] =
    useState<PrivateLesson | null>(null);
  const [embedUrl, setEmbedUrl] =
    useState("");

  const [status, setStatus] =
    useState<StudyStorageStatus | null>(null);
  const [arquivos, setArquivos] =
    useState<StudyStorageFile[]>([]);
  const [progressos, setProgressos] =
    useState<Record<string, StudyStorageProgress>>({});
  const [videoAtual, setVideoAtual] =
    useState<StudyStorageFile | null>(null);
  const [videoUrl, setVideoUrl] =
    useState("");
  const ultimoSegundoSalvo = useRef(0);

  const [sourceType, setSourceType] =
    useState<PrivateLessonSource>("google_drive");
  const [titulo, setTitulo] =
    useState("");
  const [sourceUrl, setSourceUrl] =
    useState("");
  const [materia, setMateria] =
    useState("");
  const [assunto, setAssunto] =
    useState("");
  const [salvandoLink, setSalvandoLink] =
    useState(false);

  const [arquivoUpload, setArquivoUpload] =
    useState<File | null>(null);
  const [percentualUpload, setPercentualUpload] =
    useState<number | null>(null);
  const [enviando, setEnviando] =
    useState(false);

  const [carregando, setCarregando] =
    useState(true);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] =
    useState("");

  const totalBytes = useMemo(
    () =>
      arquivos.reduce(
        (total, arquivo) =>
          total + arquivo.sizeBytes,
        0
      ),
    [arquivos]
  );

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");

    try {
      const permitido =
        await temAcessoBibliotecaPrivada();

      setAcesso(permitido);

      if (!permitido) {
        navigate("/", {
          replace: true,
        });
        return;
      }

      const [aulasPrivadas, lista, listaProgressos] =
        await Promise.all([
          listarAulasPrivadas(),
          listarArquivosStudyStorage(),
          listarProgressosStudyStorage(),
        ]);

      setAulas(aulasPrivadas);
      setArquivos(lista);
      setProgressos(
        Object.fromEntries(
          listaProgressos.map((item) => [
            item.fileId,
            item,
          ])
        )
      );

      try {
        setStatus(
          await obterStatusStudyStorage()
        );
      } catch {
        setStatus(null);
      }
    } catch (falha) {
      setErro(obterMensagemErro(falha));
    } finally {
      setCarregando(false);
    }
  }, [navigate]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function salvarLink() {
    try {
      setSalvandoLink(true);
      setErro("");
      setMensagem("");

      const nova =
        await adicionarAulaPrivada({
          sourceType,
          title: titulo,
          sourceUrl,
          materia:
            materia || undefined,
          assunto:
            assunto || undefined,
        });

      setAulas((atuais) => [
        nova,
        ...atuais,
      ]);
      setTitulo("");
      setSourceUrl("");
      setAssunto("");
      setMensagem(
        "Aula adicionada à sua biblioteca privada."
      );
    } catch (falha) {
      setErro(
        obterMensagemErro(falha)
      );
    } finally {
      setSalvandoLink(false);
    }
  }

  function assistirLink(
    aula: PrivateLesson
  ) {
    try {
      setErro("");
      setVideoAtual(null);
      setVideoUrl("");
      setEmbedUrl(
        obterEmbedUrlAula(aula)
      );
      setAulaAtual(aula);
    } catch (falha) {
      setErro(
        obterMensagemErro(falha)
      );
    }
  }

  async function excluirLink(
    aula: PrivateLesson
  ) {
    if (
      !window.confirm(
        `Remover "${aula.title}" da sua biblioteca?`
      )
    ) {
      return;
    }

    try {
      await removerAulaPrivada(
        aula.id
      );
      setAulas((atuais) =>
        atuais.filter(
          (item) =>
            item.id !== aula.id
        )
      );

      if (
        aulaAtual?.id === aula.id
      ) {
        setAulaAtual(null);
        setEmbedUrl("");
      }
    } catch (falha) {
      setErro(
        obterMensagemErro(falha)
      );
    }
  }

  async function enviarArquivo() {
    if (!arquivoUpload) {
      setErro(
        "Escolha um arquivo para enviar."
      );
      return;
    }

    try {
      setErro("");
      setMensagem("");
      setEnviando(true);
      setPercentualUpload(0);

      const novo =
        await enviarArquivoStudyStorage({
          arquivo:
            arquivoUpload,
          materia:
            materia || undefined,
          assunto:
            assunto || undefined,
          onProgress:
            setPercentualUpload,
        });

      setArquivos((atuais) => [
        novo,
        ...atuais,
      ]);
      setArquivoUpload(null);
      setPercentualUpload(100);
      setMensagem(
        "Arquivo salvo no seu armazenamento privado."
      );
    } catch (falha) {
      setErro(
        obterMensagemErro(falha)
      );
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
        await obterUrlPrivadaStudyStorage(
          arquivo
        );

      if (
        arquivo.kind === "video"
      ) {
        setAulaAtual(null);
        setEmbedUrl("");
        setVideoAtual(arquivo);
        setVideoUrl(url);
        ultimoSegundoSalvo.current =
          progressos[arquivo.id]
            ?.positionSeconds || 0;
        return;
      }

      window.open(
        url,
        "_blank",
        "noopener,noreferrer"
      );
    } catch (falha) {
      setErro(
        obterMensagemErro(falha)
      );
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
      await excluirArquivoStudyStorage(
        arquivo
      );
      setArquivos((atuais) =>
        atuais.filter(
          (item) =>
            item.id !== arquivo.id
        )
      );

      if (
        videoAtual?.id ===
        arquivo.id
      ) {
        setVideoAtual(null);
        setVideoUrl("");
      }
    } catch (falha) {
      setErro(
        obterMensagemErro(falha)
      );
    }
  }

  async function salvarProgresso(
    video: HTMLVideoElement,
    forcar = false
  ) {
    if (!videoAtual) return;

    const atual = Math.floor(
      video.currentTime || 0
    );
    const duracao =
      Number.isFinite(
        video.duration
      )
        ? Math.floor(
            video.duration
          )
        : undefined;

    if (
      !forcar &&
      Math.abs(
        atual -
          ultimoSegundoSalvo.current
      ) < 15
    ) {
      return;
    }

    ultimoSegundoSalvo.current =
      atual;

    try {
      await salvarProgressoVideoStudyStorage(
        videoAtual.id,
        atual,
        duracao
      );

      setProgressos(
        (atuais) => ({
          ...atuais,
          [videoAtual.id]: {
            fileId:
              videoAtual.id,
            positionSeconds:
              atual,
            durationSeconds:
              duracao,
            completed:
              Boolean(duracao) &&
              atual >=
                Math.max(
                  0,
                  Number(duracao) -
                    15
                ),
            updatedAt:
              new Date()
                .toISOString(),
          },
        })
      );
    } catch (falha) {
      console.warn(
        "Falha ao salvar progresso:",
        falha
      );
    }
  }

  function prepararVideo(
    video: HTMLVideoElement
  ) {
    if (!videoAtual) return;

    const salvo =
      progressos[videoAtual.id]
        ?.positionSeconds || 0;

    if (
      salvo > 0 &&
      salvo <
        video.duration - 5
    ) {
      video.currentTime = salvo;
    }

    if (
      Number.isFinite(
        video.duration
      )
    ) {
      void atualizarDuracaoVideoStudyStorage(
        videoAtual.id,
        video.duration
      );
    }
  }

  if (
    acesso === null ||
    carregando
  ) {
    return (
      <div
        className="study-storage-vazio"
        role="status"
      >
        Carregando sua biblioteca privada...
      </div>
    );
  }

  if (!acesso) return null;

  return (
    <div className="study-storage-page">
      <section className="study-storage-hero">
        <div>
          <span className="study-storage-kicker">
            <LockKeyhole size={16} />
            SOMENTE SUA CONTA
          </span>
          <h1>Minhas aulas</h1>
          <p>
            Guarde seus vídeos no Google Drive ou use um link
            do YouTube. O Study Pro só organiza e abre tudo
            aqui dentro. O R2 continua disponível como opção.
          </p>
        </div>

        <div className="study-storage-resumo">
          <Video size={24} />
          <strong>
            {aulas.length +
              arquivos.filter(
                (item) =>
                  item.kind ===
                  "video"
              ).length}
          </strong>
          <span>aula(s) cadastrada(s)</span>
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
          <Link2 size={22} />
          <div>
            <h2>Adicionar aula por link</h2>
            <p>
              Suba o vídeo no Drive uma vez e cole o link aqui.
              Depois basta clicar em Assistir.
            </p>
          </div>
        </div>

        <div className="study-storage-form study-storage-form-links">
          <label>
            Fonte
            <select
              value={sourceType}
              onChange={(evento) =>
                setSourceType(
                  evento.target.value as PrivateLessonSource
                )
              }
            >
              <option value="google_drive">
                Google Drive
              </option>
              <option value="youtube">
                YouTube
              </option>
            </select>
          </label>

          <label>
            Título
            <input
              value={titulo}
              placeholder="Ex.: Live - Direitos Sociais"
              onChange={(evento) =>
                setTitulo(
                  evento.target.value
                )
              }
            />
          </label>

          <label>
            Link
            <input
              value={sourceUrl}
              placeholder={
                sourceType ===
                "google_drive"
                  ? "Cole o link do arquivo no Google Drive"
                  : "Cole o link do vídeo no YouTube"
              }
              onChange={(evento) =>
                setSourceUrl(
                  evento.target.value
                )
              }
            />
          </label>

          <label>
            Matéria
            <select
              value={materia}
              onChange={(evento) =>
                setMateria(
                  evento.target.value
                )
              }
            >
              <option value="">
                Sem vínculo
              </option>
              {materias.map(
                (item) => (
                  <option
                    key={item.id}
                    value={item.nome}
                  >
                    {item.nome}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            Assunto
            <input
              value={assunto}
              placeholder="Ex.: Direitos Sociais"
              onChange={(evento) =>
                setAssunto(
                  evento.target.value
                )
              }
            />
          </label>
        </div>

        <button
          type="button"
          className="study-storage-upload-button"
          disabled={
            salvandoLink ||
            !titulo.trim() ||
            !sourceUrl.trim()
          }
          onClick={() =>
            void salvarLink()
          }
        >
          <Link2 size={18} />
          {salvandoLink
            ? "Salvando..."
            : "Adicionar às minhas aulas"}
        </button>
      </section>

      {(aulaAtual &&
        embedUrl) && (
        <section className="study-storage-player-card">
          <div className="study-storage-player-heading">
            <div>
              <span>
                {aulaAtual.sourceType ===
                "google_drive"
                  ? "GOOGLE DRIVE"
                  : "YOUTUBE"}
              </span>
              <h2>
                {aulaAtual.title}
              </h2>
              <p>
                {[
                  aulaAtual.materia,
                  aulaAtual.assunto,
                ]
                  .filter(Boolean)
                  .join(" • ") ||
                  "Aula privada"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setAulaAtual(null);
                setEmbedUrl("");
              }}
            >
              Fechar
            </button>
          </div>

          <iframe
            className="study-storage-embed"
            src={embedUrl}
            title={
              aulaAtual.title
            }
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </section>
      )}

      {videoAtual &&
        videoUrl && (
          <section className="study-storage-player-card">
            <div className="study-storage-player-heading">
              <div>
                <span>STUDY PRO STORAGE</span>
                <h2>
                  {videoAtual.fileName}
                </h2>
                <p>
                  {[
                    videoAtual.materia,
                    videoAtual.assunto,
                  ]
                    .filter(Boolean)
                    .join(" • ") ||
                    "Arquivo privado"}
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
              onLoadedMetadata={(
                evento
              ) =>
                prepararVideo(
                  evento.currentTarget
                )
              }
              onTimeUpdate={(
                evento
              ) =>
                void salvarProgresso(
                  evento.currentTarget
                )
              }
              onPause={(
                evento
              ) =>
                void salvarProgresso(
                  evento.currentTarget,
                  true
                )
              }
              onEnded={(
                evento
              ) =>
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
            <h2>Minha biblioteca</h2>
            <p>
              Drive e YouTube ficam como atalhos privados; R2
              aparece junto quando houver arquivo salvo.
            </p>
          </div>
        </div>

        {aulas.length === 0 &&
        arquivos.length === 0 ? (
          <div className="study-storage-vazio">
            Nenhuma aula cadastrada ainda.
          </div>
        ) : (
          <div className="study-storage-grid">
            {aulas.map(
              (aula) => (
                <article
                  key={aula.id}
                  className="study-storage-item"
                >
                  <div className="study-storage-item-icon">
                    {aula.sourceType ===
                    "youtube" ? (
                      <Play size={22} />
                    ) : (
                      <ExternalLink size={22} />
                    )}
                  </div>

                  <div className="study-storage-item-corpo">
                    <strong>
                      {aula.title}
                    </strong>
                    <span>
                      {aula.sourceType ===
                      "google_drive"
                        ? "Google Drive"
                        : "YouTube"}
                      {aula.materia
                        ? ` • ${aula.materia}`
                        : ""}
                    </span>
                    {aula.assunto && (
                      <span>
                        {aula.assunto}
                      </span>
                    )}
                  </div>

                  <div className="study-storage-item-acoes">
                    <button
                      type="button"
                      onClick={() =>
                        assistirLink(
                          aula
                        )
                      }
                    >
                      <Play size={16} />
                      Assistir
                    </button>
                    <button
                      type="button"
                      className="perigo"
                      onClick={() =>
                        void excluirLink(
                          aula
                        )
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              )
            )}

            {arquivos.map(
              (arquivo) => (
                <article
                  key={arquivo.id}
                  className="study-storage-item"
                >
                  <div className="study-storage-item-icon">
                    {arquivo.kind ===
                    "video" ? (
                      <Video size={22} />
                    ) : (
                      <FileText size={22} />
                    )}
                  </div>

                  <div className="study-storage-item-corpo">
                    <strong>
                      {arquivo.fileName}
                    </strong>
                    <span>
                      Study Pro Storage
                      {arquivo.materia
                        ? ` • ${arquivo.materia}`
                        : ""}
                    </span>
                    {arquivo.assunto && (
                      <span>
                        {arquivo.assunto}
                      </span>
                    )}
                  </div>

                  <div className="study-storage-item-acoes">
                    <button
                      type="button"
                      onClick={() =>
                        void abrirArquivo(
                          arquivo
                        )
                      }
                    >
                      {arquivo.kind ===
                      "video" ? (
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
                      onClick={() =>
                        void excluirArquivo(
                          arquivo
                        )
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              )
            )}
          </div>
        )}
      </section>

      <details className="study-storage-upload-card study-storage-opcional">
        <summary>
          <span>
            <UploadCloud size={18} />
            Upload direto para o R2 (opcional)
          </span>
          <small>
            {status?.configured
              ? `${formatarBytes(totalBytes)} usados nesta área`
              : "Pode usar Drive normalmente sem isso"}
          </small>
        </summary>

        <p className="study-storage-opcional-texto">
          Use apenas quando preferir guardar o arquivo no
          Study Pro Storage em vez do Google Drive.
        </p>

        <div className="study-storage-form">
          <label>
            Arquivo
            <input
              type="file"
              accept=".mp4,.webm,.pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx"
              disabled={
                !status?.configured ||
                enviando
              }
              onChange={(evento) =>
                setArquivoUpload(
                  evento.target.files?.[0] ||
                    null
                )
              }
            />
          </label>
        </div>

        {percentualUpload !==
          null && (
          <div className="study-storage-upload-progress">
            <div>
              <span>Upload</span>
              <strong>
                {percentualUpload}%
              </strong>
            </div>
            <progress
              max={100}
              value={
                percentualUpload
              }
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
          onClick={() =>
            void enviarArquivo()
          }
        >
          <UploadCloud size={18} />
          {enviando
            ? "Enviando..."
            : "Enviar para R2"}
        </button>
      </details>
    </div>
  );
}

function formatarBytes(
  bytes: number
) {
  if (
    !Number.isFinite(bytes) ||
    bytes <= 0
  ) {
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
      Math.log(bytes) /
        Math.log(1024)
    )
  );
  const valor =
    bytes /
    1024 ** indice;

  return `${valor.toLocaleString(
    "pt-BR",
    {
      maximumFractionDigits:
        indice >= 3 ? 2 : 1,
    }
  )} ${unidades[indice]}`;
}

function obterMensagemErro(
  valor: unknown
) {
  return valor instanceof Error
    ? valor.message
    : "Ocorreu um erro inesperado.";
}
