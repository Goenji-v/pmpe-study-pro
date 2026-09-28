import { supabase } from "../lib/supabase";
import { armazenamentoLocalDaConta as localStorage } from "./armazenamentoConta";
import type {
  AnaliseSimuladoStudyPro,
  HistoricoAnaliseSimulado,
} from "../utils/analiseSimuladoStudyPro";
import { resumirAnaliseParaHistorico } from "../utils/analiseSimuladoStudyPro";

export type OrigemAnaliseSimulado = "ia" | "oficial" | "pdf";

export type AnaliseSimuladoSalva = {
  id: string;
  origem: OrigemAnaliseSimulado;
  tentativaId: string;
  simuladoId: string | null;
  nome: string;
  analise: AnaliseSimuladoStudyPro;
  criadoEm: string;
  atualizadoEm: string;
};

type LinhaAnaliseSimulado = {
  id: string;
  origem: OrigemAnaliseSimulado;
  tentativa_id: string;
  simulado_id: string | null;
  nome: string;
  dados: AnaliseSimuladoStudyPro;
  criado_em: string;
  atualizado_em: string;
};

const CHAVE_BACKUP_ANALISES = "pmpe:analises-simulados:backup-v1";
const LIMITE_BACKUP_ANALISES = 6;

export function salvarAnaliseSimuladoLocal(args: {
  origem: OrigemAnaliseSimulado;
  tentativaId: string;
  simuladoId?: string;
  nome: string;
  analise: AnaliseSimuladoStudyPro;
}) {
  const agora = new Date().toISOString();
  const anteriores = listarAnalisesSimuladosLocais();
  const atual = anteriores.find(
    (item) =>
      item.origem === args.origem &&
      item.tentativaId === args.tentativaId
  );

  const registro: AnaliseSimuladoSalva = {
    id: atual?.id ?? `local:${args.origem}:${args.tentativaId}`,
    origem: args.origem,
    tentativaId: args.tentativaId,
    simuladoId: args.simuladoId ?? null,
    nome: args.nome,
    analise: args.analise,
    criadoEm: atual?.criadoEm ?? agora,
    atualizadoEm: agora,
  };

  const proximas = [
    registro,
    ...anteriores.filter(
      (item) =>
        !(
          item.origem === args.origem &&
          item.tentativaId === args.tentativaId
        )
    ),
  ].slice(0, LIMITE_BACKUP_ANALISES);

  localStorage.setItem(
    CHAVE_BACKUP_ANALISES,
    JSON.stringify(proximas)
  );

  return registro;
}

export function listarAnalisesSimuladosLocais(): AnaliseSimuladoSalva[] {
  const bruto = localStorage.getItem(CHAVE_BACKUP_ANALISES);
  if (!bruto) return [];

  try {
    const valor: unknown = JSON.parse(bruto);
    if (!Array.isArray(valor)) return [];

    return valor.flatMap((item): AnaliseSimuladoSalva[] => {
      if (!item || typeof item !== "object") return [];
      const registro = item as Partial<AnaliseSimuladoSalva>;

      if (
        (registro.origem !== "ia" &&
          registro.origem !== "oficial" &&
          registro.origem !== "pdf") ||
        typeof registro.tentativaId !== "string" ||
        typeof registro.nome !== "string" ||
        !analiseValida(registro.analise)
      ) {
        return [];
      }

      const agora = new Date().toISOString();
      return [
        {
          id:
            typeof registro.id === "string"
              ? registro.id
              : `local:${registro.origem}:${registro.tentativaId}`,
          origem: registro.origem,
          tentativaId: registro.tentativaId,
          simuladoId:
            typeof registro.simuladoId === "string"
              ? registro.simuladoId
              : null,
          nome: registro.nome,
          analise: registro.analise,
          criadoEm:
            typeof registro.criadoEm === "string"
              ? registro.criadoEm
              : agora,
          atualizadoEm:
            typeof registro.atualizadoEm === "string"
              ? registro.atualizadoEm
              : agora,
        },
      ];
    });
  } catch {
    return [];
  }
}

export async function salvarAnaliseSimulado(args: {
  origem: OrigemAnaliseSimulado;
  tentativaId: string;
  simuladoId?: string;
  nome: string;
  analise: AnaliseSimuladoStudyPro;
}) {
  // Protege o resultado imediatamente no aparelho antes de depender da rede.
  salvarAnaliseSimuladoLocal(args);
  const {
    data: { user },
    error: erroUsuario,
  } = await supabase.auth.getUser();

  if (erroUsuario || !user) {
    throw new Error("Sua sessão expirou antes de salvar a análise do simulado.");
  }

  const { error } = await supabase
    .from("analises_simulados")
    .upsert(
      {
        user_id: user.id,
        origem: args.origem,
        tentativa_id: args.tentativaId,
        simulado_id: args.simuladoId ?? null,
        nome: args.nome,
        dados: args.analise,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "user_id,origem,tentativa_id" }
    );

  if (error) {
    throw new Error(
      `Não foi possível salvar a análise do simulado: ${error.message}`
    );
  }
}

export async function listarAnalisesSimulados(
  limite = 100
): Promise<AnaliseSimuladoSalva[]> {
  const locais = listarAnalisesSimuladosLocais();

  const { data, error } = await supabase
    .from("analises_simulados")
    .select(
      "id,origem,tentativa_id,simulado_id,nome,dados,criado_em,atualizado_em"
    )
    .order("atualizado_em", { ascending: false })
    .limit(Math.max(1, Math.min(500, limite)));

  if (error) {
    if (locais.length > 0) {
      return locais.slice(0, limite);
    }

    throw new Error(
      `Não foi possível recuperar o histórico de análises: ${error.message}`
    );
  }

  const remotas = ((data ?? []) as LinhaAnaliseSimulado[]).flatMap(
    (linha): AnaliseSimuladoSalva[] => {
      if (!analiseValida(linha.dados)) return [];

      return [
        {
          id: linha.id,
          origem: linha.origem,
          tentativaId: linha.tentativa_id,
          simuladoId: linha.simulado_id,
          nome: linha.nome,
          analise: linha.dados,
          criadoEm: linha.criado_em,
          atualizadoEm: linha.atualizado_em,
        },
      ];
    }
  );

  const porTentativa = new Map<string, AnaliseSimuladoSalva>();

  [...locais, ...remotas].forEach((item) => {
    const chave = `${item.origem}:${item.tentativaId}`;
    const atual = porTentativa.get(chave);

    if (
      !atual ||
      Date.parse(item.atualizadoEm) >= Date.parse(atual.atualizadoEm)
    ) {
      porTentativa.set(chave, item);
    }
  });

  return [...porTentativa.values()]
    .sort(
      (a, b) =>
        Date.parse(b.atualizadoEm) - Date.parse(a.atualizadoEm)
    )
    .slice(0, limite);
}

export async function carregarHistoricoAnalisesSimulados(
  ignorarTentativaId?: string
): Promise<HistoricoAnaliseSimulado[]> {
  const analises = await listarAnalisesSimulados(100);

  return analises
    .filter((item) => item.tentativaId !== ignorarTentativaId)
    .map((item) => resumirAnaliseParaHistorico(item.analise));
}

function analiseValida(valor: unknown): valor is AnaliseSimuladoStudyPro {
  if (!valor || typeof valor !== "object") return false;
  const item = valor as Partial<AnaliseSimuladoStudyPro>;
  return (
    item.versao === 1 &&
    typeof item.tentativaId === "string" &&
    typeof item.data === "string" &&
    Array.isArray(item.materias) &&
    Array.isArray(item.assuntos)
  );
}
