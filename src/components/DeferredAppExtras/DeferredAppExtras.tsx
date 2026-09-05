import { lazy, Suspense, useEffect, useState } from "react";

const QuestaoIABridge = lazy(
  () => import("../QuestaoIABridge/QuestaoIABridge")
);
const EconomiaGamificacaoBridge = lazy(
  () => import("../EconomiaGamificacaoBridge/EconomiaGamificacaoBridge")
);
const BetaFeedback = lazy(
  () => import("../BetaFeedback/BetaFeedback")
);
const NotificationCenter = lazy(
  () => import("../NotificationCenter/NotificationCenter")
);
const PrimeirosPassos = lazy(
  () => import("../PrimeirosPassos/PrimeirosPassos")
);

type JanelaComIdle = Window & {
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout: number }
  ) => number;
  cancelIdleCallback?: (id: number) => void;
};

export default function DeferredAppExtras() {
  const [ativo, setAtivo] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const janela = window as JanelaComIdle;

    if (janela.requestIdleCallback) {
      const id = janela.requestIdleCallback(
        () => setAtivo(true),
        { timeout: 1000 }
      );

      return () => janela.cancelIdleCallback?.(id);
    }

    const timer = window.setTimeout(() => setAtivo(true), 350);
    return () => window.clearTimeout(timer);
  }, []);

  if (!ativo) return null;

  return (
    <Suspense fallback={null}>
      <QuestaoIABridge />
      <EconomiaGamificacaoBridge />
      <BetaFeedback />
      <NotificationCenter />
      <PrimeirosPassos />
    </Suspense>
  );
}
