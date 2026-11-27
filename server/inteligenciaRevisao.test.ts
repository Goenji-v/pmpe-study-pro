import test from "node:test";
import assert from "node:assert/strict";
import type { Materia } from "../src/types";
import { avaliar } from "../src/services/inteligenciaRevisao/avaliacao";
import { diaEstudo, distribuir, projetar, somarDia } from "../src/services/inteligenciaRevisao/agenda";
import { reconciliar, type Observacao } from "../src/services/inteligenciaRevisao/eventos";
import { carregarMemoria, versaoMemoria } from "../src/services/inteligenciaRevisao/memoria";
import { planejarRevisoes } from "../src/services/inteligenciaRevisao/plano";

const materia: Materia = { id: "disc", nome: "Disciplina", assuntos: [
  { id: "assunto", nome: "Assunto", concluido: true, prioridade: "alta", idsLegados: ["antigo"] }
] };
const observacao: Observacao = { evento: {
  usuarioId: "sintetico", origem: "sessao", ocorrenciaId: "1", tipo: "recuperacao",
  ocorridoEm: "2026-12-31T23:00:00Z", conteudo: { materiaId: "disc", assuntoId: "antigo" },
}, evidencia: { modo: "recuperacao", certas: 8, erradas: 2 } };
const agora = new Date("2027-01-01T12:00:00Z");
const limites = { semana: [0, 1, 2, 3, 4, 5, 6], minutos: 60, revisoes: 1 };

test("avaliação distingue evidência, anulações, dificuldade e consistência", () => {
  assert.equal(avaliar({ modo: "passivo", certas: 10, erradas: 0 }).nota, undefined);
  assert.equal(avaliar({ modo: "recuperacao", certas: 3, erradas: 1, anuladas: 10 }).nota, undefined);
  const boa = { modo: "recuperacao", certas: 9, erradas: 1, anuladas: 4 } as const;
  assert.equal(avaliar(boa).percentual, 90);
  assert.equal(avaliar(boa).nota, "Good");
  assert.equal(avaliar(boa, [90, 85]).nota, "Easy");
  assert.equal(avaliar({ ...boa, dificuldade: "facil" }, [90, 85]).nota, "Good");
  assert.equal(avaliar({ ...boa, certas: 2, erradas: 8 }).nota, "Again");
  assert.equal(avaliar({ ...boa, certas: 3, erradas: 2 }).nota, "Hard");
});

test("replay e conflitos preservam o histórico de origem e protegem o cartão", async () => {
  const diario = { versao: versaoMemoria, retencao: 0.9, observacoes: [observacao, observacao] } as const;
  const motor = await carregarMemoria([materia], { ...diario, observacoes: [...diario.observacoes] }, agora);
  const estado = [...motor.estados.values()][0];
  assert.equal(estado.historico.length, 1);
  assert.equal(motor.reconciliacao.repetidos, 1);
  assert.equal(estado.cartao?.lastReviewAt?.toISOString(), observacao.evento.ocorridoEm.replace("00Z", "00.000Z"));
  assert.ok((motor.recuperar(estado) ?? 0) > 0);
  const copia = await carregarMemoria([materia], JSON.parse(JSON.stringify(diario)), agora);
  assert.deepEqual([...copia.estados.values()], [estado]);
  const conflito = reconciliar([materia], [observacao, { ...observacao, evidencia: { ...observacao.evidencia, certas: 3 } }]);
  assert.equal(conflito.aceitos.length, 0);
  assert.equal(conflito.pendentes.length, 2);
  assert.equal(reconciliar([], [observacao]).pendentes.length, 1);
  assert.equal(reconciliar([materia], [{ ...observacao, evento: { ...observacao.evento, ocorridoEm: "2027-02-30T12:00:00Z" } }]).aceitos.length, 0);
});

test("primeira revisão, virada de ano e capacidade com descanso", async () => {
  assert.equal(diaEstudo(new Date("2027-01-01T01:00:00Z")), "2026-12-31");
  assert.equal(somarDia("2026-12-31", 1), "2027-01-01");
  const plano = await planejarRevisoes({ materias: [materia], revisoes: [], agora, limites,
    compromissos: [{ id: "d", dia: "2027-01-01", minutos: 0, titulo: "Descanso", tipo: "descanso" }],
    diario: { versao: versaoMemoria, retencao: 0.9, observacoes: [{ ...observacao,
      evento: { ...observacao.evento, tipo: "estudo" }, evidencia: { modo: "passivo" } }] } });
  assert.equal(plano.agenda[0].ideal, "2027-01-01");
  assert.equal(plano.agenda[0].agendada, "2027-01-02");
  assert.equal(plano.dados.values().next().value?.estado.cartao, undefined);
  const agenda = distribuir([plano.agenda[0], plano.agenda[0]], [], "2027-01-01", { ...limites, revisoes: 0 });
  assert.equal(agenda.agenda.length, 1);
  assert.equal(projetar(agenda, 7).estado, "Sobrecarga");
});

test("sessões e registros de questões IA representam fontes distintas e preservam vínculos", async () => {
  const { observarQuestoesIA, observarSessoes, reconciliarLegado } = await import("../src/services/inteligenciaRevisao/eventos");
  const base = { id: "1", tipo: "questoes", data: observacao.evento.ocorridoEm, materia: "D", assunto: "A",
    materiaId: "disc", assuntoId: "assunto", minutos: 10, quantidadeAcertos: 8, quantidadeErros: 2 } as const;
  const fonte = { id: "resultado:assunto:0", tentativaId: "resultado", origem: "questoes-ia", data: base.data,
    materia: base.materia, assunto: base.assunto, materiaId: base.materiaId, assuntoId: base.assuntoId,
    certas: 8, erradas: 2, banca: "teste", minutos: 0 } as const;
  const eventos = observarSessoes("sintetico", [base, { ...base, id: "espelho", objetivo: "[Questões IA] treino" }]);
  assert.equal(eventos.length, 1);
  const ia = observarQuestoesIA("sintetico", [fonte, fonte, { ...fonte, origem: "simulado-ia" }]);
  assert.equal(reconciliar([materia], ia).repetidos, 1);
  const legado = { id: "r", materiaId: "disc", assuntoId: "antigo", materia: "D", assunto: "A",
    etapa: 1, dataCriacao: base.data, dataPrevista: base.data, concluida: true } as const;
  assert.equal(reconciliarLegado([materia], [legado])[0].vinculo?.status, "validado");
  assert.equal(reconciliarLegado([materia], [{ ...legado, escopoGrupo: true }])[0].vinculo, null);
  assert.deepEqual(reconciliarLegado([materia], [legado])[0].revisao, legado);
});

test("capacidade, prazo de recuperação e prioridade produzem a mesma agenda em ordens diferentes", () => {
  const atrasada = { unidadeId: "c", materia: "x", assunto: "c", ideal: "2026-12-01", limite: "2026-12-03",
    minutos: 12, primeira: true };
  const candidatos = ["a", "b", "d"].map(unidadeId => ({ ...atrasada, unidadeId }));
  const hoje = "2027-01-01";
  const a = distribuir(candidatos, [], hoje, limites);
  const b = distribuir(candidatos.slice().reverse(), [], hoje, limites);
  assert.deepEqual(a.agenda, b.agenda);
  assert.ok(a.agenda.every(r => r.limite === atrasada.limite));
  assert.ok(a.agenda.every(r => r.agendada && r.agendada <= "2027-01-03"));
  assert.equal(projetar(a, 7).estado, "Recuperação");
  assert.throws(() => distribuir([], [], hoje, { ...limites, minutos: -1 }));
});

test("laboratório preserva limites e deduplica em horizontes de 30, 60 e 90 dias", async () => {
  const { perfisSimulacao, simular } = await import("../src/services/inteligenciaRevisao/simulacao");
  const perfil = perfisSimulacao[10];
  for (const dias of [30, 60, 90] as const) {
    const resultado = await simular(perfil, dias, "adaptativo");
    assert.equal(resultado.carga.length, dias);
    assert.ok(Math.max(...resultado.carga) <= perfil.vagas);
    assert.equal(resultado.duplicadas, 18 + resultado.concluidas);
    assert.ok(resultado.retencao !== null && resultado.retencao >= 0 && resultado.retencao <= 1);
  }
});

test("janela horária reserva capacidade para compromissos e revisão oficial", () => {
  const dia = "2027-01-01";
  const candidato = { unidadeId: "a", materia: "m", assunto: "A", ideal: dia, limite: dia, minutos: 15, primeira: true };
  const fixos = [{ id: "aula", dia, minutos: 20, titulo: "Aula", tipo: "aula" }, {
    id: "antiga", dia, minutos: 12, titulo: "Revisão oficial", tipo: "revisao",
  }] as const;
  const janela = { ...limites, inicio: "18:00", fim: "19:00" };
  assert.equal(distribuir([candidato], fixos, dia, janela).agenda[0].agendada, undefined);
  assert.equal(distribuir([candidato], fixos, dia, { ...janela, revisoes: 2 }).agenda[0].horarioSugerido, "18:32");
  assert.throws(() => distribuir([], [], dia, { ...janela, fim: "17:00" }));
});

test("amostra insuficiente isolada não agenda conteúdo novo nem inventa memória", async () => {
  const diario = { versao: versaoMemoria, retencao: 0.9, observacoes: [{
    ...observacao, evidencia: { modo: "recuperacao" as const, certas: 1, erradas: 0 },
  }] };
  const memoria = await carregarMemoria([materia], diario, agora);
  assert.equal(memoria.estados.values().next().value?.historico.length, 1);
  assert.equal(memoria.estados.values().next().value?.cartao, undefined);
  const plano = await planejarRevisoes({ materias: [materia], revisoes: [], compromissos: [], agora, limites, diario });
  assert.equal(plano.agenda.length, 0);
});

test("iniciante respeita horários FSRS e reserva tempo para as 18 novas aulas", async () => {
  const { perfisSimulacao, simular } = await import("../src/services/inteligenciaRevisao/simulacao");
  const perfil = perfisSimulacao[0];
  const original = await simular(perfil, 90, "adaptativo");
  assert.equal(original.concluidas, 155);
  assert.equal(original.cargaAulas.every(n => n === 0), true);
  for (const motor of ["legado", "adaptativo"] as const) {
    const r = await simular(perfil, 90, motor, 30);
    assert.equal(r.aulasRealizadas, 18);
    assert.equal(r.cargaAulas.reduce((a, b) => a + b, 0), 540);
    assert.ok(r.carga.every(n => n <= 4));
    assert.ok(r.cargaMinutos.every((n, i) => n + r.cargaAulas[i] <= 72));
    assert.ok(r.margem.every(n => n >= 0));
  }
});

test("usa o vencimento inteiro, arredonda segundos para cima e não invade a janela", () => {
  const dia = "2027-01-04";
  const candidato = { unidadeId: "a", materia: "m", assunto: "A", ideal: dia, limite: "2027-01-07",
    minutos: 12, primeira: false, compromisso: dia, dueAt: "2027-01-04T21:20:01.999Z" };
  const janela = { ...limites, inicio: "18:00", fim: "19:00" };
  assert.equal(distribuir([candidato], [], new Date("2027-01-04T21:10:04Z"), janela).agenda[0].agendadaEm,
    "2027-01-04T21:21:00.000Z");
  assert.equal(distribuir([candidato], [], new Date("2027-01-04T21:39:01Z"), janela).agenda[0].agendadaEm,
    "2027-01-04T21:40:00.000Z");
  const adiada = distribuir([candidato], [], new Date("2027-01-04T21:48:01Z"), janela).agenda[0];
  assert.equal(adiada.agendadaEm, "2027-01-05T21:00:00.000Z");
  assert.match(adiada.motivo, /Preferência de data não atendida: sem janela livre/);
  const meiaNoite = { ...candidato, dueAt: "2027-01-05T02:59:59Z" };
  assert.equal(distribuir([meiaNoite], [], new Date("2027-01-04T21:00:00Z"), limites).agenda[0].agendada,
    "2027-01-05");
});

test("preferências respeitam descanso, minutos, quantidade e deixam espaço antes de reservas tardias", () => {
  const ideal = "2027-01-04";
  const descanso = { id: "descanso", dia: "2027-01-05", titulo: "Descanso", minutos: 0, tipo: "descanso" } as const;
  const base = { materia: "m", assunto: "A", ideal, limite: "2027-01-07", minutos: 15, primeira: false };
  const agendar = (candidatos: Parameters<typeof distribuir>[0], ajustes = {}) => distribuir(candidatos, [descanso],
    new Date("2027-01-04T21:00:00Z"), { ...limites, revisoes: 2, inicio: "18:00", fim: "19:00", ...ajustes }).agenda;
  const tarde = { ...base, unidadeId: "tarde", compromisso: ideal, dueAt: "2027-01-04T21:45:00Z" };
  const cedo = { ...base, unidadeId: "cedo" };
  const diaDescanso = { ...base, unidadeId: "descanso", compromisso: descanso.dia };
  const datas = agendar([tarde, cedo, diaDescanso]);
  assert.equal(datas.find(r => r.unidadeId === "tarde")?.horarioSugerido, "18:45");
  assert.equal(datas.find(r => r.unidadeId === "cedo")?.horarioSugerido, "18:00");
  assert.equal(datas.find(r => r.unidadeId === "descanso")?.agendada, "2027-01-06");
  assert.match(datas.find(r => r.unidadeId === "descanso")!.motivo, /dia de descanso ou indisponível/);
  assert.match(agendar([tarde], { minutos: 14 })[0].motivo, /minutos disponíveis insuficientes/);
  assert.match(agendar([tarde], { revisoes: 0 })[0].motivo, /limite diário de revisões atingido/);
  assert.match(agendar([{ ...tarde, compromisso: "2027-01-03" }])[0].motivo, /data já passou/);
  assert.match(agendar([{ ...tarde, compromisso: "2027-01-08" }])[0].motivo, /data posterior ao prazo/);
});

test("FSRS amplia intervalos com bons resultados e encurta após lapso com histórico íntegro", async () => {
  const diario = { versao: versaoMemoria, retencao: .9, observacoes: [] as Observacao[] };
  const nota = async (ocorridoEm: Date, certas = 8) => {
    diario.observacoes.push({
      evento: { ...observacao.evento, ocorridoEm: ocorridoEm.toISOString(), ocorrenciaId: String(diario.observacoes.length) },
      evidencia: { modo: "recuperacao", certas, erradas: 10 - certas },
    });
    const motor = await carregarMemoria([materia], diario, ocorridoEm);
    return [...motor.estados.values()][0].cartao!;
  };
  const inicial = await nota(new Date("2027-01-01T15:30:00Z"));
  const sucesso = await nota(inicial.dueAt);
  assert.ok(+sucesso.dueAt - +inicial.dueAt > +inicial.dueAt - +inicial.lastReviewAt!);
  const cedo = await carregarMemoria([materia], diario, sucesso.lastReviewAt!);
  const tarde = await carregarMemoria([materia], diario, sucesso.dueAt);
  assert.ok(cedo.recuperar([...cedo.estados.values()][0])! > tarde.recuperar([...tarde.estados.values()][0])!);
  const lapso = await nota(sucesso.dueAt, 2);
  assert.ok(+lapso.dueAt - +sucesso.dueAt < +sucesso.dueAt - +inicial.dueAt);
  assert.ok(lapso.difficulty > sucesso.difficulty);
  const recuperacao = await nota(lapso.dueAt);
  assert.ok(+recuperacao.dueAt > +lapso.dueAt);
  const plano = await planejarRevisoes({ materias: [materia], revisoes: [], diario,
    agora: lapso.dueAt, compromissos: [], limites });
  assert.equal(plano.agenda.length, 1);
  assert.equal(plano.agenda[0].dueAt, recuperacao.dueAt.toISOString());
  assert.ok(Date.parse(plano.agenda[0].agendadaEm!) >= +recuperacao.dueAt);
  assert.deepEqual([...plano.estadosMemoria.values()][0].historico.map(h => h.avaliacao.nota), ["Good", "Good", "Again", "Good"]);
});

test("projeção mantém uma revisão ativa e conserva todos os registros legados", async () => {
  const base = { materiaId: "disc", assuntoId: "antigo", materia: "Disciplina", assunto: "Assunto",
    etapa: 2, dataCriacao: observacao.evento.ocorridoEm, concluida: false } as const;
  const revisoes = [
    { ...base, id: "z", dataPrevista: "2027-01-03T15:00:00Z" },
    { ...base, id: "a", dataPrevista: "2027-01-03T12:00:00-03:00" },
    { ...base, id: "historico", dataPrevista: "2026-12-31T15:00:00Z", concluida: true },
  ];
  const antes = structuredClone(revisoes);
  const plano = await planejarRevisoes({ materias: [materia], revisoes, diario: { versao: versaoMemoria,
    retencao: .9, observacoes: [observacao, observacao] }, agora, compromissos: [], limites });
  assert.equal(plano.agenda.length, 1);
  assert.equal([...plano.dados.values()][0].revisaoLegadaId, "a");
  assert.deepEqual(plano.legado.map(l => l.revisao), antes);
  assert.deepEqual(revisoes, antes);
  assert.equal([...plano.estadosMemoria.values()][0].historico.length, 1);
  const semEvidencia = await planejarRevisoes({ materias: [materia], revisoes, diario: { versao: versaoMemoria,
    retencao: .9, observacoes: [] }, agora, compromissos: [], limites });
  assert.equal(semEvidencia.agenda.length, 0);
  assert.deepEqual(semEvidencia.dias.flatMap(d => d.fixos.map(fixo => fixo.id)), [JSON.stringify(["revisao", "a"])]);
  assert.deepEqual(semEvidencia.legado.map(l => l.revisao), antes);
});

test("agenda rejeita datas impossíveis, duração inválida e compromissos divergentes", () => {
  const hoje = "2027-01-01";
  const fixo = { id: "1", dia: hoje, minutos: 19, titulo: "Aula", tipo: "aula" } as const;
  const candidato = { unidadeId: "1", materia: "D", assunto: "A", ideal: hoje, limite: hoje,
    primeira: true, minutos: 12 } as const;
  assert.equal(distribuir([candidato], [fixo, fixo], hoje, limites).dias[0].cargaFixa, 19);
  assert.throws(() => distribuir([candidato], [fixo, { ...fixo, minutos: 20 }], hoje, limites), /conflitantes/);
  assert.throws(() => distribuir([candidato], [fixo, { ...fixo, dia: "2027-01-02" }], hoje, limites), /conflitantes/);
  assert.throws(() => distribuir([{ ...candidato, minutos: -1 }], [], hoje, limites));
  assert.throws(() => distribuir([candidato], [], "2027-02-30", limites));
  assert.throws(() => distribuir([candidato], [], hoje, { ...limites, semana: [7] }));
});
