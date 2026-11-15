/* Escala de ACO ⇄ banco de dados (Supabase) */
import { sb } from '../lib/supabase.js';
import { est, migrarEscala, PRAZO_LIXEIRA, registroHistorico, minhaEscala, descEscala } from './logica.js';

const falha = (error, msg) => { if (error) throw new Error(msg ? `${msg}: ${error.message}` : error.message); };

const paraEscala = l => { const e = { ...(l.dados || {}), id: l.id, autorId: l.autor_id, autor: l.dados?.autor || l.autor || '' }; if (l.excluido_em) e.excluidaEm = l.excluido_em; return e; };

/* carrega tudo o que a Escala de ACO e o Painel usam */
export async function carregarACO(perfil, ehAdmin){
  est.ehAdmin = !!ehAdmin; est.perfilId = perfil?.id || null; est.quem = [perfil?.posto, perfil?.nome].filter(Boolean).join(' ');
  const [res, hist, cfg] = await Promise.all([
    sb.rpc('aco_resumo'),
    sb.from('historico_aco').select('id, dados'),
    sb.from('configuracoes').select('chave, valor').in('chave', ['almanaque', 'cfg_aco', 'antiguidade_manual'])
  ]);
  falha(res.error, 'Escalas de ACO'); falha(hist.error, 'Histórico de ACO'); falha(cfg.error, 'Configurações');
  const todas = (res.data || []).map(paraEscala);
  est.escalas = todas.filter(e => !e.excluidaEm).map(migrarEscala);
  est.lixeira = todas.filter(e => e.excluidaEm).map(migrarEscala);
  est.historico = Object.fromEntries((hist.data || []).map(h => [h.id, h.dados || {}]));
  const c = Object.fromEntries((cfg.data || []).map(x => [x.chave, x.valor]));
  est.almanaque = c.almanaque || null; est.config = c.cfg_aco || {}; est.antigManual = c.antiguidade_manual || {};
  // atualiza a escala aberta, se houver
  if (est.atual){ const i = est.escalas.findIndex(x => x.id === est.atual.id); if (i >= 0) est.escalas[i] = est.atual; }
  return est;
}

/* abre a escala completa (com os arquivos importados) */
export async function abrirEscala(id){
  const { data, error } = await sb.from('escalas_aco').select('*').eq('id', id).single(); falha(error);
  const e = migrarEscala(paraEscala(data));
  const i = est.escalas.findIndex(x => x.id === id); if (i >= 0) est.escalas[i] = e; else est.escalas.push(e);
  est.atual = e;
  return e;
}

/* grava a escala inteira */
export async function gravarEscala(e){
  const dados = JSON.parse(JSON.stringify(e)); delete dados.id; delete dados.autorId; delete dados.excluidaEm;
  const linha = { id: e.id, autor_id: e.autorId, autor: e.autor || '', titulo: descEscala(e), tipo: e.tipo, dados, alterado_em: new Date().toISOString() };
  const { error } = await sb.from('escalas_aco').upsert(linha); falha(error, 'Salvar escala');
}

export async function moverParaLixeira(e, quem){
  const em = new Date().toISOString();
  const { error } = await sb.from('escalas_aco').update({ excluido_em: em }).eq('id', e.id); falha(error);
  e.excluidaEm = em; e.excluidaPor = quem;
  est.escalas = est.escalas.filter(x => x.id !== e.id); est.lixeira.push(e);
  if (est.atual?.id === e.id) est.atual = null;
}
export async function restaurar(e){
  const { error } = await sb.from('escalas_aco').update({ excluido_em: null }).eq('id', e.id); falha(error);
  delete e.excluidaEm; delete e.excluidaPor;
  est.lixeira = est.lixeira.filter(x => x.id !== e.id); est.escalas.push(e);
}
export async function excluirDeVez(e){
  await sb.from('historico_aco').delete().eq('id', e.id);
  const { error } = await sb.from('escalas_aco').delete().eq('id', e.id); falha(error);
  est.lixeira = est.lixeira.filter(x => x.id !== e.id); delete est.historico[e.id];
}
/* Regra: escala excluída fica 1 dia em Excluídas; depois some do sistema */
export async function purgarLixeira(registrar){
  const agora = Date.now();
  const vencidas = est.lixeira.filter(e => minhaEscala(e) && agora - new Date(e.excluidaEm || 0).getTime() >= PRAZO_LIXEIRA);
  for (const e of vencidas){
    try { await excluirDeVez(e); registrar?.('sistema', `removeu automaticamente a ${descEscala(e)} (mais de 1 dia em Excluídas)`, 'Sistema'); } catch {}
  }
  return vencidas.length;
}

/* histórico do Painel (quem tirou ACO) */
export async function gravarHistorico(e){
  if (!e?.contabilizado) return;
  const h = registroHistorico(e);
  const { error } = await sb.from('historico_aco').upsert({ id: e.id, chave: 'escala', escala_id: e.id, data: e.data || null, dados: h, autor_id: e.autorId }); falha(error, 'Contagem do Painel');
  est.historico[e.id] = h;
}

/* configurações compartilhadas */
export async function gravarConfig(chave, valor, perfilId){
  const { error } = await sb.from('configuracoes').upsert({ chave, valor, alterado_em: new Date().toISOString(), alterado_por: perfilId }); falha(error);
}

// só no ambiente de teste (prints do guia)
if (import.meta.env?.MODE === 'teste') globalThis.__sgeAcoDados = { gravarConfig };
