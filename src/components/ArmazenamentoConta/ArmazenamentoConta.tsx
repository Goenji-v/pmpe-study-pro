import { useLayoutEffect, useState, type ReactNode } from "react";
import { useApp } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import { criarEscopoArmazenamento, definirEscopoArmazenamento } from "../../services/armazenamentoConta";

/** Só monta as páginas depois de selecionar a conta e a geração dos caches. */
export default function ArmazenamentoConta({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const { configuracoes } = useApp();
  const usuarioId = usuario?.id ?? "sem-usuario";
  const isolado = configuracoes.armazenamentoPorConta;
  const reinicio = configuracoes.dadosReiniciadosEm;
  const chave = `${usuarioId}:${Boolean(isolado)}:${reinicio ?? ""}`;
  const [pronto, setPronto] = useState("");
  useLayoutEffect(() => {
    definirEscopoArmazenamento(criarEscopoArmazenamento(usuarioId, { armazenamentoPorConta: isolado, dadosReiniciadosEm: reinicio }));
    setPronto(chave);
    return () => definirEscopoArmazenamento(null);
  }, [usuarioId, isolado, reinicio, chave]);
  return pronto === chave ? <div key={chave} style={{ display: "contents" }}>{children}</div> : null;
}
