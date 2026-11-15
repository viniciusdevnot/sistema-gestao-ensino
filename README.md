# Sistema de Gestão de Ensino — PM-TO

Versão on-line do sistema: **React** (telas) + **Supabase** (banco de dados PostgreSQL, arquivos e login) + **Netlify** (hospedagem).
Cada atualização enviada ao GitHub é publicada sozinha no Netlify.

## Configuração (uma vez)

### 1. Supabase (banco de dados)
1. Crie uma conta em <https://supabase.com> e um projeto novo. **Região: South America (São Paulo)**.
2. Abra **SQL Editor › New query**, cole todo o arquivo [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**.
3. Em **Authentication › Sign In / Providers › Email**: deixe **Enable Email provider** ligado e **desligue “Confirm email”**
   (o login é por usuário e senha; o sistema não usa e-mail de verdade).
4. Em **Project Settings › API** copie: **Project URL**, a chave **anon public** e a chave **service_role** (secreta).

### 2. GitHub (código)
O código fica num repositório **privado** no GitHub. Toda alteração enviada para a branch `main` vai para o ar.

### 3. Netlify (hospedagem)
1. Em <https://app.netlify.com>: **Add new site › Import an existing project › GitHub** e escolha o repositório.
   As configurações de build vêm do arquivo `netlify.toml` (não precisa mudar nada).
2. **Site configuration › Environment variables** — cadastre só **uma** variável:
   | Variável | Valor |
   |---|---|
   | `SUPABASE_SERVICE_ROLE_KEY` | a chave **secret** do Supabase (`sb_secret_…`) — **só aqui; nunca no código** |

   O endereço do projeto e a chave pública (publishable) já estão no código (`src/lib/supabase.js`).
3. **Deploys › Trigger deploy**. Depois disso, cada atualização no GitHub publica sozinha.

### 4. Primeiro acesso
1. Abra o site e clique em **Criar usuário**. **O primeiro usuário criado vira administrador.**
2. Em **Dados e migração**, escolha o `dados.json` do sistema anterior: usuários, escalas, ofícios, ordens de serviço,
   documentos, planilhas, registros, manual de redação, almanaques e o histórico do painel vêm para o banco.
   Os usuários trazidos entram com a senha provisória definida ali e criam a própria senha no primeiro acesso.
3. (Opcional) Na mesma tela, envie a pasta antiga para levar os PDFs ao armazenamento on-line.

## Desenvolvimento no computador
```bash
npm install
cp .env.example .env      # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev
```

## Estrutura
| Pasta | O que tem |
|---|---|
| `src/telas/` | telas (acesso, painel, perfil, registros, migração…) |
| `src/componentes/` | menu lateral, ícones |
| `src/lib/api.js` | tudo que lê/grava no Supabase |
| `supabase/schema.sql` | tabelas, permissões (RLS) e armazenamento |
| `netlify/functions/admin.mjs` | ações do administrador que usam a chave secreta (redefinir senha, excluir e migrar usuários) |
| `legado/` | código do sistema anterior (referência para as próximas etapas da conversão) |

## Segurança
- Cada usuário só vê e altera os próprios documentos; o administrador vê todos (regras no banco, *Row Level Security*).
- Procedimentos (MPPADMIS) só podem ser criados por oficiais.
- As senhas ficam no Supabase Auth (criptografadas). A chave `service_role` só existe no servidor do Netlify.
- O sistema guarda dados pessoais de policiais (nome, matrícula, CPF). Confirme com a unidade a autorização para hospedá-los
  em nuvem (LGPD) e mantenha o repositório **privado**.

## Etapas da conversão
- [x] **Etapa 1** — base: login, perfis (oficial/praça), administrador, registros, migração do `dados.json`
- [ ] **Etapa 2** — Escala de ACO, Painel e almanaques
- [ ] **Etapa 3** — Ofícios, Ordens de Serviço, Documentos e Procedimentos (com a folha editável)
- [ ] **Etapa 4** — guia do sistema, planilhas e acabamento
