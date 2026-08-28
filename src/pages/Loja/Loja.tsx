import { useMemo, useState } from "react";

import "./Loja.css";

import { useApp } from "../../context/AppContext";
import { useToast } from "../../context/ToastContext";
import {
  obterEstadoEconomia,
  type ConfiguracoesComEconomia,
} from "../../services/economiaGamificacao";
import {
  CATALOGO_LOJA,
  comprarItemLoja,
  desequiparTipoLoja,
  encontrarItemLoja,
  equiparItemLoja,
  itemEstaEquipado,
  itensDoInventario,
  type ItemLoja,
  type TipoItemLoja,
} from "../../services/lojaGamificacao";

type Aba = "loja" | "inventario";
type Filtro = "todos" | TipoItemLoja;

const FILTROS: Array<{ id: Filtro; nome: string }> = [
  { id: "todos", nome: "Todos" },
  { id: "titulo", nome: "Títulos" },
  { id: "moldura", nome: "Molduras" },
  { id: "tema", nome: "Temas" },
];

export default function Loja() {
  const { configuracoes, setConfiguracoes } = useApp();
  const { showToast } = useToast();
  const [aba, setAba] = useState<Aba>("loja");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const economia = useMemo(() => obterEstadoEconomia(configuracoes), [configuracoes]);
  const inventario = useMemo(() => itensDoInventario(economia), [economia]);

  const itensVisiveis = useMemo(() => {
    const origem = aba === "loja" ? CATALOGO_LOJA : inventario;
    if (filtro === "todos") return origem;
    return origem.filter((item) => item.tipo === filtro);
  }, [aba, filtro, inventario]);

  const titulo = encontrarItemLoja(economia.tituloEquipado);
  const moldura = encontrarItemLoja(economia.molduraEquipada);
  const tema = encontrarItemLoja(economia.temaEquipado);

  function salvarEconomia(proximaEconomia: ReturnType<typeof obterEstadoEconomia>) {
    setConfiguracoes((atuais) => ({
      ...atuais,
      economia: proximaEconomia,
    }) as ConfiguracoesComEconomia);
  }

  function comprar(item: ItemLoja) {
    const resultado = comprarItemLoja(economia, item.id);
    if (resultado.erro) {
      showToast(resultado.erro, resultado.estado.moedas < item.preco ? "warning" : "info");
      return;
    }

    salvarEconomia(resultado.estado);
    showToast(`${item.nome} foi adicionado ao seu inventário.`);
  }

  function equipar(item: ItemLoja) {
    if (itemEstaEquipado(economia, item)) {
      salvarEconomia(desequiparTipoLoja(economia, item.tipo));
      showToast(`${item.nome} foi desequipado.`, "info");
      return;
    }

    const resultado = equiparItemLoja(economia, item.id);
    if (resultado.erro) {
      showToast(resultado.erro, "warning");
      return;
    }

    salvarEconomia(resultado.estado);
    showToast(`${item.nome} equipado.`);
  }

  return (
    <div className="loja-page">
      <section className="loja-hero">
        <div>
          <span className="loja-kicker">ECONOMIA STUDY PRO</span>
          <h1>Loja & Inventário</h1>
          <p>
            Use as moedas conquistadas estudando para personalizar seu perfil e o visual do Study Pro.
            Os itens não alteram sua nota, XP ou desempenho.
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
        <ResumoEquipado rotulo="Título" item={titulo} fallback="Título padrão do nível" />
        <ResumoEquipado rotulo="Moldura" item={moldura} fallback="Moldura padrão" />
        <ResumoEquipado rotulo="Tema" item={tema} fallback="Azul padrão" />
      </section>

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

      {itensVisiveis.length > 0 ? (
        <section className="loja-grid">
          {itensVisiveis.map((item) => {
            const possui = (economia.inventario ?? []).includes(item.id);
            const equipado = itemEstaEquipado(economia, item);
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
          <div>🎒</div>
          <h2>Seu inventário ainda não tem itens desta categoria.</h2>
          <p>Volte para a Loja, acumule moedas estudando e escolha sua primeira personalização.</p>
          <button type="button" className="loja-botao-primario" onClick={() => setAba("loja")}>
            Ver Loja
          </button>
        </section>
      )}

      <section className="loja-regra">
        <strong>Como funciona</strong>
        <p>
          Comprar um item desconta moedas uma única vez. Depois ele fica permanentemente no seu inventário
          e pode ser equipado ou trocado sem novo custo. Título, moldura e tema usam slots separados.
        </p>
      </section>
    </div>
  );
}

function ResumoEquipado({
  rotulo,
  item,
  fallback,
}: {
  rotulo: string;
  item?: ItemLoja;
  fallback: string;
}) {
  return (
    <div className="loja-equipado-item">
      <span>{rotulo}</span>
      <strong>{item ? `${item.icone} ${item.nome}` : fallback}</strong>
    </div>
  );
}

function PreviewItem({ item }: { item: ItemLoja }) {
  if (item.tipo === "titulo") {
    return <div className="loja-preview loja-preview-titulo">Nível 4 · {item.valorVisual}</div>;
  }

  if (item.tipo === "moldura") {
    return (
      <div className={`loja-preview loja-preview-moldura moldura-${item.valorVisual}`}>
        <span>Nível 4</span>
        <strong>808 XP</strong>
      </div>
    );
  }

  return (
    <div className={`loja-preview loja-preview-tema tema-${item.valorVisual}`}>
      <i />
      <span>Prévia do tema</span>
    </div>
  );
}

function nomeTipo(tipo: TipoItemLoja) {
  if (tipo === "titulo") return "TÍTULO";
  if (tipo === "moldura") return "MOLDURA";
  return "TEMA";
}

function nomeRaridade(raridade: ItemLoja["raridade"]) {
  if (raridade === "lendario") return "Lendário";
  if (raridade === "epico") return "Épico";
  if (raridade === "raro") return "Raro";
  return "Comum";
}
