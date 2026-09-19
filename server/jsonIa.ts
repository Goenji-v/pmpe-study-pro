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
  const trecho = extrairPrimeiroJsonCompleto(limpo);
  const candidatosBrutos = [limpo, trecho]
    .filter((item): item is string => Boolean(item));
  const candidatos = Array.from(new Set(
    candidatosBrutos.flatMap((item) => [
      item,
      removerVirgulasFinais(item),
    ])
  ));

  let ultimoErro: unknown;

  for (const candidato of candidatos) {
    try {
      return JSON.parse(candidato) as unknown;
    } catch (erro) {
      ultimoErro = erro;
    }
  }

  throw new ErroJsonInvalidoIA(rotulo, ultimoErro);
}

function limparRespostaJson(texto: string) {
  return texto
    .replace(/^\uFEFF/, "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
}

function removerVirgulasFinais(texto: string) {
  let resultado = "";
  let dentroDeString = false;
  let escapado = false;

  for (let indice = 0; indice < texto.length; indice += 1) {
    const caractere = texto[indice];

    if (dentroDeString) {
      resultado += caractere;

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
      resultado += caractere;
      continue;
    }

    if (caractere === ",") {
      let proximo = indice + 1;
      while (proximo < texto.length && /\s/.test(texto[proximo])) {
        proximo += 1;
      }

      if (texto[proximo] === "}" || texto[proximo] === "]") {
        continue;
      }
    }

    resultado += caractere;
  }

  return resultado;
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
