import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  concluirAcompanhamentoParceiro,
  criarAcompanhamentoParceiro,
  listarAcompanhamentosParceiro,
  type AcompanhamentoParceiro,
  type TipoAcompanhamentoParceiro,
} from "../../services/acompanhamentoParceiroService";
import "./AcompanhamentoAlunoParceiro.css";

type Props = {
  userId: string;
  alunoNome: string;
};

export default function AcompanhamentoAlunoParceiro({ userId, alunoNome }: Props) {
  const [itens, setItens] = useState<AcompanhamentoParceiro[]>([]);
  const [tipo, setTipo] = useState<TipoAcompanhamentoParceiro>("observacao");
  const [texto, setTexto] = useState("");
  const [enviarAoAluno, setEnviarAoAluno] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState("");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  const carregar = useCallback(async () => {
    if (!userId) return;
    try {
      setCarregando(true);
      setErro("");
      setItens(await listarAcompanhamentosParceiro(userId));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar o acompanhamento.");
    } finally {
      setCarregando(false);
    }
  }, [userId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const abertos = useMemo(() => itens.filter((item) => item.status === "aberto"), [itens]);
  const concluidos = itens.length - abertos.length;

  async function registrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const conteudo = texto.trim();
    if (conteudo.length < 3) {
      setErro("Escreva pelo menos 3 caracteres para registrar o acompanhamento.");
      return;
    }

    try {
      setProcessando("novo");
      setErro("");
      setMensagem("");
      await criarAcompanhamentoParceiro({
        userId,
        tipo,
        texto: conteudo,
        enviarAoAluno: tipo === "orientacao" && enviarAoAluno,
      });
      setTexto("");
      setEnviarAoAluno(false);
      setMensagem(
        tipo === "orientacao" && enviarAoAluno
          ? `Orientação registrada e enviada para ${alunoNome} pelo sino de notificações.`
          : "Acompanhamento registrado no histórico do aluno."
      );
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível registrar o acompanhamento.");
    } finally {
      setProcessando("");
    }
  }

  async function concluir(item: AcompanhamentoParceiro) {
    try {
      setProcessando(item.id);
      setErro("");
      setMensagem("");
      await concluirAcompanhamentoParceiro(item.id);
      setMensagem("Acompanhamento marcado como concluído.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível concluir o acompanhamento.");
    } finally {
      setProcessando("");
    }
  }

  function mudarTipo(novoTipo: TipoAcompanhamentoParceiro) {
    setTipo(novoTipo);
    if (novoTipo !== "orientacao") setEnviarAoAluno(false);
  }

  return (
    <section className="acompanhamento-parceiro mentoria-aluno-card">
      <div className="acompanhamento-parceiro-topo">
        <div>
          <span>ACOMPANHAMENTO DO MENTOR</span>
          <h2>Intervenções e orientações</h2>
          <p>
            Registre observações internas, crie um plano de ação ou envie uma orientação direta para o aluno.
          </p>
        </div>
        <div className="acompanhamento-parceiro-resumo" aria-label="Resumo do acompanhamento">
          <b>{abertos.length} aberto{abertos.length === 1 ? "" : "s"}</b>
          <small>{concluidos} concluído{concluidos === 1 ? "" : "s"}</small>
        </div>
      </div>

      {erro && <div className="acompanhamento-parceiro-aviso erro" role="alert">{erro}</div>}
      {mensagem && <div className="acompanhamento-parceiro-aviso sucesso" role="status">{mensagem}</div>}

      <form className="acompanhamento-parceiro-form" onSubmit={registrar}>
        <label>
          Tipo de ação
          <select value={tipo} onChange={(e) => mudarTipo(e.target.value as TipoAcompanhamentoParceiro)}>
            <option value="observacao">Observação interna</option>
            <option value="plano_acao">Plano de ação</option>
            <option value="orientacao">Orientação ao aluno</option>
          </select>
        </label>

        <label className="acompanhamento-parceiro-texto">
          {tipo === "observacao" ? "Anotação" : tipo === "plano_acao" ? "Plano" : "Orientação"}
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={2000}
            rows={4}
            placeholder={
              tipo === "observacao"
                ? "Ex.: aluno caiu de ritmo após a última semana; revisar novamente em 5 dias."
                : tipo === "plano_acao"
                  ? "Ex.: 30 min de Constitucional + 20 questões por dia até sexta-feira."
                  : "Ex.: priorize as revisões atrasadas hoje e retome a rota amanhã."
            }
          />
          <small>{texto.length}/2000 caracteres</small>
        </label>

        {tipo === "orientacao" && (
          <label className="acompanhamento-parceiro-envio">
            <input
              type="checkbox"
              checked={enviarAoAluno}
              onChange={(e) => setEnviarAoAluno(e.target.checked)}
            />
            <span>
              <strong>Enviar para o aluno</strong>
              <small>A orientação aparecerá no sino de notificações e levará para o Cronograma IA.</small>
            </span>
          </label>
        )}

        <button type="submit" disabled={processando === "novo" || texto.trim().length < 3}>
          {processando === "novo"
            ? "Registrando..."
            : tipo === "orientacao" && enviarAoAluno
              ? "Registrar e enviar orientação"
              : "Registrar acompanhamento"}
        </button>
      </form>

      <div className="acompanhamento-parceiro-historico">
        <div className="acompanhamento-parceiro-historico-topo">
          <h3>Histórico de intervenções</h3>
          <small>{itens.length} registro{itens.length === 1 ? "" : "s"}</small>
        </div>

        {carregando ? (
          <div className="acompanhamento-parceiro-vazio">Carregando histórico...</div>
        ) : itens.length === 0 ? (
          <div className="acompanhamento-parceiro-vazio">
            Nenhuma intervenção registrada para este aluno ainda.
          </div>
        ) : (
          <div className="acompanhamento-parceiro-lista">
            {itens.map((item) => (
              <article key={item.id} className={`acompanhamento-parceiro-item ${item.status}`}>
                <div className="acompanhamento-parceiro-item-topo">
                  <div>
                    <span className={`tipo ${item.tipo}`}>{rotuloTipo(item.tipo)}</span>
                    <b className={`status ${item.status}`}>{item.status === "aberto" ? "Aberto" : "Concluído"}</b>
                    {item.enviadoAoAluno && <b className="enviado">Enviado ao aluno</b>}
                  </div>
                  <time>{formatarDataHora(item.criadoEm)}</time>
                </div>
                <p>{item.texto}</p>
                <footer>
                  <small>
                    Por {item.criadoPorNome}
                    {item.concluidoEm ? ` · concluído em ${formatarDataHora(item.concluidoEm)}` : ""}
                  </small>
                  {item.status === "aberto" && (
                    <button
                      type="button"
                      disabled={processando === item.id}
                      onClick={() => void concluir(item)}
                    >
                      {processando === item.id ? "Concluindo..." : "Marcar como acompanhado"}
                    </button>
                  )}
                </footer>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function rotuloTipo(tipo: TipoAcompanhamentoParceiro) {
  if (tipo === "plano_acao") return "Plano de ação";
  if (tipo === "orientacao") return "Orientação";
  return "Observação";
}

function formatarDataHora(valor: string) {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "data não informada";
  return data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
