/* Elogios ⇄ banco de dados (tabela elogios — supabase/003_elogios.sql) */
import { sb } from '../lib/supabase.js';
import { tituloPedido } from './regras.js';

const falha = (error, msg) => {
  if (!error) return;
  if (/elogios|funcao|schema cache|does not exist/i.test(error.message || '')) throw new Error('O banco ainda não tem a parte de Elogios. Peça ao administrador para rodar o arquivo supabase/003_elogios.sql no Supabase. (' + error.message + ')');
  throw new Error(msg ? `${msg}: ${error.message}` : error.message);
};
const paraPedido = l => ({ ...(l.dados || {}), id: l.id, autorId: l.autor_id, autor: l.autor, situacao: l.situacao, tipo: l.tipo, autorizadoPor: l.autorizado_por, autorizadoEm: l.autorizado_em, criadoEm: l.criado_em, alteradoEm: l.alterado_em });

export async function listarElogios(){
  const { data, error } = await sb.from('elogios').select('*').order('alterado_em', { ascending: false });
  falha(error); return (data || []).map(paraPedido);
}
export async function fatosElogios(){
  const { data, error } = await sb.rpc('elogios_fatos');
  if (error) return [];
  return data || [];
}
export async function gravarElogio(e, perfil){
  const dados = { ...e };
  ['id', 'autorId', 'autor', 'situacao', 'tipo', 'autorizadoPor', 'autorizadoEm', 'criadoEm', 'alteradoEm'].forEach(k => delete dados[k]);
  const linha = { id: e.id, situacao: e.situacao || 'rascunho', tipo: e.tipo || 'referencia', data_fato: e.fato?.data || null, titulo: tituloPedido(e).slice(0, 200), dados };
  if (!e.autorId){ linha.autor = [perfil?.posto, perfil?.nome].filter(Boolean).join(' '); }
  const { data, error } = await sb.from('elogios').upsert(linha).select().single();
  falha(error); return paraPedido(data);
}
export async function excluirElogio(id){ const { error } = await sb.from('elogios').delete().eq('id', id); falha(error); }
/* quem pode autorizar (para endereçar o ofício) */
export async function comandantes(){
  const { data, error } = await sb.from('perfis').select('id, nome, posto, setor, funcao').in('funcao', ['cmt_btl', 'subcmt_btl']);
  if (error) return [];
  return data || [];
}
export async function contarPendentes(perfil, ehAdmin){
  const autoriza = ehAdmin || perfil?.funcao === 'cmt_btl' || perfil?.funcao === 'subcmt_btl';
  let q = sb.from('elogios').select('id', { count: 'exact', head: true });
  q = autoriza ? q.eq('situacao', 'solicitado') : q.eq('autor_id', perfil?.id).in('situacao', ['rascunho', 'devolvido']);
  const { count, error } = await q; return error ? 0 : (count || 0);
}
