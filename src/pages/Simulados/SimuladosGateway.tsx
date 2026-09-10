import Simulados from "./Simulados";
import SimuladosOficiaisAdminSection from "./SimuladosOficiaisAdminSection";
import { useAdminStatus } from "../../hooks/useAdminStatus";

export default function SimuladosGateway() {
  const { administrador, carregandoAdmin } = useAdminStatus();

  return (
    <>
      <Simulados />
      {!carregandoAdmin && administrador && <SimuladosOficiaisAdminSection />}
    </>
  );
}
