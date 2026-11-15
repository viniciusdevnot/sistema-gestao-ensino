import { useEffect, useState } from 'react';
import { SessaoProvider, useSessao } from './contexto/Sessao.jsx';
import { configurado } from './lib/supabase.js';
import * as api from './lib/api.js';
import { Sprite } from './componentes/Icones.jsx';
import Layout from './componentes/Layout.jsx';
import Acesso from './telas/Acesso.jsx';
import Painel from './telas/Painel.jsx';
import MeuPerfil from './telas/MeuPerfil.jsx';
import Registros from './telas/Registros.jsx';
import EmMigracao from './telas/EmMigracao.jsx';
import Aco from './telas/Aco.jsx';
import { VIEWS, CAT_DOCM, CAT_PROC } from './lib/catalogo.js';

function Conteudo(){
  const { sessao, perfil, ehAdmin, ehOficial, registrar } = useSessao();
  const [view, setView] = useState(() => (location.hash || '#painel').slice(1));
  const [tags, setTags] = useState({});
  const ir = v => { if (v === view) return; setView(v); history.pushState(null, '', '#' + v); window.scrollTo(0, 0); };
  // botão "voltar" do celular/navegador volta para a tela anterior
  useEffect(() => { const f = () => setView((location.hash || '#painel').slice(1)); addEventListener('popstate', f); addEventListener('hashchange', f); return () => { removeEventListener('popstate', f); removeEventListener('hashchange', f); }; }, []);
  useEffect(() => { if (/^dm-pr-/.test(view) && perfil && !ehOficial) ir('painel'); if ((view === 'registros') && perfil && !ehAdmin) ir('painel'); }, [view, perfil, ehAdmin, ehOficial]);
  // registra o acesso e o último acesso
  useEffect(() => { if (!perfil) return; api.salvarPerfil(perfil.id, { ultimo_acesso: new Date().toISOString() }).catch(() => {}); registrar('acesso', 'entrou no sistema'); }, [perfil?.id]);
  useEffect(() => { if (!perfil) return; const id = ehAdmin ? undefined : perfil.id;
    Promise.all(['escalas_aco', 'oficios', 'ordens_servico', 'planilhas'].map(t => api.contar(t, id).catch(() => 0))).then(([aco, oficio, os, planilhas]) => setTags({ aco, oficio, os, planilhas })); }, [perfil?.id, view]);

  if (sessao === undefined) return <div className="carregando-tela">Carregando…</div>;
  if (!sessao) return <Acesso key="entrar" />;
  if (!perfil) return <div className="carregando-tela">Carregando seu perfil…</div>;
  if (perfil.trocar_senha) return <Acesso key="nova" modoInicial="nova" />;

  let tela, tit = VIEWS[view] || VIEWS.painel;
  if (view === 'perfil') tela = <MeuPerfil />;
  else if (view === 'registros') tela = <Registros />;
  else if (view === 'painel') tela = <Painel />;
  else if (view === 'aco') tela = <Aco aoMudarContagem={() => setTags(t => ({ ...t }))} />;
  else if (/^dm-/.test(view)){
    const k = view.slice(3), p = CAT_PROC.find(c => c[0] === k), d = CAT_DOCM.find(c => c[0] === k);
    tit = p ? [`${p[2]} · ${p[1]}`, 'Procedimentos · Manual de Processos e Procedimentos Administrativos (MPPADMIS)'] : [d?.[1] || 'Documentos', VIEWS.docm[1]];
    tela = <EmMigracao chave="docm" nome={tit[0]} />;
  }
  else tela = <EmMigracao chave={view} nome={tit[0]} />;
  return <Layout view={view} ir={ir} titulo={tit[0]} sub={tit[1]} tags={tags}>{tela}</Layout>;
}

export default function App(){
  if (!configurado) return (
    <div className="carregando-tela" style={{ flexDirection: 'column', gap: 8, textAlign: 'center', padding: 24 }}>
      <b>Falta configurar o banco de dados.</b>
      <span>Cadastre VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nas variáveis de ambiente do Netlify (ou no arquivo .env) e publique de novo.</span>
    </div>);
  return <SessaoProvider><Sprite /><Conteudo /></SessaoProvider>;
}
