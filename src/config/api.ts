const urlConfigurada =
  import.meta.env.VITE_API_URL?.trim();

const fallbackProducao =
  "https://pmpe-study-pro-api.onrender.com";

const fallbackStaging =
  "https://pmpe-study-pro-api-staging.onrender.com";

const fallbackLocal =
  `http://${window.location.hostname}:3001`;

const previewCentralGeracoes =
  window.location.hostname.includes(
    "git-feat-central-geracoes"
  );

export const API_BASE_URL =
  previewCentralGeracoes
    ? fallbackStaging
    : urlConfigurada ||
      (import.meta.env.PROD
        ? fallbackProducao
        : fallbackLocal);

export function criarUrlApi(caminho: string) {
  const rota = caminho.startsWith("/")
    ? caminho
    : `/${caminho}`;

  return `${API_BASE_URL}${rota}`;
}
