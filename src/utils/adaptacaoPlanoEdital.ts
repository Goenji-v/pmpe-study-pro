import type { DiagnosticoSemanalPlano } from "./adaptacaoPlano";
import type {
  MissaoPlanoEdital,
  PlanoEdital,
} from "../types/editalInteligente";

export function adaptarPlanoEditalAoDesempenho(
  plano: PlanoEdital,
  diagnostico: DiagnosticoSemanalPlano,
  missoesConcluidas: string[]
): PlanoEdital {
  if (!diagnostico.possuiDados || plano.semanas.length <= 2) return plano;

  const concluidas = new Set(missoesConcluidas);
  const diagnosticos = new Map(
    diagnostico.materias.map((item) => [normalizar(item.materia), item])
  );

  const missoesFuturas = plano.semanas
    .filter((semana) => semana.numero > 2)
    .flatMap((semana) => semana.dias.flatMap((dia) => dia.missoes));

  const candidatas = missoesFuturas.filter(
    (missao) => !concluidas.has(missao.id)
  );

  if (candidatas.length < 2) return plano;

  const filas = new Map<string, MissaoPlanoEdital[]>();
  for (const missao of candidatas) {
    const chave = normalizar(missao.materia);
    const fila = filas.get(chave) ?? [];
    fila.push(missao);
    filas.set(chave, fila);
  }

  const novaOrdem: MissaoPlanoEdital[] = [];
  const ultimasMaterias: string[] = [];

  while (novaOrdem.length < candidatas.length) {
    const opcoes = Array.from(filas.entries()).filter(([, fila]) => fila.length > 0);
    if (opcoes.length === 0) break;

    opcoes.sort((a, b) => {
      const scoreB = scoreMateria(b[0], b[1].length, diagnosticos, ultimasMaterias);
      const scoreA = scoreMateria(a[0], a[1].length, diagnosticos, ultimasMaterias);
      return scoreB - scoreA || a[0].localeCompare(b[0], "pt-BR");
    });

    const [chaveEscolhida, filaEscolhida] = opcoes[0];
    const proxima = filaEscolhida.shift();
    if (!proxima) continue;

    novaOrdem.push(proxima);
    ultimasMaterias.push(chaveEscolhida);
    if (ultimasMaterias.length > 3) ultimasMaterias.shift();
  }

  let ponteiro = 0;

  return {
    ...plano,
    semanas: plano.semanas.map((semana) => {
      if (semana.numero <= 2) return semana;

      return {
        ...semana,
        dias: semana.dias.map((dia) => ({
          ...dia,
          missoes: dia.missoes.map((slot) => {
            if (concluidas.has(slot.id)) return slot;
            const conteudo = novaOrdem[ponteiro++];
            if (!conteudo) return slot;

            return {
              ...slot,
              materiaId: conteudo.materiaId,
              materia: conteudo.materia,
              assuntoId: conteudo.assuntoId,
              assunto: conteudo.assunto,
              prioridade: conteudo.prioridade,
            };
          }),
        })),
      };
    }),
  };
}

function scoreMateria(
  chave: string,
  quantidadeRestante: number,
  diagnosticos: Map<string, DiagnosticoSemanalPlano["materias"][number]>,
  ultimasMaterias: string[]
) {
  const dados = diagnosticos.get(chave);
  let score = dados?.prioridade ?? 35;

  if (dados?.percentualAcertos !== undefined) {
    if (dados.percentualAcertos < 50) score += 34;
    else if (dados.percentualAcertos < 60) score += 27;
    else if (dados.percentualAcertos < 75) score += 17;
    else if (dados.percentualAcertos >= 85) score -= 18;
  }

  if (dados) {
    score += Math.min(10, Math.round(dados.confianca / 10));
    score += Math.min(12, dados.revisoesAtrasadas * 5);
  }

  score += Math.min(8, quantidadeRestante);

  const ultima = ultimasMaterias.at(-1);
  const penultima = ultimasMaterias.at(-2);
  if (ultima === chave) score -= 65;
  else if (penultima === chave) score -= 24;

  return score;
}

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}
