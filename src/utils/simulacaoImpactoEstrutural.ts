import type { Assunto, Materia, Revisao, SessaoEstudo, RegistroQuestao } from "../types";
import {
  reconciliarQuestoesComConteudos,
  reconciliarRevisoesComConteudos,
  reconciliarSessoesComConteudos,
} from "../services/conteudos/sincronizacaoCanonica";
import type { CursoImportado } from "../types/cursos";
import type { AnaliseEdital } from "../types/editalInteligente";
import { listarAssuntosDaMateria } from "../services/conteudos/navegarConteudos";
import { aplicarCursosAtivosNasMaterias } from "./importacaoCurso";
import { planejarMigracaoEdital } from "./migracaoEdital";
import { mesclarMateriasDoEdital } from "./planoEdital";
import { identificarConteudoCatalogo } from "./catalogoAssuntosCentral";

/**
 * Executa em memória os MESMOS caminhos de grade utilizados em Meu Edital:
 * primeira importação e troca de edital. Não atualiza conta, revisões ou IDs.
 * Qualquer risco estrutural é motivo para bloquear a aplicação na prévia.
 */
export type AlertaImpactoImportacao = {
  tipo: "id-perdido" | "progresso" | "material" | "anotacao" | "aula" |
    "id-duplicado" | "reimportacao-instavel" | "assunto-duplicado" | "historico";
  assunto: string;
  detalhe: string;
  bloqueante: boolean;
};
export type ImpactoImportacaoEstrutural = {
  modalidade: "primeiro-edital" | "troca-de-edital";
  materiasAntes: number;
  materiasDepois: number;
  assuntosAntes: number;
  assuntosDepois: number;
  concluidosAntes: number;
  concluidosDepois: number;
  aulasAntes: number;
  aulasDepois: number;
  revisoesAntes: number;
  revisoesDepois: number;
  sessoesAntes: number;
  sessoesDepois: number;
  questoesAntes: number;
  questoesDepois: number;
  avisos: AlertaImpactoImportacao[];
  riscosBloqueantes: number;
  duplicacoesParaRevisar: number;
  seguroEstruturalmente: boolean;
  idempotente: boolean;
};

type Params = {
  materiasAtuais: readonly Materia[];
  novoEdital: AnaliseEdital;
  editalAnterior?: AnaliseEdital;
  cursos: readonly CursoImportado[];
  cursosAtivosIds: readonly string[];
  revisoes?: readonly Revisao[];
  sessoes?: readonly SessaoEstudo[];
  questoes?: readonly RegistroQuestao[];
};

function assuntos(materias: readonly Materia[]): Array<{materia: Materia; assunto: Assunto}> {
  return materias.flatMap((materia) =>
    listarAssuntosDaMateria(materia).map((assunto) => ({ materia, assunto }))
  );
}

function idsAssuntos(materias: readonly Materia[]): string[] {
  return assuntos(materias).map(({materia,assunto})=>materia.id+"::"+assunto.id).sort();
}

function snapshotAssuntos(materias: readonly Materia[]): string {
  return JSON.stringify(assuntos(materias)
    .map(({materia,assunto})=>({
      materia:materia.id, id:assunto.id,
      legados:[...(assunto.idsLegados??[])].sort(),
      concluido:assunto.concluido,
      aulas:(assunto.aulas??[]).map(a=>[a.id,a.url??"",Boolean(a.concluida)]).sort(),
      materiais:(assunto.materiais??[]).map(m=>[m.id,m.url??""]).sort(),
      pdf:assunto.pdf??"",
    }))
    .sort((a,b)=>(a.materia+"::"+a.id).localeCompare(b.materia+"::"+b.id)));
}

function montarGrade(params: Params): Materia[] {
  const base = structuredClone([...params.materiasAtuais]);
  const cursos = structuredClone([...params.cursos]);
  const ativos = [...params.cursosAtivosIds];
  const edital = structuredClone(params.novoEdital);
  if (params.editalAnterior) {
    return planejarMigracaoEdital({
      materiasAtuais:base,
      editalAnterior:structuredClone(params.editalAnterior),
      novoEdital:edital,
      cursos,
      cursosAtivosIds:ativos,
    }).materiasMigradas;
  }
  return aplicarCursosAtivosNasMaterias(
    mesclarMateriasDoEdital(base,edital),cursos,ativos,edital
  );
}

export function simularImpactoImportacaoEstrutural(params: Params): ImpactoImportacaoEstrutural {
  const antes = assuntos(params.materiasAtuais);
  const materiasResultantes = montarGrade(params);
  const depois = assuntos(materiasResultantes);
  const avisos: AlertaImpactoImportacao[] = [];
  const registrar = (
    tipo: AlertaImpactoImportacao["tipo"], assunto: string,
    detalhe: string, bloqueante = true
  ) => avisos.push({tipo,assunto,detalhe,bloqueante});

  // IDs legados preservam o histórico, mesmo quando há mudança de ID canônico.
  const idsNovos = new Map<string, Assunto[]>();
  for (const {assunto} of depois) {
    for (const id of [assunto.id,...(assunto.idsLegados??[])]) {
      idsNovos.set(id,[...(idsNovos.get(id)??[]),assunto]);
    }
  }

  for (const {materia,assunto} of antes) {
    const candidatos = idsNovos.get(assunto.id)??[];
    // Um mesmo ID antigo não pode apontar para dois destinos distintos.
    const destinos = [...new Set(candidatos.map(c=>c.id))];
    if (destinos.length > 1) {
      registrar("id-duplicado",assunto.nome,
        "ID original aponta para "+destinos.length+" assuntos: revisão manual obrigatória.");
    }
    const correspondente = candidatos.find(c=>c.id===assunto.id)??candidatos[0];
    if (!correspondente) {
      registrar("id-perdido",materia.nome+" · "+assunto.nome,
        "O importador não preservou o ID antigo nem o vinculou em idsLegados.");
      continue;
    }
    if (assunto.concluido && !correspondente.concluido) {
      registrar("progresso",materia.nome+" · "+assunto.nome,
        "O assunto estava concluído e passou a não concluído.");
    }
    if (assunto.pdf && assunto.pdf!==correspondente.pdf) {
      registrar("material",assunto.nome,"PDF legado não foi preservado.");
    }
    for (const chave of ["resumo","anotacoes","aula","questoes"] as const) {
      if (assunto[chave] && assunto[chave]!==correspondente[chave]) {
        registrar("anotacao",assunto.nome, "Campo anterior não preservado: "+chave);
      }
    }
    const materiaisFinais = new Set(
      (correspondente.materiais??[]).flatMap(m=>[m.id,m.url])
        .filter((x):x is string=>Boolean(x))
    );
    for (const material of assunto.materiais??[]) {
      if (!materiaisFinais.has(material.id) && !materiaisFinais.has(material.url)) {
        registrar("material",assunto.nome,"Material anterior ausente: "+material.nome);
      }
    }
    const aulasFinais = new Set(
      (correspondente.aulas??[]).flatMap(a=>[a.id,a.url])
        .filter((x):x is string=>Boolean(x))
    );
    for (const aula of assunto.aulas??[]) {
      if (!aulasFinais.has(aula.id) && (!aula.url || !aulasFinais.has(aula.url))) {
        registrar("aula",assunto.nome,"Aula anterior ausente: "+aula.nome);
      }
    }
  }

  // Estas são as mesmas três rotinas chamadas em aplicarPlano().
  // A verificação é feita em cópias, sem usar setState/backup/nuvem.
  const originaisRevisoes = [...(params.revisoes??[])];
  const originaisSessoes = [...(params.sessoes??[])];
  const originaisQuestoes = [...(params.questoes??[])];
  const revisoesMigradas = reconciliarRevisoesComConteudos(materiasResultantes,structuredClone(originaisRevisoes));
  const sessoesMigradas = reconciliarSessoesComConteudos(materiasResultantes,structuredClone(originaisSessoes));
  const questoesMigradas = reconciliarQuestoesComConteudos(materiasResultantes,structuredClone(originaisQuestoes));
  const conferirHistorico = <T extends {id:string}>(
    tipo: string, anteriores: readonly T[], posteriores: readonly T[],
    campos: readonly (keyof T)[]
  ) => {
    const porId = new Map(posteriores.map(item=>[item.id,item]));
    if (porId.size !== posteriores.length) {
      registrar("historico",tipo,"IDs repetidos após a conciliação.");
    }
    for (const item of anteriores) {
      const resultante=porId.get(item.id);
      if (!resultante) {
        registrar("historico",tipo+" · "+item.id,"Registro de histórico desapareceu.");
        continue;
      }
      if (campos.some(chave=>JSON.stringify(item[chave])!==JSON.stringify(resultante[chave]))) {
        registrar("historico",tipo+" · "+item.id,
          "Etapa, resultado ou data foi alterado sem pedido explícito.");
      }
    }
  };
  conferirHistorico("Revisão",originaisRevisoes,revisoesMigradas,
    ["etapa","concluida","dataPrevista","dataConclusao","desempenho","certas","erradas"]);
  conferirHistorico("Sessão",originaisSessoes,sessoesMigradas,
    ["minutos","data","conteudoConcluido","quantidadeAcertos","quantidadeErros","finalizadaEm"]);
  conferirHistorico("Questões",originaisQuestoes,questoesMigradas,
    ["certas","erradas","minutos","data"]);

  // Identidades pedagógicas repetidas merecem conferência, não fusão cega.
  // Não bloquear a mera existência de módulos/aulas distintas.
  const candidatosDuplicados = new Map<string, Array<{nome:string;id:string}>>();
  for (const {materia,assunto} of depois) {
    const item = identificarConteudoCatalogo(materia.nome,assunto.nome);
    if (item.tipo!=="subassunto" || item.idsSubassuntos.length!==1) continue;
    const chave = item.idsSubassuntos[0];
    candidatosDuplicados.set(chave,[
      ...(candidatosDuplicados.get(chave)??[]),{nome:assunto.nome,id:assunto.id}
    ]);
  }
  for (const [chave,lista] of candidatosDuplicados) {
    const idsUnicos = [...new Set(lista.map(x=>x.id))];
    if (idsUnicos.length > 1) {
      registrar("assunto-duplicado",chave,
        idsUnicos.length+" registros com o mesmo subassunto. Podem ser aulas legítimas: conferir antes de reunir.",
        false);
    }
  }

  const reimportada=montarGrade({...params,materiasAtuais:materiasResultantes});
  const idempotente =
    JSON.stringify(idsAssuntos(materiasResultantes))===
      JSON.stringify(idsAssuntos(reimportada)) &&
    snapshotAssuntos(materiasResultantes)===snapshotAssuntos(reimportada);
  if (!idempotente) registrar("reimportacao-instavel","Estrutura do edital",
    "Reaplicar o mesmo edital alterou IDs, aulas, materiais ou progresso.");

  const totalAulas=(lista:typeof antes)=>lista.reduce((n,x)=>n+(x.assunto.aulas?.length??0),0);
  const bloqueantes=avisos.filter(a=>a.bloqueante).length;
  return {
    modalidade:params.editalAnterior?"troca-de-edital":"primeiro-edital",
    materiasAntes:params.materiasAtuais.length,
    materiasDepois:materiasResultantes.length,
    assuntosAntes:antes.length,
    assuntosDepois:depois.length,
    concluidosAntes:antes.filter(x=>x.assunto.concluido).length,
    concluidosDepois:depois.filter(x=>x.assunto.concluido).length,
    aulasAntes:totalAulas(antes),
    aulasDepois:totalAulas(depois),
    revisoesAntes:originaisRevisoes.length,
    revisoesDepois:revisoesMigradas.length,
    sessoesAntes:originaisSessoes.length,
    sessoesDepois:sessoesMigradas.length,
    questoesAntes:originaisQuestoes.length,
    questoesDepois:questoesMigradas.length,
    avisos, riscosBloqueantes:bloqueantes,
    duplicacoesParaRevisar:avisos.filter(a=>a.tipo==="assunto-duplicado").length,
    seguroEstruturalmente:bloqueantes===0,
    idempotente,
  };
}
