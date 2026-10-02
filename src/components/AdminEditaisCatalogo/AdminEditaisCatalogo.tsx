import { useCallback, useEffect, useMemo, useState } from "react";

import "./AdminEditaisCatalogo.css";

import {
  abrirFonteEditalCatalogo,
  alterarStatusEditalCatalogo,
  carregarEditaisCatalogo,
  contarAssuntosCatalogo,
  criarEditalCatalogo,
  removerEditalCatalogo,
} from "../../services/catalogoEditaisService";
import { analisarPdfEdital } from "../../services/editalInteligenteService";
import type {
  EditalCatalogo,
  GrupoCargoEditalCatalogo,
} from "../../types/catalogoEditais";
import type { AnaliseEdital } from "../../types/editalInteligente";
import { useToast } from "../../context/ToastContext";

type FormularioEdital = {
  organizacao: string;
  nome: string;
  uf: string;
  ano: string;
  grupoCargo: GrupoCargoEditalCatalogo;
  cargo: string;
  codigoCargo: string;
  banca: string;
  fonteUrl: string;
};

const formularioInicial: FormularioEdital = {
  organizacao: "PMPE",
  nome: "Polícia Militar de Pernambuco",
  uf: "PE",
  ano: String(new Date().getFullYear()),
  grupoCargo: "soldado",
  cargo: "Soldado PMPE",
  codigoCargo: "",
  banca: "Instituto AOCP",
  fonteUrl: "",
};

export default function AdminEditaisCatalogo() {
  const { showToast } = useToast();
  const [editais, setEditais] = useState<EditalCatalogo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [erro, setErro] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [analise, setAnalise] = useState<AnaliseEdital | null>(null);
  const [formulario, setFormulario] =
    useState<FormularioEdital>(formularioInicial);

  const recarregar = useCallback(async () => {
    try {
      setCarregando(true);
      setErro("");
      setEditais(await carregarEditaisCatalogo());
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os editais."
      );
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const editaisAdmin = useMemo(
    () => editais.filter((edital) => edital.origem === "admin"),
    [editais]
  );

  async function analisar() {
    if (!arquivo) {
      showToast("Selecione o PDF que será publicado no catálogo.", "warning");
      return;
    }

    if (!formulario.organizacao.trim() || !formulario.cargo.trim()) {
      showToast("Informe a corporação e o cargo antes de analisar.", "warning");
      return;
    }

    try {
      setAnalisando(true);
      setErro("");
      const resultado = await analisarPdfEdital(arquivo, {
        concurso:
          formulario.nome.trim() || formulario.organizacao.trim(),
        banca: formulario.banca.trim(),
        cargo: formulario.cargo.trim(),
      });
      setAnalise(resultado);
      showToast(
        "PDF analisado. Confira o resumo e publique quando estiver correto.",
        "success"
      );
    } catch (error) {
      const mensagem =
        error instanceof Error
          ? error.message
          : "Não foi possível analisar o edital.";
      setErro(mensagem);
      showToast(mensagem, "error");
    } finally {
      setAnalisando(false);
    }
  }

  async function publicar() {
    if (!arquivo || !analise) {
      showToast("Analise o PDF antes de publicar.", "warning");
      return;
    }

    const ano = Number(formulario.ano);
    if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) {
      showToast("Informe um ano válido.", "warning");
      return;
    }

    try {
      setSalvando(true);
      setErro("");

      await criarEditalCatalogo(
        {
          organizacao: formulario.organizacao,
          nome: formulario.nome,
          uf: formulario.uf,
          ano,
          carreira: "policia_militar",
          grupoCargo: formulario.grupoCargo,
          cargo: formulario.cargo,
          codigoCargo: formulario.codigoCargo,
          banca: formulario.banca,
          fonteUrl: formulario.fonteUrl,
          analise,
          publicar: true,
        },
        arquivo
      );

      setArquivo(null);
      setAnalise(null);
      setFormulario(formularioInicial);
      await recarregar();
      showToast("Edital publicado para todos os alunos.", "success");
    } catch (error) {
      const mensagem =
        error instanceof Error
          ? error.message
          : "Não foi possível publicar o edital.";
      setErro(mensagem);
      showToast(mensagem, "error");
    } finally {
      setSalvando(false);
    }
  }

  async function mudarStatus(edital: EditalCatalogo) {
    const novoStatus =
      edital.status === "publicado" ? "arquivado" : "publicado";

    try {
      await alterarStatusEditalCatalogo(edital.id, novoStatus);
      await recarregar();
      showToast(
        novoStatus === "publicado"
          ? "Edital publicado novamente."
          : "Edital arquivado.",
        "success"
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Não foi possível alterar o edital.",
        "error"
      );
    }
  }

  async function excluir(edital: EditalCatalogo) {
    if (
      !window.confirm(
        `Excluir ${edital.organizacao} ${edital.ano} · ${edital.cargo} do catálogo?`
      )
    ) {
      return;
    }

    try {
      await removerEditalCatalogo(edital);
      await recarregar();
      showToast("Edital removido do catálogo.", "success");
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "Não foi possível remover o edital.",
        "error"
      );
    }
  }

  function atualizar<K extends keyof FormularioEdital>(
    campo: K,
    valor: FormularioEdital[K]
  ) {
    setFormulario((atual) => ({ ...atual, [campo]: valor }));
    if (campo === "cargo" || campo === "banca" || campo === "nome") {
      setAnalise(null);
    }
  }

  return (
    <section className="admin-editais">
      <div className="admin-editais-topo">
        <div>
          <span>CATÁLOGO GLOBAL</span>
          <h2>Editais pré-definidos</h2>
          <p>
            Cadastre uma vez. Depois todos os alunos enxergam o edital
            publicado em Meu Edital.
          </p>
        </div>
        <strong>{editais.length} no catálogo</strong>
      </div>

      <div className="admin-editais-grid">
        <article className="admin-editais-formulario">
          <h3>Adicionar edital policial</h3>
          <div className="admin-editais-campos">
            <label>
              <span>Corporação</span>
              <input
                value={formulario.organizacao}
                onChange={(evento) =>
                  atualizar("organizacao", evento.target.value)
                }
                placeholder="PMPE, PMCE, PMES..."
              />
            </label>
            <label>
              <span>Nome completo</span>
              <input
                value={formulario.nome}
                onChange={(evento) => atualizar("nome", evento.target.value)}
                placeholder="Polícia Militar de..."
              />
            </label>
            <label>
              <span>UF</span>
              <input
                value={formulario.uf}
                maxLength={8}
                onChange={(evento) =>
                  atualizar("uf", evento.target.value.toUpperCase())
                }
                placeholder="PE"
              />
            </label>
            <label>
              <span>Ano</span>
              <input
                inputMode="numeric"
                value={formulario.ano}
                onChange={(evento) => atualizar("ano", evento.target.value)}
              />
            </label>
            <label>
              <span>Bloco</span>
              <select
                value={formulario.grupoCargo}
                onChange={(evento) =>
                  atualizar(
                    "grupoCargo",
                    evento.target.value as GrupoCargoEditalCatalogo
                  )
                }
              >
                <option value="soldado">PM — Soldado</option>
                <option value="oficial">PM — Oficial</option>
                <option value="outro">Outro</option>
              </select>
            </label>
            <label>
              <span>Cargo</span>
              <input
                value={formulario.cargo}
                onChange={(evento) => atualizar("cargo", evento.target.value)}
                placeholder="Soldado PMCE"
              />
            </label>
            <label>
              <span>Código do cargo</span>
              <input
                value={formulario.codigoCargo}
                onChange={(evento) =>
                  atualizar("codigoCargo", evento.target.value)
                }
                placeholder="Opcional"
              />
            </label>
            <label>
              <span>Banca</span>
              <input
                value={formulario.banca}
                onChange={(evento) => atualizar("banca", evento.target.value)}
                placeholder="Instituto AOCP"
              />
            </label>
            <label className="admin-editais-campo-largo">
              <span>Fonte oficial</span>
              <input
                value={formulario.fonteUrl}
                onChange={(evento) =>
                  atualizar("fonteUrl", evento.target.value)
                }
                placeholder="https://..."
              />
            </label>
          </div>

          <label className="admin-editais-upload">
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(evento) => {
                setArquivo(evento.target.files?.[0] ?? null);
                setAnalise(null);
              }}
            />
            <strong>{arquivo?.name ?? "Selecionar PDF do edital"}</strong>
            <span>
              {arquivo
                ? `${(arquivo.size / 1024 / 1024).toFixed(1)} MB`
                : "PDF completo ou verticalizado, até 25 MB"}
            </span>
          </label>

          <button
            type="button"
            className="admin-editais-botao"
            disabled={!arquivo || analisando || salvando}
            onClick={() => void analisar()}
          >
            {analisando ? "Analisando..." : "1. Analisar PDF"}
          </button>

          {analise && (
            <div className="admin-editais-analise">
              <strong>{analise.cargoDetectado ?? formulario.cargo}</strong>
              <span>
                {analise.materias.length} matérias ·{" "}
                {analise.materias.reduce(
                  (total, materia) => total + materia.assuntos.length,
                  0
                )}{" "}
                assuntos
              </span>
              <small>
                Confira o cargo e a quantidade antes de publicar. O PDF e a
                análise serão reutilizados por todos os alunos.
              </small>
            </div>
          )}

          <button
            type="button"
            className="admin-editais-botao admin-editais-publicar"
            disabled={!analise || !arquivo || analisando || salvando}
            onClick={() => void publicar()}
          >
            {salvando ? "Publicando..." : "2. Publicar no catálogo"}
          </button>

          {erro && <div className="admin-editais-erro">{erro}</div>}
        </article>

        <article className="admin-editais-lista">
          <div className="admin-editais-lista-topo">
            <div>
              <h3>Editais disponíveis</h3>
              <p>
                Os dois PMPE 2026 vêm embarcados. Os próximos são gerenciados
                daqui.
              </p>
            </div>
            {carregando && <span>Atualizando...</span>}
          </div>

          <div className="admin-editais-itens">
            {editais.map((edital) => (
              <div className="admin-edital-item" key={edital.id}>
                <div>
                  <span>
                    {edital.grupoCargo === "soldado"
                      ? "SOLDADO"
                      : edital.grupoCargo === "oficial"
                        ? "OFICIAL"
                        : "OUTRO"}
                  </span>
                  <strong>
                    {edital.organizacao} {edital.ano} · {edital.cargo}
                  </strong>
                  <small>
                    {edital.banca ?? "Banca não informada"} ·{" "}
                    {edital.analise.materias.length} matérias ·{" "}
                    {contarAssuntosCatalogo(edital)} assuntos
                  </small>
                </div>
                <div className="admin-edital-item-acoes">
                  <button
                    type="button"
                    onClick={() => void abrirFonteEditalCatalogo(edital)}
                  >
                    Abrir
                  </button>
                  {edital.origem === "sistema" ? (
                    <span className="admin-edital-sistema">Sistema</span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => void mudarStatus(edital)}
                      >
                        {edital.status === "publicado"
                          ? "Arquivar"
                          : "Publicar"}
                      </button>
                      <button
                        type="button"
                        className="perigo"
                        onClick={() => void excluir(edital)}
                      >
                        Excluir
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}

            {!carregando && editaisAdmin.length === 0 && (
              <small className="admin-editais-dica">
                Nenhum edital extra cadastrado ainda. Quando surgir PMCE,
                PMES ou outro concurso, publique pelo formulário ao lado.
              </small>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
