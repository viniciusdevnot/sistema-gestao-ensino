import { useState, useRef } from 'react';
import { useSessao } from '../../contexto/Sessao.jsx';
import { Ic } from '../../componentes/Icones.jsx';
import { est, novoId, hojeISO, dataBR, DOC_PADRAO, novoBloco, proximoNumero, minhaEscala, rotuloData, todasPessoas, descEscala, tempoRestante, grupoAlmanaque, lerAlmanaque, NOMES_ALM } from '../../aco/logica.js';
import { gravarEscala, restaurar, excluirDeVez, gravarConfig } from '../../aco/dados.js';
import { lerPdf } from '../../aco/pdf.js';

export default function AcoInicio({ abrir, atualizar, recarregar }){
  const { perfil, ehAdmin, registrar, avisar } = useSessao();
  const [criando, setCriando] = useState(false);

  const nova = async tipo => {
    if (criando) return; setCriando(true);
    try {
      // reaproveita os textos da última escala (uniforme, armamento, observações, assinatura...)
      const ultima = est.escalas.filter(minhaEscala).slice().sort((a, b) => (b.alteradaEm || '').localeCompare(a.alteradaEm || ''))[0];
      const data = hojeISO();
      const doc = { ...DOC_PADRAO, ...(ultima?.doc || {}), operacao: ultima?.doc?.operacao || '', sgd: '', dataDoc: hojeISO(), obsFinal: '' };
      const b = novoBloco(data, ultima ? { inicio: ultima.blocos?.[0]?.inicio } : null);
      const e = { id: novoId(), tipo, rp: [], efetivo: null, autorId: perfil.id, autor: perfil.nome || '', criadaEm: new Date().toISOString(), alteradaEm: new Date().toISOString(), data, doc, blocos: [b], blocoAtivo: b.id, liberados: [] };
      e.doc.numero = proximoNumero(data);
      await gravarEscala(e);
      est.escalas.push(e);
      registrar('aco', `criou a escala ${descEscala(e)}`);
      await abrir(e.id);
    } catch (err){ avisar('Não consegui criar a escala: ' + err.message, 'err'); }
    finally { setCriando(false); }
  };

  const lista = est.escalas.filter(minhaEscala).sort((a, b) => (b.data || '').localeCompare(a.data || '') || (b.alteradaEm || '').localeCompare(a.alteradaEm || ''));
  const lixo = est.lixeira.filter(minhaEscala).sort((a, b) => (b.excluidaEm || '').localeCompare(a.excluidaEm || ''));

  return (<>
    <div className="aco-opcoes">
      <button className="aco-op" onClick={() => nova('compulsoria')} disabled={criando}>
        <div className="ic"><Ic n="escala" t={26} /></div>
        <div><b>Escala ACO Compulsória</b><span>Importa os PDFs (escalas de RP + relação geral do efetivo), bloqueia quem está de RP na data da escala e lista quem está livre, em ordem de patente.</span></div>
      </button>
      <button className="aco-op vol" onClick={() => nova('voluntaria')} disabled={criando}>
        <div className="ic"><Ic n="mao" t={26} /></div>
        <div><b>Escala ACO Voluntária</b><span>Arquivos opcionais. Adicione os voluntários manualmente ou pela relação do efetivo e gere o PDF.</span></div>
      </button>
    </div>
    {criando && <p className="dica"><span className="spinner" /> Criando escala…</p>}

    <Almanaques atualizar={atualizar} />

    <div className="card"><h3>Escalas criadas</h3>
      <div className="lista-rec">
        {!lista.length && <div className="vazio">{ehAdmin ? 'Nenhuma escala criada ainda.' : 'Você ainda não criou nenhuma escala.'} Escolha uma das opções acima.</div>}
        {lista.map(e => {
          const rot = rotuloData(e.data), locais = e.blocos.map(b => b.local).filter(Boolean);
          return (
            <div className="linha" key={e.id}>
              <div className="ic-arq" style={{ background: e.tipo === 'compulsoria' ? 'var(--navy2)' : '#a8861c' }}>ACO</div>
              <div className="nm"><b>{`Nº ${e.doc.numero || '—'} · ${dataBR(e.data)} · ${e.tipo === 'compulsoria' ? 'Compulsória' : 'Voluntária'}` + (e.doc.operacao ? ' · ' + e.doc.operacao : '')}</b>
                <small>{`${todasPessoas(e).length} policial(is) · ${e.blocos.length} bloco(s)` + (locais.length ? ' (' + locais.join(', ') + ')' : '') + (e.autor ? ' · por ' + e.autor : '') + (e.ultimoPdf ? ' · PDF gerado em ' + new Date(e.ultimoPdf).toLocaleString('pt-BR') : '')}</small></div>
              <span className={'tg ' + (rot === 'Hoje' ? 'bloq' : rot === 'Passada' ? '' : 'ef')}>{rot}</span>
              <button className="btn peq" onClick={() => abrir(e.id)}>Abrir</button>
            </div>);
        })}
      </div>
    </div>

    <details className="card">
      <summary><h3>🗑 Excluídas <small style={{ color: 'var(--muted)', fontWeight: 400 }}>{lixo.length ? `(${lixo.length})` : ''}</small></h3><span className="dica">ficam aqui por 1 dia e podem ser restauradas; depois somem do sistema</span></summary>
      <div className="lista-rec">
        {!lixo.length && <div className="vazio" style={{ padding: 16 }}>Nenhuma escala excluída.</div>}
        {lixo.map(e => (
          <div className="linha" key={e.id} style={{ opacity: .85 }}>
            <div className="ic-arq" style={{ background: '#98a2b3' }}>ACO</div>
            <div className="nm"><b>{`Nº ${e.doc.numero || '—'} · ${dataBR(e.data)} · ${e.tipo === 'compulsoria' ? 'Compulsória' : 'Voluntária'}` + (e.doc.operacao ? ' · ' + e.doc.operacao : '')}</b>
              <small>{`${todasPessoas(e).length} policial(is) · excluída em ${new Date(e.excluidaEm).toLocaleString('pt-BR')}`}<span className="tg av" style={{ marginLeft: 6 }}>{tempoRestante(e)}</span></small></div>
            <button className="btn peq" onClick={async () => {
              try { await restaurar(e); registrar('aco', `restaurou a ${descEscala(e)}`); avisar(`Escala Nº ${e.doc.numero} restaurada`); atualizar(); } catch (err){ avisar(err.message, 'err'); }
            }}>Restaurar</button>
            {ehAdmin && <button className="btn peq perigo" onClick={async () => {
              if (!confirm(`Excluir DEFINITIVAMENTE a escala Nº ${e.doc.numero} de ${dataBR(e.data)}? Não dá para desfazer.`)) return;
              try { await excluirDeVez(e); registrar('exclusao', `excluiu definitivamente a ${descEscala(e)}`); atualizar(); } catch (err){ avisar(err.message, 'err'); }
            }}>Excluir de vez</button>}
          </div>))}
      </div>
      {ehAdmin && lixo.length > 0 && <div style={{ marginTop: 10 }}><button className="btn peq perigo" onClick={async () => {
        if (!confirm(`Excluir DEFINITIVAMENTE as ${lixo.length} escala(s) em Excluídas? Não dá para desfazer.`)) return;
        for (const e of lixo){ try { await excluirDeVez(e); } catch {} }
        registrar('exclusao', `esvaziou as Excluídas (${lixo.length} escala(s) apagadas de vez)`); recarregar();
      }}>Esvaziar excluídas (definitivo)</button></div>}
    </details>
  </>);
}

/* Almanaques de antiguidade (valem para todos; só o administrador troca) */
export function Almanaques({ atualizar }){
  const { perfil, ehAdmin, registrar, avisar } = useSessao();
  const [prog, setProg] = useState('');
  const inp = useRef();
  const arq = est.almanaque?.arquivos || {};
  const importar = async files => {
    const lista = [...files].filter(f => /\.pdf$/i.test(f.name)); if (!lista.length) return;
    for (let i = 0; i < lista.length; i++){
      const f = lista[i];
      try {
        const linhas = await lerPdf(f, fr => setProg(`Lendo ${i + 1} de ${lista.length}: ${f.name} (${Math.round(fr * 100)}%)`));
        if (!grupoAlmanaque(linhas)){ alert(`"${f.name}" não parece ser um almanaque.`); continue; }
        await salvarAlmanaque(f.name, linhas, perfil, registrar, setProg);
        atualizar();
      } catch (err){ console.error(err); alert(`Não consegui ler "${f.name}": ${err.message}`); }
    }
  };
  return (
    <div className="card alm-card">
      <div className="alm-topo">
        <div><h3 style={{ margin: 0 }}>Almanaques de antiguidade</h3><p className="dica" style={{ margin: '2px 0 0' }}>A lista de disponíveis segue a ordem: <b>1º patente</b>, <b>2º antiguidade do almanaque</b>. Valem para todas as escalas e todos os usuários.</p></div>
        {ehAdmin ? <button className="btn peq pri" onClick={() => inp.current.click()}>Trocar almanaques</button> : <span className="dica">Só o administrador troca os almanaques.</span>}
      </div>
      <div className="alm-slots">
        {[1, 2, 3].map(g => { const a = arq[g]; return (
          <div key={g} className={'alm-slot' + (a ? ' ok' : '')}>
            <b>{NOMES_ALM[g]}</b>
            <small>{a ? `${a.qtd} policiais · ${a.nome}` : 'Não importado'}</small>
            {a?.atualizado && <em>{a.atualizado}</em>}
            {a && <span className="quando">{`Importado em ${new Date(a.importadoEm).toLocaleString('pt-BR')}` + (a.por ? ` por ${a.por}` : '')}</span>}
            {a && ehAdmin && <button className="btn peq perigo" onClick={async () => {
              if (!confirm(`Remover o almanaque de ${NOMES_ALM[g]}?`)) return;
              const A = JSON.parse(JSON.stringify(est.almanaque)); delete A.listas[g]; delete A.arquivos[g]; A.stamp = String(Date.now());
              try { await gravarConfig('almanaque', A, perfil.id); est.almanaque = A; registrar('exclusao', `removeu o almanaque de ${NOMES_ALM[g]}`); atualizar(); } catch (err){ avisar(err.message, 'err'); }
            }}>Remover</button>}
          </div>); })}
      </div>
      <div className="prog-txt alm-prog">{prog}</div>
      <input type="file" ref={inp} accept=".pdf,application/pdf" multiple hidden onChange={ev => { const f = ev.target.files; if (f.length) importar(f); ev.target.value = ''; }} />
    </div>
  );
}

export async function salvarAlmanaque(nome, linhas, perfil, registrar, setProg){
  const r = lerAlmanaque(nome, linhas);
  setProg?.(`Salvando o almanaque de ${NOMES_ALM[r.grupo]}…`);
  await gravarConfig('almanaque', r.A, perfil.id);
  est.almanaque = r.A;
  registrar('arquivo', `${r.antes ? 'trocou' : 'importou'} o almanaque de ${NOMES_ALM[r.grupo]} (${r.qtd} policiais) — ${nome}` + (r.antes ? ` (antes: ${r.antes.nome}, ${r.antes.qtd} policiais)` : ''));
  setProg?.(`${NOMES_ALM[r.grupo]}: ${r.qtd} policiais importados.`);
  return r;
}
