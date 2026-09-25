import React from "react";
import { capturarErroFrontend } from "../lib/sentry";

type Props = {
  children: React.ReactNode;
};

type State = {
  falhou: boolean;
};

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { falhou: false };

  static getDerivedStateFromError(): State {
    return { falhou: true };
  }

  componentDidCatch(erro: Error, info: React.ErrorInfo) {
    console.error("Erro fatal capturado na interface do Study Pro.", {
      erro,
      componentStack: info.componentStack,
    });
    capturarErroFrontend(erro, {
      area: "react-error-boundary",
      componentStack: info.componentStack || undefined,
    });
  }

  private recarregar = () => {
    window.location.reload();
  };

  private voltarAoLogin = () => {
    window.location.assign("/login");
  };

  render() {
    if (!this.state.falhou) return this.props.children;

    return (
      <main
        role="alert"
        aria-live="assertive"
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "#0b1020",
          color: "#f8fafc",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <section
          style={{
            width: "min(520px, 100%)",
            padding: "28px",
            borderRadius: "20px",
            background: "rgba(15, 23, 42, 0.96)",
            border: "1px solid rgba(148, 163, 184, 0.24)",
            boxShadow: "0 24px 60px rgba(0, 0, 0, 0.35)",
          }}
        >
          <p
            style={{
              margin: "0 0 8px",
              fontSize: "13px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#94a3b8",
            }}
          >
            Study Pro
          </p>

          <h1
            style={{
              margin: "0 0 12px",
              fontSize: "clamp(24px, 5vw, 34px)",
              lineHeight: 1.1,
            }}
          >
            Não conseguimos carregar esta tela
          </h1>

          <p
            style={{
              margin: "0 0 24px",
              lineHeight: 1.6,
              color: "#cbd5e1",
            }}
          >
            Seus dados não foram apagados. Tente recarregar a página. Se o
            problema continuar, volte ao login e entre novamente.
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <button
              type="button"
              onClick={this.recarregar}
              style={{
                border: 0,
                borderRadius: "12px",
                padding: "12px 18px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Recarregar
            </button>

            <button
              type="button"
              onClick={this.voltarAoLogin}
              style={{
                borderRadius: "12px",
                padding: "12px 18px",
                fontWeight: 700,
                cursor: "pointer",
                background: "transparent",
                color: "#f8fafc",
                border: "1px solid rgba(148, 163, 184, 0.4)",
              }}
            >
              Voltar ao login
            </button>
          </div>
        </section>
      </main>
    );
  }
}
