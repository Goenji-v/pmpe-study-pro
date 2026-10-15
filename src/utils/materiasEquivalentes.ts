const GRUPOS_EQUIVALENTES: string[][] = [
  ["portugues", "lingua portuguesa"],
  ["rlm", "r l m", "raciocinio logico", "raciocinio logico e matematica", "raciocinio logico matematico", "raciocinio logico-matematico", "matematica e raciocinio logico"],
  ["constitucional", "direito constitucional"],
  ["legislacao extravagante", "leis extravagantes"],
  ["informatica", "nocoes de informatica"],
  ["administrativo", "direito administrativo"],
  ["penal", "direito penal"],
  ["processual penal", "direito processual penal", "processo penal"],
];

export function normalizarNomeMateria(texto = "") {
  return texto
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\\s+/g, " ");
}

const ALIASES = new Map<string, string>();
for (const grupo of GRUPOS_EQUIVALENTES) {
  const canonica = normalizarNomeMateria(grupo[0]);
  for (const nome of grupo) ALIASES.set(normalizarNomeMateria(nome), canonica);
}

const ROTULOS: Record<string, string> = {
  portugues: "Português",
  rlm: "RLM",
  constitucional: "Direito Constitucional",
  "legislacao extravagante": "Legislação Extravagante",
  informatica: "Informática",
  administrativo: "Direito Administrativo",
  penal: "Direito Penal",
  "processual penal": "Direito Processual Penal",
};

export function chaveMateriaEquivalente(nome = "") {
  const normalizada = normalizarNomeMateria(nome);
  return ALIASES.get(normalizada) || normalizada;
}

export function rotuloMateriaEquivalente(nome = "") {
  const chave = chaveMateriaEquivalente(nome);
  return ROTULOS[chave] || nome.trim();
}
