import { useEffect, useState } from "react";
import { carregarTrilhaCronogramaMentoria, type TrilhaCronogramaMentoria } from "../../services/mentoriaCronogramaService";
import CronogramaIA from "./CronogramaIA";
import CronogramaMentoria from "./CronogramaMentoria";

export default function CronogramaGateway() {
  const [trilha, setTrilha] = useState<TrilhaCronogramaMentoria | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;

    void carregarTrilhaCronogramaMentoria()
      .then((valor) => {
        if (ativo) setTrilha(valor);
      })
      .catch((erro) => {
        console.warn("Cronograma da mentoria indisponível; usando fluxo legado:", erro);
        if (ativo) setTrilha(null);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  if (carregando) return <div role="status">Carregando seu cronograma...</div>;
  return trilha ? <CronogramaMentoria trilhaInicial={trilha} /> : <CronogramaIA />;
}
