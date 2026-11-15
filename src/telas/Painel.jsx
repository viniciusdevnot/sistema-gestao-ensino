import { useEffect, useState } from 'react';
import * as api from '../lib/api.js';
import { useSessao } from '../contexto/Sessao.jsx';
import { Avatar } from './Acesso.jsx';
import { Ic } from '../componentes/Icones.jsx';

export default function Painel(){
  const { perfil, ehAdmin } = useSessao();
  const [k, setK] = useState({});
  useEffect(() => {
    const id = ehAdmin ? undefined : perfil.id;
    Promise.all(['escalas_aco', 'oficios', 'ordens_servico', 'documentos', 'planilhas'].map(t => api.contar(t, id).catch(() => 0)))
      .then(([aco, of, os, dm, pl]) => setK({ aco, of, os, dm, pl }));
  }, [perfil.id, ehAdmin]);
  const h = new Date().getHours(), saud = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const kpi = (v, l, ic) => <div className="kpi"><div className="ic"><Ic n={ic} t={22} /></div><div><div className="v">{v ?? '…'}</div><div className="l">{l}</div></div></div>;
  return (
    <section className="view ativa">
      <div className="boasvindas">
        <Avatar perfil={perfil} tam={64} />
        <div><h2>{saud}, {perfil.nome}</h2><p>{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
        <svg className="deco" width="190" height="190"><use href="#i-capelo" /></svg>
      </div>
      <div className="kpis">
        {kpi(k.aco, ehAdmin ? 'Escalas de ACO (todas)' : 'Minhas escalas de ACO', 'escala')}
        {kpi(k.of, 'Ofícios', 'oficio')}
        {kpi(k.os, 'Ordens de Serviço', 'os')}
        {kpi(k.dm, 'Documentos', 'doc')}
      </div>
      <div className="card"><h3>Nova versão on-line</h3>
        <p className="dica" style={{ margin: 0 }}>O sistema agora funciona pela internet, com os dados guardados no banco de dados. As telas de ACO, documentos e procedimentos estão sendo trazidas para esta versão em etapas.</p></div>
    </section>
  );
}
