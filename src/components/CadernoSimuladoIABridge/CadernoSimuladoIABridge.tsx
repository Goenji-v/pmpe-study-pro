import { useEffect } from "react";

import { registrarQuestoesAtuaisComoCaderno } from "../../services/cadernosSimuladosIAService";

const EVENTO_QUESTOES_IA = "pmpe-questoes-ia-atualizadas";

export default function CadernoSimuladoIABridge() {
  useEffect(() => {
    let ativo = true;

    async function registrar() {
      try {
        await registrarQuestoesAtuaisComoCaderno();
      } catch (error) {
        if (ativo) {
          console.error("Erro ao registrar caderno de simulado IA:", error);
        }
      }
    }

    void registrar();
    window.addEventListener(EVENTO_QUESTOES_IA, registrar);

    return () => {
      ativo = false;
      window.removeEventListener(EVENTO_QUESTOES_IA, registrar);
    };
  }, []);

  return null;
}
