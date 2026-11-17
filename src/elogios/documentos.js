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
