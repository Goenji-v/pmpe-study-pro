import { useNavigate } from "react-router-dom";

import "./NotFound.css";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <section className="not-found">
      <span>ERRO 404</span>
      <h1>Página não encontrada</h1>
      <p>O endereço acessado não existe ou foi alterado.</p>
      <button type="button" onClick={() => navigate("/")}>
        Voltar ao Dashboard
      </button>
    </section>
  );
}
