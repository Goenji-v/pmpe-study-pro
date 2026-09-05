import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useApp } from "../../context/AppContext";
import { listarAssuntosDaMateria } from "../../services/conteudos/navegarConteudos";
import { deveExibirPrimeirosPassos } from "../../utils/primeirosPassos";

import "./PrimeirosPassos.css";

export default function PrimeirosPassos() {
  const { materias } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [ocultado, setOcultado] = useState(false);

  const totalAssuntos = useMemo(
    () => materias.reduce(
      (total, materia) => total + listarAssuntosDaMateria(materia).length,
      0
    ),
    [materias]
  );

  if (!deveExibirPrimeirosPassos({
    rota: location.pathname,
    totalAssuntos,
    ocultado,
  })) {
    return null;
  }

  return (
    <aside className="primeiros-passos" aria-label="Primeiros passos no Study Pro">
      <header>
        <div>
          <span>PRIMEIRO ACESSO</span>
          <h2>Comece por aqui</h2>
          <p>Escolha de onde vem seu conteúdo. Depois o Study Pro organiza o plano e as revisões.</p>
        </div>
        <button
          type="button"
          className="primeiros-passos-fechar"
          aria-label="Fechar primeiros passos"
          onClick={() => setOcultado(true)}
        >
          ×
        </button>
      </header>

      <ol>
        <li><strong>1</strong><span>Adicione seu conteúdo</span></li>
        <li><strong>2</strong><span>Defina sua rotina</span></li>
        <li><strong>3</strong><span>Siga a primeira missão</span></li>
      </ol>

      <div className="primeiros-passos-acoes">
        <button type="button" className="primario" onClick={() => navigate("/cursos")}>Importar curso</button>
        <button type="button" onClick={() => navigate("/meu-edital")}>Importar edital</button>
        <button type="button" onClick={() => navigate("/conteudos")}>Cadastrar manualmente</button>
      </div>
    </aside>
  );
}
