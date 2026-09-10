import { fetchApiAutenticada } from "./apiAutenticada";
import type { QuestaoOficial } from "./simuladosOficiaisService";

const URL_API = import.meta.env.VITE_API_URL || "";

export type AnaliseProvaOficial = {
  totalDetectadas: number;
  totalComGabarito: number;
  anuladasDetectadas: number;
  foraDoEdital: number;
  alertas: string[];
  questoes: QuestaoOficial[];
};

export async function analisarProvaOficialComContexto(
  prova: File,
  gabarito: File,
  contexto: { concurso: string; edital: string; banca: string }
): Promise<AnaliseProvaOficial> {
  const [provaBase64, gabaritoBase64] = await Promise.all([
    arquivoParaBase64(prova),
    arquivoParaBase64(gabarito),
  ]);

  const resposta = await fetchApiAutenticada(`${URL_API}/api/analisar-prova`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prova: { nome: prova.name, base64: provaBase64 },
      gabarito: { nome: gabarito.name, base64: gabaritoBase64 },
      metadados: {
        concursoAlvo: contexto.concurso,
        editalAlvo: contexto.edital,
        concursoOrigem: contexto.concurso,
        cargoOrigem: "",
        anoOrigem: Number(contexto.edital.match(/20\d{2}/)?.[0] || new Date().getFullYear()),
        banca: contexto.banca,
      },
      mapaEdital: [],
    }),
  });

  let dados: Record<string, unknown>;
  try {
    dados = await resposta.json() as Record<string, unknown>;
  } catch {
    throw new Error("A API de análise retornou uma resposta inválida.");
  }

  if (!resposta.ok || dados.sucesso !== true || !dados.analise) {
    throw new Error(typeof dados.erro === "string" ? dados.erro : "Não foi possível analisar a prova oficial.");
  }

  const analise = dados.analise as Record<string, unknown>;
  return {
    totalDetectadas: Number(analise.totalDetectadas) || 0,
    totalComGabarito: Number(analise.totalComGabarito) || 0,
    anuladasDetectadas: Number(analise.anuladasDetectadas) || 0,
    foraDoEdital: Number(analise.foraDoEdital) || 0,
    alertas: Array.isArray(analise.alertas) ? analise.alertas.map(String) : [],
    questoes: Array.isArray(analise.questoes) ? analise.questoes.map((item, index) => normalizarQuestao(item, index)) : [],
  };
}

function normalizarQuestao(valor: unknown, indice: number): QuestaoOficial {
  const item = valor && typeof valor === "object" ? valor as Record<string, unknown> : {};
  const alternativasBrutas = Array.isArray(item.alternativas) ? item.alternativas : [];
  const alternativas = alternativasBrutas.map((alternativa, alternativaIndex) => {
    if (typeof alternativa === "string") return { id: String.fromCharCode(65 + alternativaIndex), texto: alternativa };
    const objeto = alternativa && typeof alternativa === "object" ? alternativa as Record<string, unknown> : {};
    return {
      id: String(objeto.id || String.fromCharCode(65 + alternativaIndex)).toUpperCase().charAt(0),
      texto: String(objeto.texto || ""),
    };
  });

  const dificuldade = String(item.dificuldade || "media").toLowerCase();
  const status = String(item.statusSugerido || "pendente").toLowerCase();
  const resposta = String(item.respostaCorretaId || "").toUpperCase().charAt(0);
  const statusSugerido: QuestaoOficial["statusSugerido"] =
    status === "anulada" || status === "desatualizada" || status === "duvidosa" ? status : "pendente";

  return {
    id: crypto.randomUUID(),
    numero: Number(item.numeroOriginal) || indice + 1,
    numeroOriginal: Number(item.numeroOriginal) || indice + 1,
    materia: String(item.materia || "Não classificada"),
    materiaId: String(item.materiaId || "") || undefined,
    modulo: String(item.modulo || "") || undefined,
    moduloId: String(item.moduloId || "") || undefined,
    assunto: String(item.assunto || "Não classificado"),
    assuntoId: String(item.assuntoId || "") || undefined,
    subassunto: String(item.subassunto || "") || undefined,
    dificuldade: dificuldade === "facil" || dificuldade === "dificil" ? dificuldade : "media",
    enunciado: String(item.enunciado || ""),
    alternativas,
    respostaCorretaId: resposta,
    explicacao: String(item.explicacao || "") || undefined,
    statusSugerido,
  };
}

function arquivoParaBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const valor = String(reader.result || "");
      const separador = valor.indexOf(",");
      resolve(separador >= 0 ? valor.slice(separador + 1) : valor);
    };
    reader.onerror = () => reject(new Error(`Não foi possível ler ${file.name}.`));
    reader.readAsDataURL(file);
  });
}
