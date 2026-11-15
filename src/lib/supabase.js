import { createClient } from '@supabase/supabase-js';

// Endereço e chave pública (publishable) do projeto no Supabase. São públicos por natureza:
// o que protege os dados são as regras de acesso (RLS) do banco. Podem ser trocados pelas
// variáveis de ambiente VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY, se um dia mudar o projeto.
const PADRAO_URL = 'https://ljcudiuyqyhiourzhiec.supabase.co';
const PADRAO_CHAVE = 'sb_publishable_CgGBEuc_MWRIZ1oxKt9b_Q_kwTZY4cj';

const url = import.meta.env.VITE_SUPABASE_URL || PADRAO_URL;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY || PADRAO_CHAVE;

export const configurado = !!(url && chave);
export const sb = configurado ? createClient(url, chave, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
