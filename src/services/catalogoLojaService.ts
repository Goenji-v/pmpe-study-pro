import { supabase } from "../lib/supabase";
import type { ItemLoja, RaridadeItemLoja } from "./lojaGamificacao";

export const BUCKET_WALLPAPERS = "loja-wallpapers";

export type WallpaperLojaBanco = {
  id: string;
  slug: string;
  tipo: "wallpaper";
  nome: string;
  descricao: string;
  preco: number;
  raridade: RaridadeItemLoja;
  icone: string;
  desktop_path: string;
  mobile_path: string | null;
  preview_path: string | null;
  ativo: boolean;
  ordem: number;
  criado_em: string;
  atualizado_em: string;
};

export type DadosWallpaperAdmin = {
  id?: string;
  nome: string;
  descricao: string;
  preco: number;
  raridade: RaridadeItemLoja;
  icone: string;
  ativo: boolean;
  ordem: number;
  desktopPath?: string;
  mobilePath?: string | null;
  previewPath?: string | null;
};

export async function carregarWallpapersLoja(): Promise<ItemLoja[]> {
  const linhas = await carregarWallpapersBanco();
  return linhas.map(mapearWallpaperParaItem);
}

export async function carregarWallpapersBanco(): Promise<WallpaperLojaBanco[]> {
  const { data, error } = await supabase
    .from("loja_itens")
    .select("id,slug,tipo,nome,descricao,preco,raridade,icone,desktop_path,mobile_path,preview_path,ativo,ordem,criado_em,atualizado_em")
    .eq("tipo", "wallpaper")
    .order("ordem", { ascending: true })
    .order("criado_em", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as WallpaperLojaBanco[];
}

export function mapearWallpaperParaItem(linha: WallpaperLojaBanco): ItemLoja {
  return {
    id: idWallpaper(linha.id),
    idBanco: linha.id,
    tipo: "wallpaper",
    nome: linha.nome,
    descricao: linha.descricao,
    preco: linha.preco,
    raridade: linha.raridade,
    icone: linha.icone || "🖼️",
    valorVisual: linha.slug,
    ativo: linha.ativo,
    wallpaperDesktopUrl: urlPublica(linha.desktop_path),
    wallpaperMobileUrl: urlPublica(linha.mobile_path || linha.desktop_path),
    wallpaperPreviewUrl: urlPublica(linha.preview_path || linha.desktop_path),
  };
}

export async function salvarWallpaperAdmin(
  dados: DadosWallpaperAdmin,
  arquivos: { desktop?: File | null; mobile?: File | null; preview?: File | null }
) {
  validarDados(dados, arquivos);

  const slug = slugificar(dados.nome);
  const prefixo = `${slug}-${Date.now()}`;

  let desktopPath = dados.desktopPath;
  let mobilePath = dados.mobilePath ?? null;
  let previewPath = dados.previewPath ?? null;

  if (arquivos.desktop) desktopPath = await enviarImagem(arquivos.desktop, `${prefixo}/desktop`);
  if (arquivos.mobile) mobilePath = await enviarImagem(arquivos.mobile, `${prefixo}/mobile`);
  if (arquivos.preview) previewPath = await enviarImagem(arquivos.preview, `${prefixo}/preview`);

  if (!desktopPath) throw new Error("Selecione uma imagem para desktop.");

  const payload = {
    slug: dados.id ? undefined : `${slug}-${Date.now().toString(36)}`,
    tipo: "wallpaper" as const,
    nome: dados.nome.trim(),
    descricao: dados.descricao.trim(),
    preco: Math.max(0, Math.floor(dados.preco)),
    raridade: dados.raridade,
    icone: (dados.icone || "🖼️").trim(),
    desktop_path: desktopPath,
    mobile_path: mobilePath,
    preview_path: previewPath,
    ativo: dados.ativo,
    ordem: Math.floor(dados.ordem || 0),
    atualizado_em: new Date().toISOString(),
  };

  if (dados.id) {
    const { data, error } = await supabase
      .from("loja_itens")
      .update({
        nome: payload.nome,
        descricao: payload.descricao,
        preco: payload.preco,
        raridade: payload.raridade,
        icone: payload.icone,
        desktop_path: payload.desktop_path,
        mobile_path: payload.mobile_path,
        preview_path: payload.preview_path,
        ativo: payload.ativo,
        ordem: payload.ordem,
        atualizado_em: payload.atualizado_em,
      })
      .eq("id", dados.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as WallpaperLojaBanco;
  }

  const { data, error } = await supabase
    .from("loja_itens")
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as WallpaperLojaBanco;
}

export async function alternarWallpaperAtivo(id: string, ativo: boolean) {
  const { error } = await supabase
    .from("loja_itens")
    .update({ ativo, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function excluirWallpaperAdmin(item: WallpaperLojaBanco) {
  const { error } = await supabase.from("loja_itens").delete().eq("id", item.id);
  if (error) throw new Error(error.message);

  const caminhos = [...new Set([item.desktop_path, item.mobile_path, item.preview_path].filter(Boolean))] as string[];
  if (caminhos.length) await supabase.storage.from(BUCKET_WALLPAPERS).remove(caminhos);
}

export function idWallpaper(idBanco: string) {
  return `wallpaper:${idBanco}`;
}

function urlPublica(path: string) {
  return supabase.storage.from(BUCKET_WALLPAPERS).getPublicUrl(path).data.publicUrl;
}

async function enviarImagem(arquivo: File, base: string) {
  validarArquivo(arquivo);
  const extensao = extensaoSegura(arquivo);
  const path = `${base}.${extensao}`;
  const { data, error } = await supabase.storage
    .from(BUCKET_WALLPAPERS)
    .upload(path, arquivo, {
      cacheControl: "31536000",
      contentType: arquivo.type,
      upsert: false,
    });
  if (error) throw new Error(error.message);
  return data.path;
}

function validarDados(
  dados: DadosWallpaperAdmin,
  arquivos: { desktop?: File | null }
) {
  if (dados.nome.trim().length < 2) throw new Error("Informe um nome para o wallpaper.");
  if (!Number.isFinite(dados.preco) || dados.preco < 0) throw new Error("Informe um preço válido.");
  if (!dados.id && !arquivos.desktop && !dados.desktopPath) throw new Error("A imagem desktop é obrigatória.");
}

function validarArquivo(arquivo: File) {
  const permitidos = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
  if (!permitidos.has(arquivo.type)) throw new Error("Use JPG, PNG, WEBP ou AVIF.");
  if (arquivo.size > 8 * 1024 * 1024) throw new Error("Cada imagem pode ter no máximo 8 MB.");
}

function extensaoSegura(arquivo: File) {
  if (arquivo.type === "image/png") return "png";
  if (arquivo.type === "image/webp") return "webp";
  if (arquivo.type === "image/avif") return "avif";
  return "jpg";
}

function slugificar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "wallpaper";
}
