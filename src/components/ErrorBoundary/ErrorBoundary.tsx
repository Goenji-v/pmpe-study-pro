import { Component, Fragment, type ErrorInfo, type ReactNode } from "react";

import { registrarErroRuntime } from "../../services/seguranca/diagnosticoErroService";

import "./ErrorBoundary.css";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
  incidentId: string;
  tentativa: number;
};

export default class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: "",
    incidentId: "",
    tentativa: 0,
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      message: error.message,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Erro não tratado na interface:", error, info);

    const registro = registrarErroRuntime(
      new Error(
        `${error.message}\n${info.componentStack || ""}`
      ),
      "react-boundary"
    );

    this.setState({ incidentId: registro.id });
  }

  private tentarNovamente = () => {
    this.setState((estado) => ({
      hasError: false,
      message: "",
      incidentId: "",
      tentativa: estado.tentativa + 1,
    }));
  };

  private recarregar = () => {
    window.location.reload();
  };

  private voltarAoInicio = () => {
    window.location.assign("/");
  };

  render() {
    if (!this.state.hasError) {
      return (
        <Fragment key={this.state.tentativa}>
          {this.props.children}
        </Fragment>
      );
    }

    return (
      <main className="error-boundary">
        <section className="error-boundary-card">
          <span>PROTEÇÃO DE INTERFACE</span>
          <h1>Esta tela encontrou um problema</h1>
          <p>
            O Study Pro interrompeu apenas a interface que falhou. Seus dados de
            estudo e a fila de sincronização não foram apagados.
          </p>

          {this.state.incidentId && (
            <p className="error-boundary-incidente">
              Diagnóstico local: <strong>{this.state.incidentId}</strong>
            </p>
          )}

          {this.state.message && (
            <details>
              <summary>Detalhes técnicos</summary>
              <code>{this.state.message}</code>
            </details>
          )}

          <div className="error-boundary-acoes">
            <button type="button" onClick={this.tentarNovamente}>
              Tentar novamente
            </button>
            <button type="button" onClick={this.recarregar}>
              Recarregar página
            </button>
            <button type="button" onClick={this.voltarAoInicio}>
              Ir para o Dashboard
            </button>
          </div>
        </section>
      </main>
    );
  }
}
