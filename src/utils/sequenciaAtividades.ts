import type {
  RegistroQuestao,
  Revisao,
  SessaoEstudo,
  Simulado,
} from "../types";

export function calcularSequenciaAtividades(params: {
  sessoes: SessaoEstudo[];
  questoes: RegistroQuestao[];
  revisoes: Revisao[];
  simulados: Simulado[];
  agora?: Date;
}) {
  const datas = new Set<string>();

  params.sessoes.forEach((item) => adicionarData(datas, item.data));
  params.questoes.forEach((item) => adicionarData(datas, item.data));
  params.simulados.forEach((item) => adicionarData(datas, item.data));
  params.revisoes.forEach((item) => {
    if (item.concluida && item.dataConclusao) {
      adicionarData(datas, item.dataConclusao);
    }
  });

  const ordenadas = [...datas].sort();
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

  const hoje = chaveData(params.agora ?? new Date());
  const ontem = chaveData(adicionarDias(params.agora ?? new Date(), -1));
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

function adicionarData(destino: Set<string>, valor?: string) {
  if (!valor) return;
  const direta = valor.match(/^(\d{4}-\d{2}-\d{2})/);
  if (direta) {
    destino.add(direta[1]);
    return;
  }

  const data = new Date(valor);
  if (!Number.isNaN(data.getTime())) {
    destino.add(chaveData(data));
  }
}

function chaveData(data: Date) {
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
  return new Date(ano, mes - 1, dia, 0, 0, 0, 0);
}
