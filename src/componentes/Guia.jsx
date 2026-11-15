import { useEffect, useMemo, useRef, useState } from 'react';
import { GUIA_TODOS } from '../lib/guia.js';

/* Guia do sistema: capítulos à esquerda, passo atual com imagens marcadas e texto,
   Anterior/Próximo (ou setas do teclado), Esc fecha, clique na imagem amplia. */
export default function Guia({ ehOficial, ehAdmin, capInicial = 0, fechar }){
  const GUIA = useMemo(() => GUIA_TODOS.filter(c => (!c.oficial || ehOficial || ehAdmin) && (!c.admin || ehAdmin)), [ehOficial, ehAdmin]);
  const [pos, setPos] = useState({ c: Math.max(0, Math.min(GUIA.length - 1, capInicial)), p: 0 });
  const [zoom, setZoom] = useState(null);
  const [empilhado, setEmpilhado] = useState(false);
  const corpo = useRef(), prox = useRef();
  const total = GUIA.reduce((n, c) => n + c.passos.length, 0);
  const atual = GUIA.slice(0, pos.c).reduce((n, x) => n + x.passos.length, 0) + pos.p + 1;
  const cap = GUIA[pos.c], passo = cap.passos[pos.p];
  const mover = d => {
    let { c, p } = pos; p += d;
    if (p >= GUIA[c].passos.length){ if (c === GUIA.length - 1){ fechar(true); return; } c++; p = 0; }
    if (p < 0){ if (c === 0) return; c--; p = GUIA[c].passos.length - 1; }
    setPos({ c, p });
  };
  useEffect(() => { setEmpilhado(false); if (corpo.current) corpo.current.scrollTop = 0; }, [pos]);
  useEffect(() => { prox.current?.focus(); document.body.classList.add('guia-aberto'); return () => document.body.classList.remove('guia-aberto'); }, []);
  useEffect(() => {
    const f = ev => {
      if (ev.key === 'Escape'){ if (zoom) setZoom(null); else fechar(false); }
      else if (/INPUT|TEXTAREA|SELECT/.test(ev.target.tagName)) return;
      else if (ev.key === 'ArrowRight') mover(1);
      else if (ev.key === 'ArrowLeft') mover(-1);
    };
    document.addEventListener('keydown', f); return () => document.removeEventListener('keydown', f);
  });
  const ult = atual === total, imgs = passo.img || [];
  return (
    <div id="guia" onClick={ev => { if (ev.target.id === 'guia') fechar(false); }}>
      <div className="g-caixa" role="dialog" aria-label="Guia do sistema">
        <aside className="g-lado">
          <div className="g-marca"><img className="logo-pm" src="/brasao.png" alt="" /><div><b>Guia do sistema</b><small>Passo a passo</small></div></div>
          <nav className="g-caps">
            {GUIA.map((x, i) => [
              <button key={'c' + i} className={'g-cap' + (i === pos.c ? ' on' : '') + (i < pos.c ? ' feito' : '')} onClick={() => setPos({ c: i, p: 0 })}>
                <span className="ic">{i < pos.c ? '✓' : x.icone}</span><span className="tx"><b>{x.cap}</b><small>{x.passos.length} passo(s)</small></span>
              </button>,
              i === pos.c && <div key={'s' + i} className="g-sub">{x.passos.map((ps, j) => <button key={j} className={'g-subi' + (j === pos.p ? ' on' : '')} onClick={() => setPos({ c: i, p: j })}>{ps.t}</button>)}</div>
            ])}
          </nav>
        </aside>
        <section className="g-main">
          <header className="g-cab">
            <div><small className="g-cap-nome">{`${cap.icone} ${cap.cap}`}</small><h2 className="g-titulo">{passo.t}</h2></div>
            <button className="g-x" title="Fechar (Esc)" onClick={() => fechar(false)}>✕</button>
          </header>
          <div className="g-prog"><i style={{ width: (atual / total * 100) + '%' }} /></div>
          <div className="g-corpo" ref={corpo}>
            <div className={'g-grid' + (imgs.length ? '' : ' so-texto') + (empilhado ? ' empilhado' : '')}>
              {imgs.length > 0 && <div className="g-imgs">{imgs.map(n => (
                <figure key={n}><img src={`/guia/${n}.jpg`} alt="" title="Clique para ampliar" onClick={() => setZoom(`/guia/${n}.jpg`)}
                  onLoad={ev => { if (ev.currentTarget.naturalWidth / ev.currentTarget.naturalHeight > 1.55) setEmpilhado(true); }} /></figure>))}</div>}
              <div className="g-texto" dangerouslySetInnerHTML={{ __html: passo.html }} />
            </div>
          </div>
          <footer className="g-rod">
            <button className="btn g-pular" onClick={() => fechar(false)}>Fechar guia</button>
            <span className="g-cont">{`${atual} de ${total}`}</span>
            <button className="btn g-ant" disabled={atual === 1} onClick={() => mover(-1)}>← Anterior</button>
            <button ref={prox} className={'btn pri g-prox' + (ult ? ' ouro' : '')} onClick={() => mover(1)}>{ult ? 'Concluir ✓' : 'Próximo →'}</button>
          </footer>
        </section>
      </div>
      {zoom && <div className="g-zoom" onClick={() => setZoom(null)}><img src={zoom} alt="" /></div>}
    </div>
  );
}
