import { lazy, Suspense } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./NotFound.css";
const SimuladosOficiais=lazy(()=>import("../SimuladosOficiais/SimuladosOficiais"));
const SimuladoOficial=lazy(()=>import("../SimuladoOficial/SimuladoOficial"));
const AdminSimuladosOficiais=lazy(()=>import("../AdminSimuladosOficiais/AdminSimuladosOficiais"));
export default function NotFound(){const navigate=useNavigate();const location=useLocation();const rota=location.pathname;const especial=rota==="/simulados-oficiais"||rota.startsWith("/simulado-oficial/")||rota==="/admin/simulados-oficiais";if(especial)return <Suspense fallback={<section className="not-found"><p>Carregando...</p></section>}>{rota==="/simulados-oficiais"?<SimuladosOficiais/>:rota==="/admin/simulados-oficiais"?<AdminSimuladosOficiais/>:<SimuladoOficial/>}</Suspense>;return <section className="not-found"><span>ERRO 404</span><h1>Página não encontrada</h1><p>O endereço acessado não existe ou foi alterado.</p><button type="button" onClick={()=>navigate("/")}>Voltar ao Dashboard</button></section>}
