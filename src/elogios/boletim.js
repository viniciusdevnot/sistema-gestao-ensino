/* Boletim de Ocorrência / Atendimento (PDF do sistema da PMTO) → dados objetivos do fato para o pedido de elogio.
   Só lê: protocolo, data e hora do fato, local, natureza e a guarnição. Narrativa e conduta continuam vindo do ofício.
   O PDF é lido no navegador e não é guardado; dos participantes (vítimas, autores, testemunhas) nada é aproveitado. */
import { carregarPdfjs } from '../aco/pdf.js';

/* PDF → linhas, cada uma com os pedaços de texto e a posição x (para separar as colunas "Rótulo: valor") */
export async function linhasDoPdf(dados){
  const pdfjs = await carregarPdfjs();
  const doc = await pdfjs.getDocument({ data: dados }).promise;
  const linhas = [];
  for (let n = 1; n <= doc.numPages; n++){
    const pg = await doc.getPage(n), tc = await pg.getTextContent(), grupos = [];
    tc.items.forEach(it => {
      if (!it.str || !it.str.trim()) return;
      const y = it.transform[5], x = it.transform[4], fs = Math.abs(it.transform[3]) || it.height || 10;
      let g = grupos.find(g => Math.abs(g.y - y) < Math.max(1, fs * 0.4));
      if (!g){ g = { y, itens: [] }; grupos.push(g); }
      g.itens.push({ x, s: it.str, w: it.width || 0, fs });
    });
    grupos.sort((a, b) => b.y - a.y).forEach(g => {
      const ps = []; let fim = null;
      g.itens.sort((a, b) => a.x - b.x).forEach(i => {
        const ult = ps[ps.length - 1];
        if (ult && fim !== null && i.x - fim < i.fs * 1.2) ult.s += (i.x - fim > i.fs * 0.12 && !/\s$/.test(ult.s) ? ' ' : '') + i.s;
        else ps.push({ x: i.x, s: i.s });
        fim = i.x + i.w;
      });
      linhas.push({ pag: n, y: g.y, ps: ps.map(p => ({ x: p.x, s: p.s.replace(/\s+/g, ' ').trim() })).filter(p => p.s) });
    });
  }
  try { await doc.cleanup(); } catch {}
  return linhas;
}

const POSTOS = [['SUB TEN', 'ST'], ['SUBTEN', 'ST'], ['ST', 'ST'], ['TEN CEL', 'TEN CEL'], ['CEL', 'CEL'], ['MAJ', 'MAJ'], ['CAP', 'CAP'], ['1º TEN', '1º TEN'], ['2º TEN', '2º TEN'], ['1 TEN', '1º TEN'], ['2 TEN', '2º TEN'], ['ASP OF', 'ASP OF'], ['ASP', 'ASP OF'], ['CAD', 'CAD'],
  ['1º SGT', '1º SGT'], ['2º SGT', '2º SGT'], ['3º SGT', '3º SGT'], ['1 SGT', '1º SGT'], ['2 SGT', '2º SGT'], ['3 SGT', '3º SGT'], ['CB', 'CB'], ['SD', 'SD']];
const PEQ = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas', 'a', 'o', 'ao', 'à']);
const titulo = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim().split(' ').map((w, k) => k && PEQ.has(w) ? w : w.replace(/^./, c => c.toUpperCase())).join(' ');
const semAcento = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

/* linhas → dados do fato e da guarnição */
export function dadosDoBoletim(linhas){
  const txt = l => l.ps.map(p => p.s).join('  ');
  const out = { fato: {}, guarnicao: [], avisos: [] };
  const acha = (re, de = 0) => { for (let i = de; i < linhas.length; i++) if (re.test(txt(linhas[i]))) return i; return -1; };
  // valor que vem logo depois de um rótulo na mesma linha (o pedaço seguinte, ou o resto do mesmo pedaço)
  const valor = (l, rot) => {
    const i = l.ps.findIndex(p => semAcento(p.s).startsWith(semAcento(rot)));
    if (i < 0) return '';
    const resto = l.ps[i].s.slice(rot.length).replace(/^[:\s]+/, '').trim();
    if (resto) return resto;
    const prox = l.ps[i + 1];
    return prox && !/:\s*$/.test(prox.s) && !/^[A-ZÀ-Úa-zà-ú .ºª]+:$/.test(prox.s) ? prox.s.trim() : '';
  };
  const ehRotulo = s => /^[A-ZÀ-Úa-zà-úº ]{2,30}:?$/.test(s) && /:$/.test(s);

  const iProt = acha(/Protocolo:/i);
  if (iProt >= 0){ const v = valor(linhas[iProt], 'Ocorrência Protocolo') || valor(linhas[iProt], 'Protocolo'); out.protocolo = (v.match(/\d{6,}/) || [''])[0]; }
  out.tipoRegistro = /BOLETIM DE ATENDIMENTO/i.test(linhas.slice(0, 12).map(txt).join(' ')) ? 'Boletim de Atendimento Protocolo nº' : 'Boletim de Ocorrência Protocolo nº';
  const iId = acha(/Dados Identificativos da Ocorr/i);
  const base = iId >= 0 ? iId : 0;
  const iFato = acha(/Fato Principal:/i, base);
  if (iFato >= 0) out.fato.natureza = valor(linhas[iFato], 'Fato Principal');
  const iData = acha(/^Data:/i, iFato >= 0 ? iFato : base);
  if (iData >= 0){
    const d = /(\d{2})\/(\d{2})\/(\d{4})/.exec(valor(linhas[iData], 'Data')); if (d) out.fato.data = `${d[3]}-${d[2]}-${d[1]}`;
    const h = /(\d{1,2}):(\d{2})/.exec(valor(linhas[iData], 'Hora')); if (h) out.fato.hora = `${h[1].padStart(2, '0')}:${h[2]}`;
  }
  // endereço do fato: pode quebrar em mais de uma linha (continuação na mesma coluna, sem rótulo)
  const iEnd = acha(/^Endereço:/i, iFato >= 0 ? iFato : base);
  const fimFato = acha(/^Participante\s+\d|^Relatório|^Dados identificativos do Policial/i, base);
  if (iEnd >= 0 && (fimFato < 0 || iEnd < fimFato)){
    const l = linhas[iEnd], k = l.ps.findIndex(p => /^Endere/i.test(p.s)), xv = l.ps[k + 1]?.x;
    let end = valor(l, 'Endereço');
    for (let j = iEnd + 1; j < linhas.length && xv !== undefined; j++){
      const ps = linhas[j].ps; if (!ps.length || ps[0].x < xv - 4 || ehRotulo(ps[0].s)) break;
      end += ' ' + ps[0].s;
    }
    const pega = rot => { const i = acha(new RegExp('^' + rot + ':?', 'i'), iEnd); return i >= 0 && (fimFato < 0 || i < fimFato) ? valor(linhas[i], rot) : ''; };
    const compl = pega('Complemento'), cidade = pega('Cidade'), ref = pega('Ponto Referência');
    out.endereco = { end, compl, cidade, ref };
    out.fato.local = montarLocal(out.endereco);
  }
  // guarnição
  const iG = acha(/Dados identificativos do Policial/i);
  if (iG >= 0){
    let col = null;
    for (let j = iG + 1; j < linhas.length; j++){
      const l = linhas[j], t = txt(l);
      if (/^Mídias|^Midias|^Nome do Arquivo/i.test(t)) break;
      if (/^Função/i.test(t)){ col = { id: l.ps[1]?.x, nome: l.ps[2]?.x }; continue; }
      if (!col) continue;
      const naCol = x => l.ps.find(p => Math.abs(p.x - x) < 12);
      const fn = l.ps[0] && l.ps[0].x < (col.id ?? 1e9) - 10 ? l.ps[0].s : '';
      const id = col.id !== undefined ? naCol(col.id)?.s || '' : '', nome = col.nome !== undefined ? naCol(col.nome)?.s || '' : '';
      if (fn && id){ out.guarnicao.push({ funcao: fn, ident: id, nome }); }
      else if (!fn && !id && nome && out.guarnicao.length) out.guarnicao[out.guarnicao.length - 1].nome += ' ' + nome;
    }
    out.guarnicao = out.guarnicao.map(policialDaGuarnicao);
  }
  if (!out.protocolo) out.avisos.push('não achei o nº do protocolo');
  if (!out.fato.data) out.avisos.push('não achei a data do fato');
  if (!out.guarnicao.length) out.avisos.push('não achei a guarnição');
  return out;
}
// algumas cidades do Tocantins vêm sem acento no sistema do BO
const ACENTOS = { divinopolis: 'Divinópolis', paraiso: 'Paraíso', araguaina: 'Araguaína', marianopolis: 'Marianópolis', abreulandia: 'Abreulândia', araguacema: 'Araguacema', caseara: 'Caseara', chapada: 'Chapada', pium: 'Pium', cristalandia: 'Cristalândia', lagoa: 'Lagoa', confusao: 'Confusão', barrolandia: 'Barrolândia', nazare: 'Nazaré', taquarucu: 'Taquaruçu', tocantinia: 'Tocantínia', miracema: 'Miracema', palmeiropolis: 'Palmeirópolis', gurupi: 'Gurupi', porangatu: 'Porangatu', colinas: 'Colinas', guarai: 'Guaraí', araguatins: 'Araguatins', tocantinopolis: 'Tocantinópolis', 'sao': 'São', 'joao': 'João', 'conceicao': 'Conceição', 'ponte': 'Ponte', 'brejinho': 'Brejinho', 'santa': 'Santa', 'monte': 'Monte', 'pugmil': 'Pugmil' };
const comAcento = s => titulo(s).split(' ').map(w => ACENTOS[w.toLowerCase()] || w).join(' ');
function montarLocal({ end, compl, cidade }){
  const cid = String(cidade || '').replace(/\s+/g, ' ').trim();
  let e = String(end || '').replace(/\s+/g, ' ').trim()
    .replace(/,\s*(0+|S\/?N)\s*(,|$)/i, '$2')                                   // nº "00" ou "S/N"
    .replace(/\s*[-–]\s*([^-–]+)$/, (m, c) => cid && semAcento(c).trim() === semAcento(cid) ? '' : m);  // cidade repetida no fim
  const partes = [comAcento(e)]; if (compl) partes.push(String(compl).toLowerCase().trim());
  return `${/^(rua|avenida|rodovia|pra[çc]a|travessa|alameda|estrada|quadra|ch[áa]cara|fazenda)\b/i.test(e) ? 'na' : 'em'} ${partes.join(', ')}${cid ? `, em ${comAcento(cid)}/TO` : ''}`.replace(/\b(Br|To)-(\d+)/g, (m, a, n) => a.toUpperCase() + '-' + n);
}
/* "SUB TEN 70212 OSÉAS" + "OSÉAS DE PAULA AMORIM CRUZ" → posto ST, matrícula 70212, nome e nome de guerra */
export function policialDaGuarnicao(g){
  let id = String(g.ident || '').replace(/°/g, 'º').trim(), posto = '';
  for (const [a, b] of POSTOS){ const re = new RegExp('^' + a.replace(/º/, '[ºo°]?').replace(/ /g, '\\s*') + '\\b', 'i'); if (re.test(id)){ posto = b; id = id.replace(re, '').trim(); break; } }
  const mat = (id.match(/^\d[\d.\-/]*/) || [''])[0].replace(/\D/g, ''); id = id.replace(/^\d[\d.\-/]*/, '').trim();
  const nome = String(g.nome || '').replace(/\s+/g, ' ').trim().toUpperCase() || id.toUpperCase();
  const guerraPal = semAcento(id).split(/\s+/).filter(Boolean);
  const guerra = nome.split(' ').map((w, k) => guerraPal.includes(semAcento(w)) ? k : -1).filter(k => k >= 0);
  return { funcaoGu: g.funcao, posto, matricula: mat, nome, guerra };
}
export async function lerBoletim(file){
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') throw new Error('Envie o boletim em PDF.');
  const linhas = await linhasDoPdf(new Uint8Array(await file.arrayBuffer()));
  const d = dadosDoBoletim(linhas);
  if (!d.protocolo && !d.fato.data && !d.guarnicao.length) throw new Error('Este PDF não parece um Boletim de Ocorrência/Atendimento da PMTO (não achei protocolo, data nem guarnição).');
  return d;
}
