/** Evita atualizar a aplicação enquanto a pessoa resolve uma prova ou escreve redação.
 * Ao sair da atividade, o verificador periódico aplica a versão nova normalmente.
 */
export function deveAdiarAtualizacaoAutomatica(pathname: string): boolean {
  const rota = pathname.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
  return rota === "/simulado-pdf" ||
    rota === "/resolver-simulado-ia/prova" ||
    rota.startsWith("/simulado-oficial/") ||
    rota === "/inteligencia" ||
    rota === "/central-estudos";
}
