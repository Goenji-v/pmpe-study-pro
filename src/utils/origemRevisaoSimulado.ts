import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { listarAnalisesSimulados } from "../services/analisesSimuladosService";
import type { Revisao } from "../types";

type Catalogo = Record<string, string>;

/** Rótulo de origem apenas para revisões realmente ligadas a um simulado.
 * A falta de nome nos registros antigos não autoriza inventar um título.
 */
export function rotuloOrigemRevisaoSimulado(
  revisao: Revisao,
  nomesPorTentativa: Catalogo = {}
): string | null {
  const origem = revisao.origemSimulado;
  if (!origem?.tentativaId) return null;
  const nome = (origem.nome || nomesPorTentativa[origem.tentativaId] || "").trim();
  return nome ? `Revisão de erros · ${nome}` : "Revisão de erros · Simulado";
}

/** Resolve em leitura o nome de revisões históricas, sem reescrever a agenda.
 * As revisões novas já carregam o nome e não precisam dessa consulta.
 */
export function useNomesSimuladosDeRevisoes(revisoes: Revisao[]): Catalogo {
  const { usuario } = useAuth();
  const usuarioId = usuario?.id ?? "";
  const idsSemNome = [...new Set(
    revisoes
      .filter((item) => item.origemSimulado?.tentativaId && !item.origemSimulado.nome)
      .map((item) => item.origemSimulado!.tentativaId)
  )].sort().join("|");
  const [resultado, setResultado] = useState<{ usuarioId: string; nomes: Catalogo }>({
    usuarioId: "",
    nomes: {},
  });

  useEffect(() => {
    if (!usuarioId || !idsSemNome) return;
    let ativo = true;
    const ids = new Set(idsSemNome.split("|"));
    void listarAnalisesSimulados(200)
      .then((analises) => {
        if (!ativo) return;
        const nomes: Catalogo = {};
        for (const analise of analises) {
          if (ids.has(analise.tentativaId) && analise.nome.trim()) {
            nomes[analise.tentativaId] = analise.nome;
          }
        }
        setResultado({ usuarioId, nomes });
      })
      .catch(() => {
        // A revisão continua visível com o rótulo genérico.
      });
    return () => {
      ativo = false;
    };
  }, [idsSemNome, usuarioId]);

  return resultado.usuarioId === usuarioId ? resultado.nomes : {};
}
