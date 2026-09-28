import {
  Eraser,
  FileCheck2,
  Highlighter,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  Undo2,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

type Ferramenta = "mover" | "lapis" | "marca-texto" | "borracha";
type Ponto = { x: number; y: number };
type Traco = {
  id: string;
  ferramenta: "lapis" | "marca-texto";
  cor: string;
  espessura: number;
  pontos: Ponto[];
};
type AnotacoesPorPagina = Record<number, Traco[]>;

type PdfJsPage = {
  getViewport: (args: { scale: number }) => { width: number; height: number };
  render: (args: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
    transform?: number[];
  }) => { promise: Promise<void> };
};

type PdfJsDocument = {
  numPages: number;
  getPage: (numero: number) => Promise<PdfJsPage>;
  destroy?: () => Promise<void>;
};

declare global {
  interface Window {
    pdfjsLib?: {
      GlobalWorkerOptions: { workerSrc: string };
      getDocument: (args: { data: ArrayBuffer }) => {
        promise: Promise<PdfJsDocument>;
      };
    };
  }
}

const PDFJS_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const CORES = [
  "#ef4444",
  "#f59e0b",
  "#22c55e",
  "#38bdf8",
  "#8b5cf6",
  "#f8fafc",
];

export default function PdfAnotavel({
  arquivo,
  pausado,
}: {
  arquivo: File;
  pausado: boolean;
}) {
  const areaRef = useRef<HTMLDivElement | null>(null);
  const [pdf, setPdf] = useState<PdfJsDocument | null>(null);
  const [paginas, setPaginas] = useState(1);
  const [larguraArea, setLarguraArea] = useState(900);
  const [zoom, setZoom] = useState(1);
  const [ferramenta, setFerramenta] = useState<Ferramenta>("mover");
  const [cor, setCor] = useState(CORES[0]);
  const [espessura, setEspessura] = useState(3);
  const [anotacoes, setAnotacoes] = useState<AnotacoesPorPagina>({});
  const [historico, setHistorico] = useState<AnotacoesPorPagina[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let cancelado = false;
    let documento: PdfJsDocument | null = null;

    async function carregar() {
      setCarregando(true);
      setErro("");

      try {
        await carregarPdfJs();
        if (!window.pdfjsLib) throw new Error("Leitor de PDF indisponível.");

        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
        documento = await window.pdfjsLib.getDocument({
          data: await arquivo.arrayBuffer(),
        }).promise;

        if (cancelado) return;
        setPdf(documento);
        setPaginas(documento.numPages);
      } catch (e) {
        if (!cancelado) {
          setErro(
            e instanceof Error
              ? e.message
              : "Não foi possível abrir o PDF nesta prévia."
          );
        }
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    void carregar();

    return () => {
      cancelado = true;
      void documento?.destroy?.();
    };
  }, [arquivo]);

  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;

    const atualizar = () => {
      setLarguraArea(Math.max(280, area.clientWidth - 28));
    };

    atualizar();

    const observer = new ResizeObserver(atualizar);
    observer.observe(area);

    return () => observer.disconnect();
  }, []);

  function salvarSnapshot() {
    setHistorico((itens) => [...itens.slice(-29), structuredClone(anotacoes)]);
  }

  function atualizarPagina(numero: number, tracos: Traco[]) {
    setAnotacoes((atuais) => ({
      ...atuais,
      [numero]: tracos,
    }));
  }

  function desfazer() {
    setHistorico((itens) => {
      const anterior = itens[itens.length - 1];
      if (!anterior) return itens;

      setAnotacoes(anterior);
      return itens.slice(0, -1);
    });
  }

  if (erro) {
    return (
      <div className="pdf-erro">
        <strong>Não consegui abrir o PDF dentro do Study Pro.</strong>
        <p>{erro}</p>
      </div>
    );
  }

  return (
    <div className="pdf-anotavel">
      <div className="pdf-toolbar">
        <div className="grupo pagina pagina-continuo">
          <strong>
            {paginas} <span>páginas · rolagem contínua</span>
          </strong>
        </div>

        <div className="grupo ferramentas">
          <button
            type="button"
            className={ferramenta === "mover" ? "ativo" : ""}
            onClick={() => setFerramenta("mover")}
            title="Navegar"
          >
            <FileCheck2 size={17} />
          </button>
          <button
            type="button"
            className={ferramenta === "lapis" ? "ativo" : ""}
            onClick={() => setFerramenta("lapis")}
            title="Desenhar"
          >
            <Pencil size={17} />
          </button>
          <button
            type="button"
            className={ferramenta === "marca-texto" ? "ativo" : ""}
            onClick={() => setFerramenta("marca-texto")}
            title="Marca-texto"
          >
            <Highlighter size={17} />
          </button>
          <button
            type="button"
            className={ferramenta === "borracha" ? "ativo" : ""}
            onClick={() => setFerramenta("borracha")}
            title="Borracha"
          >
            <Eraser size={17} />
          </button>
          <button
            type="button"
            disabled={historico.length === 0}
            onClick={desfazer}
            title="Desfazer"
          >
            <Undo2 size={17} />
          </button>
        </div>

        {(ferramenta === "lapis" || ferramenta === "marca-texto") && (
          <div className="grupo estilo">
            <div className="cores">
              {CORES.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={cor === item ? "ativo" : ""}
                  style={{ background: item }}
                  onClick={() => setCor(item)}
                  aria-label={"Usar cor " + item}
                />
              ))}
            </div>
            <label>
              <span>Espessura</span>
              <input
                type="range"
                min={1}
                max={8}
                value={espessura}
                onChange={(e) => setEspessura(Number(e.target.value))}
              />
            </label>
          </div>
        )}

        <div className="grupo zoom">
          <button
            type="button"
            onClick={() => setZoom((valor) => Math.max(0.5, valor - 0.1))}
            aria-label="Afastar"
          >
            <Minus size={17} />
          </button>
          <strong>{Math.round(zoom * 100)}%</strong>
          <button
            type="button"
            onClick={() => setZoom((valor) => Math.min(2.5, valor + 0.1))}
            aria-label="Aproximar"
          >
            <Plus size={17} />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            title="Ajustar à largura"
          >
            <RotateCcw size={17} />
            <span>Ajustar</span>
          </button>
        </div>
      </div>

      <div className="pdf-area pdf-area-continuo" ref={areaRef}>
        {carregando && <div className="pdf-carregando">Abrindo PDF…</div>}

        {pdf && (
          <div className="pdf-paginas-continuas">
            {Array.from({ length: paginas }, (_, indice) => {
              const numero = indice + 1;

              return (
                <PaginaPdfAnotavel
                  key={numero}
                  pdf={pdf}
                  numero={numero}
                  totalPaginas={paginas}
                  larguraDisponivel={larguraArea}
                  zoom={zoom}
                  ferramenta={ferramenta}
                  cor={cor}
                  espessura={espessura}
                  pausado={pausado}
                  tracos={anotacoes[numero] ?? []}
                  aoSalvarSnapshot={salvarSnapshot}
                  aoAlterar={(tracos) => atualizarPagina(numero, tracos)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function PaginaPdfAnotavel({
  pdf,
  numero,
  totalPaginas,
  larguraDisponivel,
  zoom,
  ferramenta,
  cor,
  espessura,
  pausado,
  tracos,
  aoSalvarSnapshot,
  aoAlterar,
}: {
  pdf: PdfJsDocument;
  numero: number;
  totalPaginas: number;
  larguraDisponivel: number;
  zoom: number;
  ferramenta: Ferramenta;
  cor: string;
  espessura: number;
  pausado: boolean;
  tracos: Traco[];
  aoSalvarSnapshot: () => void;
  aoAlterar: (tracos: Traco[]) => void;
}) {
  const canvasPdfRef = useRef<HTMLCanvasElement | null>(null);
  const canvasAnotacaoRef = useRef<HTMLCanvasElement | null>(null);
  const desenhoRef = useRef<Traco | null>(null);
  const tamanhoRef = useRef({ width: 1, height: 1 });

  useEffect(() => {
    let cancelado = false;

    async function renderizar() {
      const canvas = canvasPdfRef.current;
      if (!canvas) return;

      const paginaPdf = await pdf.getPage(numero);
      if (cancelado) return;

      const viewportBase = paginaPdf.getViewport({ scale: 1 });
      const escalaAjuste = larguraDisponivel / viewportBase.width;
      const escala = Math.max(0.35, Math.min(3, escalaAjuste * zoom));
      const viewport = paginaPdf.getViewport({ scale: escala });
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.ceil(viewport.width * dpr);
      canvas.height = Math.ceil(viewport.height * dpr);
      canvas.style.width = String(viewport.width) + "px";
      canvas.style.height = String(viewport.height) + "px";

      const anotacao = canvasAnotacaoRef.current;
      if (anotacao) {
        anotacao.width = Math.ceil(viewport.width * dpr);
        anotacao.height = Math.ceil(viewport.height * dpr);
        anotacao.style.width = String(viewport.width) + "px";
        anotacao.style.height = String(viewport.height) + "px";
      }

      tamanhoRef.current = {
        width: viewport.width,
        height: viewport.height,
      };

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      await paginaPdf.render({
        canvasContext: ctx,
        viewport,
        transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
      }).promise;
    }

    void renderizar();

    return () => {
      cancelado = true;
    };
  }, [larguraDisponivel, numero, pdf, zoom]);

  useEffect(() => {
    redesenharAnotacoes(canvasAnotacaoRef.current, tracos, tamanhoRef.current);
  }, [tracos]);

  function pontoDoEvento(evento: ReactPointerEvent<HTMLCanvasElement>): Ponto {
    const rect = evento.currentTarget.getBoundingClientRect();

    return {
      x: Math.max(0, Math.min(1, (evento.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (evento.clientY - rect.top) / rect.height)),
    };
  }

  function aoPressionar(evento: ReactPointerEvent<HTMLCanvasElement>) {
    if (pausado || ferramenta === "mover") return;

    evento.currentTarget.setPointerCapture(evento.pointerId);
    aoSalvarSnapshot();

    const ponto = pontoDoEvento(evento);

    if (ferramenta === "borracha") {
      apagarPerto(ponto);
      return;
    }

    desenhoRef.current = {
      id: crypto.randomUUID(),
      ferramenta,
      cor,
      espessura,
      pontos: [ponto],
    };
  }

  function aoMover(evento: ReactPointerEvent<HTMLCanvasElement>) {
    if (pausado || ferramenta === "mover") return;

    const ponto = pontoDoEvento(evento);

    if (ferramenta === "borracha") {
      if (evento.buttons || evento.pressure > 0) apagarPerto(ponto);
      return;
    }

    const atual = desenhoRef.current;
    if (!atual) return;

    atual.pontos.push(ponto);
    const semAtual = tracos.filter((item) => item.id !== atual.id);
    aoAlterar([...semAtual, structuredClone(atual)]);
  }

  function aoSoltar() {
    desenhoRef.current = null;
  }

  function apagarPerto(ponto: Ponto) {
    const limite = 0.025;

    aoAlterar(
      tracos.filter(
        (traco) =>
          !traco.pontos.some(
            (item) =>
              Math.hypot(item.x - ponto.x, item.y - ponto.y) <= limite
          )
      )
    );
  }

  return (
    <section className="pdf-pagina-bloco" aria-label={"Página " + numero}>
      <div className="pdf-pagina-indicador">
        Página {numero} de {totalPaginas}
      </div>
      <div className="pdf-pagina">
        <canvas ref={canvasPdfRef} />
        <canvas
          ref={canvasAnotacaoRef}
          className={"anotacoes ferramenta-" + ferramenta}
          onPointerDown={aoPressionar}
          onPointerMove={aoMover}
          onPointerUp={aoSoltar}
          onPointerCancel={aoSoltar}
        />
      </div>
    </section>
  );
}

function redesenharAnotacoes(
  canvas: HTMLCanvasElement | null,
  tracos: Traco[],
  tamanho: { width: number; height: number }
) {
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, tamanho.width, tamanho.height);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const traco of tracos) {
    if (traco.pontos.length < 2) continue;

    ctx.save();
    ctx.globalAlpha = traco.ferramenta === "marca-texto" ? 0.28 : 1;
    ctx.strokeStyle = traco.cor;
    ctx.lineWidth =
      traco.espessura * (traco.ferramenta === "marca-texto" ? 5 : 1);
    ctx.beginPath();

    traco.pontos.forEach((ponto, indice) => {
      const x = ponto.x * tamanho.width;
      const y = ponto.y * tamanho.height;

      if (indice === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();
    ctx.restore();
  }
}

let carregamentoPdfJs: Promise<void> | null = null;

function carregarPdfJs() {
  if (window.pdfjsLib) return Promise.resolve();
  if (carregamentoPdfJs) return carregamentoPdfJs;

  carregamentoPdfJs = new Promise<void>((resolve, reject) => {
    const existente = document.querySelector<HTMLScriptElement>(
      'script[src="' + PDFJS_URL + '"]'
    );

    if (existente) {
      existente.addEventListener("load", () => resolve(), { once: true });
      existente.addEventListener(
        "error",
        () => reject(new Error("Falha ao carregar o leitor de PDF.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = PDFJS_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Falha ao carregar o leitor de PDF."));
    document.head.appendChild(script);
  });

  return carregamentoPdfJs;
}
