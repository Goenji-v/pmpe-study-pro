import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import "./Loja.css";

import { useApp } from "../../context/AppContext";
import { useToast } from "../../context/ToastContext";
import { useAdminStatus } from "../../hooks/useAdminStatus";
import {
  obterEstadoEconomia,
  type ConfiguracoesComEconomia,
} from "../../services/economiaGamificacao";
import {
  definirFundoLojaAtivo,
  listarFundosLoja,
  obterUrlPublicaFundo,
  publicarFundoLoja,
  type FundoLojaRegistro,
  type NovoFundoLoja,
} from "../../services/fundosLojaService";
import {
  CATALOGO_LOJA,
  comprarItemLoja,
  desequiparTipoLoja,
  encontrarItemLoja,
  equiparItemLoja,
  itemEstaEquipado,
  itensDoInventario,
  type ItemLoja,
  type RaridadeItemLoja,
  type TipoItemLoja,
} from "../../services/lojaGamificacao";

type Aba = "loja" | "inventario";
type Filtro = "todos" | TipoItemLoja;
type ConfiguracoesLoja = ConfiguracoesComEconomia & {
  fundoDashboard?: {
    id: string;
    nome: string;
    url: string;
  } | null;
};

const FILTROS: Array<{ id: Filtro; nome: string }> = [
  { id: "todos", nome: "Todos" },
  { id: "fundo", nome: "Fundos do painel" },
  { id: "moldura", nome: "Molduras" },
  { id: "tema", nome: "Temas" },
];

export default function Loja() {
  const navigate = useNavigate();
  const { configuracoes, setConfiguracoes } = useApp();
  const { showToast } = useToast();
  const { administrador } = useAdminStatus();
  const [aba, setAba] = useState<Aba>("loja");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [fundos, setFundos] = useState<FundoLojaRegistro[]>([]);
  const [carregandoFundos, setCarregandoFundos] = useState(true);
  const [erroFundos, setErroFundos] = useState("");

  const economia = useMemo(() => obterEstadoEconomia(configuracoes), [configuracoes]);
  const fundoEquipado = (configuracoes as ConfiguracoesLoja).fundoDashboard;

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        setCarregandoFundos(true);
        setErroFundos("");
        const dados = await listarFundosLoja(administrador);
        if (ativo) setFundos(dados);
      } catch (error) {
        if (ativo) {
          setErroFundos(error instanceof Error ? error.message : "Não foi possível carregar os fundos.");
        }
      } finally {
        if (ativo) setCarregandoFundos(false);
      }
    }

    void carregar();
    return () => {
      ativo = false;
    };
  }, [administrador]);

  const catalogo = useMemo<ItemLoja[]>(() => {
    const fundosCatalogo = fundos.map<ItemLoja>((fundo) => ({
      id: `fundo-${fundo.id}`,
      tipo: "fundo",
      nome: fundo.nome,
      descricao: fundo.descricao || "Fundo premium para o topo do Dashboard.",
      preco: fundo.preco,
      raridade: fundo.raridade,
      icone: "🖼️",
      valorVisual: obterUrlPublicaFundo(fundo.imagem_path),
      ativo: fundo.ativo,
    }));

    return [...CATALOGO_LOJA, ...fundosCatalogo];
  }, [fundos]);

  const inventario = useMemo(() => itensDoInventario(economia, catalogo), [economia, catalogo]);

  const itensVisiveis = useMemo(() => {
    const origem = aba === "loja" ? catalogo.filter((item) => item.ativo !== false) : inventario;
    if (filtro === "todos") return origem;
    return origem.filter((item) => item.tipo === filtro);
  }, [aba, catalogo, filtro, inventario]);

  const moldura = encontrarItemLoja(economia.molduraEquipada, catalogo);
  const tema = encontrarItemLoja(economia.temaEquipado, catalogo);
  const fundo = fundoEquipado ? catalogo.find((item) => item.id === fundoEquipado.id) : undefined;

  function salvarEconomia(proximaEconomia: ReturnType<typeof obterEstadoEconomia>) {
    setConfiguracoes((atuais) => ({
      ...atuais,
      economia: proximaEconomia,
    }) as ConfiguracoesComEconomia);
  }

  function estaEquipado(item: ItemLoja) {
    if (item.tipo === "fundo") return fundoEquipado?.id === item.id;
    return itemEstaEquipado(economia, item);
  }

  function comprar(item: ItemLoja) {
    const resultado = comprarItemLoja(economia, item.id, new Date(), catalogo);
    if (resultado.erro) {
      showToast(resultado.erro, resultado.estado.moedas < item.preco ? "warning" : "info");
      return;
    }

    salvarEconomia(resultado.estado);
    showToast(`${item.nome} foi adicionado ao seu inventário.`);
  }

  function equipar(item: ItemLoja) {
    if (item.tipo === "fundo") {
      if (!(economia.inventario ?? []).includes(item.id)) {
        showToast("Compre este fundo antes de equipar.", "warning");
        return;
      }

      const jaEquipado = fundoEquipado?.id === item.id;
      setConfiguracoes((atuais) => ({
        ...atuais,
        fundoDashboard: jaEquipado
          ? null
          : {
              id: item.id,
              nome: item.nome,
              url: item.valorVisual,
            },
      }) as ConfiguracoesLoja);
      showToast(jaEquipado ? `${item.nome} foi desequipado.` : `${item.nome} equipado.`, jaEquipado ? "info" : "success");
      return;
    }

    if (itemEstaEquipado(economia, item)) {
      salvarEconomia(desequiparTipoLoja(economia, item.tipo));
      showToast(`${item.nome} foi desequipado.`, "info");
      return;
    }

    const resultado = equiparItemLoja(economia, item.id, new Date(), catalogo);
    if (resultado.erro) {
      showToast(resultado.erro, "warning");
      return;
    }

    salvarEconomia(resultado.estado);
    showToast(`${item.nome} equipado.`);
  }

  async function recarregarFundos() {
    const dados = await listarFundosLoja(administrador);
    setFundos(dados);
  }

  async function publicarFundo(entrada: NovoFundoLoja) {
    await publicarFundoLoja(entrada);
    await recarregarFundos();
    showToast(`${entrada.nome} foi publicado na loja.`);
  }

  async function alternarFundo(fundoRegistro: FundoLojaRegistro) {
    await definirFundoLojaAtivo(fundoRegistro.id, !fundoRegistro.ativo);
    await recarregarFundos();
    showToast(
      fundoRegistro.ativo
        ? `${fundoRegistro.nome} foi ocultado da loja.`
        : `${fundoRegistro.nome} voltou para a loja.`,
      "info"
    );
  }

  return (
    <div className="loja-page">
      <section className="loja-hero">
        <div>
          <span className="loja-kicker">ECONOMIA STUDY PRO</span>
          <h1>Loja & Inventário</h1>
          <p>
            Use as moedas conquistadas estudando para personalizar o Study Pro.
            Agora os fundos do Dashboard também podem ser comprados, guardados e equipados.
          </p>
        </div>

        <div className="loja-saldo" aria-label={`${economia.moedas} moedas disponíveis`}>
          <span>🪙</span>
          <div>
            <strong>{economia.moedas}</strong>
            <small>moedas disponíveis</small>
          </div>
        </div>
      </section>

      <section className="loja-equipados" aria-label="Personalização equipada">
        <button type="button" className="loja-equipado-item" onClick={() => navigate("/conquistas")}>
          <span>Título</span>
          <strong>🏆 Desbloqueado em Conquistas</strong>
        </button>
        <ResumoEquipado rotulo="Fundo" item={fundo} fallback={fundoEquipado?.nome ?? "PMPE padrão"} />
        <ResumoEquipado rotulo="Moldura" item={moldura} fallback="Moldura padrão" />
        <ResumoEquipado rotulo="Tema" item={tema} fallback="Azul padrão" />
      </section>

      {administrador && (
        <GerenciadorFundos
          fundos={fundos}
          carregando={carregandoFundos}
          erro={erroFundos}
          onPublicar={publicarFundo}
          onAlternar={alternarFundo}
        />
      )}

      <div className="loja-controles">
        <div className="loja-tabs" role="tablist" aria-label="Loja e inventário">
          <button
            type="button"
            className={aba === "loja" ? "loja-tab loja-tab-ativa" : "loja-tab"}
            onClick={() => setAba("loja")}
          >
            🛍️ Loja
          </button>
          <button
            type="button"
            className={aba === "inventario" ? "loja-tab loja-tab-ativa" : "loja-tab"}
            onClick={() => setAba("inventario")}
          >
            🎒 Inventário <span>{inventario.length}</span>
          </button>
        </div>

        <div className="loja-filtros" aria-label="Filtrar itens">
          {FILTROS.map((opcao) => (
            <button
              type="button"
              key={opcao.id}
              className={filtro === opcao.id ? "ativo" : ""}
              onClick={() => setFiltro(opcao.id)}
            >
              {opcao.nome}
            </button>
          ))}
        </div>
      </div>

      {carregandoFundos && aba === "loja" && filtro === "fundo" ? (
        <section className="loja-vazio"><div>🖼️</div><h2>Carregando fundos...</h2></section>
      ) : itensVisiveis.length > 0 ? (
        <section className="loja-grid">
          {itensVisiveis.map((item) => {
            const possui = (economia.inventario ?? []).includes(item.id);
            const equipado = estaEquipado(item);
            const saldoInsuficiente = economia.moedas < item.preco;

            return (
              <article
                key={item.id}
                className={`loja-card raridade-${item.raridade} ${equipado ? "loja-card-equipado" : ""}`}
              >
                <div className="loja-card-topo">
                  <span className="loja-card-icone" aria-hidden="true">{item.icone}</span>
                  <span className={`loja-raridade raridade-${item.raridade}`}>{nomeRaridade(item.raridade)}</span>
                </div>

                <div className="loja-card-corpo">
                  <small>{nomeTipo(item.tipo)}</small>
                  <h2>{item.nome}</h2>
                  <p>{item.descricao}</p>
                  <PreviewItem item={item} />
                </div>

                <div className="loja-card-rodape">
                  {aba === "loja" && !possui ? (
                    <>
                      <div className="loja-preco">
                        <span>🪙</span>
                        <strong>{item.preco}</strong>
                      </div>
                      <button
                        type="button"
                        className="loja-botao-primario"
                        onClick={() => comprar(item)}
                        disabled={saldoInsuficiente}
                        title={saldoInsuficiente ? `Faltam ${item.preco - economia.moedas} moedas` : undefined}
                      >
                        {saldoInsuficiente ? `Faltam ${item.preco - economia.moedas}` : "Comprar"}
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="loja-posse">
                        {equipado ? "✓ Equipado" : possui ? "✓ No inventário" : ""}
                      </div>
                      {possui && (
                        <button
                          type="button"
                          className={equipado ? "loja-botao-secundario" : "loja-botao-primario"}
                          onClick={() => equipar(item)}
                        >
                          {equipado ? "Desequipar" : "Equipar"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="loja-vazio">
          <div>{filtro === "fundo" ? "🖼️" : "🎒"}</div>
          <h2>{aba === "loja" ? "Nenhum item disponível nesta categoria." : "Seu inventário ainda não tem itens desta categoria."}</h2>
          <p>{aba === "inventario" ? "Volte para a Loja, acumule moedas estudando e escolha sua primeira personalização." : filtro === "fundo" ? "O dono ainda não publicou novos fundos para venda." : "Novos itens serão adicionados futuramente."}</p>
          {aba === "inventario" && <button type="button" className="loja-botao-primario" onClick={() => setAba("loja")}>Ver Loja</button>}
        </section>
      )}

      <section className="loja-regra">
        <strong>Como funciona</strong>
        <p>Fundos, molduras e temas são comprados uma única vez e ficam no inventário. O fundo equipado troca somente a arte atrás da missão e do cronômetro no topo do Dashboard.</p>
      </section>
    </div>
  );
}

function GerenciadorFundos({
  fundos,
  carregando,
  erro,
  onPublicar,
  onAlternar,
}: {
  fundos: FundoLojaRegistro[];
  carregando: boolean;
  erro: string;
  onPublicar: (entrada: NovoFundoLoja) => Promise<void>;
  onAlternar: (fundo: FundoLojaRegistro) => Promise<void>;
}) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState(250);
  const [raridade, setRaridade] = useState<RaridadeItemLoja>("raro");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroLocal, setErroLocal] = useState("");

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!arquivo || nome.trim().length < 2) {
      setErroLocal("Escolha uma imagem e informe o nome do fundo.");
      return;
    }

    try {
      setSalvando(true);
      setErroLocal("");
      await onPublicar({
        nome,
        descricao,
        preco,
        raridade,
        arquivo,
      });
      setNome("");
      setDescricao("");
      setPreco(250);
      setRaridade("raro");
      setArquivo(null);
      evento.currentTarget.reset();
    } catch (error) {
      setErroLocal(error instanceof Error ? error.message : "Não foi possível publicar o fundo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="loja-fundos-admin">
      <div className="loja-fundos-admin-topo">
        <div>
          <span className="loja-kicker">SÓ PARA O DONO</span>
          <h2>Fundos do Dashboard</h2>
          <p>Suba novas artes, defina o preço em moedas e publique direto na loja.</p>
        </div>
        <span className="loja-fundos-admin-badge">🔒 Administração</span>
      </div>

      <form className="loja-fundos-form" onSubmit={enviar}>
        <label>
          <span>Imagem</span>
          <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
        </label>
        <label>
          <span>Nome</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Operação Noturna" maxLength={80} />
        </label>
        <label className="loja-fundos-form-descricao">
          <span>Descrição</span>
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição curta para o aluno" maxLength={180} />
        </label>
        <label>
          <span>Preço</span>
          <input type="number" min={0} step={10} value={preco} onChange={(e) => setPreco(Number(e.target.value))} />
        </label>
        <label>
          <span>Raridade</span>
          <select value={raridade} onChange={(e) => setRaridade(e.target.value as RaridadeItemLoja)}>
            <option value="comum">Comum</option>
            <option value="raro">Raro</option>
            <option value="epico">Épico</option>
            <option value="lendario">Lendário</option>
          </select>
        </label>
        <button type="submit" className="loja-botao-primario" disabled={salvando}>
          {salvando ? "Publicando..." : "Publicar na loja"}
        </button>
      </form>

      {(erro || erroLocal) && <div className="loja-fundos-admin-erro">{erroLocal || erro}</div>}

      <div className="loja-fundos-publicados">
        <strong>Fundos publicados</strong>
        {carregando ? (
          <span>Carregando...</span>
        ) : fundos.length === 0 ? (
          <span>Nenhum fundo cadastrado ainda.</span>
        ) : (
          <div className="loja-fundos-publicados-grid">
            {fundos.map((fundo) => (
              <article key={fundo.id}>
                <div style={{ backgroundImage: `url("${obterUrlPublicaFundo(fundo.imagem_path)}")` }} />
                <span>{fundo.nome}</span>
                <small>🪙 {fundo.preco} · {nomeRaridade(fundo.raridade)}</small>
                <button type="button" onClick={() => void onAlternar(fundo)}>
                  {fundo.ativo ? "Ocultar da loja" : "Ativar na loja"}
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ResumoEquipado({ rotulo, item, fallback }: { rotulo: string; item?: ItemLoja; fallback: string }) {
  return <div className="loja-equipado-item"><span>{rotulo}</span><strong>{item ? `${item.icone} ${item.nome}` : fallback}</strong></div>;
}

function PreviewItem({ item }: { item: ItemLoja }) {
  if (item.tipo === "moldura") {
    return <div className={`loja-preview loja-preview-moldura moldura-${item.valorVisual}`}><span>Nível 4</span><strong>808 XP</strong></div>;
  }

  if (item.tipo === "fundo") {
    return (
      <div
        className="loja-preview loja-preview-fundo"
        style={{ backgroundImage: `linear-gradient(90deg, rgba(4,18,34,.15), rgba(4,18,34,.45)), url("${item.valorVisual}")` }}
      >
        <span>Fundo do Dashboard</span>
      </div>
    );
  }

  return <div className={`loja-preview loja-preview-tema tema-${item.valorVisual}`}><i /><span>Prévia do tema</span></div>;
}

function nomeTipo(tipo: TipoItemLoja) {
  if (tipo === "moldura") return "MOLDURA";
  if (tipo === "fundo") return "FUNDO DO DASHBOARD";
  return "TEMA";
}

function nomeRaridade(raridade: ItemLoja["raridade"]) {
  if (raridade === "lendario") return "Lendário";
  if (raridade === "epico") return "Épico";
  if (raridade === "raro") return "Raro";
  return "Comum";
}
