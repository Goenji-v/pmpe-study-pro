export class ErroJsonInvalidoIA extends Error {
  rotulo: string;

  constructor(rotulo: string, causa?: unknown) {
    super(`A IA retornou JSON inválido ao ler ${rotulo}.`, {
      cause: causa,
    });
    this.name = "ErroJsonInvalidoIA";
    this.rotulo = rotulo;
  }
}

export function parsearJsonDaIA(texto: string, rotulo: string): unknown {
  const limpo = limparRespostaJson(texto);

  try {
    return JSON.parse(limpo) as unknown;
  } catch (erroDireto) {
    const trecho = extrairPrimeiroJsonCompleto(limpo);

    if (trecho && trecho !== limpo) {
      try {
        return JSON.parse(trecho) as unknown;
      } catch (erroTrecho) {
        throw new ErroJsonInvalidoIA(rotulo, erroTrecho);
      }
    }

    throw new ErroJsonInvalidoIA(rotulo, erroDireto);
  }
}

function limparRespostaJson(texto: string) {
  return texto
    .replace(/^\uFEFF/, "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
}

function extrairPrimeiroJsonCompleto(texto: string) {
  const inicioObjeto = texto.indexOf("{");
  const inicioLista = texto.indexOf("[");
  const inicios = [inicioObjeto, inicioLista].filter((indice) => indice >= 0);

  if (inicios.length === 0) return null;

  const inicio = Math.min(...inicios);
  const pilha: string[] = [];
  let dentroDeString = false;
  let escapado = false;

  for (let indice = inicio; indice < texto.length; indice += 1) {
    const caractere = texto[indice];

    if (dentroDeString) {
      if (escapado) {
        escapado = false;
      } else if (caractere === "\\") {
        escapado = true;
      } else if (caractere === '"') {
        dentroDeString = false;
      }

      continue;
    }

    if (caractere === '"') {
      dentroDeString = true;
      continue;
    }

    if (caractere === "{" || caractere === "[") {
      pilha.push(caractere === "{" ? "}" : "]");
      continue;
    }

    if (caractere === "}" || caractere === "]") {
      if (pilha.pop() !== caractere) return null;
      if (pilha.length === 0) return texto.slice(inicio, indice + 1);
    }
  }

  return null;
}
