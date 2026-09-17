import {
  useState,
  type FormEvent,
} from "react";

import {
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import {
  ArrowRight,
  Database,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import "./Auth.css";

import {
  useAuth,
} from "../../context/AuthContext";

type Modo =
  | "login"
  | "cadastro"
  | "recuperar";

const EMAIL_LEMBRADO_CHAVE = "pmpe-study-pro-email";

export default function Auth() {
  const {
    usuario,
    carregando,
    entrar,
    cadastrar,
    recuperarSenha,
  } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const convite = searchParams.get("convite");

  const [modo, setModo] = useState<Modo>(
    searchParams.get("modo") === "cadastro" ? "cadastro" : "login"
  );
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState(() => {
    try {
      return window.localStorage.getItem(EMAIL_LEMBRADO_CHAVE) ?? "";
    } catch {
      return "";
    }
  });
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);
  const [lembrar, setLembrar] = useState(() => {
    try {
      return Boolean(window.localStorage.getItem(EMAIL_LEMBRADO_CHAVE));
    } catch {
      return false;
    }
  });
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  if (!carregando && usuario) {
    return (
      <Navigate
        to={convite ? `/convite/${encodeURIComponent(convite)}` : "/"}
        replace
      />
    );
  }

  const origem =
    (
      location.state as
        | { origem?: string }
        | null
    )?.origem ?? (convite ? `/convite/${encodeURIComponent(convite)}` : "/");

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    if (enviando) {
      return;
    }

    setErro("");
    setMensagem("");

    try {
      setEnviando(true);

      if (modo === "login") {
        validarEmailSenha();
        await entrar(email, senha);

        try {
          if (lembrar) {
            window.localStorage.setItem(EMAIL_LEMBRADO_CHAVE, email.trim());
          } else {
            window.localStorage.removeItem(EMAIL_LEMBRADO_CHAVE);
          }
        } catch {
          // O login continua normalmente mesmo se o navegador bloquear o armazenamento local.
        }

        navigate(origem, { replace: true });
        return;
      }

      if (modo === "cadastro") {
        validarCadastro();

        const resultado = await cadastrar(
          nome,
          email,
          senha,
          convite ? `${window.location.origin}/convite/${encodeURIComponent(convite)}` : undefined
        );

        if (resultado.precisaConfirmarEmail) {
          setMensagem("Conta criada. Confira seu e-mail para confirmar o cadastro.");
          setModo("login");
        } else {
          navigate(origem, { replace: true });
        }

        return;
      }

      validarEmail();
      await recuperarSenha(email);
      setMensagem("Enviamos as instruções de recuperação para seu e-mail.");
    } catch (erroEnvio) {
      setErro(
        erroEnvio instanceof Error
          ? erroEnvio.message
          : "Não foi possível concluir a operação."
      );
    } finally {
      setEnviando(false);
    }
  }

  function validarEmail() {
    if (!email.trim() || !email.includes("@")) {
      throw new Error("Digite um e-mail válido.");
    }
  }

  function validarEmailSenha() {
    validarEmail();

    if (!senha) {
      throw new Error("Digite sua senha.");
    }
  }

  function validarCadastro() {
    validarEmail();

    if (nome.trim().length < 2) {
      throw new Error("Digite seu nome.");
    }

    if (senha.length < 6) {
      throw new Error("A senha precisa ter pelo menos 6 caracteres.");
    }

    if (senha !== confirmarSenha) {
      throw new Error("As senhas não coincidem.");
    }
  }

  function trocarModo(novoModo: Modo) {
    setModo(novoModo);
    setErro("");
    setMensagem("");
    setSenha("");
    setConfirmarSenha("");
    setMostrarSenha(false);
    setMostrarConfirmarSenha(false);
  }

  return (
    <main className="auth-pagina">
      <section
        className="auth-apresentacao"
        aria-label="Studio Pro: preparação que aprova"
        style={{ position: "relative", overflow: "hidden", background: "#04101e" }}
      >
        <img
          src="https://images.pexels.com/photos/4646766/pexels-photo-4646766.jpeg?auto=compress&cs=tinysrgb&w=1600"
          alt=""
          aria-hidden="true"
          draggable="false"
          onError={(evento) => {
            evento.currentTarget.onerror = null;
            evento.currentTarget.src = "/assets/auth-login-reference.webp";
          }}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            display: "block",
            objectFit: "cover",
            objectPosition: "center center",
            filter: "saturate(.7) contrast(1.12) brightness(.62)",
            userSelect: "none",
            pointerEvents: "none",
          }}
        />

        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 25% 38%, rgba(28,132,255,.24), transparent 33%), linear-gradient(90deg, rgba(2,10,21,.46) 0%, rgba(2,10,21,.18) 52%, rgba(3,13,25,.72) 100%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "absolute",
            left: "clamp(36px, 5vw, 82px)",
            top: "50%",
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            gap: "20px",
            transform: "translateY(-50%)",
            textShadow: "0 8px 28px rgba(0,0,0,.6)",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: "86px",
              height: "96px",
              display: "grid",
              placeItems: "center",
              color: "#f7fbff",
              background:
                "linear-gradient(145deg, rgba(255,255,255,.18), rgba(18,123,255,.35))",
              border: "2px solid rgba(119,190,255,.92)",
              borderRadius: "28px 28px 36px 36px",
              boxShadow:
                "0 0 0 6px rgba(20,119,255,.09), 0 14px 38px rgba(0,91,211,.36), inset 0 1px 0 rgba(255,255,255,.34)",
              fontSize: "54px",
              fontWeight: 950,
              letterSpacing: "-4px",
            }}
          >
            S
          </div>

          <div>
            <div
              style={{
                color: "#ffffff",
                fontSize: "clamp(34px, 4.3vw, 66px)",
                fontWeight: 950,
                lineHeight: .92,
                letterSpacing: "-2.2px",
              }}
            >
              STUDIO <span style={{ color: "#2594ff" }}>PRO</span>
            </div>
            <div
              style={{
                marginTop: "12px",
                color: "#bcd7f4",
                fontSize: "12px",
                fontWeight: 800,
                letterSpacing: "2.7px",
              }}
            >
              FOCO • DISCIPLINA • APROVAÇÃO
            </div>
          </div>
        </div>

        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            right: "32px",
            bottom: "34px",
            zIndex: 2,
            padding: "10px 15px",
            color: "#eaf4ff",
            background: "rgba(3,13,25,.62)",
            border: "1px solid rgba(89,166,255,.42)",
            borderRadius: "8px",
            backdropFilter: "blur(5px)",
            fontSize: "15px",
            fontWeight: 950,
            letterSpacing: "2px",
          }}
        >
          PMPR
        </div>
      </section>

      <section className="auth-formulario-area">
        <div className="auth-formulario-card">
          <div className="auth-formulario-topo">
            <span>
              {modo === "login"
                ? "ACESSAR CONTA"
                : modo === "cadastro"
                  ? "CRIAR CONTA"
                  : "RECUPERAR ACESSO"}
            </span>

            <h2>
              {modo === "login"
                ? "Entrar"
                : modo === "cadastro"
                  ? "Cadastro"
                  : "Recuperar senha"}
            </h2>

            <p>
              {modo === "login"
                ? "Use seu e-mail e senha para continuar."
                : modo === "cadastro"
                  ? "Crie sua conta para manter seus dados sincronizados."
                  : "Informe o e-mail cadastrado para recuperar o acesso."}
            </p>
          </div>

          <form onSubmit={enviar} className="auth-formulario">
            {modo === "cadastro" && (
              <label>
                <span>Nome</span>
                <div className="auth-input-com-icone">
                  <UserRound size={19} aria-hidden="true" />
                  <input
                    type="text"
                    value={nome}
                    onChange={(evento) => setNome(evento.target.value)}
                    autoComplete="name"
                    placeholder="Seu nome"
                  />
                </div>
              </label>
            )}

            <label>
              <span>E-mail</span>
              <div className="auth-input-com-icone">
                <Mail size={19} aria-hidden="true" />
                <input
                  type="email"
                  value={email}
                  onChange={(evento) => setEmail(evento.target.value)}
                  autoComplete="email"
                  placeholder="seuemail@exemplo.com"
                />
              </div>
            </label>

            {modo !== "recuperar" && (
              <label>
                <span>Senha</span>
                <div className="auth-input-com-icone auth-input-senha">
                  <LockKeyhole size={19} aria-hidden="true" />
                  <input
                    type={mostrarSenha ? "text" : "password"}
                    value={senha}
                    onChange={(evento) => setSenha(evento.target.value)}
                    autoComplete={modo === "cadastro" ? "new-password" : "current-password"}
                    placeholder="Sua senha"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha((valor) => !valor)}
                    aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                    title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {mostrarSenha ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </label>
            )}

            {modo === "cadastro" && (
              <label>
                <span>Confirmar senha</span>
                <div className="auth-input-com-icone auth-input-senha">
                  <LockKeyhole size={19} aria-hidden="true" />
                  <input
                    type={mostrarConfirmarSenha ? "text" : "password"}
                    value={confirmarSenha}
                    onChange={(evento) => setConfirmarSenha(evento.target.value)}
                    autoComplete="new-password"
                    placeholder="Repita a senha"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarConfirmarSenha((valor) => !valor)}
                    aria-label={mostrarConfirmarSenha ? "Ocultar confirmação da senha" : "Mostrar confirmação da senha"}
                    title={mostrarConfirmarSenha ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {mostrarConfirmarSenha ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </label>
            )}

            {modo === "login" && (
              <div className="auth-acoes-login">
                <label className="auth-lembrar">
                  <input
                    type="checkbox"
                    checked={lembrar}
                    onChange={(evento) => setLembrar(evento.target.checked)}
                  />
                  <span aria-hidden="true" />
                  Lembrar de mim
                </label>

                <button
                  type="button"
                  className="auth-esqueceu"
                  onClick={() => trocarModo("recuperar")}
                >
                  Esqueci minha senha?
                </button>
              </div>
            )}

            {erro && <div className="auth-erro">{erro}</div>}
            {mensagem && <div className="auth-sucesso">{mensagem}</div>}

            <button
              type="submit"
              disabled={enviando}
              className="auth-submit"
            >
              <span>
                {enviando
                  ? "Aguarde..."
                  : modo === "login"
                    ? "Entrar"
                    : modo === "cadastro"
                      ? "Criar conta"
                      : "Enviar instruções"}
              </span>
              {modo === "login" && !enviando && <ArrowRight size={20} aria-hidden="true" />}
            </button>
          </form>

          {modo === "login" && (
            <div className="auth-seguranca">
              <div className="auth-seguranca-destaque">
                <div className="auth-seguranca-icone">
                  <ShieldCheck size={27} strokeWidth={2.1} />
                </div>
                <div>
                  <strong>Seus dados estão protegidos</strong>
                  <span>
                    Acesso autenticado e boas práticas de proteção da sua conta.
                  </span>
                </div>
              </div>

              <div className="auth-seguranca-itens" aria-label="Recursos de segurança">
                <span>
                  <LockKeyhole size={18} />
                  <small>Conexão segura<br />(SSL)</small>
                </span>
                <span>
                  <Database size={18} />
                  <small>Dados<br />protegidos</small>
                </span>
                <span>
                  <ShieldCheck size={18} />
                  <small>Privacidade<br />e LGPD</small>
                </span>
              </div>
            </div>
          )}

          <div className="auth-links">
            {modo === "login" ? (
              <p>
                Ainda não possui uma conta?{" "}
                <button type="button" onClick={() => trocarModo("cadastro")}>
                  Criar conta
                </button>
              </p>
            ) : (
              <button type="button" onClick={() => trocarModo("login")}>
                ← Voltar para o login
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
