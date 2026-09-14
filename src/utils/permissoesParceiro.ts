import type { PapelComercial } from "../services/parceriasService";

export type PermissoesParceiro = {
  podeAcessarArea: boolean;
  podeAcompanharAlunos: boolean;
  podeGerenciarPedagogico: boolean;
  podeGerenciarTurmas: boolean;
  podeGerenciarAlunos: boolean;
  podeGerenciarConvites: boolean;
  podeVerHistorico: boolean;
  podeVerFinanceiro: boolean;
};

export function obterPermissoesParceiro(
  papel: PapelComercial | null | undefined,
): PermissoesParceiro {
  const proprietario = papel === "proprietario";
  const gestor = papel === "gestor";
  const professor = papel === "professor";
  const parceiro = proprietario || gestor || professor;
  const operacional = proprietario || gestor;

  return {
    podeAcessarArea: parceiro,
    podeAcompanharAlunos: parceiro,
    podeGerenciarPedagogico: parceiro,
    podeGerenciarTurmas: operacional,
    podeGerenciarAlunos: operacional,
    podeGerenciarConvites: operacional,
    podeVerHistorico: operacional,
    podeVerFinanceiro: proprietario,
  };
}
