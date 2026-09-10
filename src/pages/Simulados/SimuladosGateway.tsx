import { useNavigate } from "react-router-dom";
import { useAdminStatus } from "../../hooks/useAdminStatus";
import Simulados from "./Simulados";
import SimuladosOficiaisAdminSection from "./SimuladosOficiaisAdminSection";
import "./SimuladosGateway.css";

export default function SimuladosGateway() {
  const navigate = useNavigate();
  const { administrador, carregandoAdmin } = useAdminStatus();

  return (
    <>
      <Simulados />
      <section className="simulados-oficiais-atalho" aria-labelledby="simulados-oficiais-atalho-titulo">
        <div>
          <span>PROVAS OFICIAIS</span>
          <h2 id="simulados-oficiais-atalho-titulo">Simulados oficiais</h2>
          <p>Resolva provas publicadas para o seu concurso com tempo e correção dentro do Study Pro.</p>
        </div>
        <button type="button" onClick={() => navigate("/simulados-oficiais")}>Ver provas oficiais</button>
      </section>
      {!carregandoAdmin && administrador && <SimuladosOficiaisAdminSection />}
    </>
  );
}
