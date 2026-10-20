import { useEffect, useState } from "react";
import { obterDiaLocal } from "../utils/sequenciaAtividades";

/** Atualiza indicadores diários também quando a tela atravessa a meia-noite. */
export function useDiaLocalAtual() {
  const [dia, setDia] = useState(() => obterDiaLocal(new Date()));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function atualizar() {
      clearTimeout(timer);
      const agora = new Date();
      setDia(obterDiaLocal(agora));
      const proximoDia = new Date(agora);
      proximoDia.setHours(24, 0, 0, 0);
      timer = setTimeout(atualizar, proximoDia.getTime() - agora.getTime() + 10);
    }
    atualizar();
    window.addEventListener("focus", atualizar);
    document.addEventListener("visibilitychange", atualizar);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", atualizar);
      document.removeEventListener("visibilitychange", atualizar);
    };
  }, []);
  return dia;
}
