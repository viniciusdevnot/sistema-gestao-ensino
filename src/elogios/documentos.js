/* Elogios ⇄ motor de documentos (Manual de Redação): monta o Ofício, o Despacho e o Item para Boletim
   com a formatação, os espaçamentos e o cabeçalho padrão dos modelos do manual. */
import { prepararDocumentos } from '../legado/ponte.js';
import { camposOficio, conteudoDespacho, conteudoItem, hojeISO } from './regras.js';

export const MODELO_DESPACHO = 'm9', MODELO_ITEM = 'm23';
let motor = null;
export async function motorDocs(opts){ motor = await prepararDocumentos(opts); return motor.doc; }
const D = () => { if (!motor) throw new Error('Os documentos ainda não carregaram.'); return motor.doc; };

/* ---------- 1) Ofício ---------- */
export function criarOficio(e){
  const d = D(), base = d.base();
  const c = camposOficio({ ...e, _dataOficio: hojeISO() }, base);
  const o = d.novoOficio({ ...c, data: hojeISO(), ano: hojeISO().slice(0, 4), sgd: e.oficio?.sgd || '' });
  return o;
}
/* põe no ofício os dados atuais do pedido (destinatário, assunto, texto e assinatura) */
export function atualizarOficio(o, e){
  const c = camposOficio({ ...e, _dataOficio: o.campos.data || hojeISO() }, D().base());
  const setoresMudaram = JSON.stringify(c.setores) !== JSON.stringify(o.campos.setores);
  Object.assign(o.campos, c); o.campos.ov = {};
  if (setoresMudaram) o.campos.numero = '';
  o.alteradoEm = new Date().toISOString();
  return o;
}
export const acharDoc = (tipo, id) => id ? D().achar(tipo, id) : null;
export const infoOficio = o => o ? { id: o.id, epigrafe: D().epigrafe(o.campos), numero: o.campos.numero, ano: o.campos.ano, sgd: o.campos.sgd || '', data: o.campos.data } : null;

/* ---------- 2) Despacho e 3) Item para Boletim (montados sobre os modelos do manual) ---------- */
const vazio = b => b.t === 'p' && !b.img && !String(b.txt || '').trim();
function papel(b, antes){
  if (b.t !== 'p' || b.img) return 'fixo';
  const t = String(b.txt || '').replace(/\*\*|\+\+/g, '').trim();
  if (!t) return 'branco';
  if (/^(DESPACHO|ITEM PARA)\b.*N[º°]/i.test(t)) return 'titulo';
  if (/^SGD:/i.test(t)) return 'sgd';
  if (/^\+\+/.test(String(b.txt).trim())) return 'secao';
  if (b.rot) return 'item';
  if (/^À\s|^Ao\s|^Aos\s|^Às\s/.test(t) && /:\s*$/.test(t)) return 'destinatario';
  if (/\d{4}\.$/.test(t) && /\bde\b/.test(t)) return 'local';
  if (/^Assinatura digital$/i.test(t)) return 'assdig';
  if (antes === 'assdig') return 'assinatura';
  if (antes === 'assinatura') return 'funcao';
  return antes === 'inicio' ? 'fixo' : 'texto';
}
function montarBlocos(blocos, c){
  const out = []; let antes = 'inicio', itensFeitos = false;
  for (const b of blocos){
    const p = papel(b, antes);
    if (p === 'fixo' || p === 'branco'){ out.push(b); if (p !== 'branco' && antes === 'inicio') antes = 'inicio'; continue; }
    if (p === 'titulo'){ out.push({ ...b, txt: c.titulo }); antes = 'titulo'; continue; }
    antes = p;
    if (p === 'sgd') out.push({ ...b, txt: c.sgd || 'SGD: ' });
    else if (p === 'destinatario'){ if (c.destinatario) out.push({ ...b, txt: c.destinatario }); }
    else if (p === 'secao'){ if (c.secao) out.push({ ...b, txt: c.secao }); }
    else if (p === 'item'){
      if (itensFeitos) continue; itensFeitos = true;
      let n = 0;
      c.itens.forEach(it => {
        const x = typeof it === 'string' ? { txt: it } : it;
        if (x.sub) out.push({ ...b, rot: '–', il: (b.il || 0) + 426, fl: -284, txt: x.txt });
        else { n++; out.push({ ...b, rot: incRot(b.rot, n), txt: x.txt }); }
      });
    }
    else if (p === 'local') out.push({ ...b, txt: c.local });
    else if (p === 'assdig') out.push(b);
    else if (p === 'assinatura') out.push({ ...b, txt: c.assinatura });
    else if (p === 'funcao') out.push({ ...b, txt: c.funcao });
    // 'texto' do exemplo do manual que não é do pedido: sai
  }
  // tira brancos repetidos que sobraram de trechos do exemplo
  return out.filter((b, k) => !(vazio(b) && vazio(out[k - 1] || {}) && vazio(out[k - 2] || {})));
}
const incRot = (r, n) => /^\d+\.$/.test(r) ? `${n}.` : /^[a-z]\)$/.test(r) ? `${String.fromCharCode(96 + n)})` : /^[A-Z]\)$/.test(r) ? `${String.fromCharCode(64 + n)})` : r;

export function criarDespacho(e, a){ return D().novoDocM(MODELO_DESPACHO, bl => montarBlocos(bl, conteudoDespacho(e, a))); }
export function criarItem(e, a){ return D().novoDocM(MODELO_ITEM, bl => montarBlocos(bl, conteudoItem(e, a))); }
export function refazerDocM(o, tipo, e, a){
  const d = D();
  const novo = d.novoDocM(tipo === 'despacho' ? MODELO_DESPACHO : MODELO_ITEM, bl => montarBlocos(bl, tipo === 'despacho' ? conteudoDespacho(e, a) : conteudoItem(e, a)));
  o.blocos = novo.blocos; o.alteradoEm = new Date().toISOString(); d.remover('docm', novo.id); return o;
}
/* próximo número livre de Despacho / Item para Boletim do ano (entre os documentos de quem autoriza) */
export function proximoNumero(tipo, ano, sigla){
  const re = tipo === 'despacho' ? /DESPACHO\s+N[º°]\s*(\d+)\/(\d{4})/i : /ITEM PARA B[IG]\s+N[º°]\s*(\d+)\/(\d{4})/i;
  let max = 0;
  for (const o of D().docsM()) for (const b of o.blocos || []){
    const m = re.exec(String(b.txt || '').replace(/\*\*/g, '')); if (m && m[2] === String(ano)) max = Math.max(max, +m[1]);
  }
  return max + 1;
}
export const nomeDoc = (tipo, o) => tipo === 'oficio' ? D().nomeOficio(o) : D().nomeDocM(o) + '.pdf';
export async function pdfDe(tipo, o){ return tipo === 'oficio' ? D().pdfOficio(o) : D().pdfDocM(o); }
export function abrirNoEditor(tipo, id){ D().abrir(tipo === 'oficio' ? 'oficio' : 'docm', id, 'elogios'); }
export const removerDoc = (tipo, id) => { try { D().remover(tipo === 'oficio' ? 'oficio' : 'docm', id); } catch {} };
/* dados da unidade e da assinatura: do último ofício da pessoa; sem ofício, só o padrão da unidade (sem assinatura) */
export function baseUnidade(perfil){
  const d = D(), m = d.minha(), b = d.base();
  if (m) return m;
  return { ...b, sigNome: perfil?.nome || '', sigGuerra: [], sigPosto: perfil?.posto || '', sigFuncao: '' };
}

/* ---------- P1: levar o Item para Boletim para um boletim (modelo “Boletim” do Manual de Redação) ---------- */
export const MODELO_BOLETIM = 'm22';
const plano = b => String(b?.txt || '').replace(/\*\*|\+\+/g, '').trim();
const ehBoletim = o => o.modeloId === MODELO_BOLETIM || /^BOLETIM$/i.test(String(o.modelo || '').trim());
export const meusBoletins = () => D().docsM().filter(ehBoletim).sort((a, b) => (b.alteradoEm || '').localeCompare(a.alteradoEm || ''));
// parágrafos do item (a), b), – …) que vão para dentro do boletim
function paragrafosDoItem(item){ return (item?.blocos || []).filter(b => b.t === 'p' && !b.img && b.rot && plano(b)).map(b => JSON.parse(JSON.stringify(b))); }
/* coloca o texto do item na 4ª parte do boletim, abaixo de “ELOGIO” ou “REFERÊNCIA ELOGIOSA”; sem esse título, no fim, antes da assinatura */
function inserir(blocos, e, item){
  const ps = paragrafosDoItem(item); if (!ps.length) throw new Error('O Item para Boletim deste pedido está vazio.');
  const re = e.tipo === 'elogio' ? /^ELOGIOS?$/i : /^REFER[ÊE]NCIAS? ELOGIOSAS?$/i;
  let i = blocos.findIndex(b => b.t === 'p' && re.test(plano(b)));
  let base;
  if (i >= 0){
    base = blocos[i];
    // depois dos parágrafos que já estão nesse título (até o próximo título numerado “2.”, “3.”… ou parte)
    let j = i + 1;
    while (j < blocos.length && blocos[j].t === 'p' && !( /^\d+\.$/.test(blocos[j].rot || '') && (blocos[j].il || 0) <= (base.il || 0)) && !/^\*\*\+\+/.test(String(blocos[j].txt || '').trim()) && plano(blocos[j]) !== 'Assinatura digital') j++;
    const ja = blocos.slice(i + 1, j).filter(b => /^[a-z]\)$/.test(b.rot || '')).length;
    let n = ja;
    const novos = ps.map(b => ({ ...b, il: (base.il || 0) + 426, fl: -426, rot: /^[a-z]\)$/.test(b.rot || '') ? String.fromCharCode(97 + n++) + ')' : b.rot, sb: 0, sa: 6 }));
    // tira um parágrafo vazio do modelo logo abaixo do título, se houver
    blocos.splice(j, 0, ...novos);
  } else {
    const k = blocos.findIndex(b => plano(b) === 'Assinatura digital');
    const titulo = { ...(ps[0]), rot: '', il: 0, fl: 0, txt: e.tipo === 'elogio' ? '++ELOGIO++' : '++REFERÊNCIA ELOGIOSA++' };
    blocos.splice(k >= 0 ? k : blocos.length, 0, titulo, ...ps);
  }
  return blocos;
}
export function novoBoletimComItem(e, item){
  const ano = new Date().getFullYear(), BI = e.publicacao?.boletim !== 'BG';
  return D().novoDocM(MODELO_BOLETIM, bl => {
    const t = bl.find(b => b.t === 'p' && /^BOLETIM (GERAL|INTERNO)\s+N[º°]/i.test(plano(b)));
    if (t) t.txt = `**BOLETIM ${BI ? 'INTERNO' : 'GERAL'} Nº ___/${ano}${BI && e.publicacao?.unidade ? ' – ' + e.publicacao.unidade : ''}**`;
    return inserir(bl, e, item);
  });
}
export function juntarAoBoletim(id, e, item){
  const o = D().achar('docm', id); if (!o) throw new Error('Boletim não encontrado entre os seus documentos.');
  inserir(o.blocos, e, item); D().salvar(o); return o;
}
