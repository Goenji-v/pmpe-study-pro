import { API_BASE_URL } from "../config/api";
import type {
  CursoImportado,
  CursoMateria,
} from "../types/cursos";
import { slugCurso } from "../utils/importacaoCurso";
import { fetchApiAutenticada } from "./apiAutenticada";

type AnaliseCursoMidia = {
  nomeCurso: string;
  materias: Array<{
    nome: string;
    categoria: "disciplina" | "complementar" | "pendente";
    modulos: Array<{
      nome: string;
      aulas: Array<{
        nome: string;
        url?: string;
      }>;
    }>;
  }>;
  avisos: string[];
};

type RespostaCursoMidia = {
  sucesso?: boolean;
  analise?: AnaliseCursoMidia;
  erro?: string;
};

type ArquivoPreparado = {
  nome: string;
  mimeType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
  base64: string;
  bytes: number;
};

const LIMITE_ARQUIVOS = 12;
const LIMITE_TOTAL = 25 * 1024 * 1024;
const LIMITE_ARQUIVO = 12 * 1024 * 1024;
const MAX_LADO_IMAGEM = 2000;

export async function analisarMidiasDoCurso(
  arquivos: File[],
  nomeInformado?: string
): Promise<CursoImportado> {
  if (arquivos.length < 1) {
    throw new Error("Selecione prints, fotos ou um PDF da grade do curso.");
  }

  if (arquivos.length > LIMITE_ARQUIVOS) {
    throw new Error(`Envie no máximo ${LIMITE_ARQUIVOS} arquivos por vez.`);
  }

  const preparados: ArquivoPreparado[] = [];
  let totalBytes = 0;

  for (const arquivo of arquivos) {
    const preparado = await prepararArquivo(arquivo);
    totalBytes += preparado.bytes;

    if (totalBytes > LIMITE_TOTAL) {
      throw new Error(
        "As imagens/PDFs juntos ultrapassaram 25 MB. Envie em menos arquivos ou use prints menores."
      );
    }

    preparados.push(preparado);
  }

  const resposta = await fetchApiAutenticada(
    `${API_BASE_URL}/api/analisar-curso-midia`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nomeCurso: nomeInformado?.trim() || "",
        arquivos: preparados.map(({ bytes: _bytes, ...arquivo }) => arquivo),
      }),
    }
  );

  let corpo: RespostaCursoMidia;
  try {
    corpo = await resposta.json() as RespostaCursoMidia;
  } catch {
    throw new Error(
      "A API retornou uma resposta inválida ao ler a grade do curso."
    );
  }

  if (!resposta.ok || !corpo.sucesso || !corpo.analise) {
    throw new Error(
      corpo.erro || "Não foi possível organizar a grade do curso agora."
    );
  }

  return converterAnaliseParaCurso(corpo.analise, preparados.length);
}

export function converterAnaliseParaCurso(
  analise: AnaliseCursoMidia,
  quantidadeFontes = 1
): CursoImportado {
  const agora = new Date().toISOString();
  const nome = analise.nomeCurso.trim() || "Curso importado";
  const idCurso =
    `curso-${slugCurso(nome)}-${agora.replace(/\D/g, "").slice(0, 14)}`;

  const materias: CursoMateria[] = analise.materias.map(
    (materia, indiceMateria) => {
      const idMateria =
        `${idCurso}-materia-${indiceMateria + 1}-${slugCurso(materia.nome)}`;

      return {
        id: idMateria,
        nome: materia.nome,
        ordem: indiceMateria + 1,
        categoria: materia.categoria,
        classificacaoManual: false,
        modulos: materia.modulos.map((modulo, indiceModulo) => {
          const idModulo =
            `${idMateria}-modulo-${indiceModulo + 1}-${slugCurso(modulo.nome)}`;

          return {
            id: idModulo,
            nome: modulo.nome || "Geral",
            ordem: indiceModulo + 1,
            aulas: modulo.aulas.map((aula, indiceAula) => ({
              id:
                `${idModulo}-aula-${indiceAula + 1}-${slugCurso(aula.nome).slice(0, 50)}`,
              nome: aula.nome,
              ordem: indiceAula + 1,
              ...(aula.url ? { url: aula.url } : {}),
            })),
          };
        }),
      };
    }
  );

  return {
    id: idCurso,
    nome,
    origem: "midia-ia",
    criadoEm: agora,
    atualizadoEm: agora,
    materias,
    relatorioCaptura: {
      origensEncontradas: quantidadeFontes,
      origensLidas: quantidadeFontes,
      pendencias: [],
      avisos: analise.avisos,
      cancelada: false,
    },
  };
}

async function prepararArquivo(arquivo: File): Promise<ArquivoPreparado> {
  if (arquivo.type === "application/pdf" || arquivo.name.toLowerCase().endsWith(".pdf")) {
    if (arquivo.size <= 0 || arquivo.size > LIMITE_ARQUIVO) {
      throw new Error(`${arquivo.name}: o PDF deve ter no máximo 12 MB.`);
    }

    const cabecalho = new TextDecoder("ascii").decode(
      await arquivo.slice(0, 5).arrayBuffer()
    );
    if (cabecalho !== "%PDF-") {
      throw new Error(`${arquivo.name}: o arquivo não é um PDF válido.`);
    }

    return {
      nome: arquivo.name || "curso.pdf",
      mimeType: "application/pdf",
      base64: await arquivoParaBase64(arquivo),
      bytes: arquivo.size,
    };
  }

  if (!arquivo.type.startsWith("image/")) {
    throw new Error(
      `${arquivo.name}: use uma imagem ou PDF da grade do curso.`
    );
  }

  const normalizada = await normalizarImagem(arquivo);

  if (normalizada.size > LIMITE_ARQUIVO) {
    throw new Error(
      `${arquivo.name}: a imagem ficou acima de 12 MB mesmo após otimização.`
    );
  }

  return {
    nome: trocarExtensao(arquivo.name || "captura", "jpg"),
    mimeType: "image/jpeg",
    base64: await arquivoParaBase64(normalizada),
    bytes: normalizada.size,
  };
}

async function normalizarImagem(arquivo: File): Promise<Blob> {
  const url = URL.createObjectURL(arquivo);

  try {
    const imagem = await carregarImagem(url);
    const escala = Math.min(
      1,
      MAX_LADO_IMAGEM / Math.max(imagem.naturalWidth, imagem.naturalHeight)
    );
    const largura = Math.max(1, Math.round(imagem.naturalWidth * escala));
    const altura = Math.max(1, Math.round(imagem.naturalHeight * escala));
    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const contexto = canvas.getContext("2d");

    if (!contexto) {
      throw new Error("O navegador não conseguiu preparar a imagem.");
    }

    contexto.fillStyle = "#ffffff";
    contexto.fillRect(0, 0, largura, altura);
    contexto.drawImage(imagem, 0, 0, largura, altura);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error("Não foi possível otimizar a imagem.")),
        "image/jpeg",
        0.9
      );
    });
  } catch {
    throw new Error(
      `${arquivo.name}: o navegador não conseguiu ler esta imagem. Faça um print da tela e envie o print.`
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

function carregarImagem(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const imagem = new Image();
    imagem.onload = () => resolve(imagem);
    imagem.onerror = () => reject(new Error("Imagem inválida."));
    imagem.src = url;
  });
}

function arquivoParaBase64(arquivo: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();

    leitor.onerror = () =>
      reject(new Error("Não foi possível ler um dos arquivos selecionados."));

    leitor.onload = () => {
      const resultado = String(leitor.result || "");
      const base64 = resultado.split(",")[1];

      if (!base64) {
        reject(new Error("Um dos arquivos não pôde ser preparado para análise."));
        return;
      }

      resolve(base64);
    };

    leitor.readAsDataURL(arquivo);
  });
}

function trocarExtensao(nome: string, extensao: string) {
  return nome.replace(/\.[^.]+$/, "") + `.${extensao}`;
}
