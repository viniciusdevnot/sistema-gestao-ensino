// Funções do administrador que precisam da chave secreta do Supabase (rodam no servidor do Netlify):
//  - redefinir a senha de um usuário (senha provisória)
//  - excluir um usuário
//  - criar usuários na migração do dados.json antigo
import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DOMINIO = 'sge.pmto';                // usuários entram como "usuario@sge.pmto" no Supabase Auth

const resp = (status, corpo) => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });

export default async (req) => {
  if (req.method !== 'POST') return resp(405, { erro: 'Use POST.' });
  if (!URL || !SERVICE) return resp(500, { erro: 'Faltam as variáveis VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no Netlify.' });
  const sb = createClient(URL, SERVICE, { auth: { persistSession: false } });

  // quem está chamando precisa ser administrador
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: quem } = await sb.auth.getUser(token);
  if (!quem?.user) return resp(401, { erro: 'Sessão inválida. Entre de novo.' });
  const { data: perfil } = await sb.from('perfis').select('papel, nome').eq('id', quem.user.id).single();
  if (perfil?.papel !== 'admin') return resp(403, { erro: 'Só o administrador pode fazer isso.' });

  let corpo; try { corpo = await req.json(); } catch { return resp(400, { erro: 'Pedido inválido.' }); }
  const { acao } = corpo;

  if (acao === 'redefinir-senha') {
    const { perfilId, senha } = corpo;
    if (!perfilId || !senha || senha.length < 6) return resp(400, { erro: 'Senha provisória com pelo menos 6 caracteres.' });
    const { error } = await sb.auth.admin.updateUserById(perfilId, { password: senha });
    if (error) return resp(400, { erro: error.message });
    await sb.from('perfis').update({ trocar_senha: true }).eq('id', perfilId);
    await sb.from('pedidos_senha').update({ status: 'atendido', atendido_em: new Date().toISOString() }).eq('perfil_id', perfilId).eq('status', 'pendente');
    return resp(200, { ok: true });
  }

  if (acao === 'excluir-usuario') {
    const { perfilId } = corpo;
    if (perfilId === quem.user.id) return resp(400, { erro: 'Você não pode excluir o próprio usuário.' });
    const { error } = await sb.auth.admin.deleteUser(perfilId);
    if (error) return resp(400, { erro: error.message });
    return resp(200, { ok: true });
  }

  if (acao === 'criar-usuarios') {
    // migração: cria cada usuário com senha provisória (o sistema pede para trocar no 1º acesso)
    const criados = [], erros = [];
    for (const u of corpo.usuarios || []) {
      const email = `${u.usuario}@${DOMINIO}`;
      const { data, error } = await sb.auth.admin.createUser({
        email, password: u.senha, email_confirm: true,
        user_metadata: { usuario: u.usuario, nome: u.nome, posto: u.posto || '', setor: u.setor || '', categoria: u.categoria || 'praca', legado_id: u.legadoId || null, trocar_senha: true }
      });
      if (error) erros.push({ usuario: u.usuario, erro: error.message });
      else criados.push({ usuario: u.usuario, id: data.user.id, legadoId: u.legadoId });
    }
    return resp(200, { criados, erros });
  }

  return resp(400, { erro: 'Ação desconhecida.' });
};
