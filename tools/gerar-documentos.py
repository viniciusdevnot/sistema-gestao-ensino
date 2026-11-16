"""Gera src/legado/documentos.js a partir do código do sistema anterior (legado/sistema-anterior.src.html).

Os módulos de Ofício, Ordem de Serviço, Documentos do manual e Procedimentos (com a edição direto
na folha e a importação de PDF/Word) são o mesmo motor do sistema anterior, já testado; aqui ele é
embrulhado numa função `montar(P)` que recebe a ponte com o React e o banco (src/legado/ponte.js).
Rode de novo sempre que o código antigo for corrigido:  python3 tools/gerar-documentos.py
"""
import re, pathlib
R = pathlib.Path(__file__).resolve().parent.parent
src = (R / 'legado/sistema-anterior.src.html').read_text(encoding='utf-8').split('\n')
ini = next(i for i, l in enumerate(src) if l.startswith('/* ================= OFÍCIO — leitura do Manual de Redação'))
fim = next(i for i, l in enumerate(src) if l.startswith("$('#dm-importar').onclick"))
corpo = '\n'.join(src[ini:fim + 1])

# ---- ajustes pontuais ----
corpo = re.sub(r'(?<![\w.$])perfilId\b', 'P.perfilId', corpo)
corpo = corpo.replace("try { lista = JSON.parse(document.getElementById('proc-modelos').textContent); } catch {}", "lista = P.mppadmis() || [];")
corpo = corpo.replace("async function importarManualRedacao(file){\n  if (!file) return;", "async function importarManualRedacao(file){\n  if (!file) return;\n  if (!ehAdmin()){ alert('Só o administrador pode trocar o manual de redação.'); return; }")
# tabelas com bordas em pedaços: os pedacinhos que ligam a borda vertical à horizontal (0,5 × 2,4 pt)
# também contam como borda; senão as linhas de dados da tabela não se ligam ao cabeçalho
velho = "    if (h <= 2.5 && w > 3) H.push({y: (y0 + y1) / 2, x0, x1});\n    else if (w <= 2.5 && h > 3) V.push({x: (x0 + x1) / 2, y0, y1});"
assert velho in corpo
corpo = corpo.replace(velho, "    if (h <= 2.5 && w > 3 && w >= h) H.push({y: (y0 + y1) / 2, x0, x1});\n    else if (w <= 2.5 && h > 1.2 && h > w * 1.6) V.push({x: (x0 + x1) / 2, y0, y1});")
assert "  const tol = 2;\n  const grupos" in corpo
corpo = corpo.replace("  const tol = 2;\n  const grupos", "  const tol = 2.6;\n  const grupos")

# ================= Cabeçalho padrão — Ofício Circular nº 022/2025/GCG =================
# Em todos os documentos gerados: brasão da PMTO + "TOCANTINS / Governo do Estado" + brasão do Estado
# no topo da 1ª página, centralizado, e abaixo o nome da Corporação por extenso (Arial 12, caixa alta).
# Linhas de cabeçalho antigas ("ESTADO DO TOCANTINS", "POLÍCIA MILITAR"…) são trocadas pelo novo.
def troca(velho, novo, n=1):
    global corpo
    assert corpo.count(velho) == n, (corpo.count(velho), velho[:90])
    corpo = corpo.replace(velho, novo)

# Ofício
troca("""    let img = null, imgW = 0;
    const hImg = R('brasaoAltura') * CM;
    if (M?.brasao){
      const bytes = Uint8Array.from(atob(M.brasao.split(',')[1]), ch => ch.charCodeAt(0));
      img = /image\\/png/.test(M.brasao) ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      imgW = img.width * hImg / img.height;
      // a imagem fica na linha do parágrafo: sobra o descendente da fonte embaixo, como no Word
      caixas.push({h: hImg + R('cabecalho') * 0.212, cabecalho: true, draw: (pg, top) => pg.drawImage(img, {x: (W - imgW) / 2, y: H - top - hImg, width: imgW, height: hImg})});
    }
    const sCab = R('cabecalho');
    [['cab1', c.cab1], ['cab2', c.cab2]].filter(([, x]) => (x || '').trim()).forEach(""",
"""    const ban = await doc.embedJpg(await P.banner()), banW = BAN_W, banH = banW * ban.height / ban.width;
    caixas.push({h: banH + R('cabecalho') * 0.212, cabecalho: true, draw: (pg, top) => pg.drawImage(ban, {x: (W - banW) / 2, y: H - top - banH, width: banW, height: banH})});
    const sCab = R('cabecalho');
    linha([{t: CAB_PMTO}], 'c', sCab);
    [['cab1', c.cab1], ['cab2', c.cab2]].filter(([, x]) => (x || '').trim() && !ehCabPadrao(x)).forEach(""")
troca("  const cab = pars.slice(0, iEp).map(p => p.txt.replace(/\\*\\*/g, '')).filter(t => t === t.toUpperCase() && /[A-Z]{3}/.test(t));",
      "  const cab = pars.slice(0, iEp).map(p => p.txt.replace(/\\*\\*/g, '')).filter(t => t === t.toUpperCase() && /[A-Z]{3}/.test(t) && !ehCabPadrao(t));")
# Ordem de Serviço
troca("""  const hImg = R('brasaoAltura') * CM;
  let img = null, imgW = 0;
  if (M?.brasao){ const bytes = Uint8Array.from(atob(M.brasao.split(',')[1]), ch => ch.charCodeAt(0)); img = /image\\/png/.test(M.brasao) ? await doc.embedPng(bytes) : await doc.embedJpg(bytes); imgW = img.width * hImg / img.height; }""",
"""  const ban = await doc.embedJpg(await P.banner()), banW = BAN_W, banH = banW * ban.height / ban.width;""")
troca("""  if (img){ pg.drawImage(img, {x: (W - imgW) / 2, y: H - y - hImg, width: imgW, height: hImg}); y += hImg + R('cabecalho') * 0.212; }
  const sCab = R('cabecalho');
  [['cab1', c.cab1], ['cab2', c.cab2]].filter(([, x]) => (x || '').trim()).forEach(""",
"""  pg.drawImage(ban, {x: (W - banW) / 2, y: H - y - banH, width: banW, height: banH}); y += banH + R('cabecalho') * 0.212;
  const sCab = R('cabecalho');
  { const tt = ok(CAB_PMTO, FN.r); pg.drawText(tt, {x: (W - larg(tt, FN.r, sCab)) / 2, y: H - (y + sCab * 0.905), size: sCab, font: FN.r, color: PRETO}); y += LH(sCab); }
  [['cab1', c.cab1], ['cab2', c.cab2]].filter(([, x]) => (x || '').trim() && !ehCabPadrao(x)).forEach(""")
troca("  if (m.cab?.length){ c.cab1 = m.cab[0]; c.cab2 = m.cab[1] || ''; }",
      "  if (m.cab?.length) m.cab = m.cab.filter(t => !ehCabPadrao(t));\n  if (m.cab?.length){ c.cab1 = m.cab[0]; c.cab2 = m.cab[1] || ''; }")
# Documentos do manual e Procedimentos
troca("""  let img = null, imgW = 0; const hImg = R('brasaoAltura') * CM;
  const brasao = M?.brasao || LOGO;   // sem o manual de redação importado, usa o brasão da PMTO do sistema
  if (brasao){ const bytes = Uint8Array.from(atob(brasao.split(',')[1]), ch => ch.charCodeAt(0)); img = /image\\/png/.test(brasao) ? await doc.embedPng(bytes) : await doc.embedJpg(bytes); imgW = img.width * hImg / img.height; }""",
"""  const img = await doc.embedJpg(await P.banner()), imgW = BAN_W, hImg = imgW * img.height / img.width;""")
i = corpo.index("    if (p.img) return [{h: hImg + p.sz * 0.212, draw: (pg, top, x0) => {")
j = corpo.index("\n", i)
corpo = corpo[:i] + """    if (p.img){ const sC = R('cabecalho'); return [
      {h: hImg + sC * 0.212, draw: (pg, top, x0) => pg.drawImage(img, {x: x0 + (largura - imgW) / 2, y: H - top - hImg, width: imgW, height: hImg})},
      {h: LHs(sC), draw: (pg, top, x0) => { const tt = ok(CAB_PMTO, FN.r); pg.drawText(tt, {x: x0 + (largura - larg(tt, FN.r, sC)) / 2, y: H - (top + sC * 0.905), size: sC, font: FN.r, color: PRETO}); }}]; }""" + corpo[j:]
troca("function renderEditorDocM(){\n  const o = dmAtual(); if (!o) return;",
      "function renderEditorDocM(){\n  const o = dmAtual(); if (!o) return;\n  if (padronizarCabecalho(o)) mudouDocM(o, false);")
troca("el('span', {text: ehCatProc(o.cat) ? '🛡 Brasão da PMTO (cabeçalho)' : '🛡 Brasão do cabeçalho (do manual)'})",
      "el('span', {text: '🛡 Cabeçalho padrão: brasões + TOCANTINS + POLÍCIA MILITAR DO ESTADO DO TOCANTINS (Of. Circ. nº 022/2025/GCG)'})")

troca("add(!!M.brasao, 'Cabeçalho com brasão', M.brasao ? `altura de ${String(R.brasaoAltura.valor).replace('.', ',')} cm, com até 2 linhas da unidade em caixa alta` : 'o manual importado não tem o brasão');",
      "add(true, 'Cabeçalho padrão', 'brasão da PMTO, TOCANTINS – Governo do Estado e brasão do Estado só na 1ª página; abaixo, POLÍCIA MILITAR DO ESTADO DO TOCANTINS (Arial 12, caixa alta) e as linhas da unidade (Ofício Circular nº 022/2025/GCG)');")
# os ouvintes de "resize" e "input" ficam registrados uma vez só (montar roda uma vez)
assert corpo.count("window.addEventListener('resize'") == 3

cab = '''/* ARQUIVO GERADO por tools/gerar-documentos.py — não edite à mão.
   Motor de Ofícios, Ordens de Serviço, Documentos do manual e Procedimentos (do sistema anterior). */
/* eslint-disable */
import { LOGO } from './logo.js';
export function montar(P){
  const { db, $, el, uid, norm, dataBR, hojeISO, MESES_NOME, VIEWS, carregarPdfjs, carregarPdfLib, baixar, registrar, status, agendarSalvar, perfilAtual, quemSou, irPara } = P;
  const ehAdmin = () => P.admin, dirHandle = null;
  let viewAtual = P.view;
  /* Cabeçalho padrão (Ofício Circular nº 022/2025/GCG) */
  const CAB_PMTO = 'POLÍCIA MILITAR DO ESTADO DO TOCANTINS', BAN_W = 10.5 * 28.3465;
  const ehCabPadrao = t => /^(ESTADO DO TOCANTINS|GOVERNO DO (ESTADO|TOCANTINS)( DO TOCANTINS)?|TOCANTINS|POLICIA MILITAR( DO ESTADO)?( DO TOCANTINS)?|PMTO|PM ?TO)$/.test(norm(String(t || '').replace(/\\*\\*/g, '')).replace(/[.\\s]+$/, ''));
  function padronizarCabecalho(o){
    const bl = o.blocos || []; let mudou = false;
    const txt = b => b && b.t === 'p' && !b.img ? (b.txt || '').trim() : null;
    let iImg = bl.findIndex((b, k) => k < 6 && b.img);
    if (iImg < 0){
      // sem a imagem: se o documento começa com as linhas do cabeçalho antigo, troca pelo novo
      const ini = []; for (let k = 0; k < bl.length && ini.length < 4; k++){ const t = txt(bl[k]); if (t === null) break; if (!t) continue; if (ehCabPadrao(t)) ini.push(k); else break; }
      if (!ini.length) return false;
      const modelo = bl[ini[0]];
      ini.reverse().forEach(k => bl.splice(k, 1));
      bl.splice(ini[ini.length - 1], 0, {...modelo, txt: '', img: true, jc: 'c', il: 0, ir: 0, fl: 0, sb: 0, sa: 0, sz: 12}); return true;
    }
    for (let k = iImg + 1; k < bl.length; ){
      const t = txt(bl[k]); if (t === null || (t && !ehCabPadrao(t))) break;
      if (!t){ k++; continue; }
      bl.splice(k, 1); mudou = true;
    }
    return mudou;
  }
'''
rod = '''
  return {
    setView: v => { viewAtual = v; if (/^dm-/.test(v)){ if (dmCat !== v.slice(3)) dmAtualId = null; dmCat = v.slice(3); } },
    renderOficios, renderOS, renderDocM,
    fechar: () => { ofAtualId = null; osAtualId = null; dmAtualId = null; },
    recarregarProc: () => { procCache = null; },
    CAT_DOCM, CAT_PROC
  };
}
'''
(R / 'src/legado/documentos.js').write_text(cab + corpo + rod, encoding='utf-8')

# logotipo (brasão) usado quando falta o do manual
m = re.search(r'const LOGO = "([^"]+)";', '\n'.join(src))
(R / 'src/legado/logo.js').write_text(f'export const LOGO = "{m.group(1)}";\n', encoding='utf-8')

# HTML das telas
h0 = next(i for i, l in enumerate(src) if 'id="view-oficio"' in l)
h1 = next(i for i, l in enumerate(src) if '<!-- WORD -->' in l)
html = '\n'.join(src[h0:h1]).replace('`', '\\`').replace('${', '\\${')
(R / 'src/legado/telas.js').write_text('/* ARQUIVO GERADO por tools/gerar-documentos.py */\nexport const TELAS = `\n<span id="titulo-view" hidden></span><span id="sub-view" hidden></span><span id="tag-of" hidden></span><span id="tag-os" hidden></span>\n' + html + '\n`;\n', encoding='utf-8')
print('ok', fim - ini + 1, 'linhas')
