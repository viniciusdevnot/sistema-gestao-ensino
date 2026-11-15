import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as api from '../lib/api.js';
import { POSTO_OFICIAL } from '../lib/util.js';

const Ctx = createContext(null);
export const useSessao = () => useContext(Ctx);

export function SessaoProvider({ children }){
  const [sessao, setSessao] = useState(undefined);   // undefined = carregando
  const [perfil, setPerfil] = useState(null);
  const [status, setStatus] = useState({ t: '', cls: '' });

  const carregarPerfil = useCallback(async s => {
    if (!s){ setPerfil(null); return; }
    try {
      const p = await api.meuPerfil(s.user.id);
      setPerfil(p);
    } catch (e){ setPerfil(null); setStatus({ t: 'Não consegui ler seu perfil: ' + e.message, cls: 'err' }); }
  }, []);

  useEffect(() => {
    api.sessaoAtual().then(s => { setSessao(s || null); carregarPerfil(s); });
    return api.aoMudarSessao(s => { setSessao(s || null); carregarPerfil(s); });
  }, [carregarPerfil]);

  useEffect(() => { document.documentElement.dataset.tema = perfil?.tema === 'escuro' ? 'escuro' : 'claro'; }, [perfil?.tema]);

  const valor = {
    sessao, perfil, setPerfil, status,
    avisar: (t, cls = 'ok') => setStatus({ t, cls }),
    ehAdmin: perfil?.papel === 'admin',
    ehOficial: perfil?.papel === 'admin' || (perfil?.categoria || (POSTO_OFICIAL.test(perfil?.posto || '') ? 'oficial' : 'praca')) === 'oficial',
    registrar: (tipo, acao, quem) => api.registrar(perfil, tipo, acao, quem).catch(() => {}),
    recarregarPerfil: () => carregarPerfil(sessao),
    sair: async () => { if (perfil) await api.registrar(perfil, 'acesso', 'saiu do sistema').catch(() => {}); await api.sair(); }
  };
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
