import { useEffect, useState } from 'react';
import * as api from '../lib/api.js';
import { useSessao } from '../contexto/Sessao.jsx';
import { CamposPerfil, Avatar } from './Acesso.jsx';
import { validaSenha, dataHora, POSTO_OFICIAL, SENHA_MIN } from '../lib/util.js';
import { FUNCOES, SECOES } from '../elogios/regras.js';

const catDe = p => p?.categoria || (POSTO_OFICIAL.test(p?.posto || '') ? 'oficial' : 'praca');

export default function MeuPerfil(){
  const { perfil, setPerfil, ehAdmin, avisar, registrar } = useSessao();
  const [v, setV] = useState({ ...perfil });
  const [s, setS] = useState({ atual: '', nova: '', nova2: '' });
  useEffect(() => setV({ ...perfil }), [perfil]);
  const salvar = async () => {
    try { const p = await api.salvarPerfil(perfil.id, { nome: v.nome.trim(), posto: v.posto.trim(), setor: v.setor.trim(), foto: v.foto || null }); setPerfil(p); registrar('perfil', 'atualizou o próprio perfil'); avisar('Perfil salvo'); }
    catch (e){ avisar(e.message, 'err'); }
  };
  const trocar = async () => {
    const e = validaSenha(s.nova, s.nova2); if (e) return alert(e);
    try { await api.trocarSenha(perfil.usuario, s.atual, s.nova); setS({ atual: '', nova: '', nova2: '' }); registrar('perfil', 'alterou a própria senha'); avisar('Senha alterada'); }
    catch (x){ alert(x.message); }
  };
  const inp = { width: '100%', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8 };
  const lab = { display: 'block', margin: '12px 0 4px', fontWeight: 600, fontSize: 13 };
  return (
    <section className="view ativa">
      <div className="card campos-form" style={{ maxWidth: 560 }}>
        <h3>Meu perfil</h3>
        <CamposPerfil v={v} set={setV} travarCategoria />
        <div style={{ marginTop: 18 }}><button className="btn pri" onClick={salvar}>Salvar perfil</button></div>
      </div>
      <div className="card" style={{ maxWidth: 560, marginTop: 16 }}>
        <h3>Usuário e senha</h3>
        <p className="dica" style={{ margin: '-6px 0 4px' }}>Seu usuário de acesso: <b>{perfil.usuario}</b> · Cadastrado como <b>{catDe(perfil) === 'oficial' ? 'Oficial' : 'Praça'}</b> <small>(só o administrador altera)</small></p>
        <label style={lab}>Senha atual</label><input type="password" style={inp} value={s.atual} onChange={e => setS({ ...s, atual: e.target.value })} autoComplete="current-password" />
        <label style={lab}>Nova senha</label><input type="password" style={inp} value={s.nova} onChange={e => setS({ ...s, nova: e.target.value })} autoComplete="new-password" />
        <label style={lab}>Confirmar nova senha</label><input type="password" style={inp} value={s.nova2} onChange={e => setS({ ...s, nova2: e.target.value })} autoComplete="new-password" />
        <div style={{ marginTop: 16 }}><button className="btn pri" onClick={trocar}>Alterar senha</button></div>
      </div>
      {ehAdmin && <AdminUsuarios />}
    </section>
  );
}

function AdminUsuarios(){
  const { perfil: eu, avisar, registrar } = useSessao();
  const [perfis, setPerfis] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [editando, setEditando] = useState(null);
  const carregar = async () => { try { setPerfis(await api.listarPerfis()); setPedidos(await api.pedidosPendentes()); } catch (e){ avisar(e.message, 'err'); } };
  useEffect(() => { carregar(); }, []);
  const redefinir = async p => {
    const prov = prompt(`Senha provisória para "${p.nome}" (usuário ${p.usuario}).\nPasse para a pessoa; no próximo acesso o sistema pede para ela criar uma senha nova.\n(mínimo ${SENHA_MIN} caracteres)`, String(Math.floor(100000 + Math.random() * 900000)));
    if (prov == null) return;
    if (prov.length < SENHA_MIN) return alert(`A senha provisória precisa ter pelo menos ${SENHA_MIN} caracteres.`);
    try { await api.redefinirSenhaAdmin(p.id, prov); registrar('perfil', `redefiniu a senha de ${p.nome} (usuário ${p.usuario})`); alert(`Senha provisória de ${p.nome}: ${prov}\nUsuário: ${p.usuario}`); carregar(); }
    catch (e){ alert(e.message); }
  };
  const excluir = async p => {
    if (!confirm(`Excluir o usuário ${p.nome} (${p.usuario})? Os documentos dele continuam no sistema.`)) return;
    try { await api.excluirPerfilAdmin(p.id); registrar('perfil', `excluiu o usuário ${p.nome} (${p.usuario})`); carregar(); } catch (e){ alert(e.message); }
  };
  const salvarEdicao = async () => {
    try { await api.salvarPerfil(editando.id, { nome: editando.nome, posto: editando.posto, setor: editando.setor, categoria: editando.categoria, papel: editando.papel, ...('funcao' in editando ? { funcao: editando.funcao || '' } : {}), ...('secao' in editando ? { secao: editando.secao || '' } : {}) }); registrar('perfil', `editou o perfil de ${editando.nome}`); setEditando(null); carregar(); }
    catch (e){ alert(e.message); }
  };
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3>Perfis cadastrados</h3>
      <p className="dica" style={{ margin: '-6px 0 10px' }}>Só o administrador vê esta lista. Use <b>Redefinir senha</b> quando alguém esquecer a senha.</p>
      {pedidos.map(x => { const p = perfis?.find(y => y.id === x.perfil_id); return p && (
        <div className="pedido-senha" key={x.id}>
          <div><b>{p.nome} pediu redefinição de senha</b><small>usuário {x.usuario} · {dataHora(x.em)}{x.msg ? ` · “${x.msg}”` : ''}</small></div>
          <button className="btn peq pri" onClick={() => redefinir(p)}>Redefinir senha</button>
          <button className="btn peq" onClick={async () => { await api.recusarPedido(x.id); registrar('perfil', `recusou o pedido de senha de ${p.nome}`); carregar(); }}>Recusar</button>
        </div>); })}
      {!perfis && <div className="vazio">Carregando…</div>}
      <div className="lista-rec">
        {perfis?.map(p => (
          <div className="linha" key={p.id}>
            <Avatar perfil={p} tam={36} />
            <div className="nm"><b>{p.nome}{p.papel === 'admin' ? ' · ADMIN' : ''}</b>
              <small>{['usuário ' + p.usuario, catDe(p) === 'oficial' ? 'Oficial' : 'Praça', p.posto, p.setor, p.funcao && FUNCOES[p.funcao], p.secao && p.secao.toUpperCase()].filter(Boolean).join(' · ')}{p.trocar_senha ? ' · senha provisória' : ''}{p.ultimo_acesso ? ' · último acesso ' + dataHora(p.ultimo_acesso) : ''}</small></div>
            <button className="btn peq" onClick={() => setEditando({ ...p, categoria: catDe(p) })}>Editar</button>
            <button className="btn peq" onClick={() => redefinir(p)}>Redefinir senha</button>
            {p.id !== eu.id && <button className="btn peq perigo" onClick={() => excluir(p)}>Excluir</button>}
          </div>))}
      </div>
      {editando && (
        <div className="campos-form" style={{ marginTop: 14, border: '1px solid var(--line)', borderRadius: 12, padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Editar {editando.usuario}</h3>
          <CamposPerfil v={editando} set={setEditando} comFoto={false} />
          <label>Papel</label>
          <select value={editando.papel} onChange={e => setEditando({ ...editando, papel: e.target.value })}><option value="usuario">Usuário</option><option value="admin">Administrador</option></select>
          <label>Função de comando (Elogios)</label>
          {'funcao' in editando
            ? <select value={editando.funcao || ''} onChange={e => setEditando({ ...editando, funcao: e.target.value })}>{Object.entries(FUNCOES).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
            : <p className="dica">Rode o arquivo <b>supabase/003_elogios.sql</b> no Supabase para poder definir a função.</p>}
          <label>Seção do Estado-Maior</label>
          {'secao' in editando
            ? <select value={editando.secao || ''} onChange={e => setEditando({ ...editando, secao: e.target.value })}>{Object.entries(SECOES).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
            : <p className="dica">Rode o arquivo <b>supabase/004_secoes_p1.sql</b> no Supabase para poder definir a seção.</p>}
          <p className="dica" style={{ marginTop: 4 }}>Quem tem função de comando ou é da P1 vê o menu Elogios. Só o Comandante e o Subcomandante do BTL autorizam; só a P1 marca como publicado.</p>
          <div className="tp-acoes"><button className="btn" onClick={() => setEditando(null)}>Cancelar</button><button className="btn pri" onClick={salvarEdicao}>Salvar</button></div>
        </div>)}
    </div>
  );
}
