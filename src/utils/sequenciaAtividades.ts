import type {
  RegistroQuestao,
  Revisao,
  SessaoEstudo,
  Simulado,
} from "../types";

type EntradaSequenciaAtividades = {
  sessoes: SessaoEstudo[];
  questoes: RegistroQuestao[];
  revisoes: Revisao[];
  simulados: Simulado[];
  agora?: Date;
};

/** Um dia estudado exige atividade realizada, sem mínimo arbitrário de minutos.
 * Datas civis antigas mantêm seu dia; timestamps usam o fuso local do aparelho.
 */
export function listarDiasEstudados(params: EntradaSequenciaAtividades): Set<string> {
  const agora = params.agora ?? new Date();
  const datas = new Set<string>();

  params.sessoes.forEach((item) => {
    if (positivo(item.minutos) || positivo(item.quantidadeQuestoes)) adicionarData(datas, item.data, agora);
  });
  params.questoes.forEach((item) => {
    if (positivo(item.minutos) || positivo(item.certas) || positivo(item.erradas)) adicionarData(datas, item.data, agora);
  });
  params.simulados.forEach((item) => {
    if (positivo(item.minutos) || positivo(item.certas) || positivo(item.erradas)) adicionarData(datas, item.data, agora);
  });
  params.revisoes.forEach((item) => {
    if (item.concluida && item.dataConclusao) {
      adicionarData(datas, item.dataConclusao, agora);
    }
  });
  return datas;
}

export function calcularSequenciaAtividades(params: EntradaSequenciaAtividades) {
  const agora = params.agora ?? new Date();
  const ordenadas = [...listarDiasEstudados({ ...params, agora })].sort();
  if (ordenadas.length === 0) {
    return { atual: 0, melhor: 0 };
  }

  let melhor = 1;
  let sequencia = 1;

  for (let indice = 1; indice < ordenadas.length; indice += 1) {
    if (diferencaEmDias(ordenadas[indice - 1], ordenadas[indice]) === 1) {
      sequencia += 1;
      melhor = Math.max(melhor, sequencia);
    } else {
      sequencia = 1;
    }
  }

  const hoje = obterDiaLocal(agora);
  const ontem = obterDiaLocal(adicionarDias(agora, -1));
  const ultima = ordenadas[ordenadas.length - 1];

  if (ultima !== hoje && ultima !== ontem) {
    return { atual: 0, melhor };
  }

  let atual = 1;
  for (let indice = ordenadas.length - 1; indice > 0; indice -= 1) {
    if (diferencaEmDias(ordenadas[indice - 1], ordenadas[indice]) !== 1) break;
    atual += 1;
  }

  return { atual, melhor };
}

function positivo(valor: number | undefined) {
  return Number.isFinite(valor) && Number(valor) > 0;
}

function adicionarData(destino: Set<string>, valor: string | undefined, agora: Date) {
  if (!valor) return;
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const dataCivil = inicioDaChave(valor);
    if (!Number.isNaN(dataCivil.getTime()) && dataCivil.toISOString().slice(0, 10) === valor && valor <= obterDiaLocal(agora)) {
      destino.add(valor);
    }
    return;
  }

  const data = new Date(valor);
  if (!Number.isNaN(data.getTime()) && data <= agora) {
    destino.add(obterDiaLocal(data));
  }
}

export function obterDiaLocal(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function adicionarDias(data: Date, dias: number) {
  const copia = new Date(data);
  copia.setDate(copia.getDate() + dias);
  return copia;
}

function diferencaEmDias(inicio: string, fim: string) {
  const a = inicioDaChave(inicio).getTime();
  const b = inicioDaChave(fim).getTime();
  return Math.round((b - a) / 86_400_000);
}

function inicioDaChave(chave: string) {
  const [ano, mes, dia] = chave.split("-").map(Number);
  // A distância entre dias civis não depende de dias de 23/25h no horário de verão.
  return new Date(Date.UTC(ano, mes - 1, dia));
}
