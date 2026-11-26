import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { usePlanoAtivo } from "../../hooks/usePlanoAtivo";
import { useFsrsCompartilhado } from "./contextoFsrsCompartilhado";
import { combinarObservacoes } from "../../services/inteligenciaRevisao/sincronizacao";
import { observarQuestoesIA, observarSessoes } from "../../services/inteligenciaRevisao/eventos";
import { versaoMemoria, type DiarioMemoria } from "../../services/inteligenciaRevisao/memoria";
import { armazenamentoSessaoDaConta } from "../../services/armazenamentoConta";
import { indexarPlanoPorData } from "../../utils/planoAtivo";
import type { ConfiguracoesComEdital, DiaSemanaId } from "../../types/editalInteligente";
import type { Compromisso } from "../../services/inteligenciaRevisao/agenda";
import PlanejamentoAdaptativo, { type PreferenciasAdaptativas } from "./PlanejamentoAdaptativo";

const dias: DiaSemanaId[] = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

export default function PlanejamentoDaConta({ modo }: { modo: "revisoes" | "calendario" }) {
  const { usuario } = useAuth();
  const sync = useFsrsCompartilhado();
  const { materias, sessoes, questoes, revisoes, configuracoes, missoesConcluidas } = useApp();
  const planoAtivo = usePlanoAtivo();
  const navigate = useNavigate();
  const edital = configuracoes as ConfiguracoesComEdital;
  const [relogio, marcarHora] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => marcarHora(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const fim = sessoes.at(-1)?.finalizadaEm ?? "";
  const agora = useMemo(() => new Date(Math.max(+relogio, Math.min(Date.now(), Date.parse(fim) || 0))), [relogio, fim]);
  const diario = useMemo<DiarioMemoria>(() => ({ versao: versaoMemoria, retencao: sync?.fila.confirmado?.checkpoint?.diario.retencao ?? 0.9,
    observacoes: usuario ? combinarObservacoes(observarSessoes(usuario.id, sessoes), observarQuestoesIA(usuario.id, questoes),
      sync?.fila.confirmado?.eventos ?? [], sync?.fila.pendentes ?? []) : [] }), [usuario, sessoes, questoes, sync?.fila]);
  const compromissos = useMemo(() => {
    const feitas = new Set(missoesConcluidas);
    const eventos: Compromisso[] = [];
    for (const [dia, item] of indexarPlanoPorData(planoAtivo, configuracoes.dataInicioPlano)) {
      for (const missao of item.missoes) {
        if (feitas.has(missao.id)) continue;
        eventos.push({ id: missao.id, dia, titulo: missao.assunto || missao.materia,
          tipo: missao.tipo === "simulado" ? "simulado" : missao.tipo === "redacao" ? "compromisso" : "aula",
          minutos: missao.tipo === "simulado" ? 60 : 30 });
      }
    }
    return eventos;
  }, [planoAtivo, configuracoes.dataInicioPlano, missoesConcluidas]);

  const disponiveis = edital.diasEstudo;
  const limites = useMemo(() => ({
    minutos: configuracoes.metaMinutosDiaria, revisoes: configuracoes.metaRevisoesDiaria,
    semana: dias.flatMap((dia, i) => (disponiveis?.includes(dia) ?? (i !== 0)) ? [i] : []),
  }), [configuracoes.metaMinutosDiaria, configuracoes.metaRevisoesDiaria, disponiveis]);
  const epoca = configuracoes.dadosReiniciadosEm ?? "inicial";
  const usuarioId = usuario?.id;
  const checkpoint = useMemo(() => {
    const contas = String(import.meta.env.VITE_FSRS_CHECKPOINT_CONTAS ?? "").split(",").map(conta => conta.trim());
    return import.meta.env.DEV && usuarioId && contas.includes(usuarioId) ? { usuarioId, epoca } : undefined;
  }, [usuarioId, epoca]);
  const cache = `pmpe:${usuario?.id ?? "sem-usuario"}:fsrs-preferencias-v1:${configuracoes.dadosReiniciadosEm ?? "inicial"}`;
  if (!import.meta.env.DEV && !sync) return null;
  return <PainelComPreferencias key={cache} cache={cache} modo={modo} checkpoint={checkpoint} compartilhar={!!sync} materias={materias} revisoes={revisoes}
    agora={agora} diario={diario} compromissos={compromissos} edital={edital.editalAtivo?.analise}
    prova={configuracoes.dataProva} limites={limites} estudar={(item, plano) => {
      const id = plano.dados.get(item.unidadeId)?.revisaoLegadaId;
      if (id) {
        navigate("/revisoes", { state: { revisaoId: id } });
        return;
      }
      const [, materiaId, moduloId, assuntoId, , aulaId] = JSON.parse(item.unidadeId) as string[];
      armazenamentoSessaoDaConta.setItem("pmpe:central-estudos:prefill", JSON.stringify({
        materia: item.materia, assunto: item.assunto, materiaId, moduloId, assuntoId, aulaId,
        tipo: "questoes", objetivo: `Revisar ${item.assunto}`,
      }));
      navigate("/central-estudos");
    }} />;
}

function PainelComPreferencias({ cache, ...props }: ComponentProps<typeof PlanejamentoAdaptativo> & { cache: string }) {
  const [preferencias, salvarPreferencias] = useLocalStorage<PreferenciasAdaptativas>(cache, {});
  return <PlanejamentoAdaptativo {...props} preferencias={preferencias} salvarPreferencias={salvarPreferencias} />;
}
