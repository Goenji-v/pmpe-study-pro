import { supabase } from "../../lib/supabase";

export type OrigemErroRuntime =
  | "react-boundary"
  | "window-error"
  | "promise-rejection";

export type RegistroErroRuntime = {
  id: string;
  criadoEm: string;
  origem: OrigemErroRuntime;
  mensagem: string;
  stack?: string;
  rota: string;
};

const CHAVE_ERROS = "pmpe:seguranca:erros-runtime";
const LIMITE_ERROS = 20;
const VERSAO_APP = "beta-v1";
let enviandoRemoto = false;

function mensagemDoErro(erro: unknown) {
  if (erro instanceof Error) return erro.message;
  if (typeof erro === "string") return erro;

  try {
    return JSON.stringify(erro);
  } catch {
    return "Erro desconhecido";
  }
}

function stackDoErro(erro: unknown) {
  return erro instanceof Error && typeof erro.stack === "string"
    ? erro.stack.slice(0, 6000)
    : undefined;
}

export function listarErrosRuntime(): RegistroErroRuntime[] {
  if (typeof window === "undefined") return [];

  try {
    const bruto = window.localStorage.getItem(CHAVE_ERROS);
    if (!bruto) return [];

    const valor = JSON.parse(bruto) as unknown;
    return Array.isArray(valor)
      ? valor.filter(
          (item): item is RegistroErroRuntime =>
            Boolean(item) &&
            typeof item === "object" &&
            typeof (item as RegistroErroRuntime).id === "string" &&
            typeof (item as RegistroErroRuntime).criadoEm === "string"
        )
      : [];
  } catch {
    return [];
  }
}

async function enviarErroRemoto(registro: RegistroErroRuntime) {
  if (enviandoRemoto || typeof window === "undefined") return;

  try {
    enviandoRemoto = true;
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return;

    await supabase.from("erros_cliente").insert({
      user_id: userId,
      incident_id: registro.id,
      origem: registro.origem,
      mensagem: registro.mensagem.slice(0, 2000),
      stack: registro.stack?.slice(0, 6000) ?? null,
      rota: registro.rota.slice(0, 1000),
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 1000) : null,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      app_version: VERSAO_APP,
    });
  } catch {
    // O diagnóstico remoto nunca pode gerar uma nova falha na aplicação.
  } finally {
    enviandoRemoto = false;
  }
}

export function registrarErroRuntime(
  erro: unknown,
  origem: OrigemErroRuntime
): RegistroErroRuntime {
  const registro: RegistroErroRuntime = {
    id: `erro-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    criadoEm: new Date().toISOString(),
    origem,
    mensagem: mensagemDoErro(erro).slice(0, 2000),
    stack: stackDoErro(erro),
    rota:
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "desconhecida",
  };

  if (typeof window !== "undefined") {
    try {
      const proximos = [registro, ...listarErrosRuntime()].slice(0, LIMITE_ERROS);
      window.localStorage.setItem(CHAVE_ERROS, JSON.stringify(proximos));
    } catch {
      // Diagnóstico nunca pode interromper o funcionamento do app.
    }

    void enviarErroRemoto(registro);
  }

  return registro;
}
