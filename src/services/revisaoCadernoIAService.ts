import { armazenamentoLocalDaConta as localStorage } from "./armazenamentoConta";
import { supabase } from "../lib/supabase";
import type { CadernoSimuladoIA } from "./cadernosSimuladosIAService";
import {
  consolidarTentativasRevisao,
  normalizarTentativaRevisao,
  possuiCorrecaoCompleta,
  recuperarRespostasDaTentativa,
  type LinhaRespostaIA,
  type TentativaRevisaoIA,
} from "../utils/revisaoCadernoIA";

const CAMPOS = "id,local_id,data,certas,erradas,em_branco,percentual,dados";

export async function carregarRevisoesCadernoIA(caderno: CadernoSimuladoIA) {
  let aviso = "";
  let locais: TentativaRevisaoIA[] = [];
  try {
    const salvos: unknown = JSON.parse(localStorage.getItem("pmpe_resultados_simulados_ia") || "[]");
    if (Array.isArray(salvos)) locais = salvos.map(normalizarTentativaRevisao).filter((r): r is TentativaRevisaoIA => Boolean(r));
  } catch { /* O histórico online pode recuperar um cache local ilegível. */ }

  const consultas = [supabase.from("resultados_simulados_ia").select(CAMPOS)
    .eq("dados->>cadernoId", caderno.id).order("data", { ascending: false }).limit(100)];
  if (caderno.estatisticas?.ultimaTentativaEm) {
    consultas.push(supabase.from("resultados_simulados_ia").select(CAMPOS)
      .eq("data", caderno.estatisticas.ultimaTentativaEm).limit(10));
  }
  const resultados = await Promise.all(consultas);
  const remotas: TentativaRevisaoIA[] = [];
  for (const { data, error } of resultados) {
    if (error) { aviso = "Não foi possível consultar todo o histórico online. Exibindo os resultados disponíveis neste dispositivo."; continue; }
    for (const linha of data ?? []) {
      const normalizada = normalizarTentativaRevisao({
        ...linha.dados,
        id: linha.local_id || linha.id,
        data: linha.data,
        certas: linha.certas,
        erradas: linha.erradas,
        emBranco: linha.em_branco,
        percentual: linha.percentual,
      });
      if (normalizada) remotas.push(normalizada);
    }
  }
  let tentativas = consolidarTentativasRevisao(caderno, locais, remotas);
  if (!tentativas.length && caderno.estatisticas) {
    const e = caderno.estatisticas;
    tentativas = [{ id: `legado:${caderno.id}`, cadernoId: caderno.id, data: e.ultimaTentativaEm,
      total: e.acertos + e.erros + e.emBranco, certas: e.acertos, erradas: e.erros,
      emBranco: e.emBranco, percentual: e.aproveitamento }];
  }

  // O lote antigo é recuperado somente para a última tentativa do caderno.
  const ultima = tentativas[0];
  if (ultima && !possuiCorrecaoCompleta(ultima)) {
    const questoes = ultima.questoes ?? caderno.questoes;
    const ids = questoes.map((q) => q.id).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
    if (ids.length === questoes.length && ids.length > 0) {
      const data = Date.parse(ultima.data);
      const { data: respostas, error } = await supabase.from("respostas_questoes_ia")
        .select("questao_id,resposta,respondida_em").in("questao_id", ids)
        .gte("respondida_em", new Date(data - 120000).toISOString())
        .lte("respondida_em", new Date(data + 120000).toISOString()).limit(1000);
      if (error) aviso = "Não foi possível carregar as respostas antigas agora. Tente novamente.";
      else {
        const recuperadas = recuperarRespostasDaTentativa(ultima, questoes, (respostas ?? []) as LinhaRespostaIA[]);
        if (recuperadas) tentativas[0] = { ...ultima, questoes, respostas: recuperadas, recuperada: true };
      }
    }
  }
  return { tentativas, aviso };
}
