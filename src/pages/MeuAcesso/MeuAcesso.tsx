import { useContextoComercial } from "../../hooks/useContextoComercial";
import "./MeuAcesso.css";

export default function MeuAcesso() {
  const { contexto, carregando, erro, recarregar } = useContextoComercial();
  if (carregando) return <section className="acesso-pagina">Carregando seu acesso...</section>;
  if (erro || !contexto) return <section className="acesso-pagina"><div className="acesso-cartao"><h1>Não foi possível verificar</h1><p>{erro}</p><button onClick={recarregar}>Tentar novamente</button></div></section>;
  return <section className="acesso-pagina"><div className="acesso-cartao"><span>MEU ACESSO</span><h1>{contexto.parceiroNome || "Acesso individual"}</h1><p>{mensagemStatus(contexto.status)}</p><dl><div><dt>Turma</dt><dd>{contexto.turmaNome || "Não vinculada"}</dd></div><div><dt>Situação</dt><dd className={`acesso-status ${contexto.status}`}>{contexto.status}</dd></div><div><dt>Início</dt><dd>{formatarData(contexto.inicioEm)}</dd></div><div><dt>Expiração</dt><dd>{formatarData(contexto.expiraEm)}</dd></div></dl>{contexto.motivoBloqueio && <div className="acesso-aviso">{contexto.motivoBloqueio}</div>}<button onClick={recarregar}>Atualizar situação</button></div></section>;
}

function mensagemStatus(status: string) { if(status==="pendente") return "Sua solicitação foi enviada. O professor precisa aprová-la para liberar o conteúdo."; if(status==="ativa") return "Seu acesso está ativo e você já pode estudar normalmente."; if(status==="legado") return "Sua conta continua com o acesso original, sem vínculo com uma parceria."; return "Seu acesso está bloqueado. Fale com o responsável pela turma."; }
function formatarData(valor: string | null) { if(!valor) return "—"; const data=new Date(valor); return Number.isNaN(data.getTime()) ? "—" : data.toLocaleDateString("pt-BR"); }
