import "dotenv/config";
import * as Sentry from "@sentry/node";

const sentryDsn = process.env.SENTRY_DSN?.trim();

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment:
      process.env.SENTRY_ENVIRONMENT?.trim() ||
      process.env.NODE_ENV ||
      "production",
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });

  const testeEventId = Sentry.captureException(new Error("TESTE_SENTRY_API"));
  void Sentry.flush(5_000).then((enviado) => {
    console.info("[sentry] teste controlado", {
      nome: "TESTE_SENTRY_API",
      eventId: testeEventId,
      enviado,
    });
  });
}

export function capturarErroServidor(
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
