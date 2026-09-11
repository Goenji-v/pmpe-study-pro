import { useEffect, useState } from "react";
import { carregarMinhaTrilhaMentoria, type TrilhaMentoria } from "../../services/mentoriaService";
import CronogramaIA from "./CronogramaIA";
import CronogramaMentoria from "./CronogramaMentoria";

export default function CronogramaGateway() {
  const [trilha, setTrilha] = useState<TrilhaMentoria | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    void carregarMinhaTrilhaMentoria()
      .then((valor) => { if (ativo) setTrilha(valor); })
      .catch((erro) => {
        console.warn("Mentoria indisponível; usando cronograma legado:", erro);
        if (ativo) setTrilha(null);
      })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, []);

  if (carregando) return <div role="status">Carregando seu cronograma...</div>;
  return trilha ? <CronogramaMentoria trilhaInicial={trilha} /> : <CronogramaIA />;
}
