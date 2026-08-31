import {
  useState,
  type FormEvent,
} from "react";

import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

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

  const [
    modo,
    setModo,
  ] = useState<Modo>(
    "login"
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
        to="/"
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
    )?.origem ?? "/";

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
            senha
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
            "/",
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
  }

  return (
    <main className="auth-pagina">
      <section className="auth-apresentacao">
        <div className="auth-marca">
          <div>
            PM
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
            Seus dados disponíveis no
            computador e no celular.
          </h1>

          <p>
            Entre na sua conta para
            acessar estudos, sessões,
            questões, revisões, simulados
            e materiais.
          </p>
        </div>

        <div className="auth-beneficios">
          <div>
            <strong>
              ☁️ Sincronização
            </strong>

            <span>
              Mesmos dados em todos os
              dispositivos.
            </span>
          </div>

          <div>
            <strong>
              🔒 Segurança
            </strong>

            <span>
              Cada conta acessa somente os
              próprios registros.
            </span>
          </div>

          <div>
            <strong>
              💾 Proteção
            </strong>

            <span>
              Base preparada para backup
              automático.
            </span>
          </div>
        </div>
      </section>

      <section className="auth-formulario-area">
        <div className="auth-formulario-card">
          <div className="auth-beta-linha">
            <span>BETA ABERTA</span>
            <small>Teste gratuito durante a fase beta</small>
          </div>

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
                ? "Use seu e-mail e senha."
                : modo ===
                    "cadastro"
                  ? "Crie sua conta para sincronizar os dados."
                  : "Informe o e-mail da conta."}
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

                <input
                  type="password"
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
              </label>
            )}

            {modo ===
              "cadastro" && (
              <label>
                <span>
                  Confirmar senha
                </span>

                <input
                  type="password"
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

          {modo === "login" && (
            <div className="auth-demo-area">
              <div className="auth-demo-divisor">
                <span>ou</span>
              </div>

              <Link
                to="/demo"
                className="auth-demo-link"
              >
                <strong>Explorar demonstração</strong>
                <small>Sem cadastro · dados fictícios · não altera sua conta</small>
              </Link>
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
