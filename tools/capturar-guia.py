"""Prints do Guia do sistema na versão on-line (React), com dados fictícios e marcações numeradas.
Usa o build de teste (banco simulado) em scratchpad/react/out. Saída: sistema-gestao-ensino/public/guia/*.jpg"""
import os, subprocess, threading, http.server, functools, socketserver, shutil
from playwright.sync_api import sync_playwright
from PIL import Image

S = '/tmp/claude-0/-home-claude/ec85dd29-c888-5e74-a7c9-17dc6443ec5d/scratchpad/'
T = S + 'teste/'
OUT = '/home/claude/sistema-gestao-ensino/public/guia/'
TMP = S + 'guia_react/'
os.makedirs(OUT, exist_ok=True); os.makedirs(TMP, exist_ok=True)
VW, VH = 1600, 900
MARCAR = open('/home/claude/guia_scripts/capturar.py').read().split('MARCAR = r"""')[1].split('"""')[0]

socketserver.TCPServer.allow_reuse_address = True
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 8781), functools.partial(H, directory=S + 'react/out'))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = 'http://127.0.0.1:8781/'

def salvar_jpg(png, nome, largura=None):
    im = Image.open(png).convert('RGB')
    w = largura or min(im.width, 1280)
    if im.width > w: im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im.save(OUT + nome + '.jpg', quality=82, optimize=True, progressive=True)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--lang=pt-BR'])
    ctx = b.new_context(viewport={'width': VW, 'height': VH}, locale='pt-BR', accept_downloads=True)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: print('console:', m.text) if 'sem alvo' in m.text else None)
    resp = {'v': None}
    pg.on('dialog', lambda d: d.accept(resp['v'] if (d.type == 'prompt' and resp['v'] is not None) else (d.default_value if d.type == 'prompt' else None)))

    n_tag = [0]
    def tag(loc):
        n_tag[0] += 1; k = f'mk{n_tag[0]}'
        loc.first.evaluate("(e, k) => e.setAttribute('data-mk', k)", k); return f'[data-mk="{k}"]'
    def marcar(itens, pad=4):
        itens = [[tag(pg.locator(s)) if not s.startswith('[data-mk') else s] + list(r) for s, *r in itens]
        pg.evaluate(MARCAR, [itens, pad]); pg.wait_for_timeout(150)
    def limpar(): pg.evaluate("document.querySelectorAll('.__mk').forEach(x => x.remove())")
    def shot(nome, el=None, clip=None, minY=74, m=16, largura=None):
        png = TMP + nome + '.png'
        if el:
            bb = pg.locator(el).first.bounding_box()
            if bb['y'] + bb['height'] < minY + 40 or bb['y'] > VH - 40:
                pg.locator(el).first.scroll_into_view_if_needed(); pg.wait_for_timeout(300); bb = pg.locator(el).first.bounding_box()
            x0, y0 = max(0, bb['x'] - m), max(minY, bb['y'] - m)
            clip = {'x': x0, 'y': y0, 'width': min(VW - x0, bb['width'] + 2 * m), 'height': min(VH - y0, bb['y'] + bb['height'] + m - y0)}
        pg.screenshot(path=png, clip=clip) if clip else pg.screenshot(path=png)
        limpar(); salvar_jpg(png, nome, largura)
    def topo(sel):
        if '>>' in sel or ':has' in sel: sel = tag(pg.locator(sel))
        pg.evaluate("s => { const e = document.querySelector(s); if (e) e.scrollIntoView({block: 'start'}); const c = document.querySelector('.conteudo'); if (c) c.scrollTop -= 96; window.scrollBy(0, -96); }", sel); pg.wait_for_timeout(300)
    def fechar_guia():
        pg.wait_for_timeout(900)
        if pg.locator('#guia').count(): pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    def nav(texto): pg.locator('.nav a', has_text=texto).first.click(); pg.wait_for_timeout(900)
    def sair(): pg.click('.rodape-side .trocar'); pg.wait_for_timeout(700)
    def criar(nome, posto, setor, cat, usuario, senha='segredo1', marcar_print=False):
        pg.click('.tp-links button:has-text("Criar usuário")'); pg.wait_for_timeout(300)
        f = pg.locator('.tp-card-form')
        f.locator('input').nth(1).fill(nome); f.locator('input').nth(2).fill(posto); f.locator('input').nth(3).fill(setor)
        pg.locator('input[name="tp-cat"]').nth(0 if cat == 'oficial' else 1).check()
        pg.fill('input[placeholder="Ex.: sd.rodrigues"]', usuario)
        f.locator('input[type=password]').nth(0).fill(senha); f.locator('input[type=password]').nth(1).fill(senha)
        if marcar_print:
            pg.set_viewport_size({'width': VW, 'height': 1250}); pg.wait_for_timeout(300)
            marcar([['.tp-card-form label.btn', 1, 'd'], ['.tp-card-form input >> nth=1', 2], ['.tp-card-form input >> nth=2', 3], ['.tp-card-form input >> nth=3', 4],
                    ['.tp-cat', 5], ['input[placeholder="Ex.: sd.rodrigues"]', 6], ['.tp-card-form input[type=password] >> nth=0', 7], ['.tp-acoes .btn.pri', 8, 'd']])
            png = TMP + '03_criar_perfil.png'; bb = pg.locator('.tp-card-form').bounding_box()
            pg.screenshot(path=png, clip={'x': bb['x'] - 30, 'y': max(0, bb['y'] - 30), 'width': bb['width'] + 60, 'height': bb['height'] + 60}); limpar(); salvar_jpg(png, '03_criar_perfil', 920)
            pg.set_viewport_size({'width': VW, 'height': VH}); pg.wait_for_timeout(300)
        pg.click('.tp-acoes .btn.pri'); pg.wait_for_timeout(1500)

    pg.goto(URL); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(800)
    # administrador (1º usuário) — só para preparar os dados
    criar('ADMINISTRADOR', 'Cap QOPM', 'Seção de Ensino', 'oficial', 'admin', 'admin123')
    fechar_guia(); sair()
    if pg.locator('.tp-links button:has-text("Entrar com outro usuário")').count(): pg.click('.tp-links button:has-text("Entrar com outro usuário")'); pg.wait_for_timeout(300)

    # 02 login
    pg.fill('.tp-card-form input >> nth=0', 'ten.moura'); pg.fill('.tp-card-form input[type=password]', 'segredo1')
    marcar([['.tp-card-form input >> nth=0', 1], ['.tp-card-form input[type=password]', 2], ['.tp-lembrar', 3], ['.tp-card-form > .btn.pri', 4, 'd'],
            ['.tp-links button >> nth=0', 5, 'b'], ['.tp-links button >> nth=1', 6, 'db']])
    shot('02_perfis', el='.tp-card-form', m=30, minY=0, largura=920)
    pg.fill('.tp-card-form input >> nth=0', ''); pg.fill('.tp-card-form input[type=password]', '')
    # 03 criar usuário
    criar('MOURA', '1º Ten QOPM', 'Seção de Ensino', 'oficial', 'ten.moura', marcar_print=True)
    # o guia abre sozinho no 1º acesso: print da 1ª tela do guia não é necessário; fecha
    fechar_guia()

    # ---------- ESCALA DE ACO ----------
    nav('Criar escala de ACO')
    pg.click('.aco-op:not(.vol)'); pg.wait_for_timeout(1500)
    pg.set_input_files('.drop ~ input[type=file]', [T + 'relacao_efetivo_8BPM.pdf', T + 'RP_hoje.pdf', T + 'RP_amanha.pdf'])
    pg.wait_for_function("!document.querySelector('.drop.lendo') && document.querySelectorAll('.arq').length >= 3", timeout=120000); pg.wait_for_timeout(800)
    # almanaques fictícios (ordem pela matrícula) só para os prints
    pg.evaluate("""(() => { const { est, efetivoPessoas, norm } = __sgeAco; const ps = [...efetivoPessoas()].sort((a, b) => (a.matricula||'').localeCompare(b.matricula||''));
      const agora = new Date().toISOString();
      est.almanaque = { listas: { 3: ps.map((p, i) => [p.cpf || '', p.matricula || '', norm(p.nome), i + 1, norm(p.posto)]) },
        arquivos: { 1: { nome: 'ALMANAQUE OFICIAIS.pdf', qtd: 412, importadoEm: agora, por: 'Cap QOPM ADMINISTRADOR' }, 2: { nome: 'ALMANAQUE SUBTENENTES E SARGENTOS.pdf', qtd: 1180, importadoEm: agora, por: 'Cap QOPM ADMINISTRADOR' }, 3: { nome: 'ALMANAQUE CABOS E SOLDADOS.pdf', qtd: ps.length, importadoEm: agora, por: 'Cap QOPM ADMINISTRADOR' } }, stamp: 'guia' + Date.now() };
      const hoje = new Date(), iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      return __sgeAcoDados.gravarConfig('almanaque', est.almanaque, est.perfilId); })()""")
    # datas das escalas de RP de exemplo: hoje e amanhã (para aparecerem os bloqueados)
    import datetime
    hj = datetime.date.today(); am = hj + datetime.timedelta(days=1)
    arqs = pg.locator('.arq:has-text("RP_")')
    for i in range(arqs.count()):
        nome = arqs.nth(i).locator('.nm b').inner_text()
        d = hj if 'hoje' in nome else am
        arqs.nth(i).locator('.sec input[type=date]').first.fill(d.isoformat()); pg.wait_for_timeout(400)
    pg.click('.bloco .hor-calc'); pg.wait_for_timeout(500)
    pg.evaluate("window.scrollTo(0, 0); const c = document.querySelector('.conteudo'); if (c) c.scrollTop = 0"); pg.wait_for_timeout(200)
    marcar([['.aco-topo > button >> nth=0', 1], ['.aco-data', 2], ['.aco-topo .dir button >> nth=0', 3, 'b'], ['.aco-topo .dir .perigo', 4, 'b'], ['.aco-topo .dir .ouro', 5, 'd']])
    shot('10_aco_topo', el='.aco-topo')
    topo('details.card')
    marcar([['.drop', 1], ['.prog', 2, 'b'], ['.arq >> nth=1', 3]])
    shot('11_aco_arquivos', el='details.card')
    topo('.chips')
    marcar([['.chips', 1], ['.tab-datas', 2]])
    shot('12_aco_situacao', el='.card:has(> .chips)')

    pg.select_option('.bloco .sel-cidade', 'PARAÍSO'); pg.wait_for_timeout(300)
    for i in range(5):
        pg.locator('.aco-pessoas .pes').nth(i * 3).click(); pg.wait_for_timeout(500)
    rows = pg.locator('.bloco').first.locator('tbody tr')
    for i in range(rows.count()):
        sp = rows.nth(i).locator('.guerra span'); ts = sp.all_inner_texts()
        j = next((k for k, t in enumerate(ts) if k > 0 and len(t) > 3), len(ts) - 1)
        sp.nth(j).click(); pg.wait_for_timeout(80)
    pg.click('button:has-text("+ Novo bloco")'); pg.wait_for_timeout(400)
    pg.locator('.bloco').nth(1).locator('.sel-cidade').select_option('MONTE SANTO'); pg.wait_for_timeout(300)
    pg.locator('.bloco').nth(1).locator('select.tipo-aco').select_option('m'); pg.wait_for_timeout(400)
    for i in range(3):
        pg.locator('.aco-pessoas .pes').nth(i * 4 + 1).click(); pg.wait_for_timeout(500)
    rows = pg.locator('.bloco').nth(1).locator('tbody tr')
    for i in range(rows.count()):
        sp = rows.nth(i).locator('.guerra span'); sp.nth(sp.count() - 1).click(); pg.wait_for_timeout(80)
    pg.locator('.bloco').first.locator('.hor-calc').click(); pg.wait_for_timeout(400)

    VH = 1350; pg.set_viewport_size({'width': VW, 'height': VH}); pg.wait_for_timeout(400)
    topo('.aco-grid')
    pg.evaluate("document.querySelector('.aco-pessoas').scrollTop = 0")
    marcar([['.disp-topo input', 1], ['.disp-blocos', 2], ['.aco-pessoas .pes', 3], ['.aco-bloq summary', 4]])
    shot('13_aco_disponiveis', el='.aco-disp')
    VH = 900; pg.set_viewport_size({'width': VW, 'height': VH}); pg.wait_for_timeout(400)
    topo('.bloco')
    marcar([['.bloco .sel-cidade', 1], ['.bloco select.tipo-aco', 2], ['.bloco .ini-turno', 3], ['.bloco .fim-turno', 4], ['.bloco .bloco-ac', 5, 'd'],
            ['.bloco .hor-calc', 6], ['.bloco tbody tr .guerra', 7, 'd'], ['.bloco tbody tr .ac-g', 8, 'd'], ['.bloco .bloco-rod .btn', 9], ['.bloco .ordem-auto', 10]], 3)
    shot('14_aco_bloco', el='.bloco')
    topo(tag(pg.locator('.bloco').nth(1)))
    bl2 = pg.locator('.bloco').nth(1)
    marcar([['.bloco >> nth=1 >> select.tipo-aco', 1], ['.bloco >> nth=1 >> .hor-calc', 2], ['button:has-text("+ Novo bloco")', 3]])
    bb = bl2.bounding_box(); nb = pg.locator('button:has-text("+ Novo bloco")').bounding_box()
    shot('15_aco_bloco_meia', clip={'x': bb['x'] - 16, 'y': max(0, bb['y'] - 16), 'width': bb['width'] + 32, 'height': min(nb['y'] + nb['height'] + 16, VH) - max(0, bb['y'] - 16)})

    doc = pg.locator('.aco-dir details.card')
    doc.evaluate("d => d.open = true"); pg.wait_for_timeout(300)
    campo = lambda rot: '.aco-dir .aco-form label:has-text("' + rot + '") >> input, .aco-dir .aco-form label:has-text("' + rot + '") >> textarea'
    pg.locator('.aco-form label:has-text("Operação") input').fill('OPERAÇÃO EXEMPLO'); pg.locator('.aco-form label:has-text("SGD") input').fill('2026/00000/000000')
    topo('.aco-dir details.card')
    marcar([['.aco-form label:has-text("Nº da escala") input', 1], ['.aco-form label:has-text("Operação") input', 2], ['.aco-form label:has-text("SGD") input', 3], ['.aco-form label:has-text("Observações") textarea', 4]])
    shot('16_aco_texto', el='.aco-dir details.card')

    pg.click('.aco-topo .dir .ouro'); pg.wait_for_selector('dialog[open]'); pg.wait_for_timeout(500)
    pg.fill('dialog[open] textarea', 'Os policiais escalados deverão se apresentar **30 minutos antes** do horário.')
    marcar([['dialog[open] .dlg-tipos', 1], ['dialog[open] textarea', 2], ['dialog[open] .rodape button:has-text("sem observação")', 3, 'b'], ['dialog[open] .rodape .ouro', 4, 'd']])
    shot('17_aco_gerar', el='dialog[open]', m=0, minY=0)
    with pg.expect_download() as dl: pg.click('dialog[open] .rodape .ouro')
    pdf = TMP + 'exemplo.pdf'; dl.value.save_as(pdf); pg.wait_for_timeout(1500)
    subprocess.run(['pdftoppm', '-png', '-r', '80', '-f', '1', '-l', '1', pdf, TMP + '18'], check=True)
    salvar_jpg(TMP + '18-1.png', '18_aco_pdf')
    pg.click('.aco-topo .dir .ouro'); pg.wait_for_selector('dialog[open] .dlg-modo'); pg.wait_for_timeout(400)
    marcar([['dialog[open] .dlg-modo label >> nth=0', 1], ['dialog[open] .dlg-modo label >> nth=1', 2]])
    shot('19_aco_regerar', el='dialog[open] .dlg-modo', m=20, minY=0)
    pg.click('dialog[open] .rodape button:has-text("Cancelar")'); pg.wait_for_timeout(400)
    pg.click('.aco-topo > button >> nth=0'); pg.wait_for_timeout(1500)
    pg.evaluate("window.scrollTo(0, 0); const c = document.querySelector('.conteudo'); if (c) c.scrollTop = 0"); pg.wait_for_timeout(200)
    marcar([['.aco-op:not(.vol)', 1], ['.aco-op.vol', 2], ['.alm-card', 3], ['.card:has(.lista-rec) >> nth=0', 4], ['details.card:has-text("Excluídas")', 5]])
    shot('09_aco_inicio', clip={'x': 264, 'y': 74, 'width': VW - 264, 'height': 760})

    # ---------- PAINEL / TELA PRINCIPAL ----------
    nav('Painel'); pg.wait_for_timeout(1500)
    if pg.locator('.nav-pai:has-text("Documentos"):not(.aberto)').count(): pg.click('.nav-pai:has-text("Documentos")'); pg.wait_for_timeout(300)
    marcar([['.btn-recolher', 1, 'd'], ['.sidebar .perfil', 2, 'd'], ['.nav a:has-text("Criar escala de ACO")', 3, 'd'], ['.nav-pai:has-text("Documentos")', 4, 'd'],
            ['.btn-tema', 5, 'b'], ['.rodape-side .trocar', 6, 'd'], ['.rodape-side .pasta', 7, 'd']])
    shot('05_tela_principal')
    pg.select_option('.rk-ctrl select', 'mes'); pg.wait_for_timeout(300)
    pg.locator('.rk-tab tr.lin').first.click(); pg.wait_for_timeout(300)
    topo('.rk-topo')
    marcar([['.rk-ctrl select', 1], ['.rk-ctrl input', 2], ['.rk-legenda .faixa', 3], ['.rk-tab tr.lin', 4]])
    shot('20_painel_ranking', el='.card:has(.rk-topo)')

    # ---------- PLANILHAS ----------
    nav('Planilhas')
    resp['v'] = 'Controle de alunos'; pg.click('#btn-nova'); pg.wait_for_timeout(800); resp['v'] = None
    g = pg.locator('#grade tbody tr').first.locator('input').first
    g.fill('Sd PM SILVA'); g.press('Enter'); pg.wait_for_timeout(300)
    pg.locator('#grade tbody tr').nth(1).locator('input').first.fill('Sd PM COSTA'); pg.keyboard.press('Tab'); pg.wait_for_timeout(300)
    marcar([['#btn-nova', 1], ['#btn-imp-csv', 2], ['#toolbar-planilha', 3], ['#grade', 4]])
    shot('21_planilhas', clip={'x': 264, 'y': 74, 'width': VW - 264, 'height': 380})

    # ---------- MEU PERFIL ----------
    nav('Meu perfil')
    marcar([['.campos-form label.btn', 1, 'd'], ['.campos-form input >> nth=1', 2], ['.card:has-text("Usuário e senha")', 3], ['.campos-form .btn.pri', 4, 'd']])
    shot('23_perfil', clip={'x': 264, 'y': 74, 'width': 700, 'height': VH - 74})
    # tema escuro e menu recolhido
    pg.click('.btn-tema'); pg.wait_for_timeout(500)
    nav('Painel'); pg.wait_for_timeout(1200)
    shot('06_tema_escuro')
    pg.click('.btn-recolher'); pg.wait_for_timeout(500)
    marcar([['.btn-recolher', 1, 'd']])
    shot('07_menu_recolhido', clip={'x': 0, 'y': 0, 'width': 760, 'height': 520})
    pg.click('.btn-recolher'); pg.wait_for_timeout(300); pg.click('.btn-tema'); pg.wait_for_timeout(500)

    # ---------- LOGIN SALVO / ESQUECI ----------
    sair()
    if not pg.locator('#tp-l-salvo').count():
        pg.fill('.tp-card-form input >> nth=0', 'ten.moura'); pg.fill('.tp-card-form input[type=password]', 'segredo1'); pg.check('.tp-lembrar input'); pg.click('.tp-card-form > .btn.pri'); pg.wait_for_timeout(1500); fechar_guia(); sair()
    pg.wait_for_timeout(600)
    marcar([['#tp-l-salvo', 1], ['.tp-card-form input[type=password]', 2], ['.tp-links button >> nth=0', 3, 'b'], ['.tp-links button >> nth=1', 4, 'db']])
    shot('03b_login_salvo', el='.tp-card-form', m=30, minY=0, largura=920)
    pg.click('.tp-links button:has-text("Esqueci")'); pg.wait_for_timeout(300)
    pg.fill('.tp-card-form input >> nth=1', 'Seção de Ensino, ramal 2201')
    marcar([['.tp-card-form input >> nth=0', 1], ['.tp-card-form input >> nth=1', 2], ['.tp-acoes .btn.pri', 3, 'd']])
    shot('03c_esqueci', el='.tp-card-form', m=30, minY=0, largura=920)
    pg.click('.tp-acoes .btn.pri'); pg.wait_for_timeout(800)
    pg.click('.tp-acoes .btn:has-text("Voltar")'); pg.wait_for_timeout(400)

    # ---------- ADMINISTRADOR ----------
    if pg.locator('.tp-links button:has-text("Entrar com outro usuário")').count(): pg.click('.tp-links button:has-text("Entrar com outro usuário")'); pg.wait_for_timeout(300)
    pg.fill('.tp-card-form input >> nth=0', 'admin'); pg.fill('.tp-card-form input[type=password]', 'admin123'); pg.uncheck('.tp-lembrar input'); pg.click('.tp-card-form > .btn.pri'); pg.wait_for_timeout(1800)
    fechar_guia()
    nav('Meu perfil'); pg.wait_for_timeout(800)
    VH = 1200; pg.set_viewport_size({'width': VW, 'height': VH}); pg.wait_for_timeout(400)
    topo('.card:has-text("Perfis cadastrados")')
    marcar([['.pedido-senha', 1], ['.card:has-text("Perfis cadastrados") .lista-rec', 2]])
    shot('46_admin_usuarios', el='.card:has-text("Perfis cadastrados")')
    VH = 900; pg.set_viewport_size({'width': VW, 'height': VH}); pg.wait_for_timeout(400)
    nav('Registros'); pg.wait_for_timeout(1000)
    marcar([['.view select', 1], ['.view input[placeholder^="Buscar"]', 2], ['.tabela-reg', 3]])
    shot('47_registros', clip={'x': 264, 'y': 74, 'width': VW - 264, 'height': 520})
    # nova senha: o administrador redefine e a pessoa entra com a provisória
    nav('Meu perfil'); pg.wait_for_timeout(800)
    resp['v'] = 'provisoria1'
    pg.locator('.pedido-senha .btn.pri').first.click(); pg.wait_for_timeout(1200); resp['v'] = None
    sair()
    if pg.locator('.tp-links button:has-text("Entrar com outro usuário")').count(): pg.click('.tp-links button:has-text("Entrar com outro usuário")'); pg.wait_for_timeout(300)
    pg.fill('.tp-card-form input >> nth=0', 'ten.moura'); pg.fill('.tp-card-form input[type=password]', 'provisoria1'); pg.click('.tp-card-form > .btn.pri'); pg.wait_for_timeout(1800)
    marcar([['.tp-card-form input[type=password] >> nth=0', 1], ['.tp-card-form input[type=password] >> nth=1', 2], ['.tp-acoes .btn.pri', 3, 'd']])
    shot('03d_nova_senha', el='.tp-card-form', m=30, minY=0, largura=920)
    print('ERROS', errs)
    b.close()
