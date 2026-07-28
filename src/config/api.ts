const urlConfigurada =
  import.meta.env.VITE_API_URL?.trim();

export const API_BASE_URL =
  urlConfigurada ||
  `http://${window.location.hostname}:3001`;

export function criarUrlApi(caminho: string) {
  const rota = caminho.startsWith("/")
    ? caminho
    : `/${caminho}`;

  return `${API_BASE_URL}${rota}`;
}
