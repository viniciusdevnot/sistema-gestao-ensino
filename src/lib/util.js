export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
export const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
export const normUser = u => (u || '').trim().toLowerCase();
export const SENHA_MIN = 6;
export const DOMINIO_LOGIN = 'sge.pmto';
export const emailDe = usuario => `${normUser(usuario)}@${DOMINIO_LOGIN}`;
export const dataHora = iso => iso ? new Date(iso).toLocaleString('pt-BR') : '—';
export const iniciais = nome => String(nome || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();

export function validaSenha(a, b){
  if ((a || '').length < SENHA_MIN) return `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`;
  if (a !== b) return 'As senhas não conferem.';
  return '';
}
export function validaUsuario(u){
  if (!u) return 'Informe um usuário.';
  if (!/^[a-z0-9._-]{3,30}$/.test(u)) return 'Usuário: 3 a 30 caracteres, só letras sem acento, números, ponto, hífen ou sublinhado.';
  return '';
}
/* oficial ou praça pelo posto (perfis antigos sem a escolha) */
export const POSTO_OFICIAL = /^\s*(CEL|CORONEL|TEN\.?\s*CEL|TC|MAJ|MAJOR|CAP|CAPIT|1[º°O]?\s*TEN|2[º°O]?\s*TEN|TEN\b|TENENTE|ASP|ASPIRANTE)/i;

/* imagem → data URL reduzida (fotos de perfil) */
export function reduzirImagem(file, lado = 240){
  return new Promise((ok, erro) => {
    const fr = new FileReader();
    fr.onload = () => { const img = new Image(); img.onload = () => {
      const k = Math.min(1, lado / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', 0.85)); };
      img.onerror = erro; img.src = fr.result; };
    fr.onerror = erro; fr.readAsDataURL(file);
  });
}
