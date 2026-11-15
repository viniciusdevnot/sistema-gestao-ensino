/* ARQUIVO GERADO por tools/gerar-documentos.py — não edite à mão.
   Motor de Ofícios, Ordens de Serviço, Documentos do manual e Procedimentos (do sistema anterior). */
/* eslint-disable */
import { LOGO } from './logo.js';
export function montar(P){
  const { db, $, el, uid, norm, dataBR, hojeISO, MESES_NOME, VIEWS, carregarPdfjs, carregarPdfLib, baixar, registrar, status, agendarSalvar, perfilAtual, quemSou, irPara } = P;
  const ehAdmin = () => P.admin, dirHandle = null;
  let viewAtual = P.view;
/* ================= OFÍCIO — leitura do Manual de Redação (.docx) =================
   O .docx é um ZIP: lemos o word/document.xml e as imagens direto no navegador
   (DecompressionStream 'deflate-raw'), sem bibliotecas externas. */
async function lerZip(buf){
  const dv = new DataView(buf), u8 = new Uint8Array(buf), dec = new TextDecoder();
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50){ eocd = i; break; }
  if (eocd < 0) throw new Error('O arquivo não é um .docx válido.');
  const qtd = dv.getUint16(eocd + 10, true); let p = dv.getUint32(eocd + 16, true);
  const arq = {};
  for (let n = 0; n < qtd; n++){
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const metodo = dv.getUint16(p + 10, true), tam = dv.getUint32(p + 20, true);
    const ln = dv.getUint16(p + 28, true), le = dv.getUint16(p + 30, true), lc = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const nome = dec.decode(u8.subarray(p + 46, p + 46 + ln));
    const ini = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
    arq[nome] = {metodo, dados: u8.subarray(ini, ini + tam)};
    p += 46 + ln + le + lc;
  }
  const bytes = async nome => {
    const a = arq[nome]; if (!a) return null;
    if (a.metodo === 0) return a.dados;
    const s = new Blob([a.dados]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  };
  return {nomes: Object.keys(arq), bytes, texto: async nome => { const b = await bytes(nome); return b ? dec.decode(b) : null; }};
}

/* Parágrafos e tabelas do documento, na ordem, com negrito por trecho e imagens */
function lerCorpoDocx(xml, rels){
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const body = doc.getElementsByTagNameNS('*', 'body')[0];
  const itens = [];
  const filhos = el => [...el.children];
  const ln = el => el.localName;
  const paragrafo = p => {
    const runs = []; let img = null;
    const andar = no => {
      for (const c of filhos(no)){
        const n = ln(c);
        if (n === 'r'){
          const rPr = filhos(c).find(x => ln(x) === 'rPr');
          const flag = tag => { const e = rPr && filhos(rPr).find(x => ln(x) === tag); if (!e) return false; const v = e.getAttribute('w:val'); return !(v === '0' || v === 'false' || v === 'none'); };
          const b = flag('b'), i = flag('i'), u = flag('u');
          for (const t of filhos(c)){
            const tn = ln(t);
            if (tn === 't') runs.push({t: t.textContent, b, i, u});
            else if (tn === 'tab') runs.push({t: '\t', b, i, u});
            else if (tn === 'br' || tn === 'cr') runs.push({t: '\n', b, i, u});
            else if (tn === 'drawing' || tn === 'pict'){ const bl = t.getElementsByTagNameNS('*', 'blip')[0]; const id = bl?.getAttribute('r:embed'); if (id && rels[id]) img = rels[id]; }
          }
        } else if (n === 'hyperlink' || n === 'smartTag' || n === 'ins' || n === 'sdt' || n === 'sdtContent' || n === 'fldSimple') andar(c);
      }
    };
    andar(p);
    const pPr = filhos(p).find(x => ln(x) === 'pPr');
    const jc = pPr && filhos(pPr).find(x => ln(x) === 'jc')?.getAttribute('w:val');
    const num = !!(pPr && filhos(pPr).find(x => ln(x) === 'numPr'));
    const ind = pPr && filhos(pPr).find(x => ln(x) === 'ind');
    const recuo = ind ? (+(ind.getAttribute('w:left') || ind.getAttribute('w:start') || 0)) : 0;
    return {tipo: 'p', runs, texto: runs.map(r => r.t).join(''), img, jc: jc || '', num, recuo};
  };
  const celulas = t => filhos(t).filter(r => ln(r) === 'tr').map(tr => filhos(tr).filter(c => ln(c) === 'tc').map(tc => filhos(tc).filter(x => ln(x) === 'p').map(paragrafo)));
  const tabela = t => celulas(t).map(row => row.map(ps => ps.map(p => p.texto).join('\n').trim()));
  const visitar = no => {
    for (const c of filhos(no)){
      const n = ln(c);
      if (n === 'p') itens.push(paragrafo(c));
      else if (n === 'tbl') itens.push({tipo: 'tbl', linhas: tabela(c), celulas: celulas(c)});
      else if (n === 'sdt' || n === 'sdtContent' || n === 'customXml') visitar(c);
    }
  };
  visitar(body);
  return itens;
}

/* Regras de formatação: lidas do texto do manual (com o valor padrão do manual da PMTO se não achar) */
const REGRAS_OFICIO = [
  ['fonte',        'Fonte do texto',                     'Arial', /fonte\s+(Arial)\b/i, v => v],
  ['corpo',        'Tamanho do texto',                   12, /fonte\s+Arial,?\s+tamanho\s+(\d+)\s+para o texto/i, Number],
  ['citacao',      'Tamanho em citações e rodapés',      10, /(\d+)\s+em\s+cita[çc][õo]es\s+recuadas/i, Number],
  ['corpoMin',     'Tamanho mínimo (exceção p/ ajuste)', 11, /tamanho menor\s*\((\d+)\s+no corpo/i, Number],
  ['alinhamento',  'Alinhamento do texto',               'justificado', /alinhamento:\s*(justificado)/i, v => v.toLowerCase()],
  ['entrelinhas',  'Espaçamento entre linhas',           1.25, /espa[çc]amento entre linhas:\s*([\d,]+)/i, v => +v.replace(',', '.')],
  ['depois',       'Espaço após cada parágrafo (pt)',    6, /espa[çc]amento entre par[áa]grafos:\s*de\s*(\d+)\s*pontos/i, Number],
  ['recuo',        'Recuo da 1ª linha (cm)',             2, /recuo de par[áa]grafo:\s*([\d,]+)\s*cm/i, v => +v.replace(',', '.')],
  ['papel',        'Papel',                              'A4', /tamanho do papel:\s*(A4)/i, v => v],
  ['mEsq',         'Margem esquerda (cm)',               3, /margens:\s*esquerda:\s*([\d,]+)\s*cm/i, v => +v.replace(',', '.')],
  ['mDirSup',      'Margens direita e superior (cm)',    2, /direita e superior\s*([\d,]+)\s*cm/i, v => +v.replace(',', '.')],
  ['mInf',         'Margem inferior (cm)',               4, /e inferior\s*([\d,]+)\s*cm/i, v => +v.replace(',', '.')],
  ['rodapeArea',   'Área do rodapé (cm finais da folha)',3, /[áa]rea de rodap[ée]:\s*nos\s*([\d,]+)\s*cm/i, v => +v.replace(',', '.')],
  ['brasaoAltura', 'Altura do brasão (cm)',              2, /dever[áa] ter altura de\s*([\d,]+)\s*cm/i, v => +v.replace(',', '.')],
  ['cabecalho',    'Cabeçalho: tamanho, caixa alta',     12, /escritos por extenso em fonte Arial,\s*tamanho\s*(\d+),\s*em caixa alta/i, Number],
  ['rodape',       'Rodapé: tamanho da fonte',           10, /formatado com fonte Arial tamanho\s*(\d+),\s*centralizado/i, Number],
  ['assinaturaEsp','Espaço p/ assinatura digital (cm)',  2, /espa[çc]o de\s*([\d,]+)\s*cent[íi]metros em branco para assinatura digital/i, v => +v.replace(',', '.')]
];
const POR_EXTENSO = {uma: 1, um: 1, duas: 2, dois: 2, tres: 3, três: 3};
const ESPACOS_OFICIO = [
  ['antesEpigrafe', 'Linhas em branco entre cabeçalho e epígrafe', 2, /posicionados,?\s*no m[íi]nimo,?\s*(\w+)\s+linhas em branco abaixo do cabe[çc]alho/i],
  ['antesEnderecamento', 'Linhas em branco antes do endereçamento', 2, /posicionado\s+(\w+)\s+linhas em branco abaixo do campo local e data/i],
  ['antesAssunto', 'Linhas em branco antes do assunto', 2, /Ap[óo]s\s+(\w+)\s+linhas em branco de mesma formata[çc][ãa]o do endere[çc]amento/i],
  ['antesVocativo', 'Linhas em branco antes do vocativo', 1, /vocativo apresenta-se\s+(\w+)\s+linha em branco/i],
  ['antesTexto', 'Linhas em branco antes do texto', 1, /digitado\s+(\w+)\s+linha em branco ap[óo]s o vocativo/i],
  ['antesFecho', 'Linhas em branco antes do fecho', 1, /redigido\s+(\w+)\s+linha em branco abaixo do final do texto/i],
  ['antesAssinatura', 'Linhas em branco antes da assinatura (1 a 2)', 2, /de\s+uma\s+a\s+(\w+)\s+linhas em branco/i]
];

async function lerManualRedacao(file, prog = () => {}){
  prog(5, 'Abrindo o arquivo…');
  const zip = await lerZip(await file.arrayBuffer());
  const xml = await zip.texto('word/document.xml');
  if (!xml) throw new Error('Não encontrei o texto do documento (word/document.xml). Envie o manual em .docx.');
  prog(20, 'Lendo o documento…');
  const relsXml = await zip.texto('word/_rels/document.xml.rels') || '';
  const rels = {};
  relsXml.replace(/<Relationship\b[^>]*>/g, tag => { const id = /Id="([^"]+)"/.exec(tag)?.[1], alvo = /Target="([^"]+)"/.exec(tag)?.[1]; if (id && alvo) rels[id] = 'word/' + alvo.replace(/^\/?word\//, '').replace(/^\.\//, ''); });
  const itens = lerCorpoDocx(xml, rels);
  const pars = itens.filter(x => x.tipo === 'p');
  const T = pars.map(p => p.texto).join('\n');
  if (!/of[íi]cio/i.test(T) || !/reda[çc][ãa]o/i.test(T)) throw new Error('Este arquivo não parece ser um manual de redação oficial (não falei de ofício nem de redação).');
  prog(40, 'Conferindo as regras de formatação…');
  const regras = {};
  // as regras gerais ficam no capítulo "DA APRESENTAÇÃO GRÁFICA"; procura nele primeiro
  const iGraf = T.search(/APRESENTA[ÇC][ÃA]O GR[ÁA]FICA DOS DOCUMENTOS\s*\n\s*Salvo/i);
  const Tg = iGraf >= 0 ? T.slice(iGraf) : T;
  const iOf = T.search(/\nOf[íi]cio\nForma de correspond/i);
  const Tof = iOf >= 0 ? T.slice(iOf, iOf + 40000) : T;
  for (const [k, rot, pad, re, conv] of REGRAS_OFICIO){
    const m = re.exec(k === 'rodape' || k === 'assinaturaEsp' ? Tof : Tg) || re.exec(T);
    regras[k] = {rotulo: rot, valor: m ? conv(m[1]) : pad, lido: !!m, trecho: m ? trechoDe(T, m[0]) : ''};
  }
  for (const [k, rot, pad, re] of ESPACOS_OFICIO){
    const m = re.exec(Tof) || re.exec(T);
    const v = m ? (POR_EXTENSO[norm(m[1]).toLowerCase()] ?? parseInt(m[1])) : NaN;
    regras[k] = {rotulo: rot, valor: Number.isFinite(v) ? v : pad, lido: Number.isFinite(v), trecho: m ? trechoDe(T, m[0]) : ''};
  }
  prog(55, 'Lendo os quadros de pronomes de tratamento…');
  const quadros = []; let ultimoTitulo = '';
  for (const it of itens){
    if (it.tipo === 'p' && /^QUADRO\s+\d+/i.test(it.texto.trim())) ultimoTitulo = it.texto.trim();
    if (it.tipo === 'tbl' && it.linhas.length > 1){
      const cab = it.linhas[0].map(c => norm(c));
      const iA = cab.findIndex(c => c.includes('AUTORIDADE')), iE = cab.findIndex(c => c.includes('ENDERECAMENTO')), iV = cab.findIndex(c => c.includes('VOCATIVO')), iT = cab.findIndex(c => c.includes('TRATAMENTO')), iB = cab.findIndex(c => c.includes('ABREVIATURA'));
      if (iA < 0 || iE < 0 || iV < 0) continue;
      quadros.push({titulo: ultimoTitulo.replace(/^QUADRO\s+\d+\s*[–-]\s*/i, '') || 'Tratamento', linhas: it.linhas.slice(1).filter(l => l[iA]).map(l => ({autoridade: l[iA].replace(/[¹²³]/g, '').trim(), enderecamento: l[iE] || '', vocativo: l[iV] || '', tratamento: iT >= 0 ? l[iT] : '', abrev: iB >= 0 ? l[iB] : ''}))});
    }
  }
  prog(65, 'Lendo as expressões que o manual manda evitar…');
  const cliches = [];
  const iC = pars.findIndex(p => /devem ser evitados:?\s*$/i.test(p.texto.trim()) && /clich|chav|frases feitas/i.test(p.texto));
  if (iC >= 0) for (let i = iC + 1; i < pars.length && i < iC + 15; i++){
    const t = pars[i].texto.trim(); if (!t) continue;
    if (/^Em casos de encaminhamento/i.test(t) || t.length > 90) break;
    cliches.push(t.replace(/\[\.\.\.\]|\[…\]/g, '').replace(/\(ou[^)]*\)/g, '').replace(/[.\s]+$/, '').trim());
  }
  prog(75, 'Procurando os modelos de ofício…');
  const modelos = [], outros = [];
  const titulos = pars.map((p, i) => ({i, t: p.texto.trim()})).filter(x => /^MODELOS? DE\s+\S/.test(x.t) && !/\.{4,}|\d+\s*$/.test(x.t) && x.t.length < 80);
  titulos.forEach((x, n) => {
    const fim = n + 1 < titulos.length ? titulos[n + 1].i : Math.min(pars.length, x.i + 80);
    if (/^MODELO DE OF[ÍI]CIO/i.test(x.t)){
      const m = lerModeloOficio(pars.slice(x.i + 1, fim), x.t);
      if (m) modelos.push(m);
    } else outros.push(x.t.replace(/^MODELOS? DE\s+/i, '').replace(/\s+/g, ' ').trim());
  });
  prog(80, 'Lendo a Ordem de Serviço…');
  const os = lerModeloOS(itens, T);
  prog(83, 'Lendo os demais modelos do manual…');
  let docs = [];
  try { docs = await lerModelosGerais(zip, xml, rels, T); } catch (e){ console.warn('modelos gerais', e); }
  prog(85, 'Separando o brasão do cabeçalho…');
  let brasao = null;
  const imgModelo = modelos.find(m => m.img)?.img || pars.find(p => p.img)?.img;
  if (imgModelo){
    const b = await zip.bytes(imgModelo);
    if (b){ const ext = imgModelo.split('.').pop().toLowerCase(); const tipo = ext === 'png' ? 'image/png' : (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : null;
      if (tipo) brasao = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(new Blob([b], {type: tipo})); }); }
  }
  modelos.forEach(m => delete m.img);
  prog(100, 'Pronto');
  const tituloDoc = (pars.find(p => /MANUAL DE REDA[ÇC][ÃA]O/i.test(p.texto))?.texto || file.name).replace(/\s+/g, ' ').trim().slice(0, 120);
  return {nome: file.name, titulo: tituloDoc, tamanho: file.size, regras, quadros, cliches, modelos, outros: [...new Set(outros)], brasao, os, docs};
}
/* Ordem de Serviço: regras do item do manual + a tabela do “MODELO DE ORDEM DE SERVIÇO” vira a estrutura base */
function lerModeloOS(itens, T){
  const iSec = T.search(/\nOrdem de Servi[çc]o\nOrdem de Servi[çc]o [ée] um documento/i);
  const Ts = iSec >= 0 ? T.slice(iSec, iSec + 12000) : '';
  if (!Ts) return null;
  const achar = (re, pad, conv = Number) => { const m = re.exec(Ts); return {valor: m ? conv(m[1]) : pad, lido: !!m, trecho: m ? trechoDe(T, m[0]) : ''}; };
  const regras = {
    celulaEspaco: {rotulo: 'Células: espaço antes e depois (pt)', ...achar(/entre par[áa]grafos de\s*(\d+)\s*pontos antes e depois/i, 6)},
    celulaEntrelinhas: {rotulo: 'Células: entrelinhas', ...achar(/c[ée]lulas da tabela dever[ãa]o ser formatadas com espa[çc]amento entre linhas\s+(simples)/i, 1, () => 1)},
    celulaAlinh: {rotulo: 'Células: texto justificado e centralizado na vertical', ...achar(/c[ée]lulas com texto\s+(justificado)\s+e centralizado verticalmente/i, 'justificado', v => v)},
    itens: {rotulo: 'Itens: numerados, negrito, caixa alta, sem recuo', ...achar(/itens e subitens:\s*(numerados),\s*em negrito/i, 'numerados', v => v)},
    sigla: {rotulo: 'Epígrafe com a sigla “O.S.” em negrito, lado a lado com local e data', ...achar(/formato da sigla\s*[“"](O\.S\.)[”"]/i, 'O.S.', v => v)},
    assinatura: {rotulo: 'Assinatura fora da tabela, sem local e data', ...achar(/assinatura da autoridade expedidora constar[áa]\s+(fora da tabela)/i, 'fora da tabela', v => v)}
  };
  // tabela do modelo: a primeira tabela depois do título “MODELO DE ORDEM DE SERVIÇO” (no apêndice)
  let k = -1;
  itens.forEach((it, i) => { if (it.tipo === 'p' && /^MODELO DE ORDEM DE SERVI[ÇC]O\s*$/i.test(it.texto.trim())) k = i; });
  let modelo = null;
  if (k >= 0) modelo = osDeItensDocx(itens, k);
  return {regras, modelo};
}
/* Tabela de O.S. de um .docx (do modelo do manual ou de uma O.S. já feita) → estrutura editável */
function osDeItensDocx(itens, k = -1){
  let modelo = null;
  {
    const iT = itens.findIndex((it, i) => i > k && it.tipo === 'tbl');
    if (iT >= 0){
      const linhasCab = itens.slice(k + 1, iT).filter(x => x.tipo === 'p').map(x => x.texto.replace(/\s+/g, ' ').trim()).filter(t => t && t === t.toUpperCase());
      const tb = itens[iT].celulas;
      const txt = ps => ps.map(p => p.texto.replace(/\s+/g, ' ').trim()).filter(Boolean);
      const comNegrito = p => p.runs.map(r => r.b && r.t.trim() ? `**${r.t.trim()}**${/\s$/.test(r.t) ? ' ' : ''}` : r.t).join('').replace(/\*\*\s*\*\*/g, '');
      const comLetras = ps => { let n = 0; return ps.filter(p => p.texto.trim()).map(p => { const t = comNegrito(p).replace(/\s+/g, ' ').trim(); if (p.num){ const l = String.fromCharCode(97 + n++) + ') '; return /^[a-z]\)/.test(t) ? t : l + t; } return t; }).join('\n'); };
      const negritoInicial = p => p.runs.find(r => r.t.trim())?.b;
      modelo = {cab: linhasCab.slice(0, 2), itens: []};
      let atual = null;
      tb.forEach((row, r) => {
        const cel = row.filter(c => c.length);
        if (r === 0 && cel.length >= 2){
          const esq = txt(cel[0]), dir = txt(cel[1]).join(' ');
          const mE = /^O\.S\.\s*n[º°o]\s*(\d+)\/(\d{4})\s*[–-]\s*(.+)$/i.exec(esq[0] || '');
          if (mE){ modelo.numero = mE[1]; modelo.ano = mE[2]; modelo.setores = mE[3].split('/').map(s => s.trim()); }
          const sgd = esq.find(t => /^SGD:/i.test(t)); if (sgd) modelo.sgd = sgd.replace(/^SGD:\s*/i, '');
          const mLD = /^(.+?)\s*(–|-|\/)\s*([A-Z]{2}),\s*(.+?)\.?$/.exec(dir); if (mLD){ modelo.cidade = mLD[1].trim(); modelo.sep = mLD[2] === '/' ? '/' : '–'; modelo.uf = mLD[3]; }
          return;
        }
        if (cel.length === 1){
          const t = txt(cel[0]).join('\n');
          const mR = /^(Aos|Evento|Refer[êe]ncia|Anexos?):\s*([\s\S]*)$/i.exec(t);
          if (mR){ const ch = {aos: 'aos', evento: 'evento', referencia: 'referencia', referência: 'referencia', anexos: 'anexos', anexo: 'anexos'}[mR[1].toLowerCase()]; modelo[ch] = mR[2].trim(); return; }
          const p0 = cel[0].find(p => p.texto.trim());
          if (p0 && negritoInicial(p0) && t === t.toUpperCase() && t.length < 80){ atual = {titulo: t.replace(/^\d+\.?\s*/, ''), tipo: /LIGA[ÇC][ÕO]ES/i.test(t) ? 'lig' : 'sub', linhas: [], texto: ''}; modelo.itens.push(atual); return; }
          if (atual){ atual.tipo = 'texto'; atual.texto = comLetras(cel[0]); }
          return;
        }
        if (cel.length >= 2 && atual){
          const rot = txt(cel[0]).join(' ').replace(/^\d+\.\d+(\.\d+)*\s+/, '').trim();
          atual.linhas.push({rotulo: rot, texto: atual.tipo === 'lig' ? txt(cel[1]).join(' ') : comLetras(cel[1])});
        }
      });
      // assinatura do modelo (logo depois da tabela)
      const depois = itens.slice(iT + 1, iT + 12).filter(x => x.tipo === 'p' && x.texto.trim());
      const iA = depois.findIndex(p => /^Assinatura digital/i.test(p.texto.trim()));
      if (iA >= 0){ const sg = depois[iA + 1]?.texto.trim() || ''; const [nome, posto] = sg.split(/\s+[–-]\s+/); modelo.sigNome = (nome || '').trim(); modelo.sigPosto = (posto || '').trim(); modelo.sigFuncao = depois[iA + 2]?.texto.trim() || ''; }
    }
  }
  return modelo;
}
/* ================= MODELOS DO MANUAL — leitura fiel (formatação de cada parágrafo e tabela) ================= */
const CAT_DOCM = [
  ['operacoes', 'Ordens de Operação', /^ORDEM DE OPERA/],
  ['memorandos', 'Memorandos', /^MEMORANDO/],
  ['despachos', 'Despachos', /^DESPACHO/],
  ['portarias', 'Portarias', /^PORTARIA/],
  ['requerimentos', 'Requerimentos', /^REQUERIMENTO/],
  ['instrucoes', 'Instruções Normativas', /^INSTRU[ÇC][ÃA]O NORMATIVA/],
  ['relatorios', 'Relatórios', /^RELAT[ÓO]RIO/],
  ['estudos', 'Estudos de Caso, Projetos e Pareceres', /^(ESTUDO DE CASO|PROJETO|PARECER)/],
  ['atestados', 'Atestados, Certidões e Declarações', /^(ATESTADO|CERTID|DECLARA)/],
  ['atas', 'Atas', /^ATA\b/],
  ['termos', 'Termos de Contrato e Convênio', /^TERMO/],
  ['boletins', 'Boletins e Itens para Boletim', /^(BOLETIM|ITEM PARA BOLETIM)/],
  ['escalas', 'Escalas e Trocas de Serviço', /^(ESCALA DE SERVI|SOLICITA[ÇC][ÃA]O DE TROCA)/],
  ['partediaria', 'Parte Diária', /^PARTE DI[ÁA]RIA/],
  ['ensino', 'Planos de Curso e Notas de Instrução', /^(PLANO DE CURSO|NOTA DE INSTRU)/],
  ['outros', 'Outros modelos do manual', /./]
];
const catDe = titulo => CAT_DOCM.find(([, , re]) => re.test(norm(titulo)))[0];
/* ---------- PROCEDIMENTOS (só oficiais): modelos do Manual de Processos e Procedimentos Administrativos (MPPADMIS) ---------- */
const CAT_PROC = [
  ['pr-sind-inst', 'Instauração e autuação', 'Sindicância', [0, 1, 2, 3, 4]],
  ['pr-sind-exp', 'Escrivão, despachos e termos', 'Sindicância', [5, 6, 7, 8, 9, 22, 44, 46]],
  ['pr-sind-cit', 'Citação, revelia e defensor dativo', 'Sindicância', [10, 11, 12, 13, 14, 39, 40, 43]],
  ['pr-sind-def', 'Interrogatório e defesa', 'Sindicância', [15, 16, 17, 42]],
  ['pr-sind-oit', 'Oitivas, acareação e reconhecimento', 'Sindicância', [18, 19, 20, 21, 23, 24, 25, 28, 29, 34, 35]],
  ['pr-sind-per', 'Perícias e diligências', 'Sindicância', [30, 31, 32, 33, 41]],
  ['pr-sind-praz', 'Prazos e carta precatória', 'Sindicância', [26, 27, 36, 37, 38]],
  ['pr-sind-sol', 'Relatório, solução e enquadramento', 'Sindicância', [45, 47, 48, 49, 50, 51, 52]],
  ['pr-cons-inst', 'Instauração e sessão inaugural', 'Conselho de Disciplina / Justificação', [53, 54, 55, 56, 57, 58, 59, 60, 61]],
  ['pr-cons-cit', 'Citação, interrogatório e libelo', 'Conselho de Disciplina / Justificação', [62, 63, 64, 65, 66, 67, 68, 69]],
  ['pr-cons-instr', 'Instrução e alegações finais', 'Conselho de Disciplina / Justificação', [70, 71, 72, 73, 74]],
  ['pr-cons-dec', 'Deliberação, relatório e decisão', 'Conselho de Disciplina / Justificação', [75, 76, 77]]
];
let procCache = null;
function procModelos(){
  if (procCache) return procCache;
  let lista = [];
  lista = P.mppadmis() || [];
  procCache = lista.map(m => {
    const c = CAT_PROC.find(c => c[3].includes(m.n));
    const titulo = {14: 'TERMO DE DESIGNAÇÃO DE DEFENSOR DATIVO (CITAÇÃO POR EDITAL)', 40: 'TERMO DE DESIGNAÇÃO DE DEFENSOR DATIVO (APÓS O TERMO DE REVELIA)', 7: 'DESPACHO DO SINDICANTE', 55: 'DESPACHO DO PRESIDENTE DO CONSELHO', 23: 'TERMO DE DECLARAÇÃO DO OFENDIDO (SINDICÂNCIA)', 70: 'TERMO DE DECLARAÇÃO DO OFENDIDO (CONSELHO)'}[m.n] || m.titulo;
    return {id: 'p' + m.n, titulo, cat: c?.[0] || 'pr-sind-exp', grupo: c?.[2] || '', pag: m.pag, blocos: m.blocos, regras: m.regras, proc: true};
  });
  return procCache;
}
const ehCatProc = k => /^pr-/.test(k || '');
/* modelo de origem de um documento (manual de redação ou MPPADMIS) */
function modeloDoc(o){
  if (!o) return null;
  if (/^p\d+$/.test(o.modeloId || '')) return procModelos().find(d => d.id === o.modeloId) || null;
  return (db.manualRedacao?.docs || []).find(d => d.id === o.modeloId || d.titulo === o.modelo) || null;
}
const catDoc = x => x.cat || catDe(x.modelo);
async function lerModelosGerais(zip, xml, rels, T){
  const numXml = await zip.texto('word/numbering.xml') || '';
  const P = s => new DOMParser().parseFromString(s, 'application/xml');
  const ln = e => e.localName, filhos = e => [...(e?.children || [])], ach = (e, n) => filhos(e).find(x => ln(x) === n);
  const at = (e, n) => e?.getAttribute('w:' + n);
  // ---- numeração (numbering.xml)
  const abst = {}, nums = {};
  if (numXml){
    const nd = P(numXml);
    [...nd.getElementsByTagNameNS('*', 'abstractNum')].forEach(a => {
      const lv = {};
      filhos(a).filter(x => ln(x) === 'lvl').forEach(l => {
        const ind = ach(ach(l, 'pPr'), 'ind'), rF = ach(ach(l, 'rPr'), 'rFonts');
        lv[at(l, 'ilvl')] = {start: +(at(ach(l, 'start'), 'val') || 1), fmt: at(ach(l, 'numFmt'), 'val') || 'decimal', txt: at(ach(l, 'lvlText'), 'val') ?? '%1.', left: +(at(ind, 'left') || at(ind, 'start') || 0), hang: +(at(ind, 'hanging') || 0), fonte: at(rF, 'ascii') || ''};
      });
      abst[at(a, 'abstractNumId')] = lv;
    });
    [...nd.getElementsByTagNameNS('*', 'num')].forEach(n => { nums[at(n, 'numId')] = at(ach(n, 'abstractNumId'), 'val'); });
  }
  const contador = {};
  const romano = n => { const t = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let s = ''; for (const [v, r] of t) while (n >= v){ s += r; n -= v; } return s; };
  const fmtNum = (n, f) => f === 'lowerLetter' ? String.fromCharCode(96 + ((n - 1) % 26) + 1) : f === 'upperLetter' ? String.fromCharCode(64 + ((n - 1) % 26) + 1) : f === 'lowerRoman' ? romano(n).toLowerCase() : f === 'upperRoman' ? romano(n) : String(n);
  const rotuloNum = (numId, ilvl) => {
    const a = abst[nums[numId]]; if (!a) return null;
    const L = a[ilvl] || a['0']; if (!L) return null;
    const c = contador[numId] ||= {};
    c[ilvl] = (c[ilvl] ?? (L.start - 1)) + 1;
    Object.keys(c).forEach(k => { if (+k > +ilvl) delete c[k]; });
    if (L.fmt === 'bullet'){ const ch = L.txt.charCodeAt(0); const r = /Wingdings/i.test(L.fonte) && (ch === 0xF0FC || ch === 0xFC) ? '✓' : /Wingdings/i.test(L.fonte) && (ch === 0xF0A7 || ch === 0xA7) ? '▪' : (L.txt === 'o' || L.txt === '-') ? '-' : '•'; return {t: r, left: L.left, hang: L.hang}; }
    const t = L.txt.replace(/%(\d)/g, (m, d) => { const lv = String(+d - 1), LL = a[lv] || L; return fmtNum(c[lv] ?? LL.start, LL.fmt); });
    return {t, left: L.left, hang: L.hang};
  };
  // ---- parágrafos e tabelas com formatação
  const doc = P(xml), body = doc.getElementsByTagNameNS('*', 'body')[0];
  const lerP = p => {
    const pPr = ach(p, 'pPr');
    const jc = at(ach(pPr, 'jc'), 'val') || 'left';
    const ind = ach(pPr, 'ind'), sp = ach(pPr, 'spacing');
    const o = {t: 'p', jc: jc === 'both' || jc === 'distribute' ? 'j' : jc === 'center' ? 'c' : (jc === 'right' || jc === 'end') ? 'r' : 'l',
      il: +(at(ind, 'left') || at(ind, 'start') || 0), ir: +(at(ind, 'right') || at(ind, 'end') || 0), fl: +(at(ind, 'firstLine') || 0) - +(at(ind, 'hanging') || 0),
      sb: +(at(sp, 'before') ?? 0) / 20, sa: +(at(sp, 'after') ?? 160) / 20, ln: +(at(sp, 'line') ?? 259), lr: at(sp, 'lineRule') || 'auto', runs: []};
    const numPr = ach(pPr, 'numPr');
    if (numPr){ const r = rotuloNum(at(ach(numPr, 'numId'), 'val'), at(ach(numPr, 'ilvl'), 'val') || '0'); if (r){ o.rot = r.t; if (!ind){ o.il = r.left; o.fl = -r.hang; } } }
    const pRPr = ach(pPr, 'rPr');
    let quebra = false, img = false;
    const andar = no => filhos(no).forEach(c => {
      const n = ln(c);
      if (n === 'r'){
        const rPr = ach(c, 'rPr');
        const flag = tag => { const e = ach(rPr, tag); if (!e) return false; const v = at(e, 'val'); return !(v === '0' || v === 'false' || v === 'none'); };
        if (flag('vanish')) return;
        const sz = +(at(ach(rPr, 'sz'), 'val') || at(ach(pRPr, 'sz'), 'val') || 22) / 2;
        const fonte = at(ach(rPr, 'rFonts'), 'ascii') || '';
        const st = {b: flag('b'), i: flag('i'), u: flag('u'), sz, n: /Narrow/i.test(fonte), caps: flag('caps')};
        filhos(c).forEach(t => {
          const tn = ln(t);
          if (tn === 't') o.runs.push({...st, t: st.caps ? t.textContent.toUpperCase() : t.textContent});
          else if (tn === 'tab' || tn === 'ptab') o.runs.push({...st, t: '\t'});
          else if (tn === 'br'){ if (at(t, 'type') === 'page') quebra = true; else o.runs.push({...st, t: '\n'}); }
          else if (tn === 'cr') o.runs.push({...st, t: '\n'});
          else if (tn === 'drawing'){ if (t.getElementsByTagNameNS('*', 'inline').length && t.getElementsByTagNameNS('*', 'blip').length) img = true; }
        });
      } else if (['hyperlink', 'smartTag', 'ins', 'sdt', 'sdtContent', 'fldSimple'].includes(n)) andar(c);
    });
    andar(p);
    if (img) o.img = true;
    if (quebra) o.pb = true;
    if (ach(pPr, 'pageBreakBefore')) o.pb = true;
    // tamanho e fonte do parágrafo = o que predomina nos trechos
    const cont = {}; o.runs.filter(r => r.t.trim()).forEach(r => cont[r.sz] = (cont[r.sz] || 0) + r.t.length);
    o.sz = +(Object.entries(cont).sort((a, b) => b[1] - a[1])[0]?.[0] || at(ach(pRPr, 'sz'), 'val') / 2 || 12);
    o.n = o.runs.filter(r => r.t.trim()).length > 0 && o.runs.filter(r => r.t.trim()).every(r => r.n);
    o.txt = marcar(o.runs);
    delete o.runs;
    return o;
  };
  const marcar = runs => {
    // trechos → texto com **negrito**, *itálico* e __sublinhado__ (o que o editor e o PDF entendem)
    let s = '', cur = {b: false, i: false, u: false};
    const abre = (k, m) => { s += m; cur[k] = !cur[k]; };
    runs.forEach(r => {
      const t = r.t.replace(/\*/g, '∗');
      if (!t) return;
      if (!t.trim()){ // espaço puro não muda o estilo
        s += t; return;
      }
      if (cur.u && !r.u) abre('u', '++'); if (cur.i && !r.i) abre('i', '*'); if (cur.b && !r.b) abre('b', '**');
      if (!cur.b && r.b) abre('b', '**'); if (!cur.i && r.i) abre('i', '*'); if (!cur.u && r.u) abre('u', '++');
      s += t;
    });
    if (cur.u) s += '++'; if (cur.i) s += '*'; if (cur.b) s += '**';
    return s.replace(/\*\*(\s*)\*\*/g, '$1').replace(/\+\+(\s*)\+\+/g, '$1');
  };
  const bordas = el => { const o = {}; ['top', 'bottom', 'left', 'right', 'insideH', 'insideV', 'start', 'end'].forEach(k => { const b = ach(el, k); if (b){ const v = at(b, 'val'); o[k === 'start' ? 'left' : k === 'end' ? 'right' : k] = !(v === 'nil' || v === 'none'); } }); return o; };
  const lerTbl = t => {
    const tblPr = ach(t, 'tblPr');
    const o = {t: 'tbl', cols: filhos(ach(t, 'tblGrid')).filter(g => ln(g) === 'gridCol').map(g => +at(g, 'w') || 0), bord: bordas(ach(tblPr, 'tblBorders')), jc: at(ach(tblPr, 'jc'), 'val') || 'left', ind: +(at(ach(tblPr, 'tblInd'), 'w') || 0), rows: []};
    const cm = ach(tblPr, 'tblCellMar'); o.pad = +(at(ach(cm, 'left') || ach(cm, 'start'), 'w') ?? 108);
    if (!Object.keys(o.bord).length) o.bord = {top: false, bottom: false, left: false, right: false, insideH: false, insideV: false};
    filhos(t).filter(r => ln(r) === 'tr').forEach(tr => {
      const trPr = ach(tr, 'trPr'), hh = ach(trPr, 'trHeight');
      const row = {h: hh ? +at(hh, 'val') / 20 : 0, hr: at(hh, 'hRule') || 'atLeast', antes: +(at(ach(trPr, 'gridBefore'), 'val') || 0), cells: []};
      filhos(tr).filter(c => ln(c) === 'tc').forEach(tc => {
        const tcPr = ach(tc, 'tcPr'), vm = ach(tcPr, 'vMerge'), shd = ach(tcPr, 'shd');
        const fill = at(shd, 'fill');
        row.cells.push({span: +(at(ach(tcPr, 'gridSpan'), 'val') || 1), vm: vm ? (at(vm, 'val') === 'restart' ? 'r' : 'c') : '', bord: bordas(ach(tcPr, 'tcBorders')), fill: fill && fill !== 'auto' && fill !== 'FFFFFF' ? '#' + fill : '', va: at(ach(tcPr, 'vAlign'), 'val') || 'top',
          ps: filhos(tc).filter(x => ln(x) === 'p').map(lerP)});
      });
      o.rows.push(row);
    });
    return o;
  };
  // ---- percorre o corpo inteiro (a numeração conta na ordem do documento)
  const itens = [];
  const visitar = no => filhos(no).forEach(c => { const n = ln(c); if (n === 'p') itens.push(lerP(c)); else if (n === 'tbl') itens.push(lerTbl(c)); else if (n === 'sdt' || n === 'sdtContent') visitar(c); });
  visitar(body);
  const sem = s => norm(String(s || '').replace(/\*\*|\+\+|\*/g, ''));
  const semTxt = s => String(s || '').replace(/\*\*|\+\+|\*/g, '');
  // títulos "MODELO DE …" do apêndice (os últimos de cada nome)
  const tit = [];
  itens.forEach((it, i) => { if (it.t === 'p' && /^MODELOS? DE\s+\S/.test(sem(it.txt)) && sem(it.txt).length < 90 && !/\.{4,}|\d+$/.test(sem(it.txt))) tit.push({i, nome: sem(it.txt).replace(/^MODELOS? DE\s+/, ''), bruto: semTxt(it.txt).replace(/^MODELOS? DE\s+/i, '').trim()}); });
  const modelos = [];
  tit.forEach((x, k) => {
    if (/^OF[IÍ]CIO|^ORDEM DE SERVI/.test(x.nome)) return; // têm telas próprias
    const fim = k + 1 < tit.length ? tit[k + 1].i : itens.length;
    let blocos = itens.slice(x.i + 1, fim);
    // corta o que vem depois do modelo (títulos de capítulo, rodapés do manual)
    const iCorte = blocos.findIndex(b => b.t === 'p' && /^(AP[ÊE]NDICE|ANEXO [A-Z]\b.*MANUAL|REFER[ÊE]NCIAS)/.test(sem(b.txt)));
    if (iCorte > 0) blocos = blocos.slice(0, iCorte);
    while (blocos.length && blocos[0].t === 'p' && !blocos[0].txt.trim() && !blocos[0].img) blocos.shift();
    while (blocos.length && blocos[blocos.length - 1].t === 'p' && !blocos[blocos.length - 1].txt.trim()) blocos.pop();
    if (blocos[0]) delete blocos[0].pb;
    if (!blocos.length) return;
    const titulo = (x.bruto || x.nome).replace(/\s+/g, ' ').trim();
    const cat = CAT_DOCM.find(([, , re]) => re.test(titulo))[0];
    modelos.push({id: 'm' + modelos.length, titulo, cat, blocos, regras: secaoManual(T, titulo)});
  });
  return modelos;
}
/* o texto do manual sobre aquele documento (mostrado ao lado do editor) */
function secaoManual(T, titulo){
  const nomes = {RELATORIO: 'Relatório', 'ESTUDO DE CASO': 'Estudo de Caso', PROJETO: 'Projeto', PARECER: 'Parecer', ATA: 'Ata', ATESTADO: 'Atestado', CERTIDAO: 'Certidão', DECLARACAO: 'Declaração',
    'TERMO DE CONTRATO E TERMO DE CONVENIO': 'Termo de contrato', BOLETIM: 'Boletim', 'ITEM PARA BOLETIM': 'Item para Boletim', 'ESCALA DE SERVICO': 'Escala de Serviço', 'SOLICITACAO DE TROCA DE SERVICO': 'Solicitação de Troca de Serviço',
    'PARTE DIARIA': 'Parte Diária', 'NOTA DE INSTRUCAO': 'Nota de Instrução', PARTE: 'Parte', MEMORANDO: 'Memorando', REQUERIMENTO: 'Requerimento', DIRETRIZ: 'Diretriz', 'INSTRUCAO NORMATIVA': 'Instrução Normativa', PORTARIA: 'Portaria', EDITAL: 'Edital', 'DESPACHO (ORDINATORIO)': 'Despacho', 'ORDEM DE OPERACAO': 'Ordem de Operação', 'PLANO DE CURSO': 'Plano de curso', 'REGULAMENTO E REGIMENTO': 'Regulamento', 'MENSAGENS ELETRONICAS': 'Mensagem eletrônica'};
  const nome = nomes[norm(titulo)] || titulo.toLowerCase().replace(/^./, c => c.toUpperCase());
  const linhas = T.split('\n');
  // a seção é o último cabeçalho com esse nome antes do apêndice, seguido de texto corrido
  let ini = -1;
  for (let i = 0; i < linhas.length - 1; i++){ if (norm(linhas[i].trim()) === norm(nome) && (linhas[i + 1] || '').trim().length > 60){ ini = i; break; } }
  if (ini < 0) return [];
  const out = [];
  for (let i = ini + 1; i < linhas.length && out.join(' ').length < 4500; i++){
    const t = linhas[i].trim(); if (!t) continue;
    if (/^(MODELO DE|Dos atos|DOS DOCUMENTOS)/i.test(t)) break;
    if (out.length > 3 && t.length < 45 && !/[.:;,]$/.test(t) && /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(t) && Object.values(nomes).some(n => norm(n) === norm(t))) break;
    out.push(t);
  }
  return out;
}

function trechoDe(T, achado){ const i = T.indexOf(achado); if (i < 0) return achado; const ini = T.lastIndexOf('\n', i) + 1, fim = T.indexOf('\n', i + achado.length); return T.slice(ini, fim < 0 ? undefined : fim).trim().slice(0, 260); }

/* Um modelo do apêndice do manual vira um ofício de exemplo já preenchido */
function lerModeloOficio(ps, titulo){
  const linhas = ps.map(p => ({...p, t: p.texto.replace(/\s+/g, ' ').trim()}));
  const img = linhas.find(p => p.img)?.img || null;
  const L = linhas.filter(p => p.t);
  const iEp = L.findIndex(p => /^Of[íi]cio(\s+Circular)?\s+n[º°o]/i.test(p.t));
  if (iEp < 0) return null;
  const circular = /CIRCULAR/i.test(titulo) || /Circular/i.test(L[iEp].t);
  const ex = {cab: L.slice(0, iEp).map(p => p.t).filter(t => t === t.toUpperCase()).slice(0, 2)};
  const mEp = /^(Of[íi]cio(?:\s+Circular)?)\s+n[º°o]\s*(\d+)\/(\d{4})\s*[–-]\s*(.+)$/i.exec(L[iEp].t);
  if (mEp){ ex.numero = mEp[2]; ex.ano = mEp[3]; ex.setores = mEp[4].split('/').map(s => s.trim()).filter(Boolean); }
  let k = iEp + 1;
  if (/^SGD:/i.test(L[k]?.t || '')){ ex.sgd = L[k].t.replace(/^SGD:\s*/i, ''); k++; }
  const mLD = /^(.+?)\s*(–|-|\/)\s*([A-Z]{2}),\s*(.+?)\.?$/.exec(L[k]?.t || '');
  if (mLD){ ex.cidade = mLD[1].trim(); ex.sep = mLD[2] === '/' ? '/' : '–'; ex.uf = mLD[3]; k++; }
  const iAss = L.findIndex((p, i) => i >= k && /^Assunto:/i.test(p.t));
  const dest = L.slice(k, iAss < 0 ? k : iAss);
  if (circular){ ex.circularDest = dest.map(p => p.t).join(' '); }
  else if (dest.length){
    ex.destEnd = dest[0]?.t || '';
    const nome = dest[1]?.t || '';
    const mP = /^((?:TEN CEL|[1-3]º TEN|[1-3]º SGT|CEL|MAJ|CAP|ASP OF|CAD|ST|CB|SD|AL PRAÇA)(?:\s+(?:QOPM|QOS|QOA|QOAS|QOM|QPPM|QPE|QPS|QPM|QOE|QOPMS))?)\s+(.+)$/.exec(nome);
    ex.destMilitar = !!mP; ex.destPosto = mP ? mP[1] : ''; ex.destNome = mP ? mP[2] : nome;
    let fun = dest[2]?.t || ''; ex.destResp = /^Resp\.?\s*p/i.test(fun); ex.destFuncao = fun.replace(/^Resp\.?\s*p(?:\/|elo|ela)?\s*/i, '');
    ex.destLocal = dest.length > 4 ? dest[3].t : '';
    const cid = (dest.length > 4 ? dest[4] : dest[3])?.t || '';
    const mC = /^(.+?)\s*(–|-|\/)\s*([A-Z]{2})$/.exec(cid); if (mC){ ex.destCidade = mC[1].trim(); ex.destUF = mC[3]; }
  }
  if (iAss < 0) return {titulo, tipo: circular ? 'circular' : 'oficio', img, exemplo: ex};
  k = iAss;
  ex.assunto = L[k].t.replace(/^Assunto:\s*/i, ''); k++;
  if (/^Anexos?:/i.test(L[k]?.t || '')){ ex.anexos = L[k].t.replace(/^Anexos?:\s*/i, ''); k++; }
  if (L[k] && /,$/.test(L[k].t) && /^(Senhor|Senhora|Senhores|Senhoras|Excelent|Prezad|Magn|Merit|Eminent|Reverend|Sant)/i.test(L[k].t)){ ex.vocativo = L[k].t; k++; } else ex.semVocativo = true;
  const iF = L.findIndex((p, i) => i >= k && /^(Respeitosamente|Atenciosamente),?$/i.test(p.t));
  const corpo = L.slice(k, iF < 0 ? k : iF);
  ex.texto = corpo.map(p => p.runs.map(r => r.b && r.t.trim() ? `**${r.t.trim()}**${/\s$/.test(r.t) ? ' ' : ''}` : r.t).join('').replace(/\s+/g, ' ').replace(/\*\*\s*\*\*/g, '').trim()).join('\n');
  if (iF >= 0){
    ex.fecho = /^Aten/i.test(L[iF].t) ? 'Atenciosamente' : 'Respeitosamente';
    let j = iF + 1;
    if (/^Assinatura digital/i.test(L[j]?.t || '')){ ex.assDigital = true; ex.ni = /NI\s*$/.test(L[j].t); j++; }
    const sig = L[j];
    if (sig && / [–-] /.test(sig.t)){
      const [nome, posto] = sig.t.split(/\s+[–-]\s+/);
      ex.sigNome = nome.trim(); ex.sigPosto = (posto || '').trim();
      const negr = sig.runs.filter(r => r.b).map(r => norm(r.t).trim()).join(' ');
      const pal = ex.sigNome.split(/\s+/);
      ex.sigGuerra = pal.map((w, i) => negr.split(/\s+/).includes(norm(w)) ? i : -1).filter(i => i >= 0);
      j++;
    }
    if (L[j]){ ex.sigResp = /^Resp\.?\s*p/i.test(L[j].t); ex.sigFuncao = L[j].t.replace(/^Resp\.?\s*p\/\s*/i, ''); j++; }
    const rod = L.slice(j).map(p => p.t).filter(t => !/^\d+$/.test(t)).slice(0, 2);
    ex.rodape1 = rod[0] || ''; ex.rodape2 = rod[1] || '';
  }
  return {titulo, tipo: circular ? 'circular' : 'oficio', img, exemplo: ex};
}

/* ================= OFÍCIOS (conforme o Manual de Redação Oficial importado) ================= */
let ofAtualId = null, ofPreviaSeq = 0, ofPreviaTimer = null, ofUltimoLayout = null;
const CM = 28.3465;
const ofAtual = () => (db.oficios || []).find(o => o.id === ofAtualId);
const meuOficio = o => ehAdmin() || (!!o.autorId && o.autorId === P.perfilId);
const regraOf = k => db.manualRedacao?.regras?.[k]?.valor ?? REGRAS_OFICIO.find(r => r[0] === k)?.[2];
const NOME_MODELO = t => t.replace(/^MODELO DE\s+/i, '').toLowerCase().replace(/(^|\s|–\s)(\S)/g, (m, a, b) => a + b.toUpperCase()).replace(/\bÀs?\b|\bDe\b|\bDo\b|\bDa\b|\bE\b/g, m => m.toLowerCase()).replace(/^./, c => c.toUpperCase());
const POSTO_EXTENSO = {'CEL': 'Coronel', 'TEN CEL': 'Tenente-Coronel', 'MAJ': 'Major', 'CAP': 'Capitão', '1º TEN': 'Tenente', '2º TEN': 'Tenente', 'ASP OF': 'Aspirante', 'CAD': 'Cadete', 'ST': 'Subtenente', '1º SGT': 'Sargento', '2º SGT': 'Sargento', '3º SGT': 'Sargento', 'CB': 'Cabo', 'SD': 'Soldado'};
const OF_PADRAO = {
  cab1: 'COMANDO REGIONAL DE POLICIAMENTO – 1ª REGIÃO', cab2: '8º BATALHÃO DE POLÍCIA MILITAR',
  setores: ['P3', '8º BPM', '', ''], cidade: 'Paraíso do Tocantins', sep: '/', uf: 'TO',
  sigNome: 'Robson Santos Sousa', sigGuerra: [0], sigPosto: 'TEN CEL QOPM', sigFuncao: 'Comandante do 8º BPM',
  rodape1: 'Rua Graça Aranha, s/nº, Setor Serrano II, CEP 77.600-000 – Paraíso do Tocantins – TO',
  rodape2: 'Tel: (63) 3602-2510 / 5361 – e-mail: bpm8pmto@hotmail.com'
};

/* ---------- textos montados a partir dos campos ---------- */
const siglaSemBarra = s => String(s || '').trim().replace(/\s*\/\s*/g, '');
function epigrafeOf(c){ return `${c.tipoDoc || 'Ofício'} nº ${String(c.numero || '').padStart(3, '0')}/${c.ano || ''} – ${(c.setores || []).map(siglaSemBarra).filter(Boolean).join('/')}`; }
function localDataOf(c){
  if (!c.data) return '';
  const [a, m, d] = c.data.split('-').map(Number);
  const dia = d === 1 ? '1º' : String(d);
  const sep = c.sep === '/' ? '/' : ' – ';
  return `${(c.cidade || '').trim()}${sep}${(c.uf || '').trim()}, ${dia} de ${MESES_NOME[m - 1].toLowerCase()} de ${a}.`;
}
function linhaTratamento(c){ const [q, i] = String(c.trat || '').split('|').map(Number); return db.manualRedacao?.quadros?.[q]?.linhas?.[i] || null; }
function enderecamentoOf(c){
  const L = linhaTratamento(c), F = c.genero === 'F';
  const e = L?.enderecamento || 'Ao Senhor';
  if (/Excel[êe]ncia/i.test(e)) return F ? 'A Sua Excelência a Senhora' : 'A Sua Excelência o Senhor';
  if (/^Ao Senhor/i.test(e)) return F ? 'À Senhora' : 'Ao Senhor';
  return e.split('+')[0].trim();
}
function vocativoAutoOf(c){
  const L = linhaTratamento(c); if (!L) return '';
  let v = L.vocativo;
  if (/>>/.test(v)){ const ln = v.split(/\n|>>/).map(s => s.trim()).filter(Boolean).find(s => /subordinado para o superior/i.test(s)) || ''; v = ln.replace(/^.*?:\s*/, ''); }
  v = v.split(/\s+ou\s+/i)[0].replace(/\(por extenso\)/i, '').trim();
  const cargo = (c.destFuncao || '').replace(/^Resp\.?\s*p(?:\/|elo|ela)?\s*/i, '').trim().split(/\s+/)[0] || 'Cargo';
  const posto = POSTO_EXTENSO[(c.destPosto || '').replace(/\s+(QO\w*|QP\w*|QOA\w*)$/i, '').trim().toUpperCase()] || 'Posto';
  v = v.replace(/\+\s*Posto/i, posto).replace(/\+\s*(Cargo|fun[çc][ãa]o|Nome)/i, cargo).replace(/[;.]\s*$/, '').trim();
  if (c.genero === 'F') v = v.replace(/\bSenhor\b/g, 'Senhora').replace(/Excelent[íi]ssimo/g, 'Excelentíssima').replace(/\bPrezado\b/g, 'Prezada');
  return v.replace(/,?\s*$/, ',');
}
const vocativoOf = c => c.semVocativo ? '' : (c.vocAuto !== false ? vocativoAutoOf(c) : (c.vocativo || '').trim());
function nomeArquivoOf(c){
  const limpa = s => String(s || '').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
  const destino = limpa(c.siglaDestino) || limpa(siglaSemBarra((c.setores || [])[0]));
  return `${c.tipoDoc || 'Ofício'} ${String(c.numero || '').padStart(3, '0')}-${c.ano} – ${destino} – ${limpa(c.assunto).slice(0, 80) || 'sem assunto'}.pdf`;
}
function proximoNumeroOf(c, ignorar){
  const chave = x => `${x.tipoDoc}|${x.ano}|${(x.setores || []).map(siglaSemBarra).filter(Boolean).join('/')}`;
  const k = chave(c);
  const nums = (db.oficios || []).filter(o => o.id !== ignorar && chave(o.campos) === k).map(o => parseInt(o.campos.numero) || 0);
  return String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0');
}

/* ---------- texto com **negrito** e *itálico* ---------- */
function trechosOf(txt, base = {}){
  const out = []; let b = false, i = false, u = false, buf = '';
  const s = String(txt ?? '');
  const flush = () => { if (buf) out.push({t: buf, b: b || !!base.b, i: i || !!base.i, u: u || !!base.u}); buf = ''; };
  for (let k = 0; k < s.length; k++){
    if (s[k] === '+' && s[k + 1] === '+'){ flush(); u = !u; k++; continue; }
    if (s[k] === '*' && s[k + 1] === '*'){ flush(); b = !b; k++; continue; }
    if (s[k] === '*' && s[k - 1] !== '\\'){ flush(); i = !i; continue; }
    buf += s[k];
  }
  flush(); return out;
}

/* ================= EDIÇÃO DIRETO NA PRÉVIA DO PDF =================
   Os geradores devolvem "regioes" (onde cada trecho foi desenhado: página, x, y, largura, altura e uma referência).
   A prévia põe por cima de cada região uma área clicável; o clique abre um editor no próprio lugar.
   O texto digitado volta para o documento e o PDF é refeito pelo gerador, sempre com as regras do manual. */
function juntarRegioes(rs){
  const m = new Map();
  rs.forEach(r => { if (!r.ref || r.h <= 0) return; const k = r.p + '|' + r.ref, a = m.get(k);
    if (!a) m.set(k, {...r}); else { const x2 = Math.max(a.x + a.w, r.x + r.w), y2 = Math.max(a.y + a.h, r.y + r.h); a.x = Math.min(a.x, r.x); a.y = Math.min(a.y, r.y); a.w = x2 - a.x; a.h = y2 - a.y; } });
  return [...m.values()];
}
const escHtml = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function marcaParaHtml(txt){
  return String(txt || '').split('\n').map(l => trechosOf(l).map(sg => { let h = escHtml(sg.t); if (sg.u) h = `<u>${h}</u>`; if (sg.i) h = `<i>${h}</i>`; if (sg.b) h = `<b>${h}</b>`; return h; }).join('')).join('<br>');
}
/* ---- folha editável (como no Word) ----
   Cada trecho de texto da folha vira um bloco editável posicionado exatamente onde o PDF o desenha
   (mesma fonte, tamanho, entrelinha, recuos e alinhamento). A prévia em canvas mostra só o que não é texto
   editável (brasão, bordas…). Ao parar de digitar, o PDF é refeito pelas regras do manual e o cursor é mantido. */
let pvAtivo = null, pvFoco = null;
const CM_PT = 72 / 2.54;
/* percorre o conteúdo de um bloco: texto com estilo e quebras de linha (pula prefixos fixos) */
function andarBloco(raiz, cb){
  let ultimoNl = true, algum = false;
  const ir = (no, st) => {
    if (no.nodeType === 3){ if (no.nodeValue){ cb({t: 'txt', no, st}); algum = true; ultimoNl = false; } return; }
    if (no.nodeType !== 1 && no.nodeType !== 11) return;
    if (no.nodeType === 1 && no.getAttribute('contenteditable') === 'false') return;
    const tag = no.tagName, cs = no.style || {};
    if (tag === 'BR'){ cb({t: 'nl', no, st}); ultimoNl = true; algum = true; return; }
    const n = no.nodeType === 11 ? st : {b: st.b || tag === 'B' || tag === 'STRONG' || +cs.fontWeight >= 600 || cs.fontWeight === 'bold', i: st.i || tag === 'I' || tag === 'EM' || cs.fontStyle === 'italic', u: st.u || tag === 'U' || /underline/.test(cs.textDecoration || '')};
    if ((tag === 'DIV' || tag === 'P') && algum && !ultimoNl){ cb({t: 'nl', no, st, div: true}); ultimoNl = true; }
    no.childNodes.forEach(c => ir(c, n));
  };
  raiz.childNodes.forEach(c => ir(c, {b: false, i: false, u: false}));
}
function htmlParaMarca(raiz){
  const runs = [];
  andarBloco(raiz, it => runs.push(it.t === 'nl' ? {t: '\n', ...it.st} : {t: it.no.nodeValue.replace(/ /g, ' ').replace(/\*/g, '∗'), ...it.st}));
  let s = '', cur = {b: false, i: false, u: false};
  const marca = {b: '**', i: '*', u: '++'};
  runs.forEach(r => {
    if (!r.t) return;
    if (!r.t.trim()){ s += r.t; return; }
    ['u', 'i', 'b'].forEach(k => { if (cur[k] && !r[k]){ s += marca[k]; cur[k] = false; } });
    ['b', 'i', 'u'].forEach(k => { if (!cur[k] && r[k]){ s += marca[k]; cur[k] = true; } });
    s += r.t;
  });
  ['u', 'i', 'b'].forEach(k => { if (cur[k]) s += marca[k]; });
  return s.replace(/\*\*(\s*)\*\*/g, '$1').replace(/\+\+(\s*)\+\+/g, '$1').replace(/\n$/, '');
}
const contarBloco = raiz => { let n = 0; andarBloco(raiz, it => { n += it.t === 'nl' ? 1 : it.no.nodeValue.length; }); return n; };
function posCursor(bl){
  const sel = getSelection(); if (!sel.rangeCount || !bl.contains(sel.anchorNode)) return 0;
  const r = sel.getRangeAt(0), pre = document.createRange(); pre.selectNodeContents(bl); pre.setEnd(r.endContainer, r.endOffset);
  return contarBloco(pre.cloneContents());
}
function porCursor(bl, off){
  const sel = getSelection(), rg = document.createRange(); let feito = false, ultimo = null;
  andarBloco(bl, it => {
    if (feito) return;
    if (it.t === 'txt'){ const n = it.no.nodeValue.length; if (off <= n){ rg.setStart(it.no, off); feito = true; return; } off -= n; ultimo = it.no; }
    else { if (off === 0){ if (it.div){ rg.setStart(it.no, 0); } else rg.setStartBefore(it.no); feito = true; return; } off -= 1; }
  });
  if (!feito){ rg.selectNodeContents(bl); rg.collapse(false); }
  rg.collapse(true); sel.removeAllRanges(); sel.addRange(rg);
}
const linhaHangOS = t => /^([a-z]\)|[•✓▪])\s+/.test(t.trim()) ? 'pv-h' : /^-\s*/.test(t.trim()) ? 'pv-hd' : '';
function htmlBloco(d){
  const pre = d.pre ? `<span class="pv-pre${d.preW ? ' pv-prew' : ''}" contenteditable="false" style="font-weight:${d.preB ? 700 : 400}${d.preW ? ';width:var(--prew)' : ''}">${escHtml(d.pre)}</span>` : '';
  const rot = d.rot != null && d.rot !== '' ? `<span class="pv-pre pv-rot" contenteditable="false">${escHtml(d.rot)}</span>` : '';
  if (d.linhas){
    const ls = String(d.txt || '').split('\n');
    return ls.map((l, k) => {
      const m = /^(\s*(?:[a-z]\)|[•✓▪])\s+)([\s\S]*)$/.exec(l);
      const corpo = m ? `<span class="pv-li">${escHtml(m[1])}</span>${marcaParaHtml(m[2])}` : (marcaParaHtml(l) || '<br>');
      return `<div class="${linhaHangOS(l)}">${k ? '' : pre}${corpo}</div>`;
    }).join('');
  }
  return pre + rot + (marcaParaHtml(d.txt) || (pre || rot ? '' : '<br>'));
}
/* monta a folha: canvas (sem o texto editável) + blocos de texto editáveis + áreas de campos montados */
function previaEditavel(box, canvases, regioes, adapt){
  const ativo = document.activeElement?.closest?.('.pv-bl');
  let foco = pvFoco?.box === box ? pvFoco : (ativo && box.contains(ativo) ? {ref: ativo.dataset.ref, off: posCursor(ativo)} : null);
  if (pvFoco?.box === box) pvFoco = null;
  montarFerramentas(box);
  const W = 595.28, novo = el('div', {class: 'pv-paginas'});
  // parágrafo dividido entre páginas: cada parte é o mesmo texto, deslocado e recortado nas linhas daquela página
  const partes = new Map(); (regioes || []).forEach(g => { if (!partes.has(g.ref)) partes.set(g.ref, []); partes.get(g.ref).push(g); });
  partes.forEach(lst => { if (lst.length < 2) return; lst.sort((a, b) => a.p - b.p); let off = 0; lst.forEach((g, k) => { g.off = off; g.ult = k === lst.length - 1; g.prim = k === 0; off += g.h; }); });
  const wraps = canvases.map((cv, i) => {
    const wrap = el('div', {class: 'pv-pag'}); wrap.append(cv); novo.append(wrap);
    const esc = parseFloat(cv.style.width) / W;
    (regioes || []).filter(g => g.p === i).forEach(g => {
      const d = adapt.ler(g.ref);
      if (!d){
        const a = el('div', {class: 'pv-alvo form', title: 'Este trecho vem do formulário: clique para abrir o campo'});
        Object.assign(a.style, {left: g.x * esc - 3 + 'px', top: g.y * esc - 1 + 'px', width: g.w * esc + 6 + 'px', height: g.h * esc + 2 + 'px'});
        a.addEventListener('mousedown', ev => { ev.preventDefault(); mostrarCampos(box, true); adapt.focar?.(g.ref); });
        wrap.append(a); return;
      }
      wrap.append(criarBloco(box, g, d, esc, adapt));
    });
    return wrap;
  });
  const velho = box.querySelector(':scope > .pv-paginas');
  if (velho) velho.replaceWith(novo); else { box.innerHTML = ''; box.append(novo); }
  box._pv = {regioes: regioes || [], adapt};
  novo.querySelectorAll('.pv-bl').forEach(b => {
    b._h0 = b.offsetHeight;
    const g = b._g; if (g?.off === undefined) return;
    const esc = b._esc, cima = g.prim ? -4 : g.off * esc - 1, baixo = g.ult ? -9999 : Math.max(0, b.offsetHeight - (g.off + g.h) * esc - 1);
    b.style.clipPath = `inset(${cima}px -6px ${baixo}px -6px)`;
  });
  if (foco){ const b = [...novo.querySelectorAll('.pv-bl')].find(x => x.dataset.ref === foco.ref); if (b){ b.focus({preventScroll: true}); porCursor(b, foco.off); ativarBloco(b); } }
}
function criarBloco(box, g, d, esc, adapt){
  const s = g.s || 12, lh = g.lh || s * 1.149, il = g.il || 0, ir = g.ir || 0, fl = g.fl || 0, nar = g.n ? 0.82 : 1;
  const bl = el('div', {class: 'pv-bl' + (d.linhas ? ' os' : ''), contenteditable: 'true', spellcheck: 'true', 'data-ref': g.ref, title: ''});
  const top = (g.y - (g.off || 0) + lh / 2 - 0.5905 * s) * esc;
  Object.assign(bl.style, {left: (g.x + il) * esc + 'px', top: top + 'px', width: (g.w - il - ir) / nar * esc + 'px', minHeight: lh * esc + 'px',
    fontSize: s * esc + 'px', lineHeight: lh * esc + 'px', textIndent: d.linhas ? '0' : fl * esc + 'px',
    textAlign: {c: 'center', r: 'right', j: 'justify'}[d.jc || g.jc] || 'left'});
  if (nar !== 1){ bl.style.transform = `scaleX(${nar})`; bl.style.transformOrigin = 'left top'; }
  if (d.base?.b) bl.style.fontWeight = '700';
  if (d.caixa) bl.style.textTransform = 'uppercase';
  bl.style.setProperty('--esp', 2 * (g.esp || 0) * esc + 'px');
  bl.style.setProperty('--hang', 0.75 * CM_PT * esc + 'px');
  if (d.preW) bl.style.setProperty('--prew', d.preW * esc + 'px');
  if (d.rot != null) bl.style.setProperty('--rotw', Math.max(0, -fl) * esc + 'px');
  bl.innerHTML = htmlBloco(d);
  bl._t0 = top; bl._d = d; bl._adapt = adapt; bl._box = box; bl._g = g; bl._esc = esc;
  bl.addEventListener('focus', () => ativarBloco(bl));
  bl.addEventListener('input', () => { adapt.gravar(g.ref, htmlParaMarca(bl)); adapt.mudou(); empurrar(bl); atualizarFerramentas(); });
  bl.addEventListener('paste', e => { e.preventDefault(); const t = (e.clipboardData.getData('text/plain') || '').replace(/\r/g, ''); document.execCommand('insertText', false, d.linhas || d.podeNovo ? t : t.replace(/\n+/g, ' ')); });
  bl.addEventListener('keydown', e => teclaBloco(e, bl));
  return bl;
}
/* enquanto digita, os blocos de baixo descem/sobem junto (até o PDF ser refeito) */
function empurrar(bl){
  const delta = bl.offsetHeight - (bl._h0 || 0), wrap = bl.parentNode;
  wrap.querySelectorAll('.pv-bl').forEach(o => { if (o !== bl && o._t0 > bl._t0 + 1) o.style.top = o._t0 + delta + 'px'; });
}
function ativarBloco(bl){ pvAtivo = bl; bl._box.querySelectorAll('.pv-bl.ativo').forEach(x => x !== bl && x.classList.remove('ativo')); bl.classList.add('ativo'); atualizarFerramentas(); }
function blocosEmOrdem(box){ return [...box.querySelectorAll('.pv-bl')]; }
function irParaBloco(bl, fim){ if (!bl) return false; bl.focus({preventScroll: false}); porCursor(bl, fim ? contarBloco(bl) : 0); bl.scrollIntoView({block: 'nearest'}); return true; }
function teclaBloco(e, bl){
  const d = bl._d, adapt = bl._adapt, ref = bl.dataset.ref, box = bl._box;
  const sel = getSelection(), colapsada = sel.isCollapsed;
  if (e.key === 'Enter'){
    if (d.linhas) return;                          // células da OS: Enter = nova linha na célula
    e.preventDefault();
    if (e.shiftKey || !d.podeNovo){ if (e.shiftKey || d.quebra) document.execCommand('insertLineBreak'); else irParaBloco(blocosEmOrdem(box)[blocosEmOrdem(box).indexOf(bl) + 1]); return; }
    // divide o parágrafo no cursor, como no Word
    const r = sel.getRangeAt(0); r.deleteContents();
    const resto = document.createRange(); resto.setStart(r.startContainer, r.startOffset); resto.setEnd(bl, bl.childNodes.length);
    const frag = resto.extractContents(), tmp = document.createElement('div'); tmp.append(frag);
    adapt.gravar(ref, htmlParaMarca(bl));
    const nr = adapt.novo(ref, htmlParaMarca(tmp)); if (!nr) return;
    pvFoco = {box, ref: nr, off: 0}; adapt.estrutura?.(); adapt.mudou(0); return;
  }
  if (e.key === 'Backspace' && colapsada && d.podeJuntar && posCursor(bl) === 0){
    const j = adapt.juntar?.(ref); if (!j) return;
    e.preventDefault(); pvFoco = {box, ref: j.ref, off: j.off}; adapt.estrutura?.(); adapt.mudou(0); return;
  }
  if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && colapsada){
    const lista = blocosEmOrdem(box), i = lista.indexOf(bl);
    const rc = sel.getRangeAt(0).getClientRects()[0], br = bl.getBoundingClientRect(), lhp = parseFloat(bl.style.lineHeight) || 16;
    const primeira = !rc || rc.top - br.top < lhp * 0.8, ultima = !rc || br.bottom - rc.bottom < lhp * 0.8;
    if (e.key === 'ArrowUp' && primeira && i > 0){ e.preventDefault(); irParaBloco(lista[i - 1], true); }
    if (e.key === 'ArrowDown' && ultima && i < lista.length - 1){ e.preventDefault(); irParaBloco(lista[i + 1], false); }
  }
}
/* barra de ferramentas da folha (fica no topo da prévia) */
function montarFerramentas(box){
  if (box._ferr) return;
  const bt = (t, title, fn, cls) => { const b = el('button', {type: 'button', class: 'pv-bt ' + (cls || ''), title}); b.innerHTML = t; b.addEventListener('mousedown', e => { e.preventDefault(); fn(); }); return b; };
  const fmt = c => { if (!pvAtivo || !box.contains(pvAtivo)) return; document.execCommand(c); pvAtivo.dispatchEvent(new Event('input')); };
  const f = el('div', {class: 'pv-tool'},
    bt('<b>B</b>', 'Negrito (Ctrl+B)', () => fmt('bold')), bt('<i>I</i>', 'Itálico (Ctrl+I)', () => fmt('italic')), bt('<u>U</u>', 'Sublinhado (Ctrl+U)', () => fmt('underline')),
    el('span', {class: 'pv-sep'}),
    bt('+ Parágrafo', 'Novo parágrafo abaixo, com a mesma formatação (Enter)', () => { const bl = pvAtivo; if (!bl || !bl._d.podeNovo) return; porCursor(bl, contarBloco(bl)); teclaBloco({key: 'Enter', shiftKey: false, preventDefault(){}}, bl); }, 'so-par'),
    bt('Excluir parágrafo', 'Excluir o parágrafo onde está o cursor', () => { const bl = pvAtivo; if (!bl || !bl._d.podeExcluir) return; const lista = blocosEmOrdem(box), i = lista.indexOf(bl), ant = lista[i - 1]; bl._adapt.excluir(bl.dataset.ref); if (ant) pvFoco = {box, ref: ant.dataset.ref, off: contarBloco(ant)}; bl._adapt.estrutura?.(); bl._adapt.mudou(0); }, 'so-exc'),
    bt('↺ Voltar ao automático', 'Este trecho é montado pelo sistema (pelos campos e pelo manual). Desfaz o que foi digitado e volta ao texto automático.', () => { const bl = pvAtivo; if (!bl) return; pvFoco = {box, ref: bl.dataset.ref, off: 0}; bl._adapt.automatico?.(bl.dataset.ref); bl._adapt.mudou(0); }, 'so-auto'),
    el('span', {class: 'pv-info', text: 'Clique em qualquer texto da folha para editar'}));
  box.parentNode.insertBefore(f, box); box._ferr = f;
}
function atualizarFerramentas(){
  const bl = pvAtivo; if (!bl?._box?._ferr) return;
  const f = bl._box._ferr, d = bl._d;
  f.querySelector('.so-par').disabled = !d.podeNovo; f.querySelector('.so-exc').disabled = !d.podeExcluir;
  const auto = f.querySelector('.so-auto'); auto.hidden = !d.auto; auto.disabled = !d.temOv;
  f.querySelector('.pv-info').textContent = d.dica || (d.linhas ? 'Enter: nova linha na célula' : d.podeNovo ? 'Enter: novo parágrafo · Shift+Enter: quebra de linha' : 'Texto de uma linha');
}
/* mostra/esconde o formulário da esquerda (a folha editável fica sozinha por padrão) */
function mostrarCampos(box, sim){
  const grid = box.closest('.of-grid'); if (!grid) return;
  grid.classList.toggle('modo-doc', !sim);
  try { localStorage.setItem('gp-campos', sim ? '1' : '0'); } catch {}
  const b = grid.parentNode.querySelector('.bt-campos'); if (b) b.textContent = sim ? 'Esconder campos' : 'Mostrar campos';
}
/* põe o texto novo no campo correspondente do formulário da esquerda (sem refazer o formulário) */
document.querySelectorAll('.bt-campos').forEach(b => b.addEventListener('click', () => { const grid = b.closest('.aco-topo').parentNode.querySelector('.of-grid'); mostrarCampos(grid.querySelector('.of-previa'), grid.classList.contains('modo-doc')); }));
try { if (localStorage.getItem('gp-campos') === '1') document.querySelectorAll('.of-grid').forEach(g => mostrarCampos(g.querySelector('.of-previa'), true)); } catch {}
function sincronizarCampo(form, sel, valor){
  const inp = form?.querySelector(sel); if (!inp || inp === document.activeElement) return;
  inp.value = valor ?? ''; if (inp.tagName === 'TEXTAREA' && typeof autoAltura === 'function' && inp.classList.contains('dm-txt')) autoAltura(inp);
}
/* leva até o campo do formulário (para o que é montado de vários campos: epígrafe, data, assinatura…) */
function focarCampoForm(form, k){
  const alvo = form.querySelector(`[data-k="${k}"]`); if (!alvo) return;
  alvo.scrollIntoView({block: 'center', behavior: 'smooth'});
  const foco = alvo.matches('input,select,textarea') ? alvo : alvo.querySelector('input,select,textarea');
  setTimeout(() => { foco?.focus({preventScroll: true}); (alvo.closest('label') || alvo).classList.remove('campo-flash'); void alvo.offsetWidth; (alvo.closest('label') || alvo).classList.add('campo-flash'); }, 250);
}
/* renderiza as páginas do PDF em canvas (comum às prévias) */
async function canvasesDoPdf(bytes, larg){
  const pdfjs = await carregarPdfjs(), pdf = await pdfjs.getDocument({data: bytes.slice()}).promise, out = [];
  for (let n = 1; n <= pdf.numPages; n++){
    const pg = await pdf.getPage(n), vp0 = pg.getViewport({scale: 1}), dpr = Math.min(2, window.devicePixelRatio || 1), vp = pg.getViewport({scale: larg / vp0.width * dpr});
    const cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height; cv.style.width = larg + 'px'; cv.className = 'of-pag';
    await pg.render({canvasContext: cv.getContext('2d'), viewport: vp}).promise; out.push(cv);
  }
  pdf.cleanup?.();
  return out;
}
/* depois de criar/excluir parágrafos pela prévia, o formulário da esquerda é refeito sem perder a rolagem */
function refazerForm(fn){ const c = document.querySelector('.conteudo'), t = c?.scrollTop; fn(); if (c) c.scrollTop = t; }

/* ---------- PDF do ofício ---------- */
/* linhas que o sistema monta sozinho (pelos campos e pelo manual). Se a pessoa digitar na folha,
   o texto dela vale no lugar do automático (c.ov[chave]); a formatação continua a do manual. */
const AUTO_OF = {
  epigrafe: c => epigrafeOf(c),
  sgd: c => (c.sgd || '').trim() ? `SGD: ${c.sgd.trim()}` : '',
  localData: c => localDataOf(c),
  enderecamento: c => enderecamentoOf(c),
  destNome: c => [c.destMilitar ? (c.destPosto || '').trim() : '', (c.destNome || '').trim()].filter(Boolean).join(' '),
  destFuncao: c => (c.destResp ? 'Resp. p/ ' : '') + (c.destFuncao || '').trim(),
  destCidade: c => `${(c.destCidade || '').trim()}${c.sep === '/' ? '/' : ' – '}${(c.destUF || '').trim()}`,
  vocativo: c => vocativoOf(c),
  fecho: c => `${c.fecho || 'Respeitosamente'},`,
  assDigital: c => c.assDigital !== false ? 'Assinatura digital' + (c.ni ? ', NI' : '') : '',
  sigNome: c => (c.sigNome || '').trim().split(/\s+/).filter(Boolean).map((w, k) => (c.sigGuerra || []).includes(k) ? `**${w}**` : w).join(' ') + ' – **' + (c.sigPosto || '').trim().toUpperCase() + '**',
  sigFuncao: c => (c.sigResp ? 'Resp. p/ ' : '') + (c.sigFuncao || '').trim()
};
const temOv = (c, k) => c.ov && typeof c.ov[k] === 'string';
const linhaOf = (c, k) => temOv(c, k) ? c.ov[k] : AUTO_OF[k](c);
async function gerarBytesOficio(o, {forcarFonte, semTexto} = {}){
  const {PDFDocument, StandardFonts, rgb} = await carregarPdfLib();
  const c = o.campos, M = db.manualRedacao;
  const R = k => regraOf(k);
  const tentar = async corpo => {
    const doc = await PDFDocument.create();
    doc.setTitle(nomeArquivoOf(c).replace(/\.pdf$/, '')); doc.setAuthor(c.cab2 || c.cab1 || 'PMTO'); doc.setCreator('Sistema de Gestão de Ensino');
    const FN = {
      r: await doc.embedFont(StandardFonts.Helvetica), b: await doc.embedFont(StandardFonts.HelveticaBold),
      i: await doc.embedFont(StandardFonts.HelveticaOblique), bi: await doc.embedFont(StandardFonts.HelveticaBoldOblique)
    };
    const fonte = sg => FN[(sg.b ? 'b' : '') + (sg.i ? 'i' : '') || 'r'];
    const ok = (t, f) => [...String(t ?? '')].map(ch => { try { f.widthOfTextAtSize(ch, 10); return ch; } catch { return ch === '\t' ? ' ' : '?'; } }).join('');
    const larg = (t, f, s) => [...ok(t, f)].reduce((a, ch) => a + f.widthOfTextAtSize(ch, s), 0);
    const W = 595.28, H = 841.89;
    const mL = R('mEsq') * CM, mR = R('mDirSup') * CM, mT = R('mDirSup') * CM, mB = R('mInf') * CM;
    const area = W - mL - mR, limite = H - mB;
    const LH = s => s * 1.149, LT = s => LH(s) * R('entrelinhas'), DEP = R('depois');
    const recuo = R('recuo') * CM;
    const caixas = []; // {h, draw(page, top), grupo}
    const desenhar = (pg, segs, x, base, s) => { for (const sg of segs){ const f = fonte(sg), t = ok(sg.t, f); pg.drawText(t, {x, y: base, size: s, font: f, color: rgb(0, 0, 0)}); x += larg(t, f, s); } return x; };
    const largSegs = (segs, s) => segs.reduce((a, sg) => a + larg(sg.t, fonte(sg), s), 0);
    // quebra em palavras preservando estilos
    const palavras = segs => { const ws = []; let w = []; segs.forEach(sg => sg.t.split(/(\s+)/).forEach(p => { if (!p) return; if (/^\s+$/.test(p)){ if (w.length){ ws.push(w); w = []; } } else w.push({...sg, t: p}); })); if (w.length) ws.push(w); return ws; };
    const espaco = s => larg(' ', FN.r, s);
    // parágrafo: alinhamento j/l/r/c, recuo da 1ª linha, recuo pendente (anexos)
    const paragrafo = (segs, {s = corpo, lh = LT(corpo), alinh = 'j', ind = 0, pend = 0, depois = DEP, grupo, ref} = {}) => {
      const ws = palavras(segs), linhas = []; let atual = [], w = 0, max = area - ind;
      ws.forEach(pw => {
        const lw = largSegs(pw, s), add = (atual.length ? espaco(s) : 0) + lw;
        if (atual.length && w + add > max + 0.01){ linhas.push(atual); atual = [pw]; w = lw; max = area - pend; }
        else { atual.push(pw); w += add; }
      });
      if (atual.length || !linhas.length) linhas.push(atual);
      linhas.forEach((ln, n) => {
        const ultima = n === linhas.length - 1, x0 = mL + (n === 0 ? ind : pend), maxL = area - (n === 0 ? ind : pend);
        caixas.push({h: lh, grupo, ref, meta: {s, lh, jc: alinh, il: pend, fl: ind - pend}, fimPar: ultima, draw: (pg, top) => {
          const base = H - (top + lh - LH(s) + s * 0.905);
          const natural = ln.reduce((a, pw) => a + largSegs(pw, s), 0) + espaco(s) * Math.max(0, ln.length - 1);
          let x = x0, gap = espaco(s);
          if (alinh === 'c') x = mL + (area - natural) / 2;
          else if (alinh === 'r') x = mL + area - natural;
          else if (alinh === 'j' && !ultima && ln.length > 1) gap = espaco(s) + (maxL - natural) / (ln.length - 1);
          ln.forEach((pw, k) => { x = desenhar(pg, pw, x, base, s); if (k < ln.length - 1) x += gap; });
        }});
      });
      if (depois) caixas.push({h: depois, grupo, gap: true, draw: () => {}});
    };
    const linha = (segs, alinh = 'l', s = corpo, grupo, ref) => paragrafo(segs, {s, lh: LH(s), alinh, depois: 0, grupo, ref});
    const brancoSimples = n => { for (let k = 0; k < n; k++) caixas.push({h: LH(corpo), branco: true, draw: () => {}}); };
    const brancoTexto = (n, grupo) => { for (let k = 0; k < n; k++){ caixas.push({h: LT(corpo), branco: true, grupo, draw: () => {}}); caixas.push({h: DEP, gap: true, grupo, draw: () => {}}); } };

    // ----- cabeçalho (só na 1ª página)
    let img = null, imgW = 0;
    const hImg = R('brasaoAltura') * CM;
    if (M?.brasao){
      const bytes = Uint8Array.from(atob(M.brasao.split(',')[1]), ch => ch.charCodeAt(0));
      img = /image\/png/.test(M.brasao) ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      imgW = img.width * hImg / img.height;
      // a imagem fica na linha do parágrafo: sobra o descendente da fonte embaixo, como no Word
      caixas.push({h: hImg + R('cabecalho') * 0.212, cabecalho: true, draw: (pg, top) => pg.drawImage(img, {x: (W - imgW) / 2, y: H - top - hImg, width: imgW, height: hImg})});
    }
    const sCab = R('cabecalho');
    [['cab1', c.cab1], ['cab2', c.cab2]].filter(([, x]) => (x || '').trim()).forEach(([k, t]) => linha([{t: t.trim().toUpperCase()}], 'c', sCab, undefined, k));
    // ----- epígrafe, SGD, local e data
    brancoSimples(R('antesEpigrafe'));
    linha(trechosOf(linhaOf(c, 'epigrafe')), 'l', corpo, undefined, 'ov:epigrafe');
    if (linhaOf(c, 'sgd').trim()) linha(trechosOf(linhaOf(c, 'sgd')), 'l', corpo, undefined, 'ov:sgd');
    linha(trechosOf(linhaOf(c, 'localData')), 'r', corpo, undefined, 'ov:localData');
    // ----- endereçamento
    brancoSimples(R('antesEnderecamento'));
    if (c.tipoDoc === 'Ofício Circular'){
      paragrafo(trechosOf(c.circularDest || ''), {lh: LH(corpo), alinh: 'l', depois: 0, ref: 'circularDest'});
    } else {
      linha(trechosOf(linhaOf(c, 'enderecamento')), 'l', corpo, undefined, 'ov:enderecamento');
      linha(trechosOf(linhaOf(c, 'destNome'), {b: true}), 'l', corpo, undefined, 'ov:destNome');
      linha(trechosOf(linhaOf(c, 'destFuncao')), 'l', corpo, undefined, 'ov:destFuncao');
      if ((c.destLocal || '').trim()) linha(trechosOf(c.destLocal.trim()), 'l', corpo, undefined, 'destLocal');
      linha(trechosOf(linhaOf(c, 'destCidade')), 'l', corpo, undefined, 'ov:destCidade');
    }
    // ----- assunto e anexos
    brancoSimples(R('antesAssunto'));
    // (as referências usam a posição da linha no campo, para a edição na prévia achar a linha certa)
    const anexosR = (c.anexos || '').split('\n').map((t, i) => ({t: t.trim(), i})).filter(x => x.t), anexos = anexosR.map(x => x.t);
    paragrafo([{t: 'Assunto: '}, ...trechosOf(c.assunto || '', {b: true})], {alinh: 'l', depois: anexos.length ? 0 : DEP, ref: 'assunto'});
    if (anexos.length){
      const rot = anexos.length > 1 ? 'Anexos: ' : 'Anexo: ', pend = larg(rot, FN.r, corpo);
      anexosR.forEach(({t: a, i}, k) => paragrafo([...(k ? [] : [{t: rot}]), ...trechosOf(a, {b: true})], {alinh: 'l', ind: k ? pend : 0, pend, depois: k === anexos.length - 1 ? DEP : 0, ref: 'anexo:' + i}));
    }
    // ----- vocativo e texto
    const voc = linhaOf(c, 'vocativo');
    if (voc || temOv(c, 'vocativo')){ brancoTexto(R('antesVocativo')); paragrafo(trechosOf(voc), {ind: recuo, alinh: 'j', ref: 'ov:vocativo'}); }
    brancoTexto(R('antesTexto'));
    const parsR = (c.texto || '').split('\n').map((t, i) => ({t: t.trim(), i})).filter(x => x.t), pars = parsR.map(x => x.t);
    const iniCauda = () => caixas.length;
    let cauda = -1;
    parsR.forEach(({t: p, i}, k) => {
      if (k === pars.length - 1) cauda = iniCauda();
      paragrafo(trechosOf(p), {ind: recuo, alinh: 'j', grupo: k === pars.length - 1 ? 'ultimo' : undefined, ref: 'texto:' + i});
    });
    // texto ainda vazio: uma linha clicável na prévia (nada é impresso nela) para começar a escrever ali
    if (!pars.length){ cauda = iniCauda(); caixas.push({h: LT(corpo), grupo: 'ultimo', ref: 'texto:' + ((c.texto || '').split('\n').length - 1), meta: {s: corpo, lh: LT(corpo), jc: 'j', il: 0, fl: recuo}, draw: () => {}}); }
    if (cauda < 0) cauda = iniCauda();
    // ----- fecho e assinatura (ficam juntos com o fim do texto)
    brancoTexto(R('antesFecho'), 'cauda');
    paragrafo(trechosOf(linhaOf(c, 'fecho')), {ind: recuo, alinh: 'l', depois: DEP, grupo: 'cauda', ref: 'ov:fecho'});
    brancoTexto(Math.max(1, Math.min(2, R('antesAssinatura'))), 'cauda');
    if (linhaOf(c, 'assDigital').trim()) linha(trechosOf(linhaOf(c, 'assDigital')), 'c', corpo, 'cauda', 'ov:assDigital');
    linha(trechosOf(linhaOf(c, 'sigNome')), 'c', corpo, 'cauda', 'ov:sigNome');
    linha(trechosOf(linhaOf(c, 'sigFuncao')), 'c', corpo, 'cauda', 'ov:sigFuncao');

    // ----- paginação: o fim do texto (2 últimas linhas) vai junto com fecho e assinatura
    const caudaIdx = (() => { // início do grupo: 2 últimas linhas do último parágrafo
      const linhasUlt = caixas.map((x, i) => ({x, i})).filter(({x, i}) => i >= cauda && x.grupo === 'ultimo' && !x.gap);
      return linhasUlt.length >= 2 ? linhasUlt[linhasUlt.length - 2].i : (linhasUlt[0]?.i ?? caixas.findIndex(x => x.grupo === 'cauda'));
    })();
    const alturaCauda = caixas.slice(caudaIdx).reduce((a, x) => a + x.h, 0);
    const paginas = [[]]; let y = mT, quebrouCauda = false;
    caixas.forEach((x, i) => {
      if (i === caudaIdx && y + alturaCauda > limite + 0.5 && alturaCauda < limite - mT){ paginas.push([]); y = mT; quebrouCauda = true; }
      if (y + x.h > limite + 0.5 && !(x.gap || x.branco)){ paginas.push([]); y = mT; }
      if (y === mT && paginas[paginas.length - 1].length === 0 && (x.gap || x.branco) && paginas.length > 1) return; // nada de espaço em branco no topo da página
      paginas[paginas.length - 1].push({x, top: y}); y += x.h;
    });
    const sRod = R('rodape'), rodK = [['rodape1', c.rodape1], ['rodape2', c.rodape2]].map(([k, t]) => [k, (t || '').trim()]).filter(([, t]) => t);
    const regioes = [];
    paginas.forEach((itens, pi) => {
      const pg = doc.addPage([W, H]);
      itens.forEach(({x, top}) => { const ed = x.ref && !x.ref.startsWith('f:'); if (!(semTexto && ed)) x.draw(pg, top); if (x.ref && !x.gap && !x.branco) regioes.push({p: pi, x: mL, y: top, w: area, h: x.h, ref: x.ref, ...(x.meta || {})}); });
      let top = H - R('rodapeArea') * CM;
      rodK.forEach(([k, t]) => { const f = FN.r, tt = ok(t, f); if (!semTexto) pg.drawText(tt, {x: (W - larg(tt, f, sRod)) / 2, y: H - (top + sRod * 0.905), size: sRod, font: f, color: rgb(0, 0, 0)}); regioes.push({p: pi, x: 0, y: top, w: W, h: LH(sRod), ref: k, s: sRod, lh: LH(sRod), jc: 'c', il: 0, fl: 0}); top += LH(sRod); });
    });
    // a assinatura ficou sozinha numa página?
    const ultima = paginas[paginas.length - 1];
    const soCauda = paginas.length > 1 && ultima.every(({x}) => x.grupo === 'cauda' || x.gap || x.branco);
    return {doc, paginas: paginas.length, corpo, quebrouCauda, soCauda, regioes: juntarRegioes(regioes)};
  };
  const normal = R('corpo'), menor = R('corpoMin');
  let r = await tentar(forcarFonte || normal);
  if (!forcarFonte && r.paginas > 1 && (r.soCauda || r.quebrouCauda) && o.campos.ajusteFonte !== false){
    const r2 = await tentar(menor);
    if (r2.paginas < r.paginas) r = r2;
  }
  const bytes = await r.doc.save();
  return {bytes, paginas: r.paginas, corpo: r.corpo, reduziu: r.corpo !== normal, soCauda: r.soCauda, regioes: r.regioes};
}

/* edição direto na prévia do ofício */
const LINHAS_OF = {texto: 'texto', anexo: 'anexos'};
const ADAPT_OF = {
  ler(ref){
    const c = ofAtual()?.campos; if (!c || ref.startsWith('f:')) return null;
    const [k, i] = ref.split(':');
    if (k === 'ov'){
      const negr = i === 'destNome';
      return {txt: linhaOf(c, i), base: negr ? {b: true} : null, auto: true, temOv: temOv(c, i), podeNovo: false, quebra: false,
        dica: 'Linha automática: o que você digitar passa a valer'};
    }
    if (k === 'texto') return {txt: ((c.texto || '').split('\n')[+i] || '').trim(), podeNovo: true, podeExcluir: true, podeJuntar: true};
    if (k === 'anexo'){
      const nao = (c.anexos || '').split('\n').map((t, n) => ({t: t.trim(), n})).filter(x => x.t), pri = nao[0]?.n === +i;
      return {txt: ((c.anexos || '').split('\n')[+i] || '').trim(), base: {b: true}, pre: pri ? (nao.length > 1 ? 'Anexos: ' : 'Anexo: ') : '', podeNovo: true, podeExcluir: true, podeJuntar: false};
    }
    if (k === 'assunto') return {txt: c.assunto || '', base: {b: true}, pre: 'Assunto: '};
    return {txt: c[k] || '', caixa: k === 'cab1' || k === 'cab2', quebra: k === 'circularDest'};
  },
  gravar(ref, txt){
    const o = ofAtual(), c = o.campos, [k, i] = ref.split(':');
    if (k === 'ov'){
      c.ov ||= {}; c.ov[i] = txt;
      // número e ano digitados na epígrafe também valem para o nome do arquivo e a numeração
      if (i === 'epigrafe'){ const m = /n[º°o]\s*(\d+)\s*\/\s*(\d{4})/i.exec(semMarca(txt)); if (m){ c.numero = m[1]; c.ano = m[2]; ['numero', 'ano'].forEach(x => sincronizarCampo($('#of-form'), `[data-k="${x}"]`, c[x])); } }
      return;
    }
    if (LINHAS_OF[k]){ const ls = (c[LINHAS_OF[k]] || '').split('\n'); ls[+i] = txt.replace(/\n/g, ' '); c[LINHAS_OF[k]] = ls.join('\n'); sincronizarCampo($('#of-form'), `[data-k="${LINHAS_OF[k]}"]`, c[LINHAS_OF[k]]); return; }
    c[k] = (k === 'cab1' || k === 'cab2') ? txt.toUpperCase() : txt;
    sincronizarCampo($('#of-form'), `[data-k="${k}"]`, c[k]);
  },
  automatico(ref){ const c = ofAtual()?.campos, k = ref.split(':')[1]; if (c?.ov) delete c.ov[k]; },
  mudou(ms = 500){ const o = ofAtual(); if (!o) return; o.alteradoEm = new Date().toISOString(); agendarSalvar(); agendarPrevia(ms); },
  novo(ref, txt = ''){ const [k, i] = ref.split(':'); if (!LINHAS_OF[k]) return null; const c = ofAtual().campos, f = LINHAS_OF[k], ls = (c[f] || '').split('\n'); ls.splice(+i + 1, 0, txt.replace(/\n/g, ' ') || ''); c[f] = ls.join('\n'); return k + ':' + (+i + 1); },
  juntar(ref){ const [k, i] = ref.split(':'); if (k !== 'texto') return null; const c = ofAtual().campos, ls = (c.texto || '').split('\n'); let p = +i - 1; while (p >= 0 && !ls[p].trim()) p--; if (p < 0) return null;
    const off = semMarca(ls[p].trim()).length; ls[p] = ls[p].trim() + ls[+i].trim(); ls.splice(p + 1, +i - p); c.texto = ls.join('\n'); return {ref: 'texto:' + p, off}; },
  excluir(ref){ const [k, i] = ref.split(':'); if (!LINHAS_OF[k]) return; const c = ofAtual().campos, f = LINHAS_OF[k], ls = (c[f] || '').split('\n'); ls.splice(+i, 1); c[f] = ls.join('\n'); },
  estrutura(){ const c = ofAtual().campos; ['texto', 'anexos'].forEach(f => sincronizarCampo($('#of-form'), `[data-k="${f}"]`, c[f])); },
  focar(ref){ focarCampoForm($('#of-form'), ref.slice(2)); }
};

/* ---------- conferência com o manual ---------- */
function conferirOficio(o){
  const c = o.campos, M = db.manualRedacao, itens = [];
  const add = (ok, t, d) => itens.push({ok, t, d});
  const R = M.regras;
  add(true, 'Formatação geral do manual aplicada', `${R.fonte.valor} ${R.corpo.valor}, ${R.alinhamento.valor}, entrelinhas ${String(R.entrelinhas.valor).replace('.', ',')}, ${R.depois.valor} pt após o parágrafo, recuo de ${String(R.recuo.valor).replace('.', ',')} cm · margens ${R.mEsq.valor} / ${R.mDirSup.valor} / ${R.mDirSup.valor} / ${R.mInf.valor} cm · ${R.papel.valor}`);
  add(!!M.brasao, 'Cabeçalho com brasão', M.brasao ? `altura de ${String(R.brasaoAltura.valor).replace('.', ',')} cm, com até 2 linhas da unidade em caixa alta` : 'o manual importado não tem o brasão');
  const set = (c.setores || []).map(siglaSemBarra).filter(Boolean);
  if (temOv(c, 'epigrafe')){ const t = semMarca(c.ov.epigrafe).trim(); add(/^Of[íi]cio( Circular)?\s+n[º°]\s*\d+\/\d{4}\s+–\s+\S/.test(t), 'Epígrafe (digitada na folha)', /^Of[íi]cio/.test(t) ? t + (/\s–\s/.test(t) ? '' : ' · use travessão (–) antes das seções') : 'o manual pede “Ofício nº 000/AAAA – SEÇÃO/UNIDADE”'); }
  else add(set.length > 0 && set.length <= 4 && /^\d{4}$/.test(c.ano || ''), 'Epígrafe', set.length ? (set.length > 4 ? 'use no máximo 4 níveis de seções' : epigrafeOf(c)) : 'informe a seção que expede (ex.: P3 e 8º BPM)');
  if ((c.setores || []).some(s => /\//.test(s || ''))) add(true, 'Barra retirada da sigla da seção', 'ex.: P/3 → P3, como manda o manual');
  if (temOv(c, 'localData')){ const t = semMarca(c.ov.localData).trim(); add(/,\s*(1º|\d{1,2})\s+de\s+\p{L}+\s+de\s+\d{4}\.$/u.test(t), 'Local e data (digitados na folha)', /\.$/.test(t) ? t : t + ' · o manual pede “Cidade – UF, dia de mês de ano.” com ponto final'); }
  else add(!!(c.data && c.cidade && c.uf), 'Local e data', c.data ? localDataOf(c) : 'informe a data');
  if (c.tipoDoc === 'Ofício Circular') add(/^(Aos|Às)\s/.test((c.circularDest || '').trim()), 'Destinatários do ofício circular', (c.circularDest || '').trim() ? 'deve começar com “Aos” ou “Às” seguido das funções' : 'informe os destinatários');
  else {
    const falta = [['destNome', 'nome'], ['destFuncao', 'função ou cargo'], ['destCidade', 'cidade']].filter(([k]) => temOv(c, k) ? !semMarca(c.ov[k]).replace(/[–/\s]|TO$/g, '').trim() : !(c[k] || '').trim()).map(x => x[1]);
    if (temOv(c, 'enderecamento')) add(!falta.length && !!semMarca(c.ov.enderecamento).trim(), 'Endereçamento', falta.length ? 'falta: ' + falta.join(', ') : `${semMarca(c.ov.enderecamento).trim()} (digitado na folha)`);
    else add(!falta.length && !!linhaTratamento(c), 'Endereçamento', falta.length ? 'falta: ' + falta.join(', ') : !linhaTratamento(c) ? 'escolha o tratamento do destinatário' : `${enderecamentoOf(c)} · ${linhaTratamento(c).tratamento || ''}`);
  }
  const as = (c.assunto || '').trim(), w1 = (as.split(/\s+/)[0] || '').toLowerCase();
  add(!!as && !/^\p{L}+(ar|er|ir)$/u.test(w1) && !/\.$/.test(as), 'Assunto', !as ? 'informe o assunto' : /^\p{L}+(ar|er|ir)$/u.test(w1) ? `o manual pede assunto sem verbo (ex.: “Solicitação de…” em vez de “${as.split(/\s+/)[0]}…”)` : /\.$/.test(as) ? 'sem ponto final' : 'em negrito, sem verbo');
  const voc = semMarca(linhaOf(c, 'vocativo')).trim();
  if (!c.semVocativo || temOv(c, 'vocativo')) add(/,$/.test(voc) && voc.length > 3, 'Vocativo', voc ? voc + (/,$/.test(voc) ? '' : ' · o vocativo termina com vírgula') : 'informe o vocativo');
  const tx = c.texto || '';
  const achou = (M.cliches || []).filter(k => norm(tx).includes(norm(k)));
  add(!!tx.trim() && !achou.length, 'Texto', !tx.trim() ? 'escreva o texto do ofício' : achou.length ? 'o manual manda evitar: ' + achou.map(k => `“${k}”`).join(', ') : 'justificado, recuo na 1ª linha, sem frases feitas');
  if (temOv(c, 'fecho')){ const t = semMarca(c.ov.fecho).trim(); add(/^(Respeitosamente|Atenciosamente),$/.test(t), 'Fecho (digitado na folha)', /^(Respeitosamente|Atenciosamente),$/.test(t) ? t : 'o manual só admite “Respeitosamente,” (superior) ou “Atenciosamente,” (mesma hierarquia ou subordinado)'); }
  else add(true, 'Fecho', `${c.fecho || 'Respeitosamente'}, — ${c.fecho === 'Atenciosamente' ? 'para mesma hierarquia ou subordinado' : 'para hierarquia superior'}`);
  const faltaSig = [['sigNome', 'nome'], ['sigPosto', 'posto e quadro'], ['sigFuncao', 'função']].filter(([k]) => !(c[k] || '').trim()).map(x => x[1]);
  if (temOv(c, 'sigNome')){ const t = c.ov.sigNome; add(/\*\*/.test(t) && /\s–\s/.test(semMarca(t)), 'Assinatura (digitada na folha)', /\*\*/.test(t) ? semMarca(t) : 'deixe o nome de guerra e o POSTO QUADRO em negrito (botão B)'); }
  else add(!faltaSig.length && (c.sigGuerra || []).length > 0, 'Assinatura', faltaSig.length ? 'falta: ' + faltaSig.join(', ') : !(c.sigGuerra || []).length ? 'marque o nome de guerra (sai em negrito)' : 'nome de guerra e POSTO QUADRO em negrito, centralizada');
  add(!!(c.rodape1 || c.rodape2), 'Rodapé', (c.rodape1 || c.rodape2) ? `Arial ${R.rodape.valor}, centralizado, nos ${R.rodapeArea.valor} cm finais da folha` : 'informe endereço e contato da unidade');
  if (ofUltimoLayout){
    if (ofUltimoLayout.reduziu) add(true, `Fonte ajustada para Arial ${ofUltimoLayout.corpo}`, 'exceção prevista no manual para a assinatura não ficar sozinha na página');
    add(!ofUltimoLayout.soCauda, 'Assinatura junto com o texto', ofUltimoLayout.soCauda ? 'a assinatura ficou sozinha na última página: encurte o texto' : `${ofUltimoLayout.paginas} página(s); o fim do texto, o fecho e a assinatura ficam na mesma página`);
  }
  return itens;
}

/* ---------- importar o manual ---------- */
async function importarManualRedacao(file){
  if (!file) return;
  if (!ehAdmin()){ alert('Só o administrador pode trocar o manual de redação.'); return; }
  if (!/\.docx$/i.test(file.name)){ alert('Envie o manual em Word (.docx).'); return; }
  if (db.manualRedacao && !confirm(`Substituir o manual atual (“${db.manualRedacao.nome}”) por “${file.name}”?\n\nOs ofícios já feitos passam a seguir o manual novo.`)) return;
  const pr = $('#of-man-prog'), bar = pr.querySelector('i'), tx = pr.querySelector('span');
  pr.hidden = false;
  try {
    const m = await lerManualRedacao(file, (p, t) => { bar.style.width = p + '%'; tx.textContent = t; });
    if (!m.modelos.length) throw new Error('Não encontrei nenhum “MODELO DE OFÍCIO” neste documento.');
    db.manualRedacao = {...m, importadoEm: new Date().toISOString(), por: quemSou()};
    registrar('arquivo', `importou o manual de redação “${file.name}” (${Object.values(m.regras).filter(r => r.lido).length} regras, ${m.modelos.length} modelos de ofício)`);
    agendarSalvar(); status('Manual importado: regras e modelos prontos', 'ok');
  } catch (e){ console.error(e); alert('Não consegui ler o manual: ' + e.message); }
  pr.hidden = true; renderOficios(); if (viewAtual === 'os') renderOS();
}

/* ---------- telas ---------- */
function renderOficios(){
  db.oficios ||= [];
  $('#tag-of').textContent = db.oficios.filter(meuOficio).length;
  const o = ofAtual();
  $('#of-inicio').hidden = !!o; $('#of-editor').hidden = !o;
  if (o) renderEditorOficio(); else renderListaOficios();
}
function renderListaOficios(){
  const M = db.manualRedacao;
  // manual
  const box = $('#of-manual'); box.innerHTML = '';
  if (!M){
    box.append(el('div', {class: 'of-vazio'},
      el('div', {class: 'ic-arq doc', text: 'DOCX'}),
      el('div', {}, el('b', {text: 'Importe o Manual de Redação Oficial da PMTO'}), el('p', {class: 'dica', text: 'O sistema lê o manual (.docx) e passa a montar os ofícios seguindo as regras dele: fonte, margens, espaçamentos, cabeçalho com brasão, pronomes de tratamento e os modelos de ofício.'})),
      el('button', {class: 'btn pri', text: 'Importar manual (.docx)', onclick: () => $('#of-man-arq').click()})));
  } else {
    const lidas = Object.values(M.regras).filter(r => r.lido).length, total = Object.keys(M.regras).length;
    const det = el('details', {class: 'of-regras'}, el('summary', {text: `Ver as ${total} regras de formatação lidas do manual`}),
      el('table', {class: 'tab-datas'}, el('thead', {}, el('tr', {}, el('th', {text: 'Regra'}), el('th', {text: 'Valor aplicado'}), el('th', {text: 'Onde está no manual'}))),
        el('tbody', {}, ...Object.values(M.regras).map(r => el('tr', {}, el('td', {text: r.rotulo}), el('td', {}, el('b', {text: String(r.valor).replace('.', ',')})), el('td', {}, r.lido ? el('small', {text: '“' + r.trecho + '”'}) : el('small', {class: 'tg av', text: 'padrão (não achei no texto)'})))))));
    box.append(el('div', {class: 'of-man-ok'},
      M.brasao ? el('img', {src: M.brasao, alt: 'Brasão', class: 'of-brasao'}) : el('div', {class: 'ic-arq doc', text: 'DOCX'}),
      el('div', {class: 'nm'}, el('b', {text: M.titulo || M.nome}),
        el('small', {text: `${M.nome} · importado em ${new Date(M.importadoEm).toLocaleString('pt-BR')} por ${M.por || '—'}`}),
        el('div', {class: 'chips-of'}, el('span', {class: 'tg lib', text: `✓ ${lidas} de ${total} regras lidas`}), el('span', {class: 'tg ef', text: `${M.quadros.length} quadros de tratamento`}), el('span', {class: 'tg ef', text: `${M.modelos.length} modelos de ofício`}), M.cliches.length ? el('span', {class: 'tg ef', text: `${M.cliches.length} expressões a evitar`}) : '')),
      el('button', {class: 'btn peq', text: 'Trocar manual', onclick: () => $('#of-man-arq').click()})), det);
  }
  // modelos
  const mb = $('#of-modelos'); mb.innerHTML = '';
  $('#of-modelos-card').hidden = !M;
  if (M){
    M.modelos.forEach((m, i) => {
      const civ = /CIVIS/i.test(m.titulo), circ = m.tipo === 'circular';
      mb.append(el('button', {class: 'aco-op of-op' + (circ ? ' vol' : ''), onclick: () => novoOficio(i)},
        el('div', {class: 'ic', text: circ ? '✉✉' : civ ? '⚖' : '★'}),
        el('div', {}, el('b', {text: NOME_MODELO(m.titulo)}), el('span', {text: circ ? 'Mesmo texto para vários destinatários da Corporação (“Aos Comandantes…”).' : civ ? 'Para juízes, promotores, prefeitos e demais autoridades civis.' : 'Para comandantes, diretores, chefes e demais autoridades militares.'}))));
    });
    $('#of-outros').textContent = M.outros.length ? 'Também estão no manual (podem virar modelos depois): ' + M.outros.map(t => t.toLowerCase().replace(/^./, x => x.toUpperCase())).join(', ') + '.' : '';
  }
  // ofícios feitos
  const lb = $('#of-lista'); lb.innerHTML = '';
  const lista = (db.oficios || []).filter(meuOficio).sort((a, b) => (b.alteradoEm || '').localeCompare(a.alteradoEm || ''));
  if (!lista.length) lb.append(el('div', {class: 'vazio', text: M ? 'Nenhum ofício ainda. Escolha um modelo acima para começar.' : 'Importe o manual para começar.'}));
  lista.forEach(o => {
    const c = o.campos;
    lb.append(el('div', {class: 'linha'},
      el('div', {class: 'ic-arq', style: 'background:var(--navy2)', text: c.tipoDoc === 'Ofício Circular' ? 'OFC' : 'OF'}),
      el('div', {class: 'nm'}, el('b', {text: epigrafeOf(c) + (c.assunto ? ' · ' + c.assunto : '')}),
        el('small', {text: [c.tipoDoc === 'Ofício Circular' ? c.circularDest : [c.destPosto, c.destNome].filter(Boolean).join(' '), c.data ? dataBR(c.data) : '', ehAdmin() && o.autor ? 'por ' + o.autor : '', o.ultimoPdf ? 'PDF gerado em ' + new Date(o.ultimoPdf).toLocaleString('pt-BR') : 'rascunho'].filter(Boolean).join(' · ')})),
      el('button', {class: 'btn peq', text: 'Abrir', onclick: () => abrirOficio(o.id)})));
  });
}
function novoOficio(iModelo){
  const M = db.manualRedacao, m = M.modelos[iModelo]; if (!m) return;
  const ult = (db.oficios || []).filter(x => x.autorId === P.perfilId).sort((a, b) => (b.alteradoEm || '').localeCompare(a.alteradoEm || ''))[0]?.campos;
  const base = ult || OF_PADRAO;
  const circ = m.tipo === 'circular', civ = /CIVIS/i.test(m.titulo);
  // tratamento padrão: militar → correspondência interna; civil → “demais autoridades” estaduais
  const achaTrat = (reQ, reL) => { for (const [q, Q] of M.quadros.entries()) if (reQ.test(Q.titulo)) for (const [i, L] of Q.linhas.entries()) if (reL.test(L.autoridade)) return `${q}|${i}`; return ''; };
  const trat = civ ? achaTrat(/ESTADUAL/i, /Juiz/i) : achaTrat(/INTERNAS/i, /demais fun/i);
  const c = {
    modelo: m.titulo, tipoDoc: circ ? 'Ofício Circular' : 'Ofício', ano: hojeISO().slice(0, 4), data: hojeISO(),
    cab1: base.cab1, cab2: base.cab2, setores: [...(base.setores || ['', '']), '', '', ''].slice(0, 4), sgd: '',
    cidade: base.cidade, sep: base.sep, uf: base.uf,
    trat, genero: 'M', destMilitar: !civ && !circ, destPosto: '', destNome: '', destResp: false, destFuncao: '', destLocal: '', destCidade: '', destUF: 'TO',
    circularDest: '', assunto: '', anexos: '', vocAuto: true, vocativo: '', semVocativo: circ, texto: '',
    fecho: circ ? 'Atenciosamente' : 'Respeitosamente', assDigital: true, ni: false,
    sigNome: base.sigNome, sigGuerra: [...(base.sigGuerra || [])], sigPosto: base.sigPosto, sigResp: false, sigFuncao: base.sigFuncao,
    rodape1: base.rodape1, rodape2: base.rodape2, siglaDestino: '', ajusteFonte: true
  };
  c.numero = proximoNumeroOf(c);
  const o = {id: uid(), autorId: P.perfilId, autor: perfilAtual().nome || '', criadoEm: new Date().toISOString(), alteradoEm: new Date().toISOString(), campos: c, modeloIdx: iModelo};
  db.oficios.push(o); registrar('oficio', `começou o ${epigrafeOf(c)} (${NOME_MODELO(m.titulo)})`); agendarSalvar();
  abrirOficio(o.id);
}
function abrirOficio(id){ ofAtualId = id; ofUltimoLayout = null; renderOficios(); $('.conteudo').scrollTop = 0; }
function exemploNoOficio(){
  const o = ofAtual(), M = db.manualRedacao, m = M.modelos[o.modeloIdx] || M.modelos.find(x => x.titulo === o.campos.modelo); if (!m) return;
  if (!confirm('Preencher com o exemplo do manual? Os campos de destinatário, assunto e texto serão substituídos pelo exemplo.')) return;
  const ex = m.exemplo, c = o.campos; c.ov = {};
  ['destPosto', 'destNome', 'destResp', 'destFuncao', 'destLocal', 'destCidade', 'destUF', 'destMilitar', 'circularDest', 'assunto', 'anexos', 'texto', 'fecho'].forEach(k => { if (ex[k] !== undefined) c[k] = ex[k]; });
  if (ex.vocativo){ c.vocativo = ex.vocativo; c.vocAuto = false; c.semVocativo = false; } else if (ex.semVocativo) c.semVocativo = true;
  if (ex.destEnd && /Senhora/.test(ex.destEnd)) c.genero = 'F';
  o.alteradoEm = new Date().toISOString(); agendarSalvar(); renderEditorOficio();
}

const CAMPOS_OF = [
  ['Cabeçalho', [['cab1', 'Linha 1 (unidade de direção)', {cls: 'l3', caixa: true}], ['cab2', 'Linha 2 (subunidade)', {cls: 'l3', caixa: true}]]],
  ['Identificação, local e data', [['numero', 'Número', {ph: '001'}], ['ano', 'Ano', {ph: '2026'}], ['sgd', 'SGD (opcional)', {ph: '2026/09039/000000'}],
    ['setores', 'Seções que expedem (da menor para a maior, até 4)', {cls: 'l3', tipo: 'setores'}],
    ['cidade', 'Cidade'], ['uf', 'UF', {ph: 'TO'}], ['sep', 'Separador cidade/UF', {tipo: 'sel', op: [['/', 'Barra: Paraíso do Tocantins/TO'], ['–', 'Travessão: Palmas – TO']]}], ['data', 'Data', {tipo: 'date'}]]],
  ['Destinatário', [], 'dest'],
  ['Assunto e anexos', [['assunto', 'Assunto (sem verbo, sai em negrito)', {cls: 'l3', ph: 'Ex.: Solicitação de alteração de férias'}], ['anexos', 'Anexos (um por linha, opcional)', {cls: 'l3', tipo: 'area', linhas: 2}]]],
  ['Vocativo', [], 'voc'],
  ['Texto do ofício', [['texto', 'Um parágrafo por linha · **negrito** · *itálico*', {cls: 'l3', tipo: 'area', linhas: 9}]]],
  ['Fecho e assinatura', [], 'sig'],
  ['Rodapé', [['rodape1', 'Linha 1 (endereço)', {cls: 'l3'}], ['rodape2', 'Linha 2 (telefone e e-mail)', {cls: 'l3'}], ['siglaDestino', 'Sigla do destino (para o nome do arquivo)', {ph: 'Ex.: CRP-1'}],
    ['ajusteFonte', 'Se a assinatura ficar sozinha na página, usar Arial 11 (exceção do manual)', {tipo: 'chk', cls: 'l2'}]]]
];
function campoOf(o, k, rot, op = {}){
  const c = o.campos;
  const mudou = v => { c[k] = v; if (k === 'numero' || k === 'ano') {} o.alteradoEm = new Date().toISOString(); agendarSalvar(); agendarPrevia(); if (op.depois) op.depois(); };
  let inp;
  if (op.tipo === 'area') inp = el('textarea', {rows: op.linhas || 3, value: c[k] || '', placeholder: op.ph || '', oninput: e => mudou(e.target.value)});
  else if (op.tipo === 'sel') { inp = el('select', {onchange: e => mudou(e.target.value)}, ...op.op.map(([v, t]) => el('option', {value: v, text: t}))); inp.value = c[k] ?? op.op[0][0]; }
  else if (op.tipo === 'chk') return el('label', {class: 'chk ' + (op.cls || ''), 'data-k': k}, el('input', {type: 'checkbox', checked: c[k] !== false && !!(c[k] ?? op.padrao ?? true), onchange: e => mudou(e.target.checked)}), el('span', {text: rot}));
  else if (op.tipo === 'setores'){
    const g = el('div', {class: 'of-setores'});
    for (let n = 0; n < 4; n++) g.append(el('input', {value: (c.setores || [])[n] || '', placeholder: ['Ex.: P/3', 'Ex.: 8º BPM', '3º nível', '4º nível'][n], oninput: e => { c.setores = [...(c.setores || ['', '', '', ''])]; c.setores[n] = e.target.value; mudou(c.setores); }}));
    return el('label', {class: op.cls || '', 'data-k': k}, rot, g, el('small', {class: 'dica', text: 'A barra dentro da sigla sai sozinha: P/3 → P3.'}));
  }
  else inp = el('input', {type: op.tipo || 'text', value: c[k] ?? '', placeholder: op.ph || '', oninput: e => mudou(op.caixa ? e.target.value.toUpperCase() : e.target.value)});
  if (op.caixa) inp.style.textTransform = 'uppercase';
  inp.dataset.k = k;
  return el('label', {class: op.cls || ''}, rot, inp);
}
function renderEditorOficio(){
  const o = ofAtual(); if (!o) return;
  const c = o.campos, M = db.manualRedacao;
  $('#of-titulo-ed').textContent = epigrafeOf(c);
  $('#of-modelo-ed').textContent = NOME_MODELO(c.modelo || 'Ofício');
  const f = $('#of-form'); f.innerHTML = '';
  if (!M){ f.append(el('div', {class: 'aviso', text: 'Importe o manual de redação para editar e gerar o ofício.'})); return; }
  const ex = (M.modelos[o.modeloIdx] || {}).exemplo || {};
  CAMPOS_OF.forEach(([tit, campos, esp]) => {
    const sec = el('div', {class: 'of-sec'}, el('h4', {text: tit}));
    const g = el('div', {class: 'aco-form'});
    campos.forEach(([k, rot, op = {}]) => g.append(campoOf(o, k, rot, {...op, ph: op.ph || (typeof ex[k] === 'string' ? 'Ex.: ' + ex[k].slice(0, 90) : '')})));
    if (esp === 'dest'){
      if (c.tipoDoc === 'Ofício Circular') g.append(campoOf(o, 'circularDest', 'Destinatários (só as funções, começando com “Aos” ou “Às”)', {cls: 'l3', ph: 'Ex.: Aos Comandantes do 1º BPM, 5º BPM, 6º BPM, 8º BPM e 6ª CIPM'}));
      else {
        const sel = el('select', {onchange: e => { c.trat = e.target.value; o.alteradoEm = new Date().toISOString(); agendarSalvar(); renderEditorOficio(); }});
        M.quadros.forEach((Q, q) => sel.append(el('optgroup', {label: Q.titulo}, ...Q.linhas.map((L, i) => el('option', {value: `${q}|${i}`, text: `${L.autoridade} — ${L.tratamento || L.enderecamento}`})))));
        sel.value = c.trat || '';
        g.append(el('label', {class: 'l3'}, 'Quem é o destinatário (quadros de tratamento do manual)', sel, el('small', {class: 'dica', text: `Endereçamento: “${enderecamentoOf(c)}” · Tratamento: ${linhaTratamento(c)?.tratamento || '—'}`})));
        g.append(campoOf(o, 'genero', 'Destinatário é', {tipo: 'sel', op: [['M', 'Senhor'], ['F', 'Senhora']], depois: () => renderEditorOficio()}));
        g.append(campoOf(o, 'destMilitar', 'Destinatário militar (posto antes do nome)', {tipo: 'chk', cls: 'l2', depois: () => renderEditorOficio()}));
        if (c.destMilitar) g.append(campoOf(o, 'destPosto', 'Posto/graduação e quadro', {ph: 'Ex.: CEL QOPM', caixa: true, depois: () => atualizarVocOf()}));
        g.append(campoOf(o, 'destNome', 'Nome completo (sai em negrito)', {cls: c.destMilitar ? 'l2' : 'l3', ph: 'Ex.: ' + (ex.destNome || 'Fulano de Tal')}));
        g.append(campoOf(o, 'destFuncao', 'Função ou cargo', {cls: 'l2', ph: 'Ex.: ' + (ex.destFuncao || 'Comandante do 8º BPM'), depois: () => atualizarVocOf()}));
        g.append(campoOf(o, 'destResp', 'Respondendo pela função (Resp. p/)', {tipo: 'chk'}));
        g.append(campoOf(o, 'destLocal', 'Endereço ou nome da UPM/órgão', {cls: 'l3', ph: 'Ex.: ' + (ex.destLocal || 'Quartel do Comando Geral')}));
        g.append(campoOf(o, 'destCidade', 'Cidade', {cls: 'l2', ph: 'Ex.: ' + (ex.destCidade || 'Palmas')}));
        g.append(campoOf(o, 'destUF', 'UF', {ph: 'TO'}));
      }
    }
    if (esp === 'voc'){
      g.append(campoOf(o, 'semVocativo', 'Sem vocativo (de superior para subordinado)', {tipo: 'chk', cls: 'l3', padrao: false, depois: () => renderEditorOficio()}));
      if (!c.semVocativo){
        g.append(campoOf(o, 'vocAuto', 'Montar pelo quadro de tratamento', {tipo: 'chk', depois: () => renderEditorOficio()}));
        const inp = el('input', {id: 'of-voc', value: c.vocAuto !== false ? vocativoAutoOf(c) : (c.vocativo || ''), disabled: c.vocAuto !== false, oninput: e => { c.vocativo = e.target.value; o.alteradoEm = new Date().toISOString(); agendarSalvar(); agendarPrevia(); }});
        g.append(el('label', {class: 'l2'}, 'Vocativo (termina com vírgula)', inp));
      }
    }
    if (esp === 'sig'){
      g.append(campoOf(o, 'fecho', 'Fecho', {tipo: 'sel', cls: 'l2', op: [['Respeitosamente', 'Respeitosamente, — destinatário de hierarquia superior'], ['Atenciosamente', 'Atenciosamente, — mesma hierarquia ou subordinado']]}));
      g.append(campoOf(o, 'assDigital', 'Assinatura digital', {tipo: 'chk'}));
      g.append(campoOf(o, 'sigNome', 'Nome completo de quem assina', {cls: 'l2', depois: () => chipsSig()}));
      g.append(campoOf(o, 'sigPosto', 'Posto e quadro', {ph: 'Ex.: TEN CEL QOPM', caixa: true}));
      g.append(el('div', {class: 'l3 of-guerra-box'}, el('small', {class: 'dica', text: 'Clique no nome de guerra (sai em negrito):'}), el('div', {class: 'guerra', id: 'of-sig-guerra'})));
      g.append(campoOf(o, 'sigFuncao', 'Função', {cls: 'l2', ph: 'Ex.: Comandante do 8º BPM'}));
      g.append(campoOf(o, 'sigResp', 'Respondendo (Resp. p/)', {tipo: 'chk'}));
      g.append(campoOf(o, 'ni', 'No impedimento do titular (NI) — só ofício interno', {tipo: 'chk', cls: 'l3', padrao: false}));
    }
    sec.append(g); f.append(sec);
  });
  chipsSig();
  agendarPrevia(0);
}
function atualizarVocOf(){ const o = ofAtual(), i = $('#of-voc'); if (o && i && o.campos.vocAuto !== false) i.value = vocativoAutoOf(o.campos); }
function chipsSig(){
  const o = ofAtual(), box = $('#of-sig-guerra'); if (!o || !box) return;
  const c = o.campos; box.innerHTML = '';
  (c.sigNome || '').trim().split(/\s+/).filter(Boolean).forEach((w, k) => box.append(el('span', {class: (c.sigGuerra || []).includes(k) ? 'on' : '', text: w, onclick: () => {
    const s = new Set(c.sigGuerra || []); s.has(k) ? s.delete(k) : s.add(k); c.sigGuerra = [...s].sort((a, b) => a - b);
    o.alteradoEm = new Date().toISOString(); agendarSalvar(); chipsSig(); agendarPrevia();
  }})));
}
function agendarPrevia(ms = 450){ clearTimeout(ofPreviaTimer); ofPreviaTimer = setTimeout(atualizarPrevia, ms); $('#of-titulo-ed') && ofAtual() && ($('#of-titulo-ed').textContent = epigrafeOf(ofAtual().campos)); }
async function atualizarPrevia(){
  const o = ofAtual(); if (!o || !db.manualRedacao) return;
  const seq = ++ofPreviaSeq, box = $('#of-previa');
  box.classList.add('carregando');
  try {
    const r = await gerarBytesOficio(o, {semTexto: true});
    if (seq !== ofPreviaSeq) return;
    ofUltimoLayout = r;
    const cvs = await canvasesDoPdf(r.bytes, Math.max(280, box.clientWidth - 4));
    if (seq !== ofPreviaSeq) return;
    previaEditavel(box, cvs, r.regioes, ADAPT_OF);
    $('#of-paginas').textContent = `${r.paginas} página(s) · Arial ${r.corpo}`;
  } catch (e){ console.error(e); box.innerHTML = ''; box.append(el('div', {class: 'aviso', text: 'Não consegui montar a prévia: ' + e.message})); }
  box.classList.remove('carregando');
  renderConferenciaOf();
}
function renderConferenciaOf(){
  const o = ofAtual(); if (!o) return;
  const itens = conferirOficio(o), box = $('#of-conf'); box.innerHTML = '';
  const pend = itens.filter(x => !x.ok).length;
  $('#of-conf-res').textContent = pend ? `${pend} ponto(s) para ajustar` : 'Tudo conforme o manual';
  $('#of-conf-res').className = 'tg ' + (pend ? 'av' : 'lib');
  itens.forEach(x => box.append(el('li', {class: x.ok ? 'ok' : 'pend'}, el('i', {text: x.ok ? '✓' : '!'}), el('div', {}, el('b', {text: x.t}), el('small', {text: x.d || ''})))));
}
async function gerarPdfOficio(){
  const o = ofAtual(); if (!o) return;
  const pend = conferirOficio(o).filter(x => !x.ok);
  if (pend.length && !confirm('Ainda há pontos fora do manual:\n\n' + pend.map(x => `• ${x.t}: ${x.d}`).join('\n') + '\n\nGerar o PDF assim mesmo?')) return;
  status('Gerando o ofício…', 'warn');
  try {
    const r = await gerarBytesOficio(o), nome = nomeArquivoOf(o.campos);
    baixar(nome, r.bytes, 'application/pdf');
    let salvo = false;
    if (dirHandle){ try { const d1 = await dirHandle.getDirectoryHandle('oficios', {create: true}), d2 = await d1.getDirectoryHandle(o.campos.ano || hojeISO().slice(0, 4), {create: true}); const w = await (await d2.getFileHandle(nome, {create: true})).createWritable(); await w.write(r.bytes); await w.close(); salvo = true; } catch (e){ console.warn(e); } }
    o.ultimoPdf = new Date().toISOString(); o.alteradoEm = o.ultimoPdf; agendarSalvar();
    registrar('pdf', `gerou o ${epigrafeOf(o.campos)}${o.campos.assunto ? ' – ' + o.campos.assunto : ''}`);
    status(salvo ? `PDF baixado e salvo em oficios/${o.campos.ano}` : 'PDF baixado', 'ok');
  } catch (e){ console.error(e); alert('Erro ao gerar o PDF: ' + e.message); status('Erro ao gerar o PDF', 'err'); }
}
function excluirOficio(){
  const o = ofAtual(); if (!o) return;
  if (!confirm(`Excluir o ${epigrafeOf(o.campos)}? Não dá para desfazer.`)) return;
  db.oficios = db.oficios.filter(x => x !== o); registrar('exclusao', `excluiu o ${epigrafeOf(o.campos)}`);
  ofAtualId = null; agendarSalvar(); renderOficios();
}
$('#of-man-arq').onchange = e => { const f = e.target.files[0]; e.target.value = ''; importarManualRedacao(f); };
$('#of-voltar').onclick = () => { ofAtualId = null; renderOficios(); };
$('#of-pdf').onclick = gerarPdfOficio;
$('#of-excluir').onclick = excluirOficio;
$('#of-exemplo').onclick = exemploNoOficio;
$('#of-numero-auto').onclick = () => { const o = ofAtual(); if (!o) return; o.campos.numero = proximoNumeroOf(o.campos, o.id); agendarSalvar(); renderEditorOficio(); };
(() => { const z = $('#of-manual'); ['dragover', 'dragenter'].forEach(ev => z.addEventListener(ev, e => { e.preventDefault(); z.classList.add('sobre'); })); ['dragleave', 'drop'].forEach(ev => z.addEventListener(ev, e => { e.preventDefault(); z.classList.remove('sobre'); })); z.addEventListener('drop', e => importarManualRedacao(e.dataTransfer.files[0])); })();
window.addEventListener('resize', () => { if (viewAtual === 'oficio' && ofAtual()) agendarPrevia(300); });

/* ================= ORDEM DE SERVIÇO (tabela, conforme o Manual de Redação importado) ================= */
let osAtualId = null, osPreviaSeq = 0, osPreviaTimer = null, osUltimoLayout = null;
const osAtual = () => (db.ordensServico || []).find(o => o.id === osAtualId);
const OS_ATRIB_PADRAO = [
  'a) No início do policiamento atinente a esta O.S., o Comandante Operacional deverá orientar seus comandados sobre:',
  '- Relacionamento com o público;', '- Postura e compostura;', '- Conhecimento desta O.S. e atuação em geral.',
  'b) Toda e qualquer abordagem deve ser feita dentro dos limites da legalidade, da proporcionalidade e da necessidade, observando-se o Manual do Procedimento Operacional Padrão (POP) PMTO;',
  'c) Comunicar qualquer eventualidade ao superior imediato, principalmente em ocorrências envolvendo policiais de outras forças ou integrantes das forças armadas;',
  'd) O policiamento será empregado de conformidade com o Comandante Operacional;',
  'e) Certificar-se das situações de segurança de todos os envolvidos na mesma e mobilizar efetivo para sua eficaz execução;',
  'f) Eventuais incidentes envolvendo autoridades civis e militares deverão ser encaminhados ao CPU de área, que deverá repassar as informações em seguida ao Comandante da Unidade, o qual tomará medidas cabíveis;',
  'g) Fiscalizar o andamento das ações desenvolvidas no decorrer do serviço;',
  'h) Situações omissas serão dirimidas pelo Comandante do Batalhão.'].join('\n');
const OS_ITENS_PADRAO = () => [
  {titulo: 'MISSÃO', tipo: 'sub', linhas: [{rotulo: 'Geral', texto: ''}, {rotulo: 'Específicas', texto: ''}]},
  {titulo: 'ADMINISTRAÇÃO', tipo: 'sub', linhas: [{rotulo: 'Comandante', texto: 'Conforme escala de serviço.'}]},
  {titulo: 'ATRIBUIÇÕES AO COMANDANTE DA OPERAÇÃO', tipo: 'texto', linhas: [], texto: OS_ATRIB_PADRAO},
  {titulo: 'CONDIÇÕES DE EXECUÇÃO', tipo: 'sub', linhas: [
    {rotulo: 'Local e Período', texto: '**Local:** \n**Data / Horário:** conforme escala a ser expedida.'},
    {rotulo: 'Efetivo', texto: 'Conforme escala de serviço.'},
    {rotulo: 'Fardamento', texto: '5º “A” TERBRIM ou 5º “A-2” COMBAT SHIRT completo com cinto de guarnição e apetrechos;'},
    {rotulo: 'Armamento e Equipamento', texto: 'pistola; coletes balísticos; algemas; cassetetes ou tonfas; rádios HT´s; lanterna; cones e apitos c/ cordão [...].'},
    {rotulo: 'Viaturas', texto: 'Serão empregadas na missão as viaturas disponíveis na UPM.'}]},
  {titulo: 'ATRIBUIÇÕES AOS ELEMENTOS SUBORDINADOS', tipo: 'sub', linhas: [
    {rotulo: 'ALI', texto: 'Escalar o efetivo conforme disponibilidade;\nFazer levantamentos dos locais de atuações para subsidiar o planejamento da operação, bem como para subsidiar as ações do serviço ordinário.'},
    {rotulo: '3ª Cia Op.', texto: 'Informar ao efetivo com antecedência.'},
    {rotulo: 'P/3', texto: 'Elaborar e difundir a Ordem de Serviço pertinente e providenciar reunião com as partes.'},
    {rotulo: 'P/5', texto: 'Providenciar fotografias e envio de releases à ASCOM.'}]},
  {titulo: 'LIGAÇÕES', tipo: 'lig', linhas: [
    {rotulo: 'Rede telefônica convencional', texto: 'COPOM (via 190)'},
    {rotulo: 'Comandante do 8º BPM', texto: '(63) 98138-4382'},
    {rotulo: 'Subcomandante do 8º BPM', texto: '(63) 99298-9904'},
    {rotulo: 'CPU do 8º BPM', texto: '(63) 99201-8195'},
    {rotulo: 'Modulação', texto: 'Canal 04 ou conforme determinação do Cmt da Operação'}]}
];
const epigrafeOS = c => `O.S. nº ${String(c.numero || '').padStart(3, '0')}/${c.ano || ''} – ${(c.setores || []).map(siglaSemBarra).filter(Boolean).join('/')}`;
function nomeArquivoOS(c){
  const limpa = s => String(s || '').replace(/\*\*/g, '').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
  return `O.S. ${String(c.numero || '').padStart(3, '0')}-${c.ano} – ${limpa(siglaSemBarra((c.setores || [])[0]))} – ${limpa(c.evento).replace(/\.$/, '').slice(0, 80) || 'sem evento'}.pdf`;
}
function proximoNumeroOS(c, ignorar){
  const k = `${c.ano}|${(c.setores || []).map(siglaSemBarra).filter(Boolean).join('/')}`;
  const nums = (db.ordensServico || []).filter(o => o.id !== ignorar && `${o.campos.ano}|${(o.campos.setores || []).map(siglaSemBarra).filter(Boolean).join('/')}` === k).map(o => parseInt(o.campos.numero) || 0);
  return String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0');
}

/* ---------- PDF da OS ---------- */
const AUTO_OS = {
  epigrafe: c => epigrafeOS(c),
  sgd: c => (c.sgd || '').trim() ? 'SGD: ' + c.sgd.trim() : '',
  localData: c => localDataOf(c),
  assDigital: c => c.assDigital !== false ? 'Assinatura digital' + (c.ni ? ', NI' : '') : '',
  sigNome: c => AUTO_OF.sigNome(c),
  sigFuncao: c => AUTO_OF.sigFuncao(c)
};
const linhaOS = (c, k) => temOv(c, k) ? c.ov[k] : AUTO_OS[k](c);
async function gerarBytesOS(o, {semTexto} = {}){
  const {PDFDocument, StandardFonts, rgb} = await carregarPdfLib();
  const c = o.campos, M = db.manualRedacao, R = k => regraOf(k), RO = k => M?.os?.regras?.[k]?.valor;
  const doc = await PDFDocument.create();
  doc.setTitle(nomeArquivoOS(c).replace(/\.pdf$/, '')); doc.setAuthor(c.cab2 || c.cab1 || 'PMTO'); doc.setCreator('Sistema de Gestão de Ensino');
  const FN = {r: await doc.embedFont(StandardFonts.Helvetica), b: await doc.embedFont(StandardFonts.HelveticaBold), i: await doc.embedFont(StandardFonts.HelveticaOblique), bi: await doc.embedFont(StandardFonts.HelveticaBoldOblique)};
  const fonte = sg => FN[(sg.b ? 'b' : '') + (sg.i ? 'i' : '') || 'r'];
  const ok = (t, f) => [...String(t ?? '')].map(ch => { try { f.widthOfTextAtSize(ch, 10); return ch; } catch { return ch === '\t' ? ' ' : ch === '✓' ? '•' : '?'; } }).join('');
  const larg = (t, f, s) => [...ok(t, f)].reduce((a, ch) => a + f.widthOfTextAtSize(ch, s), 0);
  const PRETO = rgb(0, 0, 0);
  const W = 595.28, H = 841.89, s = R('corpo'), LH = z => z * 1.149;
  const mL = R('mEsq') * CM, mR = R('mDirSup') * CM, mT = R('mDirSup') * CM, mB = R('mInf') * CM, area = W - mL - mR, limite = H - mB;
  const PAD = 0.19 * CM, ESP = RO('celulaEspaco') ?? 6, X0 = mL - PAD, TW = area;
  const COL1 = 6.19 * CM, COL1E = 6.44 * CM, HANG = 0.75 * CM, SUBTAB = 1.0 * CM;
  const espaco = z => larg(' ', FN.r, z);
  const largSegs = (segs, z) => segs.reduce((a, sg) => a + larg(sg.t, fonte(sg), z), 0);
  const palavras = segs => { const ws = []; let w = []; segs.forEach(sg => sg.t.split(/(\s+)/).forEach(p => { if (!p) return; if (/^\s+$/.test(p)){ if (w.length){ ws.push(w); w = []; } } else w.push({...sg, t: p}); })); if (w.length) ws.push(w); return ws; };
  // um parágrafo vira linhas {h, draw(pg, top, x)} dentro de uma largura
  const linhasPar = (segs, largura, {alinh = 'j', ind = 0, pend = 0, prefixo = null} = {}) => {
    const ws = palavras(segs), out = []; let atual = [], w = 0, max = largura - ind;
    ws.forEach(pw => { const lw = largSegs(pw, s), add = (atual.length ? espaco(s) : 0) + lw; if (atual.length && w + add > max + 0.01){ out.push({ln: atual, x: ind}); atual = [pw]; w = lw; max = largura - pend; } else { atual.push(pw); w += add; } });
    if (atual.length || !out.length) out.push({ln: atual, x: out.length ? pend : ind});
    return out.map(({ln, x}, n) => ({h: LH(s), draw: (pg, top, xc) => {
      const base = H - (top + s * 0.905), ultima = n === out.length - 1, maxL = largura - x;
      if (n === 0 && prefixo){ let px = xc; prefixo.forEach(sg => {
        if (sg.t === '✓'){ const b0 = base + s * 0.32; pg.drawLine({start: {x: px + 0.5, y: b0}, end: {x: px + s * 0.28, y: base + s * 0.06}, thickness: 1.1, color: PRETO}); pg.drawLine({start: {x: px + s * 0.28, y: base + s * 0.06}, end: {x: px + s * 0.72, y: base + s * 0.66}, thickness: 1.1, color: PRETO}); return; }
        const f = fonte(sg), t = ok(sg.t, f); pg.drawText(t, {x: px, y: base, size: s, font: f, color: PRETO}); px += larg(t, f, s); }); }
      const natural = ln.reduce((a, pw) => a + largSegs(pw, s), 0) + espaco(s) * Math.max(0, ln.length - 1);
      let xx = xc + x, gap = espaco(s);
      if (alinh === 'c') xx = xc + (largura - natural) / 2;
      else if (alinh === 'r') xx = xc + largura - natural;
      else if (alinh === 'j' && !ultima && ln.length > 1) gap = espaco(s) + (maxL - natural) / (ln.length - 1);
      ln.forEach((pw, k) => { pw.forEach(sg => { const f = fonte(sg), t = ok(sg.t, f); pg.drawText(t, {x: xx, y: base, size: s, font: f, color: PRETO}); xx += larg(t, f, s); }); if (k < ln.length - 1) xx += gap; });
    }}));
  };
  // texto de célula: cada linha do campo é um parágrafo (6 pt antes e depois); a), •, ✓ e - ganham recuo
  const celula = (texto, largura, {alinh = 'j', base = {}} = {}) => {
    const blocos = [];
    String(texto || '').split('\n').forEach(l => {
      const t = l.replace(/\s+$/, ''); if (!t.trim()) return;
      let segs = trechosOf(t.trim(), base), op = {alinh};
      const mL1 = /^([a-z]\)|[•✓▪])\s+/.exec(t.trim()), mH = /^-\s*/.exec(t.trim());
      if (mL1){ const pre = mL1[1]; segs = trechosOf(t.trim().slice(mL1[0].length), base); op = {alinh, ind: HANG, pend: HANG, prefixo: [{t: pre}]}; }
      else if (mH) op = {alinh, ind: HANG, pend: HANG};
      blocos.push(linhasPar(segs, largura, op));
    });
    if (!blocos.length) blocos.push([{h: LH(s), draw: () => {}}]);
    return blocos;
  };
  const altura = blocos => blocos.reduce((a, b) => a + ESP + b.reduce((x, l) => x + l.h, 0) + ESP, 0);
  // ----- linhas da tabela
  const rows = []; // {cells: [{x, w, blocos, valign}], borda: [x verticais], tipo}
  const linhaCheia = (blocos, tipo, ref) => rows.push({cells: [{x: X0, w: TW, blocos, ref}], vis: [], tipo});
  const linhaDupla = (b1, b2, col = COL1, tipo, r1, r2) => rows.push({cells: [{x: X0, w: col, blocos: b1, ref: r1}, {x: X0 + col, w: TW - col, blocos: b2, ref: r2}], vis: [X0 + col], tipo});
  const IW = w => w - 2 * PAD;
  // epígrafe + local/data
  // largura da 1ª coluna do cabeçalho da tabela: o suficiente para a epígrafe, deixando a data numa linha só
  const tEp = linhaOS(c, 'epigrafe'), tSgd = linhaOS(c, 'sgd'), tDt = linhaOS(c, 'localData');
  const wEp = Math.max(larg(semMarca(tEp), FN.b, s), semMarca(tSgd).trim() ? larg(semMarca(tSgd), FN.r, s) : 0) + 2 * PAD + 4;
  const wDt = larg(semMarca(tDt), FN.r, s) + 2 * PAD + 4;
  const colE = Math.max(3 * CM, Math.min(wEp, COL1E), Math.min(COL1E, TW - wDt));
  const esq = [linhasPar(trechosOf(tEp, {b: true}), IW(colE), {alinh: 'l'})];
  if (semMarca(tSgd).trim()) esq.push(linhasPar(trechosOf(tSgd), IW(colE), {alinh: 'l'}));
  linhaDupla(esq, [linhasPar(trechosOf(tDt), IW(TW - colE), {alinh: 'r'})], colE, 'epigrafe', ['ov:epigrafe', 'ov:sgd'], 'ov:localData');
  [['Aos', c.aos], ['Evento', c.evento], ['Referência', c.referencia], ['Anexos', c.anexos]].forEach(([rot, v]) => {
    if (rot !== 'Referência' && rot !== 'Anexos' && !(v || '').trim()) {}
    if ((rot === 'Anexos') && !(v || '').trim()) return;
    const ls = String(v || '').split('\n'), bl = [];
    ls.forEach((l, k) => { if (!k || l.trim()) bl.push(linhasPar(k ? trechosOf(l.trim()) : [{t: rot + ':', b: true}, {t: l.trim() ? ' ' : ''}, ...trechosOf(l.trim())], IW(TW), {alinh: 'j'})); });
    linhaCheia(bl, 'difusao', {Aos: 'aos', Evento: 'evento', 'Referência': 'referencia', Anexos: 'anexos'}[rot]);
  });
  let n = 0;
  (c.itens || []).forEach((it, ii) => {
    const numerado = it.tipo !== 'lig' || it.numerar !== false;
    n++;
    linhaCheia([linhasPar([{t: `${n}. ${(it.titulo || '').trim().toUpperCase()}`, b: true}], IW(TW), {alinh: 'l'})], 'item', `it:${ii}:titulo`);
    if (it.tipo === 'texto') linhaCheia(celula(it.texto, IW(TW)), 'texto', `it:${ii}:texto`);
    else (it.linhas || []).forEach((L, k) => {
      if (it.tipo === 'lig') linhaDupla(celula(L.rotulo, IW(COL1), {alinh: 'l'}), celula(L.texto, IW(TW - COL1)), COL1, 'lig', `it:${ii}:L:${k}:rotulo`, `it:${ii}:L:${k}:texto`);
      else {
        const num = `${n}.${k + 1}`, rot = (L.rotulo || '').trim();
        const bl = [linhasPar([{t: rot, b: true}], IW(COL1) - SUBTAB, {alinh: 'l'}).map(l => ({...l, draw: (pg, top, x) => l.draw(pg, top, x + SUBTAB)}))];
        const numDraw = bl[0][0].draw; bl[0][0] = {...bl[0][0], draw: (pg, top, x) => { pg.drawText(num, {x, y: H - (top + s * 0.905), size: s, font: FN.b, color: PRETO}); numDraw(pg, top, x); }};
        linhaDupla(bl, celula(L.texto, IW(TW - COL1)), COL1, 'sub', `it:${ii}:L:${k}:rotulo`, `it:${ii}:L:${k}:texto`);
      }
    });
  });
  // ----- cabeçalho (1ª página)
  const cab = [];
  const hImg = R('brasaoAltura') * CM;
  let img = null, imgW = 0;
  if (M?.brasao){ const bytes = Uint8Array.from(atob(M.brasao.split(',')[1]), ch => ch.charCodeAt(0)); img = /image\/png/.test(M.brasao) ? await doc.embedPng(bytes) : await doc.embedJpg(bytes); imgW = img.width * hImg / img.height; }
  // ----- paginação
  const paginas = [], regioes = []; let pg = null, y = 0;
  const novaPagina = () => { pg = doc.addPage([W, H]); paginas.push(pg); y = mT; };
  const reg = (top, x, w, h, ref, meta = {}) => { if (ref) regioes.push({p: paginas.length - 1, x, y: top, w, h, ref, s, lh: LH(s), esp: ESP, ...meta}); };
  const editavel = ref => ref && !ref.startsWith('f:');
  novaPagina();
  if (img){ pg.drawImage(img, {x: (W - imgW) / 2, y: H - y - hImg, width: imgW, height: hImg}); y += hImg + R('cabecalho') * 0.212; }
  const sCab = R('cabecalho');
  [['cab1', c.cab1], ['cab2', c.cab2]].filter(([, x]) => (x || '').trim()).forEach(([kc, t]) => { reg(y, 0, W, LH(sCab), kc, {s: sCab, lh: LH(sCab), esp: 0}); if (semTexto){ y += LH(sCab); return; } const tt = ok(t.trim().toUpperCase(), FN.r); pg.drawText(tt, {x: (W - larg(tt, FN.r, sCab)) / 2, y: H - (y + sCab * 0.905), size: sCab, font: FN.r, color: PRETO}); y += LH(sCab); });
  y += LH(s) * R('antesEpigrafe');
  const linhaH = (x1, x2, yy) => pg.drawLine({start: {x: x1, y: H - yy}, end: {x: x2, y: H - yy}, thickness: 0.5, color: PRETO});
  const linhaV = (x, y1, y2) => pg.drawLine({start: {x, y: H - y1}, end: {x, y: H - y2}, thickness: 0.5, color: PRETO});
  // assinatura (precisa caber junto com a última linha da tabela)
  const sig = [], sigRef = [];
  if (semMarca(linhaOS(c, 'assDigital')).trim()){ sig.push(trechosOf(linhaOS(c, 'assDigital'))); sigRef.push('ov:assDigital'); }
  sig.push(trechosOf(linhaOS(c, 'sigNome'))); sigRef.push('ov:sigNome');
  sig.push(trechosOf(linhaOS(c, 'sigFuncao'))); sigRef.push('ov:sigFuncao');
  const hSig = LH(s) * 1.5 * 2 + sig.length * LH(s);
  let primeira = true;
  rows.forEach((row, ri) => {
    const hs = row.cells.map(cl => altura(cl.blocos)), hRow = Math.max(...hs);
    const ultima = ri === rows.length - 1;
    const precisa = hRow + (ultima ? hSig : 0);
    // título de item não fica sozinho no fim da página: vai junto com o começo da linha seguinte
    if (row.tipo === 'item' && rows[ri + 1]){ const prox = Math.min(Math.max(...rows[ri + 1].cells.map(cl => altura(cl.blocos))), ESP * 2 + LH(s) * 2); if (y + hRow + prox > limite){ novaPagina(); primeira = true; } }
    if (y + precisa > limite && hRow <= limite - mT){
      // linha inteira cabe numa página: só quebra se for pequena; as grandes se dividem
      if (hRow < 140 || ultima){ novaPagina(); primeira = true; }
    }
    // desenha a linha, dividindo em páginas se precisar (linhas de texto não se quebram ao meio)
    const fatias = row.cells.map(cl => { const its = []; cl.blocos.forEach((b, bi) => { its.push({h: ESP, gap: true}); b.forEach(l => its.push({...l, bi})); its.push({h: ESP, gap: true}); }); return its; });
    let pos = fatias.map(() => 0), topoLinha = y, inicioPg = true;
    while (pos.some((p, i) => p < fatias[i].length)){
      const disp = limite - y;
      // quanto de cada célula cabe nesta página
      const parte = fatias.map((its, i) => { let h = 0, j = pos[i]; while (j < its.length && h + its[j].h <= disp + 0.01){ h += its[j].h; j++; } return {fim: j, h}; });
      const acabou = parte.every((p, i) => p.fim >= fatias[i].length);
      const hParte = acabou ? Math.max(...fatias.map((its, i) => its.slice(pos[i]).reduce((a, x) => a + x.h, 0))) : disp;
      if (!acabou && parte.every((p, i) => p.fim === pos[i])){ novaPagina(); topoLinha = y; continue; }
      if (primeira || !inicioPg) {}
      if (primeira){ linhaH(X0, X0 + TW, y); primeira = false; }
      row.cells.forEach((cl, i) => {
        const its = fatias[i].slice(pos[i], parte[i].fim), hC = its.reduce((a, x) => a + x.h, 0);
        let yy = y + (acabou && pos[i] === 0 ? (hParte - hC) / 2 : 0); // centralizado na vertical
        its.forEach(l => { if (!l.gap){ const ref = Array.isArray(cl.ref) ? cl.ref[l.bi] : cl.ref; if (!(semTexto && editavel(ref))) l.draw(pg, yy, cl.x + PAD); reg(yy, cl.x + PAD, cl.w - 2 * PAD, l.h, ref); } yy += l.h; });
        pos[i] = parte[i].fim;
      });
      row.vis.forEach(x => linhaV(x, y, y + hParte));
      y += hParte;
      if (acabou){ linhaH(X0, X0 + TW, y); }
      else { novaPagina(); primeira = false; inicioPg = false; }
    }
  });
  // ----- assinatura fora da tabela
  if (y + hSig > limite) novaPagina();
  y += LH(s) * 1.5 * 2;
  sig.forEach((segs, si) => { reg(y, 0, W, LH(s), sigRef[si], {esp: 0}); if (semTexto){ y += LH(s); return; } const w = largSegs(segs, s); let x = (W - w) / 2; segs.forEach(sg => { const f = fonte(sg), t = ok(sg.t, f); pg.drawText(t, {x, y: H - (y + s * 0.905), size: s, font: f, color: PRETO}); x += larg(t, f, s); }); y += LH(s); });
  // ----- rodapé (opcional)
  const rod = c.usarRodape ? [c.rodape1, c.rodape2].map(t => (t || '').trim()).filter(Boolean) : [];
  const sRod = R('rodape');
  const rodK = c.usarRodape ? [['rodape1', c.rodape1], ['rodape2', c.rodape2]].filter(([, t]) => (t || '').trim()) : [];
  paginas.forEach((p, pi) => { let top = H - R('rodapeArea') * CM; rodK.forEach(([k, t]) => { const tt = ok(t.trim(), FN.r); if (!semTexto) p.drawText(tt, {x: (W - larg(tt, FN.r, sRod)) / 2, y: H - (top + sRod * 0.905), size: sRod, font: FN.r, color: PRETO}); regioes.push({p: pi, x: 0, y: top, w: W, h: LH(sRod), ref: k, s: sRod, lh: LH(sRod), esp: 0}); top += LH(sRod); }); });
  return {bytes: await doc.save(), paginas: paginas.length, regioes: juntarRegioes(regioes)};
}

/* edição direto na prévia da OS: cada campo da tabela é editado inteiro (Enter = nova linha, como no formulário) */
const ADAPT_OS = {
  alvo(ref){ const c = osAtual()?.campos; if (!c) return null; const m = ref.split(':');
    if (m[0] !== 'it') return {obj: c, k: m[0]};
    const it = c.itens?.[+m[1]]; if (!it) return null;
    return m[2] === 'L' ? {obj: it.linhas?.[+m[3]], k: m[4], it, i: +m[1], li: +m[3]} : {obj: it, k: m[2], it, i: +m[1]}; },
  ler(ref){
    const c = osAtual()?.campos; if (!c || ref.startsWith('f:')) return null;
    const m = ref.split(':');
    if (m[0] === 'ov') return {txt: linhaOS(c, m[1]), base: m[1] === 'epigrafe' ? {b: true} : null, auto: true, temOv: temOv(c, m[1]), jc: m[1] === 'localData' ? 'r' : m[1].startsWith('sig') || m[1] === 'assDigital' ? 'c' : 'l',
      dica: 'Linha automática: o que você digitar passa a valer'};
    if (/^(cab1|cab2|rodape1|rodape2)$/.test(m[0])) return {txt: c[m[0]] || '', jc: 'c', caixa: m[0].startsWith('cab')};
    const a = this.alvo(ref); if (!a?.obj) return null;
    const rot = {aos: 'Aos:', evento: 'Evento:', referencia: 'Referência:', anexos: 'Anexos:'}[m[0]];
    if (rot) return {txt: a.obj[a.k] || '', linhas: true, pre: rot + ' ', preB: true, jc: 'j'};
    if (a.k === 'titulo') return {txt: a.obj.titulo || '', pre: `${a.i + 1}. `, preB: true, base: {b: true}, caixa: true, jc: 'l'};
    if (a.k === 'rotulo') return a.it.tipo === 'lig' ? {txt: a.obj.rotulo || '', linhas: true, jc: 'l'} : {txt: a.obj.rotulo || '', pre: `${a.i + 1}.${a.li + 1}`, preB: true, preW: 1.0 * CM_PT, base: {b: true}, jc: 'l'};
    return {txt: a.obj[a.k] || '', linhas: true, jc: 'j'};
  },
  gravar(ref, txt){
    const c = osAtual().campos, m = ref.split(':');
    if (m[0] === 'ov'){ c.ov ||= {}; c.ov[m[1]] = txt; if (m[1] === 'epigrafe'){ const x = /n[º°o]\s*(\d+)\s*\/\s*(\d{4})/i.exec(semMarca(txt)); if (x){ c.numero = x[1]; c.ano = x[2]; ['numero', 'ano'].forEach(k => sincronizarCampo($('#os-form'), `[data-k="${k}"]`, c[k])); } } return; }
    const a = this.alvo(ref); if (!a?.obj) return;
    const up = a.k === 'titulo' || /^cab/.test(a.k);
    a.obj[a.k] = up ? txt.toUpperCase() : txt;
    sincronizarCampo($('#os-form'), ref.startsWith('it:') ? `[data-ref="${ref}"]` : `[data-k="${a.k}"]`, a.obj[a.k]);
  },
  automatico(ref){ const c = osAtual()?.campos; if (c?.ov) delete c.ov[ref.split(':')[1]]; },
  mudou(ms = 500){ const o = osAtual(); if (!o) return; o.alteradoEm = new Date().toISOString(); agendarSalvar(); agendarPreviaOS(ms); },
  focar(ref){ focarCampoForm($('#os-form'), ref.slice(2)); }
};

/* ---------- conferência ---------- */
function conferirOS(o){
  const c = o.campos, M = db.manualRedacao, itens = [], add = (ok, t, d) => itens.push({ok, t, d});
  const R = M.regras, RO = M.os?.regras || {};
  add(true, 'Formatação do manual aplicada', `${R.fonte.valor} ${R.corpo.valor} · margens ${R.mEsq.valor} / ${R.mDirSup.valor} / ${R.mDirSup.valor} / ${R.mInf.valor} cm · tabela com células de entrelinhas simples e ${RO.celulaEspaco?.valor ?? 6} pt antes e depois, texto justificado e centralizado na vertical`);
  const set = (c.setores || []).map(siglaSemBarra).filter(Boolean);
  add(set.length > 0 && set.length <= 4, 'Epígrafe e local/data lado a lado', set.length ? `${epigrafeOS(c)} | ${localDataOf(c)}` : 'informe a seção que expede (ex.: P3 e 8º BPM)');
  add(!!(c.aos || '').trim(), 'Difusão (Aos:)', (c.aos || '').trim() ? 'funções de quem deve tomar conhecimento' : 'informe para quem vai a O.S.');
  add(!!(c.evento || '').trim(), 'Evento', (c.evento || '').trim() ? 'descrito de forma simples e clara' : 'descreva o evento');
  const vazios = [];
  (c.itens || []).forEach((it, i) => { if (it.tipo === 'texto'){ if (!(it.texto || '').trim()) vazios.push(`${i + 1}. ${it.titulo}`); } else (it.linhas || []).forEach((L, k) => { if (!(L.texto || '').trim()) vazios.push(`${i + 1}.${k + 1} ${L.rotulo}`); }); });
  add(!vazios.length, 'Itens preenchidos', vazios.length ? 'em branco: ' + vazios.slice(0, 6).join(', ') + (vazios.length > 6 ? '…' : '') : `${(c.itens || []).length} itens, numerados em negrito e caixa alta`);
  const caixaAlta = []; (c.itens || []).forEach((it, i) => it.tipo === 'sub' && (it.linhas || []).forEach((L, k) => { const r = (L.rotulo || '').trim(); if (r.length > 5 && r === r.toUpperCase() && /[A-Z]{4}/.test(norm(r))) caixaAlta.push(`${i + 1}.${k + 1}`); }));
  add(!caixaAlta.length, 'Subitens', caixaAlta.length ? `o manual pede só a inicial maiúscula (ex.: “Local e Período”): ${caixaAlta.join(', ')}` : 'numerados, em negrito, só com a inicial maiúscula');
  const missao = (c.itens || []).find(it => /MISS/i.test(norm(it.titulo)));
  if (missao) add(true, 'Missão', 'verbos no infinitivo (ex.: “Executar…”, “Realizar…”)');
  const faltaSig = [['sigNome', 'nome'], ['sigPosto', 'posto e quadro'], ['sigFuncao', 'função']].filter(([k]) => !(c[k] || '').trim()).map(x => x[1]);
  add(!faltaSig.length && (c.sigGuerra || []).length > 0, 'Assinatura fora da tabela', faltaSig.length ? 'falta: ' + faltaSig.join(', ') : !(c.sigGuerra || []).length ? 'marque o nome de guerra (sai em negrito)' : 'sem local e data (já estão no início da O.S.)');
  if (osUltimoLayout) add(true, 'Páginas', `${osUltimoLayout.paginas} página(s)`);
  return itens;
}

/* ---------- telas ---------- */
function renderOS(){
  db.ordensServico ||= [];
  $('#tag-os').textContent = db.ordensServico.filter(meuOficio).length;
  const o = osAtual();
  $('#os-inicio').hidden = !!o; $('#os-editor').hidden = !o;
  if (o) renderEditorOS(); else renderListaOS();
}
function renderListaOS(){
  const M = db.manualRedacao, box = $('#os-manual'); box.innerHTML = '';
  const pronto = !!M?.os?.modelo;
  if (!M) box.append(el('div', {class: 'aviso'}, el('span', {text: 'Importe o Manual de Redação Oficial em Ofícios: a Ordem de Serviço usa as regras e o modelo dele.'}), el('button', {class: 'btn peq pri', text: 'Ir para Ofícios', onclick: () => irPara('oficio')})));
  else if (!pronto) box.append(el('div', {class: 'aviso'}, el('span', {text: 'O manual foi importado numa versão anterior do sistema. Importe-o de novo uma vez para o sistema aprender a Ordem de Serviço.'}), el('button', {class: 'btn peq pri', text: 'Importar o manual de novo', onclick: () => $('#of-man-arq').click()})));
  else {
    const RO = M.os.regras;
    box.append(el('div', {class: 'of-man-ok'},
      M.brasao ? el('img', {src: M.brasao, alt: 'Brasão', class: 'of-brasao'}) : '',
      el('div', {class: 'nm'}, el('b', {text: 'Regras e modelo da Ordem de Serviço lidos do manual'}), el('small', {text: `${M.nome} · ${Object.values(RO).filter(r => r.lido).length} regras próprias da O.S. + regras gerais do manual · estrutura com ${M.os.modelo.itens.length} itens`})),
      el('button', {class: 'btn pri', text: '+ Nova Ordem de Serviço', onclick: () => novaOS()})),
      el('details', {class: 'of-regras'}, el('summary', {text: 'Ver as regras da Ordem de Serviço'}),
        el('table', {class: 'tab-datas'}, el('tbody', {}, ...Object.values(RO).map(r => el('tr', {}, el('td', {text: r.rotulo}), el('td', {}, r.lido ? el('small', {text: '“' + r.trecho + '”'}) : el('small', {class: 'tg av', text: 'padrão'}))))))));
  }
  const lb = $('#os-lista'); lb.innerHTML = '';
  const lista = (db.ordensServico || []).filter(meuOficio).sort((a, b) => (b.alteradoEm || '').localeCompare(a.alteradoEm || ''));
  if (!lista.length) lb.append(el('div', {class: 'vazio', text: pronto ? 'Nenhuma Ordem de Serviço ainda. Clique em “+ Nova Ordem de Serviço”.' : 'Importe o manual para começar.'}));
  lista.forEach(o => { const c = o.campos; lb.append(el('div', {class: 'linha'},
    el('div', {class: 'ic-arq', style: 'background:#a8861c', text: 'O.S.'}),
    el('div', {class: 'nm'}, el('b', {text: epigrafeOS(c) + (c.evento ? ' · ' + c.evento.replace(/\*\*/g, '') : '')}),
      el('small', {text: [c.data ? dataBR(c.data) : '', ehAdmin() && o.autor ? 'por ' + o.autor : '', o.ultimoPdf ? 'PDF gerado em ' + new Date(o.ultimoPdf).toLocaleString('pt-BR') : 'rascunho'].filter(Boolean).join(' · ')})),
    el('button', {class: 'btn peq', text: 'Abrir', onclick: () => abrirOS(o.id)}))); });
}
function novaOS(base){
  const M = db.manualRedacao; if (!M?.os?.modelo) return;
  const ultOS = (db.ordensServico || []).filter(x => x.autorId === P.perfilId).sort((a, b) => (b.alteradoEm || '').localeCompare(a.alteradoEm || ''))[0]?.campos;
  const ultOf = (db.oficios || []).filter(x => x.autorId === P.perfilId).sort((a, b) => (b.alteradoEm || '').localeCompare(a.alteradoEm || ''))[0]?.campos;
  const b = base || ultOS || ultOf || OF_PADRAO;
  const c = {
    ano: hojeISO().slice(0, 4), data: hojeISO(), cab1: b.cab1, cab2: b.cab2, setores: [...(b.setores || ['', '']), '', '', ''].slice(0, 4), sgd: '',
    cidade: b.cidade, sep: ultOS ? ultOS.sep : '–', uf: b.uf, aos: '', evento: '', referencia: '', anexos: '',
    itens: base ? JSON.parse(JSON.stringify(base.itens)) : OS_ITENS_PADRAO(),
    assDigital: true, ni: false, sigNome: b.sigNome, sigGuerra: [...(b.sigGuerra || [])], sigPosto: b.sigPosto, sigResp: false, sigFuncao: b.sigFuncao,
    usarRodape: false, rodape1: b.rodape1 || OF_PADRAO.rodape1, rodape2: b.rodape2 || OF_PADRAO.rodape2
  };
  if (base){ ['aos', 'evento', 'referencia', 'anexos'].forEach(k => c[k] = base[k] || ''); }
  c.numero = proximoNumeroOS(c);
  const o = {id: uid(), autorId: P.perfilId, autor: perfilAtual().nome || '', criadoEm: new Date().toISOString(), alteradoEm: new Date().toISOString(), campos: c};
  db.ordensServico.push(o); registrar('os', `começou a ${epigrafeOS(c)}`); agendarSalvar(); abrirOS(o.id);
}
function abrirOS(id){ osAtualId = id; osUltimoLayout = null; renderOS(); $('.conteudo').scrollTop = 0; }
function mudouOS(o, prev = true){ o.alteradoEm = new Date().toISOString(); agendarSalvar(); if (prev) agendarPreviaOS(); }
function campoOS(o, obj, k, rot, op = {}){
  const mudou = v => { obj[k] = v; mudouOS(o); if (op.depois) op.depois(); };
  let inp;
  if (op.tipo === 'area') inp = el('textarea', {rows: op.linhas || 3, value: obj[k] || '', placeholder: op.ph || '', oninput: e => mudou(e.target.value)});
  else if (op.tipo === 'sel'){ inp = el('select', {onchange: e => mudou(e.target.value)}, ...op.op.map(([v, t]) => el('option', {value: v, text: t}))); inp.value = obj[k] ?? op.op[0][0]; }
  else if (op.tipo === 'chk') return el('label', {class: 'chk ' + (op.cls || ''), 'data-k': k}, el('input', {type: 'checkbox', checked: !!(obj[k] ?? op.padrao), onchange: e => mudou(e.target.checked)}), el('span', {text: rot}));
  else inp = el('input', {type: op.tipo || 'text', value: obj[k] ?? '', placeholder: op.ph || '', oninput: e => mudou(op.caixa ? e.target.value.toUpperCase() : e.target.value)});
  if (op.caixa) inp.style.textTransform = 'uppercase';
  if (op.ref) inp.dataset.ref = op.ref; else if (obj === o.campos) inp.dataset.k = k;
  return rot ? el('label', {class: op.cls || ''}, rot, inp) : inp;
}
function renderEditorOS(){
  const o = osAtual(); if (!o) return;
  const c = o.campos, M = db.manualRedacao, ex = M?.os?.modelo || {};
  $('#os-titulo-ed').textContent = epigrafeOS(c);
  const f = $('#os-form'); f.innerHTML = '';
  if (!M?.os) { f.append(el('div', {class: 'aviso', text: 'Importe o manual de redação para editar e gerar a O.S.'})); return; }
  const sec = (tit, ...filhos) => { const g = el('div', {class: 'aco-form'}, ...filhos); f.append(el('div', {class: 'of-sec'}, el('h4', {text: tit}), g)); return g; };
  sec('Cabeçalho', campoOS(o, c, 'cab1', 'Linha 1 (unidade de direção)', {cls: 'l3', caixa: true}), campoOS(o, c, 'cab2', 'Linha 2 (subunidade)', {cls: 'l3', caixa: true}));
  const setores = el('div', {class: 'of-setores'});
  for (let n = 0; n < 4; n++) setores.append(el('input', {value: (c.setores || [])[n] || '', placeholder: ['Ex.: P/3', 'Ex.: 8º BPM', '3º nível', '4º nível'][n], oninput: e => { c.setores = [...(c.setores || ['', '', '', ''])]; c.setores[n] = e.target.value; mudouOS(o); }}));
  sec('Epígrafe, local e data', campoOS(o, c, 'numero', 'Número', {ph: '001'}), campoOS(o, c, 'ano', 'Ano'), campoOS(o, c, 'sgd', 'SGD (opcional)', {ph: '2026/09039/000000'}),
    el('label', {class: 'l3'}, 'Seções que expedem (da menor para a maior, até 4)', setores, el('small', {class: 'dica', text: 'A barra dentro da sigla sai sozinha: P/3 → P3.'})),
    campoOS(o, c, 'cidade', 'Cidade'), campoOS(o, c, 'uf', 'UF'), campoOS(o, c, 'sep', 'Separador cidade/UF', {tipo: 'sel', op: [['–', 'Travessão: Paraíso do Tocantins – TO'], ['/', 'Barra: Paraíso do Tocantins/TO']]}), campoOS(o, c, 'data', 'Data', {tipo: 'date'}));
  sec('Difusão, evento, referência e anexos (sem numeração)',
    campoOS(o, c, 'aos', 'Aos: (funções de quem deve tomar conhecimento)', {cls: 'l3', ph: 'Ex.: ' + (ex.aos || 'Subcomandante, CPU e Comandante da 3ª Cia.')}),
    campoOS(o, c, 'evento', 'Evento', {cls: 'l3', tipo: 'area', linhas: 2, ph: 'Ex.: ' + (ex.evento || '')}),
    campoOS(o, c, 'referencia', 'Referência', {cls: 'l3', tipo: 'area', linhas: 2, ph: 'Ex.: ' + (ex.referencia || '')}),
    campoOS(o, c, 'anexos', 'Anexos (se não houver, fica fora do documento)', {cls: 'l3', ph: 'Ex.: ' + (ex.anexos || '')}));
  // itens
  const box = el('div', {class: 'os-itens'});
  (c.itens || []).forEach((it, i) => {
    const mover = d => { const j = i + d; if (j < 0 || j >= c.itens.length) return; [c.itens[i], c.itens[j]] = [c.itens[j], c.itens[i]]; mudouOS(o); renderEditorOS(); };
    const card = el('div', {class: 'os-item'},
      el('div', {class: 'os-item-cab'}, el('b', {class: 'os-num', text: `${i + 1}.`}),
        campoOS(o, it, 'titulo', '', {caixa: true, ph: 'TÍTULO DO ITEM', ref: `it:${i}:titulo`}),
        campoOS(o, it, 'tipo', '', {tipo: 'sel', op: [['sub', 'Subitens (rótulo | texto)'], ['texto', 'Texto corrido'], ['lig', 'Ligações (contato | número)']], depois: () => { it.linhas ||= []; if (it.tipo !== 'texto' && !it.linhas.length) it.linhas.push({rotulo: '', texto: ''}); renderEditorOS(); }}),
        el('button', {class: 'btn peq', title: 'Subir', text: '↑', onclick: () => mover(-1)}), el('button', {class: 'btn peq', title: 'Descer', text: '↓', onclick: () => mover(1)}),
        el('button', {class: 'btn peq perigo', title: 'Excluir item', text: '✕', onclick: () => { if (!confirm(`Excluir o item ${i + 1}. ${it.titulo}?`)) return; c.itens.splice(i, 1); mudouOS(o); renderEditorOS(); }})));
    if (it.tipo === 'texto') card.append(campoOS(o, it, 'texto', '', {tipo: 'area', linhas: 7, ref: `it:${i}:texto`, ph: 'Uma linha por parágrafo. Use a) b) c) para alíneas, - para subdivisões, **negrito**.'}));
    else {
      (it.linhas || []).forEach((L, k) => {
        const mv = d => { const j = k + d; if (j < 0 || j >= it.linhas.length) return; [it.linhas[k], it.linhas[j]] = [it.linhas[j], it.linhas[k]]; mudouOS(o); renderEditorOS(); };
        card.append(el('div', {class: 'os-sub'},
          el('span', {class: 'os-num', text: it.tipo === 'lig' ? '' : `${i + 1}.${k + 1}`}),
          campoOS(o, L, 'rotulo', '', {ph: it.tipo === 'lig' ? 'Contato' : 'Subitem', ref: `it:${i}:L:${k}:rotulo`}),
          campoOS(o, L, 'texto', '', {ref: `it:${i}:L:${k}:texto`, tipo: 'area', linhas: it.tipo === 'lig' ? 1 : Math.min(6, Math.max(2, (L.texto || '').split('\n').length + 1)), ph: it.tipo === 'lig' ? '(63) 99999-9999' : 'Texto (uma linha por parágrafo; a) b) para alíneas)'}),
          el('div', {class: 'os-sub-ac'}, el('button', {title: 'Subir', text: '↑', onclick: () => mv(-1)}), el('button', {title: 'Descer', text: '↓', onclick: () => mv(1)}), el('button', {title: 'Excluir', text: '✕', onclick: () => { it.linhas.splice(k, 1); mudouOS(o); renderEditorOS(); }}))));
      });
      card.append(el('button', {class: 'btn peq', text: it.tipo === 'lig' ? '+ Contato' : '+ Subitem', onclick: () => { it.linhas.push({rotulo: '', texto: ''}); mudouOS(o); renderEditorOS(); }}));
    }
    box.append(card);
  });
  box.append(el('button', {class: 'btn', text: '+ Novo item', onclick: () => { c.itens.push({titulo: 'NOVO ITEM', tipo: 'sub', linhas: [{rotulo: '', texto: ''}]}); mudouOS(o); renderEditorOS(); }}));
  f.append(el('div', {class: 'of-sec'}, el('h4', {text: 'Itens numerados'}), box));
  const g = sec('Assinatura (fora da tabela)', campoOS(o, c, 'assDigital', 'Assinatura digital', {tipo: 'chk', padrao: true}),
    campoOS(o, c, 'sigNome', 'Nome completo', {cls: 'l2', depois: () => chipsSigOS()}), campoOS(o, c, 'sigPosto', 'Posto e quadro', {caixa: true}),
    el('div', {class: 'l3 of-guerra-box'}, el('small', {class: 'dica', text: 'Clique no nome de guerra (sai em negrito):'}), el('div', {class: 'guerra', id: 'os-sig-guerra'})),
    campoOS(o, c, 'sigFuncao', 'Função', {cls: 'l2'}), campoOS(o, c, 'sigResp', 'Respondendo (Resp. p/)', {tipo: 'chk'}));
  sec('Rodapé (opcional)', campoOS(o, c, 'usarRodape', 'Incluir rodapé com endereço e contato', {tipo: 'chk', cls: 'l3', depois: () => renderEditorOS()}),
    ...(c.usarRodape ? [campoOS(o, c, 'rodape1', 'Linha 1', {cls: 'l3'}), campoOS(o, c, 'rodape2', 'Linha 2', {cls: 'l3'})] : []));
  chipsSigOS(); agendarPreviaOS(0);
  requestAnimationFrame(() => f.querySelectorAll('.os-item textarea').forEach(autoAltura));
}
function autoAltura(t){ t.style.height = 'auto'; t.style.height = Math.min(420, t.scrollHeight + 2) + 'px'; }
document.addEventListener('input', e => { if (e.target.matches?.('.os-item textarea')) autoAltura(e.target); });
function chipsSigOS(){
  const o = osAtual(), box = $('#os-sig-guerra'); if (!o || !box) return;
  const c = o.campos; box.innerHTML = '';
  (c.sigNome || '').trim().split(/\s+/).filter(Boolean).forEach((w, k) => box.append(el('span', {class: (c.sigGuerra || []).includes(k) ? 'on' : '', text: w, onclick: () => { const st = new Set(c.sigGuerra || []); st.has(k) ? st.delete(k) : st.add(k); c.sigGuerra = [...st].sort((a, b) => a - b); mudouOS(o); chipsSigOS(); }})));
}
function agendarPreviaOS(ms = 450){ clearTimeout(osPreviaTimer); osPreviaTimer = setTimeout(atualizarPreviaOS, ms); const o = osAtual(); if (o) $('#os-titulo-ed').textContent = epigrafeOS(o.campos); }
async function atualizarPreviaOS(){
  const o = osAtual(); if (!o || !db.manualRedacao?.os) return;
  const seq = ++osPreviaSeq, box = $('#os-previa'); box.classList.add('carregando');
  try {
    const r = await gerarBytesOS(o, {semTexto: true}); if (seq !== osPreviaSeq) return;
    osUltimoLayout = r;
    const cvs = await canvasesDoPdf(r.bytes, Math.max(280, box.clientWidth - 4));
    if (seq !== osPreviaSeq) return;
    previaEditavel(box, cvs, r.regioes, ADAPT_OS); $('#os-paginas').textContent = `${r.paginas} página(s)`;
  } catch (e){ console.error(e); box.innerHTML = ''; box.append(el('div', {class: 'aviso', text: 'Não consegui montar a prévia: ' + e.message})); }
  box.classList.remove('carregando');
  const itens = conferirOS(o), cb = $('#os-conf'); cb.innerHTML = '';
  const pend = itens.filter(x => !x.ok).length;
  $('#os-conf-res').textContent = pend ? `${pend} ponto(s) para ajustar` : 'Tudo conforme o manual'; $('#os-conf-res').className = 'tg ' + (pend ? 'av' : 'lib');
  itens.forEach(x => cb.append(el('li', {class: x.ok ? 'ok' : 'pend'}, el('i', {text: x.ok ? '✓' : '!'}), el('div', {}, el('b', {text: x.t}), el('small', {text: x.d || ''})))));
}
async function gerarPdfOS(){
  const o = osAtual(); if (!o) return;
  const pend = conferirOS(o).filter(x => !x.ok);
  if (pend.length && !confirm('Ainda há pontos fora do manual:\n\n' + pend.map(x => `• ${x.t}: ${x.d}`).join('\n') + '\n\nGerar o PDF assim mesmo?')) return;
  status('Gerando a Ordem de Serviço…', 'warn');
  try {
    const r = await gerarBytesOS(o), nome = nomeArquivoOS(o.campos);
    baixar(nome, r.bytes, 'application/pdf');
    let salvo = false;
    if (dirHandle){ try { const d1 = await dirHandle.getDirectoryHandle('ordens-de-servico', {create: true}), d2 = await d1.getDirectoryHandle(o.campos.ano || hojeISO().slice(0, 4), {create: true}); const w = await (await d2.getFileHandle(nome, {create: true})).createWritable(); await w.write(r.bytes); await w.close(); salvo = true; } catch (e){ console.warn(e); } }
    o.ultimoPdf = new Date().toISOString(); o.alteradoEm = o.ultimoPdf; agendarSalvar();
    registrar('pdf', `gerou a ${epigrafeOS(o.campos)}${o.campos.evento ? ' – ' + o.campos.evento.replace(/\*\*/g, '') : ''}`);
    status(salvo ? `PDF baixado e salvo em ordens-de-servico/${o.campos.ano}` : 'PDF baixado', 'ok');
  } catch (e){ console.error(e); alert('Erro ao gerar o PDF: ' + e.message); status('Erro ao gerar o PDF', 'err'); }
}
function exemploNaOS(){
  const o = osAtual(), ex = db.manualRedacao?.os?.modelo; if (!o || !ex) return;
  if (!confirm('Preencher com o exemplo do manual? Difusão, evento, referência, anexos e todos os itens serão substituídos pelo modelo do manual.')) return;
  const c = o.campos; c.ov = {}; ['aos', 'evento', 'referencia', 'anexos'].forEach(k => c[k] = ex[k] || '');
  c.itens = JSON.parse(JSON.stringify(ex.itens)).map(it => ({...it, linhas: it.linhas || []}));
  mudouOS(o, false); renderEditorOS();
}
$('#os-voltar').onclick = () => { osAtualId = null; renderOS(); };
$('#os-pdf').onclick = gerarPdfOS;
$('#os-exemplo').onclick = exemploNaOS;
$('#os-numero-auto').onclick = () => { const o = osAtual(); if (!o) return; o.campos.numero = proximoNumeroOS(o.campos, o.id); mudouOS(o, false); renderEditorOS(); };
$('#os-duplicar').onclick = () => { const o = osAtual(); if (o) novaOS(o.campos); };
$('#os-excluir').onclick = () => { const o = osAtual(); if (!o || !confirm(`Excluir a ${epigrafeOS(o.campos)}? Não dá para desfazer.`)) return; db.ordensServico = db.ordensServico.filter(x => x !== o); registrar('exclusao', `excluiu a ${epigrafeOS(o.campos)}`); osAtualId = null; agendarSalvar(); renderOS(); };
window.addEventListener('resize', () => { if (viewAtual === 'os' && osAtual()) agendarPreviaOS(300); });

/* ================= MODELOS DO MANUAL — editor e PDF fiéis ao modelo ================= */
let dmCat = 'relatorios', dmAtualId = null, dmPreviaSeq = 0, dmPreviaTimer = null, dmUltimo = null;
const dmAtual = () => (db.docsManual || []).find(o => o.id === dmAtualId);
const semMarca = s => String(s || '').replace(/\*\*|\+\+|\*/g, '').replace(/∗/g, '*');
const NOME_CAT = k => { const p = CAT_PROC.find(c => c[0] === k); return p ? `${p[2]} · ${p[1]}` : (CAT_DOCM.find(c => c[0] === k) || [, k])[1]; };
const tituloModelo = t => t.toLowerCase().replace(/(^|\s|\()(\S)/g, (m, a, b) => a + b.toUpperCase()).replace(/(?<=\s)(De|Do|Da|E|Para|Dos|Das|Ou|Com|A|O|Ao|À|Em|No|Na|Por|Pela|Pelo)(?=\s)/g, m => m.toLowerCase());
function nomeDocM(o){
  if (ehCatProc(o.cat)){
    // peça do procedimento: nome da peça + número do processo, se preenchido
    const proc = (o.blocos || []).map(b => b.t === 'p' ? semMarca(b.txt).trim() : '').find(t => /^(SINDIC[ÂA]NCIA|CONSELHO DE)\b.*N[º°]\s*\S*\d/i.test(t));
    return tituloModelo(o.modelo) + (proc ? ' — ' + proc.replace(/\s+/g, ' ') : '');
  }
  const b = (o.blocos || []).find(x => x.t === 'p' && !x.img && x.txt.trim() && (x.jc === 'c' || /n[º°]\s*\d/i.test(x.txt)) && /\*\*/.test(x.txt) && semMarca(x.txt).length < 140);
  return semMarca(b?.txt || '').trim() || tituloModelo(o.modelo);
}

/* ---------- PDF ---------- */
async function gerarBytesDocM(o, {semTexto} = {}){
  const {PDFDocument, StandardFonts, rgb, PDFOperator, PDFNumber, pushGraphicsState, popGraphicsState} = await carregarPdfLib();
  const M = db.manualRedacao, R = k => regraOf(k);
  const doc = await PDFDocument.create();
  doc.setTitle(nomeDocM(o)); doc.setCreator('Sistema de Gestão de Ensino');
  const FN = {r: await doc.embedFont(StandardFonts.Helvetica), b: await doc.embedFont(StandardFonts.HelveticaBold), i: await doc.embedFont(StandardFonts.HelveticaOblique), bi: await doc.embedFont(StandardFonts.HelveticaBoldOblique)};
  const fonte = sg => FN[(sg.b ? 'b' : '') + (sg.i ? 'i' : '') || 'r'];
  const ok = (t, f) => [...String(t ?? '')].map(ch => { try { f.widthOfTextAtSize(ch, 10); return ch; } catch { return ch === '∗' ? '*' : /[✓✔☑]/.test(ch) ? '•' : /[\u2010\u2011\u2012]/.test(ch) ? '-' : '?'; } }).join('');
  const larg = (t, f, s, esc = 1) => [...ok(t, f)].reduce((a, ch) => a + f.widthOfTextAtSize(ch, s), 0) * esc;
  const PRETO = rgb(0, 0, 0);
  const W = 595.28, H = 841.89, mL = R('mEsq') * CM, mR = R('mDirSup') * CM, mT = R('mDirSup') * CM, mB = R('mInf') * CM, area = W - mL - mR, limite = H - mB;
  const LHs = s => s * 1.149, TAB = 1.25 * CM;
  const altLinha = (p, s) => p.lr === 'exact' ? p.ln / 20 : p.lr === 'atLeast' ? Math.max(LHs(s), p.ln / 20) : LHs(s) * (p.ln || 240) / 240;
  let img = null, imgW = 0; const hImg = R('brasaoAltura') * CM;
  const brasao = M?.brasao || LOGO;   // sem o manual de redação importado, usa o brasão da PMTO do sistema
  if (brasao){ const bytes = Uint8Array.from(atob(brasao.split(',')[1]), ch => ch.charCodeAt(0)); img = /image\/png/.test(brasao) ? await doc.embedPng(bytes) : await doc.embedJpg(bytes); imgW = img.width * hImg / img.height; }
  const texto = (pg, t, x, base, s, sg, esc) => {
    const f = fonte(sg), tt = ok(t, f);
    if (esc !== 1){ pg.pushOperators(pushGraphicsState(), PDFOperator.of('Tz', [PDFNumber.of(esc * 100)])); pg.drawText(tt, {x, y: base, size: s, font: f, color: PRETO}); pg.pushOperators(popGraphicsState()); }
    else pg.drawText(tt, {x, y: base, size: s, font: f, color: PRETO});
    const w = larg(tt, f, s, esc);
    if (sg.u && tt.trim()) pg.drawLine({start: {x, y: base - s * 0.12}, end: {x: x + w, y: base - s * 0.12}, thickness: s * 0.06, color: PRETO});
    return w;
  };
  // um parágrafo vira caixas de linha {h, draw(pg, top, x0)}
  const linhasDe = (p, largura) => {
    if (p.img) return [{h: hImg + p.sz * 0.212, draw: (pg, top, x0) => { if (!img) return; const x = p.jc === 'c' ? x0 + (largura - imgW) / 2 : p.jc === 'r' ? x0 + largura - imgW : x0 + (p.il || 0) / 20; pg.drawImage(img, {x, y: H - top - hImg, width: imgW, height: hImg}); }}];
    const s = p.sz || 12, esc = p.n ? 0.82 : 1, lh = altLinha(p, s);
    const il = (p.il || 0) / 20, ir = (p.ir || 0) / 20, fl = (p.fl || 0) / 20;
    const segs = trechosOf(p.txt || '');
    // tokens: palavras (com estilos), espaço, tab, quebra
    const toks = []; let w = [];
    const fecha = () => { if (w.length){ toks.push({t: 'w', segs: w}); w = []; } };
    segs.forEach(sg => sg.t.split(/(\t|\n| +)/).forEach(part => { if (!part) return; if (part === '\t'){ fecha(); toks.push({t: 'tab'}); } else if (part === '\n'){ fecha(); toks.push({t: 'br'}); } else if (/^ +$/.test(part)){ fecha(); toks.push({t: 'sp', n: part.length}); } else w.push({...sg, t: part}); }));
    fecha();
    const sp = larg(' ', FN.r, s, esc);
    const lw = segsW => segsW.reduce((a, sg) => a + larg(sg.t, fonte(sg), s, esc), 0);
    // rótulo da numeração
    const rot = p.rot ? {segs: [{t: p.rot, b: /^\*\*/.test(p.txt)}]} : null;
    const linhas = []; let atual = {itens: [], w: 0, tab: false, forcada: false}, primeira = true;
    const ini = () => primeira ? fl : 0;
    const maxW = () => largura - il - ir - (primeira ? fl : 0);
    const nova = forcada => { atual.forcada = forcada; linhas.push(atual); atual = {itens: [], w: 0, tab: false}; primeira = false; };
    if (rot){ // rótulo na posição da 1ª linha; o texto vai para o recuo (como a tabulação do Word)
      const rw = lw(rot.segs);
      atual.itens.push({k: 'rot', segs: rot.segs, x: 0}); atual.w = fl < 0 ? Math.max(-fl, rw + sp) : rw + sp; atual.tab = true;
    }
    toks.forEach(tk => {
      if (tk.t === 'br'){ nova(true); return; }
      if (tk.t === 'tab'){ const abs = il + ini() + atual.w; const prox = (Math.floor(abs / TAB) + 1) * TAB; atual.w = prox - il - ini(); atual.tab = true; return; }
      if (tk.t === 'sp'){ if (atual.itens.length) atual.itens.push({k: 'sp', n: tk.n}); atual.w += sp * tk.n; return; }
      const ww = lw(tk.segs);
      if (atual.itens.some(x => x.k === 'w') && atual.w + ww > maxW() + 0.01){
        while (atual.itens.length && atual.itens[atual.itens.length - 1].k === 'sp'){ atual.w -= sp * atual.itens.pop().n; }
        nova(false);
      }
      atual.itens.push({k: 'w', segs: tk.segs, x: atual.w, w: ww}); atual.w += ww;
    });
    linhas.push(atual);
    return linhas.map((ln, n) => ({h: lh, draw: (pg, top, x0) => {
      const base = H - (top + lh - LHs(s) + s * 0.905);
      const xIni = x0 + il + (n === 0 ? fl : 0), maxL = largura - il - ir - (n === 0 ? fl : 0);
      const ws = ln.itens.filter(x => x.k === 'w');
      const natural = ln.w;
      let desloc = 0, extra = 0;
      if (p.jc === 'c') desloc = (maxL - natural) / 2; else if (p.jc === 'r') desloc = maxL - natural;
      else if (p.jc === 'j' && n < linhas.length - 1 && !ln.forcada && !ln.tab && ws.length > 1) extra = (maxL - natural) / (ws.length - 1);
      let k = 0;
      ln.itens.forEach(it => {
        if (it.k === 'rot'){ let x = xIni + desloc; it.segs.forEach(sg => { x += texto(pg, sg.t, x, base, s, sg, esc); }); return; }
        if (it.k !== 'w') return;
        let x = xIni + desloc + it.x + extra * k; k++;
        it.segs.forEach(sg => { x += texto(pg, sg.t, x, base, s, sg, esc); });
        if (it.segs.some(sg => sg.u)){ /* sublinhado contínuo entre palavras sublinhadas */ const nx = ln.itens[ln.itens.indexOf(it) + 1], prox = ln.itens[ln.itens.indexOf(it) + 2]; if (nx?.k === 'sp' && prox?.k === 'w' && prox.segs[0].u && it.segs[it.segs.length - 1].u) pg.drawLine({start: {x, y: base - s * 0.12}, end: {x: x + sp * nx.n + extra, y: base - s * 0.12}, thickness: s * 0.06, color: PRETO}); }
      });
    }}));
  };
  const parCaixas = (p, largura) => { const out = []; if (p.sb) out.push({h: p.sb, gap: true}); linhasDe(p, largura).forEach(l => out.push(l)); if (p.sa) out.push({h: p.sa, gap: true}); return out; };
  // ----- paginação
  const paginas = [], regioes = []; let pg, y;
  const novaPagina = () => { pg = doc.addPage([W, H]); paginas.push(pg); y = mT; };
  const reg = (top, x, w, h, ref, p) => { const s = p.sz || 12; regioes.push({p: paginas.length - 1, x, y: top, w, h, ref, s, lh: altLinha(p, s), jc: p.jc, il: (p.il || 0) / 20, ir: (p.ir || 0) / 20, fl: (p.fl || 0) / 20, n: !!p.n}); };
  novaPagina();
  const linhaH = (x1, x2, yy, w = 0.5) => pg.drawLine({start: {x: x1, y: H - yy}, end: {x: x2, y: H - yy}, thickness: w, color: PRETO});
  const linhaV = (x, y1, y2, w = 0.5) => pg.drawLine({start: {x, y: H - y1}, end: {x, y: H - y2}, thickness: w, color: PRETO});
  (o.blocos || []).forEach((b, bi) => {
    if (b.pb && bi > 0) novaPagina();
    if (b.t === 'p'){
      parCaixas(b, area).forEach(c => {
        if (y + c.h > limite + 0.5 && !c.gap){ novaPagina(); }
        if (c.gap && y === mT && paginas.length > 1) return;
        if (c.draw){ if (b.img || !semTexto) c.draw(pg, y, mL); if (!b.img) reg(y, mL, area, c.h, 'b:' + bi, b); }
        y += c.h;
      });
      return;
    }
    // ----- tabela
    const cols = b.cols.map(w => w / 20), TWt = cols.reduce((a, w) => a + w, 0), pad = (b.pad ?? 108) / 20;
    let x0 = mL + (b.ind || 0) / 20 - pad;
    if (b.jc === 'center') x0 = mL + (area - TWt) / 2;
    const nRows = b.rows.length;
    // prepara células: posição, largura e conteúdo
    const prep = b.rows.map(r => { let gi = r.antes || 0; return r.cells.map(c => { const x = x0 + cols.slice(0, gi).reduce((a, w) => a + w, 0), w = cols.slice(gi, gi + c.span).reduce((a, w) => a + w, 0), g = gi; gi += c.span; const caixas = c.vm === 'c' ? [] : c.ps.flatMap((p, pi) => parCaixas(p, w - 2 * pad).map(cx => ({...cx, pi}))); return {c, x, w, g, caixas, h: caixas.reduce((a, k) => a + k.h, 0)}; }); });
    prep.forEach((cels, ri) => {
      const r = b.rows[ri];
      let hRow = Math.max(r.h || 0, ...cels.filter(k => !(k.c.vm === 'r' && b.rows[ri + 1]?.cells.some(x => x.vm === 'c'))).map(k => k.h), 1);
      if (r.hr === 'exact' && r.h) hRow = r.h;
      if (y + hRow > limite + 0.5 && hRow < limite - mT) novaPagina();
      const topo = y;
      cels.forEach(k => {
        if (k.c.fill) pg.drawRectangle({x: k.x, y: H - topo - hRow, width: k.w, height: hRow, color: (() => { const h = k.c.fill.slice(1); return rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255); })()});
        let yy = topo + (k.c.va === 'center' ? Math.max(0, (hRow - k.h) / 2) : k.c.va === 'bottom' ? Math.max(0, hRow - k.h) : 0);
        k.caixas.forEach(cx => { if (cx.draw){ if (!semTexto) cx.draw(pg, yy, k.x + pad); reg(yy, k.x + pad, k.w - 2 * pad, cx.h, `t:${bi}:${ri}:${r.cells.indexOf(k.c)}:${cx.pi}`, k.c.ps[cx.pi]); } yy += cx.h; });
        // bordas
        const ultCol = k.g + k.c.span >= cols.length, primCol = k.g === 0;
        const tem = (lado, padrao) => k.c.bord[lado] ?? padrao;
        if (tem('top', ri === 0 ? b.bord.top : b.bord.insideH) && k.c.vm !== 'c') linhaH(k.x, k.x + k.w, topo);
        const proxCont = b.rows[ri + 1]?.cells.find((x, j) => prep[ri + 1][j]?.g === k.g)?.vm === 'c';
        if (tem('bottom', ri === nRows - 1 ? b.bord.bottom : b.bord.insideH) && !proxCont) linhaH(k.x, k.x + k.w, topo + hRow);
        if (tem('left', primCol ? b.bord.left : b.bord.insideV)) linhaV(k.x, topo, topo + hRow);
        if (tem('right', ultCol ? b.bord.right : b.bord.insideV)) linhaV(k.x + k.w, topo, topo + hRow);
      });
      y = topo + hRow;
    });
  });
  return {bytes: await doc.save(), paginas: paginas.length, regioes: juntarRegioes(regioes)};
}

/* ---------- conferência ---------- */
function conferirDocM(o){
  const itens = [], add = (ok, t, d) => itens.push({ok, t, d});
  const todo = (o.blocos || []).flatMap(b => b.t === 'p' ? [b.txt] : b.rows.flatMap(r => r.cells.flatMap(c => c.ps.map(p => p.txt))));
  const txt = semMarca(todo.join('\n'));
  if (ehCatProc(o.cat)) return conferirProc(o, txt, add, itens);
  const M = db.manualRedacao, R = M.regras;
  add(true, 'Formatação do modelo do manual', `cada parágrafo e tabela segue o modelo “${tituloModelo(o.modelo)}” do manual · ${R.fonte.valor} · margens ${R.mEsq.valor} / ${R.mDirSup.valor} / ${R.mDirSup.valor} / ${R.mInf.valor} cm`);
  const fict = [...new Set((txt.match(/\b(Fulano|Beltrano|Sicrano|Fulana|Beltrana)\b/gi) || []).map(x => x.toLowerCase()))];
  add(!fict.length, 'Nomes do exemplo trocados', fict.length ? 'ainda tem nome de exemplo: ' + fict.join(', ') : 'nenhum “Fulano/Beltrano” do modelo');
  const ret = (txt.match(/\[\.\.\.\]|\[…\]/g) || []).length;
  add(!ret, 'Trechos “[...]” do modelo', ret ? `${ret} trecho(s) “[...]” para completar` : 'nenhum trecho para completar');
  const m = norm(o.modelo);
  if (/^ATESTADO/.test(m)) add(/\*\*\s*Atest/i.test(todo.join('\n')), 'Verbo “Atestar” em negrito', 'o manual pede o verbo atestar em negrito e o texto por extenso');
  if (/^DECLARA/.test(m)) add(/\*\*\s*Declar/i.test(todo.join('\n')), 'Verbo “Declarar” em negrito', 'mesmo padrão do Atestado');
  if (/^CERTID/.test(m)) add(/dou f[ée]|firmo a presente certid/i.test(txt), 'Fórmula de certificação', '“O referido é verdade e dou fé.” ou “Por ser verdade, firmo a presente Certidão.”');
  if (/^ATA\b/.test(m)) add(!/\d{2}\/\d{2}\/\d{4}/.test(txt.split('\n').slice(4).join(' ')), 'Números e datas por extenso', 'na Ata, números, datas e valores vão por extenso (menos no título)');
  if (dmUltimo) add(true, 'Páginas', `${dmUltimo.paginas} página(s)`);
  return itens;
}

/* conferência das peças do MPPADMIS */
function conferirProc(o, txt, add, itens){
  const d = modeloDoc(o);
  add(true, 'Formatação do modelo do MPPADMIS', `peça “${tituloModelo(o.modelo)}” (pág. ${d?.pag || '?'}) · ${regraOf('fonte')} ${regraOf('corpo')} · margens ${regraOf('mEsq')} / ${regraOf('mDirSup')} / ${regraOf('mDirSup')} / ${regraOf('mInf')} cm · cabeçalho com brasão`);
  const un = /UNIDADE MILITAR/.test(txt);
  add(!un, 'Nome da unidade no cabeçalho', un ? 'troque “UNIDADE MILITAR” pelo nome da sua unidade' : 'cabeçalho com o nome da unidade');
  const lac = (txt.match(/_{3,}/g) || []).length;
  add(!lac, 'Lacunas “___” preenchidas', lac ? `${lac} lacuna(s) “___” ainda em branco (número, data, hora, fls.)` : 'nenhuma lacuna em branco');
  const instr = [...new Set((txt.match(/\((?:citar|narra|nome|posto|local e data|mencionar|relatar|fazer|informar|constar|transcrever|data|n[º°]|quando|caso|se for|ou\b)[^)]{0,60}\)?/gi) || []).map(x => x.slice(0, 40)))];
  add(!instr.length, 'Orientações do modelo trocadas pelo texto', instr.length ? `${instr.length} orientação(ões) entre parênteses ainda no texto, ex.: ${instr.slice(0, 2).join(' · ')}` : 'nenhuma orientação “(citar…)”, “(nome…)” sobrando');
  const ex = /\bEx\.\s*0\d|\bExemplo:/i.test(txt);
  if (ex) add(false, 'Exemplos do manual', 'o modelo traz exemplos (“Ex. 01”, “Exemplo:”): mantenha só o que se aplica ao caso');
  add(/\b(19|20)\d{2}\b/.test(txt) && !/_{2,}\/_{2,}/.test(txt), 'Data preenchida', 'local e data no fecho da peça');
  if (dmUltimo) add(true, 'Páginas', `${dmUltimo.paginas} página(s)`);
  return itens;
}

/* ---------- telas ---------- */
function renderDocM(){
  db.docsManual ||= [];
  const M = db.manualRedacao, o = dmAtual();
  $('#titulo-view').textContent = NOME_CAT(dmCat);
  $('#dm-inicio').hidden = !!o; $('#dm-editor').hidden = !o;
  if (o) return renderEditorDocM();
  const box = $('#dm-modelos'); box.innerHTML = '';
  $('#dm-cat-tit').textContent = NOME_CAT(dmCat);
  const proc = ehCatProc(dmCat);
  $('#sub-view').textContent = proc ? 'Procedimentos · Manual de Processos e Procedimentos Administrativos (MPPADMIS)' : VIEWS.docm[1];
  $('#dm-inicio-dica').textContent = proc ? 'Modelos do Manual de Processos e Procedimentos Administrativos (MPPADMIS) da PMTO. Escolha a peça, preencha e gere o PDF com o cabeçalho e a formatação do modelo.' : 'Escolha o modelo do manual, edite os textos e gere o PDF com a formatação do manual.';
  if (proc){
    const g = el('div', {class: 'aco-opcoes of-opcoes'});
    procModelos().filter(d => d.cat === dmCat).forEach(d => {
      const resumo = (d.regras.filter(t => t.length > 60).slice(-1)[0] || 'Modelo do MPPADMIS.');
      g.append(el('button', {class: 'aco-op of-op', onclick: () => novoDocM(d.id)},
        el('div', {class: 'ic', text: '⚖'}), el('div', {}, el('b', {text: tituloModelo(d.titulo)}), el('span', {text: `MPPADMIS, pág. ${d.pag} · ` + resumo.slice(0, 130) + (resumo.length > 130 ? '…' : '')}))));
    });
    box.append(g);
  }
  else if (!M) box.append(el('div', {class: 'aviso'}, el('span', {text: 'Importe o Manual de Redação Oficial em Ofícios: os modelos vêm dele.'}), el('button', {class: 'btn peq pri', text: 'Ir para Ofícios', onclick: () => irPara('oficio')})));
  else if (!M.docs?.length) box.append(el('div', {class: 'aviso'}, el('span', {text: 'O manual foi importado numa versão anterior do sistema. Importe-o de novo uma vez para liberar estes modelos.'}), el('button', {class: 'btn peq pri', text: 'Importar o manual de novo', onclick: () => $('#of-man-arq').click()})));
  else {
    const mods = M.docs.filter(d => catDe(d.titulo) === dmCat);
    const g = el('div', {class: 'aco-opcoes of-opcoes'});
    mods.forEach(d => g.append(el('button', {class: 'aco-op of-op', onclick: () => novoDocM(d.id)},
      el('div', {class: 'ic', text: '📄'}), el('div', {}, el('b', {text: tituloModelo(d.titulo)}), el('span', {text: (d.regras[0] || 'Modelo do apêndice do manual.').slice(0, 150) + ((d.regras[0] || '').length > 150 ? '…' : '')})))));
    box.append(g);
  }
  const lb = $('#dm-lista'); lb.innerHTML = '';
  const lista = db.docsManual.filter(x => catDoc(x) === dmCat && meuOficio(x)).sort((a, b) => (b.alteradoEm || '').localeCompare(a.alteradoEm || ''));
  if (!lista.length) lb.append(el('div', {class: 'vazio', text: 'Nenhum documento ainda. Escolha um modelo acima.'}));
  lista.forEach(x => lb.append(el('div', {class: 'linha'},
    el('div', {class: 'ic-arq', style: 'background:var(--navy2)', text: 'DOC'}),
    el('div', {class: 'nm'}, el('b', {text: nomeDocM(x)}), el('small', {text: [tituloModelo(x.modelo), new Date(x.alteradoEm).toLocaleString('pt-BR'), ehAdmin() && x.autor ? 'por ' + x.autor : '', x.ultimoPdf ? 'PDF gerado' : 'rascunho'].filter(Boolean).join(' · ')})),
    el('button', {class: 'btn peq', text: 'Abrir', onclick: () => { dmAtualId = x.id; dmUltimo = null; renderDocM(); }}))));
}
function novoDocM(idModelo){
  const d = /^p\d+$/.test(idModelo) ? procModelos().find(x => x.id === idModelo) : db.manualRedacao?.docs?.find(x => x.id === idModelo); if (!d) return;
  const blocos = JSON.parse(JSON.stringify(d.blocos));
  // cabeçalho: as linhas da unidade logo abaixo do brasão passam a ser as da sua unidade
  const ult = [...(db.oficios || []), ...(db.ordensServico || [])].filter(x => x.autorId === P.perfilId).sort((a, b) => (b.alteradoEm || '').localeCompare(a.alteradoEm || ''))[0]?.campos || OF_PADRAO;
  const iImg = blocos.findIndex(b => b.img);
  if (d.proc){
    // o modelo do MPPADMIS traz "UNIDADE MILITAR": entra o nome da sua unidade
    const un = blocos.find(b => b.t === 'p' && /^\**UNIDADE MILITAR\**$/.test(b.txt.trim()));
    if (un && (ult.cab2 || '').trim()) un.txt = `**${ult.cab2.trim()}**`;
  }
  else if (iImg >= 0){
    const cab = []; for (let i = iImg + 1; i < blocos.length && cab.length < 3; i++){ const b = blocos[i]; if (b.t !== 'p' || b.jc !== 'c' || !b.txt.trim() || semMarca(b.txt) !== semMarca(b.txt).toUpperCase()) break; cab.push(b); }
    const novas = [ult.cab1, ult.cab2].filter(x => (x || '').trim());
    if (cab.length && novas.length){ cab.forEach((b, k) => { b.txt = novas[k] ?? ''; }); if (novas.length > cab.length){ const i = blocos.indexOf(cab[cab.length - 1]); blocos.splice(i + 1, 0, {...cab[cab.length - 1], txt: novas[cab.length]}); } }
  }
  const o = {id: uid(), modelo: d.titulo, modeloId: d.id, cat: d.cat || catDe(d.titulo), autorId: P.perfilId, autor: perfilAtual().nome || '', criadoEm: new Date().toISOString(), alteradoEm: new Date().toISOString(), blocos};
  db.docsManual.push(o); registrar('docm', `começou um documento: ${tituloModelo(d.titulo)}`); agendarSalvar();
  dmAtualId = o.id; dmUltimo = null; renderDocM(); $('.conteudo').scrollTop = 0;
}
function mudouDocM(o, prev = true){ o.alteradoEm = new Date().toISOString(); agendarSalvar(); if (prev) agendarPreviaDocM(); }
const incRotulo = r => { if (!r) return r; let m;
  if ((m = /^(\d+)([.)]?)$/.exec(r))) return (+m[1] + 1) + m[2];
  if ((m = /^([a-z])([.)])$/.exec(r))) return String.fromCharCode(m[1].charCodeAt(0) + 1) + m[2];
  if ((m = /^([A-Z])([.)])$/.exec(r))) return String.fromCharCode(m[1].charCodeAt(0) + 1) + m[2];
  if ((m = /^(\d+(?:\.\d+)*)\.(\d+)([.)]?)$/.exec(r))) return `${m[1]}.${+m[2] + 1}${m[3]}`;
  return r; };
function campoTexto(o, obj, k, estilo = {}, ref){
  const t = el('textarea', {rows: 1, value: obj[k] || '', class: 'dm-txt', oninput: e => { obj[k] = e.target.value; autoAltura(e.target); mudouDocM(o); }});
  if (ref) t.dataset.ref = ref;
  Object.assign(t.style, estilo);
  return t;
}
function renderEditorDocM(){
  const o = dmAtual(); if (!o) return;
  $('#dm-modelo-ed').textContent = tituloModelo(o.modelo);
  $('#dm-titulo-ed').textContent = nomeDocM(o);
  const f = $('#dm-form'); f.innerHTML = '';
  const reg = modeloDoc(o)?.regras || [];
  $('#dm-regras-box summary').textContent = ehCatProc(o.cat) ? 'O que o MPPADMIS diz sobre esta peça' : 'O que o manual diz sobre este documento';
  $('#dm-regras').innerHTML = ''; reg.forEach(t => $('#dm-regras').append(el('p', {text: t})));
  $('#dm-regras-box').hidden = !reg.length;
  o.blocos.forEach((b, i) => {
    const acoes = el('div', {class: 'dm-ac'},
      b.t === 'p' && !b.img ? el('button', {title: 'Novo parágrafo abaixo, com a mesma formatação', text: '+', onclick: () => { const nb = JSON.parse(JSON.stringify(b)); nb.txt = ''; delete nb.pb; nb.rot = incRotulo(b.rot); o.blocos.splice(i + 1, 0, nb); mudouDocM(o); renderEditorDocM(); }}) : '',
      el('button', {title: 'Subir', text: '↑', onclick: () => { if (!i) return; [o.blocos[i - 1], o.blocos[i]] = [o.blocos[i], o.blocos[i - 1]]; mudouDocM(o); renderEditorDocM(); }}),
      el('button', {title: 'Descer', text: '↓', onclick: () => { if (i === o.blocos.length - 1) return; [o.blocos[i + 1], o.blocos[i]] = [o.blocos[i], o.blocos[i + 1]]; mudouDocM(o); renderEditorDocM(); }}),
      el('button', {title: 'Excluir', class: 'x', text: '✕', onclick: () => { o.blocos.splice(i, 1); mudouDocM(o); renderEditorDocM(); }}));
    let linha;
    if (b.t === 'p' && b.img) linha = el('div', {class: 'dm-bl dm-img'}, el('span', {text: ehCatProc(o.cat) ? '🛡 Brasão da PMTO (cabeçalho)' : '🛡 Brasão do cabeçalho (do manual)'}), acoes);
    else if (b.t === 'p' && !b.txt.trim() && b.rot === undefined) linha = el('div', {class: 'dm-bl dm-vazio'}, el('span', {text: 'linha em branco'}), el('button', {class: 'dm-escrever', text: 'escrever aqui', onclick: () => { b.txt = ' '; renderEditorDocM(); }}), acoes);
    else if (b.t === 'p'){
      const negrito = /^\*\*[\s\S]*\*\*$/.test(b.txt.trim());
      linha = el('div', {class: 'dm-bl', style: `padding-left:${Math.min(80, ((b.il || 0) + Math.max(0, b.fl || 0)) / 20 / 2)}px`},
        b.rot !== undefined ? el('input', {class: 'dm-rot', value: b.rot, title: 'Numeração', oninput: e => { b.rot = e.target.value; mudouDocM(o); }}) : '',
        campoTexto(o, b, 'txt', {textAlign: b.jc === 'c' ? 'center' : b.jc === 'r' ? 'right' : 'left', fontWeight: negrito ? '700' : '400'}, 'b:' + i), acoes);
    } else {
      const tb = el('table', {class: 'dm-tab'});
      b.rows.forEach((r, ri) => {
        const tr = el('tr', {});
        r.cells.forEach((c, ci) => { if (c.vm === 'c') return; const td = el('td', {colspan: c.span, style: c.fill ? `background:${c.fill}33` : ''});
          if (c.vm === 'r'){ let n = 1; for (let k = ri + 1; k < b.rows.length; k++){ if (b.rows[k].cells.some(x => x.vm === 'c')) n++; else break; } td.rowSpan = n; }
          c.ps.forEach((p, pi) => td.append(campoTexto(o, p, 'txt', {textAlign: p.jc === 'c' ? 'center' : p.jc === 'r' ? 'right' : 'left'}, `t:${i}:${ri}:${ci}:${pi}`))); tr.append(td); });
        tb.append(tr);
      });
      linha = el('div', {class: 'dm-bl dm-tbl'}, el('div', {class: 'dm-tab-box'}, tb,
        el('div', {class: 'dm-tab-ac'}, el('button', {class: 'btn peq', text: '+ Linha', onclick: () => { const ult = b.rows[b.rows.length - 1], nr = JSON.parse(JSON.stringify(ult)); nr.cells.forEach(c => { c.vm = c.vm === 'r' ? '' : c.vm === 'c' ? '' : c.vm; c.ps = c.ps.slice(0, 1).map(p => ({...p, txt: ''})); }); b.rows.push(nr); mudouDocM(o); renderEditorDocM(); }}),
          b.rows.length > 1 ? el('button', {class: 'btn peq', text: '− Última linha', onclick: () => { b.rows.pop(); mudouDocM(o); renderEditorDocM(); }}) : '')), acoes);
    }
    f.append(linha);
  });
  requestAnimationFrame(() => f.querySelectorAll('textarea.dm-txt').forEach(autoAltura));
  agendarPreviaDocM(0);
}
function agendarPreviaDocM(ms = 450){ clearTimeout(dmPreviaTimer); dmPreviaTimer = setTimeout(atualizarPreviaDocM, ms); const o = dmAtual(); if (o) $('#dm-titulo-ed').textContent = nomeDocM(o); }
async function atualizarPreviaDocM(){
  const o = dmAtual(); if (!o) return;
  const seq = ++dmPreviaSeq, box = $('#dm-previa'); box.classList.add('carregando');
  try {
    const r = await gerarBytesDocM(o, {semTexto: true}); if (seq !== dmPreviaSeq) return;
    dmUltimo = r;
    const cvs = await canvasesDoPdf(r.bytes, Math.max(280, box.clientWidth - 4));
    if (seq !== dmPreviaSeq) return;
    previaEditavel(box, cvs, r.regioes, ADAPT_DOCM); $('#dm-paginas').textContent = `${r.paginas} página(s)`;
  } catch (e){ console.error(e); box.innerHTML = ''; box.append(el('div', {class: 'aviso', text: 'Não consegui montar a prévia: ' + e.message})); }
  box.classList.remove('carregando');
  const itens = conferirDocM(o), cb = $('#dm-conf'); cb.innerHTML = '';
  const pend = itens.filter(x => !x.ok).length;
  $('#dm-conf-res').textContent = pend ? `${pend} ponto(s) para ajustar` : 'Tudo conforme o manual'; $('#dm-conf-res').className = 'tg ' + (pend ? 'av' : 'lib');
  itens.forEach(x => cb.append(el('li', {class: x.ok ? 'ok' : 'pend'}, el('i', {text: x.ok ? '✓' : '!'}), el('div', {}, el('b', {text: x.t}), el('small', {text: x.d || ''})))));
}
/* edição direto na prévia: Documentos e Procedimentos */
const ADAPT_DOCM = {
  alvo(ref){ const o = dmAtual(), m = String(ref).split(':'), b = o?.blocos[+m[1]]; if (!b) return null; return m[0] === 'b' ? b : b.rows?.[+m[2]]?.cells?.[+m[3]]?.ps?.[+m[4]]; },
  ler(ref){ const p = this.alvo(ref); if (!p || p.img) return null; const par = ref[0] === 'b';
    return {txt: p.txt, rot: p.rot, podeExcluir: par, podeNovo: par, podeJuntar: par, quebra: !par}; },
  gravar(ref, txt){ const p = this.alvo(ref); if (!p) return; p.txt = txt; const inp = $('#dm-form').querySelector(`[data-ref="${ref}"]`); if (inp) sincronizarCampo($('#dm-form'), `[data-ref="${ref}"]`, txt); else this.pendForm = true; },
  mudou(ms = 500){ const o = dmAtual(); if (!o) return; o.alteradoEm = new Date().toISOString(); agendarSalvar(); agendarPreviaDocM(ms); },
  novo(ref, txt = ''){ if (ref[0] !== 'b') return null; const o = dmAtual(), i = +ref.split(':')[1], b = o.blocos[i]; const nb = JSON.parse(JSON.stringify(b)); nb.txt = txt; delete nb.pb; nb.rot = incRotulo(b.rot); o.blocos.splice(i + 1, 0, nb); return 'b:' + (i + 1); },
  juntar(ref){ const o = dmAtual(), i = +ref.split(':')[1]; let k = i - 1; while (k >= 0 && (o.blocos[k].t !== 'p' || o.blocos[k].img)) k--; if (k < 0) return null;
    const ant = o.blocos[k], cur = o.blocos[i], off = semMarca(ant.txt).length; ant.txt = ant.txt + cur.txt; o.blocos.splice(i, 1); return {ref: 'b:' + k, off}; },
  excluir(ref){ if (ref[0] !== 'b') return; dmAtual().blocos.splice(+ref.split(':')[1], 1); },
  estrutura(){ this.pendForm = false; refazerForm(renderEditorDocM); }
};
async function gerarPdfDocM(){
  const o = dmAtual(); if (!o) return;
  const pend = conferirDocM(o).filter(x => !x.ok);
  if (pend.length && !confirm('Ainda há pontos para ajustar:\n\n' + pend.map(x => `• ${x.t}: ${x.d}`).join('\n') + '\n\nGerar o PDF assim mesmo?')) return;
  status('Gerando o documento…', 'warn');
  try {
    const r = await gerarBytesDocM(o);
    const nome = (nomeDocM(o).replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120) || tituloModelo(o.modelo)) + '.pdf';
    baixar(nome, r.bytes, 'application/pdf');
    let salvo = false;
    if (dirHandle){ try { const d1 = await dirHandle.getDirectoryHandle('documentos', {create: true}), d2 = await d1.getDirectoryHandle(tituloModelo(o.modelo).replace(/[\\/:*?"<>|]/g, '-'), {create: true}); const w = await (await d2.getFileHandle(nome, {create: true})).createWritable(); await w.write(r.bytes); await w.close(); salvo = true; } catch (e){ console.warn(e); } }
    o.ultimoPdf = new Date().toISOString(); o.alteradoEm = o.ultimoPdf; agendarSalvar();
    registrar('pdf', `gerou o documento “${nomeDocM(o)}” (${tituloModelo(o.modelo)})`);
    status(salvo ? `PDF baixado e salvo em documentos/${tituloModelo(o.modelo)}` : 'PDF baixado', 'ok');
  } catch (e){ console.error(e); alert('Erro ao gerar o PDF: ' + e.message); status('Erro ao gerar o PDF', 'err'); }
}
$('#dm-voltar').onclick = () => { dmAtualId = null; renderDocM(); };
$('#dm-pdf').onclick = gerarPdfDocM;
$('#dm-duplicar').onclick = () => { const o = dmAtual(); if (!o) return; const c = JSON.parse(JSON.stringify(o)); Object.assign(c, {id: uid(), autorId: P.perfilId, autor: perfilAtual().nome || '', criadoEm: new Date().toISOString(), alteradoEm: new Date().toISOString()}); delete c.ultimoPdf; db.docsManual.push(c); agendarSalvar(); dmAtualId = c.id; renderDocM(); };
$('#dm-restaurar').onclick = () => { const o = dmAtual(), d = modeloDoc(o); if (!o || !d || !confirm('Voltar ao texto original do modelo do manual? O que você escreveu neste documento será substituído.')) return; o.blocos = JSON.parse(JSON.stringify(d.blocos)); mudouDocM(o, false); renderEditorDocM(); };
$('#dm-excluir').onclick = () => { const o = dmAtual(); if (!o || !confirm(`Excluir “${nomeDocM(o)}”? Não dá para desfazer.`)) return; db.docsManual = db.docsManual.filter(x => x !== o); registrar('exclusao', `excluiu o documento “${nomeDocM(o)}”`); dmAtualId = null; agendarSalvar(); renderDocM(); };
window.addEventListener('resize', () => { if (/^dm-/.test(viewAtual) && dmAtual()) agendarPreviaDocM(300); });

/* ================= EDITAR ARQUIVO JÁ FEITO — lê um PDF ou .docx pronto e devolve o conteúdo organizado ================= */
const RUIDO_IMP = /^(P[ÁA]GINA\s*\d+(\s*P[ÁA]GINA\s*\d+)*|ASSINADO (POR|ELETRONICAMENTE)|Verifique a autenticidade|Documento assinado|\d{1,3})$|^ASSINADO POR|^Verifique a autenticidade|sgd\.to\.gov\.br\/verificador/i;
/* PDF → trechos com posição (página, y do topo, x inicial e final) e negrito pela fonte real */
/* ---- tabelas desenhadas no PDF: lê as linhas (traços e retângulos finos) e monta a grade ---- */
async function tabelasDaPagina(pdfjs, pg, vp){
  let ol; try { ol = await pg.getOperatorList(); } catch { return []; }
  const O = pdfjs.OPS, H = [], V = [];
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  let ctm = [1, 0, 0, 1, 0, 0]; const pilha = [];
  const pt = (x, y) => { const X = ctm[0] * x + ctm[2] * y + ctm[4], Y = ctm[1] * x + ctm[3] * y + ctm[5]; return vp.convertToViewportPoint(X, Y); };
  const caixa = (x0, y0, x1, y1) => { const a = pt(x0, y0), b = pt(x1, y1), c = pt(x0, y1), d = pt(x1, y0); const xs = [a[0], b[0], c[0], d[0]], ys = [a[1], b[1], c[1], d[1]]; return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
  const addCaixa = ([x0, y0, x1, y1]) => {
    const w = x1 - x0, h = y1 - y0;
    if (h <= 2.5 && w > 3) H.push({y: (y0 + y1) / 2, x0, x1});
    else if (w <= 2.5 && h > 3) V.push({x: (x0 + x1) / 2, y0, y1});
  };
  ol.fnArray.forEach((f, i) => {
    const a = ol.argsArray[i];
    if (f === O.save) pilha.push(ctm);
    else if (f === O.restore) ctm = pilha.pop() || [1, 0, 0, 1, 0, 0];
    else if (f === O.transform) ctm = mul(ctm, a);
    else if (f === O.constructPath){
      const op = a[0], d = a[1]?.[0];
      if (op === O.endPath || !d || !d.length) return;
      const preenche = op !== O.stroke && op !== O.closeStroke;
      // percorre os subcaminhos
      let k = 0, ini = null, ant = null, pts = [];
      const fecharSub = () => {
        if (pts.length >= 4 && preenche){ const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); addCaixa(caixa(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys))); }
        else if (!preenche) for (let q = 1; q < pts.length; q++){ const [x0, y0] = pts[q - 1], [x1, y1] = pts[q]; const bb = caixa(Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)); if (bb[3] - bb[1] < 0.6) H.push({y: (bb[1] + bb[3]) / 2, x0: bb[0], x1: bb[2]}); else if (bb[2] - bb[0] < 0.6) V.push({x: (bb[0] + bb[2]) / 2, y0: bb[1], y1: bb[3]}); }
        pts = [];
      };
      while (k < d.length){
        const c = d[k++];
        if (c === 0){ fecharSub(); pts.push([d[k++], d[k++]]); }
        else if (c === 1) pts.push([d[k++], d[k++]]);
        else if (c === 2){ k += 4; pts.push([d[k++], d[k++]]); }
        else if (c === 3){ k += 2; pts.push([d[k++], d[k++]]); }
        else if (c === 4){ if (pts.length) pts.push(pts[0]); }
        else break;
      }
      fecharSub();
    }
  });
  tabelasDaPagina.soltas = H;
  if (H.length < 2 || V.length < 2) return [];
  // junta segmentos colineares e agrupa em tabelas (linhas que se tocam)
  const tol = 2;
  const grupos = []; const pai = new Map();
  const todas = [...H.map(h => ({...h, t: 'h'})), ...V.map(v => ({...v, t: 'v'}))];
  todas.forEach(s => pai.set(s, s));
  const raiz = s => { while (pai.get(s) !== s) s = pai.get(s); return s; };
  const une = (a, b) => { const ra = raiz(a), rb = raiz(b); if (ra !== rb) pai.set(ra, rb); };
  const hs = todas.filter(s => s.t === 'h'), vs = todas.filter(s => s.t === 'v');
  hs.forEach(h => vs.forEach(v => { if (v.x >= h.x0 - tol && v.x <= h.x1 + tol && h.y >= v.y0 - tol && h.y <= v.y1 + tol) une(h, v); }));
  const porRaiz = new Map(); todas.forEach(s => { const r = raiz(s); if (!porRaiz.has(r)) porRaiz.set(r, []); porRaiz.get(r).push(s); });
  const agrupa = (vals, t = 1.6) => { const s = [...vals].sort((a, b) => a - b), out = []; s.forEach(v => { if (!out.length || v - out[out.length - 1].at(-1) > t) out.push([v]); else out[out.length - 1].push(v); }); return out.map(g => g.reduce((a, b) => a + b, 0) / g.length); };
  const tabelas = [];
  porRaiz.forEach(seg => {
    const gh = seg.filter(s => s.t === 'h'), gv = seg.filter(s => s.t === 'v');
    if (gh.length < 2 || gv.length < 2) return;
    const ys = agrupa(gh.map(h => h.y)), xs = agrupa(gv.map(v => v.x));
    if (ys.length < 2 || xs.length < 2) return;
    const x0 = xs[0], x1 = xs.at(-1), y0 = ys[0], y1 = ys.at(-1);
    if (x1 - x0 < 30 || y1 - y0 < 8) return;
    // existe linha vertical em x entre as alturas ya..yb? / horizontal em y entre xa..xb?
    const temV = (x, ya, yb) => gv.some(v => Math.abs(v.x - x) < tol && v.y0 <= ya + tol + 1 && v.y1 >= yb - tol - 1);
    const temH = (y, xa, xb) => gh.some(h => Math.abs(h.y - y) < tol && h.x0 <= xa + tol + 1 && h.x1 >= xb - tol - 1);
    const linhas = [];
    for (let r = 0; r < ys.length - 1; r++){
      const ya = ys[r], yb = ys[r + 1]; if (yb - ya < 2) continue;
      const cel = []; let c = 0;
      while (c < xs.length - 1){
        let e = c + 1; while (e < xs.length - 1 && !temV(xs[e], ya, yb)) e++;
        cel.push({c0: c, c1: e, x0: xs[c], x1: xs[e], y0: ya, y1: yb, itens: []}); c = e;
      }
      linhas.push({y0: ya, y1: yb, cel});
    }
    // mesclagem vertical: sem linha horizontal entre esta célula e a de baixo
    for (let r = 1; r < linhas.length; r++) linhas[r].cel.forEach(k => { const cima = linhas[r - 1].cel.find(q => q.c0 === k.c0 && q.c1 === k.c1); if (cima && !temH(linhas[r].y0, k.x0, k.x1)){ k.cont = cima.cont || cima; } });
    tabelas.push({x0, x1, y0, y1, xs, linhas});
  });
  return tabelas.sort((a, b) => a.y0 - b.y0);
}

async function lerPdfTrechos(file){
  const pdfjs = await carregarPdfjs();
  const doc = await pdfjs.getDocument({data: new Uint8Array(await file.arrayBuffer())}).promise;
  const trechos = [];
  for (let n = 1; n <= doc.numPages; n++){
    const pg = await doc.getPage(n), vp = pg.getViewport({scale: 1}), tc = await pg.getTextContent();
    tabelasDaPagina.soltas = [];
    const tabs = await tabelasDaPagina(pdfjs, pg, vp);   // também carrega as fontes (negrito)
    const sublinhas = (tabelasDaPagina.soltas || []).filter(h => !tabs.some(t => h.y > t.y0 - 2 && h.y < t.y1 + 2 && h.x0 > t.x0 - 2 && h.x1 < t.x1 + 2));
    const negrito = {}, italico = {};
    const nomeFonte = fn => { try { return pg.commonObjs.get(fn)?.name || ''; } catch { return ''; } };
    const ehNegrito = fn => fn in negrito ? negrito[fn] : (negrito[fn] = /bold|black|heavy|semibold|demi/i.test(nomeFonte(fn)));
    const ehItalico = fn => fn in italico ? italico[fn] : (italico[fn] = /italic|oblique/i.test(nomeFonte(fn)));
    let itens = tc.items.filter(it => it.str !== undefined && it.str !== '').map(it => {
      const fs = Math.hypot(it.transform[2], it.transform[3]) || it.height || 10;
      return {x: it.transform[4], y: vp.height - it.transform[5], w: it.width || 0, s: it.str, fs, b: ehNegrito(it.fontName), i: ehItalico(it.fontName)};
    }).filter(i => i.s.trim());
    // sublinhado: traço logo abaixo da linha de base cobrindo o texto
    itens.forEach(i => { if (i.w > 2 && sublinhas.some(h => h.y > i.y - 0.5 && h.y < i.y + i.fs * 0.35 && h.x0 <= i.x + i.w * 0.15 && h.x1 >= i.x + i.w * 0.85)) i.u = true; });
    // texto dentro das tabelas vai para as células
    tabs.forEach(t => {
      const dentro = [];
      itens = itens.filter(it => { const cx = it.x + it.w / 2, cy = it.y - it.fs * 0.3; if (cx > t.x0 && cx < t.x1 && cy > t.y0 && cy < t.y1){ dentro.push(it); return false; } return true; });
      dentro.forEach(it => { const cx = it.x + it.w / 2, cy = it.y - it.fs * 0.3; for (const l of t.linhas){ if (cy < l.y0 || cy > l.y1) continue; const k = l.cel.find(c => cx >= c.x0 && cx <= c.x1); if (k){ (k.cont || k).itens.push(it); return; } } });
      trechos.push({pag: n, y: t.y0 + 0.01, x0: t.x0, x1: t.x1, tabela: gradeParaTabela(t), txt: '[tabela]', marc: '', runs: [], altPag: vp.height});
    });
    // linhas: itens na mesma altura; dentro da linha, um vão grande separa colunas
    itens.sort((a, b) => b.fs - a.fs || a.y - b.y || a.x - b.x);
    const linhas = [];
    itens.forEach(i => {
      let l = linhas.find(l => Math.abs(l.y - i.y) < Math.max(1.5, i.fs * 0.35));
      if (!l){ l = linhas.find(l => i.fs < l.fs * 0.85 && i.y < l.y + l.fs * 0.25 && i.y > l.y - l.fs * 0.6 && i.x >= l.x0 - 2 && i.x <= l.x1 + l.fs * 1.5);
        // “o”/“a” pequeno e elevado é o ordinal (Nº, 4º, 1ª)
        if (l && i.y < l.y - l.fs * 0.12 && /^[oa]$/.test(i.s.trim())){ i.s = i.s.trim() === 'o' ? 'º' : 'ª'; i.u = false; } }
      if (!l){ l = {y: i.y, fs: i.fs, x0: i.x, x1: i.x + i.w, itens: []}; linhas.push(l); }
      l.itens.push(i); l.x0 = Math.min(l.x0, i.x); l.x1 = Math.max(l.x1, i.x + i.w);
    });
    linhas.sort((a, b) => a.y - b.y).forEach(l => {
      const its = l.itens.sort((a, b) => a.x - b.x); let atual = null, fimAnt = null;
      its.forEach(i => {
        const vao = fimAnt === null ? 0 : i.x - fimAnt;
        if (!atual || vao > Math.max(14, i.fs * 1.6)){ atual = {pag: n, y: l.y, x0: i.x, x1: i.x + i.w, fs: i.fs, runs: [], altPag: vp.height}; trechos.push(atual); }
        else if (vao > i.fs * 0.12 && !/\s$/.test(atual.runs.at(-1)?.t || '') && !/^\s/.test(i.s) && !(i.fs < atual.fs * 0.85 && /^[ºª°o]/.test(i.s))) atual.runs.push({t: ' ', b: i.b, i: i.i, u: i.u && atual.runs.at(-1)?.u});
        atual.runs.push({t: i.s, b: i.b, i: i.i, u: i.u}); atual.x1 = Math.max(atual.x1, i.x + i.w); atual.fs = Math.max(atual.fs, i.fs); fimAnt = i.x + i.w;
      });
    });
  }
  try { await doc.cleanup(); } catch {}
  trechos.forEach(t => { if (t.tabela) return; t.txt = t.runs.map(r => r.t).join('').replace(/\s+/g, ' ').trim(); t.marc = marcarRuns(t.runs); });
  // cabeçalhos e rodapés que se repetem nas páginas (nº do boletim, "Pág. X de Y", assinatura eletrônica…)
  const nPag = Math.max(...trechos.map(t => t.pag), 1);
  const chave = t => norm(t.txt).replace(/\d+/g, '#').replace(/\s+/g, ' ');
  const margem = t => t.y < t.altPag * 0.11 || t.y > t.altPag * 0.89;
  const conta = new Map();
  trechos.forEach(t => { if (t.tabela || !margem(t)) return; const k = chave(t); if (!conta.has(k)) conta.set(k, new Set()); conta.get(k).add(t.pag); });
  const repete = k => nPag >= 3 && (conta.get(k)?.size || 0) >= Math.max(2, nPag * 0.4);
  return trechos.filter(t => t.tabela || (t.txt && !RUIDO_IMP.test(t.txt) && !(margem(t) && (repete(chave(t)) || /^P[áa]g(ina)?\.?\s*\d+(\s*de\s*\d+)?$/i.test(t.txt))) && !/^[o•▪●◦§➢]$/.test(t.txt)));
}
/* grade lida do PDF → linhas de células (texto com negrito, alinhamento e mesclagens) */
function gradeParaTabela(t){
  const larg = t.xs.slice(1).map((x, k) => x - t.xs[k]);
  const fsAll = [];
  const linhas = t.linhas.map(l => l.cel.map(k => {
    if (k.cont) return {span: k.c1 - k.c0, cont: true, ps: []};
    const its = k.itens.sort((a, b) => a.y - b.y || a.x - b.x);
    const ls = []; its.forEach(i => { fsAll.push(i.fs); let L = ls.find(L => Math.abs(L.y - i.y) < Math.max(1.5, i.fs * 0.35)); if (!L){ L = {y: i.y, its: []}; ls.push(L); } L.its.push(i); });
    ls.sort((a, b) => a.y - b.y);
    const pars = []; let ant = null;
    ls.forEach(L => {
      L.its.sort((a, b) => a.x - b.x);
      const runs = []; let fim = null;
      L.its.forEach(i => { if (fim !== null && i.x - fim > i.fs * 0.12 && !/\s$/.test(runs.at(-1)?.t || '') && !/^\s/.test(i.s)) runs.push({t: ' ', b: i.b}); runs.push({t: i.s, b: i.b, i: i.i}); fim = i.x + i.w; });
      const x0 = L.its[0].x, x1 = fim, fs = L.its[0].fs;
      const novo = !ant || L.y - ant.y > fs * 1.9;
      if (novo) pars.push({runs: [...runs], x0, x1}); else { const p = pars.at(-1); const hif = /[A-Za-zÀ-ú]-$/.test(p.runs.map(r => r.t).join('')); if (!hif) p.runs.push({t: ' ', b: runs[0]?.b}); p.runs.push(...runs); p.x0 = Math.min(p.x0, x0); p.x1 = Math.max(p.x1, x1); }
      ant = L;
    });
    const meio = (k.x0 + k.x1) / 2;
    return {span: k.c1 - k.c0, inicioMescla: false, ps: pars.map(p => ({marc: marcarRuns(p.runs), txt: p.runs.map(r => r.t).join('').replace(/\s+/g, ' ').trim(), centro: Math.abs((p.x0 + p.x1) / 2 - meio) < Math.max(3, (k.x1 - k.x0) * 0.08) && p.x0 > k.x0 + 4, direita: k.x1 - p.x1 < 4 && p.x0 - k.x0 > (k.x1 - k.x0) * 0.3}))};
  }));
  // quem começa uma mesclagem vertical
  t.linhas.forEach((l, r) => l.cel.forEach((k, c) => { if (k.cont){ for (let q = r - 1; q >= 0; q--){ const i = t.linhas[q].cel.indexOf(k.cont); if (i >= 0){ linhas[q][i].inicioMescla = true; break; } } } }));
  return {grade: true, larg, x0: t.x0, linhas, fs: mediana(fsAll) || 10};
}
function marcarRuns(runs){
  // trechos com negrito/sublinhado → texto com **…** e ++…++ (junta trechos vizinhos de mesmo estilo)
  let s = '', b = false, u = false;
  runs.forEach(r => { if (!r.t) return; const rb = !!r.b, ru = !!r.u;
    if (r.t.trim()){ if (u && !ru){ s += '++'; u = false; } if (rb !== b){ s += '**'; b = rb; } if (ru && !u){ s += '++'; u = true; } }
    s += r.t; });
  if (u) s += '++'; if (b) s += '**';
  s = s.replace(/\+\+(\s*)\+\+/g, '$1');
  return s.replace(/\*\*(\s*)\*\*/g, '$1').replace(/\s+/g, ' ').replace(/\*\*\s+/g, m => ' **').replace(/ \*\* /g, ' ').trim();
}
/* parágrafos de um PDF de coluna única: junta linhas pelo espaçamento e pelo recuo da 1ª linha,
   inclusive quando o parágrafo continua na página seguinte; guarda o alinhamento real de cada um */
function paragrafosPdf(trechos){
  const ts = trechos.slice().sort((a, b) => a.pag - b.pag || a.y - b.y || a.x0 - b.x0);
  const txt = ts.filter(t => !t.tabela);
  // margens: a menor posição à esquerda e a maior à direita que se repetem (ignora recuos e linhas soltas)
  const repetidos = arr => { const c = {}; arr.forEach(v => c[v] = (c[v] || 0) + 1); return Object.keys(c).map(Number).filter(v => c[v] >= Math.max(2, arr.length * 0.04)); };
  const esqs = repetidos(txt.map(t => Math.round(t.x0 / 2) * 2));
  const spanTot = Math.max(...txt.map(t => t.x1)) - Math.min(...txt.map(t => t.x0));
  const longas = txt.filter(t => t.x1 - t.x0 > spanTot * 0.6).map(t => t.x0);   // linhas longas começam na margem (ou no recuo)
  const esq = Math.min(esqs.length ? Math.min(...esqs) : Infinity, longas.length ? Math.min(...longas) : Infinity, Infinity) < Infinity ? Math.min(esqs.length ? Math.min(...esqs) : Infinity, longas.length ? Math.min(...longas) : Infinity) : moda(txt.map(t => Math.round(t.x0)));
  const dirs = repetidos(txt.filter(t => t.x1 > esq + 200).map(t => Math.round(t.x1 / 2) * 2));
  const dir = dirs.length ? Math.max(...dirs) : Math.max(...txt.map(t => t.x1), esq + 400);
  const gaps = []; for (let i = 1; i < txt.length; i++) if (txt[i].pag === txt[i - 1].pag) gaps.push(txt[i].y - txt[i - 1].y);
  const passo = mediana(gaps.filter(g => g > 4 && g < 30)) || 14;
  const corpoFs = moda(txt.map(t => Math.round(t.fs || 12))) || 12;
  const pars = []; let atual = null, ant = null;
  const cheiaL = t => t.x1 > dir - Math.max(30, (t.fs || 12) * 2.6);
  ts.forEach(t => {
    if (t.tabela){
      // tabela que continua na página seguinte (mesmas colunas): junta, sem repetir o cabeçalho
      const prev = pars.at(-1);
      if (prev?.tabela && !atual && prev.tabela.larg.length === t.tabela.larg.length && t.tabela.larg.every((w, k) => Math.abs(w - prev.tabela.larg[k]) < 4)){
        const cab = l => l.map(c => c.ps.map(p => p.txt).join(' ')).join('|');
        const novas = t.tabela.linhas.slice(cab(t.tabela.linhas[0]) === cab(prev.tabela.linhas[0]) ? 1 : 0);
        prev.tabela.linhas.push(...novas);
      } else pars.push({tabela: t.tabela, pag: t.pag});
      atual = null; ant = null; return;
    }
    const mesmaPag = ant && ant.pag === t.pag;
    const gap = mesmaPag ? t.y - ant.y : (ant ? passo : 99);
    const larguraTxt = dir - esq, largL = t.x1 - t.x0;
    const noBloco = atual?.blocoX && Math.abs(t.x0 - atual.blocoX) < 4;
    const centro = !noBloco && Math.abs((t.x0 + t.x1) / 2 - (esq + dir) / 2) < 22 && t.x0 > esq + 25 && t.x1 < dir - 15;
    const direita = !noBloco && t.x0 > esq + 80 && Math.abs(t.x1 - dir) < 8 && !centro && largL < larguraTxt * 0.55;
    // citação recuada: linha longa que começa bem à direita da margem e vai até a margem direita
    const bloco = !centro && !direita && t.x0 > esq + 30 && largL > larguraTxt * 0.4 && Math.abs(t.x1 - dir) < 10;
    const recuo = t.x0 > esq + 12 && !centro && !direita && !bloco;
    const marcador = /^([a-z]\)|\d+(\.\d+)*[.)]\s|[IVXLC]+\s*[-–]\s|[•✓▪-]\s)/.test(t.txt);
    const cheia = ant && cheiaL(ant);
    // 1ª linha recuada seguida de linha na margem = recuo de parágrafo (não citação)
    const viraRecuo = atual?.blocoX && atual.linhas.length === 1 && Math.abs(t.x0 - esq) < 14;
    const continua = atual && ant && cheia && gap <= passo * 1.8 && !marcador && !centro && !direita && !atual.centro && !atual.direita &&
      (atual.blocoX ? (Math.abs(t.x0 - atual.blocoX) < 4 || viraRecuo) : (!recuo && !bloco && Math.abs(t.x0 - esq) < 14));
    if (continua && viraRecuo){ atual.recuo = true; atual.recuoPt = atual.blocoPt; atual.blocoX = 0; atual.blocoPt = 0; }
    // 1ª linha recuada e a 2ª volta para a esquerda (documento curto, margem mal definida): é o mesmo parágrafo
    const voltaMargem = !continua && atual && ant && atual.linhas.length === 1 && cheia && gap <= passo * 1.8 && !atual.centro && !atual.direita && !marcador && t.x0 < atual.x0 - 20 && t.x1 > t.x0 + 30;
    if (voltaMargem){ atual.recuo = true; atual.recuoPt = atual.x0 - t.x0; atual.blocoX = 0; atual.blocoPt = 0; }
    // centralizado em várias linhas (títulos longos)
    const contCentro = atual && ant && mesmaPag && atual.centro && centro && gap <= passo * 1.4 && Math.abs((t.fs || 12) - (ant.fs || 12)) < 1 && !(atual.bold !== /^\*\*.*\*\*$/.test(t.marc)) && (ant.x1 - ant.x0) > (dir - esq) * 0.85;
    if (continua || contCentro || voltaMargem){ const hif = /[A-Za-zÀ-ú]-$/.test(atual.txt) && /^[a-zà-ú]/.test(t.txt); atual.txt += (hif ? '' : ' ') + t.txt; atual.marc += (hif ? '' : ' ') + t.marc; atual.linhas.push(t); }
    else {
      atual = {txt: t.txt, marc: t.marc, centro, direita, recuo, recuoPt: recuo ? t.x0 - esq : 0, blocoX: bloco ? t.x0 : 0, blocoPt: bloco ? t.x0 - esq : 0, x0: t.x0, pag: t.pag, y: t.y, fs: t.fs, linhas: [t], bold: /^\*\*.*\*\*$/.test(t.marc),
        espacoAntes: gap > passo * 1.7 && gap < 99};
      pars.push(atual);
    }
    ant = t;
  });
  pars.forEach(p => {
    if (p.tabela) return;
    p.marc = p.marc.replace(/\*\*\s*\*\*/g, '').replace(/\s+/g, ' ').trim();
    if (!semMarca(p.marc).replace(/[_\s]/g, '')) p.vazio = true;
    // justificado: alguma linha (fora a última) vai até a margem direita
    p.just = p.linhas.length > 1 && p.linhas.slice(0, -1).some(cheiaL);
    p.fsRel = (p.fs || corpoFs) / corpoFs;
    delete p.linhas;
  });
  return pars.filter(p => !p.vazio);
}
const moda = arr => { const c = {}; arr.forEach(v => c[v] = (c[v] || 0) + 1); return +Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] || 0; };
const mediana = arr => { if (!arr.length) return 0; const s = arr.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

/* .docx → parágrafos (com **negrito**) e tabelas */
async function lerDocxConteudo(file){
  const zip = await lerZip(await file.arrayBuffer());
  const xml = await zip.texto('word/document.xml'); if (!xml) throw new Error('Arquivo .docx inválido.');
  const itens = lerCorpoDocx(xml, {});
  const marcP = p => marcarRuns(p.runs.map(r => ({t: r.t === '\t' ? ' ' : r.t, b: r.b})));
  const out = [];
  itens.forEach(it => {
    if (it.tipo === 'p'){ const t = it.texto.replace(/\s+/g, ' ').trim(); if (t && !RUIDO_IMP.test(t)) out.push({txt: t, marc: marcP(it), centro: it.jc === 'center', direita: it.jc === 'right', num: it.num}); }
    else out.push({tabela: it.celulas.map(row => row.map(ps => ps.filter(p => p.texto.trim()).map(p => ({txt: p.texto.replace(/\s+/g, ' ').trim(), marc: marcP(p), num: p.num}))))});
  });
  return out;
}
async function lerArquivoPronto(file){
  if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf'){ const tr = await lerPdfTrechos(file); if (!tr.length) throw new Error('Não encontrei texto neste PDF (pode ser uma imagem escaneada).'); return {tipo: 'pdf', trechos: tr, pars: paragrafosPdf(tr)}; }
  if (/\.docx$/i.test(file.name)) return {tipo: 'docx', pars: await lerDocxConteudo(file)};
  throw new Error('Envie o documento em PDF ou Word (.docx).');
}
/* utilidades de reconhecimento */
const MESES_RE = 'janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro';
function dataDeTexto(t){
  const m = new RegExp(`(\\d{1,2})[ºo°]?\\s+de\\s+(${MESES_RE})\\s+de\\s+(\\d{4})`, 'i').exec(t);
  if (m){ const mes = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'].indexOf(norm(m[2]).toLowerCase()) + 1; return `${m[3]}-${String(mes).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`; }
  const d = /(\d{2})[./](\d{2})[./](\d{4})/.exec(t); return d ? `${d[3]}-${d[2]}-${d[1]}` : '';
}
function localDeTexto(t){ const m = /^(.+?)\s*(–|-|\/)\s*([A-Z]{2})\s*,/.exec(t.trim()); return m ? {cidade: m[1].replace(/^Quartel\s+d[oa]\s+.+?\s+em\s+/i, '').trim(), uf: m[3], sep: m[2] === '/' ? '/' : '–'} : null; }
function setoresDeTexto(s){
  s = String(s || '').replace(/\*\*/g, '').trim().replace(/\.$/, '');
  s = s.replace(/\b([A-Z]{1,3})\/(\d)\b/g, '$1$2');           // P/3 → P3, PM/3 → PM3
  let partes = s.split(/\s*\/\s*/).filter(Boolean);
  partes = partes.flatMap(p => p.split(/\s+(?=\d+[ºª°]\s*\S)/));  // "P3 8º BPM" → P3 | 8º BPM
  return [...partes.map(p => p.trim()), '', '', '', ''].slice(0, 4);
}
const ehLocalData = t => new RegExp(`,\\s*\\d{1,2}[ºo°]?\\s+de\\s+(${MESES_RE})\\s+de\\s+\\d{4}`, 'i').test(t);
const ehVocativo = t => /^(Senhor|Senhora|Senhores|Senhoras|Excelent|Prezad|Magn[íi]fic|Merit[íi]ssim|Eminent|Reverend)/i.test(t.trim()) && /,\s*$/.test(t.trim()) && t.length < 90;
const ehFecho = t => /^(Respeitosamente|Atenciosamente),?$/i.test(t.trim().replace(/\*\*/g, ''));
const POSTO_RE_IMP = /^((?:TEN CEL|[1-3]º TEN|[1-3]º SGT|CEL|MAJ|CAP|ASP OF|CAD|ST|SUB TEN|CB|SD|AL PRAÇA)(?:\s+(?:QOPM|QOS|QOA|QOAS|QOM|QPPM|QPE|QPS|QPM|QOE|QOPMS|PM))?)\s+(.+)$/i;
function assinaturaDe(pars, i0){
  // procura “Assinatura digital” (ou a linha “Nome – POSTO”) e devolve nome, guerra, posto e função
  let i = pars.findIndex((p, k) => k >= i0 && /^Assinatura digital/i.test(p.txt));
  const dig = i >= 0, ni = dig && /NI\s*$/i.test(pars[i].txt);
  let j = dig ? i + 1 : pars.findIndex((p, k) => k >= i0 && / [–-] /.test(p.txt) && POSTO_RE_IMP.test(p.txt.split(/ [–-] /).pop() + ' x') && p.txt.length < 90);
  if (j < 0 || !pars[j]) return null;
  const plano = pars[j].txt.replace(/\*\*/g, ''), corte = plano.search(/\s+[–-]\s+/);
  const nomeM = corte >= 0 ? plano.slice(0, corte) : plano, postoM = corte >= 0 ? plano.slice(corte).replace(/^\s+[–-]\s+/, '') : '';
  const nome = nomeM.trim(), palavras = nome.split(/\s+/);
  const parteNome = pars[j].marc.split(/[–-]/)[0];
  const negr = [...parteNome.matchAll(/\*\*(.+?)\*\*/g)].flatMap(m => m[1].trim().split(/\s+/).map(w => norm(w)));
  const guerra = palavras.map((w, k) => negr.includes(norm(w)) ? k : -1).filter(k => k >= 0);
  let funcao = (pars[j + 1]?.txt || '').replace(/\*\*/g, '').trim(), resp = /^Resp\.?\s*p/i.test(funcao);
  funcao = funcao.replace(/^Resp\.?\s*p\/?\s*/i, '');
  return {ini: dig ? i : j, fim: j + 1, dig, ni, nome, guerra, posto: (postoM || '').replace(/\*\*/g, '').trim().toUpperCase(), funcao, resp};
}

/* ---------- OFÍCIO ---------- */
function importarParaOficio(pars, c){
  pars = pars.filter(p => !p.tabela);
  const iEp = pars.findIndex(p => /^Of[íi]cio(\s+Circular)?\s*n[º°o.]*\s*\d+/i.test(p.txt));
  if (iEp < 0) throw new Error('Não encontrei a epígrafe “Ofício nº …” no arquivo.');
  const cab = pars.slice(0, iEp).map(p => p.txt.replace(/\*\*/g, '')).filter(t => t === t.toUpperCase() && /[A-Z]{3}/.test(t));
  if (cab.length){ c.cab1 = cab[cab.length >= 2 ? cab.length - 2 : 0] || c.cab1; c.cab2 = cab.length >= 2 ? cab[cab.length - 1] : ''; }
  const mE = /^(Of[íi]cio(?:\s+Circular)?)\s*n[º°o.]*\s*(\d+)\s*\/\s*(\d{4})\s*[–-]?\s*(.*)$/i.exec(pars[iEp].txt);
  if (mE){ c.tipoDoc = /Circular/i.test(mE[1]) ? 'Ofício Circular' : 'Ofício'; c.numero = mE[2].padStart(3, '0'); c.ano = mE[3]; c.setores = setoresDeTexto(mE[4]); }
  let k = iEp + 1;
  const sgd = pars.slice(k, k + 3).find(p => /^SGD\s*:/i.test(p.txt)); if (sgd) c.sgd = sgd.txt.replace(/^SGD\s*:\s*/i, '').replace(/\*\*/g, '');
  const iLD = pars.findIndex((p, i) => i > iEp && i < iEp + 5 && ehLocalData(p.txt));
  if (iLD >= 0){ const L = localDeTexto(pars[iLD].txt); if (L){ c.cidade = L.cidade; c.uf = L.uf; c.sep = L.sep; } c.data = dataDeTexto(pars[iLD].txt) || c.data; k = iLD + 1; } else if (sgd) k = pars.indexOf(sgd) + 1;
  const iAs = pars.findIndex((p, i) => i >= k && /^Assunto\s*:/i.test(p.txt));
  const dest = pars.slice(k, iAs < 0 ? k : iAs).map(p => p.txt.replace(/\*\*/g, '').trim());
  if (c.tipoDoc === 'Ofício Circular') c.circularDest = dest.join(' ');
  else if (dest.length){
    const end = dest[0]; c.genero = /Senhora/i.test(end) ? 'F' : 'M';
    const nome = dest[1] || '', mP = POSTO_RE_IMP.exec(nome);
    c.destMilitar = !!mP; c.destPosto = mP ? mP[1].toUpperCase() : ''; c.destNome = mP ? mP[2] : nome;
    const fun = dest[2] || ''; c.destResp = /^Resp\.?\s*p/i.test(fun); c.destFuncao = fun.replace(/^Resp\.?\s*p(?:\/|elo|ela)?\s*/i, '');
    const ultima = dest[dest.length - 1] || '', mC = /^(.+?)\s*(–|-|\/)\s*([A-Z]{2})\.?$/.exec(ultima);
    if (mC && dest.length >= 4){ c.destCidade = mC[1].trim(); c.destUF = mC[3]; c.destLocal = dest.length >= 5 ? dest.slice(3, -1).join(' – ') : ''; }
    else { c.destLocal = dest.slice(3).join(' – '); }
    // tratamento: procura a autoridade pelo cargo; senão, o padrão de “Excelência” ou de correspondência interna
    const Q = db.manualRedacao?.quadros || [], cargo = norm(c.destFuncao).split(' ')[0];
    let achou = '';
    Q.forEach((q, qi) => q.linhas.forEach((L, li) => { if (!achou && cargo && norm(L.autoridade).startsWith(cargo) && /Excel/i.test(end) === /Excel/i.test(L.enderecamento)) achou = `${qi}|${li}`; }));
    if (!achou) Q.forEach((q, qi) => q.linhas.forEach((L, li) => { if (!achou && (/Excel/i.test(end) ? /Excel/i.test(L.enderecamento) && /^Demais|Secret/i.test(L.autoridade) : /INTERNAS/i.test(q.titulo) && /demais fun/i.test(L.autoridade))) achou = `${qi}|${li}`; }));
    if (achou) c.trat = achou;
  }
  k = iAs < 0 ? k : iAs;
  if (iAs >= 0){ c.assunto = pars[iAs].marc.replace(/^\**\s*Assunto\s*:\s*/i, '').replace(/\*\*/g, '').trim(); k = iAs + 1; }
  const anexos = [];
  if (/^\**\s*Anexos?\s*:/i.test(pars[k]?.txt || '')){
    anexos.push(pars[k].txt.replace(/^Anexos?\s*:\s*/i, '')); k++;
    while (pars[k] && !ehVocativo(pars[k].txt) && !ehFecho(pars[k].txt) && pars[k].txt.length < 120 && (pars[k].recuo || /;\s*\**$/.test(anexos[anexos.length - 1] || '')) && !/[.!?]\**$/.test(anexos[anexos.length - 1] || '')){ anexos.push(pars[k].txt); k++; }
  }
  c.anexos = anexos.map(a => a.replace(/\*\*/g, '').replace(/[;.]\s*$/, '').trim()).filter(Boolean).join('\n');
  if (ehVocativo(pars[k]?.txt || '')){ c.vocativo = pars[k].txt.replace(/\*\*/g, '').trim(); c.vocAuto = false; c.semVocativo = false; k++; } else c.semVocativo = true;
  const iF = pars.findIndex((p, i) => i >= k && ehFecho(p.txt));
  c.texto = pars.slice(k, iF < 0 ? pars.length : iF).filter(p => !/^Assinatura digital/i.test(p.txt)).map(p => p.marc.trim()).join('\n');
  if (iF >= 0){
    c.fecho = /^Aten/i.test(pars[iF].txt) ? 'Atenciosamente' : 'Respeitosamente';
    const A = assinaturaDe(pars, iF + 1);
    if (A){ c.assDigital = A.dig; c.ni = A.ni; c.sigNome = A.nome; c.sigGuerra = A.guerra; c.sigPosto = A.posto; c.sigFuncao = A.funcao; c.sigResp = A.resp;
      const rod = pars.slice(A.fim + 1).map(p => p.txt.replace(/\*\*/g, '')).filter(t => t.length > 8).slice(0, 2);
      if (rod.length){ c.rodape1 = rod[0] || ''; c.rodape2 = rod[1] || ''; } }
  }
  return c;
}

/* ---------- ORDEM DE SERVIÇO ---------- */
function importarParaOS(arq, c){
  let m = null;
  if (arq.tipo === 'docx'){
    const itens = arq.pars.map(p => p.tabela ? {tipo: 'tbl', celulas: p.tabela.map(row => row.map(cel => cel.map(x => ({texto: x.txt, runs: trechosOf(x.marc), num: x.num}))))} : {tipo: 'p', texto: p.txt, runs: trechosOf(p.marc)});
    m = osDeItensDocx(itens);
    if (m){ const A = assinaturaDe(arq.pars.filter(p => !p.tabela), 0); if (A){ m.sigNome = A.nome; m.sigPosto = A.posto; m.sigFuncao = A.funcao; m.sigGuerra = A.guerra; m.sigDig = A.dig; } }
  } else m = osDePdf(arq.trechos);
  if (!m) throw new Error('Não reconheci a tabela da Ordem de Serviço neste arquivo.');
  if (m.cab?.length){ c.cab1 = m.cab[0]; c.cab2 = m.cab[1] || ''; }
  if (m.numero){ c.numero = String(m.numero).padStart(3, '0'); c.ano = m.ano; c.setores = setoresDeTexto((m.setores || []).join('/')); }
  if (m.sgd) c.sgd = m.sgd;
  if (m.cidade){ c.cidade = m.cidade; c.uf = m.uf; c.sep = m.sep; }
  if (m.data) c.data = m.data;
  ['aos', 'evento', 'referencia', 'anexos'].forEach(k => c[k] = m[k] || '');
  if (m.itens?.length) c.itens = m.itens;
  if (m.sigNome){ c.sigNome = m.sigNome; c.sigPosto = m.sigPosto || c.sigPosto; c.sigFuncao = m.sigFuncao || c.sigFuncao; c.sigGuerra = m.sigGuerra || []; if (m.sigDig !== undefined) c.assDigital = m.sigDig; }
  return c;
}
function osDePdf(trechos){
  const ts = trechos.map(t => ({...t, Y: (t.pag - 1) * (t.altPag || 842) + t.y})).sort((a, b) => a.Y - b.Y || a.x0 - b.x0);
  const iEp = ts.findIndex(t => /^O\.?\s?S\.?\s*n[º°o.]*\s*\d+/i.test(t.txt));
  if (iEp < 0) return null;
  const esq = Math.min(...ts.filter(t => t.Y >= ts[iEp].Y).map(t => t.x0));
  const W = Math.max(...ts.map(t => t.x1));
  // início da coluna da direita: x mais comum dos textos que começam no meio da página
  const meio = ts.filter(t => t.Y > ts[iEp].Y && t.x0 > esq + 90 && t.x0 < esq + (W - esq) * 0.6).map(t => Math.round(t.x0 / 4) * 4);
  const split = moda(meio) || esq + 160;
  const m = {cab: ts.slice(0, iEp).map(t => t.txt).filter(t => t === t.toUpperCase() && /[A-Z]{3}/.test(t) && !/^P[ÁA]GINA/.test(t)).slice(-2), itens: []};
  const mE = /^O\.?\s?S\.?\s*n[º°o.]*\s*(\d+)\s*\/\s*(\d{4})\s*[–-]?\s*(.*)$/i.exec(ts[iEp].txt);
  if (mE){ m.numero = mE[1]; m.ano = mE[2]; m.setores = setoresDeTexto(mE[3]).filter(Boolean); }
  const perto = ts.filter(t => Math.abs(t.Y - ts[iEp].Y) < 40);
  const sg = perto.find(t => /^SGD\s*:/i.test(t.txt)); if (sg) m.sgd = sg.txt.replace(/^SGD\s*:\s*/i, '');
  const ld = perto.find(t => ehLocalData(t.txt)); if (ld){ const L = localDeTexto(ld.txt); if (L) Object.assign(m, L); m.data = dataDeTexto(ld.txt); }
  const usados = new Set([ts[iEp], sg, ld].filter(Boolean));
  const resto = ts.filter(t => !usados.has(t) && t.Y > ts[iEp].Y - 2);
  // difusão / evento / referência / anexos (sem numeração) até o 1º item numerado
  const ehTitulo = t => /^\d+\.\s+[A-ZÀ-Ú]/.test(t.txt) && !/^\d+\.\d/.test(t.txt) && t.x0 < split - 20 && t.txt.replace(/^\d+\.\s*/, '') === t.txt.replace(/^\d+\.\s*/, '').toUpperCase();
  const iT1 = resto.findIndex(ehTitulo);
  let campo = null;
  resto.slice(0, iT1 < 0 ? resto.length : iT1).forEach(t => {
    const mR = /^(Aos|Evento|Refer[êe]ncia|Anexos?)\s*:\s*(.*)$/i.exec(t.txt);
    if (mR){ campo = {aos: 'aos', evento: 'evento', referencia: 'referencia', referência: 'referencia', anexos: 'anexos', anexo: 'anexos'}[mR[1].toLowerCase()]; m[campo] = t.marc.replace(/^\**\s*(Aos|Evento|Refer[êe]ncia|Anexos?)\s*:\s*\**\s*/i, '').trim(); }
    else if (campo) m[campo] += ' ' + t.marc;
  });
  // itens
  const titulos = resto.map((t, i) => ehTitulo(t) ? i : -1).filter(i => i >= 0);
  // fim da tabela: a assinatura (centralizada, depois do último item)
  let iAss = resto.findIndex((t, i) => i > (titulos.at(-1) ?? 0) && /^Assinatura digital/i.test(t.txt));
  const fimTab = iAss >= 0 ? iAss : resto.length;
  titulos.forEach((ti, n) => {
    const fim = n + 1 < titulos.length ? titulos[n + 1] : fimTab;
    const titulo = resto[ti].txt.replace(/^\d+\.\s*/, '').replace(/\*\*/g, '').trim();
    const corpo = resto.slice(ti + 1, fim);
    const esqT = corpo.filter(t => t.x0 < split - 20 && t.x1 < split + 8), dirT = corpo.filter(t => t.x0 >= split - 20), cheio = corpo.filter(t => t.x0 < split - 20 && t.x1 >= split + 8);
    const lig = /LIGA[ÇC]/.test(norm(titulo));
    if (!lig && (cheio.length || !esqT.length) && (cheio.length || dirT.length)){ m.itens.push({titulo, tipo: 'texto', linhas: [], texto: paragrafosDeLinhas(corpo.slice().sort((a, b) => a.Y - b.Y))}); return; }
    // rótulos (juntando os que quebraram em duas linhas)
    const rot = [];
    esqT.forEach(t => { const ult = rot.at(-1); if (ult && !lig && !/^\d+\.\d+/.test(t.txt) && t.Y - ult.Y2 < t.fs * 1.8){ ult.txt += ' ' + t.txt; ult.Y2 = t.Y; } else rot.push({txt: t.txt, Y: t.Y, Y2: t.Y}); });
    rot.forEach(r => { r.Yc = (r.Y + r.Y2) / 2; r.pag = esqT.find(t => t.Y === r.Y)?.pag; });
    const grupos = repartir(rot.map(r => ({y: r.Yc, pag: r.pag})), dirT.map(t => ({y: t.Y, pag: t.pag})));
    m.itens.push({titulo, tipo: lig ? 'lig' : 'sub', linhas: rot.map((r, i) => ({rotulo: r.txt.replace(/^\d+\.\d+(\.\d+)*\s*/, '').replace(/\*\*/g, '').trim(), texto: lig ? grupos[i].map(j => dirT[j].txt).join(' ') : paragrafosDeLinhas(grupos[i].map(j => dirT[j]))}))});
  });
  if (iAss >= 0){ const A = assinaturaDe(resto.slice(iAss).map(t => ({txt: t.txt, marc: t.marc})), 0); if (A){ m.sigNome = A.nome; m.sigPosto = A.posto; m.sigFuncao = A.funcao; m.sigGuerra = A.guerra; m.sigDig = A.dig; } }
  return m;
}
/* divide as linhas da coluna direita entre os rótulos (o rótulo fica no meio do seu bloco de texto) */
function repartir(rotY, linY){
  const R = rotY.length, N = linY.length;
  if (!R) return [];
  if (N <= R) return rotY.map((y, i) => i < N ? [i] : []);
  // custo: distância entre o rótulo e o meio das linhas do grupo que estão na mesma página dele
  const meioGrupo = (a, b, r) => { const ls = []; for (let k = a; k < b; k++) if (linY[k].pag === rotY[r].pag) ls.push(linY[k].y); return ls.length ? Math.abs((ls[0] + ls[ls.length - 1]) / 2 - rotY[r].y) : 400; };
  const INF = 1e18, dp = Array.from({length: R + 1}, () => new Array(N + 1).fill(INF)), de = Array.from({length: R + 1}, () => new Array(N + 1).fill(-1));
  dp[0][0] = 0;
  for (let r = 1; r <= R; r++) for (let n = r; n <= N - (R - r); n++) for (let a = r - 1; a < n; a++){
    if (dp[r - 1][a] === INF) continue;
    const custo = dp[r - 1][a] + meioGrupo(a, n, r - 1);
    if (custo < dp[r][n]){ dp[r][n] = custo; de[r][n] = a; }
  }
  const out = []; let n = N;
  for (let r = R; r >= 1; r--){ const a = de[r][n]; out.unshift(Array.from({length: n - a}, (_, k) => a + k)); n = a; }
  return out;
}
/* linhas de uma célula → parágrafos (uma linha do campo por parágrafo) */
function paragrafosDeLinhas(lin){
  if (!lin.length) return '';
  const passos = []; for (let i = 1; i < lin.length; i++) passos.push(lin[i].Y - lin[i - 1].Y);
  const passo = Math.min(...passos.filter(p => p > 3), 99);
  const pars = []; let atual = null;
  lin.forEach((t, i) => {
    const gap = i ? t.Y - lin[i - 1].Y : 99;
    const marcador = /^([a-z]\)|[•✓▪]|-\s*\S|\d+\.\s)/.test(t.txt);
    if (atual && gap < passo * 1.45 && !marcador){ const hif = /[A-Za-zÀ-ú0-9]-$/.test(atual) ; atual += (hif ? '' : ' ') + t.marc; pars[pars.length - 1] = atual; }
    else { atual = t.marc; pars.push(atual); }
  });
  return pars.map(p => p.replace(/^-(?=\S)/, '- ').replace(/\*\*\s*\*\*/g, '').replace(/\s+/g, ' ').trim()).join('\n');
}

/* ---------- MODELOS DO MANUAL (genérico) ---------- */
/* tabela lida do PDF → tabela do documento (larguras proporcionais ao original, cabendo na área útil) */
function tabelaDocM(tb){
  const area = 595.28 - (regraOf('mEsq') + regraOf('mDirSup')) * CM;
  const tot = tb.larg.reduce((a, b) => a + b, 0) || 1, k = Math.min(1, (area - 4) / tot);
  const cols = tb.larg.map(w => Math.max(200, Math.round(w * k * 20)));
  let sz = Math.max(7, Math.min(12, Math.round(tb.fs * Math.min(1, k + 0.08) * 2) / 2));
  // a maior palavra de cada coluna tem de caber na célula (como no original)
  const PAD = 40;
  tb.linhas.forEach(l => { let gi = 0; l.forEach(c => { const w = cols.slice(gi, gi + c.span).reduce((a, b) => a + b, 0) / 20 - 2 * PAD / 20; gi += c.span; if (c.cont) return;
    c.ps.forEach(p => semMarca(p.marc || '').split(/\s+/).forEach(pal => { const neg = /\*\*/.test(p.marc || ''); const cabe = w / (pal.length * (neg ? 0.62 : 0.56)); if (pal.length > 1 && cabe < sz) sz = Math.max(6.5, Math.floor(cabe * 2) / 2); })); }); });
  const cabNegrito = tb.linhas[0]?.every(c => c.cont || c.ps.every(p => !p.txt || /^\*\*[\s\S]*\*\*$/.test(p.marc)));
  const rows = tb.linhas.map((l, ri) => ({h: 0, hr: 'atLeast', antes: 0, cells: l.map(c => ({
    span: c.span, vm: c.cont ? 'c' : c.inicioMescla ? 'r' : '', bord: {}, fill: ri === 0 && cabNegrito && tb.linhas.length > 2 ? '#E7E6E6' : '', va: 'center',
    ps: (c.cont ? [] : (c.ps.length ? c.ps : [{marc: ''}])).map(p => ({t: 'p', jc: p.centro ? 'c' : p.direita ? 'r' : 'l', il: 0, ir: 0, fl: 0, sb: 0, sa: 0, ln: 240, lr: 'auto', sz, n: false, txt: p.marc || ''}))
  }))}));
  rows.forEach(r => r.cells.forEach(c => c.ps.forEach(p => { p.sz = sz; })));
  return {t: 'tbl', cols, bord: {top: true, bottom: true, left: true, right: true, insideH: true, insideV: true}, jc: 'center', ind: 0, pad: PAD, rows};
}
function importarParaDocM(arq, modeloBlocos){
  const pars = arq.pars.filter(p => p.tabela || p.txt);
  const mod = JSON.parse(JSON.stringify(modeloBlocos)).map((b, i) => ({...b, __i: i}));
  const palav = t => new Set(norm(semMarca(t || '')).replace(/[^A-Z0-9 ]/g, ' ').split(' ').filter(w => w.length > 2));
  const ehSig = t => / [–-] /.test(t) && /\b(QO\w*|QP\w*|CEL|MAJ|CAP|TEN|SGT|CB|SD|ASP)\b/.test(norm(t)) && t.length < 100;
  const ehTit = b => b.t === 'p' && !b.img && b.txt.trim() && semMarca(b.txt).length < 90 && (/^\*\*/.test(b.txt.trim()) && /\*\*:?\s*$/.test(b.txt.trim()) || (semMarca(b.txt) === semMarca(b.txt).toUpperCase() && /[A-Z]{3}/.test(semMarca(b.txt))));
  const nota = (p, b) => {
    const tp = p.txt, tb = semMarca(b.txt);
    if (/^Assinatura digital/i.test(tp) && /^Assinatura digital/i.test(tb)) return 1;
    if (ehLocalData(tp) && ehLocalData(tb)) return 0.95;
    if (ehSig(tp) && ehSig(tb)) return 0.9;
    const A = palav(tp), B = palav(tb); if (!A.size || !B.size) return 0;
    let c = 0; A.forEach(w => { if (B.has(w)) c++; });
    return c / Math.max(A.size, B.size);
  };
  const out = [];
  // cabeçalho: brasão + linhas da unidade do arquivo
  const iImg = mod.findIndex(b => b.img);
  let ini = 0, corpoMod = mod;
  if (iImg >= 0){
    out.push(mod[iImg]);
    let j = iImg + 1; const cabMod = []; while (j < mod.length && mod[j].t === 'p' && mod[j].jc === 'c' && mod[j].txt.trim() && semMarca(mod[j].txt) === semMarca(mod[j].txt).toUpperCase()){ cabMod.push(mod[j]); j++; }
    const fmtCab = cabMod[0] || {t: 'p', jc: 'c', sz: 12, ln: 240, lr: 'auto', sa: 0, sb: 0, il: 0, ir: 0, fl: 0};
    while (ini < pars.length && ini < 3 && !pars[ini].tabela && pars[ini].txt === pars[ini].txt.toUpperCase() && /[A-Z]{3}/.test(pars[ini].txt) && pars[ini].txt.length < 80 && !/n[º°]\s*\d/i.test(pars[ini].txt)){ out.push({...(cabMod[ini] || fmtCab), txt: pars[ini].txt.replace(/\*\*/g, '')}); ini++; }
    corpoMod = mod.slice(j);
  }
  const cands = corpoMod.filter(b => b.t === 'p' && !b.img && b.txt.trim());
  const fmtTexto = cands.find(b => b.jc === 'j' && semMarca(b.txt).length > 60) || cands.find(b => semMarca(b.txt).length > 30) || {t: 'p', jc: 'j', sz: 12, ln: 300, lr: 'auto', sa: 6, sb: 0, il: 0, ir: 0, fl: 1134};
  const fmtTit = cands.find(ehTit) || {...fmtTexto, jc: 'c', fl: 0};
  const fmtLista = cands.find(b => b.rot !== undefined && !/^\*\*/.test(b.txt));
  const fmtTab = corpoMod.find(b => b.t === 'tbl');
  const depoisDe = b => { const k0 = corpoMod.indexOf(b); for (let k = k0 + 1; k < corpoMod.length; k++){ const x = corpoMod[k]; if (x.t === 'p' && !x.img && x.txt.trim()){ return ehTit(x) || ehSig(semMarca(x.txt)) ? fmtTexto : x; } } return fmtTexto; };
  let fmtAtual = fmtTexto, depoisSig = null;
  pars.slice(ini).forEach(p => {
    if (p.tabela?.grade){ out.push(tabelaDocM(p.tabela)); fmtAtual = fmtTexto; return; }
    if (p.tabela){
      if (!fmtTab){ p.tabela.forEach(row => out.push({...fmtTexto, fl: 0, txt: row.map(cel => cel.map(x => x.marc).join(' ')).join(' | ')})); return; }
      const t = JSON.parse(JSON.stringify(fmtTab)), base = t.rows[Math.min(1, t.rows.length - 1)], cab = t.rows[0];
      const ncol = Math.max(...p.tabela.map(r => r.length));
      if (ncol !== fmtTab.cols.length) t.cols = Array(ncol).fill(Math.round(fmtTab.cols.reduce((a, b) => a + b, 0) / ncol));
      t.rows = p.tabela.map((row, ri) => { const m = ri === 0 ? cab : base; return {h: m.h, hr: m.hr, cells: row.map((cel, ci) => { const mc = m.cells[Math.min(ci, m.cells.length - 1)] || m.cells[0]; return {span: 1, vm: '', bord: mc.bord, fill: ri === 0 ? mc.fill : '', va: mc.va, ps: (cel.length ? cel : [{marc: ''}]).map(x => ({...(mc.ps[0] || fmtTexto), rot: undefined, txt: x.marc}))}; })}; });
      out.push(t); return;
    }
    // função logo abaixo do nome na assinatura
    if (depoisSig){ out.push({...depoisSig, rot: undefined, txt: p.marc.replace(/\*\*/g, '')}); depoisSig = null; return; }
    let melhor = null, nm = 0;
    const alinhaOk = b => p.centro ? b.jc === 'c' : p.direita ? b.jc === 'r' : b.jc !== 'c' && b.jc !== 'r';
    cands.forEach(b => { const n = nota(p, b); if (n > nm && (alinhaOk(b) || n >= 0.9)){ nm = n; melhor = b; } });
    // PDF: o formato vem da geometria do próprio arquivo; do modelo, só a linha de data e a assinatura (curtas)
    if (arq.tipo === 'pdf' && !(p.txt.length < 140 && (p.centro || p.direita) && (/^Assinatura digital/i.test(p.txt) || ehLocalData(p.txt) || ehSig(p.txt)) && melhor && nm >= 0.85)) melhor = null;
    const mL = /^([a-z]\)|\d+(\.\d+)*[.)]|[IVXLC]+\s*[-–.)]|[•✓▪-])\s+/.exec(p.txt);
    if (melhor && nm >= 0.5){
      const b = melhor; let txt = p.marc, rot;
      if (b.rot !== undefined && mL){ rot = mL[1].replace(/\s+/g, ''); txt = p.marc.replace(/^(\*\*)?\s*([a-z]\)|\d+(\.\d+)*[.)]|[IVXLC]+\s*[-–.)]|[•✓▪-])\s+/, '$1'); }
      out.push({...b, rot: b.rot !== undefined ? (rot ?? b.rot) : undefined, txt: txt.replace(/\*\*\s*\*\*/g, '').trim()});
      if (ehSig(p.txt)){ const k = corpoMod.indexOf(b); depoisSig = corpoMod.slice(k + 1).find(x => x.t === 'p' && x.txt.trim()) || b; }
      if (ehTit(b)) fmtAtual = depoisDe(b);
      return;
    }
    const pareceTitulo = p.txt.length < 90 && (/^\*\*[^*]+\*\*:?$/.test(p.marc.trim()) || (p.txt === p.txt.toUpperCase() && /[A-Z]{3}/.test(p.txt)));
    if (arq.tipo === 'pdf'){
      // PDF: alinhamento e recuo do próprio arquivo; fonte, entrelinha e espaçamento do manual
      const sb = p.espacoAntes ? Math.max(6, fmtTexto.sa || 6) : 0;
      const sz = Math.abs((p.fsRel || 1) - 1) > 0.08 ? Math.max(8, Math.min(14, Math.round((fmtTexto.sz || 12) * p.fsRel * 2) / 2)) : (fmtTexto.sz || 12);
      const base = {...fmtTexto, __i: undefined, rot: undefined, il: 0, ir: 0, fl: 0, sb, sz, txt: p.marc};
      if (p.centro){ out.push({...base, jc: 'c', sb: pareceTitulo ? Math.max(sb, 6) : sb}); return; }
      if (p.direita){ out.push({...base, jc: 'r'}); return; }
      if (pareceTitulo){ out.push({...base, jc: 'l', sb: Math.max(sb, 6)}); return; }
      if (p.blocoX){ out.push({...base, jc: 'j', il: Math.round(p.blocoPt * 20)}); return; }
      out.push({...base, jc: p.just || p.txt.length > 110 ? 'j' : 'l', fl: p.recuo ? (fmtTexto.fl > 0 ? fmtTexto.fl : Math.round(p.recuoPt * 20)) : 0});
      return;
    }
    if (pareceTitulo){ out.push({...fmtTit, rot: undefined, jc: p.centro ? 'c' : fmtTit.jc, txt: p.marc}); return; }
    if (mL && fmtLista){ out.push({...fmtLista, rot: mL[1].replace(/\s+/g, ''), txt: p.marc.replace(/^(\*\*)?\s*([a-z]\)|\d+(\.\d+)*[.)]|[IVXLC]+\s*[-–.)]|[•✓▪-])\s+/, '$1')}); return; }
    if (p.direita || p.centro){ out.push({...fmtAtual, rot: undefined, jc: p.direita ? 'r' : 'c', fl: 0, il: 0, txt: p.marc}); return; }
    out.push({...fmtAtual, rot: undefined, txt: p.marc});
  });
  // linhas em branco do modelo antes de cada parte (títulos, data, assinatura…)
  const brancosAntes = i => { let n = 0; for (let k = i - 1; k >= 0 && mod[k].t === 'p' && !mod[k].img && !mod[k].txt.trim(); k--) n++; return n; };
  const final = []; let srcAnt = null;
  out.forEach((b, k) => {
    if (b.__i !== undefined && b.__i !== srcAnt && k > 0){ const n = brancosAntes(b.__i); const fb = mod[b.__i - 1]; for (let q = 0; q < n; q++) final.push({...(fb || b), txt: '', rot: undefined}); }
    srcAnt = b.__i; final.push(b);
  });
  return final.map(b => { const c = {...b}; delete c.__i; if (c.rot === undefined) delete c.rot; return c; });
}

/* ---------- botões “Editar arquivo já feito” ---------- */
let impDestino = null;
function pedirArquivoPronto(destino){ impDestino = destino; $('#imp-arq').value = ''; $('#imp-arq').click(); }
$('#imp-arq').onchange = async e => {
  const f = e.target.files[0]; if (!f || !impDestino) return;
  if (!confirm(`Trazer o conteúdo de “${f.name}” para este documento?\n\nOs textos atuais serão substituídos pelos do arquivo, já organizados no padrão do manual. Depois é só conferir e editar.`)) return;
  status('Lendo o arquivo…', 'warn');
  try {
    const arq = await lerArquivoPronto(f);
    if (impDestino === 'oficio'){ const o = ofAtual(); o.campos.ov = {}; importarParaOficio(arq.pars, o.campos); o.alteradoEm = new Date().toISOString(); agendarSalvar(); renderEditorOficio(); }
    else if (impDestino === 'os'){ const o = osAtual(); o.campos.ov = {}; importarParaOS(arq, o.campos); mudouOS(o, false); renderEditorOS(); }
    else if (impDestino === 'docm'){ const o = dmAtual(), d = modeloDoc(o); o.blocos = importarParaDocM(arq, d ? d.blocos : o.blocos); mudouDocM(o, false); renderEditorDocM(); }
    registrar('arquivo', `trouxe o conteúdo de “${f.name}” para editar no padrão do manual`);
    status('Conteúdo trazido do arquivo: confira e edite', 'ok');
  } catch (err){ console.error(err); alert('Não consegui aproveitar este arquivo: ' + err.message); status('Não deu para ler o arquivo', 'err'); }
};
$('#of-importar').onclick = () => pedirArquivoPronto('oficio');
$('#os-importar').onclick = () => pedirArquivoPronto('os');
$('#dm-importar').onclick = () => pedirArquivoPronto('docm');
  return {
    setView: v => { viewAtual = v; if (/^dm-/.test(v)){ if (dmCat !== v.slice(3)) dmAtualId = null; dmCat = v.slice(3); } },
    renderOficios, renderOS, renderDocM,
    fechar: () => { ofAtualId = null; osAtualId = null; dmAtualId = null; },
    recarregarProc: () => { procCache = null; },
    CAT_DOCM, CAT_PROC
  };
}
