import { supabase } from "../lib/supabase";
import type { RaridadeItemLoja } from "./lojaGamificacao";

const BUCKET_FUNDOS = "fundos-dashboard";

export type FundoLojaRegistro = {
  id: string;
  nome: string;
  descricao: string;
  preco: number;
  raridade: RaridadeItemLoja;
  imagem_path: string;
  ativo: boolean;
  criado_em: string;
};

export type NovoFundoLoja = {
  nome: string;
  descricao: string;
  preco: number;
  raridade: RaridadeItemLoja;
  arquivo: File;
};

export async function listarFundosLoja(incluirInativos = false) {
  let consulta = supabase
    .from("fundos_loja")
    .select("id,nome,descricao,preco,raridade,imagem_path,ativo,criado_em")
    .order("criado_em", { ascending: false });

  if (!incluirInativos) {
    consulta = consulta.eq("ativo", true);
  }

  const { data, error } = await consulta;
  if (error) throw new Error(error.message);
  return (data ?? []) as FundoLojaRegistro[];
}

export function obterUrlPublicaFundo(imagemPath: string) {
  return supabase.storage.from(BUCKET_FUNDOS).getPublicUrl(imagemPath).data.publicUrl;
}

export async function publicarFundoLoja(entrada: NovoFundoLoja) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error(authError.message);
  if (!authData.user) throw new Error("Sessão não encontrada.");

  if (!entrada.arquivo.type.startsWith("image/")) {
    throw new Error("Selecione um arquivo de imagem válido.");
  }

  if (entrada.arquivo.size > 8 * 1024 * 1024) {
    throw new Error("A imagem deve ter no máximo 8 MB.");
  }

  const extensao = extensaoSegura(entrada.arquivo);
  const nomeArquivo = `${Date.now()}-${crypto.randomUUID()}.${extensao}`;
  const caminho = `${authData.user.id}/${nomeArquivo}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_FUNDOS)
    .upload(caminho, entrada.arquivo, {
      contentType: entrada.arquivo.type,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await supabase
    .from("fundos_loja")
    .insert({
      nome: entrada.nome.trim(),
      descricao: entrada.descricao.trim(),
      preco: Math.max(0, Math.floor(entrada.preco)),
      raridade: entrada.raridade,
      imagem_path: caminho,
      criado_por: authData.user.id,
      ativo: true,
    })
    .select("id,nome,descricao,preco,raridade,imagem_path,ativo,criado_em")
    .single();

  if (error) {
    await supabase.storage.from(BUCKET_FUNDOS).remove([caminho]);
    throw new Error(error.message);
  }

  return data as FundoLojaRegistro;
}

export async function definirFundoLojaAtivo(id: string, ativo: boolean) {
  const { error } = await supabase
    .from("fundos_loja")
    .update({ ativo, atualizado_em: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

function extensaoSegura(arquivo: File) {
  const porMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
  };

  if (porMime[arquivo.type]) return porMime[arquivo.type];

  const nome = arquivo.name.toLowerCase();
  if (nome.endsWith(".jpeg") || nome.endsWith(".jpg")) return "jpg";
  if (nome.endsWith(".png")) return "png";
  if (nome.endsWith(".webp")) return "webp";
  if (nome.endsWith(".avif")) return "avif";
  return "webp";
}
