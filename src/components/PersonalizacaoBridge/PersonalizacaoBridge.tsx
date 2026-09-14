import { useEffect, useMemo } from "react";

import "./PersonalizacaoBridge.css";
import "./ThemeVariants.css";
import "./LightTheme.css";

import { useApp } from "../../context/AppContext";
import { obterEstadoEconomia } from "../../services/economiaGamificacao";
import { CATALOGO_LOJA, encontrarItemLoja } from "../../services/lojaGamificacao";
import type { ConfiguracoesApp } from "../../types";

type TemaBasico = "azul" | "escuro" | "claro";

type ConfiguracoesComPersonalizacao = ConfiguracoesApp & {
  temaBasico?: TemaBasico;
  fundoDashboard?: {
    id: string;
    nome: string;
    url: string;
  } | null;
};

export default function PersonalizacaoBridge() {
  const { configuracoes } = useApp();
  const economia = useMemo(() => obterEstadoEconomia(configuracoes), [configuracoes]);
  const tema = encontrarItemLoja(economia.temaEquipado, CATALOGO_LOJA);
  const moldura = encontrarItemLoja(economia.molduraEquipada, CATALOGO_LOJA);
  const config = configuracoes as ConfiguracoesComPersonalizacao;
  const temaBasico: TemaBasico =
    config.temaBasico ?? (config.tema === "claro" ? "claro" : "azul");
  const fundoDashboard = config.fundoDashboard;

  useEffect(() => {
    const raiz = document.documentElement;
    const valorTema = tema?.tipo === "tema" ? tema.valorVisual : "padrao";
    const valorMoldura = moldura?.tipo === "moldura" ? moldura.valorVisual : "padrao";

    raiz.dataset.studyBaseTheme = temaBasico;
    raiz.dataset.studyTheme = valorTema;
    raiz.dataset.studyFrame = valorMoldura;

    if (fundoDashboard?.url) {
      const urlSegura = fundoDashboard.url.replace(/["\\]/g, "");
      raiz.style.setProperty("--study-dashboard-bg-image", `url("${urlSegura}")`);
      raiz.dataset.studyDashboardBackground = fundoDashboard.id;
    } else {
      raiz.style.removeProperty("--study-dashboard-bg-image");
      delete raiz.dataset.studyDashboardBackground;
    }

    return () => {
      delete raiz.dataset.studyBaseTheme;
      delete raiz.dataset.studyTheme;
      delete raiz.dataset.studyFrame;
      delete raiz.dataset.studyDashboardBackground;
      raiz.style.removeProperty("--study-dashboard-bg-image");
    };
  }, [
    temaBasico,
    tema?.tipo,
    tema?.valorVisual,
    moldura?.tipo,
    moldura?.valorVisual,
    fundoDashboard?.id,
    fundoDashboard?.url,
  ]);

  return null;
}
