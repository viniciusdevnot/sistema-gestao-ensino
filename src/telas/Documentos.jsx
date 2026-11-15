import { useEffect, useRef, useState } from 'react';
import { useSessao } from '../contexto/Sessao.jsx';
import { prepararDocumentos, mostrar, esconder, infoMppadmis, importarMppadmis, voltarMppadmisEmbutido, rerender } from '../legado/ponte.js';

/* Ofícios, Ordens de Serviço, Documentos do manual e Procedimentos.
   As telas usam o motor do sistema anterior (edição direto na folha, importação de PDF/Word,
   conferência com o manual), ligado ao banco de dados pela ponte. */
export default function Documentos({ view, ir, aoSalvar }){
  const { perfil, ehAdmin, registrar, avisar } = useSessao();
  const no = useRef();
  const [estado, setEstado] = useState('carregando');
  const [erro, setErro] = useState('');

  useEffect(() => {
    let vivo = true;
    prepararDocumentos({ perfil, admin: ehAdmin, registrar, avisar, ir, aoSalvar })
      .then(() => { if (vivo) setEstado('pronto'); })
      .catch(e => { if (vivo){ setErro(e.message); setEstado('erro'); } });
    return () => { vivo = false; };
  }, [perfil?.id, ehAdmin]);

  useEffect(() => { if (estado === 'pronto') mostrar(no.current, view); }, [estado, view]);
  useEffect(() => () => esconder(), []);

  if (estado === 'erro') return (
    <section className="view ativa"><div className="card"><h3>Não consegui carregar os documentos</h3><p className="dica">{erro}</p>
      <button className="btn" onClick={() => { setEstado('carregando'); location.reload(); }}>Tentar de novo</button></div></section>);
  return (<>
    {estado === 'carregando' && <section className="view ativa"><div className="card"><div className="vazio"><span className="spinner" /> Carregando documentos e manuais…</div></div></section>}
    {estado === 'pronto' && /^dm-pr-/.test(view) && <ManualProc view={view} />}
    <div ref={no} />
  </>);
}

/* Manual de Procedimentos em uso e importação de uma versão nova (administrador) */
function ManualProc({ view }){
  const { ehAdmin, avisar } = useSessao();
  const [prog, setProg] = useState(null);
  const [, setN] = useState(0);
  const inp = useRef();
  const i = infoMppadmis();
  const importar = async f => {
    if (!f) return;
    if (!confirm(`Trocar os modelos de Procedimentos pelos do arquivo “${f.name}”?\n\nVale para todos os oficiais. Os documentos já feitos continuam como estão.`)) return;
    try { const n = await importarMppadmis(f, (p, t) => setProg({ p, t })); avisar(`Manual de procedimentos importado: ${n} modelos`); rerender(view); }
    catch (e){ alert('Não consegui ler o manual: ' + e.message); }
    finally { setProg(null); setN(x => x + 1); }
  };
  return (
    <div className="card manual-proc" style={{ marginBottom: 16, padding: '12px 16px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <b style={{ fontSize: 13 }}>Manual de Procedimentos (MPPADMIS)</b>
          <div className="dica" style={{ margin: 0 }}>{`${i.qtd} modelos · ${i.nome}` + (i.importadoEm ? ` · importado em ${new Date(i.importadoEm).toLocaleString('pt-BR')}${i.por ? ' por ' + i.por : ''}` : '')}</div>
        </div>
        {ehAdmin && <>
          {!i.embutido && <button className="btn peq" disabled={!!prog} onClick={async () => { if (!confirm('Voltar aos modelos do manual embutido no sistema?')) return; try { await voltarMppadmisEmbutido(); avisar('Manual embutido restaurado'); rerender(view); setN(x => x + 1); } catch (e){ avisar(e.message, 'err'); } }}>Usar o embutido</button>}
          <button className="btn peq pri" disabled={!!prog} onClick={() => inp.current.click()}>Importar versão nova (PDF)</button>
        </>}
      </div>
      {prog && <div className="prog-txt" style={{ marginTop: 8 }}><span className="spinner" /> {prog.t} ({prog.p}%)</div>}
      <input type="file" ref={inp} accept=".pdf,application/pdf" hidden onChange={ev => { const f = ev.target.files[0]; ev.target.value = ''; importar(f); }} />
    </div>);
}
