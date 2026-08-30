import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

import { registrarMetricaPerformance } from "../../services/performanceService";
import type { NomeMetricaPerformance } from "../../utils/performanceMetrics";

type EntradaLayoutShift = PerformanceEntry & {
  value: number;
  hadRecentInput: boolean;
};

export default function PerformanceMonitor() {
  const location = useLocation();
  const rotaInicial = useRef(location.pathname);

  useEffect(() => {
    if (!import.meta.env.PROD || typeof window === "undefined" || navigator.webdriver) return;
    if (!("PerformanceObserver" in window)) return;

    const rota = rotaInicial.current;
    const observadores: PerformanceObserver[] = [];
    const timers = new Map<NomeMetricaPerformance, ReturnType<typeof setTimeout>>();
    const valores = new Map<NomeMetricaPerformance, number>();

    function enviar(metrica: NomeMetricaPerformance, valor: number) {
      valores.set(metrica, valor);
      const anterior = timers.get(metrica);
      if (anterior) clearTimeout(anterior);
      timers.set(
        metrica,
        setTimeout(() => {
          void registrarMetricaPerformance(metrica, valor, rota);
        }, 2500)
      );
    }

    function enviarPendentes() {
      valores.forEach((valor, metrica) => {
        const timer = timers.get(metrica);
        if (timer) clearTimeout(timer);
        void registrarMetricaPerformance(metrica, valor, rota);
      });
      timers.clear();
    }

    const navegacao = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (navegacao?.responseStart && navegacao.responseStart >= 0) {
      enviar("TTFB", navegacao.responseStart);
    }

    const tiposSuportados = PerformanceObserver.supportedEntryTypes ?? [];

    if (tiposSuportados.includes("largest-contentful-paint")) {
      const observer = new PerformanceObserver((lista) => {
        const entradas = lista.getEntries();
        const ultima = entradas.at(-1);
        if (ultima) enviar("LCP", ultima.startTime);
      });
      observer.observe({ type: "largest-contentful-paint", buffered: true });
      observadores.push(observer);
    }

    if (tiposSuportados.includes("layout-shift")) {
      let maximo = 0;
      let valorSessao = 0;
      let inicioSessao = 0;
      let ultimaMudanca = 0;

      const observer = new PerformanceObserver((lista) => {
        for (const entradaBase of lista.getEntries()) {
          const entrada = entradaBase as EntradaLayoutShift;
          if (entrada.hadRecentInput) continue;

          const continuaSessao =
            ultimaMudanca > 0 &&
            entrada.startTime - ultimaMudanca < 1000 &&
            entrada.startTime - inicioSessao < 5000;

          if (continuaSessao) {
            valorSessao += entrada.value;
          } else {
            valorSessao = entrada.value;
            inicioSessao = entrada.startTime;
          }

          ultimaMudanca = entrada.startTime;
          maximo = Math.max(maximo, valorSessao);
        }

        enviar("CLS", maximo);
      });
      observer.observe({ type: "layout-shift", buffered: true });
      observadores.push(observer);
    }

    if (tiposSuportados.includes("event")) {
      let piorInteracao = 0;
      const observer = new PerformanceObserver((lista) => {
        for (const entrada of lista.getEntries()) {
          piorInteracao = Math.max(piorInteracao, entrada.duration);
        }
        if (piorInteracao > 0) enviar("INP", piorInteracao);
      });
      observer.observe({
        type: "event",
        buffered: true,
        durationThreshold: 40,
      } as PerformanceObserverInit);
      observadores.push(observer);
    }

    const aoOcultar = () => {
      if (document.visibilityState === "hidden") enviarPendentes();
    };
    document.addEventListener("visibilitychange", aoOcultar);
    window.addEventListener("pagehide", enviarPendentes);

    return () => {
      observadores.forEach((observer) => observer.disconnect());
      timers.forEach((timer) => clearTimeout(timer));
      document.removeEventListener("visibilitychange", aoOcultar);
      window.removeEventListener("pagehide", enviarPendentes);
    };
  }, []);

  return null;
}
