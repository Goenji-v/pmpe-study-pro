import { useEffect, useMemo, useState } from "react";

import "./PersonalizacaoBridge.css";
import "./WallpaperBridge.css";

import { useApp } from "../../context/AppContext";
import { carregarWallpapersLoja } from "../../services/catalogoLojaService";
import { obterEstadoEconomia } from "../../services/economiaGamificacao";
import {
  CATALOGO_LOJA,
  encontrarItemLoja,
  obterWallpaperEquipadoId,
  type ItemLoja,
} from "../../services/lojaGamificacao";

export default function PersonalizacaoBridge() {
  const { configuracoes } = useApp();
  const economia = useMemo(() => obterEstadoEconomia(configuracoes), [configuracoes]);
  const wallpaperEquipadoId = obterWallpaperEquipadoId(economia);
  const [wallpapers, setWallpapers] = useState<ItemLoja[]>([]);

  useEffect(() => {
    let ativo = true;
    carregarWallpapersLoja()
      .then((itens) => {
        if (ativo) setWallpapers(itens);
      })
      .catch(() => {
        if (ativo) setWallpapers([]);
      });
    return () => {
      ativo = false;
    };
  }, [wallpaperEquipadoId]);

  const catalogo = useMemo(() => [...CATALOGO_LOJA, ...wallpapers], [wallpapers]);
  const tema = encontrarItemLoja(economia.temaEquipado, catalogo);
  const moldura = encontrarItemLoja(economia.molduraEquipada, catalogo);
  const wallpaper = encontrarItemLoja(wallpaperEquipadoId, catalogo);

  useEffect(() => {
    const raiz = document.documentElement;
    const valorTema = tema?.tipo === "tema" ? tema.valorVisual : "padrao";
    const valorMoldura = moldura?.tipo === "moldura" ? moldura.valorVisual : "padrao";
    const wallpaperValido = wallpaper?.tipo === "wallpaper" && Boolean(wallpaper.wallpaperDesktopUrl);

    raiz.dataset.studyTheme = valorTema;
    raiz.dataset.studyFrame = valorMoldura;
    raiz.dataset.studyWallpaper = wallpaperValido ? "ativo" : "padrao";

    if (wallpaperValido) {
      raiz.style.setProperty("--study-wallpaper-desktop", `url("${wallpaper.wallpaperDesktopUrl}")`);
      raiz.style.setProperty(
        "--study-wallpaper-mobile",
        `url("${wallpaper.wallpaperMobileUrl || wallpaper.wallpaperDesktopUrl}")`
      );
    } else {
      raiz.style.removeProperty("--study-wallpaper-desktop");
      raiz.style.removeProperty("--study-wallpaper-mobile");
    }

    return () => {
      delete raiz.dataset.studyTheme;
      delete raiz.dataset.studyFrame;
      delete raiz.dataset.studyWallpaper;
      raiz.style.removeProperty("--study-wallpaper-desktop");
      raiz.style.removeProperty("--study-wallpaper-mobile");
    };
  }, [
    tema?.tipo,
    tema?.valorVisual,
    moldura?.tipo,
    moldura?.valorVisual,
    wallpaper?.tipo,
    wallpaper?.wallpaperDesktopUrl,
    wallpaper?.wallpaperMobileUrl,
  ]);

  return null;
}
