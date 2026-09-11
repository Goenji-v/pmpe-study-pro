import { supabase } from "../lib/supabase";
import { fetchApiAutenticada } from "./apiAutenticada";

export const BANCAS_SIMULADO_OFICIAL = [
  "Instituto AOCP",
  "Cebraspe",
  "FGV",
  "FCC",
  "Vunesp",
  "IBFC",
  "Idecan",
  "Cesgranrio",
  "Quadrix",
  "Consulplan",
  "Outra",
] as const;

export type BancaSimuladoOficial = (typeof BANCAS_SIMULADO_OFICIAL)[number] | string;

export type AlternativaOficial = {
  id: string;
  texto: string;
};

export type QuestaoOficial = {
  id: string;
  numero: number;
  numeroOriginal?: number;
  materia: string;
  materiaId?: string;
  modulo?: string;
  moduloId?: string;
  assunto: string;
  assuntoId?: string;
  subassunto?: string;
  dificuldade: "facil" | "media" | "dificil";
  enunciado: string;
  alternativas: AlternativaOficial[];
  respostaCorretaId: string;
  explicacao?: string;
  statusSugerido?: "pendente" | "anulada" | "desatualizada" | "duvidosa";
};

export type SimuladoOficial = {
  id: string;
  nome: string;
  concurso_alvo: string;
  edital_alvo: string | null;
  banca: string;
  data_prova: string | null;
  duracao_minutos: number;
  total_questoes: number;
  status: "rascunho" | "publicado" | "encerrado";
  fonte_prova_nome: string | null;
  fonte_gabarito_nome: string | null;
  prova_storage_path?: string | null;
  gabarito_storage_path?: string | null;
  criado_em: string;
  publicado_em?: string | null;
};

export type TentativaOficial = {
  id: string;
  numero_tentativa: number;
  conta_ranking: boolean;
  iniciada_em: string;
};

export type ResultadoQuestaoOficial = {
  numero: number;
  materia: string;
  assunto: string;
  respostaMarcada: string | null;
  respostaCorreta: string;
  anulada: boolean;
  correta: boolean | null;
  emBranco: boolean;
};

export type ResultadoSimuladoOficial = {
  total: number;
  certas: number;
  erradas: number;
  emBranco: number;
  anuladas: number;
  percentual: number;
  porMateria: Array<{
    materia: string;
    total: number;
    certas: number;
    erradas: number;
    emBranco: number;
    percentual: number;
  }>;
  porAssunto: Array<{
    materia: string;
    assunto: string;
    total: number;
    certas: number;
    erradas: number;
    emBranco: number;
    percentual: number;
  }>;
  questoes: ResultadoQuestaoOficial[];
};

type AnaliseProvaOficial = {
  totalDetectadas: number;
  totalComGabarito: number;
  anuladasDetectadas: number;
  foraDoEdital: number;
  alertas: string[];
  questoes: QuestaoOficial[];
};

const URL_API = import.meta.env.VITE_API_URL || "";
const BUCKET_OFICIAL = "simulados-oficiais";

export async function analisarProvaOficial(prova: File, gabarito: File): Promise<AnaliseProvaOficial> {
  validarPdf(prova, "prova");
  validarPdf(gabarito, "gabarito");

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
        concursoAlvo: "",
        editalAlvo: "",
        concursoOrigem: "",
        cargoOrigem: "",
        anoOrigem: new Date().getFullYear(),
        banca: "",
      },
      mapaEdital: [],
    }),
  });

  const dados = await lerJsonSeguro(resposta);
  if (!resposta.ok || !dados.sucesso || !dados.analise) {
    throw new Error(dados.erro || "Não foi possível analisar a prova oficial.");
  }

  const analiseBruta = dados.analise as Partial<AnaliseProvaOficial>;
  return {
    totalDetectadas: Number(analiseBruta.totalDetectadas) || 0,
    totalComGabarito: Number(analiseBruta.totalComGabarito) || 0,
    anuladasDetectadas: Number(analiseBruta.anuladasDetectadas) || 0,
    foraDoEdital: Number(analiseBruta.foraDoEdital) || 0,
    alertas: Array.isArray(analiseBruta.alertas) ? analiseBruta.alertas.map(String) : [],
    questoes: Array.isArray(analiseBruta.questoes)
      ? analiseBruta.questoes.map(normalizarQuestao)
      : [],
  };
}

export async function criarSimuladoOficial(args: {
  nome: string;
  concursoAlvo: string;
  editalAlvo?: string;
  banca: string;
  dataProva?: string;
  duracaoMinutos: number;
  prova: File;
  gabarito: File;
  questoes: QuestaoOficial[];
}): Promise<SimuladoOficial> {
  if (!args.questoes.length) throw new Error("O simulado precisa ter pelo menos uma questão.");

  const { data: simulado, error } = await supabase
    .from("simulados_oficiais")
    .insert({
      nome: args.nome.trim(),
      concurso_alvo: args.concursoAlvo.trim(),
      edital_alvo: args.editalAlvo?.trim() || null,
      banca: args.banca.trim(),
      data_prova: args.dataProva || null,
      duracao_minutos: Math.max(1, Math.min(1440, Math.round(args.duracaoMinutos))),
      total_questoes: args.questoes.length,
      status: "rascunho",
      fonte_prova_nome: args.prova.name,
      fonte_gabarito_nome: args.gabarito.name,
    })
    .select("*")
    .single();

  if (error || !simulado) throw new Error(error?.message || "Não foi possível criar o simulado.");

  const provaPath = `provas/${simulado.id}-${nomeSeguro(args.prova.name)}`;
  const gabaritoPath = `gabaritos/${simulado.id}-${nomeSeguro(args.gabarito.name)}`;

  try {
    await uploadPdf(provaPath, args.prova);
    await uploadPdf(gabaritoPath, args.gabarito);

    const questoes = args.questoes.map((questao, index) => ({
      id: crypto.randomUUID(),
      simulado_id: simulado.id,
      numero: questao.numeroOriginal ?? questao.numero ?? index + 1,
      materia: questao.materia.trim() || "Não classificada",
      materia_id: questao.materiaId || null,
      modulo: questao.modulo || null,
      modulo_id: questao.moduloId || null,
      assunto: questao.assunto.trim() || "Não classificado",
      assunto_id: questao.assuntoId || null,
      subassunto: questao.subassunto || null,
      dificuldade: questao.dificuldade,
      enunciado: questao.enunciado.trim(),
      alternativas: questao.alternativas,
      explicacao: questao.explicacao || null,
      ordem: index + 1,
    }));

    const { error: questoesError } = await supabase
      .from("simulados_oficiais_questoes")
      .insert(questoes);
    if (questoesError) throw new Error(`Erro ao salvar questões: ${questoesError.message}`);

    const gabaritos = args.questoes.map((questao, index) => ({
      simulado_id: simulado.id,
      numero: questao.numeroOriginal ?? questao.numero ?? index + 1,
      resposta: questao.respostaCorretaId || "A",
      anulada: questao.statusSugerido === "anulada" || !questao.respostaCorretaId,
    }));

    const { error: gabaritoError } = await supabase
      .from("simulados_oficiais_gabaritos")
      .insert(gabaritos);
    if (gabaritoError) throw new Error(`Erro ao salvar gabarito: ${gabaritoError.message}`);

    const { data: atualizado, error: atualizacaoError } = await supabase
      .from("simulados_oficiais")
      .update({ prova_storage_path: provaPath, gabarito_storage_path: gabaritoPath })
      .eq("id", simulado.id)
      .select("*")
      .single();
    if (atualizacaoError || !atualizado) throw new Error(atualizacaoError?.message || "Não foi possível finalizar o cadastro do simulado.");

    return atualizado as SimuladoOficial;
  } catch (error) {
    await supabase.storage.from(BUCKET_OFICIAL).remove([provaPath, gabaritoPath]);
    await supabase.from("simulados_oficiais").delete().eq("id", simulado.id);
    throw error;
  }
}

export async function publicarSimuladoOficial(id: string) {
  const { error } = await supabase
    .from("simulados_oficiais")
    .update({ status: "publicado", publicado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listarSimuladosOficiais(concurso?: string) {
  let consulta = supabase
    .from("simulados_oficiais")
    .select("*")
    .eq("status", "publicado")
    .order("data_prova", { ascending: false, nullsFirst: false });

  if (concurso?.trim()) consulta = consulta.eq("concurso_alvo", concurso.trim());

  const { data, error } = await consulta;
  if (error) throw new Error(error.message);
  return (data || []) as SimuladoOficial[];
}

export async function listarQuestoesSimuladoOficial(id: string) {
  const { data, error } = await supabase
    .from("simulados_oficiais_questoes")
    .select("*")
    .eq("simulado_id", id)
    .order("ordem");
  if (error) throw new Error(error.message);
  return (data || []) as QuestaoOficial[];
}

export async function iniciarTentativaOficial(id: string): Promise<TentativaOficial> {
  const { data, error } = await supabase.rpc("iniciar_simulado_oficial", {
    p_simulado_id: id,
  });
  if (error || !data) throw new Error(error?.message || "Não foi possível iniciar a tentativa.");
  return data as TentativaOficial;
}

export async function finalizarTentativaOficial(
  id: string,
  respostas: Record<string, string>
): Promise<ResultadoSimuladoOficial> {
  const { data, error } = await supabase.rpc("finalizar_simulado_oficial", {
    p_tentativa_id: id,
    p_respostas: respostas,
    p_minutos_gastos: null,
  });
  if (error || !data) throw new Error(error?.message || "Não foi possível corrigir o simulado.");
  return data as ResultadoSimuladoOficial;
}

export async function listarTentativasDoAluno(id: string) {
  const { data, error } = await supabase
    .from("simulados_oficiais_tentativas")
    .select("id,numero_tentativa,conta_ranking,iniciada_em,finalizada_em,finalizada,resultado")
    .eq("simulado_id", id)
    .order("numero_tentativa");
  if (error) throw new Error(error.message);
  return data || [];
}

function normalizarQuestao(valor: unknown, indice = 0): QuestaoOficial {
  const item = (valor && typeof valor === "object" ? valor : {}) as Record<string, unknown>;
  const alternativasBrutas = Array.isArray(item.alternativas) ? item.alternativas : [];
  const alternativas = alternativasBrutas.map((alternativa, alternativaIndex) => {
    if (typeof alternativa === "string") {
      return { id: String.fromCharCode(65 + alternativaIndex), texto: alternativa };
    }
    const objeto = alternativa && typeof alternativa === "object" ? alternativa as Record<string, unknown> : {};
    return {
      id: String(objeto.id || String.fromCharCode(65 + alternativaIndex)).toUpperCase().charAt(0),
      texto: String(objeto.texto || ""),
    };
  });

  const dificuldade = String(item.dificuldade || "media").toLowerCase();
  const status = String(item.statusSugerido || "pendente").toLowerCase();
  const resposta = String(item.respostaCorretaId || "").toUpperCase().charAt(0);

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
    statusSugerido: status === "anulada" || status === "desatualizada" || status === "duvidosa" ? status : "pendente",
  };
}

function validarPdf(file: File, rotulo: string) {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error(`O arquivo de ${rotulo} precisa ser PDF.`);
  }
  if (file.size > 25 * 1024 * 1024) {
    throw new Error(`O PDF de ${rotulo} ultrapassa o limite de 25 MB.`);
  }
}

function uploadPdf(path: string, file: File) {
  return supabase.storage.from(BUCKET_OFICIAL).upload(path, file, {
    contentType: "application/pdf",
    upsert: false,
  }).then(({ error }) => {
    if (error) throw new Error(`Erro ao armazenar ${file.name}: ${error.message}`);
  });
}

function nomeSeguro(nome: string) {
  const base = nome
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
  return base || "arquivo.pdf";
}

async function arquivoParaBase64(file: File): Promise<string> {
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

async function lerJsonSeguro(resposta: Response): Promise<Record<string, any>> {
  try {
    return await resposta.json() as Record<string, any>;
  } catch {
    return { sucesso: false, erro: "A API retornou uma resposta inválida." };
  }
}
