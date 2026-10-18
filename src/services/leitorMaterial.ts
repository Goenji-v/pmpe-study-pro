export type PedidoPdf = { id: string; nome: string; url: string };
export function ehLinkPdf(url: string) {
  return /\.pdf(?:[?#]|$)/i.test(url) || /^https:\/\/drive\.google\.com\/file\/d\//i.test(url);
}
export function abrirPdfInterno(pedido: PedidoPdf) {
  const url = new URL(pedido.url, window.location.href);
  if (!['http:', 'https:', 'blob:'].includes(url.protocol)) throw new Error('Endereço de PDF inválido.');
  window.dispatchEvent(new CustomEvent('study:abrir-pdf', { detail: { ...pedido, url: url.href } }));
}
