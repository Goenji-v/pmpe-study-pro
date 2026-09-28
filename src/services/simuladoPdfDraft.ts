export type RascunhoSimuladoPdf = {
  id: string;
  nome: string;
  totalQuestoes: number;
  caderno: File;
  comentado?: File | null;
  semana?: number;
  dia?: number;
  missaoId?: string;
};

let atual: RascunhoSimuladoPdf | null = null;

export function guardarRascunhoSimuladoPdf(valor: RascunhoSimuladoPdf) {
  atual = valor;
}

export function obterRascunhoSimuladoPdf() {
  return atual;
}

export function limparRascunhoSimuladoPdf() {
  atual = null;
}
