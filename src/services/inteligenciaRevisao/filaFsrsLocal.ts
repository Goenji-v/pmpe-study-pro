import { chaveEscopoFsrs } from "./checkpoint";
import { filaFsrsStore, transacaoFsrs } from "./checkpointLocal";
import { filaVazia, type FilaFsrs, type RepositorioFilaFsrs } from "./sincronizacao";

export const filaFsrsLocal: RepositorioFilaFsrs = {
  ler: escopo => transacaoFsrs<FilaFsrs, FilaFsrs>(filaFsrsStore, chaveEscopoFsrs(escopo), "readonly", atual => atual ?? filaVazia()),
  atualizar: (escopo, aplicar) => {
    const chave = chaveEscopoFsrs(escopo);
    return transacaoFsrs<FilaFsrs, FilaFsrs>(filaFsrsStore, chave, "readwrite", (atual, objeto) => {
      const nova = aplicar(atual ?? filaVazia());
      objeto.put(nova, chave);
      return nova;
    });
  },
};
