import { carregar, salvar } from "./storage";

import type {
  Materia,
  RegistroQuestao,
  SessaoEstudo,
} from "../types";

const CHAVES = {
  materias: "studyforce_materias",
  questoes: "studyforce_questoes",
  sessoes: "studyforce_sessoes",
};

export const database = {
  materias: {
    listar(): Materia[] {
      return carregar(CHAVES.materias, []);
    },

    salvar(lista: Materia[]) {
      salvar(CHAVES.materias, lista);
    },
  },

  questoes: {
    listar(): RegistroQuestao[] {
      return carregar(CHAVES.questoes, []);
    },

    salvar(lista: RegistroQuestao[]) {
      salvar(CHAVES.questoes, lista);
    },
  },

  sessoes: {
    listar(): SessaoEstudo[] {
      return carregar(CHAVES.sessoes, []);
    },

    salvar(lista: SessaoEstudo[]) {
      salvar(CHAVES.sessoes, lista);
    },
  },
};