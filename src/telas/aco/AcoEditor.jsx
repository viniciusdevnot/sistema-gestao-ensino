import { useEffect, useRef, useState, useCallback } from 'react';
import { useSessao } from '../../contexto/Sessao.jsx';
import { Ic } from '../../componentes/Icones.jsx';
import * as L from '../../aco/logica.js';
import { est, E, norm, dataBR, diaSemana, hojeISO, uid, novoId } from '../../aco/logica.js';
import { gravarEscala, moverParaLixeira, gravarHistorico } from '../../aco/dados.js';
import { lerPdf, gerarBytesACO, baixar } from '../../aco/pdf.js';
import { salvarAlmanaque } from './AcoInicio.jsx';
import { DialogoGerar, DialogoAntiguidade } from './AcoDialogos.jsx';

const CAMPOS_DOC = [
  ['cab1', 'Cabeçalho (linha 1)', 'l3'], ['cab2', 'Cabeçalho (linha 2)', 'l3'], ['titulo', 'Título', 'l2'], ['numero', 'Nº da escala no mês', ''],
  ['operacao', 'Operação', 'l2', 'Ex.: OPERAÇÃO ENEM'], ['sgd', 'SGD', '', '2026/09039/101865'],
  ['uniforme', 'Uniforme', 'l3', '', 2], ['armamento', 'Armamento e Equipamento', 'l3', '', 3], ['obs', 'Observações', 'l3', '', 3],
  ['enquadramento', 'Frase de enquadramento', 'l3'], ['localDoc', 'Local do documento', 'l2'], ['dataDoc', 'Data do documento', '', '', 0, 'date'],
  ['linhaAss', 'Linha da assinatura', ''], ['signatario', 'Quem assina', 'l2'], ['cargo', 'Cargo de quem assina', 'l3']
];

export default function AcoEditor({ voltar, abrir }){
  const { perfil, ehAdmin, registrar, avisar } = useSessao();
  const e = est.atual;
  const [, setN] = useState(0);
  const bump = useCallback(() => setN(n => n + 1), []);
  const [busca, setBusca] = useState('');
  const [trocando, setTrocando] = useState(null);
  const [abertas, setAbertas] = useState(() => new Set());
  const [lendo, setLendo] = useState(null);     // {i, total, frac, nome}
  const [salvando, setSalvando] = useState('');  // '', 'pendente', 'salvando', 'erro'
  const [destaque, setDestaque] = useState(null);
  const [sobre, setSobre] = useState(false);
  const [gerar, setGerar] = useState(null);      // diálogo de geração {resolve}
  const [antig, setAntig] = useState(null);      // diálogo de antiguidade {r}
  const [gerando, setGerando] = useState(false);
  const inpArq = useRef(), timer = useRef(null), dispRef = useRef(), buscaRef = useRef();

  /* ---------- salvar no banco (automático, 0,8 s depois da última alteração) ---------- */
  const salvarJa = useCallback(async () => {
    clearTimeout(timer.current); timer.current = null;
    const x = est.atual; if (!x) return;
    setSalvando('salvando');
    try { await gravarEscala(x); setSalvando(''); } catch (err){ setSalvando('erro'); avisar('Não consegui salvar a escala: ' + err.message, 'err'); }
  }, []);
  const alterou = useCallback(() => {
    if (est.atual) est.atual.alteradaEm = new Date().toISOString();
    setSalvando('pendente'); bump();
    clearTimeout(timer.current); timer.current = setTimeout(salvarJa, 800);
  }, [salvarJa]);
  useEffect(() => () => { if (timer.current){ clearTimeout(timer.current); if (est.atual) gravarEscala(est.atual).catch(() => {}); } }, []);
  useEffect(() => { const f = ev => { if (timer.current){ ev.preventDefault(); ev.returnValue = ''; } }; addEventListener('beforeunload', f); return () => removeEventListener('beforeunload', f); }, []);
  const sair = async () => { if (timer.current) await salvarJa(); voltar(); };

  if (!e) return null;
  // corrige nomes lidos antes da correção do leitor (ex.: "QPPMV" grudado no nome)
  const A = L.analisarACO(e);
  const ba = L.blocoAtivo(e);
  const minha = L.minhaEscala(e);

  /* ---------- importação dos PDFs ---------- */
  const importar = async files => {
    if (lendo) return;
    const lista = [...files].filter(f => /\.pdf$/i.test(f.name) || f.type === 'application/pdf');
    if (!lista.length){ alert('Selecione arquivos em PDF.'); return; }
    try {
      for (let i = 0; i < lista.length; i++){
        const f = lista[i];
        setLendo({ i, total: lista.length, frac: 0, nome: f.name });
        let linhas;
        try { linhas = await lerPdf(f, fr => setLendo({ i, total: lista.length, frac: fr, nome: f.name })); }
        catch (err){ console.error(err); e.rp.push({ id: uid(), nome: f.name, tipo: 'erro', erro: 'Não consegui ler este PDF (' + err.message + ')', linhas: [] }); continue; }
        if (!linhas.length){ e.rp.push({ id: uid(), nome: f.name, tipo: 'erro', erro: 'PDF sem texto (provavelmente escaneado como imagem)', linhas: [] }); continue; }
        if (L.grupoAlmanaque(linhas)){
          if (!ehAdmin){ alert(`"${f.name}" é um almanaque. Só o administrador pode trocar os almanaques.`); continue; }
          try { const r = await salvarAlmanaque(f.name, linhas, perfil, registrar); avisar(`Almanaque de ${L.NOMES_ALM[r.grupo]}: ${r.qtd} policiais`); } catch (err){ avisar(err.message, 'err'); }
          continue;
        }
        const qtd = L.pessoasDe(linhas, true).length;
        if (qtd > 80) e.efetivo = { arquivo: f.name, importadoEm: new Date().toISOString(), linhas, qtd };
        else e.rp.push({ id: uid(), nome: f.name, tipo: 'escala', linhas, secoes: L.segmentar(linhas, f.name), importadoEm: new Date().toISOString() });
        bump();
      }
      avisar(`${lista.length} arquivo(s) importado(s)`);
      registrar('arquivo', `importou ${lista.length} arquivo(s) na ${L.descEscala(e)}: ${lista.map(f => f.name).join(', ')}`);
    } finally { setLendo(null); alterou(); }
  };

  /* ---------- escalar / trocar ---------- */
  const ativarBloco = b => { if (e.blocoAtivo === b.id) return; e.blocoAtivo = b.id; setTrocando(null); if (dispRef.current) dispRef.current.scrollTop = 0; bump(); };
  const escalar = p => {
    const dados = { k: p.k, posto: p.posto, rg: p.rg || '', nome: p.nomeExib || p.nome, guerra: [], matricula: p.matricula, cpf: p.cpf };
    let alvoId, bloco;
    if (trocando){
      bloco = e.blocos.find(b => b.pessoas.some(x => x.id === trocando));
      const r = bloco?.pessoas.find(x => x.id === trocando);
      if (r){ Object.assign(r, dados); alvoId = r.id; }
      setTrocando(null);
    } else { alvoId = uid(); bloco = ba; bloco.pessoas.push({ id: alvoId, ...dados, ...L.tipoParaPessoa(bloco.tipo || 'c') }); }
    if (bloco) L.ordenarBloco(bloco);
    setDestaque(alvoId); setTimeout(() => setDestaque(d => d === alvoId ? null : d), 1600);
    alterou();
  };

  /* ---------- copiar para outra data ---------- */
  const duplicar = async () => {
    const sug = e.data >= hojeISO() ? L.somaDias(e.data, 1) : hojeISO();
    const r = prompt('Data da nova escala (dd/mm/aaaa):', dataBR(sug)); if (!r) return;
    const iso = L.detectarData([r], '');
    if (!iso){ alert('Data inválida.'); return; }
    if (iso < hojeISO()){ alert('Escolha hoje ou uma data à frente.'); return; }
    if (timer.current) await salvarJa();
    const delta = Math.round((new Date(iso + 'T12:00') - new Date(e.data + 'T12:00')) / 864e5);
    const c = JSON.parse(JSON.stringify(e));
    Object.assign(c, { id: novoId(), autorId: perfil.id, autor: perfil.nome || '', data: iso, criadaEm: new Date().toISOString(), alteradaEm: new Date().toISOString(), liberados: [] });
    ['ultimoPdf', 'pdfs', 'contabilizado', 'contabilizadoEm', 'snapBlocos'].forEach(k => delete c[k]);
    c.blocos.forEach(b => { b.id = uid(); b.data = L.somaDias(b.data, delta); b.pessoas.forEach(p => p.id = uid()); });
    c.blocoAtivo = c.blocos[0].id; c.doc.numero = L.proximoNumero(iso); c.doc.dataDoc = hojeISO();
    try {
      await gravarEscala(c); est.escalas.push(c);
      registrar('aco', `copiou a ACO Nº ${e.doc.numero} para ${dataBR(iso)}, criando a ${L.descEscala(c)}`);
      await abrir(c.id);
      const prob = c.blocos.reduce((n, b) => { const A2 = L.analisarACO(c, b.data); return n + b.pessoas.filter(x => L.linhaBloqueada(x, A2)).length; }, 0);
      if (prob) avisar(`${prob} pessoa(s) desta cópia está(ão) de RP na nova data — marcadas em vermelho`, 'warn');
    } catch (err){ avisar('Não consegui copiar: ' + err.message, 'err'); }
  };

  const excluirEscala = async () => {
    if (!confirm(`Mover a escala Nº ${e.doc.numero} de ${dataBR(e.data)} para Excluídas?\n\nEla deixa de bloquear pessoas nas outras escalas e pode ser restaurada em até 1 dia. Depois disso, some do sistema.`)) return;
    try {
      if (timer.current) await salvarJa();
      await moverParaLixeira(e, perfil.nome || '');
      registrar('exclusao', `excluiu a ${L.descEscala(e)} (enviada para Excluídas)`);
      avisar(`Escala Nº ${e.doc.numero} movida para Excluídas`);
      voltar();
    } catch (err){ avisar(err.message, 'err'); }
  };

  /* ---------- gerar PDF ---------- */
  const gerarPdf = async () => {
    let x = e;
    let blocos = L.blocosParaPdf(x);
    if (!blocos.length){ alert('Adicione pelo menos uma pessoa na escala.'); return; }
    if (blocos.some(b => !b.data)){ alert('Todos os blocos precisam de data.'); return; }
    if (blocos.some(b => !b.local)){ alert('Selecione a cidade de todos os blocos.'); return; }
    const prob = [];
    blocos.forEach(b => { const A2 = L.analisarACO(x, b.data); b.pessoas.filter(r => L.linhaBloqueada(r, A2)).forEach(r => prob.push(`• ${[r.posto, r.nome].filter(Boolean).join(' ')} (${dataBR(b.data)}${b.local ? ' – ' + b.local : ''})`)); });
    if (prob.length){ alert('Não dá para gerar: estas pessoas estão de RP ou já escaladas em outra ACO na data:\n\n' + prob.join('\n') + '\n\nTroque (⇄) ou remova da escala.'); return; }
    const semGuerra = blocos.flatMap(b => b.pessoas).filter(r => !(r.guerra || []).length).length;
    if (semGuerra && !confirm(`${semGuerra} pessoa(s) estão sem o nome de guerra marcado (negrito). Gerar assim mesmo?`)) return;
    const resp = await new Promise(resolve => setGerar({ resolve }));
    setGerar(null);
    if (!resp) return;
    setGerando(true);
    try {
      if (resp.modo === 'nova'){
        const antiga = L.blocosGerados(x), conflito = [];
        blocos.forEach(b => b.pessoas.forEach(r => { const k = L.chavePessoa(r); if (antiga.some(a => a.data === b.data && a.pessoas.some(y => L.chavePessoa(y) === k))) conflito.push(`• ${[r.posto, r.nome].filter(Boolean).join(' ')} (${dataBR(b.data)})`); }));
        if (conflito.length){ alert(`Não dá para gerar como nova ACO: estes policiais já estão na ACO Nº ${x.doc.numero} no mesmo dia (só pode uma ACO por dia):\n\n${conflito.join('\n')}\n\nMude a data, troque os policiais ou gere como correção.`); return; }
        const c = JSON.parse(JSON.stringify(x));
        Object.assign(c, { id: novoId(), criadaEm: new Date().toISOString(), alteradaEm: new Date().toISOString(), autorId: perfil.id, autor: perfil.nome || '', liberados: [] });
        ['contabilizado', 'contabilizadoEm', 'ultimoPdf', 'pdfs', 'snapBlocos'].forEach(k => delete c[k]);
        c.blocos.forEach(b => { b.id = uid(); b.pessoas.forEach(r => r.id = uid()); }); c.blocoAtivo = c.blocos[0]?.id;
        c.doc.numero = L.proximoNumero(c.data);
        x.blocos = antiga; x.blocoAtivo = antiga[0]?.id;
        await gravarEscala(x);
        est.escalas.push(c); est.atual = c;
        registrar('aco', `gerou uma nova ACO a partir da ACO Nº ${x.doc.numero}: criou a ${L.descEscala(c)}`);
        x = c; blocos = L.blocosParaPdf(x);
      }
      x.doc.obsFinal = resp.obs;
      const bytes = await gerarBytesACO(x, blocos);
      const nome = L.nomeArquivoACO(x);
      baixar(nome, bytes);
      x.ultimoPdf = new Date().toISOString(); x.pdfs = [...new Set([...(x.pdfs || []), nome])];
      // contabiliza quem tirou a ACO (gerar de novo a mesma escala não conta em dobro: substitui)
      x.contabilizado = blocos.flatMap(b => b.pessoas.map(r => L.itemContab(r, b)));
      x.snapBlocos = JSON.parse(JSON.stringify(x.blocos));
      x.contabilizadoEm = new Date().toISOString();
      x.alteradaEm = new Date().toISOString();
      await gravarEscala(x);
      await gravarHistorico(x);
      registrar('pdf', `${resp.modo === 'corr' ? 'gerou de novo (correção) o PDF' : 'gerou o PDF'} da ${L.descEscala(x)}: ${x.contabilizado.length} policial(is)${x.contabilizado.some(i => i.meia) ? ` (${x.contabilizado.filter(i => i.meia).length} meia ACO)` : ''} em ${[...new Set(blocos.map(b => `${L.nomeCidade(b.local)} ${dataBR(b.data).slice(0, 5)}`))].join(', ')}`);
      avisar('PDF gerado');
      if (x !== e) await abrir(x.id); else bump();
    } catch (err){ console.error(err); alert('Erro ao gerar o PDF: ' + err.message); avisar('Erro ao gerar PDF', 'err'); }
    finally { setGerando(false); }
  };

  /* ---------- telas ---------- */
  const selo = L.rotuloData(e.data);
  const contaArq = e.rp.length + (e.efetivo ? 1 : 0);
  const velho = a => a.tipo === 'escala' && L.secoesDe(a).every(s => s.data && (L.diasBloqueio(s).pop() || s.data) < hojeISO());
  const antigos = e.rp.filter(velho).length;
  const cfgL = L.cfgACO(), stAco = L.estatisticasACO(cfgL.periodo).mapa;
  const trocandoP = trocando && L.todasPessoas(e).find(p => p.id === trocando);

  return (<>
    <div className="aco-topo">
      <button className="btn peq" onClick={sair}>← Escalas</button>
      <h2>{e.tipo === 'compulsoria' ? 'Escala ACO Compulsória' : 'Escala ACO Voluntária'}</h2>
      <label className="aco-data">Data da escala <input type="date" min={hojeISO()} value={e.data || ''} onChange={ev => {
        const v = ev.target.value; if (!v) return;
        if (v < hojeISO() && !confirm('Essa data já passou. Usar mesmo assim?')) return;
        const antiga = e.data; e.data = v; e.blocos.forEach(b => { if (b.data === antiga) b.data = v; }); alterou();
      }} /></label>
      <span className={'selo' + (selo === 'Hoje' ? ' hoje' : '')}>{selo}</span>
      <span className="dica salvo-ind">{salvando === 'salvando' ? 'Salvando…' : salvando === 'pendente' ? 'Alterações não salvas…' : salvando === 'erro' ? '⚠ Não salvou' : '✓ Salvo'}</span>
      <div className="dir">
        <button className="btn peq" onClick={duplicar} title="Criar outra escala igual para outra data">Copiar p/ outra data</button>
        {minha && <button className="btn peq perigo" onClick={excluirEscala} title="Move a escala para Excluídas">Excluir</button>}
        <button className="btn ouro" onClick={gerarPdf} disabled={gerando}><Ic n="doc" t={16} />{gerando ? 'Gerando…' : 'Gerar PDF'}</button>
      </div>
    </div>

    <details className="card" open={e.tipo === 'compulsoria' || contaArq > 0}>
      <summary><h3>1. Arquivos importados</h3><span className="dica">{`${e.rp.filter(a => a.tipo === 'escala').length} escala(s) de RP` + (e.efetivo ? ` · relação geral com ${A.ef.length} pessoas` : ' · sem relação geral')}</span></summary>
      <p className="dica" style={{ margin: '0 0 10px' }}>Os arquivos valem só <b>para esta escala</b> — cada escala nova começa zerada. Cada bloco bloqueia quem está de RP <b>na data dele</b>; listas de datas anteriores não bloqueiam ninguém.</p>
      <div className={'drop' + (sobre ? ' sobre' : '') + (lendo ? ' lendo' : '')}
        onDragEnter={ev => { ev.preventDefault(); setSobre(true); }} onDragOver={ev => { ev.preventDefault(); setSobre(true); }}
        onDragLeave={ev => { ev.preventDefault(); setSobre(false); }} onDrop={ev => { ev.preventDefault(); setSobre(false); if (ev.dataTransfer.files.length) importar(ev.dataTransfer.files); }}>
        <Ic n="backup" t={34} />
        <div><b className="so-pc">Arraste os PDFs aqui ou </b><button className="btn peq pri" onClick={() => inpArq.current.click()} disabled={!!lendo}>Selecionar arquivos</button></div>
        <div className="dica">Escalas de RP e a relação geral do efetivo (reconhecida sozinha por ter mais de 80 pessoas). Nenhum é obrigatório.</div>
      </div>
      <div className="prog">
        <div className="prog-seg">{[0, 1, 2, 3, 4].map(j => <i key={j}><b style={{ width: (j < contaArq ? 100 : (lendo && j === contaArq ? Math.round(lendo.frac * 100) : 0)) + '%' }} /></i>)}</div>
        <div className="prog-txt">{lendo ? <><span className="spinner" /> {`Lendo ${lendo.i + 1} de ${lendo.total}: ${lendo.nome} (${Math.round(lendo.frac * 100)}%)`}</> : contaArq ? `${contaArq} arquivo(s) importado(s)` : 'Nenhum arquivo importado. Nenhum é obrigatório.'}</div>
      </div>
      <input type="file" ref={inpArq} accept=".pdf,application/pdf" multiple hidden onChange={ev => { const f = ev.target.files; if (f.length) importar(f); ev.target.value = ''; }} />
      <Arquivos e={e} A={A} alterou={alterou} registrar={registrar} />
      {antigos > 0 && <button className="btn peq" style={{ marginTop: 10 }} onClick={() => { if (confirm(`Remover ${antigos} arquivo(s) de RP com todas as datas anteriores a hoje?`)){ e.rp = e.rp.filter(a => !velho(a)); alterou(); } }}>{`Limpar ${antigos} arquivo(s) de datas anteriores`}</button>}
    </details>

    <div className="card">
      <h3>2. Situação por data</h3>
      <div className="chips">
        <div className="chip"><b>{A.ef.length || '—'}</b>na relação geral</div>
        <div className="chip vermelho"><b>{A.bloqueados.length}</b>{`de RP em ${dataBR(L.dataAtiva(e)) || '?'}`}</div>
        <div className="chip verde"><b>{A.disponiveis.length}</b>disponíveis</div>
        <div className="chip ouro"><b>{L.todasPessoas(e).length}</b>nesta escala</div>
      </div>
      <SituacaoDatas e={e} A={A} abertas={abertas} setAbertas={setAbertas} />
    </div>

    <div className="aco-grid">
      <div className="card aco-disp">
        <div className="disp-topo">
          <h3>3. Disponíveis <small style={{ color: 'var(--muted)', fontWeight: 400 }}>{A.ef.length ? `(${A.disponiveis.length})` : ''}</small></h3>
          <input ref={buscaRef} value={busca} onChange={ev => setBusca(ev.target.value)} placeholder="🔍 Buscar por nome, posto, matrícula ou CPF" />
        </div>
        <div className="disp-blocos"><span className="ctx">Toque numa pessoa para escalar no bloco:</span>
          <div>{e.blocos.map(b => (
            <button key={b.id} className={'chip-bloco' + (b === ba ? ' ativo' : '')} title="Escalar neste bloco" onClick={() => ativarBloco(b)}>
              <b>{b.local ? L.nomeCidade(b.local) : 'Sem cidade'}</b><span>{`${dataBR(b.data).slice(0, 5)} · ${diaSemana(b.data).split('-')[0]}`}</span><em>{b.pessoas.length}</em>
            </button>))}</div>
        </div>
        {trocandoP && <div className="aviso"><span>{`Escolha quem vai substituir ${[trocandoP.posto, trocandoP.nome].filter(Boolean).join(' ')}.`}</span> <button className="btn peq" onClick={() => setTrocando(null)}>Cancelar</button></div>}
        <div className="aco-pessoas" ref={dispRef}>
          {!A.ef.length ? <div className="vazio">Importe a relação geral do efetivo (PDF com mais de 80 pessoas) para listar quem está disponível. Você também pode adicionar manualmente na escala.</div>
            : <ListaDisponiveis A={A} busca={busca} escalar={escalar} trocando={!!trocandoP} cfgL={cfgL} stAco={stAco} />}
        </div>
        <details className="aco-bloq"><summary>{`Bloqueados — de RP em ${dataBR(L.dataAtiva(e)) || '?'} (${A.bloqueados.length})`}</summary>
          <div>
            {A.bloqueados.map(b => (
              <div className="pes bl" key={b.p.k}>
                <span className="pg">{b.p.posto || '—'}</span>
                <div className="nm"><b>{b.p.nomeExib || b.p.nome}</b><small>{b.arquivos.join(', ') + (b.tipo === 'aproximado' ? ' · encontrado por nome aproximado' : b.tipo === 'fora' ? ' · não localizado na relação geral' : b.tipo === 'aco' ? ' · já escalado em outra ACO' : '')}</small></div>
                <button className="btn peq" title="Use só se o sistema leu errado" onClick={() => {
                  if (!confirm(`${b.p.nome} aparece na escala de RP de ${dataBR(L.dataAtiva(e))}. A regra não permite escalar quem está de RP.\n\nLiberar só se tiver certeza de que o sistema leu errado.`)) return;
                  e.liberados.push(L.dataAtiva(e) + '|' + b.p.k); registrar('aco', `liberou manualmente ${b.p.posto} ${b.p.nomeExib || b.p.nome} (estava de RP em ${dataBR(L.dataAtiva(e))}) na ${L.descEscala(e)}`); alterou();
                }}>Liberar</button>
              </div>))}
            {A.liberadosLista.map(b => (
              <div className="pes bl" key={'l' + b.p.k}>
                <span className="pg">{b.p.posto || '—'}</span>
                <div className="nm"><b>{b.p.nomeExib || b.p.nome}</b><small>Liberado manualmente</small></div>
                <button className="btn peq" onClick={() => { e.liberados = e.liberados.filter(k => k !== L.dataAtiva(e) + '|' + b.p.k); alterou(); }}>Bloquear de novo</button>
              </div>))}
            {!A.bloqueados.length && !A.liberadosLista.length && <div className="dica" style={{ padding: 6 }}>Ninguém bloqueado nesta data.</div>}
          </div>
        </details>
      </div>

      <div className="aco-dir">
        <div className="card">
          <h3>4. Blocos da escala</h3>
          <p className="dica" style={{ margin: '-6px 0 12px' }}>Cada bloco vira, no PDF, uma faixa preta com a data e uma tabela com o local. Toque num bloco para escalar pessoas nele. No nome, toque nas palavras do <b>nome de guerra</b> para sair em negrito.</p>
          {e.blocos.map((b, bi) => <Bloco key={b.id} e={e} b={b} bi={bi} ativo={b === ba} ativar={() => ativarBloco(b)} alterou={alterou}
            trocando={trocando} setTrocando={id => { ativarBloco(b); setTrocando(t => t === id ? null : id); if (id) setTimeout(() => buscaRef.current?.focus(), 0); }}
            destaque={destaque} abrirAntig={r => setAntig({ r })} />)}
          <button className="btn" onClick={() => {
            const ult = e.blocos[e.blocos.length - 1];
            const b = L.novoBloco(ult?.data || e.data, { inicio: ult?.inicio });
            e.blocos.push(b); e.blocoAtivo = b.id; setTrocando(null); alterou();
          }}>+ Novo bloco (outra cidade ou data)</button>
        </div>
        <details className="card">
          <summary><h3>5. Texto do documento</h3><span className="dica">cabeçalho, operação, uniforme, armamento, observações e assinatura</span></summary>
          <div className="aco-form">
            {CAMPOS_DOC.map(([k, rot, cls, ph, linhas, tipo]) => (
              <label key={k} className={cls}>{rot}
                {k === 'obs' && <span className="dica"> uma por linha (viram a, b, c…) · use **texto** para negrito</span>}
                {k === 'signatario' && <span className="dica"> **negrito**</span>}
                {linhas ? <textarea rows={linhas} value={e.doc[k] || ''} onChange={ev => { e.doc[k] = ev.target.value; alterou(); }} />
                  : <input type={tipo || 'text'} placeholder={ph || ''} value={e.doc[k] || ''} onChange={ev => { e.doc[k] = ev.target.value; alterou(); }} />}
                {k === 'numero' && <span className="dica">Usado no nome do arquivo: <b>{`ACO Nº ${e.doc.numero || '??'}-${(e.data || hojeISO()).slice(0, 4)} - ${L.MESES_NOME[+(e.data || hojeISO()).slice(5, 7) - 1]}`}</b></span>}
              </label>))}
          </div>
        </details>
      </div>
    </div>

    {gerar && <DialogoGerar e={e} fim={v => gerar.resolve(v)} alterou={alterou} />}
    {antig && <DialogoAntiguidade e={e} r={antig.r} fechar={() => { setAntig(null); e.blocos.forEach(L.ordenarBloco); alterou(); }} />}
  </>);
}

/* ---------- arquivos importados ---------- */
function Arquivos({ e, A, alterou, registrar }){
  const dMax = a => a.tipo === 'escala' ? L.secoesDe(a).map(x => x.fim || x.data || '').sort().pop() || '' : '';
  const ordenados = e.rp.slice().sort((a, b) => dMax(b).localeCompare(dMax(a)));
  return (<div>
    {e.efetivo && (
      <div className="arq">
        <div className="ic-arq" style={{ background: '#1d6f42' }}>REL</div>
        <div className="nm"><b>{e.efetivo.arquivo}</b><small>{`Relação geral do efetivo · ${A.ef.length} pessoas · importada em ${new Date(e.efetivo.importadoEm).toLocaleString('pt-BR')}`}</small></div>
        <span className="tg ef">Relação geral</span>
        <button className="btn peq perigo" onClick={() => { if (confirm('Remover a relação geral do efetivo desta escala?')){ registrar('arquivo', `removeu a relação geral "${e.efetivo.arquivo}" da ${L.descEscala(e)}`); e.efetivo = null; alterou(); } }}>Remover</button>
      </div>)}
    {ordenados.map(a => {
      const remover = <button className="btn peq perigo" onClick={() => { e.rp = e.rp.filter(x => x !== a); registrar('arquivo', `removeu o arquivo "${a.nome}" da ${L.descEscala(e)}`); alterou(); }}>Remover</button>;
      if (a.tipo === 'erro') return <div className="arq erro" key={a.id}><div className="ic-arq">PDF</div><div className="nm"><b>{a.nome}</b><small>{a.erro}</small></div>{remover}</div>;
      const secoes = L.secoesDe(a);
      return (
        <div className="arq" key={a.id}>
          <div className="ic-arq">PDF</div>
          <div className="nm"><b>{a.nome}</b><small>{`Escala de RP · ${secoes.length} data(s)` + (A.ef.length ? '' : ' · importe a relação geral para cruzar')}</small>
            {secoes.map((sec, i) => {
              const R = A.res.get(a.id + '#' + i) || { r: {}, pessoas: [] };
              const dias = L.diasBloqueio(sec);
              let tag;
              if (!sec.data) tag = <span className="tg av">Sem data — informe</span>;
              else if (dias.includes(L.dataAtiva(e))) tag = <span className="tg bloq">Bloqueia nesta escala</span>;
              else if (sec.fim && sec.fim === L.dataAtiva(e)) tag = <span className="tg lib">Termina neste dia — liberados</span>;
              else if (dias[dias.length - 1] < hojeISO()) tag = <span className="tg lib">Data anterior — liberados</span>;
              else tag = <span className="tg">{'Bloqueia só ' + dias.map(d => dataBR(d).slice(0, 5)).join(', ')}</span>;
              const ne = R.r.naoEnc || [];
              return (
                <div className="sec" key={i}>
                  <input type="date" value={sec.data || ''} title="Início do serviço" onChange={ev => { sec.data = ev.target.value; alterou(); }} />
                  <span className="sec-txt">até</span>
                  <input type="date" value={sec.fim || ''} title="Fim do serviço (dia em que a pessoa é liberada). Deixe vazio se for só um dia." onChange={ev => { sec.fim = ev.target.value; alterou(); }} />
                  <span className="sec-txt">{`${R.pessoas.length} ${A.ef.length ? 'pessoa(s) localizada(s) na relação geral' : 'nome(s) lido(s)'}` + (sec.fim ? ` · liberados em ${dataBR(sec.fim)}` : '')}</span>
                  {tag}
                  {ne.length > 0 && <details className="ne"><summary>{`⚠ ${ne.length} nome(s) não achados na relação geral`}</summary><div className="ne-lista">{ne.map((t, j) => <div key={j}>{t}</div>)}</div></details>}
                </div>);
            })}
          </div>
          <select title="Tipo do arquivo" value="escala" onChange={ev => { if (ev.target.value === 'efetivo' && confirm('Usar este arquivo como relação geral do efetivo?')){ e.efetivo = { arquivo: a.nome, importadoEm: new Date().toISOString(), linhas: a.linhas }; e.rp = e.rp.filter(x => x !== a); alterou(); } }}>
            <option value="escala">Escala de RP</option><option value="efetivo">É a relação geral</option>
          </select>
          {remover}
        </div>);
    })}
  </div>);
}

/* ---------- situação por data ---------- */
function SituacaoDatas({ e, A, abertas, setAbertas }){
  const datas = [...A.porData.keys()].sort().reverse();
  if (!datas.length) return <p className="dica">Importe as escalas de RP para ver quem está de serviço e quem está de folga em cada data.</p>;
  const nomes = arr => arr.slice().sort(L.porPatente).map((p, i) => <div key={i}>{[p.posto, p.nome].filter(Boolean).join(' ')}</div>);
  return (
    <div className="rolar-x"><table className="tab-datas">
      <thead><tr><th>Data</th><th>Arquivos</th><th>De RP (serviço)</th><th>De folga</th><th></th></tr></thead>
      <tbody>{datas.map(d => {
        const pd = A.porData.get(d), folga = A.ef.filter(p => !pd.mapa.has(p.k)), aberto = abertas.has(d);
        return [
          <tr key={d}>
            <td><b>{dataBR(d) + ' '}</b><small>{diaSemana(d) + ' '}</small>
              {d === L.dataAtiva(e) && <span className="tg bloq">data desta escala</span>}
              {d === hojeISO() ? <span className="tg ef">hoje</span> : d < hojeISO() ? <span className="tg lib">anterior</span> : null}</td>
            <td>{pd.arquivos.join(', ')}</td><td>{pd.mapa.size}</td><td>{A.ef.length ? folga.length : '—'}</td>
            <td><button className="btn peq" onClick={() => setAbertas(s => { const n = new Set(s); aberto ? n.delete(d) : n.add(d); return n; })}>{aberto ? 'Ocultar' : 'Ver nomes'}</button></td>
          </tr>,
          aberto && <tr className="det" key={d + 'd'}><td colSpan={5}><div className="nomes2">
            <div><b>{`De RP (${pd.mapa.size})`}</b>{nomes([...pd.mapa.values()])}</div>
            <div><b>{`De folga (${A.ef.length ? folga.length : '—'})`}</b>{A.ef.length ? nomes(folga) : <div className="dica">Importe a relação geral para ver quem está de folga.</div>}</div>
          </div></td></tr>];
      })}</tbody>
    </table></div>);
}

/* ---------- disponíveis (em ordem de patente) ---------- */
function ListaDisponiveis({ A, busca, escalar, trocando, cfgL, stAco }){
  const q = norm(busca), qd = q.replace(/\D/g, '');
  let lista = A.disponiveis;
  if (q) lista = lista.filter(p => (p.posto + ' ' + p.nome).includes(q) || (qd.length >= 3 && ((p.cpf || '').includes(qd) || (p.matricula || '').includes(qd))));
  if (!lista.length) return <div className="vazio">Ninguém encontrado.</div>;
  const max = 400, out = []; let grupo = null;
  lista.slice(0, max).forEach(p => {
    if (p.ordem !== grupo){ grupo = p.ordem; out.push(<div className="grupo-pat" key={'g' + grupo}>{L.PATENTES[p.ordem] || 'Outros'}</div>); }
    const n = stAco.get(L.chavePessoa(p))?.total || 0;
    out.push(
      <div className="pes" key={p.k} title="Toque para escalar" onClick={() => escalar(p)}>
        <span className="pg">{p.posto || '—'}</span>
        {n ? <span className={'aco-qt ' + L.nivelACO(n)} title={`${L.fN(n)} ACO(s) ${L.NOME_PER[cfgL.periodo]} — limite ${cfgL.max}`}>{n >= cfgL.aviso ? `⚠ ${L.fN(n)}/${cfgL.max}` : L.fN(n) + ' ACO'}</span> : null}
        <div className="nm"><b>{p.nomeExib || p.nome}</b><small>{[L.rotAntig(L.antiguidade(p)), p.matricula && 'Mat. ' + p.matricula, p.cpf && 'CPF ' + L.mascararCpf(p.cpf)].filter(Boolean).join(' · ')}</small></div>
        <button className="add" title={trocando ? 'Substituir' : 'Escalar'}>{trocando ? '⇄' : '+'}</button>
      </div>);
  });
  if (lista.length > max) out.push(<div className="dica" key="mais" style={{ padding: 8 }}>{`Mostrando ${max} de ${lista.length}. Use a busca para encontrar os demais.`}</div>);
  return out;
}

/* ---------- um bloco da escala ---------- */
function Bloco({ e, b, bi, ativo, ativar, alterou, trocando, setTrocando, destaque, abrirAntig }){
  const { ehAdmin } = useSessao();
  L.ordenarBloco(b);
  const A = L.analisarACO(e, b.data);
  const mover = d => { const j = bi + d; if (j < 0 || j >= e.blocos.length) return; [e.blocos[bi], e.blocos[j]] = [e.blocos[j], e.blocos[bi]]; alterou(); };
  const conferirFim = valor => {
    const ini = L.iniBloco(b), fim = L.minDe(valor);
    if (fim == null) return;
    let dur = ((fim - ini) % 1440 + 1440) % 1440; if (dur === 0) dur = 1440;
    let tipo;
    if (dur === 360) tipo = 'm'; else if (dur === 720) tipo = 'c'; else if (dur < 480) tipo = 'm'; else if (dur > 480) tipo = 'c';
    else tipo = confirm(`Das ${L.hm(ini)} às ${L.hm(fim)} dá 8h — fica no meio entre a meia ACO (6h) e a ACO completa (12h).\n\nOK = ACO completa (12h): das ${L.hm(ini)} às ${L.hm(ini + 720)}\nCancelar = Meia ACO (6h): das ${L.hm(ini)} às ${L.hm(ini + 360)}`) ? 'c' : 'm';
    const certo = ini + (tipo === 'c' ? 720 : 360);
    L.aplicarTipoBloco(b, tipo); alterou();
    if (dur !== 360 && dur !== 720 && dur !== 480){
      const hs = m => (m / 60).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
      alert(`A ACO só pode ter 6 horas (meia) ou 12 horas (completa).\n\nDas ${L.hm(ini)} às ${L.hm(fim)} dá ${hs(dur)}h.\nAjustado para ${tipo === 'c' ? 'ACO completa (12h)' : 'meia ACO (6h)'}: das ${L.hm(ini)} às ${L.hm(certo)}.`);
    }
  };
  const pes = b.pessoas.filter(r => r.nome);
  let ordemInfo;
  if (!L.indiceAlmanaque().size) ordemInfo = <span className="ordem-auto sem-alm" title={'Sem os almanaques, dentro do mesmo posto a ordem fica alfabética. ' + (ehAdmin ? 'Importe-os na tela inicial da Escala de ACO.' : 'Peça ao administrador para importar os almanaques.')}>⚠ Almanaques não carregados: ordem só por patente (antiguidade não conferida)</span>;
  else {
    const fora = pes.filter(r => !L.antiguidade(r)), man = pes.filter(r => !L.antigAlmanaque(r) && L.antigManual(r)).length;
    if (fora.length) ordemInfo = <span className="ordem-auto sem-alm" title={'Não encontrados no almanaque (ficam no fim do seu posto):\n' + fora.map(r => `${r.posto} ${r.nome}`).join('\n')}>{`⇅ Patente → antiguidade · ⚠ ${fora.length} fora do almanaque — toque em “definir antiguidade” no nome`}</span>;
    else if (man) ordemInfo = <span className="ordem-auto">{`⇅ Ordem automática: patente → antiguidade ✓ (${man} definida${man > 1 ? 's' : ''} manualmente)`}</span>;
    else ordemInfo = <span className="ordem-auto">⇅ Ordem automática: patente → antiguidade ✓</span>;
  }
  return (
    <div className={'bloco' + (ativo ? ' ativo' : '')} onClick={ativar} onFocus={ativar}>
      <div className="bloco-faixa">
        <input type="date" value={b.data || ''} title="Data deste bloco" onChange={ev => {
          const v = ev.target.value; if (!v) return;
          if (v < hojeISO() && !confirm('Essa data já passou. Usar mesmo assim?')) return;
          b.data = v; alterou(); }} />
        <span>{diaSemana(b.data)}</span>
        <span className="recebe">◀ recebendo da lista</span>
      </div>
      <div className="bloco-cab">
        <label>Cidade <SeletorCidade b={b} alterou={alterou} /></label>
        <label>ACO <select className={'tipo-aco' + (b.tipo !== 'c' ? ' meia' : '')} value={b.tipo === 'c' ? 'c' : 'm'} title="ACO completa (12h) ou meia ACO (6h) — vale para todos do bloco" onClick={ev => ev.stopPropagation()} onChange={ev => { L.aplicarTipoBloco(b, ev.target.value); alterou(); }}>
          <option value="c">ACO completa · 12h</option><option value="m">Meia ACO · 6h</option></select></label>
        <label>Das <input type="time" className="ini-turno" value={b.inicio || '08:00'} onChange={ev => { b.inicio = ev.target.value || '08:00'; L.aplicarTipoBloco(b, b.tipo); alterou(); }} /></label>
        <label>Às <input type="time" className="fim-turno" key={b.inicio + b.tipo} defaultValue={L.hInput(L.iniBloco(b) + L.durBloco(b))} onBlur={ev => conferirFim(ev.target.value)} /></label>
        <div className="bloco-ac">
          <button className="btn peq" title="Mover bloco para cima" onClick={() => mover(-1)}>↑</button>
          <button className="btn peq" title="Mover bloco para baixo" onClick={() => mover(1)}>↓</button>
          <button className="btn peq perigo" title="Excluir bloco" onClick={ev => { ev.stopPropagation(); if (e.blocos.length === 1){ alert('A escala precisa de pelo menos um bloco.'); return; } if (b.pessoas.length && !confirm(`Excluir o bloco ${b.local || ''} com ${b.pessoas.length} pessoa(s)?`)) return; e.blocos = e.blocos.filter(x => x !== b); if (e.blocoAtivo === b.id) e.blocoAtivo = e.blocos[0].id; alterou(); }}>✕</button>
        </div>
      </div>
      <div className="hor-calc">Horário no PDF: <b>{L.horarioPessoa(b, L.tipoParaPessoa(b.tipo))}</b> — vale para todos deste bloco</div>
      <div className="tabela-esc"><table>
        <thead><tr><th>POST/GRAD.</th><th>RG</th><th>NOME · toque no nome de guerra</th><th>MATR.</th><th></th></tr></thead>
        <tbody>
          {!b.pessoas.length && <tr><td colSpan={5} className="vazio">{ativo ? 'Toque em alguém da lista de disponíveis ou em “Adicionar manualmente”.' : 'Toque neste bloco para escalar pessoas nele.'}</td></tr>}
          {b.pessoas.map(r => <LinhaPessoa key={r.id} e={e} b={b} r={r} A={A} alterou={alterou} trocando={trocando} setTrocando={setTrocando} destaque={destaque === r.id} abrirAntig={abrirAntig} />)}
        </tbody>
      </table></div>
      <div className="bloco-rod">
        <button className="btn peq" onClick={ev => { ev.stopPropagation(); ativar(); b.pessoas.push({ id: uid(), k: '', posto: '', rg: '', nome: '', guerra: [], matricula: '', cpf: '', ...L.tipoParaPessoa(b.tipo || 'c') }); b._novo = true; alterou(); }}>+ Adicionar manualmente</button>
        {ordemInfo}
        <span className="dica">{`${b.pessoas.length} policial(is)`}</span>
      </div>
    </div>);
}

function SeletorCidade({ b, alterou }){
  const conhecida = !b.local || L.CIDADES.some(c => c[1] === b.local);
  return (
    <select className="sel-cidade" value={b.local || ''} onChange={ev => {
      let v = ev.target.value;
      if (v === '__outra'){ v = (prompt('Nome do local como deve sair no PDF:', b.local || '') || '').trim().toUpperCase(); if (!v) return; }
      b.local = v; alterou();
    }}>
      <option value="">— selecione a cidade —</option>
      {L.CIDADES.map(([n, pdf]) => <option key={pdf} value={pdf}>{n}</option>)}
      {!conhecida && <option value={b.local}>{b.local}</option>}
      <option value="__outra">Outro local…</option>
    </select>);
}

function LinhaPessoa({ e, b, r, A, alterou, trocando, setTrocando, destaque, abrirAntig }){
  const bloqueada = L.linhaBloqueada(r, A);
  const primeiro = useRef();
  useEffect(() => { if (b._novo && b.pessoas[b.pessoas.length - 1] === r && !r.nome){ delete b._novo; primeiro.current?.focus(); } }, []);
  const inp = (k, ph, ref) => <input ref={ref} value={r[k] || ''} placeholder={ph} onChange={ev => { r[k] = ev.target.value; if ((k === 'nome' || k === 'matricula') && !r.cpf) r.k = ''; alterou(); }} />;
  const ws = L.palavras(r.nome);
  r.guerra = (r.guerra || []).filter(i => i < ws.length);
  const am = r.nome && L.indiceAlmanaque().size && !L.antigAlmanaque(r) ? (L.antigManual(r) || 'fora') : null;
  return (
    <tr className={(bloqueada ? 'alerta' : '') + (trocando === r.id ? ' trocando' : '') + (destaque ? ' entrou' : '')} title={bloqueada ? `Está de RP em ${dataBR(b.data)} — troque ou remova` : undefined}
      onBlur={ev => { if (ev.currentTarget.contains(ev.relatedTarget)) return; if (L.ordenarBloco(b)) alterou(); }}>
      <td>{inp('posto', 'Posto/Grad', primeiro)}</td>
      <td>{inp('rg', 'RG')}</td>
      <td className="td-nome">{inp('nome', 'Nome completo')}
        <div className="guerra" title="Toque nas palavras do nome de guerra (saem em negrito no PDF)">
          {ws.map((w, i) => <span key={i} className={r.guerra.includes(i) ? 'g' : ''} onClick={ev => { ev.stopPropagation(); r.guerra = r.guerra.includes(i) ? r.guerra.filter(x => x !== i) : [...r.guerra, i]; alterou(); }}>{w}</span>)}
          {!ws.length && <em>digite o nome</em>}
        </div>
        {am && <button className={'ant-chip' + (am !== 'fora' ? ' def' : '')} onClick={ev => { ev.stopPropagation(); abrirAntig(r); }}
          title={am !== 'fora' ? L.rotAntig(am) + ' (fora do almanaque). Toque para alterar.' : 'Este policial não está no almanaque. Toque para dizer de quem ele é mais antigo ou mais moderno.'}>
          {am !== 'fora' ? `✎ ⇅ mais ${am.lado === 'antes' ? 'antigo' : 'moderno'} que ${am.refNome}` : '⚠ Fora do almanaque · definir antiguidade'}</button>}
      </td>
      <td>{inp('matricula', 'Matr.')}</td>
      <td className="ac"><div className="ac-g">
        {bloqueada && <span className="tg bloq">RP</span>}
        <button title="Trocar por outra pessoa" onClick={ev => { ev.stopPropagation(); setTrocando(r.id); }}>⇄</button>
        <button title="Remover" onClick={ev => { ev.stopPropagation(); b.pessoas = b.pessoas.filter(x => x !== r); if (trocando === r.id) setTrocando(null); alterou(); }}>✕</button>
      </div></td>
    </tr>);
}
