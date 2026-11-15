-- =====================================================================
-- Etapa 2 — Escala de ACO
-- Rode este arquivo uma vez no Supabase (SQL Editor → New query → Run).
-- Pode rodar de novo sem problema.
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
