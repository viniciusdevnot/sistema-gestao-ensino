import { useEffect, useRef, useState } from 'react';
import { useSessao } from '../contexto/Sessao.jsx';
import { prepararDocumentos, mostrar, esconder } from '../legado/ponte.js';

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
    <div ref={no} />
  </>);
}
