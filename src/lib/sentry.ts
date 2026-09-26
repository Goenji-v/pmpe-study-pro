type SentryFrontend = typeof import("@sentry/react");

const sentryDsn = import.meta.env.VITE_SENTRY_DSN?.trim();
const sentryTunnel = import.meta.env.PROD ? "/api/sentry-tunnel" : undefined;

let iniciado = false;
let carregamentoSentry: Promise<SentryFrontend> | null = null;
let inicializacaoSentry: Promise<SentryFrontend | null> | null = null;

function carregarSentry() {
  carregamentoSentry ??= import("@sentry/react");
  return carregamentoSentry;
}

function garantirSentryIniciado() {
  if (!sentryDsn) return Promise.resolve<SentryFrontend | null>(null);

  inicializacaoSentry ??= carregarSentry()
    .then((Sentry) => {
      if (!iniciado) {
        Sentry.init({
          dsn: sentryDsn,
          tunnel: sentryTunnel,
          environment: import.meta.env.MODE,
          sendDefaultPii: false,
          tracesSampleRate: 0,
          ignoreErrors: [
            "Unable to preload CSS",
            "Failed to fetch dynamically imported module",
            "Importing a module script failed",
            "error loading dynamically imported module",
          ],
        });

        iniciado = true;
      }

      return Sentry;
    })
    .catch(() => {
      carregamentoSentry = null;
      inicializacaoSentry = null;
      return null;
    });

  return inicializacaoSentry;
}

export function iniciarSentryFrontend() {
  void garantirSentryIniciado();
}

export function capturarErroFrontend(
  erro: unknown,
  contexto: Record<string, string | number | boolean | undefined> = {}
) {
  if (!sentryDsn) return;

  void garantirSentryIniciado().then((Sentry) => {
    if (!Sentry) return;

    Sentry.withScope((scope) => {
      for (const [chave, valor] of Object.entries(contexto)) {
        if (valor !== undefined) scope.setExtra(chave, valor);
      }

      Sentry.captureException(
        erro instanceof Error ? erro : new Error(String(erro))
      );
    });
  });
}
