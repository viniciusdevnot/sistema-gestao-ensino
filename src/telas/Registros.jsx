import { useEffect, useState } from 'react';
import * as api from '../lib/api.js';
import { useSessao } from '../contexto/Sessao.jsx';
import { dataHora } from '../lib/util.js';

export default function Registros(){
  const { perfil, setPerfil } = useSessao();
  const [lista, setLista] = useState(null); const [busca, setBusca] = useState(''); const [tipo, setTipo] = useState('');
  const visto = perfil.log_visto_em;
  useEffect(() => { const t = setTimeout(() => api.listarRegistros({ busca: busca.trim() || undefined, tipo: tipo || undefined }).then(setLista).catch(() => setLista([])), 250); return () => clearTimeout(t); }, [busca, tipo]);
  useEffect(() => { const agora = new Date().toISOString(); api.salvarPerfil(perfil.id, { log_visto_em: agora }).then(p => setPerfil(p)).catch(() => {}); }, []);
  return (
    <section className="view ativa">
      <div className="card">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <input placeholder="Buscar por nome ou ação" value={busca} onChange={e => setBusca(e.target.value)} style={{ flex: 1, minWidth: 220, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8 }} />
          <select value={tipo} onChange={e => setTipo(e.target.value)} style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8 }}>
            <option value="">Todos os tipos</option>{Object.entries({ acesso: 'Acesso', perfil: 'Perfil', aco: 'Escala ACO', pdf: 'PDF gerado', arquivo: 'Arquivo', oficio: 'Ofício', os: 'Ordem de Serviço', docm: 'Documento', planilha: 'Planilha', exclusao: 'Exclusão', sistema: 'Sistema' }).map(([t, n]) => <option key={t} value={t}>{n}</option>)}
          </select>
        </div>
        {!lista ? <div className="vazio">Carregando…</div> : !lista.length ? <div className="vazio">Nenhum registro.</div> : (
          <div className="rolar-x"><table className="tabela-reg"><thead><tr><th>Quando</th><th>Quem</th><th>Tipo</th><th>O que fez</th></tr></thead>
            <tbody>{lista.map(r => <tr key={r.id} className={visto && r.quando > visto ? 'novo' : ''}><td style={{ whiteSpace: 'nowrap' }}>{dataHora(r.quando)}</td><td>{r.quem}</td><td><span className="tg">{r.tipo}</span></td><td>{r.acao}</td></tr>)}</tbody></table></div>)}
      </div>
    </section>
  );
}
