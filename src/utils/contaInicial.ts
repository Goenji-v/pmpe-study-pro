import type { ConfiguracoesApp } from "../types/index";

/** Preferências não criam conteúdo, plano, histórico ou progresso. */
export function criarConfiguracoesIniciais(nome = ""): ConfiguracoesApp {
  return {
    nomeUsuario: nome.trim(),
    concurso: "",
    bancaPadrao: "",
    metaQuestoesDiaria: 30,
    metaMinutosDiaria: 120,
    metaRevisoesDiaria: 5,
    missoesPorDia: 1,
    tema: "escuro",
    planoPadraoAtivo: false,
    armazenamentoPorConta: true,
  };
}

export function criarDadosIniciaisDaConta(nome = "") {
  return {
    materias: [], questoes: [], sessoes: [], revisoes: [], simulados: [],
    bancoQuestoes: [], simuladosGerados: [], missoesConcluidas: [],
    configuracoes: criarConfiguracoesIniciais(nome),
  };
}

/** A ausência da opção preserva o plano das contas anteriores à mudança. */
export function usaPlanoPadrao(config: Pick<ConfiguracoesApp, "planoPadraoAtivo">) {
  return config.planoPadraoAtivo !== false;
}

export function houveReinicioDaConta(
  local: Pick<ConfiguracoesApp, "dadosReiniciadosEm">,
  remoto: Pick<ConfiguracoesApp, "dadosReiniciadosEm">
) {
  const dataRemota = Date.parse(remoto.dadosReiniciadosEm ?? "");
  const dataLocal = Date.parse(local.dadosReiniciadosEm ?? "");
  return Number.isFinite(dataRemota) && (!Number.isFinite(dataLocal) || dataRemota > dataLocal);
}
