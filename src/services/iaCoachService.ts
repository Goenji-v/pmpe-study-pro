import { armazenamentoLocalDaConta as localStorage } from "./armazenamentoConta";
import { API_BASE_URL } from "../config/api";
import { fetchApiAutenticada } from "./apiAutenticada";

export type PrioridadeCoachIA =
  | "alta"
  | "media"
  | "baixa";

export type TipoAcaoCoachIA =
  | "teoria"
  | "questoes"
  | "revisao"
  | "simulado"
  | "misto";

export type AcaoCoachIA = {
  ordem: number;
  prioridade: PrioridadeCoachIA;
  titulo: string;
  motivo: string;
  duracaoMinutos: number;
  quantidadeQuestoes: number;
  tipo: TipoAcaoCoachIA;
  materia?: string;
  modulo?: string;
  assunto?: string;
};

export type DiagnosticoCoachIA = {
  resumo: string;
  alertaPrincipal: string;
  focoDoDia: string;
  tempoTotalMinutos: number;
  mensagemFinal: string;
  acoes: AcaoCoachIA[];
};

export type DiagnosticoCoachSalvo = {
  geradoEm: string;
  diagnostico: DiagnosticoCoachIA;
};

export type DadosCoachIA = {
  nomeUsuario: string;
  concurso: string;
  banca: string;
  indiceGeral: number;
  aproveitamentoGeral: number;
  minutosSemana: number;
  diasAtivosSemana: number;
  revisoesAtrasadas: number;
  revisoesPendentes: number;
  totalQuestoes: number;
  simuladosRealizados?: number;
  aproveitamentoSimulados?: number;
  materias: Array<{
    materia: string;
    percentual: number;
    certas: number;
    erradas: number;
    total: number;
    minutos: number;
    diasSemEstudar?: number;
  }>;
  assuntosCriticos: Array<{
    materia: string;
    modulo?: string;
    assunto: string;
    percentual: number;
    erros: number;
    total: number;
  }>;
  metas: {
    minutosDia: number;
    questoesDia: number;
    revisoesDia: number;
  };
};

type RespostaCoachSucesso = {
  sucesso: true;
  diagnostico: DiagnosticoCoachIA;
};

type RespostaCoachErro = {
  sucesso: false;
  erro: string;
};

const CHAVE_ULTIMO_COACH = "pmpe_ultimo_diagnostico_coach";

export async function gerarDiagnosticoCoach(
  dados: DadosCoachIA
): Promise<DiagnosticoCoachIA> {
  const resposta = await fetchApiAutenticada(
    `${API_BASE_URL}/api/coach`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dados),
    }
  );

  let corpo: RespostaCoachSucesso | RespostaCoachErro;

  try {
    corpo = await resposta.json();
  } catch {
    throw new Error("A API retornou uma resposta inválida.");
  }

  if (!resposta.ok || !corpo.sucesso) {
    throw new Error(
      "erro" in corpo
        ? corpo.erro
        : `Erro HTTP ${resposta.status}`
    );
  }

  salvarUltimoDiagnostico(corpo.diagnostico);
  return corpo.diagnostico;
}

export function carregarUltimoDiagnostico(): DiagnosticoCoachIA | null {
  return carregarUltimoDiagnosticoComMeta()?.diagnostico ?? null;
}

export function carregarUltimoDiagnosticoComMeta(): DiagnosticoCoachSalvo | null {
  const salvo = localStorage.getItem(CHAVE_ULTIMO_COACH);
  if (!salvo) return null;

  try {
    const valor = JSON.parse(salvo) as Partial<DiagnosticoCoachSalvo>;
    if (!valor.diagnostico) return null;
    return {
      geradoEm:
        typeof valor.geradoEm === "string" && valor.geradoEm
          ? valor.geradoEm
          : new Date(0).toISOString(),
      diagnostico: valor.diagnostico,
    };
  } catch {
    return null;
  }
}

export function limparUltimoDiagnostico() {
  localStorage.removeItem(CHAVE_ULTIMO_COACH);
}

function salvarUltimoDiagnostico(
  diagnostico: DiagnosticoCoachIA
) {
  const salvo: DiagnosticoCoachSalvo = {
    geradoEm: new Date().toISOString(),
    diagnostico,
  };
  localStorage.setItem(
    CHAVE_ULTIMO_COACH,
    JSON.stringify(salvo)
  );
}
