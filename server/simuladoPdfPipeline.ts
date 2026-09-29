export type IntervaloPipelineSimulado = {
  inicio: number;
  fim: number;
  numerosEspecificos?: number[];
};

export type EstadoPipelineSimulado = {
  numero: number;
};

export type CheckpointPipelineSimulado<T extends EstadoPipelineSimulado> = {
  progresso: number;
  descricao: string;
  itens: T[];
  fase: "extraindo" | "resolvendo";
};

export async function executarPipelineQuestaoAPorQuestao<
  T extends EstadoPipelineSimulado,
>(args: {
  totalQuestoes: number;
  estadoAnterior?: T[];
  temExtracao: (item: T | undefined) => boolean;
  estaPronta: (item: T | undefined) => boolean;
  extrair: (
    numeros: number[]
  ) => Promise<T[]>;
  resolver: (
    item: T
  ) => Promise<T>;
  salvar: (
    checkpoint: CheckpointPipelineSimulado<T>
  ) => Promise<void>;
}) {
  const total = Math.max(0, Math.round(args.totalQuestoes));
  const porNumero = new Map<number, T>();

  for (const item of args.estadoAnterior ?? []) {
    const numero = Number(item?.numero);
    if (
      Number.isInteger(numero) &&
      numero >= 1 &&
      numero <= total
    ) {
      porNumero.set(numero, item);
    }
  }

  const numeros = Array.from(
    { length: total },
    (_, indice) => indice + 1
  );

  const ordenar = () =>
    Array.from(porNumero.values()).sort(
      (a, b) => a.numero - b.numero
    );

  const contarExtraidas = () =>
    numeros.filter((numero) =>
      args.temExtracao(porNumero.get(numero))
    ).length;

  const contarProntas = () =>
    numeros.filter((numero) =>
      args.estaPronta(porNumero.get(numero))
    ).length;

  const salvar = async (
    fase: "extraindo" | "resolvendo",
    descricao: string
  ) => {
    const extraidas = contarExtraidas();
    const prontas = contarProntas();
    const progresso =
      fase === "extraindo"
        ? 5 + Math.round((extraidas / Math.max(1, total)) * 30)
        : 35 + Math.round((prontas / Math.max(1, total)) * 60);

    await args.salvar({
      fase,
      descricao,
      progresso: Math.min(95, progresso),
      itens: ordenar(),
    });
  };

  const faltamExtrair = numeros.filter(
    (numero) => !args.temExtracao(porNumero.get(numero))
  );

  for (let inicio = 0; inicio < faltamExtrair.length; inicio += 5) {
    const grupo = faltamExtrair.slice(inicio, inicio + 5);
    const extraidas = await args.extrair(grupo);

    for (const item of extraidas) {
      if (!grupo.includes(item.numero)) continue;

      const atual = porNumero.get(item.numero);
      if (!atual || !args.estaPronta(atual)) {
        porNumero.set(item.numero, item);
      }

      await salvar(
        "extraindo",
        `Questão ${item.numero} extraída e salva · ${contarExtraidas()}/${total} com leitura disponível.`
      );
    }
  }

  const aindaSemExtracao = numeros.filter(
    (numero) => !args.temExtracao(porNumero.get(numero))
  );

  if (aindaSemExtracao.length > 0) {
    throw new Error(
      `A leitura do PDF ainda não conseguiu extrair as questões: ${aindaSemExtracao.join(", ")}.`
    );
  }

  await salvar(
    "resolvendo",
    `Leitura concluída. Resolvendo e classificando ${total - contarProntas()} questão(ões) pendente(s).`
  );

  for (const numero of numeros) {
    const atual = porNumero.get(numero);
    if (!atual || args.estaPronta(atual)) continue;

    const resolvida = await args.resolver(atual);
    porNumero.set(numero, resolvida);

    await salvar(
      "resolvendo",
      `Questão ${numero} corrigida e salva · ${contarProntas()}/${total} prontas.`
    );
  }

  const pendentes = numeros.filter(
    (numero) => !args.estaPronta(porNumero.get(numero))
  );

  return {
    itens: ordenar(),
    extraidas: contarExtraidas(),
    prontas: contarProntas(),
    pendentes,
  };
}
