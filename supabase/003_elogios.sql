-- =====================================================================
-- Elogios e Referências Elogiosas (Portaria Normativa nº 020/2025-PM1)
-- Rode este arquivo uma vez no Supabase (SQL Editor → New query → Run).
-- Pode rodar de novo sem problema.
-- =====================================================================

-- Função de comando no perfil (só o administrador define):
--   cmt_btl    = Comandante do BTL (autoriza e encaminha para publicação)
--   subcmt_btl = Subcomandante do BTL (autoriza na ausência do comandante)
--   cmt_cia    = Comandante de Companhia (solicita)
--   cpu        = CPU (solicita)
alter table public.perfis add column if not exists funcao text not null default '';
do $$ begin
  alter table public.perfis add constraint perfis_funcao_ok check (funcao in ('', 'cmt_btl', 'subcmt_btl', 'cmt_cia', 'cpu'));
exception when duplicate_object then null; end $$;

create or replace function public.protege_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_admin() then
    new.papel := old.papel; new.categoria := old.categoria; new.usuario := old.usuario; new.legado_id := old.legado_id;
    new.funcao := old.funcao;
  end if;
  return new;
end $$;

create or replace function public.minha_funcao() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select funcao from public.perfis where id = auth.uid()), '');
$$;
create or replace function public.eh_autorizador_elogio() returns boolean
language sql stable security definer set search_path = public as $$
  select public.minha_funcao() in ('cmt_btl', 'subcmt_btl');
$$;
create or replace function public.pode_solicitar_elogio() returns boolean
language sql stable security definer set search_path = public as $$
  select public.minha_funcao() in ('cmt_btl', 'subcmt_btl', 'cmt_cia', 'cpu') or public.eh_admin();
$$;

-- Os pedidos de elogio
create table if not exists public.elogios (
  id             uuid primary key default gen_random_uuid(),
  autor_id       uuid not null default auth.uid() references public.perfis(id) on delete set null,
  autor          text not null default '',
  situacao       text not null default 'rascunho' check (situacao in ('rascunho', 'solicitado', 'devolvido', 'autorizado', 'publicado')),
  tipo           text not null default 'referencia' check (tipo in ('elogio', 'referencia')),
  data_fato      date,
  titulo         text not null default '',
  dados          jsonb not null default '{}'::jsonb,
  autorizado_por uuid references public.perfis(id) on delete set null,
  autorizado_em  timestamptz,
  criado_em      timestamptz not null default now(),
  alterado_em    timestamptz not null default now()
);
create index if not exists elogios_data_idx on public.elogios (data_fato);

-- Só o Cmt/Subcmt do BTL (ou o administrador) autoriza e marca como publicado;
-- quem solicitou só mexe enquanto o pedido está em rascunho, solicitado ou devolvido.
create or replace function public.protege_elogio() returns trigger
language plpgsql security definer set search_path = public as $$
declare autoriza boolean := public.eh_autorizador_elogio() or public.eh_admin();
begin
  if tg_op = 'INSERT' then
    if new.situacao in ('autorizado', 'publicado') and not autoriza then
      raise exception 'Só o Comandante (ou Subcomandante) do BTL autoriza elogios.';
    end if;
    new.autor_id := coalesce(auth.uid(), new.autor_id);
  else
    new.autor_id := old.autor_id; new.criado_em := old.criado_em;
    if not autoriza then
      if old.situacao in ('autorizado', 'publicado') then
        raise exception 'Este elogio já foi autorizado pelo Comandante do BTL e não pode mais ser alterado.';
      end if;
      if new.situacao in ('autorizado', 'publicado') then
        raise exception 'Só o Comandante (ou Subcomandante) do BTL autoriza elogios.';
      end if;
      new.autorizado_por := old.autorizado_por; new.autorizado_em := old.autorizado_em;
    end if;
  end if;
  if new.situacao = 'autorizado' and (tg_op = 'INSERT' or old.situacao is distinct from 'autorizado') and new.autorizado_por is null then
    new.autorizado_por := auth.uid(); new.autorizado_em := now();
  end if;
  new.alterado_em := now();
  return new;
end $$;
drop trigger if exists antes_gravar_elogio on public.elogios;
create trigger antes_gravar_elogio before insert or update on public.elogios for each row execute function public.protege_elogio();

alter table public.elogios enable row level security;
drop policy if exists elogios_ler on public.elogios;
create policy elogios_ler on public.elogios for select to authenticated
  using (autor_id = auth.uid() or public.eh_admin() or (public.eh_autorizador_elogio() and situacao <> 'rascunho'));
drop policy if exists elogios_inserir on public.elogios;
create policy elogios_inserir on public.elogios for insert to authenticated
  with check (public.pode_solicitar_elogio());
drop policy if exists elogios_alterar on public.elogios;
create policy elogios_alterar on public.elogios for update to authenticated
  using (autor_id = auth.uid() or public.eh_admin() or (public.eh_autorizador_elogio() and situacao <> 'rascunho'));
drop policy if exists elogios_excluir on public.elogios;
create policy elogios_excluir on public.elogios for delete to authenticated
  using ((autor_id = auth.uid() and situacao in ('rascunho', 'devolvido')) or public.eh_admin());

-- Para o aviso de "elogio repetido pelo mesmo fato" (art. 15, VI): só o necessário de TODOS os pedidos
create or replace function public.elogios_fatos()
returns table (id uuid, situacao text, tipo text, data_fato date, bo text, matriculas text[])
language sql stable security definer set search_path = public as $$
  select e.id, e.situacao, e.tipo, e.data_fato, coalesce(e.dados->'fato'->>'bo', ''),
         array(select regexp_replace(coalesce(p->>'matricula', ''), '\D', '', 'g') from jsonb_array_elements(coalesce(e.dados->'policiais', '[]'::jsonb)) p)
  from public.elogios e
  where auth.uid() is not null and e.situacao <> 'rascunho';
$$;
revoke all on function public.elogios_fatos() from public, anon;
grant execute on function public.elogios_fatos() to authenticated;
grant select, insert, update, delete on public.elogios to authenticated;

notify pgrst, 'reload schema';
