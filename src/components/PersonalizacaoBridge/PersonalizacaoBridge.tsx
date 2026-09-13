import { useEffect, useMemo } from "react";

import "./PersonalizacaoBridge.css";
import "./ThemeVariants.css";

import { useApp } from "../../context/AppContext";
import { obterEstadoEconomia } from "../../services/economiaGamificacao";
import { CATALOGO_LOJA, encontrarItemLoja } from "../../services/lojaGamificacao";

type TemaBasico = "azul" | "escuro" | "claro";

type ConfiguracoesComTemaBasico = {
  tema: "escuro" | "claro";
  temaBasico?: TemaBasico;
};

export default function PersonalizacaoBridge() {
  const { configuracoes } = useApp();
  const economia = useMemo(() => obterEstadoEconomia(configuracoes), [configuracoes]);
  const tema = encontrarItemLoja(economia.temaEquipado, CATALOGO_LOJA);
  const moldura = encontrarItemLoja(economia.molduraEquipada, CATALOGO_LOJA);
  const configTema = configuracoes as typeof configuracoes & ConfiguracoesComTemaBasico;
  const temaBasico: TemaBasico =
    configTema.temaBasico ?? (configTema.tema === "claro" ? "claro" : "azul");

  useEffect(() => {
    const raiz = document.documentElement;
    const valorTema = tema?.tipo === "tema" ? tema.valorVisual : "padrao";
    const valorMoldura = moldura?.tipo === "moldura" ? moldura.valorVisual : "padrao";

    raiz.dataset.studyBaseTheme = temaBasico;
    raiz.dataset.studyTheme = valorTema;
    raiz.dataset.studyFrame = valorMoldura;

    return () => {
      delete raiz.dataset.studyBaseTheme;
      delete raiz.dataset.studyTheme;
      delete raiz.dataset.studyFrame;
    };
  }, [temaBasico, tema?.tipo, tema?.valorVisual, moldura?.tipo, moldura?.valorVisual]);

  return null;
}
