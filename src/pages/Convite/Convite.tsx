import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { consultarConvite, solicitarEntrada, type ConvitePublico } from "../../services/parceriasService";
import "./Convite.css";

export default function Convite() {
  const { codigo = "" } = useParams();
  const { usuario, carregando: carregandoAuth } = useAuth();
  const navigate = useNavigate();
  const [convite, setConvite] = useState<ConvitePublico | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    consultarConvite(codigo).then((valor) => { if (ativo) setConvite(valor); }).catch((e) => { if (ativo) setErro(e instanceof Error ? e.message : "Convite indisponível."); }).finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [codigo]);

  async function entrarNaTurma() {
    try {
      setEnviando(true); setErro("");
      await solicitarEntrada(codigo);
      navigate("/meu-acesso", { replace: true });
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível solicitar o acesso."); }
    finally { setEnviando(false); }
  }

  if (carregando || carregandoAuth) return <main className="convite-pagina"><section className="convite-card">Carregando convite...</section></main>;
  if (!convite) return <main className="convite-pagina"><section className="convite-card"><span>CONVITE INDISPONÍVEL</span><h1>Este link expirou ou foi encerrado.</h1><p>{erro || "Peça ao professor um novo link de convite."}</p><Link to="/login">Ir para o login</Link></section></main>;

  const destino = `/convite/${encodeURIComponent(codigo)}`;
  return (
    <main className="convite-pagina">
      <section className="convite-card">
        <span>CONVITE PARA TURMA</span>
        <h1>{convite.titulo || convite.turmaNome}</h1>
        <p>Você foi convidado por <strong>{convite.parceiroNome}</strong> para a turma <strong>{convite.turmaNome}</strong>.</p>
        <div className="convite-detalhes"><div><small>Acesso</small><strong>{convite.duracaoMeses} meses</strong></div><div><small>Entrada</small><strong>{convite.exigeAprovacao ? "Após aprovação" : "Imediata"}</strong></div></div>
        {erro && <div className="convite-erro" role="alert">{erro}</div>}
        {usuario ? <button type="button" onClick={entrarNaTurma} disabled={enviando}>{enviando ? "Enviando..." : "Solicitar entrada na turma"}</button> : <div className="convite-acoes"><Link className="primario" to={`/login?modo=cadastro&convite=${encodeURIComponent(codigo)}`} state={{ origem: destino }}>Criar conta e continuar</Link><Link to={`/login?convite=${encodeURIComponent(codigo)}`} state={{ origem: destino }}>Já tenho uma conta</Link></div>}
        <small className="convite-privacidade">O professor verá seu nome, e-mail, situação da licença e resumo de desempenho. Anotações e dados privados não são compartilhados.</small>
      </section>
    </main>
  );
}
