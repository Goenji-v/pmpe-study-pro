import * as Sentry from "@sentry/react";

const sentryDsn = import.meta.env.VITE_SENTRY_DSN?.trim();
const sentryTunnel = import.meta.env.PROD ? "/api/sentry-tunnel" : undefined;
let iniciado = false;

export function iniciarSentryFrontend() {
  if (!sentryDsn || iniciado) return;

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

export function capturarErroFrontend(
  erro: unknown,
  contexto: Record<string, string | number | boolean | undefined> = {}
) {
  if (!sentryDsn) return;

  Sentry.withScope((scope) => {
    for (const [chave, valor] of Object.entries(contexto)) {
      if (valor !== undefined) scope.setExtra(chave, valor);
    }

    Sentry.captureException(
      erro instanceof Error ? erro : new Error(String(erro))
    );
  });
}
