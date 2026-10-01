import type { GoogleGenAI } from "@google/genai";

import { parsearJsonDaIA } from "./jsonIa.ts";
import { parametrosExtracaoGemini } from "./modelosGemini.ts";
import { executarComFallbackGemini } from "./retryGemini.ts";

export type ArquivoCursoMidia = {
  nome: string;
  mimeType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
  base64: string;
};

export type AnaliseCursoMidia = {
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

export async function analisarCursoPorMidia(
  ai: GoogleGenAI,
  modelos: string[],
  arquivos: ArquivoCursoMidia[],
  nomeInformado?: string
): Promise<AnaliseCursoMidia> {
  const prompt = [
    "Você é o leitor de grades de cursos do Study Pro.",
    "Os arquivos anexados são prints, fotos ou PDFs da área de membros de um curso.",
    "Reconstrua somente a estrutura que estiver realmente visível nos arquivos.",
    "",
    "Organize em: Matéria -> Módulo -> Aula.",
    "Se uma matéria não tiver módulo explícito, use o módulo 'Geral'.",
    "Preserve a ordem em que as matérias, módulos e aulas aparecem.",
    "Não transforme menus do site, perfil, suporte, login, certificado ou rodapé em aulas.",
    "Mentoria, cronograma geral, encontros, comunidade e suporte devem usar categoria 'complementar'.",
    "Use categoria 'pendente' somente quando não for possível decidir com segurança.",
    "As demais disciplinas do curso usam categoria 'disciplina'.",
    "NÃO invente aulas que não estejam visíveis.",
    "NÃO invente URLs. Só preencha url quando um endereço http/https estiver literalmente visível no arquivo; caso contrário, omita url.",
    "Una repetições causadas por prints sobrepostos.",
    nomeInformado?.trim()
      ? `Nome informado pelo usuário: ${nomeInformado.trim().slice(0, 180)}`
      : "Se o nome do curso estiver claramente visível, use-o; caso contrário use 'Curso importado'.",
    "",
    "Retorne SOMENTE JSON válido neste formato:",
    '{"nomeCurso":"Curso PMPE","materias":[{"nome":"Português","categoria":"disciplina","modulos":[{"nome":"Módulo 01","aulas":[{"nome":"Aula 01 - Fonologia","url":"https://..."}]}]}],"avisos":["Links não estavam visíveis nas imagens."]}',
  ].join("\n");

  const contents = [
    {
      role: "user",
      parts: [
        ...arquivos.map((arquivo) => ({
          inlineData: {
            mimeType: arquivo.mimeType,
            data: arquivo.base64,
          },
        })),
        { text: prompt },
      ],
    },
  ];

  const resposta = await executarComFallbackGemini(
    async (modelo) => {
      const gerada = await ai.models.generateContent({
        model: modelo,
        contents,
        config: {
          ...parametrosExtracaoGemini(modelo),
          responseMimeType: "application/json",
          maxOutputTokens: 32768,
        },
      });

      if (!gerada.text) {
        throw new Error("A IA não retornou a estrutura do curso.");
      }

      return gerada.text;
    },
    {
      modelos,
      rotulo: "grade do curso",
      tentativasPorModelo: modelos.map(() => 2),
      trocarEmLimite: true,
    }
  );

  return normalizarAnaliseCursoMidia(
    parsearJsonDaIA(resposta, "grade do curso"),
    nomeInformado
  );
}

export function normalizarAnaliseCursoMidia(
  valor: unknown,
  nomeInformado?: string
): AnaliseCursoMidia {
  const raiz = objetoSeguro(valor);
  const nomeCurso =
    textoSeguro(nomeInformado) ||
    textoSeguro(raiz.nomeCurso) ||
    "Curso importado";
  const materiasBrutas = Array.isArray(raiz.materias)
    ? raiz.materias.slice(0, 100)
    : [];
  const materias: AnaliseCursoMidia["materias"] = [];
  const materiasVistas = new Set<string>();

  for (const valorMateria of materiasBrutas) {
    const materia = objetoSeguro(valorMateria);
    const nomeMateria = textoSeguro(materia.nome).slice(0, 180);
    if (!nomeMateria) continue;

    const categoria =
      materia.categoria === "complementar" ||
      materia.categoria === "pendente"
        ? materia.categoria
        : "disciplina";

    const modulosBrutos = Array.isArray(materia.modulos)
      ? materia.modulos.slice(0, 300)
      : [];
    const modulos: AnaliseCursoMidia["materias"][number]["modulos"] = [];
    const modulosVistos = new Set<string>();

    for (const valorModulo of modulosBrutos) {
      const modulo = objetoSeguro(valorModulo);
      const nomeModulo = textoSeguro(modulo.nome).slice(0, 160) || "Geral";
      const aulasBrutas = Array.isArray(modulo.aulas)
        ? modulo.aulas.slice(0, 1000)
        : [];
      const aulas: AnaliseCursoMidia["materias"][number]["modulos"][number]["aulas"] = [];
      const aulasVistas = new Set<string>();

      for (const valorAula of aulasBrutas) {
        const aula = objetoSeguro(valorAula);
        const nomeAula = textoSeguro(aula.nome).slice(0, 220);
        if (!nomeAula) continue;

        const url = normalizarUrl(textoSeguro(aula.url));
        const chaveAula = normalizarChave(`${nomeAula}|${url ?? ""}`);
        if (aulasVistas.has(chaveAula)) continue;
        aulasVistas.add(chaveAula);

        aulas.push({
          nome: nomeAula,
          ...(url ? { url } : {}),
        });
      }

      if (!aulas.length) continue;

      const chaveModulo = normalizarChave(nomeModulo);
      const existente = modulos.find(
        (item) => normalizarChave(item.nome) === chaveModulo
      );

      if (existente) {
        const chavesExistentes = new Set(
          existente.aulas.map((aula) =>
            normalizarChave(`${aula.nome}|${aula.url ?? ""}`)
          )
        );
        for (const aula of aulas) {
          const chave = normalizarChave(
            `${aula.nome}|${aula.url ?? ""}`
          );
          if (!chavesExistentes.has(chave)) {
            chavesExistentes.add(chave);
            existente.aulas.push(aula);
          }
        }
        continue;
      }

      if (!modulosVistos.has(chaveModulo)) {
        modulosVistos.add(chaveModulo);
        modulos.push({ nome: nomeModulo, aulas });
      }
    }

    if (!modulos.length) continue;

    const chaveMateria = normalizarChave(`${nomeMateria}|${categoria}`);
    if (materiasVistas.has(chaveMateria)) {
      const existente = materias.find(
        (item) =>
          item.categoria === categoria &&
          normalizarChave(item.nome) === normalizarChave(nomeMateria)
      );
      if (existente) {
        for (const modulo of modulos) {
          const moduloExistente = existente.modulos.find(
            (item) => normalizarChave(item.nome) === normalizarChave(modulo.nome)
          );
          if (!moduloExistente) {
            existente.modulos.push(modulo);
            continue;
          }
          const chaves = new Set(
            moduloExistente.aulas.map((aula) =>
              normalizarChave(`${aula.nome}|${aula.url ?? ""}`)
            )
          );
          for (const aula of modulo.aulas) {
            const chave = normalizarChave(
              `${aula.nome}|${aula.url ?? ""}`
            );
            if (!chaves.has(chave)) {
              chaves.add(chave);
              moduloExistente.aulas.push(aula);
            }
          }
        }
      }
      continue;
    }

    materiasVistas.add(chaveMateria);
    materias.push({
      nome: nomeMateria,
      categoria,
      modulos,
    });
  }

  if (!materias.length) {
    throw new Error(
      "Não foi possível identificar matérias e aulas nas imagens/PDF. Envie telas onde a grade do curso esteja aberta e legível."
    );
  }

  const avisos = Array.isArray(raiz.avisos)
    ? raiz.avisos
        .map(textoSeguro)
        .filter(Boolean)
        .slice(0, 20)
    : [];

  return {
    nomeCurso: nomeCurso.slice(0, 180),
    materias,
    avisos,
  };
}

function objetoSeguro(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? valor as Record<string, unknown>
    : {};
}

function textoSeguro(valor: unknown) {
  return typeof valor === "string"
    ? valor.replace(/\s+/g, " ").trim()
    : "";
}

function normalizarUrl(valor: string) {
  if (!valor) return undefined;

  try {
    const url = new URL(valor);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function normalizarChave(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
