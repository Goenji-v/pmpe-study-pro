/* Contexto exporta Provider e hook intencionalmente no mesmo módulo. */
/* oxlint-disable react/only-export-components */
import {
  useCallback,
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ToastType = "success" | "error" | "warning" | "info";

type Toast = {
  id: string;
  message: string;
  type: ToastType;
};

type ToastContextType = {
  showToast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(
  undefined
);

export function ToastProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removerToast = useCallback((id: string) => {
    setToasts((old) =>
      old.filter((toast) => toast.id !== id)
    );
  }, []);

  const showToast = useCallback((
    message: string,
    type: ToastType = "success"
  ) => {
    const id = crypto.randomUUID();

    setToasts((old) => [
      ...old,
      {
        id,
        message,
        type,
      },
    ]);

    window.setTimeout(() => {
      removerToast(id);
    }, 3500);
  }, [removerToast]);

  const valorContexto = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={valorContexto}>
      {children}

      <div className="toast-container">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast-${toast.type}`}
          >
            <span className="toast-icon">
              {toast.type === "success"
                ? "✅"
                : toast.type === "error"
                  ? "❌"
                  : toast.type === "warning"
                    ? "⚠️"
                    : "ℹ️"}
            </span>

            <span className="toast-message">
              {toast.message}
            </span>

            <button
              className="toast-close"
              onClick={() => removerToast(toast.id)}
              aria-label="Fechar notificação"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error(
      "useToast deve ser utilizado dentro de ToastProvider"
    );
  }

  return context;
}
