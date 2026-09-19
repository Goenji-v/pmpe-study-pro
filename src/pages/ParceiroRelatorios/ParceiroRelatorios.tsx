import { Navigate } from "react-router-dom";

/**
 * Rota antiga mantida apenas por compatibilidade.
 * Os relatórios individuais foram substituídos pelo resumo consolidado
 * disponível na Área do Parceiro.
 */
export default function ParceiroRelatorios() {
  return <Navigate to="/parceiro" replace />;
}
