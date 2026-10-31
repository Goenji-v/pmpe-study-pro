import { useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

type Etapa = "senha" | "codigo" | "nova";
export default function AlterarSenha() {
  const { usuario } = useAuth();
  const [etapa, setEtapa] = useState<Etapa>("senha");
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [codigo, setCodigo] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const email = usuario?.email ?? "";

  async function executar(acao: () => Promise<void>) {
    if (ocupado) return;
    setErro(""); setMensagem(""); setOcupado(true);
    try { await acao(); }
    catch (falha) { setErro(falha instanceof Error ? falha.message : "Não foi possível concluir. Tente novamente."); }
    finally { setOcupado(false); }
  }

  async function confirmarAtual(evento: FormEvent) {
    evento.preventDefault();
    await executar(async () => {
      if (!email || !atual) throw new Error("Informe a senha atual.");
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: atual });
      if (error || data.user?.id !== usuario?.id) throw new Error("Senha atual incorreta.");
      setAtual(""); setEtapa("nova");
    });
  }

  async function pedirCodigo() {
    await executar(async () => {
      if (!email) throw new Error("Sua conta não possui e-mail confirmado.");
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "https://pmpe-study-pro-two.vercel.app/redefinir-senha",
      });
      if (error) throw new Error("Não foi possível enviar o código. Tente novamente.");
      setEtapa("codigo");
      setMensagem("Confira seu e-mail. Use o código de recuperação recebido.");
    });
  }

  async function verificarCodigo(evento: FormEvent) {
    evento.preventDefault();
    await executar(async () => {
      if (!email || codigo.trim().length < 6) throw new Error("Digite o código recebido.");
      const { data, error } = await supabase.auth.verifyOtp({
        email, token: codigo.trim(), type: "recovery",
      });
      if (error || data.user?.id !== usuario?.id) throw new Error("Código incorreto ou expirado.");
      setCodigo(""); setEtapa("nova");
    });
  }

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    await executar(async () => {
      if (nova.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
      if (nova !== confirmacao) throw new Error("As novas senhas não coincidem.");
      const { error } = await supabase.auth.updateUser({ password: nova });
      if (error) throw new Error("Não foi possível alterar a senha. Verifique as regras de segurança.");
      setNova(""); setConfirmacao(""); setAtual(""); setEtapa("senha");
      setMensagem("Senha alterada com sucesso.");
    });
  }

  return <section className="configuracoes-card" aria-labelledby="config-senha">
    <h2 id="config-senha">Alterar senha</h2>
    <p>Proteja sua conta Study Pro. A senha armazenada não pode ser exibida; o ícone permite ver apenas o que você digitar.</p>
    <p><strong>Conta:</strong> {email}</p>
    {etapa === "senha" && <form onSubmit={e => void confirmarAtual(e)} className="configuracoes-form-group">
      <label htmlFor="senha-atual">Senha atual</label>
      <input id="senha-atual" type={mostrar ? "text" : "password"} autoComplete="current-password" value={atual} onChange={e => setAtual(e.target.value)} required />
      <label><input type="checkbox" checked={mostrar} onChange={e => setMostrar(e.target.checked)} /> Mostrar senha digitada</label>
      <button type="submit" disabled={ocupado}>Continuar</button>
      <button type="button" disabled={ocupado} onClick={() => void pedirCodigo()}>Não sei a senha atual</button>
    </form>}
    {etapa === "codigo" && <form onSubmit={e => void verificarCodigo(e)} className="configuracoes-form-group">
      <label htmlFor="codigo-senha">Código enviado ao e-mail</label>
      <input id="codigo-senha" inputMode="numeric" autoComplete="one-time-code" value={codigo} onChange={e => setCodigo(e.target.value)} required />
      <button type="submit" disabled={ocupado}>Confirmar código</button>
      <button type="button" disabled={ocupado} onClick={() => void pedirCodigo()}>Reenviar código</button>
      <button type="button" onClick={() => setEtapa("senha")}>Voltar</button>
    </form>}
    {etapa === "nova" && <form onSubmit={e => void salvar(e)} className="configuracoes-form-group">
      <label htmlFor="senha-nova">Nova senha</label>
      <input id="senha-nova" type="password" autoComplete="new-password" minLength={8} value={nova} onChange={e => setNova(e.target.value)} required />
      <label htmlFor="senha-confirmacao">Confirmar nova senha</label>
      <input id="senha-confirmacao" type="password" autoComplete="new-password" minLength={8} value={confirmacao} onChange={e => setConfirmacao(e.target.value)} required />
      <button type="submit" disabled={ocupado}>Salvar nova senha</button>
      <button type="button" onClick={() => setEtapa("senha")}>Cancelar</button>
    </form>}
    {erro && <p role="alert" style={{color:"#cf3636"}}>{erro}</p>}
    {mensagem && <p role="status">{mensagem}</p>}
    {etapa === "codigo" && <p>O e-mail precisa conter o código de 6 dígitos. Se receber apenas um botão, o template de recuperação ainda precisa incluir o código.</p>}
  </section>;
}
