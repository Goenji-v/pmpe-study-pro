import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { carregarContextoComercial, type ContextoComercial } from "../services/parceriasService";

export function useContextoComercial() {
  const { usuario } = useAuth();
  const usuarioId = usuario?.id;
  const [contexto, setContexto] = useState<ContextoComercial | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    if (!usuarioId) {
      setContexto(null);
      setCarregando(false);
      return;
    }
    setCarregando(true);
    carregarContextoComercial()
      .then((novo) => { if (ativo) setContexto(novo); })
      .catch((falha) => { if (ativo) setErro(falha instanceof Error ? falha.message : "Erro ao verificar acesso."); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [usuarioId]);

  return { contexto, carregando, erro };
}
