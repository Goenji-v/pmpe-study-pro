import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import AuthHero from "./AuthHero";
import "./Auth.css";

export default function RedefinirSenha() {
  const [autorizado, setAutorizado] = useState(false);
  const [verificando, setVerificando] = useState(true);
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    const { data: assinatura } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (!ativo) return;
      if (evento === "PASSWORD_RECOVERY") {
        setAutorizado(Boolean(sessao));
        setVerificando(false);
      }
    });

    const verificar = async () => {
      try {
        // Links de recuperação Supabase podem entregar a sessão na URL.
        // O cliente processa a URL antes de informar a sessão disponível.
        const { data, error } = await supabase.auth.getSession();
        if (!ativo) return;
        if (error) throw error;
        setAutorizado(Boolean(data.session));
      } catch {
        if (ativo) setErro("Não foi possível verificar o link de recuperação.");
      } finally {
        if (ativo) setVerificando(false);
      }
    };
    void verificar();
    return () => { ativo = false; assinatura.subscription.unsubscribe(); };
  }, []);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro("");
    if (senha.length < 8) {
      setErro("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (senha !== confirmacao) {
      setErro("As senhas não coincidem.");
      return;
    }
    if (!autorizado || salvando) return;
    try {
      setSalvando(true);
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;
      setSucesso(true);
      setSenha("");
      setConfirmacao("");
    } catch {
      setErro("Não foi possível alterar a senha. Solicite um novo link de recuperação.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main className="auth-pagina">
      <AuthHero />
      <section className="auth-formulario-area">
        <div className="auth-formulario-card">
          <div className="auth-formulario-topo">
            <span>SEGURANÇA DA CONTA</span>
            <h2>Redefinir sua senha</h2>
            <p>Escolha uma nova senha para sua conta do Study Pro.</p>
          </div>
          {verificando ? (
            <p role="status">Verificando seu link de recuperação...</p>
          ) : sucesso ? (
            <div className="auth-sucesso" role="status">
              Senha alterada com sucesso. <Link to="/login">Ir para o aplicativo</Link>.
            </div>
          ) : autorizado ? (
            <form onSubmit={enviar} className="auth-formulario">
              <div className="auth-campo">
                <label htmlFor="nova-senha">Nova senha</label>
                <input id="nova-senha" type="password" autoComplete="new-password"
                  minLength={8} required value={senha} onChange={e => setSenha(e.target.value)} />
              </div>
              <div className="auth-campo">
                <label htmlFor="confirmar-nova-senha">Confirmar nova senha</label>
                <input id="confirmar-nova-senha" type="password" autoComplete="new-password"
                  minLength={8} required value={confirmacao} onChange={e => setConfirmacao(e.target.value)} />
              </div>
              {erro && <div className="auth-erro" role="alert">{erro}</div>}
              <button className="auth-submit" disabled={salvando} type="submit">
                {salvando ? "Salvando..." : "Salvar nova senha"}
              </button>
            </form>
          ) : (
            <div>
              <p className="auth-erro" role="alert">{erro || "Este link expirou ou é inválido. Solicite outro e-mail de recuperação."}</p>
              <Link to="/login?modo=recuperar">Solicitar outro link</Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
