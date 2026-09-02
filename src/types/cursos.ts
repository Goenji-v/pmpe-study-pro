import type { ConfiguracoesApp } from "./index";

export type AreaCapturaCurso = "conteudo" | "menu" | "cabecalho" | "rodape" | "desconhecida";

export type ItemCapturaCurso = {
  tipo: "titulo" | "cabecalho" | "link" | "texto";
  texto: string;
  href?: string;
  nivel?: number;
  tag?: string;
  role?: string;
  classes?: string;
  parentTag?: string;
  parentClasses?: string;
  containerKey?: string;
  area?: AreaCapturaCurso;
  top?: number;
  depth?: number;
};

export type CapturaCurso = {
  versao: 1 | 2;
  titulo?: string;
  urlOrigem?: string;
  capturadoEm?: string;
  itens: ItemCapturaCurso[];
};

export type CursoMaterial = {
  id: string;
  nome: string;
  tipo: "pdf" | "download" | "material" | "link";
  url: string;
};

export type CursoAula = {
  id: string;
  nome: string;
  url?: string;
  ordem: number;
  materiais?: CursoMaterial[];
  concluida?: boolean;
  concluidaEm?: string;
  /** Alias legado aceito durante a conversão para a árvore de conteúdos. */
  concluidoEm?: string;
};

export type CursoModulo = {
  id: string;
  nome: string;
  ordem: number;
  aulas: CursoAula[];
};

export type CursoMateria = {
  id: string;
  nome: string;
  ordem: number;
  modulos: CursoModulo[];
};

export type CursoImportado = {
  id: string;
  nome: string;
  origem: "html" | "mhtml" | "captura-json" | "texto";
  nomeArquivo?: string;
  urlOrigem?: string;
  criadoEm: string;
  atualizadoEm: string;
  materias: CursoMateria[];
};

export type ConfiguracoesCursosExtras = {
  cursos?: CursoImportado[];
  cursosAtivosIds?: string[];
};

export type ConfiguracoesComCursos = ConfiguracoesApp & ConfiguracoesCursosExtras;
