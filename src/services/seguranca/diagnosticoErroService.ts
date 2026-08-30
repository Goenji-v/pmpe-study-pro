import { supabase } from "../../lib/supabase";
import {
  criarFingerprintErro,
  obterVersaoApp,
} from "../../utils/monitoramentoErro";

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
  fingerprint: string;
};

const CHAVE_ERROS = "pmpe:seguranca:erros-runtime";
const LIMITE_ERROS = 20;
const JANELA_DEDUPLICACAO_MS = 60_000;
const ultimosEnvios = new Map<string, number>();
const enviosEmAndamento = new Set<string>();

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
    ? sanitizarTexto(erro.stack).slice(0, 6000)
    : undefined;
}

function sanitizarTexto(valor: string) {
  return valor
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, "[token]");
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

function deveEnviar(fingerprint: string) {
  const agora = Date.now();
  const ultimo = ultimosEnvios.get(fingerprint) ?? 0;

  if (agora - ultimo < JANELA_DEDUPLICACAO_MS) return false;
  ultimosEnvios.set(fingerprint, agora);
  return true;
}

async function enviarErroRemoto(registro: RegistroErroRuntime) {
  if (typeof window === "undefined") return;
  if (enviosEmAndamento.has(registro.fingerprint)) return;
  if (!deveEnviar(registro.fingerprint)) return;

  try {
    enviosEmAndamento.add(registro.fingerprint);
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
      user_agent:
        typeof navigator !== "undefined"
          ? navigator.userAgent.slice(0, 1000)
          : null,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      app_version: obterVersaoApp(),
      fingerprint: registro.fingerprint,
      status: "aberto",
    });
  } catch {
    // O diagnóstico remoto nunca pode gerar uma nova falha na aplicação.
  } finally {
    enviosEmAndamento.delete(registro.fingerprint);
  }
}

export function registrarErroRuntime(
  erro: unknown,
  origem: OrigemErroRuntime
): RegistroErroRuntime {
  const rota =
    typeof window !== "undefined"
      ? window.location.pathname
      : "desconhecida";
  const mensagem = sanitizarTexto(mensagemDoErro(erro)).slice(0, 2000);

  const registro: RegistroErroRuntime = {
    id: `erro-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    criadoEm: new Date().toISOString(),
    origem,
    mensagem,
    stack: stackDoErro(erro),
    rota,
    fingerprint: criarFingerprintErro(mensagem, rota),
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
