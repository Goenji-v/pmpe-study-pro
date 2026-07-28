export function salvar<T>(chave: string, dados: T): void {
  localStorage.setItem(chave, JSON.stringify(dados));
}

export function carregar<T>(chave: string, valorPadrao: T): T {
  try {
    const dados = localStorage.getItem(chave);

    if (!dados) return valorPadrao;

    return JSON.parse(dados);
  } catch {
    return valorPadrao;
  }
}

export function remover(chave: string): void {
  localStorage.removeItem(chave);
}

export function limparTudo() {
  localStorage.clear();
}