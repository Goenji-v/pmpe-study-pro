export type RespostaGabarito = "A" | "B" | "C" | "D" | "E" | "X" | "N";
export type ParseGabarito = { respostas: Map<number, RespostaGabarito>; faltantes: number[]; duplicadas: number[]; invalidas: string[] };
const valido = /^[A-EXN]$/;
export function lerGabarito(texto: string, total: number): ParseGabarito {
  const respostas = new Map<number, RespostaGabarito>();
  const duplicadas: number[] = [];
  const invalidas: string[] = [];
  let proximo = 1;
  const normalizado = texto.toUpperCase().replace(/ANULAD[AO]S?/g, "X").replace(/EM BRANCO|BRANC[AO]/g, "N").replace(/(?:^|\s)[—–-](?=\s|$)/g, " N");
  const tokens = normalizado.match(/\d+\s*[-.):]?\s*[A-Z]+|[A-Z]+/g) ?? [];
  for (const token of tokens) {
    const achado = /^(\d+)\s*[-.):]?\s*([A-Z]+)$/.exec(token.trim());
    const numero = achado ? Number(achado[1]) : proximo;
    const letra = (achado ? achado[2] : token.trim()).toUpperCase();
    if (!valido.test(letra) || !Number.isInteger(numero) || numero < 1 || numero > total) { invalidas.push(token); continue; }
    if (respostas.has(numero)) duplicadas.push(numero);
    else respostas.set(numero, letra as RespostaGabarito);
    proximo = Math.max(proximo, numero + 1);
  }
  const faltantes = Array.from({ length: total }, (_, i) => i + 1).filter(n => !respostas.has(n));
  return { respostas, faltantes, duplicadas, invalidas };
}
export type FaixaMateria = { inicio: number; fim: number; materia: string };
export function calcularNotaLocal(oficial: Map<number, RespostaGabarito>, aluno: Map<number, RespostaGabarito>, total: number, faixas: FaixaMateria[] = [], excluirAnuladas = true) {
  const materias = new Map<string, { acertos: number; erros: number; brancos: number; anuladas: number; validas: number }>();
  for (let n = 1; n <= total; n++) {
    const materia = faixas.find(f => n >= f.inicio && n <= f.fim)?.materia || "Geral";
    const m = materias.get(materia) ?? { acertos: 0, erros: 0, brancos: 0, anuladas: 0, validas: 0 };
    const resposta = aluno.get(n);
    const gabarito = oficial.get(n);
    if (gabarito === "X") { m.anuladas++; if (!excluirAnuladas) { m.validas++; m.acertos++; } }
    else if (gabarito && gabarito !== "N") { m.validas++; if (!resposta || resposta === "N" || resposta === "X") m.brancos++; else if (resposta === gabarito) m.acertos++; else m.erros++; }
    materias.set(materia, m);
  }
  const detalhe = [...materias].map(([materia, m]) => ({ materia, ...m, percentual: m.validas ? 100 * m.acertos / m.validas : 0 }));
  const totais = detalhe.reduce((a, m) => ({ acertos: a.acertos + m.acertos, erros: a.erros + m.erros, brancos: a.brancos + m.brancos, anuladas: a.anuladas + m.anuladas, validas: a.validas + m.validas }), { acertos: 0, erros: 0, brancos: 0, anuladas: 0, validas: 0 });
  return { ...totais, percentual: totais.validas ? 100 * totais.acertos / totais.validas : 0, materias: detalhe };
}
