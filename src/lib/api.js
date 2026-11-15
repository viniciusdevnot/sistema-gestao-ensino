/* Camada de dados: tudo que lê ou grava no Supabase passa por aqui. */
import { sb } from './supabase.js';
import { emailDe, normUser } from './util.js';

const falha = (error, msg) => { if (error) throw new Error(msg ? `${msg}: ${error.message}` : error.message); };

/* ---------- sessão ---------- */
export async function sessaoAtual(){ const { data } = await sb.auth.getSession(); return data.session; }
export function aoMudarSessao(fn){ const { data } = sb.auth.onAuthStateChange((_e, s) => fn(s)); return () => data.subscription.unsubscribe(); }

export async function entrar(usuario, senha){
  const { data, error } = await sb.auth.signInWithPassword({ email: emailDe(usuario), password: senha });
  if (error) throw new Error(/invalid/i.test(error.message) ? 'Usuário ou senha incorretos.' : error.message);
  return data.session;
}
export async function sair(){ await sb.auth.signOut(); }

export async function criarUsuario({ usuario, senha, nome, posto, setor, categoria }){
  const { data, error } = await sb.auth.signUp({ email: emailDe(usuario), password: senha, options: { data: { usuario: normUser(usuario), nome, posto, setor, categoria } } });
  if (error) throw new Error(/already|registered|exists/i.test(error.message) ? 'Esse usuário já existe. Escolha outro.' : error.message);
  if (!data.session) throw new Error('O Supabase está pedindo confirmação de e-mail. Desative em Authentication › Providers › Email › “Confirm email”.');
  return data.session;
}
export async function trocarSenha(usuario, atual, nova){
  const { error: e1 } = await sb.auth.signInWithPassword({ email: emailDe(usuario), password: atual });
  if (e1) throw new Error('A senha atual está incorreta.');
  const { error } = await sb.auth.updateUser({ password: nova }); falha(error);
}
export async function definirNovaSenha(nova, perfilId){
  const { error } = await sb.auth.updateUser({ password: nova }); falha(error);
  const { error: e2 } = await sb.from('perfis').update({ trocar_senha: false }).eq('id', perfilId); falha(e2);
}
export async function pedirRedefinicao(usuario, msg){
  const { data, error } = await sb.rpc('pedir_redefinicao', { p_usuario: normUser(usuario), p_msg: msg || '' }); falha(error);
  return data;
}
export async function perfilPublico(usuario){
  const { data } = await sb.rpc('perfil_publico', { p_usuario: normUser(usuario) });
  return data?.[0] || null;
}

/* ---------- perfis ---------- */
export async function meuPerfil(id){ const { data, error } = await sb.from('perfis').select('*').eq('id', id).single(); falha(error); return data; }
export async function listarPerfis(){ const { data, error } = await sb.from('perfis').select('*').order('nome'); falha(error); return data; }
export async function salvarPerfil(id, campos){ const { data, error } = await sb.from('perfis').update(campos).eq('id', id).select().single(); falha(error); return data; }
export async function excluirPerfilAdmin(id){ return funcaoAdmin({ acao: 'excluir-usuario', perfilId: id }); }
export async function redefinirSenhaAdmin(id, senha){ return funcaoAdmin({ acao: 'redefinir-senha', perfilId: id, senha }); }
export async function criarUsuariosAdmin(usuarios){ return funcaoAdmin({ acao: 'criar-usuarios', usuarios }); }

async function funcaoAdmin(corpo){
  const s = await sessaoAtual();
  const r = await fetch('/.netlify/functions/admin', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + s?.access_token }, body: JSON.stringify(corpo) });
  let j = {}; try { j = await r.json(); } catch {}
  if (!r.ok) throw new Error(j.erro || `Falha na função do servidor (${r.status}). Confira se o site está publicado no Netlify com a chave SUPABASE_SERVICE_ROLE_KEY.`);
  return j;
}

/* ---------- pedidos de senha ---------- */
export async function pedidosPendentes(){ const { data, error } = await sb.from('pedidos_senha').select('*').eq('status', 'pendente').order('em'); falha(error); return data; }
export async function recusarPedido(id){ const { error } = await sb.from('pedidos_senha').update({ status: 'recusado' }).eq('id', id); falha(error); }

/* ---------- registros ---------- */
export async function registrar(perfil, tipo, acao, quem){
  if (!perfil) return;
  await sb.from('registros').insert({ perfil_id: perfil.id, quem: quem || [perfil.posto, perfil.nome].filter(Boolean).join(' '), tipo, acao });
}
export async function listarRegistros({ limite = 500, tipo, busca } = {}){
  let q = sb.from('registros').select('*').order('quando', { ascending: false }).limit(limite);
  if (tipo) q = q.eq('tipo', tipo);
  if (busca) q = q.or(`acao.ilike.%${busca}%,quem.ilike.%${busca}%`);
  const { data, error } = await q; falha(error); return data;
}
export async function contarRegistrosDesde(iso){
  let q = sb.from('registros').select('id', { count: 'exact', head: true });
  if (iso) q = q.gt('quando', iso);
  const { count } = await q; return count || 0;
}

/* ---------- documentos (escalas, ofícios, OS, documentos, planilhas) ---------- */
export async function listar(tabela, { autorId, tipo, lixeira = false } = {}){
  let q = sb.from(tabela).select('id, autor_id, autor, titulo, tipo, criado_em, alterado_em, excluido_em').order('alterado_em', { ascending: false });
  q = lixeira ? q.not('excluido_em', 'is', null) : q.is('excluido_em', null);
  if (autorId) q = q.eq('autor_id', autorId);
  if (tipo) q = q.eq('tipo', tipo);
  const { data, error } = await q; falha(error); return data;
}
export async function abrir(tabela, id){ const { data, error } = await sb.from(tabela).select('*').eq('id', id).single(); falha(error); return data; }
export async function gravar(tabela, reg){
  const linha = { ...reg, alterado_em: new Date().toISOString() };
  const { data, error } = await sb.from(tabela).upsert(linha).select().single(); falha(error); return data;
}
export async function inserirVarios(tabela, linhas){ if (!linhas.length) return; for (let i = 0; i < linhas.length; i += 200){ const { error } = await sb.from(tabela).insert(linhas.slice(i, i + 200)); falha(error, tabela); } }
export async function excluir(tabela, id, definitivo = false){
  const { error } = definitivo ? await sb.from(tabela).delete().eq('id', id) : await sb.from(tabela).update({ excluido_em: new Date().toISOString() }).eq('id', id);
  falha(error);
}
export async function contar(tabela, autorId){
  let q = sb.from(tabela).select('id', { count: 'exact', head: true }).is('excluido_em', null);
  if (autorId) q = q.eq('autor_id', autorId);
  const { count } = await q; return count || 0;
}

/* ---------- configurações compartilhadas ---------- */
export async function lerConfig(chave){ const { data } = await sb.from('configuracoes').select('valor').eq('chave', chave).maybeSingle(); return data?.valor ?? null; }
export async function gravarConfig(chave, valor, perfilId){ const { error } = await sb.from('configuracoes').upsert({ chave, valor, alterado_em: new Date().toISOString(), alterado_por: perfilId }); falha(error); }

/* ---------- arquivos (Storage) ---------- */
export async function enviarArquivo(caminho, arquivo, tipo){
  const { error } = await sb.storage.from('arquivos').upload(caminho, arquivo, { upsert: true, contentType: tipo || arquivo.type || 'application/octet-stream' }); falha(error, 'Envio do arquivo');
  return caminho;
}
export async function baixarArquivo(caminho){ const { data, error } = await sb.storage.from('arquivos').download(caminho); falha(error); return data; }
export async function linkArquivo(caminho, segundos = 3600){ const { data, error } = await sb.storage.from('arquivos').createSignedUrl(caminho, segundos); falha(error); return data.signedUrl; }
export async function listarArquivos(pasta){ const { data, error } = await sb.storage.from('arquivos').list(pasta, { limit: 1000, sortBy: { column: 'name', order: 'asc' } }); falha(error); return data; }
export async function excluirArquivo(caminho){ const { error } = await sb.storage.from('arquivos').remove([caminho]); falha(error); }
