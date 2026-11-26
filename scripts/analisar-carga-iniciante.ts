import { perfisSimulacao, simular } from "../src/services/inteligenciaRevisao/simulacao";

for (const [motor, porAula] of [["adaptativo", 0], ["adaptativo", 30], ["legado", 30]] as const) {
  const r = await simular(perfisSimulacao[0], 90, motor, porAula);
  const diasComMargem = r.margem.filter(n => n >= 30).length;
  console.log({ motor, porAula, revisoes: r.concluidas, atrasadas: r.atrasadas, retencao: r.retencao,
    aulas: r.aulasRealizadas, picoRevisoes: Math.max(...r.carga), picoMinutosRevisao: Math.max(...r.cargaMinutos),
    picoTotal: Math.max(...r.cargaMinutos.map((n,i) => n + r.cargaAulas[i])),
    diasComMargem, diasSemVagaParaAulaComRevisao: r.margem.filter((n,i) => n < 30 && r.carga[i] > 0).length,
    minutosRevisao: r.cargaMinutos.reduce((a,b) => a + b,0), minutosReservadosAula: r.cargaAulas.reduce((a,b) => a + b,0) });
}
