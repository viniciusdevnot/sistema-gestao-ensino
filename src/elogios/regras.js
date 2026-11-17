/* Regras da Portaria Normativa nº 020/2025-PM1 (elogios e referências elogiosas) e textos dos documentos.
   Tudo aqui é puro (sem banco e sem tela), para poder testar sozinho. */
export const NORMA = 'Portaria Normativa nº 020/2025-PM1';
export const PRAZO_DIAS = 30;

export const FUNCOES = {
  '': 'Sem função de comando',
  cmt_btl: 'Comandante do BTL',
  subcmt_btl: 'Subcomandante do BTL',
  cmt_cia: 'Comandante de Companhia',
  cpu: 'CPU (Coordenador de Policiamento da Unidade)'
};
export const SECOES = { '': 'Nenhuma', p1: 'P1 – Pessoal (recebe os elogios para publicar no boletim)', p2: 'P2', p3: 'P3', p4: 'P4', p5: 'P5', p6: 'P6', p7: 'P7' };
export const ehAutorizador = f => f === 'cmt_btl' || f === 'subcmt_btl';

export const SITUACOES = {
  rascunho: ['Rascunho', 'cinza'],
  solicitado: ['Aguardando o Cmt do BTL', 'amarelo'],
  devolvido: ['Devolvido para ajuste', 'vermelho'],
  autorizado: ['Autorizado · falta publicar', 'azul'],
  publicado: ['Publicado', 'verde']
};

export const MODALIDADES = {
  I: ['Ação Meritória de Caráter Excepcional', 'ato ou fato não comum de bravura e com risco à vida, ultrapassando os limites normais do cumprimento do dever, em missão, operação de preservação da lei e da ordem, operação de inteligência ou de segurança e na execução do serviço'],
  II: ['Ação Destacada no Cumprimento do Dever', 'atuação espontânea, em serviço ou fora dele, com ação pessoal com risco à vida, ultrapassando as obrigações normais, em socorro ou apoio à pessoa ou à comunidade'],
  III: ['Ação de Repercussão Positiva', 'ato ou comportamento digno de destaque, com benefício direto à instituição e reflexos favoráveis à imagem, ao prestígio ou à credibilidade da Corporação']
};

export const REGISTROS_BO = ['Boletim de Atendimento Protocolo nº', 'Boletim de Ocorrência Protocolo nº', 'Boletim de Ocorrência nº', 'Registro de Atendimento nº', 'Protocolo SGD nº'];

/* ---------- utilidades ---------- */
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const dataBR = iso => { if (!iso) return ''; const [a, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}/${a}`; };
export const dataExtenso = iso => { if (!iso) return ''; const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number); return `${d === 1 ? '1º' : d} de ${MESES[m - 1]} de ${a}`; };
export const horaBR = h => { if (!h) return ''; const [hh, mm] = String(h).split(':'); return `${+hh}h${mm && mm !== '00' ? mm : ''}`; };
export const hojeISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
export const diasEntre = (a, b) => (!a || !b) ? null : Math.round((Date.parse(String(b).slice(0, 10)) - Date.parse(String(a).slice(0, 10))) / 864e5);
export const soDigitos = s => String(s || '').replace(/\D/g, '');
const limpo = s => String(s || '').replace(/\s+/g, ' ').trim();
const semPonto = s => limpo(s).replace(/[.;,\s]+$/, '');
const negrito = s => s ? `**${s}**` : '';
// “em razão da notável atuação…” — a pessoa pode começar com da/do/de ou não
const emRazao = s => { const t = semPonto(s); if (!t) return ''; return /^(d[aoe]s?|pela?s?|pelos?)\s/i.test(t) ? `em razão ${t.replace(/^./, c => c.toLowerCase())}` : `em razão de ${t.replace(/^./, c => c.toLowerCase())}`; };
const maiuscula1 = s => { const t = limpo(s); return t ? t[0].toUpperCase() + t.slice(1) : ''; };
const juntar = l => l.length <= 1 ? (l[0] || '') : l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1];

/* ---------- o pedido ---------- */
export function novoPedido(perfil, base = {}){
  return {
    tipo: 'referencia', alcance: 'individual', modalidade: '', averbar: false,
    fato: { data: '', hora: '', local: '', natureza: '', boTipo: REGISTROS_BO[0], bo: '', narrativa: '', conduta: '', comprovantes: '', atraso: '' },
    declaracoes: { naoRotina: false },
    policiais: [novoPolicial()],
    solicitante: {
      nome: base.sigNome || perfil?.nome || '', guerra: [...(base.sigGuerra || [])], posto: base.sigPosto || perfil?.posto || '',
      funcao: base.sigFuncao || '', setores: [...(base.setores || ['', '']), '', ''].slice(0, 2)
    },
    destino: { posto: '', nome: '', funcao: '', cidade: base.cidade || '', uf: base.uf || 'TO' },
    publicacao: { boletim: 'BI', unidade: (base.setores || [])[1] || (base.setores || [])[0] || '', numero: '', data: '' },
    historico: []
  };
}
export const novoPolicial = () => ({ posto: '', matricula: '', nome: '', guerra: [], unidade: '', participacao: '', semProcesso: false });

export const nomeTipo = e => e.tipo === 'elogio' ? `ELOGIO ${e.alcance === 'coletivo' ? 'COLETIVO' : 'INDIVIDUAL'}` : `REFERÊNCIA ELOGIOSA ${e.alcance === 'coletivo' ? 'COLETIVA' : 'INDIVIDUAL'}`;
export const rotuloTipo = e => e.tipo === 'elogio' ? `Elogio${e.modalidade ? ` · art. 4º, ${e.modalidade}` : ''}` : `Referência elogiosa ${e.alcance === 'coletivo' ? 'coletiva' : 'individual'}`;
const nomePolicial = (p, comMat = true) => limpo([limpo(p.posto).toUpperCase(), comMat && soDigitos(p.matricula) ? soDigitos(p.matricula) : '', limpo(p.nome).toUpperCase()].filter(Boolean).join(' '));
export const policiaisValidos = e => (e.policiais || []).filter(p => limpo(p.nome));
export const listaPoliciais = e => juntar(policiaisValidos(e).map(p => nomePolicial(p)));
export const tituloPedido = e => [limpo(e.fato?.natureza) || 'Fato sem natureza', limpo(e.fato?.local)].filter(Boolean).join(' – ');
const registroBO = f => soDigitos(f.bo) || limpo(f.bo) ? `${f.boTipo || REGISTROS_BO[0]} ${limpo(f.bo)}` : '';
const emLocal = l => { const t = semPonto(l); return !t ? '' : /^(n[ao]s?|em|à|ao|pr[óo]ximo|entre|durante)\s/i.test(t) ? t : 'em ' + t; };
const daUnidade = u => { const t = limpo(u); return !t ? '' : /^\d+ª/.test(t) || /^(cia|companhia|seção|se[çc]ao|ag[êe]ncia)\b/i.test(t) ? 'da ' + t : 'do ' + t; };
const quando = f => [f.data ? `no dia ${dataBR(f.data)}` : '', f.hora ? `às ${horaBR(f.hora)}` : ''].filter(Boolean).join(', ');

/* ---------- 1) Ofício de solicitação (do Cmt imediato: CPU ou Cmt de Cia) ---------- */
export function textoOficio(e){
  const f = e.fato || {}, ps = policiaisValidos(e), varios = ps.length > 1, T = nomeTipo(e);
  const pars = [];
  const bo = registroBO(f);
  pars.push(`Solicito a Vossa Senhoria a concessão de ${negrito(T)} ${varios ? 'aos Policiais Militares' : 'ao Policial Militar'}: ${negrito(listaPoliciais(e))}, ${emRazao(f.conduta) || 'em razão da atuação de destaque'}, durante o atendimento da ocorrência de ${semPonto(f.natureza).replace(/^./, c => c.toLowerCase()) || '(natureza da ocorrência)'}${bo ? ` registrada sob o ${bo}` : ''}, ${quando(f) || '(data do fato)'}.`);
  String(f.narrativa || '').split(/\n+/).map(limpo).filter(Boolean).forEach(t => pars.push(t));
  if (e.alcance === 'coletivo' && ps.length){
    pars.push('A participação de cada policial militar no fato foi a seguinte:');
    ps.forEach(p => pars.push(`${negrito(nomePolicial(p))}: ${semPonto(p.participacao) || '(descreva a participação)'}.`));
  }
  if (e.tipo === 'elogio' && MODALIDADES[e.modalidade]) pars.push(`A conduta enquadra-se no art. 4º, inciso ${e.modalidade} – ${MODALIDADES[e.modalidade][0]}, da ${NORMA}.`);
  if (limpo(f.comprovantes)) pars.push(`Seguem, em anexo, os documentos comprobatórios: ${semPonto(f.comprovantes)}.`);
  const d = diasEntre(f.data, e._dataOficio || hojeISO());
  if (d !== null && d > PRAZO_DIAS && limpo(f.atraso)) pars.push(`Registro que a proposta é encaminhada após o prazo de ${PRAZO_DIAS} dias do fato gerador (art. 14 da ${NORMA}) em razão de ${semPonto(f.atraso).replace(/^./, c => c.toLowerCase())}.`);
  pars.push(`Ante o exposto, solicito a Vossa Senhoria a concessão de ${negrito(T)}, nos termos da ${NORMA}, como forma de justo reconhecimento pelo serviço prestado, salvo melhor juízo.`);
  return pars.join('\n');
}
export function camposOficio(e, base = {}){
  const s = e.solicitante || {}, d = e.destino || {};
  return {
    setores: [...(s.setores || []).map(limpo), '', ''].slice(0, 4),
    assunto: `Solicitação de ${e.tipo === 'elogio' ? 'Elogio' : 'Referência Elogiosa'}`,
    destMilitar: true, destPosto: limpo(d.posto), destNome: limpo(d.nome), destFuncao: limpo(d.funcao), destLocal: '', destCidade: limpo(d.cidade) || base.cidade || '', destUF: limpo(d.uf) || 'TO',
    texto: textoOficio(e), fecho: 'Respeitosamente', assDigital: true,
    sigNome: limpo(s.nome), sigGuerra: [...(s.guerra || [])], sigPosto: limpo(s.posto), sigFuncao: limpo(s.funcao), sigResp: false,
    anexos: limpo(e.fato?.comprovantes) ? 'documentos comprobatórios' : ''
  };
}

/* ---------- 2) Despacho e 3) Item para Boletim (do Cmt do BTL) ---------- */
const nomeAss = (nome, guerra, posto) => limpo(nome).split(' ').filter(Boolean).map((w, k) => (guerra || []).includes(k) ? `**${w}**` : w).join(' ') + (posto ? ` – **${limpo(posto).toUpperCase()}**` : '');
export const funcaoAssinatura = a => a.respondendo ? `${limpo(a.funcao)}, respondendo pelo Comando` : limpo(a.funcao);

export function conteudoDespacho(e, a){
  // a = { numero, ano, sigla, sgd, destinatario, cidade, uf, data, nome, guerra, posto, funcao, respondendo, unidade }
  const of = e.oficio || {}, f = e.fato || {}, T = nomeTipo(e), varios = policiaisValidos(e).length > 1;
  const bol = e.publicacao?.boletim === 'BG' ? 'Boletim Geral da Corporação' : `Boletim Interno ${a.unidade ? 'do ' + a.unidade : 'desta Unidade'}`;
  return {
    titulo: `**DESPACHO Nº ${String(a.numero || '').padStart(3, '0')}/${a.ano} – ${a.sigla}**`,
    sgd: a.sgd ? `SGD: ${a.sgd}` : '',
    destinatario: `**${semPonto(a.destinatario)}:\t**`,
    itens: [
      `**AUTORIZO** a concessão de ${negrito(T)} ${varios ? 'aos policiais militares' : 'ao policial militar'} ${negrito(listaPoliciais(e))}, conforme solicitado ${of.epigrafe ? `por meio do ${of.epigrafe}${of.sgd ? ` (SGD: ${of.sgd})` : ''}` : 'pelo comandante imediato'}, pela atuação na ocorrência de ${semPonto(f.natureza).replace(/^./, c => c.toLowerCase()) || '(natureza)'}, ${quando(f)}, nos termos do art. ${e.tipo === 'elogio' ? '5º, VIII' : '11'} da ${NORMA}.`,
      `**DETERMINO** a publicação em ${bol}${e.averbar ? ' e a averbação nos assentamentos funcionais dos militares (art. 7º e 17)' : ''}${e.tipo === 'referencia' && !e.averbar ? ', sem registro nos assentamentos individuais (art. 9º)' : ''}.`,
      'Publique-se e cumpra-se.'
    ],
    local: `Quartel ${a.unidade ? 'do ' + a.unidade + ' ' : ''}em ${limpo(a.cidade)} – ${limpo(a.uf) || 'TO'}, ${dataExtenso(a.data)}.`,
    assinatura: nomeAss(a.nome, a.guerra, a.posto), funcao: funcaoAssinatura(a)
  };
}
export function conteudoItem(e, a){
  const f = e.fato || {}, ps = policiaisValidos(e), mod = MODALIDADES[e.modalidade];
  const B = e.publicacao?.boletim === 'BG' ? 'BG' : 'BI';
  const circ = [f.data ? `no dia ${dataBR(f.data)}${f.hora ? `, às ${horaBR(f.hora)}` : ''}` : '', emLocal(f.local), `durante o atendimento da ocorrência de ${semPonto(f.natureza).replace(/^./, c => c.toLowerCase()) || '(natureza)'}`, registroBO(f) ? `(${registroBO(f)})` : ''].filter(Boolean).join(', ').replace(/, \(/, ' (');
  const narr = String(f.narrativa || '').split(/\n+/).map(limpo).filter(Boolean).join(' ');
  const conduta = maiuscula1(semPonto(f.conduta).replace(/^(em razão d[aoe]s?\s|d[aoe]s?\s)/i, ''));
  const enq = e.tipo === 'elogio' && mod ? `Ação enquadrada no art. 4º, ${e.modalidade} – ${mod[0]}, da ${NORMA}.` : `Referência elogiosa nos termos do art. 8º, §1º, da ${NORMA}.`;
  const unid = p => limpo(p.unidade) ? `, ${daUnidade(p.unidade)}` : '';
  const qual = p => `${negrito(nomePolicial(p, false))}${soDigitos(p.matricula) ? `, Mat. ${soDigitos(p.matricula)}` : ''}${unid(p)}`;
  const corpo = `${circ}. ${narr}${narr && !/[.!?]$/.test(narr) ? '.' : ''} ${conduta ? `Pela ${conduta.replace(/^./, c => c.toLowerCase())}.` : ''} ${enq}`.replace(/\s+/g, ' ').trim();
  const itens = [];
  const avb = e.averbar ? ' Averbe-se nos assentamentos funcionais (art. 7º e 17).' : e.tipo === 'referencia' ? ' Sem registro nos assentamentos individuais (art. 9º).' : ' Não averbar: elogio coletivo sem a participação individual (art. 7º, parágrafo único).';
  const T = nomeTipo(e), varios = ps.length > 1;
  const abre = e.tipo === 'elogio' ? `ELOGIO${e.alcance === 'coletivo' ? ' COLETIVAMENTE' : varios ? ' INDIVIDUALMENTE' : ''} ${varios ? 'os policiais militares' : 'o policial militar'}` : `Concedo ${negrito(T)} ${varios ? 'aos policiais militares' : 'ao policial militar'}`;
  itens.push({ txt: `${e.tipo === 'elogio' ? negrito(abre.split(' ')[0]) + abre.slice(abre.split(' ')[0].length) : abre} ${juntar(ps.map(qual))}, pela atuação ${corpo}${avb}` });
  if (e.alcance === 'coletivo' || ps.some(p => limpo(p.participacao))) ps.forEach(p => itens.push({ sub: true, txt: `${negrito(nomePolicial(p, false))}: ${semPonto(p.participacao) || '(participação)'}.` }));
  return {
    titulo: `**ITEM PARA ${B} Nº ${String(a.numero || '').padStart(3, '0')}/${a.ano} – ${a.sigla}**`,
    sgd: a.sgd ? `SGD: ${a.sgd}` : '',
    secao: `++${e.tipo === 'elogio' ? 'ELOGIO' : 'REFERÊNCIA ELOGIOSA'}++`,
    itens,
    local: `Quartel ${a.unidade ? 'do ' + a.unidade + ' ' : ''}em ${limpo(a.cidade)} – ${limpo(a.uf) || 'TO'}, ${dataExtenso(a.data)}.`,
    assinatura: nomeAss(a.nome, a.guerra, a.posto), funcao: funcaoAssinatura(a)
  };
}

/* ---------- conferência com a Portaria ---------- */
// fatos = linhas de elogios_fatos() (todos os pedidos de todos os usuários, só o necessário)
export function duplicados(e, id, fatos = []){
  const mats = new Set(policiaisValidos(e).map(p => soDigitos(p.matricula)).filter(Boolean)), bo = soDigitos(e.fato?.bo);
  if (!mats.size) return [];
  return fatos.filter(x => x.id !== id && x.situacao !== 'rascunho' && (x.matriculas || []).some(m => mats.has(m))
    && ((bo && soDigitos(x.bo) === bo) || (e.fato?.data && x.data_fato === e.fato.data)));
}
export function conferir(e, { id, fatos = [], dataRef } = {}){
  const it = [], f = e.fato || {}, ps = policiaisValidos(e);
  const add = (nivel, t, d, passo) => it.push({ nivel, t, d, passo });
  // passo 1 — tipo
  if (e.tipo === 'elogio') add(MODALIDADES[e.modalidade] ? 'ok' : 'er', 'Modalidade do elogio (art. 6º, V)', MODALIDADES[e.modalidade] ? `art. 4º, ${e.modalidade} – ${MODALIDADES[e.modalidade][0]}` : 'escolha a modalidade I, II ou III do art. 4º', 1);
  else add('ok', 'Referência elogiosa (art. 8º, §1º)', 'reconhecimento do desempenho, sem caráter excepcional', 1);
  if (e.tipo === 'elogio' && (e.modalidade === 'I' || e.modalidade === 'II')){
    const risco = /risco|vida|perigo|arma|disparo|fogo|afoga|resgat|salv|incênd|incend|refém|refem|confronto/i.test(`${f.narrativa} ${f.conduta}`);
    add(risco ? 'ok' : 'av', `Risco à vida na modalidade ${e.modalidade}`, risco ? 'a narrativa descreve a situação de risco' : 'a modalidade exige risco à vida: confira se a narrativa descreve o risco; senão, considere a modalidade III ou a referência elogiosa', 2);
  }
  // passo 2 — o fato
  add(f.data && f.hora ? 'ok' : 'er', 'Dia e hora do fato (art. 6º, I)', f.data ? `${dataBR(f.data)}${f.hora ? ' às ' + horaBR(f.hora) : ' — falta a hora'}` : 'informe a data e a hora', 2);
  const d = diasEntre(f.data, dataRef || hojeISO());
  if (d !== null){
    if (d < 0) add('er', 'Data do fato', 'a data do fato está no futuro', 2);
    else if (d <= PRAZO_DIAS) add('ok', `Prazo de ${PRAZO_DIAS} dias (art. 14)`, `${d} dia(s) após o fato`, 2);
    else add(limpo(f.atraso) ? 'av' : 'er', `Prazo de ${PRAZO_DIAS} dias (art. 14)`, `${d} dias após o fato — ${limpo(f.atraso) ? 'justificativa informada' : 'escreva a justificativa da situação excepcional'}`, 2);
  }
  add(limpo(f.natureza) && limpo(f.local) ? 'ok' : 'er', 'Circunstâncias do fato (art. 6º, III)', limpo(f.natureza) && limpo(f.local) ? `${limpo(f.natureza)} · ${limpo(f.local)}` : 'informe a natureza da ocorrência e o local', 2);
  const narr = limpo(f.narrativa).length;
  add(narr >= 120 ? 'ok' : narr ? 'av' : 'er', 'Narrativa objetiva do fato (art. 13, I)', narr >= 120 ? `${narr} caracteres` : narr ? 'narrativa curta: descreva o que os policiais fizeram' : 'descreva o fato', 2);
  const cond = limpo(f.conduta).length;
  add(cond >= 40 ? 'ok' : 'er', 'Conduta e justificativa (art. 6º, IV e art. 15, II)', cond >= 40 ? 'descrição clara da conduta' : 'descreva a conduta e por que merece o reconhecimento', 2);
  add(e.declaracoes?.naoRotina ? 'ok' : 'er', 'Não é mera obrigação legal ou rotina (art. 15, I)', e.declaracoes?.naoRotina ? 'declarado por quem indica' : 'marque a declaração no passo “O fato”', 2);
  if (e.boletim){ const dv = divergenciasBoletim(e); add(dv.length ? 'av' : 'ok', 'Confere com o boletim de ocorrência', dv.length ? dv.join('; ') : `${e.boletim.tipoRegistro || 'BO'} ${e.boletim.protocolo}: data, hora e guarnição batem`, 2); }
  // passo 3 — policiais
  const incomp = ps.filter(p => !limpo(p.posto) || !soDigitos(p.matricula) || !limpo(p.nome));
  add(ps.length && !incomp.length ? 'ok' : 'er', 'Qualificação completa (art. 6º, II)', !ps.length ? 'inclua pelo menos um policial' : incomp.length ? `falta posto, matrícula ou nome de ${incomp.length} policial(is)` : `${ps.length} policial(is): posto, matrícula e nome`, 3);
  const comProc = ps.filter(p => !p.semProcesso);
  add(ps.length && !comProc.length ? 'ok' : 'er', 'Sem processo disciplinar pelo fato (art. 15, V)', !ps.length ? 'inclua os policiais' : comProc.length ? `confirme para ${comProc.map(p => limpo(p.nome).split(' ')[0] || 'o policial').join(', ')}` : 'confirmado para todos', 3);
  if (e.alcance === 'coletivo'){
    const semPart = ps.filter(p => limpo(p.participacao).length < 10);
    add(ps.length < 2 ? 'av' : semPart.length ? 'er' : 'ok', 'Participação individual no coletivo (art. 7º, p.ú. e art. 15, IV)', ps.length < 2 ? 'coletivo com um só policial: use “Individual”' : semPart.length ? `descreva a participação de ${semPart.length} policial(is)` : 'participação de cada um descrita');
  }
  const dup = duplicados(e, id, fatos);
  add(dup.length ? 'er' : 'ok', 'Sem outro elogio pelo mesmo fato (art. 15, VI)', dup.length ? `já existe pedido ${SITUACOES[dup[0].situacao]?.[0].toLowerCase() || ''} para o mesmo policial e o mesmo fato (${dataBR(dup[0].data_fato)}${dup[0].bo ? ', ' + dup[0].bo : ''})` : 'conferido no controle de todos os usuários', 3);
  // passo 4 — quem solicita e onde publica
  const s = e.solicitante || {};
  add(limpo(s.nome) && limpo(s.posto) && limpo(s.funcao) ? 'ok' : 'er', 'Solicitação do comandante imediato (art. 12, I e 13, IV)', limpo(s.funcao) || 'informe nome, posto e função de quem solicita', 4);
  add((s.guerra || []).length ? 'ok' : 'av', 'Nome de guerra do solicitante', (s.guerra || []).length ? 'marcado (sai em negrito)' : 'toque no nome de guerra para marcar', 4);
  add(limpo(e.destino?.nome) ? 'ok' : 'er', 'Endereçado ao Cmt do BTL (art. 5º, VIII)', limpo(e.destino?.nome) ? [e.destino.posto, e.destino.nome].map(limpo).join(' ') : 'informe o Comandante do BTL', 4);
  const avOk = e.tipo === 'referencia' ? true : (e.alcance === 'individual' || ps.every(p => limpo(p.participacao).length >= 10));
  add(!e.averbar || avOk ? 'ok' : 'er', 'Averbação nos assentamentos (art. 7º e 9º)', e.averbar ? (e.tipo === 'referencia' ? 'referência só é averbada por determinação justificada (art. 9º)' : avOk ? 'elogio com participação individual' : 'coletivo sem participação individual não é averbado') : 'não averbar', 4);
  add('ok', 'Publicação (art. 4º, 8º e 16)', e.publicacao?.boletim === 'BG' ? 'Boletim Geral' : `Boletim Interno${limpo(e.publicacao?.unidade) ? ' do ' + limpo(e.publicacao.unidade) : ''}`, 4);
  return it;
}
export const resumoConferencia = it => ({ er: it.filter(x => x.nivel === 'er').length, av: it.filter(x => x.nivel === 'av').length });
export const foraDoPrazo = (e, ref) => { const d = diasEntre(e.fato?.data, ref || hojeISO()); return d !== null && d > PRAZO_DIAS; };

/* ---------- importação: tenta tirar os dados de um ofício pronto (texto corrido) ---------- */
export function lerOficioPronto(txt){
  const t = String(txt || '').replace(/\r/g, '');
  const out = { fato: {}, policiais: [], solicitante: {}, destino: {} };
  if (/REFER[ÊE]NCIA ELOGIOSA/i.test(t)) out.tipo = 'referencia'; else if (/\bELOGIO\b/i.test(t)) out.tipo = 'elogio';
  if (/COLETIV/i.test(t)) out.alcance = 'coletivo'; else out.alcance = 'individual';
  const mData = /no dia (\d{2})\/(\d{2})\/(\d{4})/i.exec(t); if (mData) out.fato.data = `${mData[3]}-${mData[2]}-${mData[1]}`;
  const mHora = /(?:às|as)\s*(\d{1,2})h(\d{2})?/i.exec(t); if (mHora) out.fato.hora = `${mHora[1].padStart(2, '0')}:${mHora[2] || '00'}`;
  const mBo = /(Boletim de (?:Atendimento|Ocorr[êe]ncia)(?: Protocolo)?\s*n[º°o.]*)\s*([\d./-]+)/i.exec(t); if (mBo){ out.fato.boTipo = REGISTROS_BO.find(r => r.toLowerCase().startsWith(mBo[1].toLowerCase().slice(0, 22))) || REGISTROS_BO[0]; out.fato.bo = mBo[2].replace(/[.,]$/, ''); }
  const mOc = /ocorr[êe]ncia de ([^,.]+?)(?:,? registrada|\s+sob|,)/i.exec(t); if (mOc) out.fato.natureza = maiuscula1(mOc[1]);
  const mCond = /em razão (d[aoe]s? [\s\S]+?),?\s+durante/i.exec(t); if (mCond) out.fato.conduta = limpo(mCond[1]);
  const mNar = /\n\s*(Na ocasião,[\s\S]+?)\n\s*(?:Ante o exposto|A participação|A conduta|Seguem)/i.exec(t); if (mNar) out.fato.narrativa = limpo(mNar[1]);
  const mPol = /Policia(?:is|l) Militar(?:es)?:\s*([\s\S]+?),\s*em razão/i.exec(t);
  if (mPol){
    mPol[1].split(/\s+e\s+(?=(?:\d|SD|CB|ST|SGT|\d[º°]|CAP|MAJ|TEN|CEL|ASP|CAD)\b)|,\s+/i).map(limpo).filter(Boolean).forEach(x => {
      const m = /^((?:\d[º°ªo]\s*)?(?:TEN CEL|SGT|TEN|SD|CB|ST|CAP|MAJ|CEL|ASP OF|CAD)(?:\s+Q\w+)?)\s+([\d.\-/]+)?\s*(.+)$/i.exec(x.replace(/°/g, 'º'));
      out.policiais.push(m ? { ...novoPolicial(), posto: m[1].toUpperCase(), matricula: soDigitos(m[2]), nome: m[3].toUpperCase() } : { ...novoPolicial(), nome: x.toUpperCase() });
    });
  }
  const mDest = /Ao Senhor\s*\n\s*(.+)\n\s*(.+)\n/i.exec(t);
  if (mDest){ const m = /^((?:TEN CEL|CEL|MAJ|CAP|\dº TEN)\s*Q\w+)\s+(.+)$/i.exec(limpo(mDest[1])); out.destino = m ? { posto: m[1], nome: m[2] } : { nome: limpo(mDest[1]) }; out.destino.funcao = limpo(mDest[2]); }
  const mAss = /Assinatura digital\s*\n\s*(.+?)\s+[–-]\s+(.+)\n\s*(.+)/i.exec(t);
  if (mAss) out.solicitante = { nome: limpo(mAss[1]), posto: limpo(mAss[2]), funcao: limpo(mAss[3]) };
  const mOf = /Of[íi]cio n[º°]\s*(\d+)\/(\d{4})\/([^\n]+)/i.exec(t);
  if (mOf) out.oficioNumero = { numero: mOf[1], ano: mOf[2], setores: mOf[3].split(/\s*[-–/]\s*/).map(limpo).filter(Boolean).slice(0, 2) };
  const mSgd = /SGD:\s*([\d/]+)/i.exec(t); if (mSgd) out.sgd = mSgd[1];
  return out;
}

/* ---------- Boletim de Ocorrência: completa só os dados objetivos do fato (narrativa e conduta ficam com o ofício) ---------- */
const mesmoPolicial = (p, g) => (soDigitos(p.matricula) && soDigitos(p.matricula) === g.matricula)
  || (limpo(p.nome) && limpo(p.nome).toUpperCase() === g.nome)
  || (limpo(p.nome).length > 3 && g.nome.split(' ').filter(w => w.length > 2).every(w => limpo(p.nome).toUpperCase().includes(w)));
export function aplicarBoletim(e, d, arquivo){
  const f = e.fato, feitos = [];
  const pega = (k, v, rot) => { if (v && !limpo(f[k])){ f[k] = v; feitos.push(rot); } };
  pega('data', d.fato.data, 'data'); pega('hora', d.fato.hora, 'hora'); pega('local', d.fato.local, 'local'); pega('natureza', d.fato.natureza, 'natureza');
  if (d.protocolo && !limpo(f.bo)){ f.bo = d.protocolo; f.boTipo = d.tipoRegistro || f.boTipo; feitos.push('nº do protocolo'); }
  // completa os policiais que já estão no pedido (posto, matrícula, nome completo)
  let compl = 0;
  (e.policiais || []).forEach(p => { const g = (d.guarnicao || []).find(g => mesmoPolicial(p, g)); if (!g) return;
    if (!limpo(p.posto) && g.posto){ p.posto = g.posto; compl++; }
    if (!soDigitos(p.matricula) && g.matricula){ p.matricula = g.matricula; compl++; }
    if (limpo(p.nome).length < g.nome.length && g.nome.includes(limpo(p.nome).toUpperCase())){ p.nome = g.nome; compl++; } });
  if (compl) feitos.push('dados dos policiais');
  const ref = `${d.tipoRegistro || 'Boletim de Ocorrência Protocolo nº'} ${d.protocolo || ''}`.trim();
  if (d.protocolo && !String(f.comprovantes || '').includes(d.protocolo)){ f.comprovantes = [limpo(f.comprovantes), `cópia do ${ref}`].filter(Boolean).join('; '); feitos.push('comprovante'); }
  e.boletim = { arquivo, lidoEm: new Date().toISOString(), protocolo: d.protocolo || '', tipoRegistro: d.tipoRegistro, data: d.fato.data || '', hora: d.fato.hora || '', local: d.fato.local || '', natureza: d.fato.natureza || '', guarnicao: d.guarnicao || [] };
  return feitos;
}
export const naGuarnicao = (e, g) => (e.policiais || []).some(p => mesmoPolicial(p, g));
/* diferenças entre o pedido e o BO (para o comandante decidir) */
export function divergenciasBoletim(e){
  const b = e.boletim, f = e.fato || {}; if (!b) return [];
  const out = [];
  if (b.data && f.data && b.data !== f.data) out.push(`data: BO ${dataBR(b.data)} × pedido ${dataBR(f.data)}`);
  if (b.hora && f.hora && b.hora !== f.hora) out.push(`hora: BO ${horaBR(b.hora)} × pedido ${horaBR(f.hora)}`);
  if (b.protocolo && soDigitos(f.bo) && b.protocolo !== soDigitos(f.bo)) out.push(`protocolo: BO ${b.protocolo} × pedido ${limpo(f.bo)}`);
  const fora = policiaisValidos(e).filter(p => !(b.guarnicao || []).some(g => mesmoPolicial(p, g)));
  if (b.guarnicao?.length && fora.length) out.push(`${fora.map(p => limpo(p.nome).split(' ')[0]).join(', ')} não consta(m) na guarnição do BO`);
  return out;
}
