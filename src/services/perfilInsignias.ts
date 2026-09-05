import type { ConfiguracoesApp } from "../types";
import type { ConquistaPermanente } from "./conquistasPermanentes";

export const LIMITE_INSIGNIAS_PERFIL = 3;

export type PerfilGamificado = {
  insigniasEquipadas?: string[];
};

export type ConfiguracoesComPerfil = ConfiguracoesApp & {
  perfil?: PerfilGamificado;
};

export function obterInsigniasConfiguradas(configuracoes: ConfiguracoesApp) {
  const perfil = (configuracoes as ConfiguracoesComPerfil).perfil;
  return Array.isArray(perfil?.insigniasEquipadas)
    ? perfil.insigniasEquipadas.filter(Boolean)
    : [];
}

export function normalizarInsigniasPerfil(
  ids: string[] | undefined,
  conquistas: ConquistaPermanente[],
  limite = LIMITE_INSIGNIAS_PERFIL
) {
  const desbloqueadas = new Set(
    conquistas.filter((item) => item.desbloqueada).map((item) => item.id)
  );

  return [...new Set((ids ?? []).filter(Boolean))]
    .filter((id) => desbloqueadas.has(id))
    .slice(0, Math.max(0, limite));
}

export function obterInsigniaDestaque(
  ids: string[] | undefined,
  conquistas: ConquistaPermanente[]
) {
  const pesos = {
    bronze: 1,
    prata: 2,
    ouro: 3,
    lendaria: 4,
  } as const;

  const equipadas = normalizarInsigniasPerfil(ids, conquistas)
    .map((id) => conquistas.find((item) => item.id === id))
    .filter((item): item is ConquistaPermanente => Boolean(item));

  return equipadas.reduce<ConquistaPermanente | undefined>((melhor, atual) => {
    if (!melhor) return atual;
    return pesos[atual.raridade] > pesos[melhor.raridade] ? atual : melhor;
  }, undefined);
}

export function alternarInsigniaPerfil(params: {
  atuais: string[] | undefined;
  insigniaId: string;
  conquistas: ConquistaPermanente[];
  limite?: number;
}) {
  const limite = params.limite ?? LIMITE_INSIGNIAS_PERFIL;
  const desbloqueada = params.conquistas.some(
    (item) => item.id === params.insigniaId && item.desbloqueada
  );

  if (!desbloqueada) {
    return {
      ids: normalizarInsigniasPerfil(params.atuais, params.conquistas, limite),
      alterou: false,
      motivo: "bloqueada" as const,
    };
  }

  const atuais = normalizarInsigniasPerfil(
    params.atuais,
    params.conquistas,
    limite
  );

  if (atuais.includes(params.insigniaId)) {
    return {
      ids: atuais.filter((id) => id !== params.insigniaId),
      alterou: true,
      motivo: "removida" as const,
    };
  }

  if (atuais.length >= limite) {
    return {
      ids: atuais,
      alterou: false,
      motivo: "limite" as const,
    };
  }

  return {
    ids: [...atuais, params.insigniaId],
    alterou: true,
    motivo: "adicionada" as const,
  };
}
