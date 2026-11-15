-- =====================================================================
--  Sistema de Gestão de Ensino — PM-TO
--  Esquema do banco (Supabase / PostgreSQL)
--  Rode este arquivo inteiro uma vez em: Supabase › SQL Editor › New query
-- =====================================================================

-- ---------- PERFIS (1 por usuário do login) ----------
create table if not exists public.perfis (
  id            uuid primary key references auth.users(id) on delete cascade,
  usuario       text not null unique check (usuario ~ '^[a-z0-9._-]{3,30}$'),
  nome          text not null,
  posto         text default '',
  setor         text default '',
  categoria     text not null default 'praca' check (categoria in ('oficial','praca')),
  papel         text not null default 'usuario' check (papel in ('usuario','admin')),
  foto          text,                       -- caminho no Storage (bucket arquivos) ou null
  tema          text default 'claro',
  guia_visto    timestamptz,
  guia_ver      int default 0,
  trocar_senha  boolean not null default false,
  legado_id     text,                       -- id do perfil no dados.json antigo (migração)
  log_visto_em  timestamptz,                -- admin: até quando já viu os registros
  criado_em     timestamptz not null default now(),
  ultimo_acesso timestamptz
);

-- é administrador?
create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = auth.uid() and papel = 'admin');
$$;

-- é oficial (ou admin)?
create or replace function public.eh_oficial() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = auth.uid() and (categoria = 'oficial' or papel = 'admin'));
$$;

-- novo usuário do Auth → cria o perfil com os dados do cadastro.
-- O PRIMEIRO usuário cadastrado vira administrador.
create or replace function public.novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, usuario, nome, posto, setor, categoria, papel, legado_id, trocar_senha)
  values (
    new.id,
    lower(coalesce(new.raw_user_meta_data->>'usuario', split_part(new.email, '@', 1))),
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'posto', ''),
    coalesce(new.raw_user_meta_data->>'setor', ''),
    coalesce(new.raw_user_meta_data->>'categoria', 'praca'),
    case when exists (select 1 from public.perfis where papel = 'admin') then 'usuario' else 'admin' end,
    new.raw_user_meta_data->>'legado_id',
    coalesce((new.raw_user_meta_data->>'trocar_senha')::boolean, false)
  );
  return new;
end $$;
drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users for each row execute function public.novo_usuario();

-- quem não é admin não pode mudar o próprio papel, categoria nem usuário
create or replace function public.protege_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_admin() then
    new.papel := old.papel; new.categoria := old.categoria; new.usuario := old.usuario; new.legado_id := old.legado_id;
  end if;
  return new;
end $$;
drop trigger if exists antes_alterar_perfil on public.perfis;
create trigger antes_alterar_perfil before update on public.perfis for each row execute function public.protege_perfil();

alter table public.perfis enable row level security;
drop policy if exists perfis_ler on public.perfis;
create policy perfis_ler on public.perfis for select to authenticated using (true);
drop policy if exists perfis_editar on public.perfis;
create policy perfis_editar on public.perfis for update to authenticated using (id = auth.uid() or public.eh_admin());
drop policy if exists perfis_excluir on public.perfis;
create policy perfis_excluir on public.perfis for delete to authenticated using (public.eh_admin());

-- tela de login: mostra nome/foto de quem salvou o usuário no computador (sem precisar estar logado)
create or replace function public.perfil_publico(p_usuario text)
returns table (nome text, posto text, foto text)
language sql stable security definer set search_path = public as $$
  select nome, posto, foto from public.perfis where usuario = lower(p_usuario);
$$;
grant execute on function public.perfil_publico(text) to anon, authenticated;

-- ---------- PEDIDOS DE REDEFINIÇÃO DE SENHA ----------
create table if not exists public.pedidos_senha (
  id          uuid primary key default gen_random_uuid(),
  perfil_id   uuid references public.perfis(id) on delete cascade,
  usuario     text not null,
  msg         text default '',
  status      text not null default 'pendente' check (status in ('pendente','atendido','recusado','cancelado')),
  em          timestamptz not null default now(),
  atendido_em timestamptz
);
alter table public.pedidos_senha enable row level security;
drop policy if exists pedidos_admin on public.pedidos_senha;
create policy pedidos_admin on public.pedidos_senha for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

-- "Esqueci minha senha" (sem login): só registra o pedido se o usuário existir
create or replace function public.pedir_redefinicao(p_usuario text, p_msg text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from public.perfis where usuario = lower(trim(p_usuario));
  if v_id is null then return false; end if;
  update public.pedidos_senha set em = now(), msg = coalesce(nullif(p_msg, ''), msg) where perfil_id = v_id and status = 'pendente';
  if not found then insert into public.pedidos_senha (perfil_id, usuario, msg) values (v_id, lower(trim(p_usuario)), coalesce(p_msg, '')); end if;
  insert into public.registros (perfil_id, quem, tipo, acao) values (v_id, (select nome from public.perfis where id = v_id), 'perfil', 'pediu redefinição de senha (usuário ' || lower(trim(p_usuario)) || ')');
  return true;
end $$;

-- ---------- REGISTROS (o que cada um fez) ----------
create table if not exists public.registros (
  id        bigint generated always as identity primary key,
  quando    timestamptz not null default now(),
  perfil_id uuid references public.perfis(id) on delete set null,
  quem      text not null default '',
  tipo      text not null default 'geral',
  acao      text not null
);
create index if not exists registros_quando on public.registros (quando desc);
alter table public.registros enable row level security;
drop policy if exists registros_inserir on public.registros;
create policy registros_inserir on public.registros for insert to authenticated with check (perfil_id = auth.uid() or public.eh_admin());
drop policy if exists registros_ler on public.registros;
create policy registros_ler on public.registros for select to authenticated using (public.eh_admin());
drop policy if exists registros_excluir on public.registros;
create policy registros_excluir on public.registros for delete to authenticated using (public.eh_admin());
grant execute on function public.pedir_redefinicao(text, text) to anon, authenticated;

-- ---------- DOCUMENTOS DE CADA USUÁRIO ----------
-- Conteúdo em JSON (mesma estrutura do sistema), com colunas para busca e permissões.
-- Cada um vê e edita os seus; o administrador vê todos.
do $$
declare t text;
begin
  foreach t in array array['escalas_aco','oficios','ordens_servico','documentos','planilhas'] loop
    execute format($f$
      create table if not exists public.%1$I (
        id          uuid primary key default gen_random_uuid(),
        autor_id    uuid references public.perfis(id) on delete set null,
        autor       text default '',
        titulo      text default '',
        tipo        text default '',
        dados       jsonb not null default '{}'::jsonb,
        excluido_em timestamptz,          -- lixeira (exclusão lógica)
        legado_id   text,
        criado_em   timestamptz not null default now(),
        alterado_em timestamptz not null default now()
      );
      create index if not exists %1$s_autor on public.%1$I (autor_id);
      alter table public.%1$I enable row level security;
      drop policy if exists %1$s_ler on public.%1$I;
      create policy %1$s_ler on public.%1$I for select to authenticated using (autor_id = auth.uid() or public.eh_admin());
      drop policy if exists %1$s_inserir on public.%1$I;
      create policy %1$s_inserir on public.%1$I for insert to authenticated with check (autor_id = auth.uid() or public.eh_admin());
      drop policy if exists %1$s_editar on public.%1$I;
      create policy %1$s_editar on public.%1$I for update to authenticated using (autor_id = auth.uid() or public.eh_admin());
      drop policy if exists %1$s_excluir on public.%1$I;
      create policy %1$s_excluir on public.%1$I for delete to authenticated using (autor_id = auth.uid() or public.eh_admin());
    $f$, t);
  end loop;
end $$;

-- Procedimentos (MPPADMIS) ficam em "documentos" com tipo 'pr-…'; só oficiais podem criar.
drop policy if exists documentos_inserir on public.documentos;
create policy documentos_inserir on public.documentos for insert to authenticated
  with check ((autor_id = auth.uid() or public.eh_admin()) and (tipo not like 'pr-%' or public.eh_oficial()));

-- ---------- HISTÓRICO DE ACO (Painel) — vale para todos e não some ao limpar escalas ----------
create table if not exists public.historico_aco (
  id        uuid primary key default gen_random_uuid(),
  chave     text not null,              -- matrícula/CPF/nome normalizado do policial
  dados     jsonb not null default '{}'::jsonb,
  escala_id uuid,
  data      date,
  criado_em timestamptz not null default now()
);
create index if not exists historico_aco_chave on public.historico_aco (chave);
alter table public.historico_aco enable row level security;
drop policy if exists historico_ler on public.historico_aco;
create policy historico_ler on public.historico_aco for select to authenticated using (true);
drop policy if exists historico_inserir on public.historico_aco;
create policy historico_inserir on public.historico_aco for insert to authenticated with check (true);
drop policy if exists historico_excluir on public.historico_aco;
create policy historico_excluir on public.historico_aco for delete to authenticated using (public.eh_admin());

-- ---------- CONFIGURAÇÕES COMPARTILHADAS ----------
-- chaves: 'manual_redacao', 'almanaque', 'cfg_aco', 'antiguidade_manual', ...
create table if not exists public.configuracoes (
  chave       text primary key,
  valor       jsonb not null default '{}'::jsonb,
  alterado_em timestamptz not null default now(),
  alterado_por uuid references public.perfis(id) on delete set null
);
alter table public.configuracoes enable row level security;
drop policy if exists config_ler on public.configuracoes;
create policy config_ler on public.configuracoes for select to authenticated using (true);
-- qualquer usuário pode gravar a antiguidade manual; o resto só o admin (manual, almanaque, limites de ACO)
drop policy if exists config_gravar on public.configuracoes;
create policy config_gravar on public.configuracoes for insert to authenticated with check (public.eh_admin() or chave in ('antiguidade_manual'));
drop policy if exists config_alterar on public.configuracoes;
create policy config_alterar on public.configuracoes for update to authenticated using (public.eh_admin() or chave in ('antiguidade_manual'));
drop policy if exists config_excluir on public.configuracoes;
create policy config_excluir on public.configuracoes for delete to authenticated using (public.eh_admin());

-- ---------- ARQUIVOS (PDFs, almanaques, fotos, documentos gerados) ----------
insert into storage.buckets (id, name, public) values ('arquivos', 'arquivos', false)
  on conflict (id) do nothing;
drop policy if exists arquivos_ler on storage.objects;
create policy arquivos_ler on storage.objects for select to authenticated using (bucket_id = 'arquivos');
drop policy if exists arquivos_enviar on storage.objects;
create policy arquivos_enviar on storage.objects for insert to authenticated with check (bucket_id = 'arquivos');
drop policy if exists arquivos_trocar on storage.objects;
create policy arquivos_trocar on storage.objects for update to authenticated using (bucket_id = 'arquivos' and (owner = auth.uid() or public.eh_admin()));
drop policy if exists arquivos_excluir on storage.objects;
create policy arquivos_excluir on storage.objects for delete to authenticated using (bucket_id = 'arquivos' and (owner = auth.uid() or public.eh_admin()));

-- ---------- ETAPA 2: ESCALA DE ACO (também em 002_aco.sql) ----------
-- =====================================================================

-- Histórico do Painel: uma linha por escala gerada (id = id da escala).
alter table public.historico_aco add column if not exists autor_id uuid default auth.uid();
alter table public.historico_aco alter column chave set default '';
drop policy if exists historico_inserir on public.historico_aco;
create policy historico_inserir on public.historico_aco for insert to authenticated
  with check (autor_id = auth.uid() or public.eh_admin());
drop policy if exists historico_alterar on public.historico_aco;
create policy historico_alterar on public.historico_aco for update to authenticated
  using (autor_id = auth.uid() or public.eh_admin());
drop policy if exists historico_excluir on public.historico_aco;
create policy historico_excluir on public.historico_aco for delete to authenticated
  using (autor_id = auth.uid() or public.eh_admin());

-- Resumo de TODAS as escalas (sem os arquivos importados), para:
--  • bloquear quem já está escalado em outra ACO no mesmo dia;
--  • numerar a escala seguindo as do mês;
--  • tirar do Painel as escalas que estão em Excluídas.
create or replace function public.aco_resumo()
returns table (id uuid, autor_id uuid, autor text, excluido_em timestamptz, alterado_em timestamptz, dados jsonb)
language sql stable security definer set search_path = public as $$
  select e.id, e.autor_id, e.autor, e.excluido_em, e.alterado_em, e.dados - 'rp' - 'efetivo'
  from public.escalas_aco e
  where auth.uid() is not null;
$$;
revoke all on function public.aco_resumo() from public, anon;
grant execute on function public.aco_resumo() to authenticated;
