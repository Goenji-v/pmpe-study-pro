import {
  useState,
} from "react";

import {
  useApp,
} from "../../context/AppContext";

import "./CloudStatus.css";

export default function CloudStatus() {
  const {
    statusNuvem,
    erroNuvem,
    sincronizarAgora,
  } = useApp();

  const [
    executando,
    setExecutando,
  ] = useState(false);

  async function sincronizar() {
    if (executando) {
      return;
    }

    try {
      setExecutando(true);

      await sincronizarAgora();
    } catch {
      // O erro já aparece no estado do AppContext.
    } finally {
      setExecutando(false);
    }
  }

  const texto =
    statusNuvem === "carregando"
      ? "Carregando nuvem"
      : statusNuvem === "salvando"
        ? "Salvando"
        : statusNuvem === "erro"
          ? "Erro na nuvem"
          : "Sincronizado";

  return (
    <div
      className={`cloud-status cloud-status-${statusNuvem}`}
      title={
        erroNuvem ||
        "Dados sincronizados com o Supabase."
      }
    >
      <span />

      <strong>
        {texto}
      </strong>

      {statusNuvem ===
        "erro" && (
        <button
          type="button"
          onClick={sincronizar}
          disabled={executando}
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}