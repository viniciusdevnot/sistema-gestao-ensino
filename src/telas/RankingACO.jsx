import { useState } from 'react';
import { useSessao } from '../contexto/Sessao.jsx';
import * as L from '../aco/logica.js';
import { est, norm, dataBR } from '../aco/logica.js';
import { gravarConfig } from '../aco/dados.js';

/* Painel: ACOs tiradas por policial (contagem feita sempre que o PDF de uma ACO é gerado) */
export default function RankingACO({ atualizar }){
  const { perfil, ehAdmin, registrar, avisar } = useSessao();
  const [per, setPer] = useState('mes');
  const [busca, setBusca] = useState('');
  const [nivel, setNivel] = useState(null);
  const [abertos, setAbertos] = useState(() => new Set());
  const [cfgAberta, setCfgAberta] = useState(false);
  const cfg = L.cfgACO();
  const st = L.estatisticasACO(per);
  const contNivel = {}; st.lista.forEach(p => { const n = L.nivelACO(p.total); contNivel[n] = (contNivel[n] || 0) + 1; });
  const stLim = L.estatisticasACO(cfg.periodo).lista.filter(p => p.total >= cfg.aviso);
  const ating = stLim.filter(p => p.total >= cfg.max);
  const q = norm(busca);
  let lista = q ? st.lista.filter(p => norm(`${p.posto} ${p.nome} ${p.matricula}`).includes(q)) : st.lista;
  if (nivel) lista = lista.filter(p => L.nivelACO(p.total) === nivel);
  const max = st.lista[0]?.total || 1;
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="rk-topo">
        <h3 style={{ margin: 0 }}>ACOs tiradas por policial</h3>
        <div className="rk-resumo">
          <span><b>{st.escalas}</b>ACO(s) gerada(s)</span>
          <span><b>{L.fN(st.turnos)}</b>{'ACO(s) tirada(s)' + (st.meias ? ` (${st.meias} meia${st.meias > 1 ? 's' : ''})` : '')}</span>
          <span><b>{st.lista.length}</b>policial(is)</span>
        </div>
        <div className="rk-ctrl">
          <select value={per} onChange={ev => setPer(ev.target.value)}><option value="mes">Este mês</option><option value="3m">Últimos 3 meses</option><option value="ano">Este ano</option><option value="tudo">Todo o período</option></select>
          <input value={busca} onChange={ev => setBusca(ev.target.value)} placeholder="🔍 Buscar policial" />
          {ehAdmin && <button className="btn peq" onClick={() => setCfgAberta(x => !x)}>Limite</button>}
        </div>
      </div>
      {cfgAberta && ehAdmin && <LimiteACO fechar={() => setCfgAberta(false)} salvo={atualizar} perfil={perfil} registrar={registrar} avisar={avisar} />}
      {stLim.length > 0 && <div className="rk-alerta">
        <b>{`⚠ Atenção: ${stLim.length} policial(is) perto do limite de ${cfg.max} ACOs ${L.NOME_PER[cfg.periodo]}` + (ating.length ? ` — ${ating.length} já atingiu(ram)` : '')}</b>
        <div>{stLim.map(p => <span key={p.k} className={'aco-qt ' + L.nivelACO(p.total)}>{`${p.posto} ${p.nome} · ${L.fN(p.total)}/${cfg.max}`}</span>)}</div>
      </div>}
      <div className={'rk-legenda' + (nivel ? ' filtrando' : '')}>
        <span>{`Limite: ${cfg.max} ACOs ${L.NOME_PER[cfg.periodo]} · toque para filtrar:`}</span>
        {L.faixasACO().map(([c, t]) => <button key={c} className={'faixa ' + c + (nivel === c ? ' ativo' : '')} onClick={() => setNivel(nivel === c ? null : c)}>{t}<em>{contNivel[c] || 0}</em></button>)}
        {nivel && <button className="faixa-limpar" onClick={() => setNivel(null)}>✕ Mostrar todos</button>}
      </div>
      {!st.lista.length ? <div className="vazio">Nenhuma ACO gerada neste período. A contagem é feita sempre que um PDF de ACO é gerado.</div> : (
        <div className="rolar-x"><table className="rk-tab">
          <thead><tr>{['#', 'Posto/Grad', 'Nome', 'Matrícula', 'Última ACO', 'ACOs (meia = 0,5)', 'Situação'].map(x => <th key={x}>{x}</th>)}</tr></thead>
          <tbody>
            {lista.map(p => {
              const pos = st.lista.indexOf(p) + 1, nv = L.nivelACO(p.total), sl = L.situacaoLimite(L.acosNoLimite(p)), ab = abertos.has(p.k);
              return [
                <tr key={p.k} className={'lin ' + nv} title="Toque para ver as datas" onClick={() => setAbertos(s => { const n = new Set(s); ab ? n.delete(p.k) : n.add(p.k); return n; })}>
                  <td className="pos">{pos}º</td><td>{p.posto || '—'}</td>
                  <td>{L.palavras(p.nome).map((w, i) => <span key={i}>{i ? ' ' : ''}{(p.guerra || []).includes(i) ? <b>{w}</b> : w}</span>)}</td>
                  <td>{p.matricula || '—'}</td><td>{dataBR(p.ultima)}</td>
                  <td className="qt"><div className="rk-barra"><b>{L.fN(p.total)}</b>{p.meias ? <small className="meias">{`${p.meias} meia${p.meias > 1 ? 's' : ''}`}</small> : null}<i style={{ width: Math.round(p.total / max * 150) }} /></div></td>
                  <td>{sl ? <span className={'aco-qt ' + sl.cls}>{sl.txt}</span> : <span className="dica">ok</span>}</td>
                </tr>,
                ab && <tr key={p.k + 'd'} className="det"><td colSpan={7}>{p.itens.slice().sort((a, b) => b.data.localeCompare(a.data)).map((i, j) => <span key={j}>{`${dataBR(i.data)} · ${i.local || '—'} · ACO Nº ${i.numero || '—'} (${i.tipo === 'compulsoria' ? 'compulsória' : 'voluntária'})${i.meia ? ' · meia ACO' : ''}`}</span>)}</td></tr>];
            })}
            {!lista.length && <tr><td colSpan={7} className="vazio">{nivel ? 'Nenhum policial nesta faixa.' : 'Ninguém encontrado.'}</td></tr>}
          </tbody>
        </table></div>)}
    </div>);
}

function LimiteACO({ fechar, salvo, perfil, registrar, avisar }){
  const c = L.cfgACO();
  const [max, setMax] = useState(c.max), [aviso, setAviso] = useState(c.aviso), [periodo, setPeriodo] = useState(c.periodo);
  const salvar = async () => {
    const m = Math.max(1, +max || 30), a = Math.min(m, Math.max(1, +aviso || m - 5));
    const v = { acoMax: m, acoAviso: a, acoPeriodo: periodo };
    try { await gravarConfig('cfg_aco', v, perfil.id); est.config = v; registrar('sistema', `definiu o limite de ACOs: ${m} ${L.NOME_PER[periodo]}, com aviso a partir de ${a}`); avisar('Limite de ACOs salvo'); salvo?.(); fechar(); }
    catch (err){ avisar(err.message, 'err'); }
  };
  return (
    <div className="aviso" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', margin: '10px 0' }}>
      <label style={{ display: 'grid', gap: 4 }}>Limite de ACOs<input type="number" min="1" value={max} onChange={ev => setMax(ev.target.value)} style={{ width: 90 }} /></label>
      <label style={{ display: 'grid', gap: 4 }}>Avisar a partir de<input type="number" min="1" value={aviso} onChange={ev => setAviso(ev.target.value)} style={{ width: 90 }} /></label>
      <label style={{ display: 'grid', gap: 4 }}>Período<select value={periodo} onChange={ev => setPeriodo(ev.target.value)}><option value="mes">no mês</option><option value="ano">no ano</option><option value="tudo">no total</option></select></label>
      <button className="btn peq pri" onClick={salvar}>Salvar</button><button className="btn peq" onClick={fechar}>Cancelar</button>
    </div>);
}
