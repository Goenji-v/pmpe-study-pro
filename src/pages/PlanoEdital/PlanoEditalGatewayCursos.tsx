import { useMemo } from "react";

import { useApp } from "../../context/AppContext";
import { listarModulosDaMateria } from "../../services/conteudos/navegarConteudos";
import type { ConfiguracoesComEdital } from "../../types/editalInteligente";
import PlanoEstudos from "../PlanoEstudos/PlanoEstudos";
import PlanoEditalGateway from "./PlanoEditalGateway";

export default function PlanoEditalGatewayCursos() {
  const { materias, configuracoes } = useApp();
  const config = configuracoes as ConfiguracoesComEdital;

  const temConteudo = useMemo(
    () =>
      materias.some((materia) =>
        listarModulosDaMateria(materia).some(
          (modulo) => modulo.assuntos.length > 0
        )
      ),
    [materias]
  );

  const possuiEdital = Boolean(config.editalAtivo?.analise);

  if (
    !possuiEdital &&
    configuracoes.planoPadraoAtivo === false &&
    temConteudo
  ) {
    return <PlanoEstudos />;
  }

  return <PlanoEditalGateway />;
}
