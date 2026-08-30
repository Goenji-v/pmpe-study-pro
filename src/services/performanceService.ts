import { supabase } from "../lib/supabase";
import { obterVersaoApp } from "../utils/monitoramentoErro";
import {
  classificarMetrica,
  type ClassificacaoPerformance,
  type NomeMetricaPerformance,
} from "../utils/performanceMetrics";

export type RegistroPerformance = {
  id: string;
  user_id: string;
  session_id: string;
  metrica: NomeMetricaPerformance;
  valor: number;
  classificacao: ClassificacaoPerformance;
  rota: string;
  viewport: string | null;
  dispositivo: "mobile" | "tablet" | "desktop";
  user_agent: string | null;
  app_version: string | null;
  created_at: string;
  updated_at: string;
};

const CHAVE_SESSAO = "studypro:performance:session";

function obterSessaoPerformance() {
  if (typeof window === "undefined") return "server";
  const atual = window.sessionStorage.getItem(CHAVE_SESSAO);
  if (atual) return atual;

  const novo = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `perf-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.sessionStorage.setItem(CHAVE_SESSAO, novo);
  return novo;
}

function obterDispositivo(): RegistroPerformance["dispositivo"] {
  if (typeof window === "undefined") return "desktop";
  if (window.innerWidth < 768) return "mobile";
  if (window.innerWidth < 1024) return "tablet";
  return "desktop";
}

export async function registrarMetricaPerformance(
  metrica: NomeMetricaPerformance,
  valor: number,
  rota: string
) {
  if (!Number.isFinite(valor) || valor < 0 || typeof window === "undefined") return;

  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return;

    await supabase.from("metricas_performance").upsert(
      {
        user_id: userId,
        session_id: obterSessaoPerformance(),
        metrica,
        valor,
        classificacao: classificarMetrica(metrica, valor),
        rota: rota.slice(0, 500),
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        dispositivo: obterDispositivo(),
        user_agent: navigator.userAgent.slice(0, 1000),
        app_version: obterVersaoApp(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,session_id,rota,metrica" }
    );
  } catch {
    // Telemetria nunca deve interromper o uso do Study Pro.
  }
}

export async function listarMetricasPerformance(dias = 30, limite = 2000) {
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("metricas_performance")
    .select("*")
    .gte("created_at", desde)
    .order("created_at", { ascending: false })
    .limit(limite);

  if (error) throw error;
  return (data ?? []) as RegistroPerformance[];
}
