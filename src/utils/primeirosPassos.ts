export function deveExibirPrimeirosPassos({
  rota,
  totalAssuntos,
  ocultado,
}: {
  rota: string;
  totalAssuntos: number;
  ocultado: boolean;
}) {
  return rota === "/" && totalAssuntos === 0 && !ocultado;
}
