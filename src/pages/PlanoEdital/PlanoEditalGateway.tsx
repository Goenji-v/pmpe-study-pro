import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import type { ConfiguracoesComEdital } from '../../types/editalInteligente';
import PlanoEstudos from '../PlanoEstudos/PlanoEstudos';

export default function PlanoEditalGateway() {
  const { configuracoes, materias } = useApp();
  const config = configuracoes as ConfiguracoesComEdital;
  if (!config.editalAtivo?.analise && config.planoPadraoAtivo === false && materias.length === 0) {
    return <section className="plano-container"><h1>Monte seu plano de estudos</h1>
      <p>Importe o edital para distribuir seus assuntos pelos dias disponíveis.</p>
      <Link to="/meu-edital">Configurar meu edital</Link>
    </section>;
  }
  return <PlanoEstudos />;
}
