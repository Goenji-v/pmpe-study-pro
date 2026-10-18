import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { armazenamentoSessaoDaConta as storage, obterEscopoArmazenamento } from "../../services/armazenamentoConta";

export default function RetomarNavegacao() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    const chave = `navegacao:${obterEscopoArmazenamento()?.usuarioId ?? "sem-conta"}:scroll:${pathname}`;
    const salvo = Number(storage.getItem(chave));
    const destino = Number.isFinite(salvo) && salvo > 0 ? salvo : 0;
    let ultimaPosicao = destino;
    let restaurando = true;
    const restaurar = () => {
      if (!restaurando) return;
      window.scrollTo({ top: destino, behavior: "instant" });
      if (Math.abs(window.scrollY - destino) < 2) restaurando = false;
    };
    const salvar = () => {
      if (restaurando) return;
      ultimaPosicao = window.scrollY;
      try { storage.setItem(chave, String(ultimaPosicao)); } catch { /* Navegação continua sem cache. */ }
    };
    const interagir = () => { restaurando = false; };
    // Lazy routes may first render a short loading placeholder.
    const observer = new ResizeObserver(restaurar);
    observer.observe(document.body);
    restaurar();
    const limite = window.setTimeout(() => { restaurando = false; observer.disconnect(); }, 5000);
    window.addEventListener("scroll", salvar, { passive: true });
    window.addEventListener("wheel", interagir, { passive: true });
    window.addEventListener("touchstart", interagir, { passive: true });
    window.addEventListener("keydown", interagir);
    return () => {
      observer.disconnect();
      window.clearTimeout(limite);
      window.removeEventListener("scroll", salvar);
      window.removeEventListener("wheel", interagir);
      window.removeEventListener("touchstart", interagir);
      window.removeEventListener("keydown", interagir);
      try { storage.setItem(chave, String(ultimaPosicao)); } catch { /* Sem cache. */ }
    };
  }, [pathname]);
  return null;
}
