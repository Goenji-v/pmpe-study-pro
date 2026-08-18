import { useCallback, useEffect } from "react";

import { useApp } from "../../context/AppContext";
import { listarModulosDaMateria } from "../../services/conteudos/navegarConteudos";

import type {
  Dificuldade,
  Materia,
  QuestaoBanco,
  QuestaoIA,
} from "../../types/index";

const CHAVE_BANCO_IA = "pmpe_banco_questoes_ia";
const EVENTO_QUESTOES_IA = "pmpe-questoes-ia-atualizadas";

export default function QuestaoIABridge() {
  const { materias, setBancoQuestoes } = useApp();

  const sincronizarBancoIA = useCallback(() => {
    const questoesIA = carregarBancoIA();
    if (questoesIA.length === 0) return;

    setBancoQuestoes((anteriores) => {
      const existentes = new Map(
        anteriores.map((questao) => [chaveQuestaoBanco(questao), questao])
      );

      const novas: QuestaoBanco[] = [];

      questoesIA.forEach((questao) => {
        const convertida = converterQuestaoIA(questao, materias);
        const chave = chaveQuestaoBanco(convertida);

        if (!existentes.has(chave)) {
          existentes.set(chave, convertida);
          novas.push(convertida);
        }
      });

      if (novas.length === 0) return anteriores;
      return [...novas, ...anteriores];
    });
  }, [materias, setBancoQuestoes]);

  useEffect(() => {
    sincronizarBancoIA();

    window.addEventListener(EVENTO_QUESTOES_IA, sincronizarBancoIA);
    return () => {
      window.removeEventListener(EVENTO_QUESTOES_IA, sincronizarBancoIA);
    };
  }, [sincronizarBancoIA]);

  return null;
}

function carregarBancoIA(): QuestaoIA[] {
  const salvo = localStorage.getItem(CHAVE_BANCO_IA);
  if (!salvo) return [];

  try {
    const valor: unknown = JSON.parse(salvo);
    return Array.isArray(valor) ? (valor as QuestaoIA[]) : [];
  } catch {
    return [];
  }
}

function converterQuestaoIA(
  questao: QuestaoIA,
  materias: Materia[]
): QuestaoBanco {
  const materia = materias.find(
    (item) => normalizar(item.nome) === normalizar(questao.materia)
  );

  const modulos = materia ? listarModulosDaMateria(materia) : [];
  const modulo = modulos.find(
    (item) =>
      (questao.moduloId && item.id === questao.moduloId) ||
      normalizar(item.nome) === normalizar(questao.modulo || "Geral")
  );

  const assunto = modulo?.assuntos.find(
    (item) => normalizar(item.nome) === normalizar(questao.assunto)
  );

  const materiaId = materia?.id ?? `ia-${criarId(questao.materia)}`;
  const moduloId =
    modulo?.id ??
    questao.moduloId ??
    `modulo-ia-${criarId(`${questao.materia}-${questao.modulo || "Geral"}`)}`;
  const assuntoId =
    assunto?.id ??
    `assunto-ia-${criarId(`${questao.materia}-${questao.assunto}`)}`;

  return {
    id: questao.id || crypto.randomUUID(),
    materiaId,
    materia: materia?.nome ?? questao.materia,
    moduloId,
    modulo: modulo?.nome ?? questao.modulo ?? "Geral",
    assuntoId,
    assunto: assunto?.nome ?? questao.assunto,
    banca: questao.banca,
    dificuldade: converterDificuldade(questao.dificuldade),
    enunciado: questao.enunciado,
    alternativas: Object.entries(questao.alternativas).map(([id, texto]) => ({
      id,
      texto,
    })),
    respostaCorretaId: questao.respostaCorreta,
    explicacao: questao.explicacao,
    dataCriacao: new Date().toISOString(),
  };
}

function converterDificuldade(
  dificuldade: QuestaoIA["dificuldade"]
): Dificuldade {
  if (dificuldade === "Fácil") return "facil";
  if (dificuldade === "Difícil") return "dificil";
  return "media";
}

function chaveQuestaoBanco(questao: QuestaoBanco) {
  return normalizar(
    `${questao.materia}::${questao.assunto}::${questao.enunciado}`
  );
}

function criarId(texto: string) {
  return normalizar(texto)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
