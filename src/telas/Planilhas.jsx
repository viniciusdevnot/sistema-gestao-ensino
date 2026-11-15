import { useEffect, useRef, useState, useCallback } from 'react';
import { sb } from '../lib/supabase.js';
import { useSessao } from '../contexto/Sessao.jsx';
import { Ic } from '../componentes/Icones.jsx';
import { baixar } from '../aco/pdf.js';
import { novoId } from '../aco/logica.js';

/* Planilhas simples: colunas tipadas (texto, número, moeda, data, sim/não, lista, fórmula), filtro, ordem, CSV.
   Mesmas regras do sistema anterior. Cada planilha é uma linha da tabela "planilhas". */
const TIPOS = { texto: 'Texto', numero: 'Número', moeda: 'Moeda', data: 'Data', simnao: 'Sim/Não', lista: 'Lista', formula: 'Fórmula' };
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

function valorDe(p, col, l, prof){
  if (col.tipo === 'formula') return calcular(p, col, l, prof + 1);
  const r = l.c[col.id];
  if (col.tipo === 'numero' || col.tipo === 'moeda') return Number(r) || 0;
  if (col.tipo === 'simnao') return !!r;
  return r ?? '';
}
function calcular(p, c, l, prof = 0){
  if (prof > 15) return '#CICLO';
  try {
    if (!(c.formula || '').trim()) return '';
    const porNome = {}; p.colunas.forEach(x => porNome[x.nome.trim().toLowerCase()] = x);
    const expr = c.formula.replace(/\[([^\]]+)\]/g, (_, n) => { const x = porNome[n.trim().toLowerCase()]; if (!x) throw new Error('coluna inexistente'); return 'v(' + JSON.stringify(x.id) + ')'; });
    const v = id => valorDe(p, p.colunas.find(k => k.id === id), l, prof);
    const SE = (a, b, x) => a ? b : x;
    const HOJE = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const DIAS = (a, b) => (a && b) ? Math.round((new Date(b) - new Date(a)) / 864e5) : '';
    const r = new Function('v', 'SE', 'HOJE', 'DIAS', '"use strict";return (' + expr + ');')(v, SE, HOJE, DIAS);
    if (typeof r === 'number' && !isFinite(r)) return '#ERRO';
    return r;
  } catch { return '#ERRO'; }
}
const ehNumerica = c => c.tipo === 'numero' || c.tipo === 'moeda' || (c.tipo === 'formula' && c.resultado !== 'texto');
function fmt(c, v){
  if (v === '' || v == null || (typeof v === 'string' && v.startsWith('#'))) return v ?? '';
  const moeda = c.tipo === 'moeda' || (c.tipo === 'formula' && c.resultado === 'moeda');
  if (typeof v === 'number') return moeda ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : v.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  return String(v);
}
const valorOrdenavel = (p, c, l) => { const v = valorDe(p, c, l, 0); return typeof v === 'string' ? v.toLowerCase() : v; };
function paraNumero(v){
  if (typeof v === 'number') return v;
  let s = String(v).trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  if (!s) return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) || /^-?\d+,\d+$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  return /^-?\d*\.?\d+$/.test(s) ? Number(s) : null;
}
function paraData(v){
  const s = String(v).trim(); let m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return `${m[1]}-${m[2]}-${m[3]}`;
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}
function lerCSV(txt){
  txt = txt.replace(/^﻿/, '');
  const prim = txt.split('\n')[0];
  const sep = (prim.split(';').length > prim.split(',').length) ? ';' : (prim.includes('\t') ? '\t' : ',');
  const linhas = []; let lin = [], campo = '', aspas = false;
  for (let i = 0; i < txt.length; i++){
    const ch = txt[i];
    if (aspas){ if (ch === '"'){ if (txt[i + 1] === '"'){ campo += '"'; i++; } else aspas = false; } else campo += ch; }
    else if (ch === '"') aspas = true;
    else if (ch === sep){ lin.push(campo); campo = ''; }
    else if (ch === '\n'){ lin.push(campo.replace(/\r$/, '')); linhas.push(lin); lin = []; campo = ''; }
    else campo += ch;
  }
  if (campo || lin.length){ lin.push(campo.replace(/\r$/, '')); linhas.push(lin); }
  return linhas.filter(l => l.some(c => c.trim() !== ''));
}
function planilhaDoCSV(nomeArq, txt){
  const dados = lerCSV(txt); if (!dados.length) return null;
  const cab = dados[0], corpo = dados.slice(1), usados = {};
  const colunas = cab.map((n, i) => {
    let nome = (n || '').trim() || `Coluna ${i + 1}`;
    while (usados[nome.toLowerCase()]) nome += '_'; usados[nome.toLowerCase()] = 1;
    const vals = corpo.map(l => (l[i] || '').trim()).filter(Boolean);
    let tipo = 'texto';
    if (vals.length && vals.every(v => paraData(v))) tipo = 'data';
    else if (vals.length && vals.every(v => paraNumero(v) !== null)) tipo = vals.some(v => /R\$/i.test(v)) ? 'moeda' : 'numero';
    return { id: uid(), nome, tipo };
  });
  const linhas = corpo.map(l => { const c = {}; colunas.forEach((col, i) => { const v = (l[i] || '').trim(); if (!v) return; c[col.id] = col.tipo === 'data' ? paraData(v) : (col.tipo === 'numero' || col.tipo === 'moeda') ? paraNumero(v) : v; }); return { id: uid(), c }; });
  return { id: novoId(), nome: nomeArq.replace(/\.[^.]+$/, ''), criadaEm: new Date().toISOString(), colunas, linhas };
}

export default function Planilhas(){
  const { perfil, registrar, avisar } = useSessao();
  const [lista, setLista] = useState(null);
  const [atual, setAtual] = useState(null);
  const [filtro, setFiltro] = useState('');
  const [ordem, setOrdem] = useState({ col: null, dir: 1 });
  const [coluna, setColuna] = useState(null);  // {c, nova}
  const [, setN] = useState(0);
  const bump = () => setN(n => n + 1);
  const timers = useRef({}), csv = useRef(), foco = useRef(null), listaRef = useRef(null);
  listaRef.current = lista;

  useEffect(() => {
    sb.from('planilhas').select('*').is('excluido_em', null).order('alterado_em', { ascending: false }).then(({ data, error }) => {
      if (error){ avisar('Planilhas: ' + error.message, 'err'); setLista([]); return; }
      const ps = (data || []).map(l => ({ ...(l.dados || {}), id: l.id, autorId: l.autor_id }));
      ps.forEach(p => { p.colunas ||= []; p.linhas ||= []; p.linhas.forEach(l => l.c ||= {}); });
      setLista(ps); setAtual(ps[0]?.id || null);
    });
  }, []);

  const gravar = useCallback(async p => {
    const dados = JSON.parse(JSON.stringify(p)); delete dados.id; delete dados.autorId;
    const { error } = await sb.from('planilhas').upsert({ id: p.id, autor_id: p.autorId || perfil.id, autor: perfil.nome || '', titulo: p.nome, tipo: 'planilha', dados, alterado_em: new Date().toISOString() });
    if (error) avisar('Não consegui salvar a planilha: ' + error.message, 'err');
  }, [perfil]);
  const alterou = p => { p.alteradaEm = new Date().toISOString(); bump(); clearTimeout(timers.current[p.id]); timers.current[p.id] = setTimeout(() => { delete timers.current[p.id]; gravar(p); }, 800); };
  useEffect(() => () => { Object.keys(timers.current).forEach(id => { clearTimeout(timers.current[id]); const p = listaRef.current?.find(x => x.id === id); if (p) gravar(p); }); }, []);
  useEffect(() => { if (foco.current){ const [lin, col] = foco.current; foco.current = null; document.querySelector(`#grade tr[data-l="${lin}"] td:nth-child(${col + 1}) :is(input,select)`)?.focus(); } });

  if (!lista) return <section className="view ativa"><div className="card"><div className="vazio"><span className="spinner" /> Carregando planilhas…</div></div></section>;
  const p = lista.find(x => x.id === atual);
  const abrir = id => { setAtual(id); setOrdem({ col: null, dir: 1 }); setFiltro(''); };
  const nova = async () => {
    const nome = prompt('Nome da planilha:', 'Nova planilha'); if (!nome) return;
    const np = { id: novoId(), autorId: perfil.id, nome, criadaEm: new Date().toISOString(), colunas: [{ id: uid(), nome: 'Item', tipo: 'texto' }], linhas: [{ id: uid(), c: {} }] };
    setLista(l => [np, ...l]); abrir(np.id); await gravar(np); registrar('planilha', `criou a planilha "${nome}"`);
  };
  const visiveis = () => {
    let ls = p.linhas.slice();
    if (filtro){ const f = filtro.toLowerCase(); ls = ls.filter(l => p.colunas.some(c => String(fmt(c, valorDe(p, c, l, 0))).toLowerCase().includes(f))); }
    const c = p.colunas.find(x => x.id === ordem.col);
    if (c) ls.sort((a, b) => { const x = valorOrdenavel(p, c, a), y = valorOrdenavel(p, c, b); return (x > y ? 1 : x < y ? -1 : 0) * ordem.dir; });
    return ls;
  };
  const novaLinha = (col = 1) => { const l = { id: uid(), c: {} }; p.linhas.push(l); setFiltro(''); setOrdem({ col: null, dir: 1 }); foco.current = [l.id, col]; alterou(p); };
  const setVal = (l, c, v) => { if (l.c[c.id] === v) return; l.c[c.id] = v; alterou(p); };
  const navegar = (ev, l, ci) => {
    if (ev.key !== 'Enter') return;
    ev.preventDefault(); ev.target.blur();
    const vs = visiveis(), i = vs.indexOf(l), alvo = vs[i + (ev.shiftKey ? -1 : 1)];
    if (!alvo && !ev.shiftKey){ novaLinha(ci); return; }
    if (alvo){ foco.current = [alvo.id, ci]; bump(); }
  };
  const exportar = () => {
    const q = s => { s = String(s ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const ls = [p.colunas.map(c => q(c.nome)).join(';')];
    visiveis().forEach(l => ls.push(p.colunas.map(c => {
      const v = valorDe(p, c, l, 0);
      if (typeof v === 'number') return String(v).replace('.', ',');
      if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
      if (c.tipo === 'data' && v){ const [a, m, d] = v.split('-'); return `${d}/${m}/${a}`; }
      return q(v);
    }).join(';')));
    baixar(p.nome + '.csv', '﻿' + ls.join('\r\n'), 'text/csv;charset=utf-8');
  };

  let corpo;
  if (!p) corpo = <div className="vazio">{lista.length ? 'Selecione uma planilha.' : 'Nenhuma planilha ainda. Clique em "Nova planilha" ou importe um CSV.'}</div>;
  else {
    const vs = visiveis();
    corpo = (
      <table>
        <thead><tr><th className="idx">#</th>
          {p.colunas.map(c => <th key={c.id}><div className="h">
            <span className="nome" onClick={() => setOrdem(o => ({ col: c.id, dir: o.col === c.id ? -o.dir : 1 }))}>{c.nome + (ordem.col === c.id ? (ordem.dir > 0 ? ' ▲' : ' ▼') : '')}</span>
            <span className="tipo">{TIPOS[c.tipo]}</span>
            <button title="Configurar coluna" onClick={() => setColuna({ c, nova: false })}>⚙</button></div></th>)}
          <th /></tr></thead>
        <tbody>{vs.map((l, i) => (
          <tr key={l.id} data-l={l.id}><td className="idx">{i + 1}</td>
            {p.colunas.map((c, ci) => <Celula key={c.id} p={p} c={c} l={l} setVal={v => setVal(l, c, v)} onKeyDown={ev => navegar(ev, l, ci + 1)} />)}
            <td className="acoes"><button title="Excluir linha" onClick={() => { if (confirm('Excluir esta linha?')){ p.linhas = p.linhas.filter(x => x !== l); alterou(p); } }}>✕</button></td>
          </tr>))}</tbody>
        {p.colunas.some(ehNumerica) && <tfoot><tr><td className="idx">Σ</td>
          {p.colunas.map(c => <td key={c.id}>{ehNumerica(c) ? fmt(c, vs.reduce((s, l) => { const v = valorDe(p, c, l, 0); return s + (typeof v === 'number' ? v : 0); }, 0)) : ''}</td>)}<td /></tr></tfoot>}
      </table>);
  }

  return (
    <section className="view ativa">
      <div className="plan-wrap">
        <div className="card plan-lista">
          <div className="cab"><button className="btn pri" id="btn-nova" onClick={nova}><Ic n="mais" t={16} />Nova planilha</button>
            <button className="btn peq" id="btn-imp-csv" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={() => csv.current.click()}>Importar CSV</button></div>
          <div id="lista">
            {!lista.length && <div className="vazio" style={{ padding: 20 }}>Nenhuma planilha</div>}
            {lista.map(x => <div key={x.id} className={'item' + (x.id === atual ? ' ativo' : '')} onClick={() => abrir(x.id)}><span>{x.nome}</span><small>{x.linhas.length}</small></div>)}
          </div>
        </div>
        <div className="card plan-area">
          {p && <div className="toolbar" id="toolbar-planilha">
            <h2>{p.nome}</h2>
            <button className="btn peq" onClick={() => novaLinha(1)}>+ Linha</button>
            <button className="btn peq" onClick={() => setColuna({ c: { id: uid(), nome: '', tipo: 'texto' }, nova: true })}>+ Coluna</button>
            <button className="btn peq" onClick={() => { const n = prompt('Novo nome:', p.nome); if (n){ p.nome = n; alterou(p); } }}>Renomear</button>
            <button className="btn peq" onClick={async () => {
              const c = JSON.parse(JSON.stringify(p)); c.id = novoId(); c.autorId = perfil.id; c.nome = p.nome + ' (cópia)'; c.criadaEm = new Date().toISOString(); c.linhas.forEach(l => l.id = uid());
              setLista(l => [c, ...l]); abrir(c.id); await gravar(c);
            }}>Duplicar</button>
            <button className="btn peq" onClick={exportar}>Exportar CSV</button>
            <button className="btn peq perigo" onClick={async () => {
              if (prompt(`Para excluir "${p.nome}" digite EXCLUIR`) !== 'EXCLUIR') return;
              clearTimeout(timers.current[p.id]); delete timers.current[p.id];
              const { error } = await sb.from('planilhas').delete().eq('id', p.id);
              if (error){ avisar(error.message, 'err'); return; }
              registrar('exclusao', `excluiu a planilha "${p.nome}"`);
              const resto = lista.filter(x => x !== p); setLista(resto); setAtual(resto[0]?.id || null);
            }}>Excluir</button>
            <input id="busca" placeholder="🔍 Filtrar linhas…" value={filtro} onChange={ev => setFiltro(ev.target.value)} />
          </div>}
          <div className="grade" id="grade">{corpo}</div>
        </div>
      </div>
      <input type="file" ref={csv} accept=".csv,text/csv,.txt" hidden onChange={async ev => {
        const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
        const np = planilhaDoCSV(f.name, await f.text()); if (!np){ alert('Arquivo vazio.'); return; }
        np.autorId = perfil.id; setLista(l => [np, ...l]); abrir(np.id); await gravar(np);
        registrar('planilha', `importou o CSV "${f.name}" (${np.linhas.length} linhas)`); avisar(`Importadas ${np.linhas.length} linhas`);
      }} />
      {coluna && p && <DialogoColuna p={p} col={coluna.c} nova={coluna.nova} fechar={() => setColuna(null)} alterou={() => alterou(p)} />}
    </section>
  );
}

function Celula({ p, c, l, setVal, onKeyDown }){
  if (c.tipo === 'formula') return <td className="calc" style={c.resultado === 'texto' ? { textAlign: 'left' } : undefined}>{fmt(c, calcular(p, c, l))}</td>;
  const v = l.c[c.id];
  if (c.tipo === 'simnao') return <td><input type="checkbox" checked={!!v} onChange={ev => setVal(ev.target.checked)} onKeyDown={onKeyDown} /></td>;
  if (c.tipo === 'lista') return <td><select value={v ?? ''} onChange={ev => setVal(ev.target.value)} onKeyDown={onKeyDown}>
    <option value="" />{(c.opcoes || []).map(o => <option key={o} value={o}>{o}</option>)}{v && !(c.opcoes || []).includes(v) && <option value={v}>{v}</option>}</select></td>;
  const num = c.tipo === 'numero' || c.tipo === 'moeda';
  return <td className={num ? 'num' : undefined}><CampoTexto tipo={c.tipo === 'data' ? 'date' : num ? 'number' : 'text'} valor={v ?? ''} onKeyDown={onKeyDown}
    salvar={x => setVal(num ? (x === '' ? '' : Number(x)) : x)} /></td>;
}
/* grava ao sair do campo (como no sistema anterior), sem perder o que está sendo digitado */
function CampoTexto({ tipo, valor, salvar, onKeyDown }){
  const [v, setV] = useState(valor);
  useEffect(() => setV(valor), [valor]);
  return <input type={tipo} step={tipo === 'number' ? 'any' : undefined} value={v} onChange={ev => setV(ev.target.value)} onBlur={() => { if (String(v) !== String(valor)) salvar(v); }}
    onKeyDown={ev => { if (ev.key === 'Enter' && String(v) !== String(valor)) salvar(v); onKeyDown(ev); }} />;
}

function DialogoColuna({ p, col, nova, fechar, alterou }){
  const ref = useRef();
  const [nome, setNome] = useState(col.nome), [tipo, setTipo] = useState(col.tipo), [opcoes, setOpcoes] = useState((col.opcoes || []).join('\n'));
  const [formula, setFormula] = useState(col.formula || ''), [resultado, setResultado] = useState(col.resultado || 'numero');
  useEffect(() => { ref.current?.showModal(); return () => { try { ref.current?.close(); } catch {} }; }, []);
  const salvar = () => {
    const n = nome.trim(); if (!n){ alert('Dê um nome à coluna.'); return; }
    if (p.colunas.some(x => x !== col && x.nome.toLowerCase() === n.toLowerCase())){ alert('Já existe uma coluna com esse nome.'); return; }
    if (!nova && col.nome !== n){ const re = new RegExp('\\[\\s*' + col.nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\]', 'gi'); p.colunas.forEach(x => { if (x.formula) x.formula = x.formula.replace(re, '[' + n + ']'); }); }
    const tipoAntigo = col.tipo;
    Object.assign(col, { nome: n, tipo, opcoes: opcoes.split('\n').map(s => s.trim()).filter(Boolean), formula, resultado });
    if (col.tipo === 'lista' && !col.opcoes.length) col.opcoes = [...new Set(p.linhas.map(l => l.c[col.id]).filter(v => v !== '' && v != null).map(String))];
    if (nova) p.colunas.push(col);
    else if (tipoAntigo !== col.tipo) p.linhas.forEach(l => {
      const v = l.c[col.id]; if (v === undefined || v === '') return;
      if (col.tipo === 'numero' || col.tipo === 'moeda'){ const x = paraNumero(v); l.c[col.id] = x === null ? '' : x; }
      else if (col.tipo === 'simnao') l.c[col.id] = /^(s|sim|true|1|x|ok)$/i.test(String(v).trim()) || v === true;
      else if (col.tipo === 'data') l.c[col.id] = paraData(v) || '';
      else if (col.tipo !== 'formula') l.c[col.id] = typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : String(v);
    });
    alterou(); fechar();
  };
  const mover = d => { const i = p.colunas.indexOf(col), j = i + d; if (j < 0 || j >= p.colunas.length) return; [p.colunas[i], p.colunas[j]] = [p.colunas[j], p.colunas[i]]; alterou(); };
  return (
    <dialog ref={ref} id="dlg-coluna" onCancel={ev => { ev.preventDefault(); fechar(); }}>
      <h3>{nova ? 'Nova coluna' : 'Configurar coluna'}</h3>
      <label>Nome</label><input value={nome} onChange={ev => setNome(ev.target.value)} autoFocus />
      <label>Tipo</label>
      <select value={tipo} onChange={ev => setTipo(ev.target.value)}>{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      {tipo === 'lista' && <div><label>Opções da lista (uma por linha)</label><textarea rows={4} value={opcoes} onChange={ev => setOpcoes(ev.target.value)} /></div>}
      {tipo === 'formula' && <div>
        <label>Fórmula</label><input value={formula} onChange={ev => setFormula(ev.target.value)} placeholder="[Quantidade] * [Preço]" />
        <p className="dica">Use nomes de colunas entre colchetes. Funções: <code>SE(cond, a, b)</code>, <code>HOJE()</code>, <code>DIAS([Início],[Fim])</code>.</p>
        <label>Formato do resultado</label>
        <select value={resultado} onChange={ev => setResultado(ev.target.value)}><option value="numero">Número</option><option value="moeda">Moeda (R$)</option><option value="texto">Texto</option></select>
      </div>}
      <div className="rodape">
        {!nova && <button className="btn perigo esq" onClick={() => { if (!confirm(`Excluir a coluna "${col.nome}" e todos os valores dela?`)) return; p.colunas = p.colunas.filter(x => x !== col); p.linhas.forEach(l => delete l.c[col.id]); alterou(); fechar(); }}>Excluir coluna</button>}
        {!nova && <><button className="btn" onClick={() => mover(-1)}>◀</button><button className="btn" onClick={() => mover(1)}>▶</button></>}
        <button className="btn" onClick={fechar}>Cancelar</button>
        <button className="btn pri" onClick={salvar}>Salvar</button>
      </div>
    </dialog>);
}
