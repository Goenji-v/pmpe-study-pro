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
  Cloud,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

import "./Auth.css";

import {
  useAuth,
} from "../../context/AuthContext";

type Modo =
  | "login"
  | "cadastro"
  | "recuperar";

export default function Auth() {
  const {
    usuario,
    carregando,
    entrar,
    cadastrar,
    recuperarSenha,
  } = useAuth();

  const navigate =
    useNavigate();

  const location =
    useLocation();

  const [searchParams] = useSearchParams();
  const convite = searchParams.get("convite");

  const [
    modo,
    setModo,
  ] = useState<Modo>(
    searchParams.get("modo") === "cadastro" ? "cadastro" : "login"
  );

  const [
    nome,
    setNome,
  ] = useState("");

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    senha,
    setSenha,
  ] = useState("");

  const [
    confirmarSenha,
    setConfirmarSenha,
  ] = useState("");

  const [
    mostrarSenha,
    setMostrarSenha,
  ] = useState(false);

  const [
    mostrarConfirmarSenha,
    setMostrarConfirmarSenha,
  ] = useState(false);

  const [
    enviando,
    setEnviando,
  ] = useState(false);

  const [
    erro,
    setErro,
  ] = useState("");

  const [
    mensagem,
    setMensagem,
  ] = useState("");

  if (
    !carregando &&
    usuario
  ) {
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
        | {
            origem?: string;
          }
        | null
    )?.origem ?? (convite ? `/convite/${encodeURIComponent(convite)}` : "/");

  async function enviar(
    evento:
      FormEvent<HTMLFormElement>
  ) {
    evento.preventDefault();

    if (enviando) {
      return;
    }

    setErro("");
    setMensagem("");

    try {
      setEnviando(true);

      if (
        modo === "login"
      ) {
        validarEmailSenha();

        await entrar(
          email,
          senha
        );

        navigate(
          origem,
          {
            replace: true,
          }
        );

        return;
      }

      if (
        modo === "cadastro"
      ) {
        validarCadastro();

        const resultado =
          await cadastrar(
            nome,
            email,
            senha,
            convite ? `${window.location.origin}/convite/${encodeURIComponent(convite)}` : undefined
          );

        if (
          resultado
            .precisaConfirmarEmail
        ) {
          setMensagem(
            "Conta criada. Confira seu e-mail para confirmar o cadastro."
          );

          setModo(
            "login"
          );
        } else {
          navigate(
            origem,
            {
              replace: true,
            }
          );
        }

        return;
      }

      validarEmail();

      await recuperarSenha(
        email
      );

      setMensagem(
        "Enviamos as instruções de recuperação para seu e-mail."
      );
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
    if (
      !email.trim() ||
      !email.includes("@")
    ) {
      throw new Error(
        "Digite um e-mail válido."
      );
    }
  }

  function validarEmailSenha() {
    validarEmail();

    if (!senha) {
      throw new Error(
        "Digite sua senha."
      );
    }
  }

  function validarCadastro() {
    validarEmail();

    if (
      nome.trim().length <
      2
    ) {
      throw new Error(
        "Digite seu nome."
      );
    }

    if (
      senha.length < 6
    ) {
      throw new Error(
        "A senha precisa ter pelo menos 6 caracteres."
      );
    }

    if (
      senha !==
      confirmarSenha
    ) {
      throw new Error(
        "As senhas não coincidem."
      );
    }
  }

  function trocarModo(
    novoModo: Modo
  ) {
    setModo(
      novoModo
    );

    setErro("");
    setMensagem("");
    setSenha("");
    setConfirmarSenha("");
    setMostrarSenha(false);
    setMostrarConfirmarSenha(false);
  }

  return (
    <main className="auth-pagina">
      <section className="auth-apresentacao">
        <div className="auth-marca">
          <div className="auth-marca-simbolo" aria-hidden="true">
            SP
          </div>

          <span>
            <strong>
              PMPE Study Pro
            </strong>

            <small>
              Preparação tática
            </small>
          </span>
        </div>

        <div className="auth-chamada">
          <span>
            ESTUDO SINCRONIZADO
          </span>

          <h1>
            Seus dados <em>disponíveis</em> no
            computador e no celular.
          </h1>

          <p>
            Entre na sua conta para acessar
            estudos, sessões, questões, revisões,
            simulados e materiais em qualquer lugar.
          </p>
        </div>

        <div className="auth-beneficios">
          <article>
            <div className="auth-beneficio-icone">
              <Cloud size={22} strokeWidth={2.2} />
            </div>

            <div>
              <strong>
                Sincronização
              </strong>

              <span>
                Seus dados atualizados em todos os dispositivos.
              </span>
            </div>
          </article>

          <article>
            <div className="auth-beneficio-icone">
              <LockKeyhole size={22} strokeWidth={2.2} />
            </div>

            <div>
              <strong>
                Segurança
              </strong>

              <span>
                Cada conta acessa somente os próprios registros.
              </span>
            </div>
          </article>

          <article>
            <div className="auth-beneficio-icone">
              <TrendingUp size={22} strokeWidth={2.2} />
            </div>

            <div>
              <strong>
                Seu progresso
              </strong>

              <span>
                Acompanhe sua evolução e mantenha o foco no que importa.
              </span>
            </div>
          </article>
        </div>

        <p className="auth-frase">
          Disciplina hoje. Evolução todos os dias.
        </p>
      </section>

      <section className="auth-formulario-area">
        <div className="auth-formulario-card">
          <div className="auth-formulario-topo">
            <span>
              {modo === "login"
                ? "ACESSAR CONTA"
                : modo ===
                    "cadastro"
                  ? "CRIAR CONTA"
                  : "RECUPERAR ACESSO"}
            </span>

            <h2>
              {modo === "login"
                ? "Entrar"
                : modo ===
                    "cadastro"
                  ? "Cadastro"
                  : "Recuperar senha"}
            </h2>

            <p>
              {modo === "login"
                ? "Use seu e-mail e senha para continuar."
                : modo ===
                    "cadastro"
                  ? "Crie sua conta para manter seus dados sincronizados."
                  : "Informe o e-mail cadastrado para recuperar o acesso."}
            </p>
          </div>

          <form
            onSubmit={enviar}
            className="auth-formulario"
          >
            {modo ===
              "cadastro" && (
              <label>
                <span>
                  Nome
                </span>

                <input
                  type="text"
                  value={nome}
                  onChange={(
                    evento
                  ) =>
                    setNome(
                      evento.target
                        .value
                    )
                  }
                  autoComplete="name"
                  placeholder="Seu nome"
                />
              </label>
            )}

            <label>
              <span>
                E-mail
              </span>

              <input
                type="email"
                value={email}
                onChange={(
                  evento
                ) =>
                  setEmail(
                    evento.target
                      .value
                  )
                }
                autoComplete="email"
                placeholder="seuemail@exemplo.com"
              />
            </label>

            {modo !==
              "recuperar" && (
              <label>
                <span>
                  Senha
                </span>

                <div className="auth-input-senha">
                  <input
                    type={mostrarSenha ? "text" : "password"}
                    value={senha}
                    onChange={(
                      evento
                    ) =>
                      setSenha(
                        evento.target
                          .value
                      )
                    }
                    autoComplete={
                      modo ===
                      "cadastro"
                        ? "new-password"
                        : "current-password"
                    }
                    placeholder="Sua senha"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setMostrarSenha(
                        (valor) => !valor
                      )
                    }
                    aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                    title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {mostrarSenha
                      ? <EyeOff size={20} />
                      : <Eye size={20} />}
                  </button>
                </div>
              </label>
            )}

            {modo ===
              "cadastro" && (
              <label>
                <span>
                  Confirmar senha
                </span>

                <div className="auth-input-senha">
                  <input
                    type={mostrarConfirmarSenha ? "text" : "password"}
                    value={
                      confirmarSenha
                    }
                    onChange={(
                      evento
                    ) =>
                      setConfirmarSenha(
                        evento.target
                          .value
                      )
                    }
                    autoComplete="new-password"
                    placeholder="Repita a senha"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setMostrarConfirmarSenha(
                        (valor) => !valor
                      )
                    }
                    aria-label={mostrarConfirmarSenha ? "Ocultar confirmação da senha" : "Mostrar confirmação da senha"}
                    title={mostrarConfirmarSenha ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {mostrarConfirmarSenha
                      ? <EyeOff size={20} />
                      : <Eye size={20} />}
                  </button>
                </div>
              </label>
            )}

            {erro && (
              <div className="auth-erro">
                {erro}
              </div>
            )}

            {mensagem && (
              <div className="auth-sucesso">
                {mensagem}
              </div>
            )}

            <button
              type="submit"
              disabled={
                enviando
              }
              className="auth-submit"
            >
              {enviando
                ? "Aguarde..."
                : modo ===
                    "login"
                  ? "Entrar"
                  : modo ===
                      "cadastro"
                    ? "Criar conta"
                    : "Enviar instruções"}
            </button>
          </form>

          {modo !== "recuperar" && (
            <div className="auth-seguranca">
              <div className="auth-seguranca-destaque">
                <div className="auth-seguranca-icone">
                  <ShieldCheck size={25} strokeWidth={2.2} />
                </div>

                <div>
                  <strong>
                    Seus dados estão protegidos
                  </strong>

                  <span>
                    Acesso autenticado e boas práticas de proteção da sua conta.
                  </span>
                </div>
              </div>

              <div className="auth-seguranca-itens" aria-label="Recursos de segurança">
                <span>
                  <LockKeyhole size={15} />
                  Conexão segura
                </span>

                <span>
                  <ShieldCheck size={15} />
                  Acesso individual
                </span>
              </div>
            </div>
          )}

          <div className="auth-links">
            {modo ===
              "login" && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    trocarModo(
                      "recuperar"
                    )
                  }
                >
                  Esqueci minha senha
                </button>

                <p>
                  Ainda não possui conta?
                  {" "}
                  <button
                    type="button"
                    onClick={() =>
                      trocarModo(
                        "cadastro"
                      )
                    }
                  >
                    Criar conta
                  </button>
                </p>
              </>
            )}

            {modo !==
              "login" && (
              <button
                type="button"
                onClick={() =>
                  trocarModo(
                    "login"
                  )
                }
              >
                ← Voltar para o login
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
