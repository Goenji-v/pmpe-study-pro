import type {
  ReactNode,
} from "react";

import {
  Navigate,
  useLocation,
} from "react-router-dom";

import {
  useAuth,
} from "../context/AuthContext";

export default function ProtectedRoute({
  children,
}: {
  children: ReactNode;
}) {
  const {
    usuario,
    carregando,
  } = useAuth();

  const location =
    useLocation();

  if (carregando) {
    return (
      <div className="auth-carregando">
        Verificando sua conta...
      </div>
    );
  }

  if (!usuario) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          origem:
            location.pathname,
        }}
      />
    );
  }

  return children;
}