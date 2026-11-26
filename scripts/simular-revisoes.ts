import { perfisSimulacao, simular } from "../src/services/inteligenciaRevisao/simulacao";

for (const perfil of perfisSimulacao) for (const dias of [30, 60, 90] as const) {
  const resumo = [];
  for (const motor of ["legado", "adaptativo"] as const) {
    const r = await simular(perfil, dias, motor);
    const retencao = r.retencao === null ? "—" : (r.retencao * 100).toFixed(1) + "%";
    resumo.push(`${r.concluidas} / ${r.atrasadas} / ${Math.max(...r.carga)} / ${retencao} (${r.unidadesMedidas}) / ${r.semVaga} / ${r.duplicadas} / ${r.ms} ms`);
  }
  console.log(`| ${perfil.nome} | ${dias} | ${resumo.join(" | ")} |`);
}
