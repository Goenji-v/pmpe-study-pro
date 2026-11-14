import { useAuth } from "../../context/AuthContext";
import { useIdentidadePreview } from "../../services/identidadePreview";
import "./Header.css";
import { Bell, Search, Sun, Moon } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  useApp,
} from "../../context/AppContext";

import CloudStatus from "../CloudStatus/CloudStatus";
import UserProfileMenu from "../UserProfileMenu/UserProfileMenu";

export default function Header() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { dados, salvar } = useIdentidadePreview(usuario?.id);
  const location = useLocation();
  const {
    configuracoes,
  } = useApp();
  const claro = (dados.tema ?? (configuracoes as typeof configuracoes & {temaBasico?:string}).temaBasico ?? configuracoes.tema) === "claro";
  const resumoProva = location.pathname === "/" ? calcularResumoProva(configuracoes.dataProva) : null;

  function abrirNotificacoes() {
    window.dispatchEvent(new Event("pmpe:notificacoes:abrir"));
  }

  return (
    <header className="header">
      <div className="header-identidade">
        <div className="header-brand">
          <span
            className="header-brand-mark-shell"
            aria-hidden="true"
          >
            <img
              className="header-brand-mark"
              src="/assets/study-pro-sp-v8.svg"
              alt=""
              draggable={false}
            />
          </span>
          <div className="header-brand-copy">
            <strong>STUDY <span>PRO</span></strong>
          </div>
        </div>
        <span className="header-concurso">{configuracoes.concurso}</span>
      </div>

      {resumoProva && (
        <button
          type="button"
          className="header-prova"
          onClick={() => navigate("/configuracoes")}
          title="Ver ou alterar a data da prova"
          aria-label={`${resumoProva.rotulo}. Prova em ${resumoProva.dataFormatada}`}
        >
          <span>QUANTO FALTA PARA A PROVA</span>
          <strong>{resumoProva.rotulo}</strong>
          <small>{resumoProva.dataFormatada}</small>
        </button>
      )}

      <button
        type="button"
        className="header-search"
        onClick={() => navigate("/buscar", { state: { focoBusca: true } })}
        aria-label="Buscar conteúdos e questões"
      >
        <Search size={17} strokeWidth={1.9} aria-hidden="true" />
        <span>Buscar conteúdos, questões...</span>
      </button>

      <div className="header-acoes">
        <CloudStatus />
        <button type="button" className="header-notification-button" aria-label={claro?'Ativar tema escuro':'Ativar tema claro'} title={claro?'Tema escuro':'Tema claro'} onClick={()=>{try{salvar({tema:claro?'escuro':'claro'});}catch{window.alert('Não foi possível guardar o tema neste navegador.');}}}>{claro?<Moon size={19}/>:<Sun size={19}/>}</button>
        <button
          type="button"
          className="header-notification-button"
          aria-label="Notificações"
          onClick={abrirNotificacoes}
        >
          <Bell size={18} strokeWidth={1.9} aria-hidden="true" />
        </button>
        <UserProfileMenu />
      </div>
    </header>
  );
}


function calcularResumoProva(dataProva?: string) {
  if (!dataProva) return null;
  const [ano, mes, dia] = dataProva.split("-").map(Number);
  if (!ano || !mes || !dia) return null;
  const prova = new Date(ano, mes - 1, dia);
  if (Number.isNaN(prova.getTime())) return null;
  const agora = new Date();
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const alvo = new Date(prova.getFullYear(), prova.getMonth(), prova.getDate());
  const dias = Math.ceil((alvo.getTime() - hoje.getTime()) / 86_400_000);
  const rotulo =
    dias > 1 ? `Faltam ${dias} dias` :
    dias === 1 ? "Falta 1 dia" :
    dias === 0 ? "A prova é hoje" :
    "Data da prova encerrada";
  return { rotulo, dataFormatada: alvo.toLocaleDateString("pt-BR") };
}
