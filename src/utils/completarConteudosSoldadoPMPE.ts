import { CONTEUDOS_SOLDADO_PMPE, type DisciplinaRdc } from "../data/conteudosSoldadoPMPE";
import { criarIdModuloGeral } from "../services/conteudos/navegarConteudos";
import type { Assunto, AulaAssunto, Materia, Modulo } from "../types";
import type { ConfiguracoesCursosExtras } from "../types/cursos";
import type { ConfiguracoesEditalExtras } from "../types/editalInteligente";
import { textoIdentidadeCurso } from "./classificacaoCurso";
import { usaPlanoPadrao } from "./contaInicial";
import { gerarMateriasDoPlano } from "./materiasDoPlano";

const PREFIXO_MODULO = "soldado-pmpe-2026:";
const CURSO_RDC = "https://app.resumodoconcurseiro.com.br/m/g4uvgyi";

type ConfiguracaoGrade = Parameters<typeof usaPlanoPadrao>[0] &
  ConfiguracoesCursosExtras & ConfiguracoesEditalExtras;

export function moduloDoCatalogoSoldadoPMPE(id: string): boolean {
  return id.startsWith(PREFIXO_MODULO);
}

export function ehGradeSoldadoPMPE(config: ConfiguracaoGrade): boolean {
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

const materiasLegadas = gerarMateriasDoPlano();
const idsLegados = new Set(materiasLegadas.flatMap(materia => materia.assuntos.map(assunto => assunto.id)));
const idsModulosLegados = new Set(materiasLegadas.flatMap(materia => (materia.modulos ?? []).map(modulo => modulo.id)));

function disciplinaDaMateria(disciplina: DisciplinaRdc, materia: Materia) {
  const nome = textoIdentidadeCurso(materia.nome);
  return materia.id === disciplina.id ||
    [disciplina.nome, ...disciplina.aliases].some(alias => textoIdentidadeCurso(alias) === nome);
}

function topicoDaDisciplina(disciplina: DisciplinaRdc, assunto: Assunto) {
  return disciplina.assuntos.find(([chave, nome, , aliases = []]) =>
    assunto.id === idDoTopico(disciplina, chave) ||
    [nome, ...aliases].some(alias => textoIdentidadeCurso(alias) === textoIdentidadeCurso(assunto.nome))
  );
}

function idDoTopico(disciplina: DisciplinaRdc, chave: string) {
  return PREFIXO_MODULO + disciplina.id + ":assunto:" + chave;
}

export function assuntoDaTrilhaRdc(materia: Materia, assunto: Assunto) {
  return CONTEUDOS_SOLDADO_PMPE.some(disciplina =>
    disciplinaDaMateria(disciplina, materia) && topicoDaDisciplina(disciplina, assunto)
  );
}

function urlDaAula(disciplina: DisciplinaRdc, id: number, modulo?: number) {
  return CURSO_RDC + "/modulo/" + (modulo ?? disciplina.moduloRdc) + "?aula=" + id;
}

function atualizarAulas(
  assunto: Assunto,
  disciplina: DisciplinaRdc,
  topico: DisciplinaRdc["assuntos"][number],
  aulasImportadas: Map<string, AulaAssunto>
): Assunto {
  const [chave, tituloAtual, aulasRdc, titulosAnteriores = []] = topico;
  const idDoAssunto = idDoTopico(disciplina, chave);
  const aulasAtuais = assunto.aulas ?? [];
  // A trilha já cadastrada de Verbos tem quatro aulas reais. Mantém as quatro
  // como unidade de estudo e preserva IDs e tempo de cada aula.
  const verbosComQuatroAulas = disciplina.id === "portugues" && chave === "verbos" &&
    aulasAtuais.filter(aula => aula.url && !rdcPMPE(aula.url)).length === 4;
  const aulas = verbosComQuatroAulas ? aulasAtuais : [...aulasAtuais];
  let aulasAlteradas = false;
  if (!verbosComQuatroAulas) {
    for (const [id, titulo, modulo, titulosAntigosDaAula = []] of aulasRdc) {
      const url = urlDaAula(disciplina, id, modulo);
      const aulaId = idDoAssunto + ":aula:" + id;
      const indiceExistente = aulas.findIndex(aula => aula.url === url);
      if (indiceExistente >= 0) {
        const existente = aulas[indiceExistente];
        if (existente.id === aulaId && titulosAntigosDaAula.includes(existente.nome)) {
          aulas[indiceExistente] = { ...existente, nome: titulo };
          aulasAlteradas = true;
        }
        continue;
      }
      const progresso = aulasImportadas.get(url);
      aulas.push({
        ...progresso,
        id: aulaId,
        nome: titulo,
        url,
        origemCurso: undefined,
        ordem: aulas.length,
        concluida: progresso?.concluida ?? assunto.concluido,
        concluidaEm: progresso?.concluidaEm ?? assunto.concluidoEm,
      });
      aulasAlteradas = true;
    }
  }
  const nome = assunto.id === idDoAssunto && titulosAnteriores.includes(assunto.nome) ? tituloAtual : assunto.nome;
  if (!aulasAlteradas && nome === assunto.nome) return assunto;
  return { ...assunto, nome, aulas, aula: assunto.aula ?? aulas[0]?.url };
}

function candidatosDaDisciplina(materias: Materia[], disciplina: DisciplinaRdc) {
  return materias.filter(materia => disciplinaDaMateria(disciplina, materia));
}

function selecionarAssunto(materia: Materia, disciplina: DisciplinaRdc, topico: DisciplinaRdc["assuntos"][number]) {
  return modulosDaGrade(materia).flatMap(modulo => modulo.assuntos.map(assunto => ({ modulo, assunto })))
    .find(({ assunto }) => topicoDaDisciplina(disciplina, assunto) === topico);
}

export function completarConteudosSoldadoPMPE(materias: Materia[], config: ConfiguracaoGrade): Materia[] {
  if (!materias.length || !ehGradeSoldadoPMPE(config)) return materias;

  const resultado = [...materias];
  const aulasImportadas = new Map<string, AulaAssunto>();
  for (const materia of materias) {
    for (const modulo of modulosDaGrade(materia)) {
      for (const assunto of modulo.assuntos) {
        for (const aula of assunto.aulas ?? []) {
          if (aula.url && (!aulasImportadas.has(aula.url) || aula.concluida)) {
            aulasImportadas.set(aula.url, aula);
          }
        }
      }
    }
  }

  let mudou = false;
  for (const disciplina of CONTEUDOS_SOLDADO_PMPE) {
    const candidatas = candidatosDaDisciplina(resultado, disciplina);
    const atual = candidatas.find(materia => materia.id === disciplina.id) ?? candidatas[0];
    const originais = atual ? modulosDaGrade(atual) : [];
    const modulos: Modulo[] = [...originais];
    const moduloId = PREFIXO_MODULO + disciplina.id + ":rdc";
    const novoModulo: Modulo = { id: moduloId, nome: "Aulas do RDC", ordem: 0, assuntos: [] };

    for (const topico of disciplina.assuntos) {
      const [chave, nome] = topico;
      const existente = atual && selecionarAssunto(atual, disciplina, topico);
      const base: Assunto = existente?.assunto ?? {
        id: idDoTopico(disciplina, chave), nome, prioridade: "media", concluido: false,
      };
      const assunto = atualizarAulas(base, disciplina, topico, aulasImportadas);
      const destino = existente?.modulo.id ?? moduloId;
      const indice = modulos.findIndex(modulo => modulo.id === destino);
      if (indice < 0) {
        novoModulo.assuntos.push(assunto);
      } else if (assunto !== existente?.assunto) {
        const modulo = modulos[indice];
        const assuntos = existente
          ? modulo.assuntos.map(item => item.id === base.id ? assunto : item)
          : [...modulo.assuntos, assunto];
        modulos[indice] = { ...modulo, assuntos };
      }
    }

    if (novoModulo.assuntos.length) modulos.unshift(novoModulo);
    if (atual && modulos.every((modulo, indice) => modulo === originais[indice])) continue;

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

  return mudou ? resultado : materias;
}

// A aba exibe a trilha do curso. Os registros antigos continuam disponíveis
// para sessões, histórico, plano e migrações e nunca são apagados pela projeção.
export function exibirTrilhaRdcEmConteudos(materias: Materia[], config: ConfiguracaoGrade): Materia[] {
  if (!ehGradeSoldadoPMPE(config)) return materias;

  const disciplinas = CONTEUDOS_SOLDADO_PMPE.map(disciplina => ({
    disciplina,
    candidatas: candidatosDaDisciplina(materias, disciplina),
  }));
  const aulasDoCatalogo = new Set(CONTEUDOS_SOLDADO_PMPE.flatMap(disciplina =>
    disciplina.assuntos.flatMap(([, , aulas]) =>
      aulas.map(([id, , modulo]) => urlDaAula(disciplina, id, modulo))
    )
  ));

  return materias.flatMap(materia => {
    const entrada = disciplinas.find(({ candidatas }) => candidatas.includes(materia));
    const modulos = modulosDaGrade(materia);
    const titulosSelecionados = new Map<string, string>();
    if (entrada) {
      const { disciplina, candidatas } = entrada;
      const principal = candidatas.find(item => item.id === disciplina.id) ?? candidatas[0];
      if (principal === materia) {
        for (const topico of disciplina.assuntos) {
          const selecionado = selecionarAssunto(materia, disciplina, topico);
          if (selecionado) titulosSelecionados.set(selecionado.assunto.id, topico[1]);
        }
      }
    }

    const visiveis = modulos.flatMap(modulo => {
      const assuntos = modulo.assuntos.filter(assunto => {
        if (titulosSelecionados.has(assunto.id)) return true;
        if (assuntoDaTrilhaRdc(materia, assunto)) return false;
        if (idsLegados.has(assunto.id) || moduloDoCatalogoSoldadoPMPE(assunto.id) || assunto.origemEditalId) return false;
        const urls = [assunto.aula, ...(assunto.aulas ?? []).map(aula => aula.url)];
        return !urls.some(url => url && aulasDoCatalogo.has(url));
      });
      if (assuntos.length === 0 && (modulo.assuntos.length > 0 || idsModulosLegados.has(modulo.id) ||
          moduloDoCatalogoSoldadoPMPE(modulo.id))) return [];
      return [{ ...modulo, assuntos: assuntos.map(assunto => {
        const nome = titulosSelecionados.get(assunto.id);
        return nome && idsLegados.has(assunto.id) ? { ...assunto, nome } : assunto;
      }) }];
    });
    return visiveis.length ? [{ ...materia, modulos: visiveis, assuntos: visiveis.flatMap(modulo => modulo.assuntos) }] : [];
  });
}
