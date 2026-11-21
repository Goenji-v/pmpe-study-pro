const urlConfigurada =
  import.meta.env.VITE_API_URL?.trim();

// Isolated sync preview must not send authenticated requests to the production API.
// Until a separate staging backend exists, API-only features stay intentionally disabled.
if (
  import.meta.env.VITE_STUDY_PRO_STAGING_GUARD === "true" &&
  urlConfigurada !== "https://study-pro-staging-api.invalid"
) {
  throw new Error(
    "Prévia de testes bloqueada: API externa não isolada da produção."
  );
}

const fallbackProducao =
  "https://pmpe-study-pro-api.onrender.com";

const fallbackLocal =
  `http://${window.location.hostname}:3001`;

export const API_BASE_URL =
  urlConfigurada ||
  (import.meta.env.PROD
    ? fallbackProducao
    : fallbackLocal);

export function criarUrlApi(caminho: string) {
  const rota = caminho.startsWith("/")
    ? caminho
    : `/${caminho}`;

  return `${API_BASE_URL}${rota}`;
}
