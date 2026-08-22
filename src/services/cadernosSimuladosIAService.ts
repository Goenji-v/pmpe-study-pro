import { supabase } from "../lib/supabase";
import type {
  QuestaoIA,
  TipoSessaoQuestoesIA,
} from "../types/index";
import { inferirTipoSessaoQuestoesIA } from "../utils/resultadoQuestoesIA";
import { assinaturaCadernoIA } from "./catalogoQuestoesIAUtils";

export type CadernoSimuladoIA = {
  id: string;
  nome: string;
  materia: string;
  modulo?: string;
  assunto: string;
  banca: string;
  dificuldade: string;
  questoes: QuestaoIA[];
  criadoEm: string;
  atualizadoEm: string;
  estatisticas?: EstatisticasCadernoIA;
  tipo?: TipoSessaoQuestoesIA;
};

export type EstatisticasCadernoIA = {
  tentativas: number;
  acertos: number;
  erros: number;
  emBranco: number;
  aproveitamento: number;
  ultimaTentativaEm: string;
};

type RegistroBanco = {
  id: string;
  dados: CadernoSimuladoIA;
  created_at: string;
  updated_at: string;
};

const CHAVE_LOCAL = "pmpe_cadernos_simulados_ia";
const CHAVE_QUESTOES_ATIVAS = "pmpe_questoes_ia";
const CHAVE_TIPO_SESSAO_ATIVA = "pmpe:sessao-questoes-ia:tipo";

export async function listarCadernosSimuladosIA(): Promise<CadernoSimuladoIA[]> {
  const locais = carregarLocais();

  const { data, error } = await supabase
    .from("cadernos_simulados_ia")
    .select("id,dados,created_at,updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar cadernos IA:", error);
    return ordenar(locais);
  }

  const remotos = ((data ?? []) as RegistroBanco[]).map((registro) => ({
    ...registro.dados,
    id: registro.id,
    criadoEm: registro.dados.criadoEm || registro.created_at,
    atualizadoEm: registro.dados.atualizadoEm || registro.updated_at,
  }));

  const mapa = new Map<string, CadernoSimuladoIA>();
  locais.forEach((item) => mapa.set(item.id, item));
  remotos.forEach((item) => mapa.set(item.id, item));

  const unidos = ordenar(Array.from(mapa.values()));
  salvarLocais(unidos);
  return unidos;
}

export async function salvarCadernoSimuladoIA(
  caderno: CadernoSimuladoIA
): Promise<CadernoSimuladoIA> {
  salvarLocal(caderno);

  const {
    data: { user },
    error: erroUsuario,
  } = await supabase.auth.getUser();

  if (erroUsuario || !user) {
    if (erroUsuario) {
      console.error("Erro ao identificar usuário do caderno IA:", erroUsuario);
    }
    return caderno;
  }

  const { error } = await supabase
    .from("cadernos_simulados_ia")
    .upsert(
      {
        id: caderno.id,
        user_id: user.id,
        dados: caderno,
        updated_at: caderno.atualizadoEm,
      },
      { onConflict: "id" }
    );

  if (error) {
    console.error("Erro ao salvar caderno IA:", error);
  }

  return caderno;
}

export async function excluirCadernoSimuladoIA(id: string): Promise<void> {
  salvarLocais(carregarLocais().filter((item) => item.id !== id));

  const { error } = await supabase
    .from("cadernos_simulados_ia")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error("Não foi possível excluir o caderno agora.");
  }
}

export async function registrarQuestoesAtuaisComoCaderno(
  tipo?: TipoSessaoQuestoesIA
): Promise<CadernoSimuladoIA | null> {
  const questoes = carregarQuestoesAtuais();
  if (questoes.length === 0) return null;

  const assinaturaAtual = assinatura(questoes);
  const existentes = await listarCadernosSimuladosIA();
  const jaExiste = existentes.find(
    (caderno) => assinatura(caderno.questoes) === assinaturaAtual
  );

  if (jaExiste) {
    if (tipo && jaExiste.tipo !== tipo) {
      const atualizado = {
        ...jaExiste,
        tipo,
        atualizadoEm: new Date().toISOString(),
      };
      await salvarCadernoSimuladoIA(atualizado);
      return atualizado;
    }

    return jaExiste;
  }

  const agora = new Date().toISOString();
  const primeira = questoes[0];
  const assuntos = Array.from(
    new Set(questoes.map((item) => item.assunto).filter(Boolean))
  );

  const assunto =
    assuntos.length === 1
      ? assuntos[0]
      : assuntos.length > 1
        ? `${assuntos[0]} + ${assuntos.length - 1}`
        : "Assuntos diversos";

  const caderno: CadernoSimuladoIA = {
    id: crypto.randomUUID(),
    nome: `${primeira?.materia || "Simulado IA"} — ${assunto}`,
    materia: primeira?.materia || "Misto",
    modulo: primeira?.modulo,
    assunto,
    banca: primeira?.banca || "Não informada",
    dificuldade: obterDificuldade(questoes),
    questoes,
    criadoEm: agora,
    atualizadoEm: agora,
    tipo: tipo ?? inferirTipoSessaoQuestoesIA(questoes),
  };

  await salvarCadernoSimuladoIA(caderno);
  return caderno;
}

export function ativarCadernoSimuladoIA(caderno: CadernoSimuladoIA) {
  localStorage.setItem(
    CHAVE_QUESTOES_ATIVAS,
    JSON.stringify(caderno.questoes)
  );
  sessionStorage.setItem("pmpe:caderno-simulado-ia:ativo", caderno.id);
  definirTipoSessaoQuestoesIAAtiva(
    caderno.tipo ?? inferirTipoSessaoQuestoesIA(caderno.questoes)
  );
}

export function obterCadernoSimuladoIAAtivoId() {
  return sessionStorage.getItem("pmpe:caderno-simulado-ia:ativo");
}

export function limparCadernoSimuladoIAAtivo() {
  sessionStorage.removeItem("pmpe:caderno-simulado-ia:ativo");
}

export function definirTipoSessaoQuestoesIAAtiva(
  tipo: TipoSessaoQuestoesIA
) {
  sessionStorage.setItem(CHAVE_TIPO_SESSAO_ATIVA, tipo);
}

export function obterTipoSessaoQuestoesIAAtiva(
  questoes: QuestaoIA[] = []
): TipoSessaoQuestoesIA {
  const tipo = sessionStorage.getItem(CHAVE_TIPO_SESSAO_ATIVA);
  return tipo === "questoes" || tipo === "simulado"
    ? tipo
    : inferirTipoSessaoQuestoesIA(questoes);
}

export async function registrarResultadoCadernoSimuladoIA(
  cadernoId: string,
  resultado: Omit<EstatisticasCadernoIA, "tentativas">
): Promise<void> {
  const caderno = (await listarCadernosSimuladosIA()).find(
    (item) => item.id === cadernoId
  );

  if (!caderno) return;

  await salvarCadernoSimuladoIA({
    ...caderno,
    atualizadoEm: new Date().toISOString(),
    estatisticas: {
      tentativas: (caderno.estatisticas?.tentativas ?? 0) + 1,
      ...resultado,
    },
  });
}

function carregarQuestoesAtuais(): QuestaoIA[] {
  const salvo = localStorage.getItem(CHAVE_QUESTOES_ATIVAS);
  if (!salvo) return [];

  try {
    const valor: unknown = JSON.parse(salvo);
    return Array.isArray(valor) ? (valor as QuestaoIA[]) : [];
  } catch {
    return [];
  }
}

function carregarLocais(): CadernoSimuladoIA[] {
  const salvo = localStorage.getItem(CHAVE_LOCAL);
  if (!salvo) return [];

  try {
    const valor: unknown = JSON.parse(salvo);
    return Array.isArray(valor) ? (valor as CadernoSimuladoIA[]) : [];
  } catch {
    return [];
  }
}

function salvarLocal(caderno: CadernoSimuladoIA) {
  const mapa = new Map(carregarLocais().map((item) => [item.id, item]));
  mapa.set(caderno.id, caderno);
  salvarLocais(Array.from(mapa.values()));
}

function salvarLocais(cadernos: CadernoSimuladoIA[]) {
  localStorage.setItem(CHAVE_LOCAL, JSON.stringify(ordenar(cadernos)));
}

function ordenar(cadernos: CadernoSimuladoIA[]) {
  return [...cadernos].sort(
    (a, b) =>
      new Date(b.atualizadoEm || b.criadoEm).getTime() -
      new Date(a.atualizadoEm || a.criadoEm).getTime()
  );
}

function assinatura(questoes: QuestaoIA[]) {
  return assinaturaCadernoIA(questoes);
}

function obterDificuldade(questoes: QuestaoIA[]) {
  const dificuldades = Array.from(
    new Set(questoes.map((item) => item.dificuldade).filter(Boolean))
  );
  return dificuldades.length === 1 ? dificuldades[0] : "Mista";
}
