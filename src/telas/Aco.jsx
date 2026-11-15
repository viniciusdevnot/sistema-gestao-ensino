import { useEffect, useState, useCallback } from 'react';
import { useSessao } from '../contexto/Sessao.jsx';
import { est } from '../aco/logica.js';
import { carregarACO, abrirEscala, purgarLixeira } from '../aco/dados.js';
import AcoInicio from './aco/AcoInicio.jsx';
import AcoEditor from './aco/AcoEditor.jsx';

/* Escala de ACO: lista das escalas (início) e editor da escala aberta */
export default function Aco({ aoMudarContagem }){
  const { perfil, ehAdmin, registrar, avisar } = useSessao();
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState('');
  const [abertaId, setAbertaId] = useState(null);
  const [, setN] = useState(0);
  const atualizar = useCallback(() => setN(n => n + 1), []);

  const recarregar = useCallback(async () => {
    try {
      await carregarACO(perfil, ehAdmin);
      const n = await purgarLixeira(registrar);
      if (n) await carregarACO(perfil, ehAdmin);
      setErro(''); setPronto(true); atualizar(); aoMudarContagem?.();
    } catch (e){ setErro(e.message); setPronto(true); }
  }, [perfil, ehAdmin]);

  useEffect(() => { est.atual = null; recarregar(); return () => { est.atual = null; }; }, [recarregar]);

  const abrir = async id => {
    try { await abrirEscala(id); setAbertaId(id); window.scrollTo(0, 0); }
    catch (e){ avisar('Não consegui abrir a escala: ' + e.message, 'err'); }
  };
  const fechar = async () => { est.atual = null; setAbertaId(null); await recarregar(); window.scrollTo(0, 0); };

  if (!pronto) return <section className="view ativa"><div className="card"><div className="vazio"><span className="spinner" /> Carregando escalas…</div></div></section>;
  if (erro) return (
    <section className="view ativa"><div className="card">
      <h3>Não consegui carregar a Escala de ACO</h3>
      <p className="dica">{erro}</p>
      {/aco_resumo|function|historico/i.test(erro) && <p className="dica">Falta atualizar o banco: no Supabase, abra <b>SQL Editor → New query</b>, cole o conteúdo do arquivo <code>supabase/002_aco.sql</code> do GitHub e clique em <b>Run</b>.</p>}
      <button className="btn" onClick={() => { setPronto(false); recarregar(); }}>Tentar de novo</button>
    </div></section>);
  return (
    <section className="view ativa">
      {abertaId && est.atual
        ? <AcoEditor key={abertaId} voltar={fechar} abrir={abrir} />
        : <AcoInicio abrir={abrir} atualizar={atualizar} recarregar={recarregar} />}
    </section>
  );
}
