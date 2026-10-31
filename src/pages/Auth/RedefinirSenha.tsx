import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "../../lib/supabase";
import AuthHero from "./AuthHero";
import "./Auth.css";

export default function RedefinirSenha() {
  const [autorizado, setAutorizado] = useState(false);
  const [verificando, setVerificando] = useState(true);
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const parametros = new URLSearchParams(window.location.search);
    const erroLink = parametros.get("error_code") || parametros.get("error");
    if (erroLink) {
      setAutorizado(false);
      setErro(erroLink === "otp_expired"
        ? "O link expirou ou já foi utilizado. Solicite um novo e-mail de recuperação."
        : "Este link de recuperação é inválido. Solicite um novo e-mail.");
      setVerificando(false);
      return;
    }
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
      // A sessão concedida pelo link de recuperação não deve manter
      // o aluno autenticado no aplicativo depois da troca da senha.
      const { error: erroSaida } = await supabase.auth.signOut({ scope: "local" });
      if (erroSaida) {
        throw new Error("Senha alterada, mas não foi possível encerrar a sessão.");
      }
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
      <AuthHero logoRecuperacao />
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
              <p>Senha alterada com sucesso!</p>
              <Link className="auth-submit" style={{ display: "block", textAlign: "center", textDecoration: "none" }} to="/login">Entrar no Study Pro</Link>
            </div>
          ) : autorizado ? (
            <form onSubmit={enviar} className="auth-formulario">
              <div className="auth-campo">
                <label htmlFor="nova-senha">Nova senha</label>
                <div style={{ position: "relative" }}>
                  <input id="nova-senha" type={mostrarSenha ? "text" : "password"} autoComplete="new-password"
                    style={{ paddingRight: 50 }} minLength={8} required value={senha} onChange={e => setSenha(e.target.value)} />
                  <button type="button" aria-label={mostrarSenha ? "Ocultar nova senha" : "Mostrar nova senha"} aria-pressed={mostrarSenha} onClick={() => setMostrarSenha(v => !v)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "transparent", border: 0, color: "inherit", cursor: "pointer", padding: 8 }}>
                    {mostrarSenha ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              <div className="auth-campo">
                <label htmlFor="confirmar-nova-senha">Confirmar nova senha</label>
                <div style={{ position: "relative" }}>
                  <input id="confirmar-nova-senha" type={mostrarConfirmacao ? "text" : "password"} autoComplete="new-password"
                    style={{ paddingRight: 50 }} minLength={8} required value={confirmacao} onChange={e => setConfirmacao(e.target.value)} />
                  <button type="button" aria-label={mostrarConfirmacao ? "Ocultar confirmação da senha" : "Mostrar confirmação da senha"} aria-pressed={mostrarConfirmacao} onClick={() => setMostrarConfirmacao(v => !v)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "transparent", border: 0, color: "inherit", cursor: "pointer", padding: 8 }}>
                    {mostrarConfirmacao ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
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
