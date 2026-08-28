import { useEffect, useState, type FormEvent } from "react";

import "./GerenciarLojaAdmin.css";

import { useToast } from "../../context/ToastContext";
import {
  alternarWallpaperAtivo,
  carregarWallpapersBanco,
  excluirWallpaperAdmin,
  salvarWallpaperAdmin,
  type WallpaperLojaBanco,
} from "../../services/catalogoLojaService";
import type { RaridadeItemLoja } from "../../services/lojaGamificacao";

const FORM_INICIAL = {
  nome: "",
  descricao: "",
  preco: 260,
  raridade: "raro" as RaridadeItemLoja,
  icone: "🖼️",
  ativo: true,
  ordem: 0,
};

export default function GerenciarLojaAdmin() {
  const { showToast } = useToast();
  const [itens, setItens] = useState<WallpaperLojaBanco[]>([]);
  const [form, setForm] = useState(FORM_INICIAL);
  const [editando, setEditando] = useState<WallpaperLojaBanco | null>(null);
  const [desktop, setDesktop] = useState<File | null>(null);
  const [mobile, setMobile] = useState<File | null>(null);
  const [preview, setPreview] = useState<File | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  async function recarregar() {
    setCarregando(true);
    try {
      setItens(await carregarWallpapersBanco());
    } catch (erro) {
      showToast(erro instanceof Error ? erro.message : "Erro ao carregar a loja.", "warning");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void recarregar();
    // recarrega apenas na montagem do painel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    setSalvando(true);
    try {
      await salvarWallpaperAdmin(
        {
          id: editando?.id,
          nome: form.nome,
          descricao: form.descricao,
          preco: form.preco,
          raridade: form.raridade,
          icone: form.icone,
          ativo: form.ativo,
          ordem: form.ordem,
          desktopPath: editando?.desktop_path,
          mobilePath: editando?.mobile_path,
          previewPath: editando?.preview_path,
        },
        { desktop, mobile, preview }
      );
      showToast(editando ? "Wallpaper atualizado." : "Wallpaper publicado na Loja.");
      limpar();
      await recarregar();
    } catch (erro) {
      showToast(erro instanceof Error ? erro.message : "Erro ao salvar wallpaper.", "warning");
    } finally {
      setSalvando(false);
    }
  }

  function editar(item: WallpaperLojaBanco) {
    setEditando(item);
    setForm({
      nome: item.nome,
      descricao: item.descricao,
      preco: item.preco,
      raridade: item.raridade,
      icone: item.icone,
      ativo: item.ativo,
      ordem: item.ordem,
    });
    setDesktop(null);
    setMobile(null);
    setPreview(null);
    document.getElementById("admin-loja-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function limpar() {
    setEditando(null);
    setForm(FORM_INICIAL);
    setDesktop(null);
    setMobile(null);
    setPreview(null);
  }

  async function alternar(item: WallpaperLojaBanco) {
    try {
      await alternarWallpaperAtivo(item.id, !item.ativo);
      showToast(item.ativo ? "Wallpaper retirado da Loja." : "Wallpaper publicado novamente.", "info");
      await recarregar();
    } catch (erro) {
      showToast(erro instanceof Error ? erro.message : "Erro ao alterar publicação.", "warning");
    }
  }

  async function excluir(item: WallpaperLojaBanco) {
    if (!window.confirm(`Excluir definitivamente “${item.nome}”? Quem já comprou deixará de conseguir equipá-lo.`)) return;
    try {
      await excluirWallpaperAdmin(item);
      if (editando?.id === item.id) limpar();
      showToast("Wallpaper excluído.", "info");
      await recarregar();
    } catch (erro) {
      showToast(erro instanceof Error ? erro.message : "Erro ao excluir wallpaper.", "warning");
    }
  }

  return (
    <section className="admin-loja">
      <div className="admin-loja-topo">
        <div>
          <span>GERENCIAR LOJA</span>
          <h2>🖼️ Wallpapers</h2>
          <p>Publique fundos novos sem alterar o código nem fazer outro deploy.</p>
        </div>
        <div className="admin-loja-resumo"><strong>{itens.filter((item) => item.ativo).length}</strong><span>publicados</span></div>
      </div>

      <form id="admin-loja-form" className="admin-loja-form" onSubmit={salvar}>
        <div className="admin-loja-form-cabecalho">
          <div><strong>{editando ? `Editando: ${editando.nome}` : "Novo wallpaper"}</strong><small>Desktop é obrigatório. Mobile e capa podem usar a imagem desktop como fallback.</small></div>
          {editando && <button type="button" onClick={limpar}>Cancelar edição</button>}
        </div>

        <div className="admin-loja-campos">
          <label><span>Nome</span><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Patrulha Noturna" required /></label>
          <label><span>Preço em moedas</span><input type="number" min="0" value={form.preco} onChange={(e) => setForm({ ...form, preco: Number(e.target.value) })} required /></label>
          <label><span>Raridade</span><select value={form.raridade} onChange={(e) => setForm({ ...form, raridade: e.target.value as RaridadeItemLoja })}><option value="comum">Comum</option><option value="raro">Raro</option><option value="epico">Épico</option><option value="lendario">Lendário</option></select></label>
          <label><span>Ícone</span><input value={form.icone} onChange={(e) => setForm({ ...form, icone: e.target.value })} maxLength={8} /></label>
          <label className="admin-loja-campo-largo"><span>Descrição</span><textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Descrição exibida na Loja" rows={2} /></label>
          <label><span>Ordem</span><input type="number" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) })} /></label>
          <label className="admin-loja-check"><input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /><span>Publicar imediatamente</span></label>
        </div>

        <div className="admin-loja-arquivos">
          <Arquivo rotulo="Desktop" dica="Recomendado: 1920×1080 ou maior" arquivo={desktop} onChange={setDesktop} obrigatorio={!editando} />
          <Arquivo rotulo="Celular" dica="Recomendado: 1080×1920" arquivo={mobile} onChange={setMobile} />
          <Arquivo rotulo="Capa da Loja" dica="Opcional; pode usar o desktop" arquivo={preview} onChange={setPreview} />
        </div>

        <div className="admin-loja-acoes-form">
          <small>JPG, PNG, WEBP ou AVIF · máximo 8 MB por imagem.</small>
          <button type="submit" disabled={salvando}>{salvando ? "Enviando..." : editando ? "Salvar alterações" : "Publicar wallpaper"}</button>
        </div>
      </form>

      <div className="admin-loja-lista">
        {carregando ? <div className="admin-loja-vazio">Carregando wallpapers...</div> : itens.length === 0 ? <div className="admin-loja-vazio">Nenhum wallpaper cadastrado ainda.</div> : itens.map((item) => (
          <article key={item.id} className={`admin-loja-item ${item.ativo ? "ativo" : "inativo"}`}>
            <div className="admin-loja-thumb" style={{ backgroundImage: `url(${urlPublica(item.preview_path || item.desktop_path)})` }} />
            <div className="admin-loja-info"><span>{item.raridade.toUpperCase()}</span><strong>{item.icone} {item.nome}</strong><small>🪙 {item.preco} · ordem {item.ordem} · {item.ativo ? "Publicado" : "Oculto"}</small></div>
            <div className="admin-loja-item-acoes"><button type="button" onClick={() => editar(item)}>Editar</button><button type="button" onClick={() => void alternar(item)}>{item.ativo ? "Ocultar" : "Publicar"}</button><button type="button" className="perigo" onClick={() => void excluir(item)}>Excluir</button></div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Arquivo({ rotulo, dica, arquivo, onChange, obrigatorio = false }: { rotulo: string; dica: string; arquivo: File | null; onChange: (arquivo: File | null) => void; obrigatorio?: boolean }) {
  return <label className="admin-loja-arquivo"><span>{rotulo}{obrigatorio ? " *" : ""}</span><strong>{arquivo?.name || "Selecionar imagem"}</strong><small>{dica}</small><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(e) => onChange(e.target.files?.[0] ?? null)} required={obrigatorio} /></label>;
}

function urlPublica(path: string) {
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  return `${base}/storage/v1/object/public/loja-wallpapers/${path.split("/").map(encodeURIComponent).join("/")}`;
}
