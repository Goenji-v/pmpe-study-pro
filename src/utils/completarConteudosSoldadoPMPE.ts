import { CONTEUDOS_SOLDADO_PMPE } from "../data/conteudosSoldadoPMPE";
import { criarIdModuloGeral } from "../services/conteudos/navegarConteudos";
import type { Assunto, Materia } from "../types";
import type { ConfiguracoesCursosExtras } from "../types/cursos";
import type { ConfiguracoesEditalExtras } from "../types/editalInteligente";
import { textoIdentidadeCurso } from "./classificacaoCurso";
import { usaPlanoPadrao } from "./contaInicial";

const PREFIXO_MODULO = "soldado-pmpe-2026:";
const CURSO_RDC = "https://app.resumodoconcurseiro.com.br/m/g4uvgyi";

type ConfiguracaoGrade = Parameters<typeof usaPlanoPadrao>[0] &
  ConfiguracoesCursosExtras & ConfiguracoesEditalExtras;

export function moduloDoCatalogoSoldadoPMPE(id: string): boolean {
  return id.startsWith(PREFIXO_MODULO);
}

function ehGradeSoldadoPMPE(config: ConfiguracaoGrade): boolean {
  const edital = config.editalAtivo;
  if (edital) {
    if (edital.catalogoId === "sistema-pmpe-2026-soldado") return true;
    const concurso = textoIdentidadeCurso(edital.analise.concursoDetectado ?? "");
    const cargo = textoIdentidadeCurso(edital.analise.cargoDetectado ?? "");
    return /\b(policia militar de pernambuco|pmpe)\b/.test(concurso) &&
      /\bsoldado\b/.test(cargo) &&
      (edital.fonteUrl === "https://www.institutoaocp.org.br/concursos/714" ||
        /\b2026\b/.test(textoIdentidadeCurso(edital.nomeArquivo)));
  }

  return usaPlanoPadrao(config) || Boolean(config.cursos?.some(curso =>
    config.cursosAtivosIds?.includes(curso.id) &&
    (rdcPMPE(curso.urlOrigem) || curso.materias.some(materia =>
      rdcPMPE(materia.origemUrl) || materia.modulos.some(modulo =>
        modulo.aulas.some(aula => rdcPMPE(aula.url))
      )
    ))
  ));
}

function rdcPMPE(url?: string): boolean {
  return url === CURSO_RDC || Boolean(url?.startsWith(CURSO_RDC + "/")) ||
    Boolean(url?.startsWith("https://areadoaluno.resumodoconcurseiro.com.br/courses/pmpe-"));
}

function modulosDaGrade(materia: Materia) {
  return materia.modulos?.length ? materia.modulos : [{
    id: criarIdModuloGeral(materia.id),
    nome: "Geral",
    ordem: 0,
    assuntos: materia.assuntos,
  }];
}

function referenciasDoTopico(disciplina: typeof CONTEUDOS_SOLDADO_PMPE[number], topico: typeof disciplina.modulos[number]["topicos"][number]) {
  const id = PREFIXO_MODULO + disciplina.id + ":assunto:" + topico.chave;
  const aulas = topico.aulas?.map(([aulaId, nome, moduloRdc], ordem) => ({
    id: id + ":aula:" + aulaId,
    nome,
    ordem,
    concluida: false,
    url: CURSO_RDC + "/modulo/" + (moduloRdc ?? disciplina.moduloRdc) + "?aula=" + aulaId,
  }));
  return {
    id,
    aulas,
    aula: aulas?.[0]?.url,
    resumo: topico.resumo,
    material: topico.fonte ? {
      id: id + ":fonte",
      nome: topico.fonte[0],
      url: topico.fonte[1],
      tipo: "link" as const,
      criadoEm: "2026-11-26T00:00:00.000Z",
    } : undefined,
  };
}

function preencherRecursos(assunto: Assunto, referencia: ReturnType<typeof referenciasDoTopico>): Assunto {
  const { aula, aulas, material, resumo } = referencia;
  const podeVincularAulas = Boolean(aula && !assunto.aula && !assunto.aulas?.length);
  const podeAnexarMaterial = material && !assunto.materiais?.some(item => item.url === material.url);
  const podePreencherResumo = resumo && !assunto.resumo;
  if (!podeVincularAulas && !podeAnexarMaterial && !podePreencherResumo) return assunto;

  return {
    ...assunto,
    ...(podeVincularAulas ? { aula, aulas } : {}),
    ...(podePreencherResumo ? { resumo } : {}),
    ...(podeAnexarMaterial ? { materiais: [...(assunto.materiais ?? []), material] } : {}),
  };
}

/** Preenche lacunas no catálogo PMPE sem recriar as entradas existentes. */
export function completarConteudosSoldadoPMPE(
  materias: Materia[],
  config: ConfiguracaoGrade
): Materia[] {
  if (!materias.length || !ehGradeSoldadoPMPE(config)) return materias;

  const resultado = [...materias];
  let mudou = false;

  for (const disciplina of CONTEUDOS_SOLDADO_PMPE) {
    const nomesDisciplina = [disciplina.nome, ...disciplina.aliases].map(textoIdentidadeCurso);
    const equivalentes = resultado.filter(materia =>
      materia.id === disciplina.id || nomesDisciplina.includes(textoIdentidadeCurso(materia.nome))
    );
    const atual = equivalentes.find(materia => materia.id === disciplina.id) ?? equivalentes[0];
    const modulos = atual ? [...modulosDaGrade(atual)] : [];
    const existentes = equivalentes.flatMap(materia => modulosDaGrade(materia).flatMap(modulo => modulo.assuntos));
    // O edital agrupa DH e Legislação. Busque nessa disciplina também para
    // preservar os tópicos já preenchidos, mesmo com a trilha do RDC separada.
    const combinado = ["direitos-humanos", "leis-extravagantes"].includes(disciplina.id)
      ? resultado.filter(materia => textoIdentidadeCurso(materia.nome) === "direitos humanos e legislacao extravagante")
      : [];
    const nomes = new Set([...existentes, ...combinado.flatMap(materia =>
      modulosDaGrade(materia).flatMap(modulo => modulo.assuntos)
    )].map(assunto => textoIdentidadeCurso(assunto.nome)));
    const ids = new Set(existentes.map(assunto => assunto.id));

    for (const grupo of disciplina.modulos) {
      const moduloId = PREFIXO_MODULO + disciplina.id + ":" + grupo.id;
      const insercoes: Assunto[] = [];
      for (const topico of grupo.topicos) {
        const { id, aulas, aula, resumo, material } = referenciasDoTopico(disciplina, topico);
        const aliases = [topico.nome, ...(topico.aliases ?? [])].map(textoIdentidadeCurso);
        if (ids.has(id) || aliases.some(nome => nomes.has(nome))) continue;

        insercoes.push({
          id,
          nome: topico.nome,
          prioridade: "media",
          concluido: false,
          resumo,
          aulas,
          aula,
          materiais: material ? [material] : undefined,
        });
        nomes.add(textoIdentidadeCurso(topico.nome));
      }

      if (insercoes.length === 0) continue;
      const indice = modulos.findIndex(modulo => modulo.id === moduloId);
      if (indice >= 0) {
        const modulo = modulos[indice];
        modulos[indice] = { ...modulo, assuntos: [...modulo.assuntos, ...insercoes] };
      } else {
        const ordem = Math.max(-1, ...modulos.map(modulo => modulo.ordem)) + 1;
        modulos.push({ id: moduloId, nome: grupo.nome, ordem, assuntos: insercoes });
      }
    }

    if (modulos.length === 0 || (atual && modulos.every((modulo, indice) => modulo === atual.modulos?.[indice]))) continue;

    const materia = {
      ...atual,
      id: atual?.id ?? disciplina.id,
      nome: atual?.nome ?? disciplina.nome,
      modulos,
      assuntos: modulos.flatMap(modulo => modulo.assuntos),
    };
    if (atual) resultado[resultado.indexOf(atual)] = materia;
    else resultado.push(materia);
    mudou = true;
  }

  // Algumas grades já têm o nome do edital, ainda sem aula ou material.
  // Atualize esses registros pelo nome exato ou alias curado, mantendo os IDs.
  for (const [indice, materia] of resultado.entries()) {
    const nomeMateria = textoIdentidadeCurso(materia.nome);
    const disciplinas = CONTEUDOS_SOLDADO_PMPE.filter(disciplina =>
      materia.id === disciplina.id ||
      [disciplina.nome, ...disciplina.aliases].some(nome => textoIdentidadeCurso(nome) === nomeMateria) ||
      (nomeMateria === "direitos humanos e legislacao extravagante" &&
        ["direitos-humanos", "leis-extravagantes"].includes(disciplina.id))
    );
    if (!disciplinas.length) continue;

    const referencias = new Map<string, ReturnType<typeof referenciasDoTopico>>();
    for (const disciplina of disciplinas) {
      for (const topico of disciplina.modulos.flatMap(modulo => modulo.topicos)) {
        const referencia = referenciasDoTopico(disciplina, topico);
        for (const nome of [topico.nome, ...(topico.aliases ?? [])]) {
          referencias.set(textoIdentidadeCurso(nome), referencia);
        }
      }
    }

    const originais = modulosDaGrade(materia);
    const modulos = originais.map(modulo => {
      const assuntos = modulo.assuntos.map(assunto => {
        const referencia = referencias.get(textoIdentidadeCurso(assunto.nome));
        return referencia ? preencherRecursos(assunto, referencia) : assunto;
      });
      return assuntos.some((assunto, posicao) => assunto !== modulo.assuntos[posicao])
        ? { ...modulo, assuntos }
        : modulo;
    });
    if (modulos.every((modulo, posicao) => modulo === originais[posicao])) continue;

    resultado[indice] = { ...materia, modulos, assuntos: modulos.flatMap(modulo => modulo.assuntos) };
    mudou = true;
  }

  return mudou ? resultado : materias;
}
