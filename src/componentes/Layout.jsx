import { useEffect, useState } from 'react';
import { Ic } from './Icones.jsx';
import { Avatar } from '../telas/Acesso.jsx';
import { useSessao } from '../contexto/Sessao.jsx';
import { CAT_DOCM, CAT_PROC } from '../lib/catalogo.js';

const abertoSalvo = k => { try { return localStorage.getItem(k) === '1'; } catch { return false; } };

export default function Layout({ view, ir, titulo, sub, tags = {}, abrirGuia, children }){
  const { perfil, ehAdmin, ehOficial, status, sair, setPerfil } = useSessao();
  const [recolhido, setRecolhido] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [docsAberto, setDocsAberto] = useState(abertoSalvo('gp-docs-aberto'));
  const [procAberto, setProcAberto] = useState(abertoSalvo('gp-proc-aberto'));
  useEffect(() => { document.body.classList.toggle('recolhido', recolhido); }, [recolhido]);
  useEffect(() => { document.body.classList.toggle('menu-aberto', menuAberto); }, [menuAberto]);
  useEffect(() => { document.body.classList.toggle('admin', ehAdmin); }, [ehAdmin]);
  useEffect(() => { try { localStorage.setItem('gp-docs-aberto', docsAberto ? '1' : '0'); localStorage.setItem('gp-proc-aberto', procAberto ? '1' : '0'); } catch {} }, [docsAberto, procAberto]);
  useEffect(() => { if (/^(oficio|os|dm-(?!pr-))/.test(view)) setDocsAberto(true); if (/^dm-pr-/.test(view)) setProcAberto(true); }, [view]);

  const item = (v, nome, icone, tag) => (
    <a href="#" key={v} className={view === v ? 'ativo' : ''} title={nome} onClick={e => { e.preventDefault(); setMenuAberto(false); ir(v); }}>
      <Ic n={icone} t={tag === undefined ? 20 : 20} /><span>{nome}</span>{tag !== undefined && <em className="tag">{tag}</em>}
    </a>);
  const sub2 = (v, nome, icone, tag) => (
    <a href="#" key={v} className={view === v ? 'ativo' : ''} title={nome} onClick={e => { e.preventDefault(); setMenuAberto(false); ir(v); }}>
      <Ic n={icone} t={16} /><span>{nome}</span>{tag !== undefined && <em className="tag">{tag}</em>}
    </a>);
  const temaEscuro = perfil?.tema === 'escuro';
  let grupo = '';
  return (<>
    <div className="overlay" onClick={() => setMenuAberto(false)} />
    <aside className="sidebar">
      <button className="btn-recolher" title="Recolher / expandir menu" onClick={() => setRecolhido(!recolhido)}><Ic n="chev" t={14} /></button>
      <div className="brand"><div className="escudo"><img src="/brasao.png" alt="Brasão PM-TO" /></div><div className="brand-txt"><b>PM-TO</b><small>Gestão de Ensino</small></div></div>
      <div className="perfil" title="Meu perfil" onClick={() => ir('perfil')}>
        <Avatar perfil={perfil} />
        <div className="info"><b>{perfil?.nome}{ehAdmin && <em className="tag-adm"> ADMIN</em>}</b><span>{[perfil?.posto, perfil?.setor].filter(Boolean).join(' · ') || 'Seu perfil'}</span></div>
      </div>
      <nav className="nav">
        <div className="grupo">Principal</div>
        {item('painel', 'Painel', 'painel')}
        <div className="grupo">Escalas</div>
        {item('aco', 'Criar escala de ACO', 'escala', tags.aco ?? 0)}
        <div className="grupo">Documentos</div>
        <a href="#" className={'nav-pai' + (docsAberto ? ' aberto' : '')} onClick={e => { e.preventDefault(); setRecolhido(false); setDocsAberto(!docsAberto); }}><Ic n="doc" /><span>Documentos</span><i className="seta">▸</i></a>
        {docsAberto && <div className="nav-sub">
          {sub2('oficio', 'Ofícios', 'oficio', tags.oficio ?? 0)}
          {sub2('os', 'Ordens de Serviço', 'os', tags.os ?? 0)}
          {CAT_DOCM.map(([k, n]) => sub2('dm-' + k, n, 'doc'))}
        </div>}
        {ehOficial && <>
          <a href="#" className={'nav-pai' + (procAberto ? ' aberto' : '')} title="Procedimentos (só oficiais)" onClick={e => { e.preventDefault(); setRecolhido(false); setProcAberto(!procAberto); }}><Ic n="balanca" /><span>Procedimentos</span><i className="seta">▸</i></a>
          {procAberto && <div className="nav-sub">
            {CAT_PROC.map(([k, n, g]) => { const cab = g !== grupo ? (grupo = g, <div className="sub-grupo" key={'g' + k}>{g}</div>) : null; return [cab, sub2('dm-' + k, n, 'balanca')]; })}
          </div>}
        </>}
        {item('planilhas', 'Planilhas', 'tabela', tags.planilhas ?? 0)}
        <div className="grupo">Sistema</div>
        <a href="#" className="nav-guia" title="Guia do sistema" onClick={e => { e.preventDefault(); setMenuAberto(false); abrirGuia?.(); }}><Ic n="livro" t={20} /><span>Guia do sistema</span></a>
        {ehAdmin && item('registros', 'Registros', 'lista')}
        {item('perfil', 'Meu perfil', 'user')}
      </nav>
      <div className="rodape-side">
        <a href="#" className="trocar" title="Sair / trocar usuário" onClick={e => { e.preventDefault(); sair(); }}><Ic n="troca" t={18} /><span>Sair / trocar usuário</span></a>
        <div className="pasta" title="Os dados ficam no banco de dados on-line"><i className="dot ok" /><span>Banco de dados on-line</span></div>
      </div>
    </aside>
    <div className="principal">
      <div className="topo">
        <button className="btn-menu" onClick={() => setMenuAberto(true)}><Ic n="menu" t={24} /></button>
        <div><h1>{titulo}</h1><div className="sub">{sub}</div></div>
        <div className="dir">
          <span id="status" className={status.cls}>{status.t}</span>
          <button className="btn-tema" title="Alternar tema claro / escuro" onClick={async () => { const t = temaEscuro ? 'claro' : 'escuro'; setPerfil({ ...perfil, tema: t }); try { const { salvarPerfil } = await import('../lib/api.js'); await salvarPerfil(perfil.id, { tema: t }); } catch {} }}>
            <svg className="sol" width="18" height="18"><use href="#i-sol" /></svg><svg className="lua" width="18" height="18"><use href="#i-lua" /></svg>
          </button>
        </div>
      </div>
      <div className="conteudo">{children}
        <div className="credito"><a href="https://www.linkedin.com/in/vinicius-rodrigues-060b68208/" target="_blank" rel="noopener noreferrer">Conhecer Desenvolvedor</a></div>
      </div>
    </div>
  </>);
}
