/* Leitura de PDFs (pdf.js) e geração do PDF da escala (pdf-lib).
   As bibliotecas só são baixadas quando usadas, para o site abrir rápido. */
import { dataBR, diaSemana, dataExtenso, hojeISO, MESES_NOME, palavras, horarioPessoa } from './logica.js';

let _pdfjs = null;
export async function carregarPdfjs(){
  if (_pdfjs) return _pdfjs;
  const m = await import('pdfjs-dist/legacy/build/pdf.min.mjs');
  // o "worker" roda na própria página (sem arquivo separado)
  globalThis.pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs');
  return _pdfjs = m;
}
export const carregarPdfLib = () => import('pdf-lib');

export async function lerPdf(file, prog){
  const pdfjs = await carregarPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const linhas = [];
  for (let n = 1; n <= doc.numPages; n++){
    const pg = await doc.getPage(n), tc = await pg.getTextContent(), grupos = [];
    tc.items.forEach(it => {
      if (!it.str || !it.str.trim()) return;
      const y = it.transform[5], x = it.transform[4];
      const alt = Math.abs(it.transform[3]) || it.height || 10, tol = Math.min(3, Math.max(0.8, alt * 0.4));
      let g = grupos.find(g => Math.abs(g.y - y) < tol);
      if (!g){ g = { y, itens: [] }; grupos.push(g); }
      g.itens.push({ x, s: it.str, w: it.width || 0, fs: alt });
    });
    grupos.sort((a, b) => b.y - a.y).forEach(g => {
      const its = g.itens.sort((a, b) => a.x - b.x); let txt = '', fimAnt = null;
      its.forEach(i => {
        const colado = fimAnt !== null && i.x - fimAnt < i.fs * 0.12 && !/\s$/.test(txt) && !/^\s/.test(i.s);
        txt += (txt && !colado ? ' ' : '') + i.s;
        fimAnt = i.w ? i.x + i.w : null;
      });
      linhas.push(txt.replace(/\s+/g, ' ').trim());
    });
    prog?.(n / doc.numPages);
  }
  try { await doc.cleanup(); } catch {}
  return linhas;
}

export function baixar(nome, bytes, tipo = 'application/pdf'){
  const url = URL.createObjectURL(new Blob([bytes], { type: tipo }));
  const a = document.createElement('a'); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/* PDF da escala (segue o modelo "ACO Nº 03-2026 – NOVEMBRO") */
export async function gerarBytesACO(e, blocos){
  const { PDFDocument, StandardFonts, rgb, PDFOperator, PDFNumber, pushGraphicsState, popGraphicsState } = await carregarPdfLib();
  const D = e.doc;
  const doc = await PDFDocument.create();
  const mes = MESES_NOME[+e.data.slice(5, 7) - 1];
  doc.setTitle(`ACO Nº ${D.numero}-${e.data.slice(0, 4)} – ${mes}${D.operacao ? ' – ' + D.operacao : ''}`); doc.setAuthor(D.cab2);
  const F = await doc.embedFont(StandardFonts.Helvetica), FB = await doc.embedFont(StandardFonts.HelveticaBold), FI = await doc.embedFont(StandardFonts.HelveticaOblique);
  const banner = await doc.embedJpg(await (await fetch('/cabecalho-aco.jpg')).arrayBuffer());
  const W = 595.32, H = 841.92, PRETO = rgb(0, 0, 0), BRANCO = rgb(1, 1, 1);
  const ML = 56.8, MR = 510.3, TOPO2 = 57;
  const ok = (t, f) => [...String(t ?? '')].map(ch => { try { f.widthOfTextAtSize(ch, 10); return ch; } catch { return '?'; } }).join('');
  let pg, y;
  const Y = (top, s) => H - top - s * 0.905;
  const novaPagina = () => { pg = doc.addPage([W, H]); y = TOPO2; };
  const precisa = h => { if (y + h > H - 50) novaPagina(); };
  const wTxt = (t, f, s) => [...String(t ?? '')].reduce((a, ch) => a + f.widthOfTextAtSize(ch, s), 0);
  const larg = (t, f, s, esc = 1) => wTxt(ok(t, f), f, s) * esc;
  const texto = (t, x, top, f, s, cor = PRETO, esc = 1) => {
    t = ok(t, f); if (!t.trim()) return;
    if (esc !== 1){ pg.pushOperators(pushGraphicsState(), PDFOperator.of('Tz', [PDFNumber.of(esc * 100)])); pg.drawText(t, { x, y: Y(top, s), size: s, font: f, color: cor }); pg.pushOperators(popGraphicsState()); }
    else pg.drawText(t, { x, y: Y(top, s), size: s, font: f, color: cor });
  };
  const centro = (t, top, f, s, opt = {}) => {
    const w = larg(t, f, s, opt.esc || 1), x = (opt.cx ?? W / 2) - w / 2;
    texto(t, x, top, f, s, opt.cor || PRETO, opt.esc || 1);
    if (opt.sub) pg.drawRectangle({ x, y: H - top - s * 1.02 - 1.2, width: w, height: 1.2, color: PRETO });
    return w;
  };
  const tokens = md => {
    const out = [];
    String(md || '').split(/(\*\*[^*]+\*\*)/).forEach(part => {
      if (!part) return;
      const b = /^\*\*[^*]+\*\*$/.test(part), t = b ? part.slice(2, -2) : part;
      t.split(/(\s+)/).forEach(w => { if (!w) return; if (/^\s+$/.test(w)) out.push({ sp: true }); else out.push({ t: ok(w, b ? FB : F), b }); });
    });
    return out;
  };
  const linhasRicas = (toks, w, s, esc = 1) => {
    const ls = []; let cur = [], curW = 0, sp = false;
    const spW = wTxt(' ', F, s) * esc;
    toks.forEach(tk => {
      if (tk.sp){ sp = true; return; }
      const ww = wTxt(tk.t, tk.b ? FB : F, s) * esc, gap = cur.length && sp ? spW : 0;
      if (cur.length && curW + gap + ww > w){ ls.push({ itens: cur, w: curW }); cur = [{ ...tk, gap: 0, w: ww }]; curW = ww; }
      else { cur.push({ ...tk, gap, w: ww }); curW += gap + ww; }
      sp = false;
    });
    if (cur.length) ls.push({ itens: cur, w: curW });
    return ls;
  };
  const desenhaLinha = (ln, x, top, s, extraGap = 0, esc = 1) => {
    ln.itens.forEach(it => { x += it.gap ? it.gap + extraGap : 0; texto(it.t, x, top, it.b ? FB : F, s, PRETO, esc); x += it.w; });
  };
  const paragrafo = (md, x, w, s, lh, justificar) => {
    const ls = linhasRicas(tokens(md), w, s);
    ls.forEach((ln, i) => {
      precisa(lh);
      const gaps = ln.itens.filter(it => it.gap).length;
      const extra = justificar && i < ls.length - 1 && gaps ? (w - ln.w) / gaps : 0;
      desenhaLinha(ln, x, y, s, extra); y += lh;
    });
  };
  const centroRico = (md, top, s) => { const ln = linhasRicas(tokens(md), 1e4, s)[0]; if (ln) desenhaLinha(ln, (W - ln.w) / 2, top, s); };

  /* ---- página 1: cabeçalho ---- */
  pg = doc.addPage([W, H]);
  const bw = 325.05, bh = bw * banner.height / banner.width;
  pg.drawImage(banner, { x: 134.9, y: H - 10.3 - bh, width: bw, height: bh });
  centro(D.cab1, 105.4, F, 12); centro(D.cab2, 119.2, F, 12);
  centro(D.titulo, 145.6, FB, 12, { sub: true });
  y = 173.2;
  if (D.operacao){ centro(D.operacao, y, FB, 12, { sub: true }); y += 13.7; }
  if (D.sgd){ centro('SGD: ' + D.sgd, y, FI, 9); y += 10; }
  y = Math.max(y + 14.4, 225.1);
  if (D.uniforme){ paragrafo('**Uniforme:** ' + D.uniforme, ML, MR - ML, 12, 17.2, true); y += 6.1; }
  if (D.armamento){ paragrafo('**Armamento e Equipamento:** ' + D.armamento, ML, MR - ML, 12, 17.2, true); y += 6.1; }
  const obs = String(D.obs || '').split(/\n/).map(x => x.trim()).filter(Boolean);
  if (obs.length){
    precisa(30); centro('Observações:', y, FB, 12, { cx: 85.1 + larg('Observações:', FB, 12) / 2, sub: true }); y += 14.6;
    obs.forEach((o, i) => {
      const ls = linhasRicas(tokens(o), MR - 78, 12);
      ls.forEach((ln, j) => { precisa(14.6); if (!j) texto(String.fromCharCode(97 + i) + ')', 60, y, F, 12); desenhaLinha(ln, 78, y, 12); y += 14.6; });
    });
  }
  if (D.enquadramento){
    y += 3; precisa(20);
    const w = larg(D.enquadramento, FB, 14);
    pg.drawRectangle({ x: 63.7, y: H - y - 16.1, width: w + 4, height: 16.1, color: rgb(0.827, 0.827, 0.827) });
    texto(D.enquadramento, 65.7, y + 0.4, FB, 14); y += 16.1;
  }
  y += 27.6;

  /* ---- blocos ---- */
  const COLS = [{ x: 56.9, w: 84.4 }, { x: 141.7, w: 55.1 }, { x: 197.3, w: 220.5 }, { x: 418.3, w: 59.6 }, { x: 478.4, w: 60 }];
  const XF = 538.4, NARROW = 0.82, CINZA_LOCAL = rgb(0.498, 0.498, 0.498), CINZA_CAB = rgb(0.682, 0.667, 0.667);
  const borda = (x, top, w, h) => pg.drawRectangle({ x, y: H - top - h, width: w, height: h, borderColor: PRETO, borderWidth: 0.5 });
  blocos.forEach((b, bi) => {
    const grupos = [];
    b.pessoas.forEach(r => { const h = horarioPessoa(b, r), g = grupos[grupos.length - 1]; if (g && g.h === h) g.n++; else grupos.push({ h, n: 1 }); });
    grupos.forEach(g => g.ls = linhasRicas(tokens(g.h), COLS[4].w - 22, 11, NARROW));
    const n = b.pessoas.length;
    const rowH = Math.max(17.3, ...grupos.map(g => (g.ls.length * 13.45 + 4) / g.n));
    const alturaBloco = 23 + 14.3 + 17.1 + 16.9 + n * rowH;
    if (bi > 0) y += 14.3;
    if (y + alturaBloco > H - 50) novaPagina();
    pg.drawRectangle({ x: 62.3, y: H - y - 23, width: 470.8, height: 23, color: PRETO });
    centro(`${dataBR(b.data)} (${diaSemana(b.data)})`, y + 0.6, FB, 16, { cor: BRANCO });
    y += 23 + 14.3;
    pg.drawRectangle({ x: 56.9, y: H - y - 17.1, width: XF - 56.9, height: 17.1, color: CINZA_LOCAL });
    borda(56.9, y, XF - 56.9, 17.1);
    centro(b.local || '', y + 1.5, FB, 14, { esc: NARROW, cx: (56.9 + XF) / 2 });
    y += 17.1;
    ['POST/GRAD.', 'RG', 'NOME', 'MATR.', 'HORÁRIO'].forEach((t, i) => {
      const c = COLS[i];
      pg.drawRectangle({ x: c.x, y: H - y - 16.9, width: c.w, height: 16.9, color: CINZA_CAB });
      borda(c.x, y, c.w, 16.9);
      centro(t, y + 1.7, FB, 11, { esc: NARROW, cx: c.x + c.w / 2 });
    });
    y += 16.9;
    const topoLinhas = y;
    b.pessoas.forEach(r => {
      const meio = y + (rowH - 12.7) / 2;
      [r.posto, r.rg, null, r.matricula].forEach((t, i) => { const c = COLS[i]; borda(c.x, y, c.w, rowH); if (t !== null) centro(t || '', meio, F, 11, { esc: NARROW, cx: c.x + c.w / 2 }); });
      const c = COLS[2]; borda(c.x, y, c.w, rowH);
      const segs = [];
      palavras(r.nome).forEach((w, i) => {
        const bold = (r.guerra || []).includes(i), f = bold ? FB : F;
        const t = (i ? ' ' : '') + ok(w, f);
        const ult = segs[segs.length - 1];
        if (ult && ult.b === bold) ult.t += t; else segs.push({ t, b: bold });
      });
      segs.forEach(sg => sg.w = wTxt(sg.t, sg.b ? FB : F, 11) * NARROW);
      let nx = c.x + (c.w - segs.reduce((a, sg) => a + sg.w, 0)) / 2;
      segs.forEach(sg => { texto(sg.t, nx, meio, sg.b ? FB : F, 11, PRETO, NARROW); nx += sg.w; });
      y += rowH;
    });
    const c = COLS[4]; let gy = topoLinhas;
    grupos.forEach(g => {
      const hT = g.n * rowH;
      borda(c.x, gy, c.w, hT);
      let ty = gy + (hT - g.ls.length * 13.45) / 2;
      g.ls.forEach(ln => { desenhaLinha(ln, c.x + (c.w - ln.w) / 2, ty, 11, 0, NARROW); ty += 13.45; });
      gy += hT;
    });
  });

  /* ---- observação final ---- */
  const obsF = String(D.obsFinal || '').split(/\n/).map(x => x.trim()).filter(Boolean);
  if (obsF.length){
    y += 22;
    obsF.forEach((o, i) => { paragrafo((i ? '' : '**Observação:** ') + o, ML, MR - ML, 12, 17.2, true); y += 4; });
  }

  /* ---- fechamento ---- */
  y += 29;
  precisa(70);
  centro(`${D.localDoc}, ${dataExtenso(D.dataDoc || hojeISO())}.`, y, F, 12); y += 27.6;
  if (D.linhaAss){ centro(D.linhaAss, y, F, 12); y += 13.8; }
  if (D.signatario){ centroRico(D.signatario, y, 12); y += 13.8; }
  if (D.cargo){ centro(D.cargo, y, FB, 12); }
  return doc.save();
}
