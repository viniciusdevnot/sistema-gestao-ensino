-- =====================================================================
-- Seções do Estado-Maior no perfil (P1 a P7) e publicação dos elogios pela P1
-- Rode este arquivo uma vez no Supabase (SQL Editor → New query → Run), depois do 003_elogios.sql.
-- Pode rodar de novo sem problema.
-- =====================================================================

-- seção do perfil (só o administrador define): p1 = Seção de Pessoal, que recebe os elogios autorizados e publica no boletim
alter table public.perfis add column if not exists secao text not null default '';
do $$ begin
  alter table public.perfis add constraint perfis_secao_ok check (secao in ('', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'));
exception when duplicate_object then null; end $$;

create or replace function public.protege_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_admin() then
    new.papel := old.papel; new.categoria := old.categoria; new.usuario := old.usuario; new.legado_id := old.legado_id;
    new.funcao := old.funcao; new.secao := old.secao;
  end if;
  return new;
end $$;

create or replace function public.eh_p1() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select secao from public.perfis where id = auth.uid()), '') = 'p1';
$$;

-- regras do pedido de elogio:
--   Cmt/Subcmt do BTL autoriza (ou devolve); a P1 marca como publicado (ou desfaz); o administrador pode tudo.
--   Depois de autorizado, quem não autoriza só mexe na publicação (P1) — o texto do pedido fica como foi autorizado.
create or replace function public.protege_elogio() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  adm boolean := public.eh_admin();
  autoriza boolean := public.eh_autorizador_elogio() or adm;
  p1 boolean := public.eh_p1() or adm;
begin
  if tg_op = 'INSERT' then
    if new.situacao = 'publicado' and not adm then raise exception 'Um pedido novo não pode começar como publicado.'; end if;
    if new.situacao = 'autorizado' and not autoriza then raise exception 'Só o Comandante (ou Subcomandante) do BTL autoriza elogios.'; end if;
    new.autor_id := coalesce(auth.uid(), new.autor_id);
  else
    new.autor_id := old.autor_id; new.criado_em := old.criado_em;
    if (new.situacao = 'publicado') <> (old.situacao = 'publicado') and not p1 then
      raise exception 'Quem marca como publicado (ou desfaz) é a P1 – Seção de Pessoal.';
    end if;
    if new.situacao = 'autorizado' and old.situacao not in ('autorizado', 'publicado') and not autoriza then
      raise exception 'Só o Comandante (ou Subcomandante) do BTL autoriza elogios.';
    end if;
    if old.situacao in ('autorizado', 'publicado') and new.situacao not in ('autorizado', 'publicado') and not autoriza then
      raise exception 'Este elogio já foi autorizado pelo Comandante do BTL e não pode mais ser alterado.';
    end if;
    if not autoriza and old.situacao in ('autorizado', 'publicado') then
      if not p1 then raise exception 'Este elogio já foi autorizado pelo Comandante do BTL e não pode mais ser alterado.'; end if;
      -- P1: só os dados da publicação e o andamento
      new.dados := old.dados || jsonb_build_object('publicacao', coalesce(new.dados->'publicacao', old.dados->'publicacao'), 'historico', coalesce(new.dados->'historico', old.dados->'historico'));
      new.tipo := old.tipo; new.data_fato := old.data_fato; new.titulo := old.titulo;
    end if;
    if not autoriza then new.autorizado_por := old.autorizado_por; new.autorizado_em := old.autorizado_em; end if;
  end if;
  if new.situacao = 'autorizado' and (tg_op = 'INSERT' or old.situacao not in ('autorizado', 'publicado')) and new.autorizado_por is null then
    new.autorizado_por := auth.uid(); new.autorizado_em := now();
  end if;
  new.alterado_em := now();
  return new;
end $$;

-- a P1 vê e atualiza os pedidos autorizados e publicados
drop policy if exists elogios_ler on public.elogios;
create policy elogios_ler on public.elogios for select to authenticated
  using (autor_id = auth.uid() or public.eh_admin()
         or (public.eh_autorizador_elogio() and situacao <> 'rascunho')
         or (public.eh_p1() and situacao in ('autorizado', 'publicado')));
drop policy if exists elogios_alterar on public.elogios;
create policy elogios_alterar on public.elogios for update to authenticated
  using (autor_id = auth.uid() or public.eh_admin()
         or (public.eh_autorizador_elogio() and situacao <> 'rascunho')
         or (public.eh_p1() and situacao in ('autorizado', 'publicado')));

notify pgrst, 'reload schema';
