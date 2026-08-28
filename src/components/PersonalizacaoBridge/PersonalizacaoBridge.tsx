import { useEffect, useMemo } from "react";

import "./PersonalizacaoBridge.css";

import { useApp } from "../../context/AppContext";
import { obterEstadoEconomia } from "../../services/economiaGamificacao";
import { encontrarItemLoja } from "../../services/lojaGamificacao";

export default function PersonalizacaoBridge() {
  const { configuracoes } = useApp();
  const economia = useMemo(() => obterEstadoEconomia(configuracoes), [configuracoes]);
  const tema = encontrarItemLoja(economia.temaEquipado);
  const moldura = encontrarItemLoja(economia.molduraEquipada);

  useEffect(() => {
    const raiz = document.documentElement;
    const valorTema = tema?.tipo === "tema" ? tema.valorVisual : "padrao";
    const valorMoldura = moldura?.tipo === "moldura" ? moldura.valorVisual : "padrao";

    raiz.dataset.studyTheme = valorTema;
    raiz.dataset.studyFrame = valorMoldura;

    return () => {
      delete raiz.dataset.studyTheme;
      delete raiz.dataset.studyFrame;
    };
  }, [tema?.tipo, tema?.valorVisual, moldura?.tipo, moldura?.valorVisual]);

  return null;
}
