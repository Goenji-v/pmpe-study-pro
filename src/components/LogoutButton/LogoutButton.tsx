import {
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  useAuth,
} from "../../context/AuthContext";

import "./LogoutButton.css";

export default function LogoutButton() {
  const {
    usuario,
    sair,
  } = useAuth();

  const navigate =
    useNavigate();

  const [
    saindo,
    setSaindo,
  ] = useState(false);

  async function fazerLogout() {
    if (saindo) {
      return;
    }

    try {
      setSaindo(true);

      await sair();

      navigate(
        "/login",
        {
          replace: true,
        }
      );
    } catch (erro) {
      window.alert(
        erro instanceof Error
          ? erro.message
          : "Não foi possível sair."
      );
    } finally {
      setSaindo(false);
    }
  }

  return (
    <div className="logout-conta">
      <div>
        <strong>
          {usuario?.user_metadata
            ?.nome ||
            usuario?.email ||
            "Usuário"}
        </strong>

        <span>
          {usuario?.email}
        </span>
      </div>

      <button
        type="button"
        onClick={
          fazerLogout
        }
        disabled={saindo}
      >
        {saindo
          ? "Saindo..."
          : "Sair"}
      </button>
    </div>
  );
}