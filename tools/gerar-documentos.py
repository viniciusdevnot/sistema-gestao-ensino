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
