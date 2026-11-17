import { useEffect, useMemo, useRef, useState } from 'react';
import { useSessao } from '../contexto/Sessao.jsx';
import * as R from '../elogios/regras.js';
import * as BD from '../elogios/dados.js';
import * as DOC from '../elogios/documentos.js';
import { carregarPdfjs, baixar } from '../aco/pdf.js';
import { salvarPendente } from '../legado/ponte.js';
import { lerBoletim } from '../elogios/boletim.js';

/* Elogios e referências elogiosas — Portaria Normativa nº 020/2025-PM1
   Fluxo: o comandante imediato (CPU ou Cmt de Cia) solicita por ofício → o Cmt do BTL (ou o Subcmt, respondendo
   pelo Comando) autoriza por despacho e encaminha o item para publicação em BI ou BG → publicado. */
const PASSOS = ['Tipo', 'O fato', 'Policiais', 'Solicita e publica', 'Ofício'];
const POSTOS = ['CEL', 'TEN CEL', 'MAJ', 'CAP', '1º TEN', '2º TEN', 'ASP OF', 'CAD', 'ST', '1º SGT', '2º SGT', '3º SGT', 'CB', 'SD'];
const uid = () => crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
const clone = o => JSON.parse(JSON.stringify(o));

export default function Elogios({ ir, aoMudar }){
  const S = useSessao();
  const { perfil, ehAdmin, registrar, avisar } = S;
  const [estado, setEstado] = useState('carregando');
  const [erro, setErro] = useState('');
  const [lista, setLista] = useState([]);
  const [fatos, setFatos] = useState([]);
  const [cmts, setCmts] = useState([]);
  const [abertoId, setAbertoId] = useState(() => { try { return sessionStorage.getItem('elogio-aberto-' + perfil?.id) || null; } catch { return null; } });
  const opts = { perfil, admin: ehAdmin, registrar, avisar, ir, aoSalvar: () => {} };

  const recarregar = async () => {
    const [l, f, c] = await Promise.all([BD.listarElogios(), BD.fatosElogios(), BD.comandantes()]);
    setLista(l); setFatos(f); setCmts(c); aoMudar?.();
  };
  useEffect(() => {
    let vivo = true;
    Promise.all([DOC.motorDocs(opts), recarregar()]).then(() => vivo && setEstado('pronto')).catch(e => { if (vivo){ setErro(e.message); setEstado('erro'); } });
    return () => { vivo = false; };
  }, [perfil?.id]);
  useEffect(() => { try { abertoId ? sessionStorage.setItem('elogio-aberto-' + perfil?.id, abertoId) : sessionStorage.removeItem('elogio-aberto-' + perfil?.id); } catch {} }, [abertoId]);

  if (estado === 'erro') return <section className="view ativa"><div className="card"><h3>Não consegui abrir os Elogios</h3><p className="dica">{erro}</p></div></section>;
  if (estado === 'carregando') return <section className="view ativa"><div className="card"><div className="vazio"><span className="spinner" /> Carregando elogios…</div></div></section>;
  const aberto = abertoId && lista.find(x => x.id === abertoId);
  const atualizar = e => setLista(l => l.some(x => x.id === e.id) ? l.map(x => x.id === e.id ? e : x) : [e, ...l]);
  if (aberto) return <Pedido key={aberto.id} inicial={aberto} fatos={fatos} cmts={cmts} voltar={() => { setAbertoId(null); recarregar(); }} atualizar={atualizar} remover={id => { setLista(l => l.filter(x => x.id !== id)); setAbertoId(null); }} />;
  return <Lista lista={lista} cmts={cmts} abrir={id => setAbertoId(id)} criar={e => { atualizar(e); setAbertoId(e.id); }} />;
}

/* ================= lista / controle ================= */
function Lista({ lista, cmts, abrir, criar }){
  const { perfil, ehAdmin, registrar, avisar } = useSessao();
  const [f, setF] = useState({ tipo: '', sit: '', per: 'ano', busca: '' });
  const [importando, setImportando] = useState(false);
  const inp = useRef(), inpBo = useRef();
  const autoriza = ehAdmin || R.ehAutorizador(perfil?.funcao);
  const hoje = R.hojeISO();
  const filtrada = useMemo(() => lista.filter(e => {
    if (f.tipo && e.tipo !== f.tipo) return false;
    if (f.sit && e.situacao !== f.sit) return false;
    const d = e.fato?.data || e.criadoEm?.slice(0, 10) || '';
    if (f.per === 'ano' && d.slice(0, 4) !== hoje.slice(0, 4)) return false;
    if (f.per === 'mes' && d.slice(0, 7) !== hoje.slice(0, 7)) return false;
    if (f.busca){ const q = f.busca.toLowerCase(); if (!JSON.stringify([e.fato, e.policiais, e.autor, e.oficio?.epigrafe]).toLowerCase().includes(q)) return false; }
    return true;
  }).sort((a, b) => (b.fato?.data || '').localeCompare(a.fato?.data || '') || (b.alteradoEm || '').localeCompare(a.alteradoEm || '')), [lista, f]);
  const n = s => lista.filter(e => s.includes(e.situacao)).length;
  const fora = lista.filter(e => ['rascunho', 'devolvido', 'solicitado'].includes(e.situacao) && R.foraDoPrazo(e)).length;

  const novo = async (extra = {}) => {
    const base = DOC.baseUnidade(perfil);
    const e = { ...R.novoPedido(perfil, base), ...extra, id: uid(), situacao: 'rascunho' };
    const cmt = cmts.find(c => c.funcao === 'cmt_btl');
    if (cmt && !extra.destino) e.destino = { ...e.destino, posto: cmt.posto || '', nome: cmt.nome || '', funcao: `Comandante do ${e.publicacao.unidade || cmt.setor || 'BTL'}` };
    e.historico = [{ em: new Date().toISOString(), por: quem(perfil), acao: extra.oficio ? 'importou o ofício já feito' : extra.boletim ? `começou o pedido pelo ${extra.boletim.tipoRegistro || 'BO'} ${extra.boletim.protocolo}` : 'começou o pedido' }];
    try { const g = await BD.gravarElogio(e, perfil); registrar('elogio', `começou um pedido de ${R.rotuloTipo(e).toLowerCase()}`); criar(g); }
    catch (er){ alert(er.message); }
  };
  const importar = async file => {
    if (!file) return; setImportando(true);
    try {
      const d = await DOC.motorDocs({});
      const { texto, oficio } = await d.importarOficio(file);
      const x = R.lerOficioPronto(texto);
      const p = R.novoPedido(perfil, DOC.baseUnidade(perfil));
      const extra = {
        tipo: x.tipo || p.tipo, alcance: x.alcance || p.alcance,
        fato: { ...p.fato, ...x.fato }, policiais: x.policiais?.length ? x.policiais : p.policiais,
        solicitante: { ...p.solicitante, ...Object.fromEntries(Object.entries(x.solicitante || {}).filter(([, v]) => v)), ...(x.oficioNumero?.setores ? { setores: x.oficioNumero.setores } : {}) },
        destino: { ...p.destino, ...Object.fromEntries(Object.entries(x.destino || {}).filter(([, v]) => v)) },
        oficio: { ...DOC.infoOficio(oficio), importado: file.name }
      };
      if (x.oficioNumero){ oficio.campos.numero = String(x.oficioNumero.numero).padStart(3, '0'); oficio.campos.ano = x.oficioNumero.ano; }
      if (x.sgd) oficio.campos.sgd = x.sgd;
      extra.oficio = { ...DOC.infoOficio(oficio), importado: file.name };
      await novo(extra);
      avisar('Ofício importado: confira os dados de cada passo');
    } catch (er){ console.error(er); alert('Não consegui ler este ofício: ' + er.message); }
    finally { setImportando(false); }
  };
  const importarBo = async file => {
    if (!file) return; setImportando(true);
    try {
      const d = await lerBoletim(file);
      const p = R.novoPedido(perfil, DOC.baseUnidade(perfil));
      p.policiais = [];
      R.aplicarBoletim(p, d, file.name);
      if (!p.policiais.length) p.policiais = [R.novoPolicial()];
      await novo({ fato: p.fato, boletim: p.boletim, policiais: p.policiais });
      avisar(`Boletim lido: ${d.guarnicao.length} policial(is) na guarnição. Marque no passo 3 quem recebe o elogio.`);
    } catch (er){ console.error(er); alert('Não consegui ler este boletim: ' + er.message); }
    finally { setImportando(false); }
  };
  return (
    <section className="view ativa el">
      <div className="el-acoes">
        <button className="btn pri" onClick={() => novo()}>＋ Novo pedido de elogio / referência</button>
        <button className="btn" disabled={importando} onClick={() => inp.current.click()}>{importando ? <><span className="spinner" /> Lendo…</> : 'Importar ofício já feito (Word ou PDF)'}</button>
        <button className="btn" disabled={importando} onClick={() => inpBo.current.click()}>Importar boletim de ocorrência (PDF)</button>
        <input ref={inp} type="file" hidden accept=".pdf,.docx" onChange={e => { importar(e.target.files[0]); e.target.value = ''; }} />
        <input ref={inpBo} type="file" hidden accept=".pdf" onChange={e => { importarBo(e.target.files[0]); e.target.value = ''; }} />
        <span className="esp" />
        <span className="tg ef" title="A Portaria nº 017/2014-GCG foi revogada (art. 21)">{R.NORMA}</span>
      </div>
      <div className="kpis el-kpis">
        <Kpi ic="✍" v={n(['rascunho', 'devolvido'])} l="Rascunhos e devolvidos" />
        <Kpi ic="⚖" v={n(['solicitado'])} l={autoriza ? 'Aguardando a sua autorização' : 'Aguardando o Cmt do BTL'} ouro={autoriza && n(['solicitado']) > 0} />
        <Kpi ic="★" v={n(['autorizado', 'publicado'])} l="Autorizados / publicados" />
        <Kpi ic="⏱" v={fora} l={`Pendentes há mais de ${R.PRAZO_DIAS} dias do fato`} />
      </div>
      <div className="card">
        <h3>Controle de elogios e referências elogiosas</h3>
        <div className="el-filtros">
          <input placeholder="Buscar por policial, matrícula, BO, natureza…" value={f.busca} onChange={e => setF({ ...f, busca: e.target.value })} />
          <select value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value })}><option value="">Todos os tipos</option><option value="elogio">Elogio</option><option value="referencia">Referência elogiosa</option></select>
          <select value={f.sit} onChange={e => setF({ ...f, sit: e.target.value })}><option value="">Todas as situações</option>{Object.entries(R.SITUACOES).map(([k, [t]]) => <option key={k} value={k}>{t}</option>)}</select>
          <select value={f.per} onChange={e => setF({ ...f, per: e.target.value })}><option value="ano">Este ano</option><option value="mes">Este mês</option><option value="">Todo o período</option></select>
        </div>
        {!filtrada.length ? <div className="vazio">{lista.length ? 'Nada com esses filtros.' : 'Nenhum pedido ainda. Clique em “Novo pedido” ou importe um ofício já feito.'}</div> :
          <div className="rolar-x"><table className="el-tab">
            <thead><tr><th>Fato</th><th>Tipo</th><th>Policial(is)</th><th>Solicitante</th><th>Situação</th><th></th></tr></thead>
            <tbody>{filtrada.map(e => <LinhaPedido key={e.id} e={e} abrir={() => abrir(e.id)} />)}</tbody>
          </table></div>}
        <p className="dica">{autoriza ? 'Você vê os pedidos enviados por todos os comandantes imediatos e os seus.' : 'Você vê os seus pedidos. A conferência de “elogio repetido pelo mesmo fato” olha os pedidos de todos os usuários.'}</p>
      </div>
    </section>
  );
}
const quem = p => [p?.posto, p?.nome].filter(Boolean).join(' ');
const Kpi = ({ ic, v, l, ouro }) => <div className="kpi"><div className={'ic' + (ouro ? ' ouro' : '')} style={{ fontSize: 20 }}>{ic}</div><div><div className="v">{v}</div><div className="l">{l}</div></div></div>;
const Situacao = ({ s }) => { const [t, c] = R.SITUACOES[s] || [s, 'cinza']; return <span className={'el-sit ' + c}>{t}</span>; };
function LinhaPedido({ e, abrir }){
  const ps = R.policiaisValidos(e);
  return (
    <tr onClick={abrir} style={{ cursor: 'pointer' }}>
      <td><b>{R.dataBR(e.fato?.data) || 'sem data'}{e.fato?.hora ? ' · ' + R.horaBR(e.fato.hora) : ''}</b><small>{R.tituloPedido(e)}{e.fato?.bo ? ' · ' + e.fato.bo : ''}</small></td>
      <td><span className={'el-tipo ' + (e.tipo === 'elogio' ? 'e' : 'r')}>{R.rotuloTipo(e)}</span></td>
      <td>{ps.slice(0, 2).map((p, k) => <small key={k} style={{ color: 'var(--txt)' }}>{[p.posto, p.matricula, p.nome].filter(Boolean).join(' ')}</small>)}{ps.length > 2 && <small>+ {ps.length - 2} policial(is)</small>}{!ps.length && <small>—</small>}</td>
      <td>{[e.solicitante?.posto, e.solicitante?.nome].filter(Boolean).join(' ') || e.autor}<small>{e.solicitante?.funcao}</small></td>
      <td><Situacao s={e.situacao} /><small>{e.situacao === 'publicado' ? `${e.publicacao?.boletim} nº ${e.publicacao?.numero || '—'} · ${R.dataBR(e.publicacao?.data)}` : e.oficio?.epigrafe ? e.oficio.epigrafe.replace(/^Ofício/, 'Of.') : ''}</small></td>
      <td><button className="btn peq" onClick={ev => { ev.stopPropagation(); abrir(); }}>Abrir</button></td>
    </tr>
  );
}

/* ================= o pedido ================= */
function Pedido({ inicial, fatos, cmts, voltar, atualizar, remover }){
  const { perfil, ehAdmin, registrar, avisar } = useSessao();
  const [e, setE] = useState(inicial);
  const [passo, setPasso] = useState(() => { let p = 0; try { p = +sessionStorage.getItem('elogio-passo-' + inicial.id) || 0; } catch {} return p || inicial._passo || 1; });
  useEffect(() => { try { sessionStorage.setItem('elogio-passo-' + e.id, passo); } catch {} }, [passo]);
  const [salvo, setSalvo] = useState('salvo');
  const timer = useRef(null), ultimo = useRef(inicial);
  const souAutor = e.autorId === perfil?.id;
  const autoriza = ehAdmin || R.ehAutorizador(perfil?.funcao);
  const podeEditar = (souAutor || ehAdmin) && ['rascunho', 'devolvido'].includes(e.situacao);
  const conf = useMemo(() => R.conferir(e, { id: e.id, fatos, dataRef: e.situacao === 'rascunho' || e.situacao === 'devolvido' ? R.hojeISO() : (e.oficio?.data || R.hojeISO()) }), [e, fatos]);

  const gravar = async (x, imediato) => {
    clearTimeout(timer.current); setSalvo('salvando');
    const vai = async () => { try { const g = await BD.gravarElogio(x, perfil); ultimo.current = g; atualizar(g); setSalvo('salvo'); return g; } catch (er){ setSalvo('erro'); avisar('Não consegui salvar: ' + er.message, 'err'); throw er; } };
    if (imediato) return vai();
    timer.current = setTimeout(vai, 800);
  };
  const muda = fn => setE(x => { const n = clone(x); fn(n); n._passo = passo; gravar(n); return n; });
  const eRef = useRef(e); eRef.current = e;
  useEffect(() => () => { if (timer.current){ clearTimeout(timer.current); BD.gravarElogio(eRef.current, perfil).catch(() => {}); } }, []);
  const hist = (x, acao) => { x.historico = [...(x.historico || []), { em: new Date().toISOString(), por: quem(perfil), acao }]; };
  const mudaSituacao = async (sit, acao, fn) => {
    const n = clone(e); fn?.(n); n.situacao = sit; hist(n, acao);
    try { await salvarPendente(); const g = await gravar(n, true); setE(g); registrar('elogio', `${acao} — ${R.rotuloTipo(n).toLowerCase()} (${R.listaPoliciais(n)})`); return g; } catch { return null; }
  };
  const excluir = async () => {
    if (!confirm('Excluir este pedido? O ofício montado continua em Ofícios.')) return;
    try { await BD.excluirElogio(e.id); registrar('exclusao', `excluiu um pedido de ${R.rotuloTipo(e).toLowerCase()}`); remover(e.id); } catch (er){ alert(er.message); }
  };
  const { er, av } = R.resumoConferencia(conf);

  return (
    <section className="view ativa el">
      <div className="el-acoes">
        <button className="btn peq" onClick={voltar}>← Controle de elogios</button>
        <Situacao s={e.situacao} />
        <b className="el-tit">{R.rotuloTipo(e)} · {R.tituloPedido(e)}</b>
        <span className="esp" />
        <small className="dica" style={{ margin: 0 }}>{salvo === 'salvando' ? 'Salvando…' : salvo === 'erro' ? 'Não salvou' : 'Salvo no banco'}</small>
        {((souAutor && ['rascunho', 'devolvido'].includes(e.situacao)) || ehAdmin) && <button className="btn peq perigo" onClick={excluir}>Excluir</button>}
      </div>
      {e.situacao === 'devolvido' && e.devolucao && <div className="aviso"><span><b>Devolvido por {e.devolucao.por}</b> em {new Date(e.devolucao.em).toLocaleString('pt-BR')}: “{e.devolucao.motivo}”. Ajuste e envie de novo.</span></div>}
      {podeEditar ? <>
        <Passos passo={passo} setPasso={setPasso} conf={conf} />
        <div className="el-grid">
          <div className="card">
            {passo === 1 && <PassoTipo e={e} muda={muda} />}
            {passo === 2 && <PassoFato e={e} muda={muda} />}
            {passo === 3 && <PassoPoliciais e={e} muda={muda} />}
            {passo === 4 && <PassoSolicita e={e} muda={muda} cmts={cmts} />}
            {passo === 5 && <PassoOficio e={e} muda={muda} setE={setE} gravar={gravar} conf={conf} autoriza={autoriza}
              enviar={() => mudaSituacao('solicitado', 'enviou o pedido ao Cmt do BTL', n => { const o = DOC.acharDoc('oficio', n.oficio?.id); if (o){ n.oficio = { ...n.oficio, ...DOC.infoOficio(o), copia: clone(o) }; } delete n.devolucao; })} />}
            <div className="el-nav">
              {passo > 1 && <button className="btn" onClick={() => setPasso(passo - 1)}>← Voltar</button>}
              <span className="esp" />
              {passo < 5 && <button className="btn pri" onClick={() => setPasso(passo + 1)}>Continuar →</button>}
            </div>
          </div>
          <Conferencia conf={conf} passo={passo} />
        </div>
      </> : <Acompanhar e={e} conf={conf} autoriza={autoriza} souAutor={souAutor} mudaSituacao={mudaSituacao} gravar={gravar} setE={setE} />}
    </section>
  );
}

function Passos({ passo, setPasso, conf }){
  return <div className="el-passos">{PASSOS.map((t, k) => {
    const n = k + 1, pend = conf.filter(x => x.passo === n && x.nivel === 'er').length;
    return <div key={n} className={(n === passo ? 'on' : n < passo && !pend ? 'ok' : '') + (pend && n < passo ? ' pend' : '')} onClick={() => setPasso(n)}><b>{n < passo && !pend ? '✓' : n}</b>{t}{pend && n !== passo ? <i className="el-np">{pend}</i> : null}</div>;
  })}</div>;
}
function Conferencia({ conf, passo, titulo = 'Conferência' }){
  const { er, av } = R.resumoConferencia(conf);
  const doPasso = passo ? conf.filter(x => x.passo === passo) : [];
  const lista = doPasso.length ? [...doPasso, ...conf.filter(x => x.passo !== passo && x.nivel !== 'ok')] : conf;
  return (
    <div className="card el-conf">
      <h3>{titulo} <span className={'tg ' + (er ? 'bloq' : av ? 'av' : 'lib')}>{er ? `${er} pendência(s)` : av ? `${av} aviso(s)` : 'tudo certo'}</span></h3>
      {lista.map((x, k) => <div key={k} className={'it ' + x.nivel}><i>{x.nivel === 'ok' ? '✔' : x.nivel === 'av' ? '⚠' : '✖'}</i><div>{x.nivel === 'er' ? <b>{x.t}</b> : x.t}<small>{x.d}</small></div></div>)}
      <p className="dica">{R.NORMA} · a Portaria nº 017/2014-GCG foi revogada (art. 21).</p>
    </div>
  );
}

/* ---------- passo 1 ---------- */
function PassoTipo({ e, muda }){
  return (<>
    <h3>1. Tipo de reconhecimento</h3>
    <div className="el-opcoes">
      <label className={'el-op' + (e.tipo === 'elogio' ? ' sel' : '')}><input type="radio" checked={e.tipo === 'elogio'} onChange={() => muda(x => { x.tipo = 'elogio'; x.averbar = x.alcance === 'individual'; })} />
        <div><b>Elogio</b><span>Art. 4º · ato específico, de <b>caráter excepcional</b>, publicado em BG ou BI. Registrado nos assentamentos quando individual (art. 7º).</span></div></label>
      <label className={'el-op' + (e.tipo === 'referencia' ? ' sel' : '')}><input type="radio" checked={e.tipo === 'referencia'} onChange={() => muda(x => { x.tipo = 'referencia'; x.modalidade = ''; x.averbar = false; })} />
        <div><b>Referência elogiosa</b><span>Art. 8º · reconhecimento do <b>desempenho cotidiano</b>. Não vai para os assentamentos, salvo determinação justificada (art. 9º).</span></div></label>
    </div>
    {e.tipo === 'elogio' && <>
      <div className="el-sub">Modalidade do elogio (art. 4º)</div>
      <div className="el-mod">{Object.entries(R.MODALIDADES).map(([k, [t, d]]) => (
        <label key={k} className={e.modalidade === k ? 'sel' : ''}><input type="radio" checked={e.modalidade === k} onChange={() => muda(x => { x.modalidade = k; })} /><span><b>{k} – {t}</b> — {d}.</span></label>))}</div>
    </>}
    <div className="el-sub">Alcance</div>
    <div className="el-seg">{['individual', 'coletivo'].map(a => <span key={a} className={e.alcance === a ? 'on' : ''} onClick={() => muda(x => { x.alcance = a; if (a === 'coletivo') x.averbar = false; else if (x.tipo === 'elogio') x.averbar = true; })}>{a === 'individual' ? 'Individual' : 'Coletivo'}</span>)}</div>
    <p className="dica">No coletivo, a participação de cada policial é obrigatória; sem ela o elogio não é averbado (art. 7º, parágrafo único) e não pode ser indiscriminado (art. 15, IV).</p>
  </>);
}
/* ---------- passo 2 ---------- */
function PassoFato({ e, muda }){
  const f = e.fato, set = (k, v) => muda(x => { x.fato[k] = v; });
  const d = R.diasEntre(f.data, R.hojeISO());
  return (<>
    <div className="el-h3"><h3>2. O fato</h3><PuxarBoletim e={e} muda={muda} /></div>
    {e.boletim && <p className="dica" style={{ margin: '-6px 0 12px' }}>Dados do fato conferidos com o {e.boletim.tipoRegistro} {e.boletim.protocolo} ({e.boletim.arquivo}). A narrativa e a conduta vêm do ofício ou de quem solicita, não do BO.</p>}
    <div className="el-campos">
      <label>Data do fato<input type="date" value={f.data} max={R.hojeISO()} onChange={x => set('data', x.target.value)} /></label>
      <label>Hora<input type="time" value={f.hora} onChange={x => set('hora', x.target.value)} /></label>
      <label className="l2">Local<input value={f.local} placeholder="na BR-153, próximo ao distrito de Santaninha, Paraíso do Tocantins/TO" onChange={x => set('local', x.target.value)} /></label>
      <label className="l2">Natureza da ocorrência<input value={f.natureza} placeholder="Cumprimento de mandado de prisão" onChange={x => set('natureza', x.target.value)} /></label>
      <label>Registro<select value={f.boTipo} onChange={x => set('boTipo', x.target.value)}>{R.REGISTROS_BO.map(r => <option key={r}>{r}</option>)}</select></label>
      <label>Número<input value={f.bo} placeholder="3082400192" onChange={x => set('bo', x.target.value)} /></label>
      <label className="l4">Narrativa objetiva do fato (art. 13, I)<textarea rows={7} value={f.narrativa} placeholder="Na ocasião, acionados via COPOM para…" onChange={x => set('narrativa', x.target.value)} /></label>
      <label className="l4">Em razão de… — conduta e justificativa do reconhecimento (art. 6º, IV)<textarea rows={3} value={f.conduta} placeholder="da notável atuação, tirocínio policial e conhecimento técnico-operacional, demonstrando…" onChange={x => set('conduta', x.target.value)} /></label>
      <label className="l4">Documentos comprobatórios, se houver (art. 13, II)<input value={f.comprovantes} placeholder="cópia do Boletim de Atendimento; termo de apresentação do preso" onChange={x => set('comprovantes', x.target.value)} /></label>
      {d !== null && d > R.PRAZO_DIAS && <label className="l4">Justificativa do prazo — {d} dias após o fato (art. 14)<textarea rows={2} value={f.atraso} placeholder="a ocorrência só chegou ao conhecimento do comando após…" onChange={x => set('atraso', x.target.value)} /></label>}
    </div>
    <label className="el-chk"><input type="checkbox" checked={!!e.declaracoes?.naoRotina} onChange={x => muda(y => { y.declaracoes = { ...(y.declaracoes || {}), naoRotina: x.target.checked }; })} /> Declaro que o fato não é mera obrigação legal ou rotina administrativa e não se destina a fins pessoais, políticos ou de favorecimento (art. 15, I e III).</label>
  </>);
}
/* ---------- passo 3 ---------- */
function PassoPoliciais({ e, muda }){
  const set = (i, k, v) => muda(x => { x.policiais[i][k] = v; });
  const col = e.alcance === 'coletivo';
  return (<>
    <div className="el-h3"><h3>3. Policiais (qualificação completa – art. 6º, II)</h3><PuxarBoletim e={e} muda={muda} /></div>
    <GuarnicaoBo e={e} muda={muda} />
    <datalist id="el-postos">{POSTOS.map(p => <option key={p} value={p} />)}</datalist>
    <div className="el-pols">
      {e.policiais.map((p, i) => (
        <div className="el-pol" key={i}>
          <div className="el-campos">
            <label>Posto/Grad<input list="el-postos" value={p.posto} onChange={x => set(i, 'posto', x.target.value.toUpperCase())} /></label>
            <label>Matrícula<input inputMode="numeric" value={p.matricula} onChange={x => set(i, 'matricula', x.target.value)} /></label>
            <label className="l2">Nome completo<input value={p.nome} onChange={x => set(i, 'nome', x.target.value.toUpperCase())} /></label>
            <label className="l2">Unidade<input value={p.unidade} placeholder="1ª Cia do 8º BPM" onChange={x => set(i, 'unidade', x.target.value)} /></label>
            <label className="l2">Participação no fato{col ? ' (obrigatória no coletivo)' : ' (opcional)'}<input value={p.participacao} placeholder={col ? 'efetuou a abordagem e a busca pessoal…' : ''} onChange={x => set(i, 'participacao', x.target.value)} /></label>
          </div>
          <div className="el-pol-rod">
            <label className="el-chk"><input type="checkbox" checked={!!p.semProcesso} onChange={x => set(i, 'semProcesso', x.target.checked)} /> Não responde a processo disciplinar relacionado a este fato (art. 15, V)</label>
            {e.policiais.length > 1 && <button className="btn peq perigo" onClick={() => muda(x => { x.policiais.splice(i, 1); })}>Remover</button>}
          </div>
        </div>))}
    </div>
    <button className="btn" onClick={() => muda(x => { x.policiais.push(R.novoPolicial()); })}>＋ Adicionar policial</button>
  </>);
}
/* ---------- passo 4 ---------- */
function NomeGuerra({ nome, guerra, set }){
  const pal = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (!pal.length) return null;
  return <div className="el-guerra">{pal.map((w, k) => <span key={k} className={(guerra || []).includes(k) ? 'on' : ''} onClick={() => { const s = new Set(guerra || []); s.has(k) ? s.delete(k) : s.add(k); set([...s].sort((a, b) => a - b)); }}>{w}</span>)}<small>toque no nome de guerra (sai em negrito)</small></div>;
}
function PassoSolicita({ e, muda, cmts }){
  const s = e.solicitante, d = e.destino, pb = e.publicacao;
  const setS = (k, v) => muda(x => { x.solicitante[k] = v; }), setD = (k, v) => muda(x => { x.destino[k] = v; }), setP = (k, v) => muda(x => { x.publicacao[k] = v; });
  const podeAverbar = e.tipo === 'elogio' ? e.alcance === 'individual' || R.policiaisValidos(e).every(p => (p.participacao || '').trim().length >= 10) : true;
  return (<>
    <h3>4. Quem solicita, quem autoriza e onde publica</h3>
    <div className="el-sub">Solicitante — comandante imediato (art. 12, I e 13, IV)</div>
    <div className="el-campos">
      <label className="l2">Nome completo<input value={s.nome} onChange={x => setS('nome', x.target.value)} /></label>
      <label>Posto e quadro<input value={s.posto} placeholder="Cap QOA" onChange={x => setS('posto', x.target.value)} /></label>
      <label>Função<input value={s.funcao} placeholder="Comandante da 1ª Cia do 8º BPM" onChange={x => setS('funcao', x.target.value)} /></label>
      <label className="l4" style={{ fontWeight: 400 }}><NomeGuerra nome={s.nome} guerra={s.guerra} set={g => setS('guerra', g)} /></label>
      <label>Setor (no nº do ofício)<input value={s.setores?.[0] || ''} placeholder="1ª CIA" onChange={x => muda(y => { y.solicitante.setores = [x.target.value, y.solicitante.setores?.[1] || '']; })} /></label>
      <label>Unidade (no nº do ofício)<input value={s.setores?.[1] || ''} placeholder="8º BPM" onChange={x => muda(y => { y.solicitante.setores = [y.solicitante.setores?.[0] || '', x.target.value]; })} /></label>
    </div>
    <div className="el-sub">Autoriza e encaminha para publicação — Cmt do BTL (art. 5º, VIII)</div>
    {cmts.length > 0 && <div className="el-dir-acoes">{cmts.map(c => <button key={c.id} className="btn peq" onClick={() => muda(x => { x.destino = { ...x.destino, posto: c.posto || '', nome: c.nome || '', funcao: `Comandante do ${x.publicacao.unidade || x.solicitante.setores?.[1] || 'BTL'}` }; })}>{c.funcao === 'subcmt_btl' ? 'Subcmt' : 'Cmt'}: {[c.posto, c.nome].filter(Boolean).join(' ')}</button>)}</div>}
    <div className="el-campos">
      <label>Posto e quadro<input value={d.posto} placeholder="Ten Cel QOPM" onChange={x => setD('posto', x.target.value)} /></label>
      <label className="l2">Nome<input value={d.nome} onChange={x => setD('nome', x.target.value)} /></label>
      <label>Cidade<input value={d.cidade} onChange={x => setD('cidade', x.target.value)} /></label>
      <label className="l4">Função<input value={d.funcao} placeholder="Comandante do 8º BPM" onChange={x => setD('funcao', x.target.value)} /></label>
    </div>
    <div className="el-sub">Publicação (art. 4º, 8º e 16)</div>
    <div className="el-campos">
      <label className="l2">Boletim<select value={pb.boletim} onChange={x => setP('boletim', x.target.value)}><option value="BI">Boletim Interno (BI) da Unidade</option><option value="BG">Boletim Geral (BG)</option></select></label>
      <label className="l2">Unidade do boletim<input value={pb.unidade} placeholder="8º BPM" onChange={x => setP('unidade', x.target.value)} /></label>
    </div>
    <label className="el-chk"><input type="checkbox" disabled={!podeAverbar && !e.averbar} checked={!!e.averbar} onChange={x => muda(y => { y.averbar = x.target.checked; })} /> Averbar nos assentamentos funcionais {e.tipo === 'referencia' ? '(referência: só por determinação expressa e justificada – art. 9º)' : '(elogio individual ou coletivo com a participação de cada um – art. 7º)'}</label>
  </>);
}
/* ---------- passo 5: o ofício ---------- */
function PassoOficio({ e, muda, setE, gravar, conf, autoriza, enviar }){
  const { avisar } = useSessao();
  const [, setN] = useState(0);
  const o = DOC.acharDoc('oficio', e.oficio?.id);
  const { er } = R.resumoConferencia(conf);
  const montar = async () => {
    try {
      const novo = DOC.criarOficio(e);
      const n = clone(e); n.oficio = { ...DOC.infoOficio(novo) }; setE(n); await gravar(n, true); avisar('Ofício montado no padrão do Manual de Redação');
    } catch (er){ alert(er.message); }
  };
  const atualizarTexto = async () => {
    if (!confirm('Trocar o destinatário, o assunto, o texto e a assinatura do ofício pelos dados atuais do pedido? O que você mudou à mão no texto do ofício será substituído.')) return;
    DOC.atualizarOficio(o, e); await salvarPendente(); const n = clone(e); n.oficio = { ...n.oficio, ...DOC.infoOficio(o) }; setE(n); gravar(n); setN(x => x + 1);
  };
  const setSgd = v => { o.campos.sgd = v; o.alteradoEm = new Date().toISOString(); muda(x => { x.oficio = { ...x.oficio, sgd: v }; }); };
  if (!o) return (<>
    <h3>5. Ofício de solicitação</h3>
    <p className="dica" style={{ marginBottom: 12 }}>O sistema monta o ofício no modelo “Ofício – autoridades militares” do Manual de Redação, com o cabeçalho padrão (Ofício Circular nº 022/2025/GCG), as margens, a fonte e os espaçamentos do manual. O ofício também vale como o parecer do comandante imediato (art. 13, IV).</p>
    {e.oficio?.id && <div className="aviso"><span>O ofício deste pedido não está entre os seus documentos (foi excluído em Ofícios?). Monte de novo.</span></div>}
    <button className="btn pri" onClick={montar}>Montar o ofício</button>
  </>);
  return (<>
    <h3>5. Ofício de solicitação</h3>
    <div className="el-dir-acoes">
      <button className="btn pri" onClick={() => DOC.abrirNoEditor('oficio', o.id)}>Abrir no editor (como no Word)</button>
      <button className="btn" onClick={atualizarTexto}>Atualizar com os dados do pedido</button>
      <BaixarPdf tipo="oficio" doc={o} />
    </div>
    <div className="el-campos" style={{ marginBottom: 12 }}>
      <label className="l2">Número<input value={DOC.infoOficio(o).epigrafe} readOnly /></label>
      <label className="l2">SGD do ofício<input value={o.campos.sgd || ''} placeholder="2026/09039/103536" onChange={x => setSgd(x.target.value)} /></label>
    </div>
    <PreviaPdf tipo="oficio" doc={o} chave={JSON.stringify(o.campos)} />
    <div className="el-enviar">
      {er > 0 && <span className="dica" style={{ color: 'var(--err)', margin: 0 }}>Ainda há {er} pendência(s) na conferência.</span>}
      <span className="esp" />
      <button className="btn ouro" onClick={() => { if (er && !confirm(`Ainda há ${er} pendência(s) com a Portaria. Enviar assim mesmo?`)) return; enviar(); }}>{autoriza ? 'Concluir a solicitação →' : 'Enviar ao Cmt do BTL →'}</button>
    </div>
  </>);
}

/* ================= acompanhar / autorizar / publicar ================= */
function Acompanhar({ e, conf, autoriza, souAutor, mudaSituacao, gravar, setE }){
  const { perfil, ehAdmin, avisar } = useSessao();
  const [dlg, setDlg] = useState(null);
  const [pub, setPub] = useState({ numero: e.publicacao?.numero || '', data: e.publicacao?.data || R.hojeISO() });
  const ofLocal = DOC.acharDoc('oficio', e.oficio?.id);
  const of = ofLocal || e.oficio?.copia;
  const desp = DOC.acharDoc('docm', e.despacho?.id) || e.despacho?.copia, item = DOC.acharDoc('docm', e.item?.id) || e.item?.copia;
  const meuDesp = !!DOC.acharDoc('docm', e.despacho?.id);
  const docs = [['oficio', '① Ofício de solicitação', of], ['despacho', '② Despacho do Cmt do BTL', desp], ['item', `③ Item para ${e.publicacao?.boletim || 'BI'}`, item]].filter(x => x[2]);
  const [aba, setAba] = useState(docs.length - 1);
  // cópia dos documentos do Cmt do BTL no pedido (para o solicitante ver)
  useEffect(() => {
    if (!meuDesp) return;
    const d = DOC.acharDoc('docm', e.despacho?.id), i = DOC.acharDoc('docm', e.item?.id);
    if ((d && JSON.stringify(d.blocos) !== JSON.stringify(e.despacho?.copia?.blocos)) || (i && JSON.stringify(i.blocos) !== JSON.stringify(e.item?.copia?.blocos))){
      const n = clone(e); if (d) n.despacho.copia = clone(d); if (i) n.item.copia = clone(i); setE(n); gravar(n);
    }
  }, []);
  const A = docs[Math.min(aba, docs.length - 1)];
  return (
    <div className="el-grid">
      <div>
        <div className="card">
          <h3>Resumo do pedido</h3>
          <Resumo e={e} />
          {e.situacao === 'solicitado' && autoriza && <div className="el-enviar">
            <button className="btn perigo" onClick={() => setDlg('devolver')}>Devolver para ajuste</button><span className="esp" />
            <button className="btn ouro" onClick={() => setDlg('autorizar')}>Autorizar e encaminhar para publicação →</button></div>}
          {e.situacao === 'solicitado' && !autoriza && <p className="dica">Enviado ao Cmt do BTL. Você recebe de volta aqui se ele devolver para ajuste.</p>}
          {e.situacao === 'autorizado' && (autoriza || ehAdmin) && <div className="el-pub">
            <div className="el-sub">Publicação — {e.publicacao?.boletim === 'BG' ? 'Boletim Geral' : `Boletim Interno${e.publicacao?.unidade ? ' do ' + e.publicacao.unidade : ''}`}</div>
            <div className="el-campos">
              <label>Nº do {e.publicacao?.boletim || 'BI'}<input value={pub.numero} placeholder="44/2026" onChange={x => setPub({ ...pub, numero: x.target.value })} /></label>
              <label>Data da publicação<input type="date" value={pub.data} onChange={x => setPub({ ...pub, data: x.target.value })} /></label>
              <label className="l2" style={{ alignSelf: 'end' }}><button className="btn pri" disabled={!pub.numero.trim()} onClick={() => mudaSituacao('publicado', `registrou a publicação no ${e.publicacao?.boletim} nº ${pub.numero}`, n => { n.publicacao = { ...n.publicacao, ...pub }; })}>Marcar como publicado</button></label>
            </div>
          </div>}
          {e.situacao === 'autorizado' && !autoriza && <p className="dica">Autorizado pelo Cmt do BTL. Falta a publicação no boletim.</p>}
          {e.situacao === 'publicado' && <p className="dica"><b>Publicado no {e.publicacao?.boletim} nº {e.publicacao?.numero}</b> em {R.dataBR(e.publicacao?.data)}.{e.averbar ? ' O setor de pessoal da unidade faz a averbação nos assentamentos (art. 17).' : ''}</p>}
          {e.situacao === 'publicado' && (autoriza || ehAdmin) && <button className="btn peq" onClick={() => { if (confirm('Voltar a situação para “Autorizado · falta publicar”?')) mudaSituacao('autorizado', 'desfez o registro de publicação'); }}>Desfazer “publicado”</button>}
        </div>
        {docs.length > 0 && <div className="card" style={{ marginTop: 16 }}>
          <div className="el-abas">{docs.map((d, k) => <span key={d[0]} className={k === aba ? 'on' : ''} onClick={() => setAba(k)}>{d[1]}</span>)}</div>
          <div className="el-dir-acoes">
            {((A[0] === 'oficio' && ofLocal) || (A[0] !== 'oficio' && meuDesp)) && e.situacao !== 'publicado' && <button className="btn" onClick={() => DOC.abrirNoEditor(A[0] === 'oficio' ? 'oficio' : 'docm', A[2].id)}>Abrir no editor</button>}
            <BaixarPdf tipo={A[0] === 'oficio' ? 'oficio' : 'docm'} doc={A[2]} />
            {docs.length > 1 && <BaixarTodos docs={docs} />}
          </div>
          <PreviaPdf tipo={A[0] === 'oficio' ? 'oficio' : 'docm'} doc={A[2]} chave={A[0] + JSON.stringify(A[2].campos || A[2].blocos)} />
        </div>}
      </div>
      <div>
        <Conferencia conf={conf} titulo="Conferência com a Portaria" />
        <Historico e={e} />
      </div>
      {dlg === 'devolver' && <DialogoDevolver fechar={() => setDlg(null)} ok={motivo => { setDlg(null); mudaSituacao('devolvido', 'devolveu o pedido para ajuste', n => { n.devolucao = { motivo, por: quem(perfil), em: new Date().toISOString() }; }); }} />}
      {dlg === 'autorizar' && <DialogoAutorizar e={e} fechar={() => setDlg(null)} feito={async (a, docsFeitos) => {
        setDlg(null);
        const g = await mudaSituacao('autorizado', `autorizou (${a.respondendo ? 'respondendo pelo Comando' : 'Cmt do BTL'})`, n => {
          n.autorizacao = { ...a, por: quem(perfil), em: new Date().toISOString() };
          n.despacho = { id: docsFeitos.despacho.id, numero: a.numDespacho, copia: clone(docsFeitos.despacho) };
          n.item = { id: docsFeitos.item.id, numero: a.numItem, copia: clone(docsFeitos.item) };
          n.publicacao = { ...n.publicacao, boletim: a.boletim, unidade: a.unidade };
          n.averbar = a.averbar;
        });
        if (g){ setAba(2); avisar('Autorizado: o Despacho e o Item para Boletim foram montados'); }
      }} />}
    </div>
  );
}
function Resumo({ e }){
  const f = e.fato || {}, ps = R.policiaisValidos(e);
  return (
    <dl className="el-resumo">
      <dt>Tipo</dt><dd>{R.nomeTipo(e)}{e.tipo === 'elogio' && R.MODALIDADES[e.modalidade] ? ` · art. 4º, ${e.modalidade} – ${R.MODALIDADES[e.modalidade][0]}` : ''}</dd>
      <dt>Fato</dt><dd>{R.dataBR(f.data)}{f.hora ? ' às ' + R.horaBR(f.hora) : ''} · {f.natureza}{f.local ? ' · ' + f.local : ''}{f.bo ? ` · ${f.boTipo} ${f.bo}` : ''}</dd>
      <dt>Policiais</dt><dd>{ps.map((p, k) => <div key={k}>{[p.posto, p.matricula, p.nome].filter(Boolean).join(' ')}{p.unidade ? ` (${p.unidade})` : ''}{p.participacao ? ` — ${p.participacao}` : ''}</div>)}</dd>
      <dt>Conduta</dt><dd>{f.conduta}</dd>
      <dt>Solicitante</dt><dd>{[e.solicitante?.posto, e.solicitante?.nome].filter(Boolean).join(' ')} · {e.solicitante?.funcao}{e.oficio?.epigrafe ? ` · ${e.oficio.epigrafe}` : ''}{e.oficio?.sgd ? ` · SGD ${e.oficio.sgd}` : ''}</dd>
      {e.autorizacao && <><dt>Autorizado</dt><dd>{e.autorizacao.por}{e.autorizacao.respondendo ? ', respondendo pelo Comando' : ''} · {new Date(e.autorizacao.em).toLocaleString('pt-BR')}</dd></>}
      <dt>Publicação</dt><dd>{e.publicacao?.boletim === 'BG' ? 'Boletim Geral' : `Boletim Interno${e.publicacao?.unidade ? ' do ' + e.publicacao.unidade : ''}`}{e.publicacao?.numero ? ` nº ${e.publicacao.numero} de ${R.dataBR(e.publicacao.data)}` : ''} · {e.averbar ? 'averbar nos assentamentos' : 'sem averbação'}</dd>
    </dl>
  );
}
function Historico({ e }){
  if (!e.historico?.length) return null;
  return <div className="card el-hist" style={{ marginTop: 16 }}><h3>Andamento</h3>{[...e.historico].reverse().map((h, k) => <div key={k}><small>{new Date(h.em).toLocaleString('pt-BR')}</small><span><b>{h.por}</b> {h.acao}</span></div>)}</div>;
}
function DialogoDevolver({ fechar, ok }){
  const [m, setM] = useState('');
  return <div className="el-modal" onClick={fechar}><div className="card" onClick={ev => ev.stopPropagation()}>
    <h3>Devolver para ajuste</h3>
    <textarea rows={4} style={{ width: '100%' }} value={m} placeholder="O que precisa ser ajustado (ex.: descrever a participação de cada policial)" onChange={x => setM(x.target.value)} />
    <div className="el-enviar"><button className="btn" onClick={fechar}>Cancelar</button><span className="esp" /><button className="btn pri" disabled={!m.trim()} onClick={() => ok(m.trim())}>Devolver</button></div>
  </div></div>;
}
function DialogoAutorizar({ e, fechar, feito }){
  const { perfil } = useSessao();
  const base = useMemo(() => DOC.baseUnidade(perfil), []);
  const ano = R.hojeISO().slice(0, 4);
  const unidade = e.publicacao?.unidade || e.solicitante?.setores?.[1] || '';
  const [a, setA] = useState(() => ({
    boletim: e.publicacao?.boletim || 'BI', unidade, averbar: !!e.averbar,
    numDespacho: DOC.proximoNumero('despacho', ano), numItem: DOC.proximoNumero('item', ano), sgdDespacho: '', sgdItem: '',
    destinatario: e.publicacao?.boletim === 'BG' ? 'À Ajudância Geral' : `À Seção de Pessoal (P1) do ${unidade || 'BTL'}`,
    nome: base.sigNome || perfil?.nome || '', guerra: [...(base.sigGuerra || [])], posto: base.sigPosto || perfil?.posto || '',
    funcao: base.sigFuncao || `Comandante do ${unidade}`, respondendo: perfil?.funcao === 'subcmt_btl',
    cidade: base.cidade || e.destino?.cidade || '', uf: base.uf || 'TO', data: R.hojeISO()
  }));
  const [ocupado, setOcupado] = useState(false);
  const set = (k, v) => setA(x => ({ ...x, [k]: v }));
  const ir = async () => {
    setOcupado(true);
    try {
      const ee = { ...e, publicacao: { ...e.publicacao, boletim: a.boletim, unidade: a.unidade }, averbar: a.averbar };
      const comum = { ano, sigla: a.unidade, cidade: a.cidade, uf: a.uf, data: a.data, nome: a.nome, guerra: a.guerra, posto: a.posto, funcao: a.funcao, respondendo: a.respondendo, unidade: a.unidade };
      const despacho = DOC.criarDespacho(ee, { ...comum, numero: a.numDespacho, sgd: a.sgdDespacho, destinatario: a.destinatario });
      const item = DOC.criarItem(ee, { ...comum, numero: a.numItem, sgd: a.sgdItem });
      await salvarPendente();
      await feito(a, { despacho, item });
    } catch (er){ console.error(er); alert('Não consegui montar os documentos: ' + er.message); setOcupado(false); }
  };
  return <div className="el-modal" onClick={fechar}><div className="card" onClick={ev => ev.stopPropagation()}>
    <h3>Autorizar e encaminhar para publicação</h3>
    <p className="dica" style={{ marginTop: -6, marginBottom: 12 }}>O sistema monta o <b>Despacho</b> (autoriza e determina a publicação) e o <b>Item para Boletim</b> nos modelos do Manual de Redação. Depois você pode editar os dois como no Word.</p>
    <div className="el-campos">
      <label className="l2">Publicar em<select value={a.boletim} onChange={x => { set('boletim', x.target.value); set('destinatario', x.target.value === 'BG' ? 'À Ajudância Geral' : `À Seção de Pessoal (P1) do ${a.unidade || 'BTL'}`); }}><option value="BI">Boletim Interno (BI)</option><option value="BG">Boletim Geral (BG)</option></select></label>
      <label className="l2">Unidade (sigla)<input value={a.unidade} onChange={x => set('unidade', x.target.value)} /></label>
      <label>Despacho nº<input value={a.numDespacho} onChange={x => set('numDespacho', x.target.value)} /></label>
      <label>SGD do despacho<input value={a.sgdDespacho} onChange={x => set('sgdDespacho', x.target.value)} /></label>
      <label>Item para {a.boletim} nº<input value={a.numItem} onChange={x => set('numItem', x.target.value)} /></label>
      <label>SGD do item<input value={a.sgdItem} onChange={x => set('sgdItem', x.target.value)} /></label>
      <label className="l4">Despacho endereçado<input value={a.destinatario} onChange={x => set('destinatario', x.target.value)} /></label>
      <label className="l2">Assina<input value={a.nome} onChange={x => set('nome', x.target.value)} /></label>
      <label>Posto e quadro<input value={a.posto} onChange={x => set('posto', x.target.value)} /></label>
      <label>Data<input type="date" value={a.data} onChange={x => set('data', x.target.value)} /></label>
      <label className="l4" style={{ fontWeight: 400 }}><NomeGuerra nome={a.nome} guerra={a.guerra} set={g => set('guerra', g)} /></label>
      <label className="l2">Função<input value={a.funcao} onChange={x => set('funcao', x.target.value)} /></label>
      <label>Cidade<input value={a.cidade} onChange={x => set('cidade', x.target.value)} /></label>
      <label>UF<input value={a.uf} onChange={x => set('uf', x.target.value)} /></label>
    </div>
    <label className="el-chk"><input type="checkbox" checked={a.respondendo} onChange={x => set('respondendo', x.target.checked)} /> Respondendo pelo Comando (Subcomandante, na ausência do Comandante)</label>
    <label className="el-chk"><input type="checkbox" checked={a.averbar} onChange={x => set('averbar', x.target.checked)} /> Averbar nos assentamentos funcionais (art. 7º, 9º e 17)</label>
    <div className="el-enviar"><button className="btn" onClick={fechar}>Cancelar</button><span className="esp" /><button className="btn ouro" disabled={ocupado || !a.nome.trim()} onClick={ir}>{ocupado ? 'Montando…' : 'Autorizar'}</button></div>
  </div></div>;
}

/* ---------- PDF: prévia (páginas desenhadas) e download ---------- */
function PreviaPdf({ tipo, doc, chave }){
  const caixa = useRef();
  const [st, setSt] = useState('');
  useEffect(() => {
    let vivo = true; setSt('gerando');
    const t = setTimeout(async () => {
      try {
        const bytes = await DOC.pdfDe(tipo, clone(doc)); if (!vivo) return;
        const pdfjs = await carregarPdfjs();
        const pdf = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;
        const box = caixa.current; if (!box || !vivo) return;
        const larg = Math.min(box.clientWidth || 600, 640), novas = [];
        for (let i = 1; i <= pdf.numPages; i++){
          const pg = await pdf.getPage(i), vp0 = pg.getViewport({ scale: 1 }), esc = larg / vp0.width, vp = pg.getViewport({ scale: esc * (window.devicePixelRatio || 1) });
          const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; c.style.width = larg + 'px';
          await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise; novas.push(c);
        }
        if (!vivo) return; box.replaceChildren(...novas); setSt(`${pdf.numPages} página(s)`);
      } catch (er){ console.error(er); if (vivo) setSt('Não consegui gerar a prévia: ' + er.message); }
    }, 350);
    return () => { vivo = false; clearTimeout(t); };
  }, [chave]);
  return <div className="el-previa"><div className="dica" style={{ margin: '0 0 6px' }}>{st === 'gerando' ? <><span className="spinner" /> Gerando a prévia…</> : st}</div><div ref={caixa} className="el-folhas" /></div>;
}
function BaixarPdf({ tipo, doc }){
  const [oc, setOc] = useState(false);
  return <button className="btn" disabled={oc} onClick={async () => { setOc(true); try { baixar(DOC.nomeDoc(tipo, doc), await DOC.pdfDe(tipo, clone(doc))); } catch (er){ alert(er.message); } finally { setOc(false); } }}>{oc ? 'Gerando…' : 'Baixar PDF'}</button>;
}
function BaixarTodos({ docs }){
  const [oc, setOc] = useState(false);
  return <button className="btn" disabled={oc} onClick={async () => { setOc(true); try { for (const [k, , d] of docs){ const t = k === 'oficio' ? 'oficio' : 'docm'; baixar(DOC.nomeDoc(t, d), await DOC.pdfDe(t, clone(d))); await new Promise(r => setTimeout(r, 400)); } } catch (er){ alert(er.message); } finally { setOc(false); } }}>{oc ? 'Gerando…' : `Baixar os ${docs.length} PDFs`}</button>;
}

/* ---------- Boletim de Ocorrência: puxar data, hora, local, natureza, protocolo e guarnição ---------- */
function PuxarBoletim({ e, muda }){
  const { avisar, perfil } = useSessao();
  const inp = useRef();
  const [oc, setOc] = useState(false);
  const ler = async file => {
    if (!file) return; setOc(true);
    try {
      const d = await lerBoletim(file);
      const f = e.fato || {}, outro = [];
      if (d.protocolo && (f.bo || '').replace(/\D/g, '') && d.protocolo !== f.bo.replace(/\D/g, '')) outro.push(`protocolo ${d.protocolo} (no pedido: ${f.bo})`);
      if (d.fato.data && f.data && d.fato.data !== f.data) outro.push(`data ${R.dataBR(d.fato.data)} (no pedido: ${R.dataBR(f.data)})`);
      if (outro.length && !confirm(`Este boletim parece ser de outro fato:\n\n• ${outro.join('\n• ')}\n\nVincular assim mesmo? (os campos já preenchidos não serão trocados)`)) return;
      let feitos = [];
      muda(x => { feitos = R.aplicarBoletim(x, d, file.name); x.historico = [...(x.historico || []), { em: new Date().toISOString(), por: quem(perfil), acao: `vinculou o ${d.tipoRegistro} ${d.protocolo}` }]; });
      setTimeout(() => avisar(feitos.length ? `Do boletim: ${feitos.join(', ')}. Confira.` : 'Boletim vinculado. Os campos já estavam preenchidos; veja as diferenças na conferência.'), 50);
    } catch (er){ console.error(er); alert('Não consegui ler este boletim: ' + er.message); }
    finally { setOc(false); }
  };
  return <><button className="btn peq" disabled={oc} onClick={() => inp.current.click()}>{oc ? 'Lendo…' : e.boletim ? 'Trocar o boletim (PDF)' : 'Puxar dados do boletim de ocorrência (PDF)'}</button>
    <input ref={inp} type="file" hidden accept=".pdf" onChange={x => { ler(x.target.files[0]); x.target.value = ''; }} /></>;
}
function GuarnicaoBo({ e, muda }){
  const g = e.boletim?.guarnicao || [];
  if (!g.length) return null;
  const incluir = p => muda(x => {
    const vazio = x.policiais.findIndex(y => !(y.nome || '').trim() && !(y.matricula || '').trim());
    const novo = { ...R.novoPolicial(), posto: p.posto, matricula: p.matricula, nome: p.nome, guerra: p.guerra || [] };
    if (vazio >= 0) x.policiais[vazio] = novo; else x.policiais.push(novo);
  });
  return <div className="el-gu">
    <div className="el-sub" style={{ marginTop: 0 }}>Guarnição do {e.boletim.tipoRegistro?.replace(/ Protocolo nº| nº/, '')} {e.boletim.protocolo} — marque quem recebe o reconhecimento</div>
    {g.map((p, k) => { const ja = R.naGuarnicao(e, p); return <div key={k} className={'el-gu-l' + (ja ? ' ja' : '')}>
      <span><b>{[p.posto, p.matricula].filter(Boolean).join(' ')}</b> {p.nome}<small>{p.funcaoGu}</small></span>
      {ja ? <span className="tg lib">✓ no pedido</span> : <button className="btn peq" onClick={() => incluir(p)}>＋ Incluir</button>}
    </div>; })}
  </div>;
}
