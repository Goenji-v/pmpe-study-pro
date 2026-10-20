import type { Assunto, Materia } from "../types";
import type { MaterialEstudo } from "../services/materiaisService";
import { listarModulosDaMateria } from "../services/conteudos/navegarConteudos";
import { chaveDaMateria } from "./desempenhoMaterias";

export type ReferenciaMaterial = {
  materia: string;
  materiaId?: string;
  idsLegadosMateria?: string[];
  modulo?: string;
  moduloId?: string;
  assunto?: string;
  assuntoId?: string;
  idsLegadosAssunto?: string[];
  materiaCatalogo?: Materia;
};

function normalizar(nome: string) {
  return nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

export function resolverAssuntoMaterial(assuntos: Assunto[], valor: string) {
  const porId = assuntos.find((assunto) => assunto.id === valor);
  if (porId) return { assunto: porId, ambiguo: false };
  const porNome = assuntos.filter((assunto) => normalizar(assunto.nome) === normalizar(valor));
  return { assunto: porNome.length === 1 ? porNome[0] : undefined, ambiguo: porNome.length > 1 };
}

export function materialCorrespondeMateria(material: ReferenciaMaterial, referencia: ReferenciaMaterial) {
  if (material.materiaId && referencia.materiaId) {
    return material.materiaId === referencia.materiaId || Boolean(referencia.idsLegadosMateria?.includes(material.materiaId));
  }
  return chaveDaMateria(material.materia) === chaveDaMateria(referencia.materia);
}

export function materialCorrespondeAssunto(material: ReferenciaMaterial, referencia: ReferenciaMaterial): boolean {
  if (!materialCorrespondeMateria(material, referencia)) return false;
  // Um ID explícito não pode ser substituído por um assunto homônimo. O ID
  // também continua válido quando o assunto muda de nome ou de módulo.
  if (material.assuntoId && referencia.assuntoId) {
    return material.assuntoId === referencia.assuntoId || Boolean(referencia.idsLegadosAssunto?.includes(material.assuntoId));
  }
  if (!material.assunto || !referencia.assunto || normalizar(material.assunto) !== normalizar(referencia.assunto)) return false;
  const mesmoModulo = material.moduloId && referencia.moduloId
    ? material.moduloId === referencia.moduloId
    : !referencia.modulo || normalizar(material.modulo || "Geral") === normalizar(referencia.modulo);
  if (!mesmoModulo) return false;
  if (referencia.materiaCatalogo && referencia.assuntoId) {
    const materia = referencia.materiaCatalogo;
    const candidatos = listarModulosDaMateria(materia).flatMap((modulo) => modulo.assuntos.filter((assunto) =>
      materialCorrespondeAssunto(material, {
        materia: materia.nome, materiaId: materia.id, idsLegadosMateria: materia.idsLegados,
        modulo: modulo.nome, moduloId: modulo.id, assunto: assunto.nome, assuntoId: assunto.id,
        idsLegadosAssunto: [...(assunto.idsLegados ?? []), ...(assunto.referenciasEdital ?? []), ...(assunto.origemEditalId ? [assunto.origemEditalId] : [])],
      })
    ));
    const ids = new Set(candidatos.map((assunto) => assunto.id));
    return ids.size === 1 && ids.has(referencia.assuntoId);
  }
  return true;
}

export function resolverMateriaMaterial(material: ReferenciaMaterial, materias: Materia[]) {
  const candidatas = materias.filter((materia) => materialCorrespondeMateria(material, {
    materia: materia.nome, materiaId: materia.id, idsLegadosMateria: materia.idsLegados,
  }));
  // Um registro legado só é associado pelo nome se a referência for inequívoca.
  return candidatas.length === 1 ? candidatas[0] : undefined;
}

type GrupoAssunto = { chave: string; nome: string; materiais: MaterialEstudo[] };
type GrupoModulo = { chave: string; nome: string; assuntos: GrupoAssunto[] };
type GrupoMateria = { chave: string; nome: string; modulos: GrupoModulo[] };

export function agruparMateriaisPorConteudo(materiais: MaterialEstudo[], materias: Materia[]): GrupoMateria[] {
  const grupos: GrupoMateria[] = [];
  for (const material of materiais) {
    const materia = resolverMateriaMaterial(material, materias);
    const chaveMateria = materia?.id || material.materiaId || `nome:${chaveDaMateria(material.materia)}`;
    let grupo = grupos.find((item) => item.chave === chaveMateria);
    if (!grupo) {
      grupo = { chave: chaveMateria, nome: materia?.nome || material.materia, modulos: [] };
      grupos.push(grupo);
    }
    const candidatos = materia ? listarModulosDaMateria(materia).flatMap((modulo) => modulo.assuntos
      .filter((assunto) => materialCorrespondeAssunto(material, {
        materia: materia.nome, materiaId: materia.id, idsLegadosMateria: materia.idsLegados,
        modulo: modulo.nome, moduloId: modulo.id, assunto: assunto.nome, assuntoId: assunto.id,
        idsLegadosAssunto: [...(assunto.idsLegados ?? []), ...(assunto.referenciasEdital ?? []), ...(assunto.origemEditalId ? [assunto.origemEditalId] : [])],
      })).map((assunto) => ({ modulo, assunto }))) : [];
    const atual = candidatos.length === 1 ? candidatos[0] : undefined;
    const chaveModulo = atual?.modulo.id || material.moduloId || `nome:${normalizar(material.modulo || "Geral")}`;
    let modulo = grupo.modulos.find((item) => item.chave === chaveModulo);
    if (!modulo) {
      modulo = { chave: chaveModulo, nome: atual?.modulo.nome || material.modulo || "Geral", assuntos: [] };
      grupo.modulos.push(modulo);
    }
    const chaveAssunto = atual?.assunto.id || material.assuntoId || `nome:${normalizar(material.assunto)}`;
    let assunto = modulo.assuntos.find((item) => item.chave === chaveAssunto);
    if (!assunto) {
      assunto = { chave: chaveAssunto, nome: atual?.assunto.nome || material.assunto, materiais: [] };
      modulo.assuntos.push(assunto);
    }
    assunto.materiais.push(material);
  }
  const ordenar = <T extends { nome: string }>(itens: T[]) => itens.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  for (const grupo of grupos) {
    ordenar(grupo.modulos);
    for (const modulo of grupo.modulos) ordenar(modulo.assuntos);
  }
  return ordenar(grupos);
}
