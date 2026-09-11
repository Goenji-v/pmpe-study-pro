import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useContextoComercial } from "../../hooks/useContextoComercial";
import "./CommercialAccessGate.css";

export default function CommercialAccessGate({ children }: { children: ReactNode }) {
  const { contexto, carregando, erro } = useContextoComercial();
  const location = useLocation();
  if (carregando) return <div className="licenca-estado">Verificando seu acesso...</div>;
  if (erro) return <div className="licenca-estado licenca-erro"><strong>Não foi possível validar o acesso.</strong><span>{erro}</span></div>;
  if (contexto && !contexto.acessoPermitido) {
    if (location.pathname === "/meu-acesso") return children;
    return (
      <main className="licenca-bloqueada">
        <span>ACESSO {contexto.status.toUpperCase()}</span>
        <h1>Sua licença precisa ser regularizada</h1>
        <p>{contexto.motivoBloqueio || "O período de acesso terminou ou a licença foi suspensa."}</p>
        {contexto.parceiroNome && <small>Curso responsável: {contexto.parceiroNome}</small>}
        {contexto.expiraEm && <small>Data de expiração: {new Date(contexto.expiraEm).toLocaleDateString("pt-BR")}</small>}
        <Link to="/meu-acesso">Ver detalhes do meu acesso</Link>
      </main>
    );
  }
  return children;
}
