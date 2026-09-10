import type { ReactNode } from "react";
import { useContextoComercial } from "../../hooks/useContextoComercial";
import "./CommercialAccessGate.css";

export default function CommercialAccessGate({ children }: { children: ReactNode }) {
  const { contexto, carregando, erro } = useContextoComercial();
  if (carregando) return <div className="licenca-estado">Verificando seu acesso...</div>;
  if (erro) return <div className="licenca-estado licenca-erro"><strong>Não foi possível validar o acesso.</strong><span>{erro}</span></div>;
  if (contexto && !contexto.acessoPermitido) {
    return (
      <main className="licenca-bloqueada">
        <span>ACESSO {contexto.status.toUpperCase()}</span>
        <h1>Sua licença precisa ser regularizada</h1>
        <p>{contexto.motivoBloqueio || "O período de acesso terminou ou a licença foi suspensa."}</p>
        {contexto.parceiroNome && <small>Curso responsável: {contexto.parceiroNome}</small>}
        {contexto.expiraEm && <small>Data de expiração: {new Date(contexto.expiraEm).toLocaleDateString("pt-BR")}</small>}
      </main>
    );
  }
  return children;
}
