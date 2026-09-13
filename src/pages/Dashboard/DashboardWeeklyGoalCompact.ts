import "./DashboardWeeklyGoalCompact.css";

function minutosDoTexto(valor: string | null | undefined) {
  const texto = String(valor ?? "");
  const horas = Number(texto.match(/(\d+)\s*h/i)?.[1] ?? 0);
  const minutos = Number(texto.match(/(\d+)\s*min/i)?.[1] ?? 0);
  return horas * 60 + minutos;
}

function formatarCarga(minutosTotais: number) {
  const total = Math.max(0, Math.round(minutosTotais));
  const horas = Math.floor(total / 60);
  const minutos = total % 60;

  if (horas === 0) return `${minutos}min`;
  if (minutos === 0) return `${horas}h`;
  return `${horas}h ${minutos}min`;
}

function obterMinutosDaSemana() {
  const cards = Array.from(document.querySelectorAll<HTMLElement>(".dashboard-pro-stat-art"));
  const cardTempo = cards.find(
    (card) => card.querySelector(".dashboard-pro-stat-copy b")?.textContent?.trim() === "Tempo estudado hoje"
  );

  return minutosDoTexto(cardTempo?.querySelector(".dashboard-pro-stat-copy small")?.textContent);
}

function obterMetaDiaria(card: HTMLElement) {
  const texto = card.querySelector("h2")?.textContent ?? "";
  const parteMeta = texto.split("/")[1] ?? "";
  return minutosDoTexto(parteMeta);
}

function aplicarMetaSemanalCompacta() {
  const card = document.querySelector<HTMLElement>(".dashboard-pro-weekly");
  if (!card) return;

  const minutosSemana = obterMinutosDaSemana();
  const metaDiaria = obterMetaDiaria(card);
  const metaSemanal = Math.max(1, metaDiaria * 6);
  const percentual = Math.max(0, Math.min(100, Math.round((minutosSemana / metaSemanal) * 100)));
  const assinatura = `${minutosSemana}-${metaSemanal}-${percentual}`;

  let overlay = card.querySelector<HTMLElement>(".dashboard-weekly-compact-overlay");

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "dashboard-weekly-compact-overlay";
    card.appendChild(overlay);
    card.classList.add("dashboard-pro-weekly-compact-active");
  }

  if (overlay.dataset.assinatura === assinatura) return;
  overlay.dataset.assinatura = assinatura;

  overlay.innerHTML = `
    <div class="dashboard-weekly-compact-kicker"><span>◎</span> META DA SEMANA</div>
    <h2>Consistência é poder.</h2>
    <strong class="dashboard-weekly-compact-total">${formatarCarga(minutosSemana)} de ${formatarCarga(metaSemanal)} planejadas</strong>
    <div class="dashboard-weekly-compact-progress" aria-label="${percentual}% da meta semanal concluída">
      <i style="width:${percentual}%"></i>
    </div>
    <div class="dashboard-weekly-compact-footer">
      <span>${percentual}% concluído</span>
      <a href="/plano">Ver plano <b>↗</b></a>
    </div>
  `;
}

function iniciarMetaSemanalCompacta() {
  aplicarMetaSemanalCompacta();

  const observador = new MutationObserver(() => aplicarMetaSemanalCompacta());
  observador.observe(document.body, { childList: true, subtree: true, characterData: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciarMetaSemanalCompacta, { once: true });
} else {
  iniciarMetaSemanalCompacta();
}
