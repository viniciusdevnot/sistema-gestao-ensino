/* Leitura do Manual de Processos e Procedimentos Administrativos (MPPADMIS) em PDF:
   cada "MODELO DE …" do manual (o texto dentro da caixa) vira um modelo editável,
   com o texto do manual que vem antes dele como regras. Mesma lógica usada para montar
   os modelos embutidos (public/modelos-mppadmis.json). */
import { carregarPdfjs } from '../aco/pdf.js';

const LEFT_TXT = 85.1;

/* retângulos da página (bordas das caixas e o traço das notas de rodapé), em coordenadas de cima para baixo */
async function retangulos(pdfjs, pg, vp){
  let ol; try { ol = await pg.getOperatorList(); } catch { return []; }
  const O = pdfjs.OPS, R = [];
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  let ctm = [1, 0, 0, 1, 0, 0]; const pilha = [];
  const pt = (x, y) => vp.convertToViewportPoint(ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]);
  ol.fnArray.forEach((f, i) => {
    const a = ol.argsArray[i];
    if (f === O.save) pilha.push(ctm);
    else if (f === O.restore) ctm = pilha.pop() || [1, 0, 0, 1, 0, 0];
    else if (f === O.transform) ctm = mul(ctm, a);
    else if (f === O.constructPath){
      const op = a[0], d = a[1]?.[0];
      if (op === O.endPath || !d || !d.length) return;
      let k = 0, pts = [];
      const fechar = () => {
        if (pts.length >= 2){
          const ps = pts.map(([x, y]) => pt(x, y)), xs = ps.map(p => p[0]), ys = ps.map(p => p[1]);
          R.push({ x0: Math.min(...xs), x1: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) });
        }
        pts = [];
      };
      while (k < d.length){
        const c = d[k++];
        if (c === 0){ fechar(); pts.push([d[k++], d[k++]]); }
        else if (c === 1) pts.push([d[k++], d[k++]]);
        else if (c === 2){ k += 4; pts.push([d[k++], d[k++]]); }
        else if (c === 3){ k += 2; pts.push([d[k++], d[k++]]); }
        else if (c === 4){ if (pts.length) pts.push(pts[0]); }
        else break;
      }
      fechar();
    }
  });
  return R;
}

/* letras da página (como o pdfplumber: x0, x1, bottom, size, fontname) */
async function letras(pg, vp){
  const tc = await pg.getTextContent();
  const cs = [];
  for (const it of tc.items){
    if (!it.str) continue;
    const t = it.transform, size = Math.hypot(t[0], t[1]) || Math.abs(t[3]) || 10;
    const [x, yb] = vp.convertToViewportPoint(t[4], t[5]);
    let fonte = '';
    try { const f = pg.commonObjs.get(it.fontName); fonte = f?.name || f?.loadedName || ''; } catch {}
    if (!fonte) fonte = tc.styles?.[it.fontName]?.fontFamily || '';
    // espaços não viram letras: o espaço entre palavras sai da distância entre elas (como no leitor original)
    const chars = [...it.str], w = (it.width || 0) / Math.max(1, chars.length);
    chars.forEach((ch, i) => !ch.trim() ? null : cs.push({ text: ch, x0: x + i * w, x1: x + (i + 1) * w, bottom: yb + size * 0.22, size, fontname: fonte }));
  }
  return cs;
}

function caixas(rects){
  const lados = rects.filter(r => r.x1 - r.x0 < 2.5 && r.bottom - r.top > 3);
  const L = lados.filter(r => r.x0 < 120), Rr = lados.filter(r => r.x0 > 480);
  const faixas = [];
  L.sort((a, b) => a.top - b.top).forEach(r => {
    const f = faixas[faixas.length - 1];
    if (f && Math.abs(r.top - f[3]) < 2.5 && Math.abs(r.x0 - f[0]) < 2) f[3] = r.bottom;
    else faixas.push([r.x0, null, r.top, r.bottom]);
  });
  faixas.forEach(f => { const c = Rr.filter(r => r.top >= f[2] - 3 && r.bottom <= f[3] + 3).map(r => r.x0); f[1] = c.length ? Math.max(...c) : 545; });
  return faixas;
}

function linhas(chars){
  const grupos = [];
  chars.filter(c => c.text !== '\n').sort((a, b) => (Math.round(a.bottom) - Math.round(b.bottom)) || (a.x0 - b.x0)).forEach(c => {
    const y = c.bottom;
    let g = c.size >= 9 ? grupos.find(g => Math.abs(g.y - y) < 2.2) : null;
    if (c.size < 9){ g = grupos.find(g => (g.y - y) > -1 && (g.y - y) < 6); if (g){ (g.sup ||= []).push(c); return; } }
    if (!g){ g = { y, cs: [] }; grupos.push(g); }
    g.cs.push(c);
  });
  const out = [];
  grupos.forEach(g => {
    const big = g.cs.sort((a, b) => a.x0 - b.x0).filter(c => c.size >= 9);
    if (!big.length) return;
    const runs = []; let prev = null;
    big.forEach(c => {
      let t = c.text;
      if (prev && c.x0 - prev.x1 > 1.6 && t !== ' ' && prev.text !== ' ') t = ' ' + t;
      const st = [/Bold/.test(c.fontname), /Oblique|Italic/.test(c.fontname)];
      const u = runs[runs.length - 1];
      if (u && u[0][0] === st[0] && u[0][1] === st[1]) u[1] += t; else runs.push([st, t]);
      prev = c;
    });
    const txt = runs.map(r => r[1]).join('');
    if (!txt.trim()) return;
    const vis = big.filter(c => c.text.trim());
    const cont = {}; big.forEach(c => { const s = Math.round(c.size); cont[s] = (cont[s] || 0) + 1; });
    out.push({ y: g.y, x0: Math.min(...vis.map(c => c.x0)), x1: Math.max(...vis.map(c => c.x1)), runs, txt, size: +Object.entries(cont).sort((a, b) => b[1] - a[1])[0][0], bold: runs.filter(r => r[1].trim()).every(r => r[0][0]) });
  });
  return out.sort((a, b) => a.y - b.y);
}

function marcar(runs){
  // os espaços nas bordas de um trecho em negrito/itálico ficam fora das marcas ("**Nome:** texto", "defensor *ad hoc* para")
  let s = '', b = false, i = false, pend = '';
  runs.forEach(([[bb, ii], t]) => {
    t = t.replace(/\*/g, '∗');
    if (!t.trim()){ pend += t; return; }
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(t);
    if (i && !ii){ s += '*'; i = false; }
    if (b && !bb){ s += '**'; b = false; }
    s += pend + m[1]; pend = '';
    if (!b && bb){ s += '**'; b = true; }
    if (!i && ii){ s += '*'; i = true; }
    s += m[2]; pend = m[3];
  });
  if (i) s += '*'; if (b) s += '**';
  return (s + pend).replace(/\*\*(\s*)\*\*/g, '$1');
}

function paraRegras(ls){
  const out = []; let prev = null;
  ls.forEach(l => {
    const t = l.txt.trim();
    if (prev && l.pag === prev.pag && l.y - prev.y < 16 && prev.x1 > 520 && out.length) out[out.length - 1] += ' ' + t; else out.push(t);
    prev = l;
  });
  const r = out.map(x => x.replace(/\s+/g, ' ').trim()).filter(x => x && !/^\s*\d+\s*$/.test(x));
  while (r.reduce((a, x) => a + x.length, 0) > 6000) r.shift();
  return r;
}

const P0 = () => ({ t: 'p', jc: 'l', il: 0, ir: 0, fl: 0, sb: 0, sa: 0, ln: 240, lr: 'auto', sz: 12, n: false, txt: '' });
function blocosDe(ls){
  if (!ls.length) return [];
  const L = LEFT_TXT, R = 538.9, C = (L + R) / 2;
  const pars = []; let prev = null;
  ls.forEach(l => {
    const gap = prev === null ? null : (l.pag === prev.pag ? l.y - prev.y : 13.8);
    let novo = true;
    if (prev && pars.length){
      const p = pars[pars.length - 1];
      const cheia = prev.x1 > R - 6, mesmaEsq = Math.abs(l.x0 - L) < 2.5;
      if (gap !== null && gap < 19 && cheia && mesmaEsq && !p.centro) novo = false;
      if (gap !== null && gap < 19 && p.centro && Math.abs((l.x0 + l.x1) / 2 - C) < 5 && prev.bold === l.bold && l.bold && !/^(SINDIC|CONSELHO|POL[IÍ]CIA|ESTADO|UNIDADE|LOGOMARCA|TERMO)/.test(l.txt.trim())) novo = false;
    }
    if (prev && gap !== null && gap > 19) for (let q = 0; q < Math.min(3, Math.round((gap - 13.8) / 13.8)); q++) pars.push({ vazio: true });
    if (novo) pars.push({ ls: [l], centro: Math.abs((l.x0 + l.x1) / 2 - C) < 4.5 && l.x0 > L + 8 && l.x1 < R - 8 });
    else pars[pars.length - 1].ls.push(l);
    prev = l;
  });
  const out = [];
  pars.forEach(p => {
    if (p.vazio){ out.push(P0()); return; }
    const ls2 = p.ls, f = ls2[0], runs = [];
    ls2.forEach((l, i) => { if (i) runs.push([runs.length ? runs[runs.length - 1][0] : [false, false], ' ']); l.runs.forEach(r => runs.push([r[0], r[1]])); });
    const txt = marcar(runs).replace(/ {2,}/g, ' ').trim();
    const o = { ...P0(), txt };
    if (/^\**LOGOMARCA DA PMTO\**$/.test(txt)){ out.push({ ...o, img: true, jc: 'c', txt: '' }); return; }
    if (p.centro) o.jc = 'c';
    else if (ls2.length > 1){
      o.jc = 'j';
      const esq = Math.min(...ls2.slice(1).map(l => l.x0));
      o.il = Math.round(Math.max(0, esq - L) * 20); o.fl = Math.round((f.x0 - esq) * 20);
    } else if (f.x1 > R - 3 && f.x0 > L + 60) o.jc = 'r';
    else o.il = Math.round(Math.max(0, f.x0 - L) * 20);
    out.push(o);
  });
  while (out.length && !out[out.length - 1].txt && !out[out.length - 1].img) out.pop();
  return out;
}

export async function lerMppadmis(file, prog = () => {}){
  const pdfjs = await carregarPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const itens = [];
  for (let n = 9; n <= doc.numPages; n++){
    const pg = await doc.getPage(n), vp = pg.getViewport({ scale: 1 });
    const rects = await retangulos(pdfjs, pg, vp);     // carrega as fontes também (para saber o que é negrito)
    const chars = await letras(pg, vp);
    const bx = caixas(rects);
    const sep = rects.filter(r => r.x1 - r.x0 > 100 && r.bottom - r.top < 1.5 && r.top > 700 && r.x0 < 90 && r.x1 < 240);
    const ySep = sep.length ? Math.min(...sep.map(r => r.top)) : 9999;
    linhas(chars).forEach(l => {
      if (l.y < 56 && /^\s*\d+\s*$/.test(l.txt)) return;
      if (l.y > ySep) return;
      l.box = bx.find(b => b[2] - 2 <= l.y - 9 && l.y <= b[3] + 2 && l.x0 > b[0]) || null;
      l.pag = n; itens.push(l);
    });
    prog(Math.round(n / doc.numPages * 90), `Lendo a página ${n} de ${doc.numPages}…`);
  }
  try { await doc.cleanup(); } catch {}
  const modelos = []; let cur = null, regras = [];
  for (let k = 0; k < itens.length;){
    const l = itens[k], t = l.txt.trim();
    if (!l.box && l.bold && /^MODELOS? D[EA] /.test(t)){
      let tit = t, j = k + 1;
      while (j < itens.length && !itens[j].box && itens[j].bold && itens[j].pag === l.pag && itens[j].y - itens[j - 1].y < 18 && !/^MODELO/.test(itens[j].txt.trim())){ tit += ' ' + itens[j].txt.trim(); j++; }
      cur = { titulo: tit.replace(/^MODELOS? D[EA] /, '').replace(/\s+/g, ' ').trim(), pag: l.pag, linhas: [], regras };
      modelos.push(cur); regras = []; k = j; continue;
    }
    if (l.box && cur && (!cur.linhas.length || l.pag - cur.linhas[cur.linhas.length - 1].pag <= 1) && !cur.fechado) cur.linhas.push(l);
    else { if (cur && cur.linhas.length) cur.fechado = true; if (!l.box) regras.push(l); }
    k++;
  }
  prog(95, 'Montando os modelos…');
  const res = [];
  modelos.forEach((m, i) => {
    if (!m.linhas.length) return;
    const titulo = m.titulo.replace(/(?<=[A-ZÇÃÕÉÍÓÚ])\d+(?=\s|$)/g, '').trim();
    res.push({ n: i, titulo, pag: m.pag, regras: paraRegras(m.regras), blocos: blocosDe(m.linhas) });
  });
  prog(100, 'Pronto');
  return res;
}
