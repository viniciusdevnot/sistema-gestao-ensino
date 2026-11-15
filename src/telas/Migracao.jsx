/* Trazer os dados do sistema anterior (dados.json e a pasta com os PDFs) para o banco */
import { useState } from 'react';
import * as api from '../lib/api.js';
import { useSessao } from '../contexto/Sessao.jsx';
import { norm, normUser, SENHA_MIN } from '../lib/util.js';

const usuarioDeNome = nome => normUser(norm(nome).replace(/[^A-Z0-9]+/g, '.').replace(/^\.|\.$/g, '')).slice(0, 24) || 'usuario';

export default function Migracao(){
  const { perfil, registrar, avisar } = useSessao();
  const [db, setDb] = useState(null); const [nomeArq, setNomeArq] = useState('');
  const [senhaProv, setSenhaProv] = useState('');
  const [log, setLog] = useState([]); const [rodando, setRodando] = useState(false);
  const [credenciais, setCredenciais] = useState([]);
  const [pasta, setPasta] = useState(null); const [prog, setProg] = useState('');
  const escreve = t => setLog(l => [...l, t]);

  const lerJson = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { const j = JSON.parse(await f.text()); setDb(j); setNomeArq(f.name); setLog([]); }
    catch { alert('Este arquivo não é um dados.json válido.'); }
  };
  const resumo = db && [
    ['Usuários', (db.perfis || []).length], ['Escalas de ACO', (db.escalasACO || []).length], ['Escalas na lixeira', (db.lixeiraACO || []).length],
    ['Ofícios', (db.oficios || []).length], ['Ordens de Serviço', (db.ordensServico || []).length], ['Documentos e procedimentos', (db.docsManual || []).length],
    ['Planilhas', (db.planilhas || []).length], ['Registros', (db.log || []).length], ['Histórico de ACO (painel)', Object.keys(db.historicoACO || {}).length],
    ['Manual de redação importado', db.manualRedacao ? 'sim' : 'não'], ['Almanaques', db.almanaque ? 'sim' : 'não']];

  const migrar = async () => {
    if (senhaProv.length < SENHA_MIN) return alert(`Defina a senha provisória dos usuários (mínimo ${SENHA_MIN} caracteres). Cada um troca no primeiro acesso.`);
    if (!confirm('Trazer todos os dados deste arquivo para o banco? Pode rodar de novo depois: o que já foi trazido não é duplicado.')) return;
    setRodando(true); setLog([]);
    try {
      // 1) usuários
      const existentes = await api.listarPerfis();
      const mapa = { admin: perfil.id };
      existentes.forEach(p => { if (p.legado_id) mapa[p.legado_id] = p.id; });
      const usados = new Set(existentes.map(p => p.usuario));
      const novos = [];
      for (const p of db.perfis || []){
        if (mapa[p.id]) continue;
        let u = normUser(p.usuario) || usuarioDeNome(p.nome);
        if (usados.has(u)){ const ja = existentes.find(x => x.usuario === u); if (ja && !ja.legado_id){ mapa[p.id] = ja.id; continue; } let k = 2; while (usados.has(u + k)) k++; u = u + k; }
        usados.add(u);
        novos.push({ usuario: u, senha: senhaProv, nome: p.nome || u, posto: p.posto || '', setor: p.setor || '', categoria: p.categoria || '', legadoId: p.id });
      }
      if (novos.length){
        escreve(`Criando ${novos.length} usuário(s)…`);
        const r = await api.criarUsuariosAdmin(novos);
        r.criados.forEach(c => { mapa[c.legadoId] = c.id; });
        r.erros.forEach(x => escreve(`⚠ ${x.usuario}: ${x.erro}`));
        setCredenciais(r.criados.map(c => c.usuario));
        // fotos dos perfis antigos
        for (const p of db.perfis || []) if (p.foto && mapa[p.id] && r.criados.some(c => c.id === mapa[p.id])) await api.salvarPerfil(mapa[p.id], { foto: p.foto }).catch(() => {});
        escreve(`✓ ${r.criados.length} usuário(s) criados com a senha provisória.`);
      } else escreve('✓ Usuários já estavam no banco.');
      const autor = id => mapa[id] || perfil.id;

      // 2) documentos de cada um
      const tabelas = [
        ['escalas_aco', db.escalasACO, x => ({ titulo: x.doc?.numero ? `ACO nº ${x.doc.numero}` : `ACO ${x.data || ''}`, tipo: x.tipo || '', criado_em: x.criadaEm, alterado_em: x.alteradaEm })],
        ['escalas_aco', (db.lixeiraACO || []).map(x => ({ ...x, __lixo: true })), x => ({ titulo: `ACO ${x.data || ''}`, tipo: x.tipo || '', excluido_em: x.excluidaEm || new Date().toISOString(), criado_em: x.criadaEm, alterado_em: x.alteradaEm })],
        ['oficios', db.oficios, x => ({ titulo: `Ofício nº ${x.campos?.numero || ''}/${x.campos?.ano || ''}`, tipo: x.campos?.tipoDoc || 'Ofício', criado_em: x.criadoEm, alterado_em: x.alteradoEm })],
        ['ordens_servico', db.ordensServico, x => ({ titulo: `O.S. nº ${x.campos?.numero || ''}/${x.campos?.ano || ''}`, tipo: 'OS', criado_em: x.criadoEm, alterado_em: x.alteradoEm })],
        ['documentos', db.docsManual, x => ({ titulo: x.modelo || '', tipo: x.cat || '', criado_em: x.criadoEm, alterado_em: x.alteradoEm })],
        ['planilhas', db.planilhas, x => ({ titulo: x.nome || 'Planilha', tipo: 'planilha', criado_em: x.criadaEm || x.criadoEm, alterado_em: x.alteradaEm || x.alteradoEm })]
      ];
      for (const [t, itens, extra] of tabelas){
        if (!itens?.length) continue;
        const ja = new Set((await api.listar(t, {}).catch(() => [])).map(r => r.legado_id));
        const jaLixo = new Set((await api.listar(t, { lixeira: true }).catch(() => [])).map(r => r.legado_id));
        const linhas = itens.filter(x => !ja.has(x.id) && !jaLixo.has(x.id)).map(x => { const { __lixo, ...dados } = x; const e = extra(x);
          return { autor_id: autor(x.autorId), autor: x.autor || '', titulo: e.titulo, tipo: e.tipo, dados, legado_id: x.id, criado_em: e.criado_em || new Date().toISOString(), alterado_em: e.alterado_em || new Date().toISOString(), ...(e.excluido_em ? { excluido_em: e.excluido_em } : {}) }; });
        await api.inserirVarios(t, linhas);
        escreve(`✓ ${t.replace('_', ' ')}: ${linhas.length} trazido(s)${itens.length - linhas.length ? `, ${itens.length - linhas.length} já existia(m)` : ''}.`);
      }

      // 3) histórico do painel de ACO e registros
      const hist = Object.entries(db.historicoACO || {});
      if (hist.length){ await api.inserirVarios('historico_aco', hist.map(([id, h]) => ({ chave: id, dados: h, data: h.data || null }))); escreve(`✓ Histórico de ACO: ${hist.length} escala(s).`); }
      const logs = db.log || [];
      if (logs.length){ await api.inserirVarios('registros', logs.map(l => ({ quando: l.quando, perfil_id: l.perfilId && mapa[l.perfilId] ? mapa[l.perfilId] : null, quem: l.quem || '', tipo: l.tipo || 'geral', acao: l.acao || '' }))); escreve(`✓ Registros: ${logs.length}.`); }

      // 4) configurações compartilhadas
      const cfg = [['manual_redacao', db.manualRedacao], ['almanaque', db.almanaque], ['antiguidade_manual', db.antigManual], ['config_geral', db.config]];
      for (const [k, v] of cfg) if (v){ await api.gravarConfig(k, v, perfil.id); escreve(`✓ Configuração “${k.replace('_', ' ')}”.`); }

      registrar('migracao', `trouxe os dados de “${nomeArq}” para o banco`);
      escreve('Concluído.'); avisar('Migração concluída');
    } catch (e){ escreve('✗ Parou com erro: ' + e.message); avisar('A migração parou com erro', 'err'); }
    setRodando(false);
  };

  const enviarPasta = async () => {
    if (!pasta?.length) return;
    const arqs = [...pasta].filter(f => /\.(pdf|png|jpe?g|docx?|xlsx?)$/i.test(f.name) && !/(^|\/)backups\//.test(f.webkitRelativePath));
    if (!confirm(`Enviar ${arqs.length} arquivo(s) da pasta antiga para o armazenamento on-line?`)) return;
    setRodando(true); let n = 0;
    for (const f of arqs){
      const caminho = 'pasta-antiga/' + f.webkitRelativePath.split('/').slice(1).join('/').replace(/[^\w./ -]+/g, '_');
      try { await api.enviarArquivo(caminho, f); n++; } catch (e){ escreve(`⚠ ${f.name}: ${e.message}`); }
      setProg(`${n} de ${arqs.length}`);
    }
    registrar('migracao', `enviou ${n} arquivo(s) da pasta antiga para o armazenamento on-line`);
    escreve(`✓ ${n} arquivo(s) enviados para “pasta-antiga/”.`); setRodando(false);
  };

  return (
    <section className="view ativa">
      <div className="card" style={{ maxWidth: 820 }}>
        <h3>1. Dados do sistema anterior (dados.json)</h3>
        <p className="dica" style={{ marginTop: -4 }}>Escolha o <b>dados.json</b> da pasta do sistema antigo. Usuários, escalas, ofícios, ordens de serviço, documentos, planilhas, registros, manual de redação, almanaques e o histórico do painel vêm para o banco. Pode repetir: nada é duplicado.</p>
        <label className="btn" style={{ display: 'inline-block' }}>Escolher dados.json<input type="file" accept=".json,application/json" hidden onChange={lerJson} /></label>
        {db && <>
          <table className="tab-datas" style={{ marginTop: 14 }}><tbody>{resumo.map(([a, b]) => <tr key={a}><td>{a}</td><td><b>{b}</b></td></tr>)}</tbody></table>
          <label style={{ display: 'block', margin: '14px 0 4px', fontWeight: 600 }}>Senha provisória para os usuários trazidos</label>
          <input value={senhaProv} onChange={e => setSenhaProv(e.target.value)} placeholder={`mínimo ${SENHA_MIN} caracteres`} style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, width: 260 }} />
          <p className="dica">As senhas antigas não podem ser levadas (ficam embaralhadas). Cada pessoa entra com o próprio usuário e esta senha, e o sistema pede para criar uma nova no primeiro acesso.</p>
          <button className="btn ouro" onClick={migrar} disabled={rodando}>{rodando ? 'Trazendo…' : 'Trazer para o banco'}</button>
        </>}
        {credenciais.length > 0 && <div className="aviso" style={{ marginTop: 14 }}><span>Usuários criados: <b>{credenciais.join(', ')}</b> — senha provisória: <b>{senhaProv}</b></span></div>}
        {log.length > 0 && <pre style={{ background: 'var(--sub)', padding: 12, borderRadius: 8, marginTop: 14, whiteSpace: 'pre-wrap' }}>{log.join('\n')}</pre>}
      </div>
      <div className="card" style={{ maxWidth: 820, marginTop: 16 }}>
        <h3>2. Arquivos da pasta (opcional)</h3>
        <p className="dica" style={{ marginTop: -4 }}>Envia os PDFs da pasta antiga (escalas, ofícios, ordens de serviço, documentos, almanaques) para o armazenamento on-line, em “pasta-antiga/”. A pasta de backups fica de fora.</p>
        <label className="btn" style={{ display: 'inline-block' }}>Escolher a pasta do sistema<input type="file" webkitdirectory="" directory="" multiple hidden onChange={e => setPasta(e.target.files)} /></label>
        {pasta && <> <span className="dica">{pasta.length} arquivo(s) na pasta</span> <button className="btn pri" onClick={enviarPasta} disabled={rodando}>Enviar</button> {prog && <span className="dica">{prog}</span>}</>}
      </div>
    </section>
  );
}
