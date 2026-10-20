import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { armazenamentoLocalDaConta as storage } from '../../services/armazenamentoConta';
import type { PedidoPdf } from '../../services/leitorMaterial';
import type { AnotacoesPdf } from '../../pages/SimuladoPdf/PdfAnotavel';
import './LeitorMaterial.css';
const PdfAnotavel = lazy(() => import('../../pages/SimuladoPdf/PdfAnotavel'));
type PedidoLeitor = PedidoPdf & { aberturaExternaBloqueada?: boolean };

export default function LeitorMaterial() {
  const { configuracoes } = useApp();
  const [pedido, setPedido] = useState<PedidoLeitor | null>(null);
  useEffect(() => {
    const abrir = (evento: Event) => {
      const solicitado = (evento as CustomEvent<PedidoPdf>).detail;
      if (configuracoes.aberturaPdf === 'navegador') {
        try {
          // Criar a aba vazia no mesmo gesto sempre que possível, sem expor window.opener.
          const aba = window.open('about:blank', '_blank');
          if (aba) {
            aba.opener = null;
            aba.location.replace(solicitado.url);
            return;
          }
        } catch {
          // A ação manual permanece acessível caso o bloqueador impeça a nova aba.
        }
        setPedido({ ...solicitado, aberturaExternaBloqueada: true });
        return;
      }
      setPedido(solicitado);
    };
    const abrirInterno = (evento: Event) => setPedido((evento as CustomEvent<PedidoPdf>).detail);
    window.addEventListener('study:abrir-pdf', abrir);
    window.addEventListener('study:abrir-pdf-interno', abrirInterno);
    return () => {
      window.removeEventListener('study:abrir-pdf', abrir);
      window.removeEventListener('study:abrir-pdf-interno', abrirInterno);
    };
  }, [configuracoes.aberturaPdf]);
  return pedido ? <PainelPdf key={pedido.id + (pedido.aberturaExternaBloqueada ? ':externo' : ':interno')} pedido={pedido} fechar={() => setPedido(null)} /> : null;
}
function PainelPdf({ pedido, fechar }: { pedido: PedidoLeitor; fechar: () => void }) {
  const { configuracoes } = useApp();
  const { usuario } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState('');
  const chave = `pdf-anotacoes:${usuario?.id ?? 'sem-conta'}:${pedido.id}`;
  const salvar = configuracoes.salvarMarcacoesPdf === true;
  const driveId = pedido.url.match(/^https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1];
  const [iniciais] = useState<AnotacoesPdf>(() => {
    if (!salvar) return {};
    try { return JSON.parse(storage.getItem(chave) ?? '{}'); } catch { return {}; }
  });
  const guardar = useCallback((anotacoes: AnotacoesPdf) => {
    if (!salvar) return;
    try { storage.setItem(chave, JSON.stringify(anotacoes)); } catch { setErro('Não foi possível guardar as marcações neste aparelho.'); }
  }, [chave, salvar]);
  useEffect(() => {
    dialog.current?.showModal();
    if (pedido.aberturaExternaBloqueada) return;
    const controle = new AbortController();
    void (async () => {
      try {
        const resposta = await fetch(pedido.url, { signal: controle.signal, credentials: 'omit' });
        if (!resposta.ok) throw new Error('Arquivo indisponível.');
        const blob = await resposta.blob();
        if (!(await blob.slice(0, 5).text()).startsWith('%PDF-')) throw new Error('O endereço não fornece um PDF diretamente.');
        setArquivo(new File([blob], pedido.nome, { type: 'application/pdf' }));
      } catch (e) {
        if (!controle.signal.aborted) setErro(`${e instanceof Error ? e.message : 'Falha na leitura.'} Se o provedor bloquear a leitura, selecione uma cópia do PDF abaixo para anotar aqui.`);
      }
    })();
    return () => controle.abort();
  }, [pedido]);
  if (pedido.aberturaExternaBloqueada) {
    return <dialog ref={dialog} className="leitor-material" onCancel={fechar}>
      <header><div><small>MATERIAL DE ESTUDO</small><h2>{pedido.nome}</h2></div><button type="button" onClick={fechar} aria-label="Fechar aviso de PDF">Fechar ✕</button></header>
      <div role="status" className="leitor-aviso">
        <p>O navegador bloqueou a abertura automática de uma nova aba.</p>
        <a href={pedido.url} target="_blank" rel="noopener noreferrer">Abrir PDF em nova aba</a>
        <button type="button" onClick={() => {
          fechar();
          window.dispatchEvent(new CustomEvent<PedidoPdf>('study:abrir-pdf-interno', { detail: pedido }));
        }}>Abrir dentro do Study Pro</button>
      </div>
    </dialog>;
  }

  return <dialog ref={dialog} className="leitor-material" onCancel={fechar}>
    <header><div><small>MATERIAL DE ESTUDO</small><h2>{pedido.nome}</h2><p>{salvar ? 'Marcações salvas neste aparelho para sua conta.' : 'Marcações temporárias: serão descartadas ao fechar.'}</p></div><button onClick={fechar} aria-label="Fechar PDF">Fechar ✕</button></header>
    {erro && <div role="status" className="leitor-aviso"><p>{erro}</p><label>Selecionar PDF deste aparelho <input type="file" accept="application/pdf" onChange={e => { const f=e.target.files?.[0]; if(f){setArquivo(f);setErro('');} }} /></label><a href={pedido.url} target="_blank" rel="noopener noreferrer">Abrir no provedor</a></div>}
    {!arquivo && erro && driveId && <iframe title={`Prévia de ${pedido.nome}`} src={`https://drive.google.com/file/d/${driveId}/preview`} className="leitor-drive-preview" referrerPolicy="no-referrer" />}
    {arquivo ? <Suspense fallback={<p>Preparando leitor…</p>}><PdfAnotavel key={arquivo.name + arquivo.lastModified} arquivo={arquivo} pausado={false} anotacoesIniciais={iniciais} onAnotacoesChange={guardar} /></Suspense> : !erro && <p>Abrindo PDF…</p>}
  </dialog>;
}
