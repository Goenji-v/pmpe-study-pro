import "./DashboardGeneralPerformanceVisual.css";

function numeroDoTexto(valor: string | null | undefined) {
  const encontrado = String(valor ?? "").match(/\d+/);
  return encontrado ? Number(encontrado[0]) : 0;
}

function localizarCardPorRotulo(rotulo: string) {
  return Array.from(document.querySelectorAll<HTMLElement>(".dashboard-pro-stat-art"))
    .find((card) => card.querySelector(".dashboard-pro-stat-copy b")?.textContent?.trim() === rotulo);
}

function obterAproveitamento() {
  const card = localizarCardPorRotulo("Taxa de acertos");
  return Math.max(0, Math.min(100, numeroDoTexto(card?.querySelector(".dashboard-pro-stat-copy strong")?.textContent)));
}

function obterRevisoesPendentes() {
  return Array.from(document.querySelectorAll<HTMLElement>(".dashboard-pro-review-counts strong"))
    .reduce((total, item) => total + numeroDoTexto(item.textContent), 0);
}

function aplicarDesempenhoGeral() {
  const card = document.querySelector<HTMLElement>(".dashboard-pro-performance");
  if (!card) return;

  const aproveitamento = obterAproveitamento();
  const erros = Math.max(0, 100 - aproveitamento);
  const revisoesPendentes = obterRevisoesPendentes();
  const assinatura = `${aproveitamento}-${revisoesPendentes}`;

  let overlay = card.querySelector<HTMLElement>(".dashboard-performance-general-overlay");

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "dashboard-performance-general-overlay";
    card.appendChild(overlay);
  }

  if (overlay.dataset.assinatura === assinatura) return;
  overlay.dataset.assinatura = assinatura;

  overlay.innerHTML = `
    <div class="dashboard-performance-general-head">
      <div>
        <h2>Desempenho geral</h2>
        <p>Seu esforço, traduzido em evolução.</p>
      </div>
      <a href="/estatisticas">Ver detalhes <span>↗</span></a>
    </div>

    <div class="dashboard-performance-general-body">
      <div class="dashboard-performance-general-chart-area">
        <div class="dashboard-performance-general-ring" style="--score:${aproveitamento * 3.6}deg">
          <div class="dashboard-performance-general-ring-core">
            <strong>${aproveitamento}<small>%</small></strong>
            <span>APROVEITAMENTO</span>
          </div>
        </div>

        <div class="dashboard-performance-general-legend">
          <div><i class="acertos"></i><span>Acertos</span><strong>${aproveitamento}%</strong></div>
          <div><i class="revisao"></i><span>Em revisão</span><strong>${revisoesPendentes}</strong></div>
          <div><i class="erros"></i><span>Erros</span><strong>${erros}%</strong></div>
        </div>
      </div>

      <div class="dashboard-performance-general-message">
        <span class="dashboard-performance-general-icon">⌁</span>
        <h3>Você está no caminho certo.</h3>
        <p>Seu aproveitamento atual é <strong>${aproveitamento}%</strong>. Continue acompanhando seus resultados para evoluir com consistência.</p>
        <a href="/estatisticas">↗ Continue com essa constância</a>
      </div>
    </div>
  `;

  card.classList.add("dashboard-performance-general-active");
}

function iniciarObservadorDesempenho() {
  aplicarDesempenhoGeral();

  const observador = new MutationObserver(() => aplicarDesempenhoGeral());
  observador.observe(document.body, { childList: true, subtree: true, characterData: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciarObservadorDesempenho, { once: true });
} else {
  iniciarObservadorDesempenho();
}
