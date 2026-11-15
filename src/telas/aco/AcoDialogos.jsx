import { useEffect, useRef, useState } from 'react';
import { useSessao } from '../../contexto/Sessao.jsx';
import * as L from '../../aco/logica.js';
import { est, dataBR, norm } from '../../aco/logica.js';
import { gravarConfig } from '../../aco/dados.js';

function useModal(){
  const ref = useRef();
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); return () => { try { d?.close(); } catch {} }; }, []);
  return ref;
}

/* Antes de gerar: completa/meia por bloco, aviso de limite, correção ou nova ACO e observação final */
export function DialogoGerar({ e, fim, alterou }){
  const ref = useModal();
  const [obs, setObs] = useState(e.doc.obsFinal || '');
  const [modo, setModo] = useState('');
  const [erroModo, setErroModo] = useState(false);
  const [, setN] = useState(0);
  const jaGerada = !!e.contabilizado;
  const cfg = L.cfgACO(), cont = new Map();
  e.blocos.flatMap(b => b.pessoas).forEach(r => { const k = L.chavePessoa(r); if (!cont.has(k)) cont.set(k, { r, n: L.acosNoLimite(r, e) }); cont.get(k).n += L.valorACO(r); });
  const limite = [...cont.values()].filter(x => x.n >= cfg.aviso).sort((a, b) => b.n - a.n);
  const bl = e.blocos.filter(b => b.pessoas.length), bm = bl.filter(b => b.tipo !== 'c').length;
  const ok = v => {
    if (v !== null && jaGerada && !modo){ setErroModo(false); setTimeout(() => setErroModo(true), 10); alert('Escolha se é uma correção desta ACO ou uma nova ACO.'); return; }
    fim(v === null ? null : { obs: v, modo: jaGerada ? modo : 'primeira' });
  };
  return (
    <dialog ref={ref} style={{ width: 580 }} onCancel={ev => { ev.preventDefault(); ok(null); }}>
      {jaGerada && <div className={'dlg-modo' + (erroModo ? ' erro' : '')}>
        <b>{`Esta ACO (Nº ${e.doc.numero}) já foi gerada em ${new Date(e.contabilizadoEm || e.ultimoPdf).toLocaleString('pt-BR')}.`}</b>
        <span className="dica">O que é esta nova geração?</span>
        <label><input type="radio" name="modo-ger" checked={modo === 'corr'} onChange={() => setModo('corr')} /> <span><b>Correção desta ACO</b> — substitui a contagem anterior no Painel</span></label>
        <label><input type="radio" name="modo-ger" checked={modo === 'nova'} onChange={() => setModo('nova')} /> <span><b>Nova ACO</b> — {`soma no Painel e vira a ACO Nº ${L.proximoNumero(e.data)}, separada desta`}</span></label>
      </div>}
      <div className="dlg-tipos-topo"><h3>ACO completa (12h) ou meia ACO (6h)</h3><span className="dica">{`${bl.length - bm} bloco(s) de 12h · ${bm} de 6h`}</span></div>
      <p className="dica" style={{ marginTop: 0 }}>Vale para todos os policiais do bloco (mesma cidade e horário). Meia ACO = 6h e conta 0,5 no contador; completa = 12h.</p>
      <div className="dlg-tipos">
        {L.blocosParaPdf(e).map(b => (
          <div className="tb-pes" key={b.id}>
            <span><b>{`${L.nomeCidade(b.local) || 'Sem cidade'} · ${dataBR(b.data)}`}</b><small>{` · ${b.pessoas.length} policial(is)`}</small></span>
            <select className={'tipo-aco' + (b.tipo !== 'c' ? ' meia' : '')} value={b.tipo === 'c' ? 'c' : 'm'} onChange={ev => { L.aplicarTipoBloco(b, ev.target.value); alterou(); setN(n => n + 1); }}>
              <option value="c">ACO completa · 12h</option><option value="m">Meia ACO · 6h</option></select>
          </div>))}
      </div>
      {limite.length > 0 && <div className="rk-alerta">
        <b>{`⚠ Antes de gerar: ${limite.length} policial(is) desta escala perto ou acima do limite de ${cfg.max} ACOs ${L.NOME_PER[cfg.periodo]}`}</b>
        <div>{limite.map((x, i) => <span key={i} className={'aco-qt ' + L.nivelACO(x.n)}>{`${x.r.posto} ${x.r.nome} · ficará com ${L.fN(x.n)}/${cfg.max}`}</span>)}</div>
      </div>}
      <h3>Observação no final do documento</h3>
      <p className="dica" style={{ marginTop: -6 }}>Aparece depois das tabelas, antes do local, data e assinatura. Deixe em branco se não quiser. Use **texto** para negrito; cada linha vira um parágrafo.</p>
      <textarea rows={5} value={obs} onChange={ev => setObs(ev.target.value)} style={{ width: '100%', padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 8 }} placeholder="Ex.: Os policiais escalados deverão se apresentar 30 minutos antes do horário." />
      <div className="rodape">
        <button className="btn esq" onClick={() => ok(null)}>Cancelar</button>
        <button className="btn" onClick={() => ok('')}>Gerar sem observação</button>
        <button className="btn ouro" onClick={() => ok(obs.trim())}>Gerar PDF</button>
      </div>
    </dialog>);
}

/* Antiguidade de quem está fora do almanaque: "mais antigo/moderno que Fulano" */
export function DialogoAntiguidade({ e, r, fechar }){
  const { perfil, registrar, avisar } = useSessao();
  const ref = useModal();
  const d = L.defAntManual(r);
  const [lado, setLado] = useState(d?.lado || 'antes');
  const [refP, setRefP] = useState(d ? { nome: d.refNome, matricula: d.refMat, cpf: d.refCpf, posto: d.refPosto } : null);
  const [busca, setBusca] = useState('');
  const [salvando, setSalvando] = useState(false);
  const meu = L.ordemPosto(r.posto), vistos = new Set();
  const colegas = L.todasPessoas(e).filter(p => p.nome && !L.mesmaPessoa(p, r) && L.ordemPosto(p.posto) === meu).filter(p => { const k = L.chavePessoa(p); if (vistos.has(k)) return false; vistos.add(k); return true; }).sort(L.porPatente);
  const q = norm(busca).trim(), qd = q.replace(/\D/g, '');
  const achados = [];
  if (q.length >= 2) Object.entries(est.almanaque?.listas || {}).forEach(([g, itens]) => itens.forEach((it, i) => {
    if ((it[2] || '').includes(q) || (qd.length >= 3 && String(it[1] || '').includes(qd))) achados.push({ it, seq: +g * 100000 + i, mesmo: L.ordemPosto(it[4]) === meu });
  }));
  achados.sort((a, b) => (b.mesmo - a.mesmo) || a.seq - b.seq);
  const botao = (pp, extra, key) => (
    <button key={key} className={refP && L.mesmaPessoa(refP, pp) ? 'sel' : ''} onClick={() => setRefP({ nome: pp.nome, matricula: pp.matricula || '', cpf: pp.cpf || '', posto: pp.posto || '' })}>
      <span>{[pp.posto, pp.nome].filter(Boolean).join(' ')}</span><small>{extra || ''}</small></button>);
  const gravar = async (M, msg) => {
    setSalvando(true);
    try { await gravarConfig('antiguidade_manual', M, perfil.id); est.antigManual = M; registrar('aco', msg); avisar('Antiguidade atualizada'); fechar(); }
    catch (err){ avisar('Não consegui salvar: ' + err.message, 'err'); setSalvando(false); }
  };
  const salvar = () => {
    if (!refP){ alert('Escolha o policial de referência.'); return; }
    const M = { ...(est.antigManual || {}) };
    L.chavesAnt(r).forEach(k => delete M[k]);
    M[L.chavesAnt(r)[0]] = { lado, nome: r.nome, posto: r.posto, refNome: refP.nome, refMat: refP.matricula, refCpf: refP.cpf, refPosto: refP.posto, por: est.quem, em: new Date().toISOString() };
    gravar(M, `definiu a antiguidade de ${[r.posto, r.nome].filter(Boolean).join(' ')} (fora do almanaque): mais ${lado === 'antes' ? 'antigo' : 'moderno'} que ${[refP.posto, refP.nome].filter(Boolean).join(' ')}`);
  };
  const remover = () => {
    if (!confirm(`Remover a antiguidade definida para ${r.nome}? Ele volta para o fim do seu posto.`)) return;
    const M = { ...(est.antigManual || {}) }; L.chavesAnt(r).forEach(k => delete M[k]);
    gravar(M, `removeu a antiguidade definida manualmente de ${[r.posto, r.nome].filter(Boolean).join(' ')}`);
  };
  return (
    <dialog ref={ref} style={{ width: 600 }} onCancel={ev => { ev.preventDefault(); fechar(); }}>
      <h3>Antiguidade de quem está fora do almanaque</h3>
      <p className="dica" style={{ margin: '-4px 0 4px' }}>{`${[r.posto, r.nome].filter(Boolean).join(' ')} não foi encontrado nos almanaques. Diga quem ele precede ou sucede na antiguidade; a escala se reorganiza sozinha.`}</p>
      <label>Este policial é</label>
      <div className="ant-lado">
        <label><input type="radio" checked={lado === 'antes'} onChange={() => setLado('antes')} /> <b>mais antigo</b> que…</label>
        <label><input type="radio" checked={lado === 'depois'} onChange={() => setLado('depois')} /> <b>mais moderno</b> que…</label>
      </div>
      <label>Policiais do mesmo posto nesta escala</label>
      <div className="ant-lista">
        {colegas.map((p, i) => botao(p, L.rotAntig(L.antiguidade(p)) || 'fora do almanaque', 'c' + i))}
        {!colegas.length && <div className="dica">Não há outro policial do mesmo posto nesta escala. Procure no almanaque abaixo.</div>}
      </div>
      <label>Ou procure no almanaque</label>
      <input value={busca} onChange={ev => setBusca(ev.target.value)} placeholder="Nome ou matrícula" autoComplete="off" />
      <div className="ant-lista">
        {achados.slice(0, 15).map(({ it }, i) => botao({ nome: it[2], matricula: it[1], cpf: it[0], posto: it[4] }, `Antig. ${it[3]}º` + (it[1] ? ' · Mat. ' + it[1] : ''), 'a' + i))}
        {q.length >= 2 && !achados.length && <div className="dica">Ninguém encontrado no almanaque.</div>}
      </div>
      <p className="ant-escolha">{refP ? `${r.nome} ficará logo ${lado === 'antes' ? 'ACIMA (mais antigo)' : 'ABAIXO (mais moderno)'} de ${[refP.posto, refP.nome].filter(Boolean).join(' ')}.` : ''}</p>
      <p className="dica" style={{ margin: '6px 0 0' }}>Vale para todas as escalas e todos os usuários, até ele entrar num almanaque novo.</p>
      <div className="rodape">
        {d && <button className="btn perigo esq" onClick={remover} disabled={salvando}>Remover definição</button>}
        <button className="btn" onClick={fechar} disabled={salvando}>Cancelar</button>
        <button className="btn pri" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </dialog>);
}
