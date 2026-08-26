import type { Materia } from "../types/index";
import {
  DIAS_SEMANA,
  type AnaliseEdital,
  type ConfiguracoesComEdital,
  type DiaPlanoEdital,
  type DiaSemanaId,
  type MateriaEdital,
  type PlanoEdital,
  type PrioridadeEdital,
  type SemanaPlanoEdital,
} from "../types/editalInteligente";

const ORDEM_PRIORIDADE: Record<PrioridadeEdital, number> = {
  alta: 3,
  media: 2,
  baixa: 1,
};

export function slugEdital(valor: string): string {
  const slug = valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "conteudo";
}

export function normalizarAnaliseEdital(
  analise: AnaliseEdital
): AnaliseEdital {
  const materias = (analise.materias ?? [])
    .map((materia, indiceMateria) => {
      const nomeMateria = String(materia.nome || "").trim();
      const assuntosVistos = new Set<string>();
      const assuntos = (materia.assuntos ?? [])
        .map((assunto, indiceAssunto) => {
          const nome = String(assunto.nome || "").trim();
          const chave = slugEdital(nome);
          if (!nome || assuntosVistos.has(chave)) return null;
          assuntosVistos.add(chave);

          const prioridade: PrioridadeEdital = ["alta", "media", "baixa"].includes(
            assunto.prioridade
          )
            ? assunto.prioridade
            : "media";

          return {
            ...assunto,
            id:
              assunto.id ||
              `edital-${slugEdital(nomeMateria)}-${slugEdital(nome)}-${indiceAssunto + 1}`,
            nome,
            prioridade,
            justificativaPrioridade: String(
              assunto.justificativaPrioridade || ""
            ).trim() || undefined,
          };
        })
        .filter(Boolean) as MateriaEdital["assuntos"];

      if (!nomeMateria || assuntos.length === 0) return null;

      return {
        ...materia,
        id:
          materia.id ||
          `edital-${slugEdital(nomeMateria)}-${indiceMateria + 1}`,
        nome: nomeMateria,
        incidenciaEstimada: Math.max(
          1,
          Math.min(5, Math.round(Number(materia.incidenciaEstimada) || 3))
        ),
        assuntos,
      };
    })
    .filter(Boolean) as MateriaEdital[];

  return {
    ...analise,
    concursoDetectado: String(analise.concursoDetectado || "Concurso").trim(),
    cargoDetectado: String(analise.cargoDetectado || "").trim() || undefined,
    bancaDetectada: String(analise.bancaDetectada || "").trim() || undefined,
    observacao: String(analise.observacao || "").trim() || undefined,
    materias,
    analisadoEm: analise.analisadoEm || new Date().toISOString(),
  };
}

export function destrincharAssuntoParaPlano(nomeOriginal: string): string[] {
  const nome = nomeOriginal.replace(/\s+/g, " ").trim();
  if (!nome) return [];

  const partesPorPontoEVirgula = nome
    .split(/\s*;\s*/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (
    partesPorPontoEVirgula.length >= 2 &&
    partesPorPontoEVirgula.length <= 12
  ) {
    return partesPorPontoEVirgula;
  }

  const parentese = nome.match(/^(.+?)\s*\(([^()]*)\)\s*$/);
  if (parentese) {
    const base = parentese[1].trim();
    const itens = parentese[2]
      .split(/\s*[,;]\s*/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (
      itens.length >= 4 &&
      itens.length <= 20 &&
      itens.every((item) => item.length <= 90)
    ) {
      const grupos: string[] = [];
      for (let indice = 0; indice < itens.length; indice += 2) {
        const grupo = itens.slice(indice, indice + 2);
        grupos.push(`${base} — ${formatarGrupo(grupo)}`);
      }
      return grupos;
    }
  }

  const doisPontos = nome.match(/^(.+?):\s*(.+)$/);
  if (doisPontos) {
    const base = doisPontos[1].trim();
    const itens = doisPontos[2]
      .split(/\s*[,;]\s*/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (
      itens.length >= 4 &&
      itens.length <= 20 &&
      itens.every((item) => item.length <= 90)
    ) {
      const grupos: string[] = [];
      for (let indice = 0; indice < itens.length; indice += 2) {
        const grupo = itens.slice(indice, indice + 2);
        grupos.push(`${base} — ${formatarGrupo(grupo)}`);
      }
      return grupos;
    }
  }

  return [nome];
}

export function gerarPlanoEdital(
  analiseOriginal: AnaliseEdital,
  configuracoes: ConfiguracoesComEdital
): PlanoEdital {
  const analise = normalizarAnaliseEdital(analiseOriginal);
  const diasEstudo = normalizarDias(configuracoes.diasEstudo);
  const materiasPorDia = Math.max(
    1,
    Math.min(4, Math.round(configuracoes.materiasPorDia ?? configuracoes.missoesPorDia ?? 1))
  );
  const minutosPorDia = Math.max(20, Math.round(configuracoes.metaMinutosDiaria || 60));
  const revisoesPorDia = Math.max(0, Math.round(configuracoes.metaRevisoesDiaria || 0));
  const metaQuestoesDia = Math.max(0, Math.round(configuracoes.metaQuestoesDiaria || 0));

  const filas = analise.materias
    .map((materia) => ({
      materia,
      conteudos: [...materia.assuntos]
        .sort((a, b) => {
          const prioridade = ORDEM_PRIORIDADE[b.prioridade] - ORDEM_PRIORIDADE[a.prioridade];
          return prioridade || a.nome.localeCompare(b.nome, "pt-BR");
        })
        .flatMap((assunto) => {
          const partes = destrincharAssuntoParaPlano(assunto.nome);
          return partes.map((nomePlano, indice) => ({
            assunto,
            nomePlano,
            assuntoId:
              partes.length > 1
                ? `${assunto.id}-parte-${indice + 1}`
                : assunto.id,
          }));
        }),
    }))
    .sort((a, b) => {
      const incidencia = b.materia.incidenciaEstimada - a.materia.incidenciaEstimada;
      return incidencia || a.materia.nome.localeCompare(b.materia.nome, "pt-BR");
    });

  const sequencia: Array<{
    materia: MateriaEdital;
    assunto: MateriaEdital["assuntos"][number];
    assuntoId: string;
    nomePlano: string;
  }> = [];

  while (filas.some((fila) => fila.conteudos.length > 0)) {
    filas.forEach((fila) => {
      const conteudo = fila.conteudos.shift();
      if (conteudo) {
        sequencia.push({
          materia: fila.materia,
          assunto: conteudo.assunto,
          assuntoId: conteudo.assuntoId,
          nomePlano: conteudo.nomePlano,
        });
      }
    });
  }

  const reservaRevisao = revisoesPorDia > 0
    ? Math.min(Math.round(minutosPorDia * 0.3), revisoesPorDia * 10)
    : 0;
  const minutosConteudo = Math.max(15, minutosPorDia - reservaRevisao);
  const totalSlotsSemana = diasEstudo.length * materiasPorDia;
  const totalSemanas = Math.max(1, Math.ceil(sequencia.length / totalSlotsSemana));
  const semanas: SemanaPlanoEdital[] = [];
  let ponteiro = 0;
  let ordemGlobal = 1;

  for (let semana = 1; semana <= totalSemanas; semana += 1) {
    const dias: DiaPlanoEdital[] = [];

    DIAS_SEMANA.forEach((diaCalendario) => {
      const diaSemana = diaCalendario.id;
      const ehDiaEstudo = diasEstudo.includes(diaSemana);
      const restantes = Math.max(0, sequencia.length - ponteiro);
      const quantidadeMissoes = ehDiaEstudo
        ? Math.min(materiasPorDia, restantes)
        : 0;
      const duracaoMissao = quantidadeMissoes > 0
        ? Math.max(10, Math.floor(minutosConteudo / quantidadeMissoes))
        : 0;
      const questoesMissao = quantidadeMissoes > 0
        ? Math.floor(metaQuestoesDia / quantidadeMissoes)
        : 0;

      const missoes = Array.from({ length: quantidadeMissoes }, () => {
        const item = sequencia[ponteiro++];
        const missao = {
          id: `edital-s${semana}-${diaSemana}-m${ordemGlobal}`,
          ordem: ordemGlobal,
          materiaId: item.materia.id,
          materia: item.materia.nome,
          assuntoId: item.assuntoId,
          assunto: item.nomePlano,
          prioridade: item.assunto.prioridade,
          duracaoMinutos: duracaoMissao,
          metaQuestoes: questoesMissao,
        };
        ordemGlobal += 1;
        return missao;
      });

      dias.push({
        id: `edital-s${semana}-${diaSemana}`,
        semana,
        diaSemana,
        nomeDia: diaCalendario.nome,
        minutosDisponiveis: ehDiaEstudo ? minutosPorDia : 0,
        revisoesPlanejadas: ehDiaEstudo ? revisoesPorDia : 0,
        missoes,
      });
    });

    semanas.push({ numero: semana, dias });
  }

  return {
    versao: 2,
    id: `plano-edital-${analise.analisadoEm}`,
    titulo: `Plano do edital - ${analise.concursoDetectado}`,
    geradoEm: new Date().toISOString(),
    totalAssuntos: sequencia.length,
    totalSemanas,
    diasEstudo,
    materiasPorDia,
    minutosPorDia,
    revisoesPorDia,
    semanas,
  };
}

export function mesclarMateriasDoEdital(
  atuais: Materia[],
  analiseOriginal: AnaliseEdital
): Materia[] {
  const analise = normalizarAnaliseEdital(analiseOriginal);
  const resultado = [...atuais];

  analise.materias.forEach((materiaEdital) => {
    const indiceMateria = resultado.findIndex(
      (materia) => slugEdital(materia.nome) === slugEdital(materiaEdital.nome)
    );

    const assuntosNovos = materiaEdital.assuntos.map((assunto) => ({
      id: assunto.id,
      nome: assunto.nome,
      concluido: false,
      prioridade: assunto.prioridade,
    }));

    if (indiceMateria < 0) {
      resultado.push({
        id: materiaEdital.id,
        nome: materiaEdital.nome,
        modulos: [
          {
            id: `${materiaEdital.id}-edital`,
            nome: "Conteúdo do edital",
            ordem: 1,
            assuntos: assuntosNovos,
          },
        ],
        assuntos: assuntosNovos,
      });
      return;
    }

    const atual = resultado[indiceMateria];
    const assuntosAtuais = atual.assuntos ?? [];
    const faltantes = assuntosNovos.filter(
      (novo) =>
        !assuntosAtuais.some(
          (existente) => slugEdital(existente.nome) === slugEdital(novo.nome)
        )
    );

    if (faltantes.length === 0) return;

    const modulos = [...(atual.modulos ?? [])];
    const indiceModuloEdital = modulos.findIndex(
      (modulo) => slugEdital(modulo.nome) === "conteudo-do-edital"
    );

    if (indiceModuloEdital >= 0) {
      modulos[indiceModuloEdital] = {
        ...modulos[indiceModuloEdital],
        assuntos: [...modulos[indiceModuloEdital].assuntos, ...faltantes],
      };
    } else {
      modulos.push({
        id: `${atual.id}-edital-importado`,
        nome: "Conteúdo do edital",
        ordem: modulos.length + 1,
        assuntos: faltantes,
      });
    }

    resultado[indiceMateria] = {
      ...atual,
      modulos,
      assuntos: [...assuntosAtuais, ...faltantes],
    };
  });

  return resultado.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

function normalizarDias(dias?: DiaSemanaId[]): DiaSemanaId[] {
  const validos = new Set(DIAS_SEMANA.map((dia) => dia.id));
  const recebidos = (dias ?? []).filter((dia) => validos.has(dia));
  const unicos = [...new Set(recebidos)];

  if (unicos.length === 0) {
    return ["seg", "ter", "qua", "qui", "sex", "sab"];
  }

  return DIAS_SEMANA.map((dia) => dia.id).filter((dia) => unicos.includes(dia));
}

function formatarGrupo(itens: string[]) {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens[0]} e ${itens[1]}`;
}
