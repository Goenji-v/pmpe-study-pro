import { useMemo, useRef, useState } from "react";
import PlanejamentoAdaptativo from "./PlanejamentoAdaptativo";
import type { Materia } from "../../types";
import type { Agendamento, Compromisso } from "../../services/inteligenciaRevisao/agenda";
import type { Observacao } from "../../services/inteligenciaRevisao/eventos";
import { versaoMemoria, type DiarioMemoria } from "../../services/inteligenciaRevisao/memoria";

const base = Date.parse("2027-01-04T15:00:00Z");
const materias: Materia[] = [{ id: "direito", nome: "Direito Constitucional", assuntos: [
  { id: "direitos", nome: "Direitos fundamentais", prioridade: "alta", concluido: true },
  { id: "administracao", nome: "Administração pública", prioridade: "media", concluido: true },
  { id: "federacao", nome: "Organização do Estado", prioridade: "alta", concluido: true },
] }];
const compromissos: Compromisso[] = [
  { id: "aula", dia: "2027-01-05", titulo: "Aula de controle de constitucionalidade", minutos: 30, tipo: "aula" },
  { id: "questoes", dia: "2027-01-06", titulo: "Treino de questões", minutos: 20, tipo: "questoes" },
  { id: "simulado", dia: "2027-01-09", titulo: "Simulado semanal", minutos: 50, tipo: "simulado" },
  { id: "descanso", dia: "2027-01-10", titulo: "Descanso", minutos: 0, tipo: "descanso" },
];
const limites = { semana: [1, 2, 3, 4, 5, 6], minutos: 60, revisoes: 3 };
const legado: [] = [];
const inicial: Observacao[] = materias[0].assuntos.map((assunto, i) => ({
  evento: { usuarioId: "demonstracao", origem: "sessao", ocorrenciaId: `aula-${i}`,
    tipo: "estudo", ocorridoEm: "2027-01-03T15:00:00Z", conteudo: { materiaId: "direito", assuntoId: assunto.id } },
  evidencia: { modo: "passivo" },
}));

export default function DemoPlanejamento() {
  const [modo, setModo] = useState<"revisoes" | "calendario">("revisoes");
  const [observacoes, setObservacoes] = useState(inicial);
  const [selecionada, selecionar] = useState<Agendamento>();
  const dialogo = useRef<HTMLDialogElement>(null);
  const agora = useMemo(() => new Date(base + observacoes.length * 60_000), [observacoes]);
  const diario = useMemo<DiarioMemoria>(() => ({ versao: versaoMemoria, retencao: .9, observacoes }), [observacoes]);

  return <main className="plano-laboratorio">
    <h1>Laboratório de revisões do Estude Pro</h1>
    <nav aria-label="Planejamento">
      <button type="button" aria-pressed={modo === "revisoes"} onClick={() => setModo("revisoes")}>Revisões</button>
      <button type="button" aria-pressed={modo === "calendario"} onClick={() => setModo("calendario")}>Calendário</button>
    </nav>
    <PlanejamentoAdaptativo modo={modo} demonstracao materias={materias} revisoes={legado} diario={diario}
      agora={agora} compromissos={compromissos} limites={limites} estudar={item => {
        selecionar(item);
        dialogo.current?.showModal();
      }} />
    <dialog ref={dialogo} aria-labelledby="treino-titulo" onClose={() => selecionar(undefined)}>
      <h2 id="treino-titulo">Registrar treino sintético</h2>
      {selecionada && <form onSubmit={e => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const [, materiaId, , assuntoId] = JSON.parse(selecionada.unidadeId) as string[];
        setObservacoes(anterior => [...anterior, { evento: { usuarioId: "demonstracao", origem: "sessao",
          ocorrenciaId: `treino-${anterior.length}`, tipo: "recuperacao", ocorridoEm: agora.toISOString(),
          conteudo: { materiaId, assuntoId } },
        evidencia: { modo: "recuperacao", certas: Number(form.get("certas")), erradas: Number(form.get("erradas")) } }]);
        dialogo.current?.close();
      }}>
        <p>{selecionada.assunto}</p>
        <label>Acertos <input name="certas" type="number" min="0" max="100" required defaultValue={8} /></label>
        <label>Erros <input name="erradas" type="number" min="0" max="100" required defaultValue={2} /></label>
        <button type="submit">Registrar conclusão</button>
        <button type="button" onClick={() => dialogo.current?.close()}>Cancelar</button>
      </form>}
    </dialog>
  </main>;
}
