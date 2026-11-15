/* Regras da Escala de ACO (mesmas do sistema anterior).
   O estado fica em `est` (carregado do banco por aco/dados.js); as funções aqui são puras
   ou mexem só nos objetos das escalas, como no sistema anterior. */

export const est = {
  escalas: [],        // escalas ativas (a aberta vem completa; as demais só com doc/blocos)
  lixeira: [],        // escalas em Excluídas
  historico: {},      // id da escala -> {numero, tipo, data, operacao, geradaEm, itens}
  almanaque: null,    // {listas: {1: [...], 2: [...], 3: [...]}, arquivos: {...}, stamp}
  antigManual: {},    // chave -> {lado, refNome, refMat, refCpf, ...}
  config: {},         // {acoMax, acoAviso, acoPeriodo}
  atual: null,        // escala aberta no editor
  ehAdmin: false, perfilId: null, quem: ''
};

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
export const novoId = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));

export const STOP = new Set(['DA', 'DE', 'DO', 'DAS', 'DOS', 'E']);
const FUNCOES = new Set(['QOAS', 'QOA', 'QOS', 'QOE', 'QPE', 'QPS', 'QOAPM', 'ADIDO', 'ADIDA', 'CRP', 'COMANDANTE', 'CMT', 'MOTORISTA', 'MOT', 'AUXILIAR', 'AUX', 'PATRULHEIRO', 'PATRULHEIRA', 'FUNCAO', 'NOME', 'CONTATO', 'MATRICULA', 'RG', 'CPF', 'POSTO', 'GRAD', 'GRADUACAO', 'QPPM', 'QOPM', 'PM', 'TEL', 'TELEFONE', 'FONE']);
const MESES = { JANEIRO: 1, FEVEREIRO: 2, MARCO: 3, ABRIL: 4, MAIO: 5, JUNHO: 6, JULHO: 7, AGOSTO: 8, SETEMBRO: 9, OUTUBRO: 10, NOVEMBRO: 11, DEZEMBRO: 12 };
const POSTOS_RE = /\b(TEN(?:ENTE)?[\s-]*CEL(?:ONEL)?|CEL|TC|MAJ|CAP|[12]\s*[º°O]?\s*TEN|ASP(?:\s*OF)?|SUB\s*TEN|ST|[123]\s*[º°O]?\s*SGT|CB|SD|AL(?:UNO)?\s*(?:SD|OF|CFP|CFO|CHO|CFS))\b(?:\s*V?(?:QPPM|QOPM|QOAPM|QOAS|QOA|QOSPM|QOS|QOEM|QOE|QPE|QPS|QPM|PM)V?\b)*/;
export const PATENTES = ['Coronéis', 'Tenentes-coronéis', 'Majores', 'Capitães', '1º Tenentes', '2º Tenentes', 'Aspirantes', 'Subtenentes', '1º Sargentos', '2º Sargentos', '3º Sargentos', 'Cabos', 'Soldados', 'Alunos'];
export const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
export const hojeISO = (soma = 0) => { const d = new Date(); d.setDate(d.getDate() + soma); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const dataBR = iso => iso ? iso.split('-').reverse().join('/') : '';
export const diaSemana = iso => iso ? new Date(iso + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long' }) : '';
export const MESES_NOME = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
export const dataExtenso = iso => { if (!iso) return ''; const [a, m, d] = iso.split('-'); return `${d} de ${MESES_NOME[+m - 1].toLowerCase()} de ${a}`; };
export const palavras = t => String(t || '').trim().split(/\s+/).filter(Boolean);
export const mascararCpf = c => c && c.length === 11 ? `***.${c.slice(3, 6)}.${c.slice(6, 9)}-**` : (c || '');
export const minhaEscala = e => est.ehAdmin || (!!e.autorId && e.autorId === est.perfilId);
export const descEscala = e => `ACO Nº ${e.doc?.numero || '—'} (${e.tipo === 'compulsoria' ? 'compulsória' : 'voluntária'}, ${dataBR(e.data)})`;

/* ================= ACOs tiradas (contagem por policial) ================= */
export const chavePessoa = r => { const m = String(r.matricula || '').replace(/\D/g, ''); return m ? 'M:' + m : r.cpf ? 'C:' + r.cpf : 'N:' + norm(r.nome); };
export const NOME_PER = { mes: 'no mês', '3m': 'nos últimos 3 meses', ano: 'no ano', tudo: 'no total' };
export const valorACO = r => r?.meia ? 0.5 : 1;
export const fN = n => (+n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
export const itemContab = (r, b) => ({ k: chavePessoa(r), posto: r.posto, nome: r.nome, guerra: r.guerra || [], matricula: r.matricula, data: b.data, local: b.local, valor: valorACO(r), meia: !!r.meia });
export function cfgACO(){ const c = est.config || {}; const max = +c.acoMax || 30; return { max, aviso: Math.min(+c.acoAviso || Math.max(1, max - 5), max), periodo: c.acoPeriodo || 'ano' }; }
export function nivelACO(n){
  const { max, aviso } = cfgACO();
  if (n >= max) return 'n5';
  if (n >= aviso) return 'n4';
  if (n >= aviso * 0.75) return 'n3';
  if (n >= aviso * 0.4) return 'n2';
  return 'n1';
}
export function faixasACO(){
  const { max, aviso } = cfgACO(), a = Math.ceil(aviso * 0.4), b = Math.ceil(aviso * 0.75);
  const fx = (c, i, f, extra = '') => i > f ? null : [c, (i === f ? `${i}` : `${i}–${f}`) + extra];
  return [fx('n1', 1, a - 1), fx('n2', Math.max(1, a), b - 1), fx('n3', Math.max(1, b), aviso - 1), fx('n4', aviso, max - 1, ' perto do limite'), ['n5', `${max}+ limite`]].filter(Boolean);
}
export function registroHistorico(e){
  return { numero: e.doc?.numero || '', tipo: e.tipo, data: e.data, operacao: e.doc?.operacao || '', geradaEm: e.contabilizadoEm || e.ultimoPdf || '', itens: JSON.parse(JSON.stringify(e.contabilizado || [])) };
}
/* ACOs que contam no Painel: todo o histórico, menos as escalas que estão em Excluídas */
export function acosContadas(){
  const fora = new Set((est.lixeira || []).map(e => e.id));
  return Object.entries(est.historico || {}).filter(([id]) => !fora.has(id)).map(([id, h]) => ({ id, ...h }));
}
export function inicioPeriodo(per){
  const d = new Date(); const iso = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  if (per === 'mes') return iso(new Date(d.getFullYear(), d.getMonth(), 1));
  if (per === '3m') return iso(new Date(d.getFullYear(), d.getMonth() - 2, 1));
  if (per === 'ano') return `${d.getFullYear()}-01-01`;
  return '0000';
}
export function acosNoLimite(r, ignorarEscala){
  const { periodo } = cfgACO(), desde = inicioPeriodo(periodo), k = chavePessoa(r);
  let n = 0;
  acosContadas().forEach(h => { if (ignorarEscala && h.id === ignorarEscala.id) return; (h.itens || []).forEach(x => { if (x.k === k && x.data >= desde) n += x.valor ?? 1; }); });
  return n;
}
export function situacaoLimite(n){
  const { max, aviso } = cfgACO();
  if (n >= max) return { cls: 'n5', txt: `limite atingido (${fN(n)}/${max})` };
  if (n >= aviso) return { cls: 'n4', txt: `perto do limite (${fN(n)}/${max})` };
  return null;
}
export function estatisticasACO(per = 'tudo'){
  const desde = inicioPeriodo(per), mapa = new Map(); let turnos = 0, escalas = 0, meias = 0;
  acosContadas().forEach(h => {
    const itens = (h.itens || []).filter(x => x.data >= desde);
    if (itens.length) escalas++;
    itens.forEach(x => {
      const v = x.valor ?? 1; turnos += v; if (x.meia) meias++;
      if (!mapa.has(x.k)) mapa.set(x.k, { k: x.k, posto: x.posto, nome: x.nome, guerra: x.guerra, matricula: x.matricula, total: 0, ultima: '', itens: [] });
      const p = mapa.get(x.k);
      p.total += v; if (x.meia) p.meias = (p.meias || 0) + 1; p.itens.push({ data: x.data, local: x.local, numero: h.numero, tipo: h.tipo, meia: x.meia });
      if (x.data >= p.ultima){ p.ultima = x.data; p.posto = x.posto || p.posto; p.nome = x.nome || p.nome; p.guerra = x.guerra?.length ? x.guerra : p.guerra; }
    });
  });
  const lista = [...mapa.values()].sort((a, b) => b.total - a.total || (a.nome || '').localeCompare(b.nome || ''));
  return { lista, mapa, turnos, escalas, meias };
}

/* ================= leitura das pessoas nos PDFs ================= */
export function parsePessoa(linha){
  linha = String(linha || '').replace(/\s–\s[^\d]*?(?=\s\d|$)/g, ' ');
  linha = linha.replace(/(^|\s)([B-DF-HJ-NP-TV-ZÇ])\s(?=[A-ZÀ-Ü]{2,})/g, '$1$2');
  const n = norm(linha);
  const cpfM = n.match(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/);
  const cpf = cpfM ? cpfM[0].replace(/\D/g, '') : '';
  let resto = cpfM ? n.replace(cpfM[0], ' ') : n;
  const pM = resto.match(POSTOS_RE);
  const posto = pM ? pM[0].split(/\s+/).map(t => /^V?Q[A-Z]+V?$/.test(t) ? t.replace(/^V/, '').replace(/V$/, '') : t).join(' ').replace(/\s+/g, ' ').trim() : '';
  if (pM) resto = resto.replace(pM[0], ' ');
  let rg = '';
  const rgM = resto.match(/\b\d{2}\.\d{3}(?:\/\d)?\b|\b\d{4,5}\/\d\b/);
  if (rgM){ rg = rgM[0]; resto = resto.replace(rgM[0], ' '); }
  resto = resto.replace(/\(\d{2}\)\s*\d[\d\s-]{7,}/g, ' ');
  resto = resto.replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, ' ');
  resto = resto.replace(/(^|\s)(AB|A|B|O)\s*[+-](?=\s|$)/g, ' ');
  let matricula = '';
  for (const m of resto.matchAll(/\b(\d{5,10})(?:-\d)?\b/g)){ matricula = m[1]; break; }
  resto = resto.replace(/\b\d[\d.\-\/]*\b/g, ' ').replace(/[^A-Z' ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const nome = resto.split(' ').filter(w => (w.length > 1 || STOP.has(w) || /^[AEOY]$/.test(w)) && !FUNCOES.has(w)).join(' ').replace(/^(?:DA|DE|DO|DAS|DOS|E)\s+/, '');
  return { posto, nome, nomeExib: nomeComAcentos(linha, nome), matricula, cpf, rg };
}
function nomeComAcentos(linha, nome){
  const orig = String(linha || '').toUpperCase().match(/[A-ZÀ-ÖØ-Þ']+/g) || [];
  const usados = new Set();
  return nome.split(' ').map(w => { const i = orig.findIndex((o, j) => !usados.has(j) && norm(o) === w); if (i < 0) return w; usados.add(i); return orig[i]; }).join(' ');
}
export function pessoasDe(linhas, efetivo = false){
  const vistos = new Set(), r = [];
  let ult = null;
  linhas.forEach(l => {
    const p = parsePessoa(l);
    if (efetivo && p.nome.split(' ').length < 2 && p.cpf && ult && !ult.cpf){ ult.cpf = p.cpf; ult.rg ||= p.rg; return; }
    if (efetivo ? !(p.cpf || p.matricula) : !(p.cpf || p.matricula || p.posto)) return;
    if (p.nome.split(' ').length < 2) return;
    p.ordem = ordemPosto(p.posto); r.push(p); ult = p;
  });
  return r.filter(p => { p.k = p.cpf || (p.matricula ? 'M:' + p.matricula : 'N:' + p.nome); if (vistos.has(p.k)) return false; vistos.add(p.k); return true; });
}
export function ordemPosto(posto){
  const s = norm(posto).replace(/[º°]/g, '');
  if (/^AL/.test(s)) return 13;
  if (/TEN[\s-]*CEL|^TC\b/.test(s)) return 1;
  if (/\bCEL/.test(s)) return 0;
  if (/MAJ/.test(s)) return 2;
  if (/CAP/.test(s)) return 3;
  if (/SUB\s*TEN|^ST\b/.test(s)) return 7;
  if (/^1\s*O?\s*TEN/.test(s)) return 4;
  if (/^2\s*O?\s*TEN/.test(s)) return 5;
  if (/ASP/.test(s)) return 6;
  if (/^1\s*O?\s*SGT/.test(s)) return 8;
  if (/^2\s*O?\s*SGT/.test(s)) return 9;
  if (/^3\s*O?\s*SGT/.test(s)) return 10;
  if (/CB/.test(s)) return 11;
  if (/SD/.test(s)) return 12;
  return 99;
}

/* ================= antiguidade (almanaques + definida à mão) ================= */
let almIdx = { stamp: null, mapa: new Map() };
export function indiceAlmanaque(){
  const A = est.almanaque; const st = A?.stamp || '';
  if (almIdx.stamp === st) return almIdx.mapa;
  const mapa = new Map();
  if (A) Object.entries(A.listas || {}).forEach(([grupo, itens]) => itens.forEach((it, i) => {
    const info = { seq: +grupo * 100000 + i, ordinal: it[3], posto: it[4], grupo: +grupo };
    if (it[0]) mapa.set('C:' + it[0], info);
    if (it[1]) mapa.set('M:' + it[1], info);
    if (it[2] && !mapa.has('N:' + it[2])) mapa.set('N:' + it[2], info);
  }));
  almIdx = { stamp: st, mapa };
  return mapa;
}
export function antigAlmanaque(p){
  const m = indiceAlmanaque(); if (!m.size || !p) return null;
  const mat = String(p.matricula || '').replace(/\D/g, '');
  return (p.cpf && m.get('C:' + p.cpf)) || (mat && m.get('M:' + mat)) || (p.nome && m.get('N:' + norm(p.nome))) || null;
}
export function chavesAnt(p){ const mat = String(p.matricula || '').replace(/\D/g, ''); return [mat && 'M:' + mat, p.cpf && 'C:' + p.cpf, p.nome && 'N:' + norm(p.nome)].filter(Boolean); }
export function defAntManual(p){ const M = est.antigManual; if (!M || !p) return null; for (const k of chavesAnt(p)) if (M[k]) return M[k]; return null; }
export function antigManual(p, prof = 0){
  const d = defAntManual(p); if (!d || prof > 6) return null;
  const ref = { matricula: d.refMat, cpf: d.refCpf, nome: d.refNome };
  const base = antigAlmanaque(ref) || antigManual(ref, prof + 1);
  const nivel = base ? (base.nivel || 0) + 1 : 1, seq = (base ? base.seq : 1e12) + (d.lado === 'antes' ? -1 : 1) * Math.pow(0.5, nivel);
  return { seq, nivel, ordinal: null, manual: true, lado: d.lado, refNome: d.refNome, grupo: base?.grupo };
}
export function antiguidade(p){
  if (!p || !indiceAlmanaque().size) return null;
  return antigAlmanaque(p) || antigManual(p);
}
export const rotAntig = a => !a ? '' : a.manual ? `Antig. definida: mais ${a.lado === 'antes' ? 'antigo' : 'moderno'} que ${a.refNome}` : `Antig. ${a.ordinal}º`;
export const porPatente = (a, b) => {
  const pa = a.ordem ?? ordemPosto(a.posto), pb = b.ordem ?? ordemPosto(b.posto);
  if (pa !== pb) return pa - pb;
  const aa = antiguidade(a)?.seq ?? Infinity, ab = antiguidade(b)?.seq ?? Infinity;
  if (aa !== ab) return aa - ab;
  return (a.nome || '').localeCompare(b.nome || '');
};
export const mesmaPessoa = (a, b) => chavesAnt(a).some(k => chavesAnt(b).includes(k));
export function grupoAlmanaque(linhas){
  const t = norm(linhas.slice(0, 60).join(' '));
  if (!/ALMANAQUE/.test(t)) return 0;
  if (/DOS OFICIAIS/.test(t)) return 1;
  if (/SUBTENENTES|SARGENTOS/.test(t)) return 2;
  if (/CABOS|SOLDADOS/.test(t)) return 3;
  return 4;
}
export const NOMES_ALM = { 1: 'Oficiais', 2: 'Subtenentes e Sargentos', 3: 'Cabos e Soldados', 4: 'Outro almanaque' };
/* lê o almanaque e devolve o novo objeto de almanaques (não grava) */
export function lerAlmanaque(nomeArq, linhas){
  const grupo = grupoAlmanaque(linhas);
  const itens = [];
  linhas.forEach(l => {
    const m = l.match(/^\s*(?:(\d{1,4})|[A-Za-z]{2,6})\s+(.+?)\s+(\d{2}\.\d{3}(?:\/\d)?|\d{4,6}\/\d)\s+(.+?)\s+(\d{4,10})(?:-\d)?\s+(\d{3}\.\d{3}\.\d{3}-\d{2})/);
    if (!m) return;
    const nome = norm(m[4].replace(/\s[-–].*$/, '')).replace(/[^A-Z' ]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (nome.split(' ').length < 2) return;
    itens.push([m[6].replace(/\D/g, ''), m[5], nome, m[1] ? +m[1] : null, norm(m[2])]);
  });
  const atualizado = (linhas.find(l => /ATUALIZADO AT/i.test(l)) || '').replace(/[()]/g, '').trim();
  const A = JSON.parse(JSON.stringify(est.almanaque || { listas: {}, arquivos: {} }));
  A.listas ||= {}; A.arquivos ||= {};
  const antes = A.arquivos[grupo];
  A.listas[grupo] = itens;
  A.arquivos[grupo] = { nome: nomeArq, importadoEm: new Date().toISOString(), qtd: itens.length, atualizado, por: est.quem };
  A.stamp = uid();
  return { A, grupo, qtd: itens.length, antes };
}

/* ================= datas e escalas de RP ================= */
function datasDaLinha(txt){
  const r = [], agora = new Date();
  for (const m of txt.matchAll(/\b(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*(\d{4}|\d{2})\b/g)){
    let [, d, mo, a] = m; if (a.length === 2) a = '20' + a;
    if (+mo >= 1 && +mo <= 12 && +d >= 1 && +d <= 31) r.push({ i: m.index, d: `${a}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}` });
  }
  for (const m of txt.matchAll(/(?<![\d\/.])(\d{2})\/(\d{2})(?![\d\/])/g)){
    const d = +m[1], mo = +m[2]; if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
    let a = agora.getFullYear(); if (mo < agora.getMonth() + 1 - 6) a++;
    r.push({ i: m.index, d: `${a}-${m[2]}-${m[1]}` });
  }
  const n = norm(txt);
  for (const m of n.matchAll(/\b(\d{1,2})\s*[º°O]?\s*DE\s+(JANEIRO|FEVEREIRO|MARCO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)\s+DE\s+(\d{4})/g))
    r.push({ i: m.index, d: `${m[3]}-${String(MESES[m[2]]).padStart(2, '0')}-${m[1].padStart(2, '0')}` });
  return r.sort((a, b) => a.i - b.i).map(x => x.d);
}
const dataDaLinha = txt => datasDaLinha(txt)[0] || null;
export const somaDias = (iso, n) => { const d = new Date(iso + 'T12:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
function periodoDaLinha(txt){
  const ds = datasDaLinha(txt);
  if (ds.length < 2 || !(ds[1] > ds[0]) || !/\s(A|AS|ATE)\s|\s-\s/.test(' ' + norm(txt) + ' ')) return null;
  if ((new Date(ds[1]) - new Date(ds[0])) / 864e5 > 31) return null;
  return { inicio: ds[0], fim: ds[1] };
}
/* Dias em que a pessoa NÃO pode ir para a ACO: do início até a véspera do fim. */
export function diasBloqueio(sec){
  if (!sec.data) return [];
  if (!sec.fim || sec.fim <= sec.data) return [sec.data];
  const r = []; for (let d = sec.data; d < sec.fim; d = somaDias(d, 1)) r.push(d);
  return r;
}
export function detectarData(linhas, nomeArq){
  for (const l of linhas){ const r = dataDaLinha(l); if (r) return r; }
  return dataDaLinha(String(nomeArq || '').replace(/_/g, '-')) || '';
}
const ehLinhaPessoa = l => { const p = parsePessoa(l); return !!((p.cpf || p.matricula || p.posto) && p.nome); };
export function segmentar(linhas, nomeArq){
  const secoes = []; let atual = null;
  let rodape = false;
  linhas.forEach(l => {
    const n = norm(l);
    if (/ASSINAD|ASSINATURA/.test(n) || /^([A-Z ]+,\s*)?\d{1,2}\s*[º°O]?\s*DE\s+[A-Z]+\s+DE\s+\d{4}\.?$/.test(n)){ rodape = true; return; }
    const d = dataDaLinha(l), per = periodoDaLinha(l);
    if (rodape){ if (!d) return; rodape = false; atual = null; }
    if (d && (!atual || atual.data !== d)){ atual = { data: d, fim: per?.fim || '', linhas: [] }; secoes.push(atual); }
    else if (per && atual && atual.data === per.inicio && !atual.fim) atual.fim = per.fim;
    if (!atual){ atual = { data: '', linhas: [] }; secoes.push(atual); }
    atual.linhas.push(l);
  });
  const reserva = dataDaLinha(nomeArq.replace(/_/g, '-')) || secoes.find(x => x.data)?.data || '';
  const unidas = [];
  secoes.forEach(x => {
    if (!x.data) x.data = reserva;
    if (!x.linhas.some(ehLinhaPessoa)) return;
    const ant = unidas[unidas.length - 1];
    if (ant && ant.data === x.data){ ant.linhas.push(...x.linhas); if (!ant.fim) ant.fim = x.fim; } else unidas.push(x);
  });
  return unidas.length ? unidas : [{ data: reserva, linhas }];
}
export const secoesDe = a => a.secoes || (a.secoes = segmentar(a.linhas, a.nome));

function prepararLinha(l){
  const n = norm(l);
  const dig = new Set();
  (n.match(/\d[\d.\-\/]*\d/g) || []).forEach(t => { dig.add(t.replace(/\D/g, '')); const m = t.match(/^(\d{5,10})-\d$/); if (m) dig.add(m[1]); });
  return { n: ' ' + n.replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ') + ' ', dig };
}
function cruzar(linhas, pessoas){
  const L = linhas.map(prepararLinha), usada = new Array(L.length).fill(false), achados = new Map();
  pessoas.forEach(p => L.forEach((x, i) => {
    if ((p.cpf && x.dig.has(p.cpf)) || (p.matricula && x.dig.has(p.matricula)) || (p.nome.length > 5 && x.n.includes(' ' + p.nome + ' '))){
      achados.set(p.k, 'exato'); usada[i] = true;
    }
  }));
  pessoas.forEach(p => {
    if (achados.has(p.k)) return;
    const t = p.nome.split(' ').filter(w => !STOP.has(w)); if (t.length < 2) return;
    const a = ' ' + t[0] + ' ', b = ' ' + t[t.length - 1] + ' ';
    L.forEach((x, i) => { if (!usada[i] && x.n.includes(a) && x.n.includes(b)){ achados.set(p.k, 'aproximado'); usada[i] = 'aprox'; } });
  });
  const naoEnc = [];
  linhas.forEach((l, i) => { if (usada[i]) return; const p = parsePessoa(l); if ((p.cpf || p.posto || p.matricula) && p.nome) naoEnc.push(l); });
  return { achados, naoEnc };
}

const acoCache = new Map();
let efCache = { stamp: null, pessoas: [] };
export const E = () => est.atual || { rp: [], efetivo: null };
export function efetivoPessoas(){
  const e = E().efetivo; if (!e) return [];
  const st = e.importadoEm + '|' + (est.almanaque?.stamp || '') + '|' + Object.keys(est.antigManual || {}).length;
  if (efCache.stamp !== st) efCache = { stamp: st, pessoas: pessoasDe(e.linhas, true).sort(porPatente) };
  return efCache.pessoas;
}
function resultadoSecao(a, i, sec, ef){
  const key = a.id + '#' + i + '|' + sec.linhas.length + '|' + (E().efetivo?.importadoEm || '');
  if (!acoCache.has(key)) acoCache.set(key, ef.length ? cruzar(sec.linhas, ef) : { achados: new Map(), naoEnc: [], proprios: pessoasDe(sec.linhas) });
  return acoCache.get(key);
}

/* ================= escalas e blocos ================= */
export const blocoAtivo = e => e.blocos.find(b => b.id === e.blocoAtivo) || e.blocos[0];
export const dataAtiva = e => blocoAtivo(e)?.data || e.data;
export const todasPessoas = e => e.blocos.flatMap(b => b.pessoas);

/* Junta tudo: quem está de RP em cada data, bloqueados na data da escala e disponíveis */
export function analisarACO(e, ref = dataAtiva(e)){
  const ef = efetivoPessoas(), efMap = new Map(ef.map(p => [p.k, p]));
  const porData = new Map(), bloq = new Map(), res = new Map();
  E().rp.filter(a => a.tipo === 'escala').forEach(a => secoesDe(a).forEach((sec, i) => {
    const r = resultadoSecao(a, i, sec, ef);
    const pessoas = ef.length ? [...r.achados.keys()].map(k => efMap.get(k)) : r.proprios;
    res.set(a.id + '#' + i, { r, pessoas });
    const dias = diasBloqueio(sec);
    dias.forEach(d => {
      if (!porData.has(d)) porData.set(d, { arquivos: [], mapa: new Map() });
      const pd = porData.get(d); if (!pd.arquivos.includes(a.nome)) pd.arquivos.push(a.nome); pessoas.forEach(p => pd.mapa.set(p.k, p));
    });
    const fora = (r.naoEnc || []).map(l => { const p = parsePessoa(l); p.k = 'F:' + (p.matricula || p.nome); p.ordem = ordemPosto(p.posto); return p; }).filter(p => p.nome);
    if (dias.includes(ref)){
      pessoas.forEach(p => {
        if (!bloq.has(p.k)) bloq.set(p.k, { p, arquivos: [], tipo: ef.length ? r.achados.get(p.k) : 'lido' });
        if (!bloq.get(p.k).arquivos.includes(a.nome)) bloq.get(p.k).arquivos.push(a.nome);
      });
      fora.forEach(p => { if (!bloq.has(p.k)) bloq.set(p.k, { p, arquivos: [a.nome], tipo: 'fora' }); });
    }
  }));
  const liberados = new Set((e.liberados || []).filter(x => x.startsWith(ref + '|')).map(x => x.slice(ref.length + 1)));
  const naEscala = new Set();
  est.escalas.forEach(x => (x.blocos || []).forEach(b => { if (b.data !== ref) return; b.pessoas.forEach(p => {
    if (p.k) naEscala.add(p.k);
    if (x.id !== e.id && (p.k || p.nome)){ const k = p.k || ('N:' + norm(p.nome)); if (!bloq.has(k)) bloq.set(k, { p: { k, posto: p.posto, nome: norm(p.nome), matricula: String(p.matricula || '').replace(/\D/g, ''), ordem: ordemPosto(p.posto) }, arquivos: [`ACO Nº ${x.doc?.numero || ''} de ${dataBR(ref)}`], tipo: 'aco' }); }
  }); }));
  const todos = [...bloq.values()].sort((a, b) => porPatente(a.p, b.p));
  const bloqueados = todos.filter(b => !liberados.has(b.p.k));
  const bloqSet = new Set(bloqueados.map(b => b.p.k));
  const bloqNomes = new Set(bloqueados.map(b => b.p.nome));
  const bloqMats = new Set(bloqueados.map(b => b.p.matricula).filter(Boolean));
  const disponiveis = ef.filter(p => !bloqSet.has(p.k) && !naEscala.has(p.k));
  return { ef, res, porData, bloqueados, bloqSet, bloqNomes, bloqMats, liberadosLista: todos.filter(b => liberados.has(b.p.k)), disponiveis };
}
export const linhaBloqueada = (r, A) => (r.k && A.bloqSet.has(r.k)) || (r.nome && A.bloqNomes.has(norm(r.nome))) || (r.matricula && A.bloqMats.has(String(r.matricula).replace(/\D/g, '')));

export const DOC_PADRAO = {
  cab1: 'COMANDO REGIONAL DE POLICIAMENTO – 1ª REGIÃO',
  cab2: '8º BATALHÃO DE POLÍCIA MILITAR',
  titulo: 'ESCALA DE SERVIÇO',
  numero: '',
  operacao: '',
  sgd: '',
  uniforme: 'Uniforme – 5º A e variações, completo com cinto de guarnição e apetrechos para emprego no Operacional.',
  armamento: 'pistola cal. 9mm e/ou .40, revólver cal. .38, carabina cal. .40 e cal. 5,56, escopeta cal. 12, colete balístico, algema, bastão policial, rádio HT, lanterna, cordão retrátil, apito, canivete multiuso, luvas descartáveis, bloco de anotação, caneta (conforme POP 101) e colete refletivo.',
  obs: 'Policiamento de Reforço Operacional;\nProvidenciar **fotos do evento** e enviar no grupo do WhatsApp do Batalhão, com dados de horário e local;',
  enquadramento: 'Enquadramento no local, conforme o horário a seguir:',
  localDoc: 'Quartel do 8º BPM em Paraíso do Tocantins -TO',
  dataDoc: '',
  linhaAss: 'Assinatura digital',
  signatario: '**Robson** Santos Sousa – **TEN CEL QOPM**',
  cargo: 'Comandante do 8º BPM'
};
export const HORARIO_PADRAO = 'Das 08h00 às 20h00.';
export const CIDADES = [['Paraíso do Tocantins', 'PARAÍSO'], ['Monte Santo', 'MONTE SANTO'], ['Campina Verde', 'CAMPINA VERDE'], ['Divinópolis do Tocantins', 'DIVINÓPOLIS DO TOCANTINS'], ['Abreulândia', 'ABREULÂNDIA'], ['Dois Irmãos', 'DOIS IRMÃOS'], ['Araguacema', 'ARAGUACEMA'], ['Marianópolis', 'MARIANÓPOLIS'], ['Caseara', 'CASEARA'], ['Barrolândia', 'BARROLÂNDIA'], ['Chapada de Areia', 'CHAPADA DE AREIA'], ['Pugmil', 'PUGMIL']];
export const nomeCidade = local => CIDADES.find(c => c[1] === local)?.[0] || local;

/* ACO completa = 12h; meia ACO = 6h */
export const minDe = t => { const m = String(t || '').match(/(\d{1,2})\s*[h:]\s*(\d{2})?/i); return m ? (+m[1] % 24) * 60 + (+(m[2] || 0)) : null; };
export const hm = min => { min = ((min % 1440) + 1440) % 1440; return `${String(Math.floor(min / 60)).padStart(2, '0')}h${String(min % 60).padStart(2, '0')}`; };
export const iniBloco = b => minDe(b?.inicio) ?? 480;
export const faixaPessoa = (b, r) => { const i = iniBloco(b); return [i, i + (r?.meia ? 360 : 720)]; };
export const durBloco = b => (b?.tipo && b.tipo !== 'c') ? 360 : 720;
export const hInput = min => { min = ((min % 1440) + 1440) % 1440; return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`; };
export function horarioPessoa(b, r){ const [a, z] = faixaPessoa(b, r); return `Das ${hm(a)} às ${hm(z)}.`; }
export const tipoParaPessoa = t => ({ meia: !!t && t !== 'c', metade: 1 });
export function aplicarTipoBloco(b, t){
  b.tipo = t || 'c';
  b.pessoas.forEach(r => Object.assign(r, tipoParaPessoa(b.tipo)));
  b.horario = horarioPessoa(b, tipoParaPessoa(b.tipo));
}
export function novoBloco(data, base){ const b = { id: uid(), data, local: base?.local || '', inicio: base?.inicio || '08:00', tipo: 'c', pessoas: [] }; b.horario = horarioPessoa(b); return b; }
/* garante o formato atual da escala */
export function migrarEscala(e){
  if (!e.blocos){
    e.blocos = [{ id: uid(), data: e.data || hojeISO(), local: e.local || '', horario: e.horario || HORARIO_PADRAO, pessoas: (e.pessoas || []).map(p => ({ ...p })) }];
    delete e.pessoas;
  }
  if (!e.doc) e.doc = { ...DOC_PADRAO, dataDoc: hojeISO() };
  for (const k in DOC_PADRAO) if (e.doc[k] === undefined) e.doc[k] = DOC_PADRAO[k];
  e.liberados = (e.liberados || []).map(x => x.includes('|') ? x : (e.data + '|' + x));
  e.blocos.forEach(b => b.pessoas.forEach(p => { p.guerra ||= []; if (p.rg === undefined) p.rg = ''; }));
  e.blocos.forEach(b => { if (!b.inicio){ const m = minDe(b.horario); b.inicio = m == null ? '08:00' : hInput(m); } if (!b.tipo) b.tipo = b.pessoas[0]?.meia ? (b.pessoas[0].metade === 2 ? 'm2' : 'm') : 'c'; if (b.tipo === 'm2'){ b.inicio = hInput(iniBloco(b) + 360); b.tipo = 'm'; } if (b.tipo === 'm1') b.tipo = 'm'; aplicarTipoBloco(b, b.tipo); });
  // (as escalas que não estão abertas vêm do banco sem os arquivos; nunca são gravadas inteiras)
  e.rp ||= []; if (e.efetivo === undefined) e.efetivo = null;
  if (!e.data) e.data = e.blocos[0]?.data || hojeISO();
  return e;
}
export function proximoNumero(data){
  const mes = (data || hojeISO()).slice(0, 7);
  const nums = [...est.escalas.filter(x => (x.data || '').slice(0, 7) === mes).map(x => parseInt(x.doc?.numero) || 0), ...Object.values(est.historico || {}).filter(h => (h.data || '').slice(0, 7) === mes).map(h => parseInt(h.numero) || 0)];
  return String((nums.length ? Math.max(...nums) : 0) + 1).padStart(2, '0');
}
export function rotuloData(iso){
  if (!iso) return 'Sem data';
  const h = hojeISO();
  if (iso === h) return 'Hoje';
  if (iso === hojeISO(1)) return 'Amanhã';
  return iso < h ? 'Passada' : 'Futura';
}
/* ordem do bloco é sempre: 1º patente, 2º antiguidade do almanaque */
export function ordenarBloco(b){
  const antes = b.pessoas.map(r => r.id).join();
  b.pessoas.sort(porPatente);
  return antes !== b.pessoas.map(r => r.id).join();
}
/* blocos como estavam na última geração (para manter a ACO antiga quando a nova é separada) */
export function blocosGerados(e){
  if (e.snapBlocos) return JSON.parse(JSON.stringify(e.snapBlocos));
  const mapa = new Map();
  (e.contabilizado || []).forEach(x => {
    const ch = x.data + '|' + x.local;
    if (!mapa.has(ch)){ const atual = e.blocos.find(b => b.data === x.data && b.local === x.local); mapa.set(ch, { id: uid(), data: x.data, local: x.local, inicio: atual?.inicio || '08:00', tipo: x.meia ? 'm' : 'c', pessoas: [] }); }
    mapa.get(ch).pessoas.push({ id: uid(), k: x.k, posto: x.posto, rg: '', nome: x.nome, guerra: x.guerra || [], matricula: x.matricula, cpf: '', meia: !!x.meia, metade: 1 });
  });
  const r = [...mapa.values()]; r.forEach(b => b.horario = horarioPessoa(b, tipoParaPessoa(b.tipo)));
  return r;
}
export const blocosParaPdf = e => e.blocos.map((b, i) => ({ b, i })).filter(x => x.b.pessoas.length).sort((x, y) => x.b.data.localeCompare(y.b.data) || x.i - y.i).map(x => x.b);
export const nomeArquivoACO = e => { const mes = MESES_NOME[+e.data.slice(5, 7) - 1], D = e.doc; return `ACO Nº ${D.numero || 'SN'}-${e.data.slice(0, 4)} - ${mes}${D.operacao ? ' - ' + D.operacao.replace(/[\\/:*?"<>|]/g, '') : ''}.pdf`; };
export const PRAZO_LIXEIRA = 24 * 60 * 60 * 1000;
export function tempoRestante(e){
  const ms = PRAZO_LIXEIRA - (Date.now() - new Date(e.excluidaEm).getTime());
  if (ms <= 0) return 'some agora';
  const h = Math.floor(ms / 36e5), m = Math.floor(ms % 36e5 / 6e4);
  return 'some em ' + (h ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`);
}
