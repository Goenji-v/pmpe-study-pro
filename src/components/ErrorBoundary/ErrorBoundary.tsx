import { Component, type ErrorInfo, type ReactNode } from "react";

import "./ErrorBoundary.css";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
};

export default class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: "",
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Erro não tratado na interface:", error, info);
  }

  private recarregar = () => {
    window.location.reload();
  };

  private voltarAoInicio = () => {
    window.location.assign("/");
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="error-boundary">
        <section className="error-boundary-card">
          <span>ERRO DE INTERFACE</span>
          <h1>O site encontrou um problema inesperado</h1>
          <p>
            Seus dados salvos não foram apagados. Recarregue a página ou volte ao
            início para continuar.
          </p>

          {this.state.message && (
            <details>
              <summary>Detalhes técnicos</summary>
              <code>{this.state.message}</code>
            </details>
          )}

          <div className="error-boundary-acoes">
            <button type="button" onClick={this.recarregar}>
              Recarregar
            </button>
            <button type="button" onClick={this.voltarAoInicio}>
              Voltar ao início
            </button>
          </div>
        </section>
      </main>
    );
  }
}
