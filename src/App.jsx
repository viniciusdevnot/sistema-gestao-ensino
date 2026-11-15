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
import Documentos from './telas/Documentos.jsx';
import Planilhas from './telas/Planilhas.jsx';
import Guia from './componentes/Guia.jsx';
import { GUIA_VERSAO } from './lib/guia.js';
import { zerarDocumentos } from './legado/ponte.js';
import { VIEWS, CAT_DOCM, CAT_PROC } from './lib/catalogo.js';

function Conteudo(){
  const { sessao, perfil, setPerfil, ehAdmin, ehOficial, registrar, avisar } = useSessao();
  const [guia, setGuia] = useState(null);   // {cap} quando aberto
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

  useEffect(() => { if (sessao === null){ zerarDocumentos(); setGuia(null); } }, [sessao]);
  // guia: abre sozinho no 1º acesso de cada perfil
  useEffect(() => {
    if (!perfil || perfil.trocar_senha) return;
    if (!perfil.guia_visto){ const t = setTimeout(() => setGuia({ cap: 0 }), 700); return () => clearTimeout(t); }
    if ((perfil.guia_ver || 0) < GUIA_VERSAO) api.salvarPerfil(perfil.id, { guia_ver: GUIA_VERSAO }).catch(() => {});
  }, [perfil?.id, perfil?.trocar_senha]);
  const fecharGuia = concluiu => {
    setGuia(null);
    if (perfil && (!perfil.guia_visto || (perfil.guia_ver || 0) < GUIA_VERSAO)){
      const campos = { guia_visto: perfil.guia_visto || new Date().toISOString(), guia_ver: GUIA_VERSAO };
      setPerfil({ ...perfil, ...campos }); api.salvarPerfil(perfil.id, campos).catch(() => {});
    }
    if (concluiu){ registrar('perfil', 'concluiu o Guia do sistema'); avisar('Guia concluído. Bom trabalho!'); }
  };
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
    tela = <Documentos view={view} ir={ir} />;
  }
  else if (view === 'oficio' || view === 'os') tela = <Documentos view={view} ir={ir} />;
  else if (view === 'planilhas') tela = <Planilhas />;
  else tela = <EmMigracao chave={view} nome={tit[0]} />;
  return (<>
    <Layout view={view} ir={ir} titulo={tit[0]} sub={tit[1]} tags={tags} abrirGuia={() => setGuia({ cap: 0 })}>{tela}</Layout>
    {guia && <Guia ehOficial={ehOficial} ehAdmin={ehAdmin} capInicial={guia.cap} fechar={fecharGuia} />}
  </>);
}

export default function App(){
  if (!configurado) return (
    <div className="carregando-tela" style={{ flexDirection: 'column', gap: 8, textAlign: 'center', padding: 24 }}>
      <b>Falta configurar o banco de dados.</b>
      <span>Cadastre VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nas variáveis de ambiente do Netlify (ou no arquivo .env) e publique de novo.</span>
    </div>);
  return <SessaoProvider><Sprite /><Conteudo /></SessaoProvider>;
}
