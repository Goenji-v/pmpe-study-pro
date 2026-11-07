import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import ResumoSemanaDashboard from './ResumoSemanaDashboard';
import './ResumoSemanaDashboard.css';
export default function ResumoSemanal() {
 const dados=useApp(); const navigate=useNavigate();
 return <main className="resumo-semanal-pagina"><Link to="/">← Voltar ao dashboard</Link><ResumoSemanaDashboard {...dados} irPara={navigate}/></main>;
}
