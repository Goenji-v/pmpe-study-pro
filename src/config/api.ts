const urlConfigurada =
  import.meta.env.VITE_API_URL?.trim();



const fallbackLocal =
  `http://${window.location.hostname}:3001`;

if (!urlConfigurada && !import.meta.env.DEV) {
  throw new Error("VITE_API_URL obrigatória no build hospedado.");
}

export const API_BASE_URL = urlConfigurada || fallbackLocal;

export function criarUrlApi(caminho: string) {
  const rota = caminho.startsWith("/")
    ? caminho
    : `/${caminho}`;

  return `${API_BASE_URL}${rota}`;
}
