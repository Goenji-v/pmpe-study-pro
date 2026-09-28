import {
  ChevronLeft,
  ChevronRight,
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
  useCallback,
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

type PdfJsDocument = {
  numPages: number;
  getPage: (numero: number) => Promise<{
    getViewport: (args: { scale: number }) => { width: number; height: number };
    render: (args: {
      canvasContext: CanvasRenderingContext2D;
      viewport: { width: number; height: number };
      transform?: number[];
    }) => { promise: Promise<void> };
  }>;
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
const CORES = ["#ef4444", "#f59e0b", "#22c55e", "#38bdf8", "#8b5cf6", "#f8fafc"];

export default function PdfAnotavel({
  arquivo,
  pausado,
}: {
  arquivo: File;
  pausado: boolean;
}) {
  const canvasPdfRef = useRef<HTMLCanvasElement | null>(null);
  const canvasAnotacaoRef = useRef<HTMLCanvasElement | null>(null);
  const areaRef = useRef<HTMLDivElement | null>(null);
  const desenhoRef = useRef<Traco | null>(null);
  const tamanhoRef = useRef({ width: 1, height: 1 });

  const [pdf, setPdf] = useState<PdfJsDocument | null>(null);
  const [pagina, setPagina] = useState(1);
  const [paginas, setPaginas] = useState(1);
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
        setPagina(1);
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

  const redesenharAnotacoes = useCallback(() => {
    const canvas = canvasAnotacaoRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = tamanhoRef.current;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const traco of anotacoes[pagina] ?? []) {
      if (traco.pontos.length < 2) continue;
      ctx.save();
      ctx.globalAlpha = traco.ferramenta === "marca-texto" ? 0.28 : 1;
      ctx.strokeStyle = traco.cor;
      ctx.lineWidth =
        traco.espessura * (traco.ferramenta === "marca-texto" ? 5 : 1);
      ctx.beginPath();

      traco.pontos.forEach((ponto, indice) => {
        const x = ponto.x * width;
        const y = ponto.y * height;
        if (indice === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });

      ctx.stroke();
      ctx.restore();
    }
  }, [anotacoes, pagina]);

  useEffect(() => {
    let cancelado = false;

    async function renderizar() {
      if (!pdf || !canvasPdfRef.current || !canvasAnotacaoRef.current) return;

      const paginaPdf = await pdf.getPage(pagina);
      if (cancelado) return;

      const viewportBase = paginaPdf.getViewport({ scale: 1 });
      const larguraArea = Math.max(
        280,
        (areaRef.current?.clientWidth ?? viewportBase.width) - 28
      );
      const escalaAjuste = larguraArea / viewportBase.width;
      const escala = Math.max(0.35, Math.min(3, escalaAjuste * zoom));
      const viewport = paginaPdf.getViewport({ scale: escala });
      const dpr = window.devicePixelRatio || 1;

      const pdfCanvas = canvasPdfRef.current;
      const anotacaoCanvas = canvasAnotacaoRef.current;

      pdfCanvas.width = Math.ceil(viewport.width * dpr);
      pdfCanvas.height = Math.ceil(viewport.height * dpr);
      pdfCanvas.style.width = String(viewport.width) + "px";
      pdfCanvas.style.height = String(viewport.height) + "px";

      anotacaoCanvas.width = Math.ceil(viewport.width * dpr);
      anotacaoCanvas.height = Math.ceil(viewport.height * dpr);
      anotacaoCanvas.style.width = String(viewport.width) + "px";
      anotacaoCanvas.style.height = String(viewport.height) + "px";

      tamanhoRef.current = { width: viewport.width, height: viewport.height };

      const ctx = pdfCanvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);

      await paginaPdf.render({
        canvasContext: ctx,
        viewport,
        transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
      }).promise;

      if (!cancelado) redesenharAnotacoes();
    }

    void renderizar();
    return () => {
      cancelado = true;
    };
  }, [pagina, pdf, redesenharAnotacoes, zoom]);

  useEffect(() => {
    redesenharAnotacoes();
  }, [redesenharAnotacoes]);

  function salvarSnapshot() {
    setHistorico((itens) => [...itens.slice(-29), structuredClone(anotacoes)]);
  }

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
    salvarSnapshot();
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
    setAnotacoes((anteriores) => {
      const lista = (anteriores[pagina] ?? []).filter(
        (item) => item.id !== atual.id
      );
      return {
        ...anteriores,
        [pagina]: [...lista, structuredClone(atual)],
      };
    });
  }

  function aoSoltar() {
    desenhoRef.current = null;
  }

  function apagarPerto(ponto: Ponto) {
    const limite = 0.025;
    setAnotacoes((atuais) => ({
      ...atuais,
      [pagina]: (atuais[pagina] ?? []).filter(
        (traco) =>
          !traco.pontos.some(
            (item) =>
              Math.hypot(item.x - ponto.x, item.y - ponto.y) <= limite
          )
      ),
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
        <div className="grupo pagina">
          <button
            type="button"
            disabled={pagina <= 1}
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
            aria-label="Página anterior"
          >
            <ChevronLeft size={17} />
          </button>
          <strong>
            {pagina} <span>de {paginas}</span>
          </strong>
          <button
            type="button"
            disabled={pagina >= paginas}
            onClick={() => setPagina((p) => Math.min(paginas, p + 1))}
            aria-label="Próxima página"
          >
            <ChevronRight size={17} />
          </button>
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
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
            aria-label="Afastar"
          >
            <Minus size={17} />
          </button>
          <strong>{Math.round(zoom * 100)}%</strong>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.1))}
            aria-label="Aproximar"
          >
            <Plus size={17} />
          </button>
          <button type="button" onClick={() => setZoom(1)} title="Ajustar à largura">
            <RotateCcw size={17} />
            <span>Ajustar</span>
          </button>
        </div>
      </div>

      <div className="pdf-area" ref={areaRef}>
        {carregando && <div className="pdf-carregando">Abrindo PDF…</div>}
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
      </div>
    </div>
  );
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
