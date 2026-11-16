/* Ponte entre o motor de documentos (src/legado/documentos.js) e o React + banco de dados.
   - Carrega ofícios, ordens de serviço e documentos do banco para `db` (mesma estrutura do sistema anterior).
   - Grava sozinho o que mudou (0,8 s depois da última alteração) e apaga o que foi excluído.
   - Manuais: o de Redação vem embutido (public/manual-redacao.json) ou o que o administrador importou;
     o MPPADMIS vem embutido (public/modelos-mppadmis.json). */
import { sb } from '../lib/supabase.js';
import { norm, dataBR, hojeISO, MESES_NOME } from '../aco/logica.js';
import { carregarPdfjs, carregarPdfLib, baixar } from '../aco/pdf.js';
import { VIEWS } from '../lib/catalogo.js';
import { TELAS } from './telas.js';

const TABELAS = { oficios: 'oficios', ordensServico: 'ordens_servico', docsManual: 'documentos' };
const db = { oficios: [], ordensServico: [], docsManual: [], manualRedacao: null };
let snap = {}, manualSalvo = null, mppadmis = null, mppInfo = null, motor = null, caixa = null, guarda = null;
let bannerBytes = null, timer = null, salvando = null, ctx = { perfil: null, admin: false, registrar: () => {}, avisar: () => {}, ir: () => {}, aoSalvar: () => {} };

const $ = s => document.querySelector(s);
function el(tag, props = {}, ...filhos){
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)){
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'value') e.value = v;
    else if (k.startsWith('on')) e[k] = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  filhos.flat().forEach(f => { if (f !== null && f !== undefined && f !== false) e.append(f instanceof Node ? f : document.createTextNode(f)); });
  return e;
}
const uid = () => crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
const quemSou = () => [ctx.perfil?.posto, ctx.perfil?.nome].filter(Boolean).join(' ') || 'Sistema';

/* ---------- banco ---------- */
const paraObj = l => ({ ...(l.dados || {}), id: l.id, autorId: l.autor_id, autor: l.dados?.autor || l.autor || '' });
const tituloDe = (k, o) => k === 'oficios' ? `${o.campos?.tipoDoc || 'Ofício'} nº ${o.campos?.numero || ''}/${o.campos?.ano || ''} ${o.campos?.assunto ? '– ' + o.campos.assunto : ''}`.trim()
  : k === 'ordensServico' ? `O.S. nº ${o.campos?.numero || ''}/${o.campos?.ano || ''} ${o.campos?.evento ? '– ' + o.campos.evento : ''}`.trim()
  : (o.titulo || o.modelo || 'Documento');
const tipoDe = (k, o) => k === 'docsManual' ? (o.cat || '') : k === 'oficios' ? (o.campos?.tipoDoc || 'oficio') : 'os';

async function carregar(){
  const [res, cfg] = await Promise.all([
    Promise.all(Object.entries(TABELAS).map(([k, t]) => sb.from(t).select('*').is('excluido_em', null).then(r => [k, r]))),
    sb.from('configuracoes').select('chave, valor').in('chave', ['manual_redacao', 'mppadmis'])
  ]);
  snap = {};
  for (const [k, r] of res){
    if (r.error) throw new Error(r.error.message);
    db[k] = (r.data || []).map(paraObj);
    snap[k] = new Map(db[k].map(o => [o.id, JSON.stringify(o)]));
  }
  const c = Object.fromEntries((cfg.data || []).map(x => [x.chave, x.valor]));
  db.manualRedacao = c.manual_redacao || await fetch('/manual-redacao.json').then(r => r.ok ? r.json() : null).catch(() => null);
  manualSalvo = db.manualRedacao;
  if (c.mppadmis?.modelos){ mppadmis = c.mppadmis.modelos; mppInfo = { nome: c.mppadmis.nome, importadoEm: c.mppadmis.importadoEm, por: c.mppadmis.por }; }
  else { mppadmis = await fetch('/modelos-mppadmis.json').then(r => r.ok ? r.json() : []).catch(() => []); mppInfo = null; }
}

async function salvarAgora(){
  clearTimeout(timer); timer = null;
  if (salvando) await salvando;
  salvando = (async () => {
    let erro = null;
    for (const [k, t] of Object.entries(TABELAS)){
      const atual = new Map((db[k] || []).map(o => [o.id, o])), antes = snap[k] || new Map();
      for (const [id, o] of atual){
        const j = JSON.stringify(o); if (antes.get(id) === j) continue;
        const dados = JSON.parse(j); delete dados.id; delete dados.autorId;
        const { error } = await sb.from(t).upsert({ id, autor_id: o.autorId || ctx.perfil?.id, autor: o.autor || '', titulo: tituloDe(k, o).slice(0, 200), tipo: tipoDe(k, o), dados, alterado_em: new Date().toISOString() });
        if (error){ erro = error; continue; }
        antes.set(id, j);
      }
      for (const id of [...antes.keys()]) if (!atual.has(id)){
        const { error } = await sb.from(t).delete().eq('id', id);
        if (error){ erro = error; continue; }
        antes.delete(id);
      }
      snap[k] = antes;
    }
    if (db.manualRedacao !== manualSalvo && ctx.admin){
      const { error } = await sb.from('configuracoes').upsert({ chave: 'manual_redacao', valor: db.manualRedacao, alterado_em: new Date().toISOString(), alterado_por: ctx.perfil?.id });
      if (error) erro = error; else manualSalvo = db.manualRedacao;
    }
    if (erro) ctx.avisar('Não consegui salvar: ' + erro.message, 'err');
    ctx.aoSalvar?.();
  })();
  try { await salvando; } finally { salvando = null; }
}
const agendarSalvar = () => { clearTimeout(timer); timer = setTimeout(salvarAgora, 800); };
export const temPendente = () => !!timer || !!salvando;
export const salvarPendente = () => (timer || salvando) ? salvarAgora() : Promise.resolve();
addEventListener('beforeunload', ev => { if (timer){ salvarAgora(); ev.preventDefault(); ev.returnValue = ''; } });

/* ---------- montagem (uma vez por sessão do navegador) ---------- */
export async function prepararDocumentos(opts){
  Object.assign(ctx, opts);
  if (!motor){
    await carregar();
    guarda = document.createElement('div'); guarda.hidden = true; document.body.appendChild(guarda);
    caixa = document.createElement('div'); caixa.className = 'legado-docs'; caixa.innerHTML = TELAS;
    guarda.appendChild(caixa);
    const { montar } = await import('./documentos.js');
    motor = montar({
      db, $, el, uid, norm, dataBR, hojeISO, MESES_NOME, VIEWS, carregarPdfjs, carregarPdfLib, baixar, agendarSalvar, quemSou,
      registrar: (tipo, acao) => ctx.registrar(tipo, acao),
      status: (t, cls) => ctx.avisar(t, cls === 'warn' ? 'warn' : cls === 'err' ? 'err' : 'ok'),
      perfilAtual: () => ctx.perfil || {},
      irPara: v => ctx.ir(v),
      mppadmis: () => mppadmis,
      // cabeçalho padrão (Ofício Circular nº 022/2025/GCG): brasão da PMTO + TOCANTINS/Governo do Estado + brasão do Estado
      banner: () => bannerBytes ||= fetch('/cabecalho-pmto.jpg').then(r => { if (!r.ok) throw new Error('Imagem do cabeçalho não encontrada'); return r.arrayBuffer(); }).then(b => new Uint8Array(b)),
      get perfilId(){ return ctx.perfil?.id; },
      get admin(){ return ctx.admin; },
      view: ''
    });
  }
  return motor;
}
/* coloca as telas dentro do React (no) e mostra a seção da view */
export function mostrar(no, view){
  if (!motor || !no) return;
  no.appendChild(caixa);
  const sec = /^dm-/.test(view) ? 'docm' : view;
  caixa.querySelectorAll('.view').forEach(s => s.classList.toggle('ativa', s.id === 'view-' + sec));
  motor.setView(view);
  if (view === 'oficio') motor.renderOficios();
  else if (view === 'os') motor.renderOS();
  else motor.renderDocM();
}
export function esconder(){ if (caixa && guarda && caixa.parentNode !== guarda) guarda.appendChild(caixa); motor?.setView(''); }
/* ao sair da conta: esquece tudo */
export function zerarDocumentos(){ esconder(); if (caixa) caixa.remove(); if (guarda) guarda.remove(); motor = null; caixa = null; guarda = null; snap = {}; db.oficios = []; db.ordensServico = []; db.docsManual = []; db.manualRedacao = null; }

/* Manual de Procedimentos (MPPADMIS): qual está em uso e importação de um PDF novo (só administrador) */
export const infoMppadmis = () => ({ qtd: (mppadmis || []).length, ...(mppInfo || { nome: 'Manual de Processos e Procedimentos Administrativos da PMTO (embutido no sistema)' }), embutido: !mppInfo });
export async function importarMppadmis(file, prog){
  if (!ctx.admin) throw new Error('Só o administrador pode trocar o manual de procedimentos.');
  const { lerMppadmis } = await import('./mppadmis.js');
  const modelos = await lerMppadmis(file, prog);
  if (modelos.length < 10) throw new Error(`Só encontrei ${modelos.length} modelo(s) neste PDF. Confira se é o Manual de Processos e Procedimentos Administrativos (MPPADMIS).`);
  const valor = { nome: file.name, importadoEm: new Date().toISOString(), por: quemSou(), modelos };
  const { error } = await sb.from('configuracoes').upsert({ chave: 'mppadmis', valor, alterado_em: valor.importadoEm, alterado_por: ctx.perfil?.id });
  if (error) throw new Error(error.message);
  mppadmis = modelos; mppInfo = { nome: valor.nome, importadoEm: valor.importadoEm, por: valor.por };
  motor?.recarregarProc();
  ctx.registrar('arquivo', `importou o manual de procedimentos “${file.name}” (${modelos.length} modelos)`);
  return modelos.length;
}
export async function voltarMppadmisEmbutido(){
  if (!ctx.admin) return;
  const { error } = await sb.from('configuracoes').delete().eq('chave', 'mppadmis');
  if (error) throw new Error(error.message);
  mppadmis = await fetch('/modelos-mppadmis.json').then(r => r.json()); mppInfo = null; motor?.recarregarProc();
  ctx.registrar('arquivo', 'voltou ao manual de procedimentos embutido no sistema');
}
export const rerender = view => { if (motor && caixa?.parentNode && caixa.parentNode !== guarda) mostrar(caixa.parentNode, view); };
