import { useEffect, useMemo } from "react";

import "./PersonalizacaoBridge.css";

import { useApp } from "../../context/AppContext";
import { obterEstadoEconomia } from "../../services/economiaGamificacao";
import { encontrarItemLoja } from "../../services/lojaGamificacao";

export default function PersonalizacaoBridge() {
  const { configuracoes } = useApp();
  const economia = useMemo(() => obterEstadoEconomia(configuracoes), [configuracoes]);
  const tema = encontrarItemLoja(economia.temaEquipado);

  useEffect(() => {
    const raiz = document.documentElement;
    const valor = tema?.tipo === "tema" ? tema.valorVisual : "padrao";
    raiz.dataset.studyTheme = valor;

    return () => {
      delete raiz.dataset.studyTheme;
    };
  }, [tema?.tipo, tema?.valorVisual]);

  return null;
}
