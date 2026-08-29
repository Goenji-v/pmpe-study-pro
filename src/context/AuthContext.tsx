/* Contexto exporta Provider e hook intencionalmente no mesmo módulo. */
/* oxlint-disable react/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type {
  Session,
  User,
} from "@supabase/supabase-js";

import {
  supabase,
} from "../lib/supabase";

type AuthContextValue = {
  usuario: User | null;
  sessao: Session | null;
  carregando: boolean;

  entrar: (
    email: string,
    senha: string
  ) => Promise<void>;

  cadastrar: (
    nome: string,
    email: string,
    senha: string
  ) => Promise<{
    precisaConfirmarEmail: boolean;
  }>;

  recuperarSenha: (
    email: string
  ) => Promise<void>;

  sair: () => Promise<void>;
};

const AuthContext =
  createContext<
    AuthContextValue | undefined
  >(undefined);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [
    sessao,
    setSessao,
  ] = useState<Session | null>(
    null
  );

  const [
    carregando,
    setCarregando,
  ] = useState(true);

  useEffect(() => {
    let ativo = true;

    async function carregarSessao() {
      const {
        data,
        error,
      } =
        await supabase.auth.getSession();

      if (!ativo) {
        return;
      }

      if (error) {
        console.error(
          "Erro ao carregar sessão:",
          error
        );
      }

      setSessao(
        data.session
      );

      setCarregando(false);
    }

    carregarSessao();

    const {
      data: assinatura,
    } =
      supabase.auth.onAuthStateChange(
        (
          _evento,
          novaSessao
        ) => {
          if (!ativo) {
            return;
          }

          setSessao(
            novaSessao
          );

          setCarregando(false);
        }
      );

    return () => {
      ativo = false;

      assinatura.subscription
        .unsubscribe();
    };
  }, []);

  async function entrar(
    email: string,
    senha: string
  ) {
    const {
      error,
    } =
      await supabase.auth
        .signInWithPassword({
          email:
            email.trim(),
          password: senha,
        });

    if (error) {
      throw new Error(
        traduzirErro(
          error.message
        )
      );
    }
  }

  async function cadastrar(
    nome: string,
    email: string,
    senha: string
  ) {
    const {
      data,
      error,
    } =
      await supabase.auth.signUp({
        email:
          email.trim(),

        password:
          senha,

        options: {
          data: {
            nome:
              nome.trim(),
          },
        },
      });

    if (error) {
      throw new Error(
        traduzirErro(
          error.message
        )
      );
    }

    return {
      precisaConfirmarEmail:
        !data.session,
    };
  }

  async function recuperarSenha(
    email: string
  ) {
    const redirectTo =
      `${window.location.origin}/login`;

    const {
      error,
    } =
      await supabase.auth
        .resetPasswordForEmail(
          email.trim(),
          {
            redirectTo,
          }
        );

    if (error) {
      throw new Error(
        traduzirErro(
          error.message
        )
      );
    }
  }

  async function sair() {
    const {
      error,
    } =
      await supabase.auth.signOut();

    if (error) {
      throw new Error(
        traduzirErro(
          error.message
        )
      );
    }
  }

  const valor =
    useMemo(
      () => ({
        usuario:
          sessao?.user ??
          null,

        sessao,
        carregando,
        entrar,
        cadastrar,
        recuperarSenha,
        sair,
      }),
      [
        sessao,
        carregando,
      ]
    );

  return (
    <AuthContext.Provider
      value={valor}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const contexto =
    useContext(
      AuthContext
    );

  if (!contexto) {
    throw new Error(
      "useAuth precisa estar dentro de AuthProvider."
    );
  }

  return contexto;
}

function traduzirErro(
  mensagem: string
) {
  const texto =
    mensagem.toLowerCase();

  if (
    texto.includes(
      "invalid login credentials"
    )
  ) {
    return "E-mail ou senha incorretos.";
  }

  if (
    texto.includes(
      "email not confirmed"
    )
  ) {
    return "Confirme seu e-mail antes de entrar.";
  }

  if (
    texto.includes(
      "user already registered"
    )
  ) {
    return "Já existe uma conta com este e-mail.";
  }

  if (
    texto.includes(
      "password should be at least"
    )
  ) {
    return "A senha não atende ao tamanho mínimo.";
  }

  if (
    texto.includes(
      "unable to validate email address"
    )
  ) {
    return "Digite um e-mail válido.";
  }

  return mensagem;
}