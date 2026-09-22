import * as Sentry from "@sentry/react";

const sentryDsn = import.meta.env.VITE_SENTRY_DSN?.trim();

export function iniciarSentryFrontend() {
  if (!sentryDsn) return;

  Sentry.init({
    dsn: sentryDsn,
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
}
