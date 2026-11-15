/* Telas de acesso: entrar, criar usuário, esqueci minha senha e nova senha (após redefinição) */
import { useEffect, useRef, useState } from 'react';
import * as api from '../lib/api.js';
import { normUser, validaSenha, validaUsuario, iniciais, reduzirImagem } from '../lib/util.js';
import { useSessao } from '../contexto/Sessao.jsx';
import { Ic } from '../componentes/Icones.jsx';

const lerSalvo = () => { try { return localStorage.getItem('gp-usuario-salvo') || ''; } catch { return ''; } };
const salvarUsuario = u => { try { u ? localStorage.setItem('gp-usuario-salvo', u) : localStorage.removeItem('gp-usuario-salvo'); } catch {} };

export function Avatar({ perfil, tam, foto }){
  const src = foto ?? perfil?.foto;
  return <div className="avatar" style={tam ? { width: tam, height: tam, fontSize: tam * 0.36 } : undefined}>{src ? <img src={src} alt="" /> : iniciais(perfil?.nome)}</div>;
}

export default function Acesso({ modoInicial }){
  const [modo, setModo] = useState(modoInicial || 'entrar');
  return (
    <div id="tela-perfis">
      <div className="tp-box">
        <div className="tp-topo"><img src="/brasao.png" alt="Brasão PM-TO" /><div><small>PM-TO · Gestão de Ensino</small></div></div>
        {modo === 'entrar' && <Entrar ir={setModo} />}
        {modo === 'criar' && <Criar ir={setModo} />}
        {modo === 'esqueci' && <Esqueci ir={setModo} />}
        {modo === 'nova' && <NovaSenha />}
      </div>
    </div>
  );
}

function Entrar({ ir }){
  const [salvo, setSalvo] = useState(lerSalvo());
  const [pub, setPub] = useState(null);
  const [usuario, setUsuario] = useState(salvo);
  const [senha, setSenha] = useState('');
  const [lembrar, setLembrar] = useState(true);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const refSenha = useRef();
  useEffect(() => { if (salvo) api.perfilPublico(salvo).then(p => { if (p) setPub(p); else { salvarUsuario(''); setSalvo(''); } }).catch(() => {}); }, [salvo]);
  useEffect(() => { if (salvo) refSenha.current?.focus(); }, [salvo]);
  const entrar = async () => {
    const u = normUser(usuario);
    if (!u || !senha){ setErro('Informe usuário e senha.'); return; }
    setOcupado(true); setErro('');
    try { await api.entrar(u, senha); if (!salvo) salvarUsuario(lembrar ? u : ''); }
    catch (e){ setErro(e.message); setSenha(''); refSenha.current?.focus(); }
    setOcupado(false);
  };
  const tecla = e => { if (e.key === 'Enter') entrar(); };
  return (
    <div>
      <h2>Entrar no sistema</h2>
      <div className="tp-card-form">
        {salvo && pub ? (
          <div id="tp-l-salvo"><Avatar perfil={pub} /><div><b>{pub.nome}</b><small>{['usuário ' + salvo, pub.posto].filter(Boolean).join(' · ')}</small></div></div>
        ) : (<><label>Usuário</label><input value={usuario} onChange={e => setUsuario(e.target.value)} onKeyDown={tecla} autoComplete="username" autoCapitalize="none" spellCheck="false" autoFocus /></>)}
        <label>Senha</label><input ref={refSenha} type="password" value={senha} onChange={e => setSenha(e.target.value)} onKeyDown={tecla} autoComplete="current-password" />
        {!salvo && <label className="tp-lembrar"><input type="checkbox" checked={lembrar} onChange={e => setLembrar(e.target.checked)} /> Salvar meu usuário neste computador</label>}
        {erro && <p className="tp-erro">{erro}</p>}
        <button className="btn pri" style={{ width: '100%', marginTop: 18, padding: 10 }} onClick={entrar} disabled={ocupado}>{ocupado ? 'Entrando…' : 'Entrar'}</button>
        <div className="tp-links">
          {salvo ? <button onClick={() => { salvarUsuario(''); setSalvo(''); setPub(null); setUsuario(''); }}>Entrar com outro usuário</button> : <button onClick={() => ir('criar')}>Criar usuário</button>}
          <button onClick={() => ir('esqueci')}>Esqueci minha senha</button>
        </div>
      </div>
    </div>
  );
}

export function CamposPerfil({ v, set, comFoto = true, travarCategoria }){
  const escolherFoto = async e => { const f = e.target.files[0]; if (f) set({ ...v, foto: await reduzirImagem(f) }); };
  return (<>
    {comFoto && <div className="foto-edit"><Avatar perfil={v} /><div>
      <label className="btn peq" style={{ display: 'inline-block' }}>Escolher foto<input type="file" accept="image/*" hidden onChange={escolherFoto} /></label>{' '}
      <button className="btn peq perigo" onClick={() => set({ ...v, foto: null })}>Remover</button>
      <p className="dica">A foto fica salva no banco de dados, então aparece em qualquer computador.</p></div></div>}
    <label>Nome de guerra / nome</label><input value={v.nome} onChange={e => set({ ...v, nome: e.target.value })} />
    <label>Posto / graduação</label><input value={v.posto} onChange={e => set({ ...v, posto: e.target.value })} placeholder="Ex.: 2º Sgt PM" />
    <label>Setor / função</label><input value={v.setor} onChange={e => set({ ...v, setor: e.target.value })} placeholder="Ex.: Seção de Ensino" />
    {!travarCategoria && <><label>Você é</label>
      <div className="tp-cat">
        {[['oficial', 'Oficial', 'Asp Of a Cel · vê também Procedimentos'], ['praca', 'Praça', 'Sd a ST']].map(([k, t, d]) =>
          <label key={k}><input type="radio" name="tp-cat" checked={v.categoria === k} onChange={() => set({ ...v, categoria: k })} /><span><b>{t}</b><small>{d}</small></span></label>)}
      </div></>}
  </>);
}

function Criar({ ir }){
  const [v, setV] = useState({ nome: '', posto: '', setor: '', categoria: '', foto: null, usuario: '', senha: '', senha2: '' });
  const [erro, setErro] = useState(''); const [ocupado, setOcupado] = useState(false);
  const salvar = async () => {
    const u = normUser(v.usuario);
    if (!v.nome.trim()) return setErro('Informe o nome de guerra ou nome.');
    if (!v.categoria) return setErro('Marque se você é Oficial ou Praça.');
    let e = validaUsuario(u); if (e) return setErro(e);
    e = validaSenha(v.senha, v.senha2); if (e) return setErro(e);
    setOcupado(true); setErro('');
    try {
      const s = await api.criarUsuario({ usuario: u, senha: v.senha, nome: v.nome.trim(), posto: v.posto.trim(), setor: v.setor.trim(), categoria: v.categoria });
      if (v.foto) await api.salvarPerfil(s.user.id, { foto: v.foto });
      salvarUsuario(u);
      await api.registrar({ id: s.user.id, nome: v.nome.trim(), posto: v.posto.trim() }, 'perfil', `criou o próprio usuário "${u}"`);
    } catch (x){ setErro(x.message); }
    setOcupado(false);
  };
  return (
    <div>
      <h2>Criar usuário</h2>
      <div className="tp-card-form">
        <CamposPerfil v={v} set={setV} />
        <div className="tp-sep">Acesso</div>
        <label>Usuário <small style={{ fontWeight: 400, color: 'var(--muted)' }}>(para entrar; sem espaços)</small></label>
        <input value={v.usuario} onChange={e => setV({ ...v, usuario: e.target.value })} autoComplete="username" autoCapitalize="none" spellCheck="false" placeholder="Ex.: sd.rodrigues" />
        <label>Senha <small style={{ fontWeight: 400, color: 'var(--muted)' }}>(mínimo 6 caracteres)</small></label>
        <input type="password" value={v.senha} onChange={e => setV({ ...v, senha: e.target.value })} autoComplete="new-password" />
        <label>Confirmar senha</label>
        <input type="password" value={v.senha2} onChange={e => setV({ ...v, senha2: e.target.value })} onKeyDown={e => e.key === 'Enter' && salvar()} autoComplete="new-password" />
        {erro && <p className="tp-erro">{erro}</p>}
        <div className="tp-acoes"><button className="btn" onClick={() => ir('entrar')}>Voltar</button><button className="btn pri" onClick={salvar} disabled={ocupado}>{ocupado ? 'Criando…' : 'Salvar e entrar'}</button></div>
      </div>
    </div>
  );
}

function Esqueci({ ir }){
  const [usuario, setUsuario] = useState(lerSalvo()); const [msg, setMsg] = useState('');
  const [erro, setErro] = useState(''); const [ok, setOk] = useState(false);
  const enviar = async () => {
    if (!normUser(usuario)) return setErro('Informe o seu usuário.');
    try { const achou = await api.pedirRedefinicao(usuario, msg); if (!achou) return setErro('Usuário não encontrado. Confira como você escreveu.'); setOk(true); setErro(''); setTimeout(() => ir('entrar'), 3500); }
    catch (e){ setErro(e.message); }
  };
  return (
    <div>
      <h2>Esqueci minha senha</h2>
      <div className="tp-card-form">
        <p className="dica" style={{ margin: 0 }}>O pedido vai para o <b>administrador</b>, que define uma senha provisória e passa para você. No primeiro acesso com ela, o sistema pede para criar uma senha nova.</p>
        <label>Seu usuário</label><input value={usuario} onChange={e => setUsuario(e.target.value)} autoCapitalize="none" spellCheck="false" />
        <label>Recado para o administrador <small style={{ fontWeight: 400, color: 'var(--muted)' }}>(opcional)</small></label>
        <input value={msg} onChange={e => setMsg(e.target.value)} placeholder="Ex.: estou na Seção de Ensino, ramal 2201" />
        {erro && <p className="tp-erro">{erro}</p>}
        {ok && <p className="tp-ok">Pedido enviado ao administrador. Quando ele redefinir, você recebe uma senha provisória.</p>}
        <div className="tp-acoes"><button className="btn" onClick={() => ir('entrar')}>Voltar</button><button className="btn pri" onClick={enviar} disabled={ok}>Enviar pedido</button></div>
      </div>
    </div>
  );
}

function NovaSenha(){
  const { perfil, recarregarPerfil, sair, registrar } = useSessao();
  const [a, setA] = useState(''); const [b, setB] = useState(''); const [erro, setErro] = useState('');
  const salvar = async () => {
    const e = validaSenha(a, b); if (e) return setErro(e);
    try { await api.definirNovaSenha(a, perfil.id); registrar('perfil', 'criou uma senha nova após a redefinição'); await recarregarPerfil(); }
    catch (x){ setErro(/different|same/i.test(x.message) ? 'Use uma senha diferente da provisória.' : x.message); }
  };
  return (
    <div>
      <h2>Criar nova senha</h2>
      <div className="tp-card-form">
        <p className="dica" style={{ margin: 0 }}>Você entrou com a senha provisória. Crie agora a sua senha pessoal.</p>
        <label>Nova senha</label><input type="password" value={a} onChange={e => setA(e.target.value)} autoComplete="new-password" autoFocus />
        <label>Confirmar nova senha</label><input type="password" value={b} onChange={e => setB(e.target.value)} onKeyDown={e => e.key === 'Enter' && salvar()} autoComplete="new-password" />
        {erro && <p className="tp-erro">{erro}</p>}
        <div className="tp-acoes"><button className="btn" onClick={sair}>Cancelar</button><button className="btn pri" onClick={salvar}>Salvar e entrar</button></div>
      </div>
    </div>
  );
}
