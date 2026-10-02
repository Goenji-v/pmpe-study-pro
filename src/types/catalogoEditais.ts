import type { AnaliseEdital } from "./editalInteligente";

export type GrupoCargoEditalCatalogo = "soldado" | "oficial" | "outro";
export type StatusEditalCatalogo = "rascunho" | "publicado" | "arquivado";

export type OpcoesEditalCatalogo = {
  idiomas?: string[];
  idiomaPadrao?: string;
};

export type EditalCatalogo = {
  id: string;
  slug: string;
  organizacao: string;
  nome: string;
  uf: string;
  ano: number;
  carreira: string;
  grupoCargo: GrupoCargoEditalCatalogo;
  cargo: string;
  codigoCargo?: string;
  banca?: string;
  fonteUrl?: string;
  pdfPath?: string;
  analise: AnaliseEdital;
  opcoes: OpcoesEditalCatalogo;
  status: StatusEditalCatalogo;
  destaque: boolean;
  ordem: number;
  origem: "sistema" | "admin";
};

export type NovoEditalCatalogo = {
  organizacao: string;
  nome: string;
  uf: string;
  ano: number;
  carreira: string;
  grupoCargo: GrupoCargoEditalCatalogo;
  cargo: string;
  codigoCargo?: string;
  banca?: string;
  fonteUrl?: string;
  analise: AnaliseEdital;
  opcoes?: OpcoesEditalCatalogo;
  publicar?: boolean;
};
