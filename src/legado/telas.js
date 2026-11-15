/* ARQUIVO GERADO por tools/gerar-documentos.py */
export const TELAS = `
<span id="titulo-view" hidden></span><span id="sub-view" hidden></span><span id="tag-of" hidden></span><span id="tag-os" hidden></span>
    <section class="view" id="view-oficio">
      <div id="of-inicio">
        <div class="card drop-of" id="of-manual-card"><h3>Manual de redação</h3><div id="of-manual"></div>
          <div class="prog-of" id="of-man-prog" hidden><i></i><span></span></div></div>
        <div class="card" id="of-modelos-card"><h3>Novo ofício — escolha o modelo</h3><div class="aco-opcoes of-opcoes" id="of-modelos"></div><p class="dica" id="of-outros"></p></div>
        <div class="card"><h3>Meus ofícios</h3><div id="of-lista" class="lista-rec"></div></div>
      </div>
      <div id="of-editor" hidden>
        <div class="aco-topo">
          <button class="btn peq" id="of-voltar">← Ofícios</button>
          <div class="of-tit"><small id="of-modelo-ed"></small><h2 id="of-titulo-ed"></h2></div>
          <div class="dir">
            <button class="btn peq" id="of-numero-auto" title="Próximo número livre desta seção no ano">Nº automático</button>
            <button class="btn peq pri" id="of-importar" title="Traz o conteúdo de um ofício pronto (PDF ou Word) para o padrão do manual">Editar arquivo já feito</button>
            <button class="btn peq" id="of-exemplo" title="Preenche com o exemplo que está no manual">Preencher com o exemplo do manual</button>
            <button class="btn peq perigo" id="of-excluir">Excluir</button>
            <button class="btn peq bt-campos" title="Mostra ou esconde o formulário com os campos ao lado da folha">Mostrar campos</button>
            <button class="btn ouro" id="of-pdf"><svg width="16" height="16"><use href="#i-doc"/></svg>Gerar PDF</button>
          </div>
        </div>
        <div class="of-grid modo-doc">
          <div class="card of-form-card"><p class="pv-dica">✍️ <span><b>Dica:</b> clique direto no texto da prévia do PDF para editar ali mesmo.</span></p><div id="of-form"></div></div>
          <div class="of-lado">
            <div class="card of-prev-card"><h3>Documento <span class="dica" style="font-weight:400">· clique em qualquer texto para editar</span> <small id="of-paginas" class="dica"></small></h3><div class="of-previa" id="of-previa"></div></div>
            <div class="card of-conf-card"><h3>Conferência com o manual <span class="tg" id="of-conf-res"></span></h3><ul class="of-conf" id="of-conf"></ul></div>
          </div>
        </div>
      </div>
      <input type="file" id="imp-arq" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden>
      <input type="file" id="of-man-arq" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden>
    </section>

    <!-- ORDENS DE SERVIÇO -->
    <section class="view" id="view-os">
      <div id="os-inicio">
        <div class="card"><h3>Ordem de Serviço</h3><div id="os-manual"></div></div>
        <div class="card"><h3>Minhas Ordens de Serviço</h3><div id="os-lista" class="lista-rec"></div></div>
      </div>
      <div id="os-editor" hidden>
        <div class="aco-topo">
          <button class="btn peq" id="os-voltar">← Ordens de Serviço</button>
          <div class="of-tit"><small>Ordem de Serviço</small><h2 id="os-titulo-ed"></h2></div>
          <div class="dir">
            <button class="btn peq" id="os-numero-auto" title="Próximo número livre desta seção no ano">Nº automático</button>
            <button class="btn peq pri" id="os-importar" title="Traz o conteúdo de uma O.S. pronta (PDF ou Word) para o padrão do manual">Editar arquivo já feito</button>
            <button class="btn peq" id="os-exemplo" title="Preenche com o modelo que está no manual">Preencher com o exemplo do manual</button>
            <button class="btn peq" id="os-duplicar" title="Nova O.S. com estes mesmos itens">Duplicar</button>
            <button class="btn peq perigo" id="os-excluir">Excluir</button>
            <button class="btn peq bt-campos" title="Mostra ou esconde o formulário com os campos ao lado da folha">Mostrar campos</button>
            <button class="btn ouro" id="os-pdf"><svg width="16" height="16"><use href="#i-doc"/></svg>Gerar PDF</button>
          </div>
        </div>
        <div class="of-grid modo-doc">
          <div class="card of-form-card"><p class="pv-dica">✍️ <span><b>Dica:</b> clique direto no texto da prévia do PDF para editar ali mesmo.</span></p><div id="os-form"></div></div>
          <div class="of-lado">
            <div class="card of-prev-card"><h3>Documento <span class="dica" style="font-weight:400">· clique em qualquer texto para editar</span> <small id="os-paginas" class="dica"></small></h3><div class="of-previa" id="os-previa"></div></div>
            <div class="card of-conf-card"><h3>Conferência com o manual <span class="tg" id="os-conf-res"></span></h3><ul class="of-conf" id="os-conf"></ul></div>
          </div>
        </div>
      </div>
    </section>

    <!-- DOCUMENTOS DO MANUAL -->
    <section class="view" id="view-docm">
      <div id="dm-inicio">
        <div class="card"><h3 id="dm-cat-tit"></h3><p class="dica" style="margin-top:-4px" id="dm-inicio-dica">Escolha o modelo do manual, edite os textos e gere o PDF com a formatação do manual.</p><div id="dm-modelos"></div></div>
        <div class="card"><h3>Meus documentos</h3><div id="dm-lista" class="lista-rec"></div></div>
      </div>
      <div id="dm-editor" hidden>
        <div class="aco-topo">
          <button class="btn peq" id="dm-voltar">← Modelos</button>
          <div class="of-tit"><small id="dm-modelo-ed"></small><h2 id="dm-titulo-ed"></h2></div>
          <div class="dir">
            <button class="btn peq pri" id="dm-importar" title="Traz o conteúdo de um documento pronto (PDF ou Word) para o padrão do manual">Editar arquivo já feito</button>
            <button class="btn peq" id="dm-restaurar" title="Volta ao texto original do modelo">Restaurar modelo</button>
            <button class="btn peq" id="dm-duplicar">Duplicar</button>
            <button class="btn peq perigo" id="dm-excluir">Excluir</button>
            <button class="btn peq bt-campos" title="Mostra ou esconde o formulário com os campos ao lado da folha">Mostrar campos</button>
            <button class="btn ouro" id="dm-pdf"><svg width="16" height="16"><use href="#i-doc"/></svg>Gerar PDF</button>
          </div>
        </div>
        <div class="of-grid modo-doc">
          <div class="card of-form-card"><p class="pv-dica">✍️ <span><b>Dica:</b> clique direto no texto da prévia do PDF para editar ali mesmo.</span></p><p class="dica" style="margin:0 0 10px">Cada caixa é um parágrafo do modelo, já com a formatação do manual. <b>+</b> cria outro parágrafo igual abaixo. Use **negrito**, *itálico* e ++sublinhado++.</p><div id="dm-form" class="dm-form"></div></div>
          <div class="of-lado">
            <div class="card of-prev-card"><h3>Documento <span class="dica" style="font-weight:400">· clique em qualquer texto para editar</span> <small id="dm-paginas" class="dica"></small></h3><div class="of-previa" id="dm-previa"></div></div>
            <div class="card of-conf-card"><h3>Conferência <span class="tg" id="dm-conf-res"></span></h3><ul class="of-conf" id="dm-conf"></ul>
              <details class="of-regras" id="dm-regras-box"><summary>O que o manual diz sobre este documento</summary><div id="dm-regras" class="dm-regras"></div></details></div>
          </div>
        </div>
      </div>
    </section>

`;
