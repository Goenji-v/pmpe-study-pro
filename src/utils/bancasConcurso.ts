export const BANCAS_CONCURSO = [
  "Cebraspe (Cespe)",
  "FGV",
  "FCC",
  "Vunesp",
  "Instituto AOCP",
  "IBFC",
  "IDECAN",
  "Instituto Consulplan",
  "Instituto Quadrix",
  "IADES",
  "Cesgranrio",
  "Fundatec",
  "Instituto Selecon",
  "Instituto ACCESS",
  "FEPESE",
] as const;

export type BancaConcurso = (typeof BANCAS_CONCURSO)[number];

const BANCA_NAO_INFORMADA = "Não informada";

const ALIASES_BANCAS = new Map<string, BancaConcurso>([
  ["cebraspe", "Cebraspe (Cespe)"],
  ["cespe", "Cebraspe (Cespe)"],
  ["cebraspe cespe", "Cebraspe (Cespe)"],
  ["cespe unb", "Cebraspe (Cespe)"],

  ["fgv", "FGV"],
  ["fundacao getulio vargas", "FGV"],

  ["fcc", "FCC"],
  ["fundacao carlos chagas", "FCC"],

  ["vunesp", "Vunesp"],
  ["fundacao vunesp", "Vunesp"],

  ["aocp", "Instituto AOCP"],
  ["instituto aocp", "Instituto AOCP"],

  ["ibfc", "IBFC"],
  ["instituto brasileiro de formacao e capacitacao", "IBFC"],

  ["idecan", "IDECAN"],

  ["consulplan", "Instituto Consulplan"],
  ["instituto consulplan", "Instituto Consulplan"],

  ["quadrix", "Instituto Quadrix"],
  ["instituto quadrix", "Instituto Quadrix"],

  ["iades", "IADES"],

  ["cesgranrio", "Cesgranrio"],
  ["fundacao cesgranrio", "Cesgranrio"],

  ["fundatec", "Fundatec"],

  ["selecon", "Instituto Selecon"],
  ["instituto selecon", "Instituto Selecon"],

  ["access", "Instituto ACCESS"],
  ["instituto access", "Instituto ACCESS"],

  ["fepese", "FEPESE"],
]);

export function normalizarBancaConcurso(
  valor: string | null | undefined
): BancaConcurso | typeof BANCA_NAO_INFORMADA {
  const chave = normalizarChaveBanca(valor);

  if (!chave) return BANCA_NAO_INFORMADA;

  return ALIASES_BANCAS.get(chave) ?? BANCA_NAO_INFORMADA;
}

function normalizarChaveBanca(
  valor: string | null | undefined
) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
