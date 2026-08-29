import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { verificarAdministrador } from "../services/adminService";

export function useAdminStatus() {
  const { usuario } = useAuth();
  const usuarioId = usuario?.id;
  const [administrador, setAdministrador] = useState(false);
  const [carregandoAdmin, setCarregandoAdmin] = useState(true);

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      if (!usuarioId) {
        if (ativo) {
          setAdministrador(false);
          setCarregandoAdmin(false);
        }
        return;
      }

      setCarregandoAdmin(true);
      const resultado = await verificarAdministrador();

      if (ativo) {
        setAdministrador(resultado);
        setCarregandoAdmin(false);
      }
    }

    void carregar();

    return () => {
      ativo = false;
    };
  }, [usuarioId]);

  return { administrador, carregandoAdmin };
}
