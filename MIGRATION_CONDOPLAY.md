# Migração CondoPlay → Conta Própria

**Objetivo**: tirar o CondoPlay CRM das contas do João (Wash Me) e colocar tudo sob a identidade nova `condoplayy@gmail.com`, compartilhada com o irmão sócio.

**Princípio**: isolamento 100%. Nenhuma credencial, repositório, serviço ou assinatura cruzada com a Wash Me.

**Duração estimada**: 3–4 horas distribuídas, com paralelismo possível nas Fases 1 e 2.

---

## Ordem de execução

Fases são sequenciais. NÃO pule — cada uma destrava a seguinte.

| Fase | O quê | Quem executa | Reversível? |
|---|---|---|---|
| 0 | Preparação (Gmail + 2FA + gerenciador de senha) | João | ✅ |
| 1 | Criar contas novas em todas as plataformas | João | ✅ |
| 2 | Exportar banco Supabase atual | João (comando pronto) | ✅ |
| 3 | Criar Supabase novo e importar | João | ✅ |
| 4 | Transferir repositório GitHub | João | ✅ |
| 5 | Criar Vercel novo e subir deploy | João | ✅ |
| 6 | Rotacionar todas as API keys | João | ✅ (antigas ficam válidas) |
| 7 | Subir Evolution API em VPS próprio | João (opcional no início) | ✅ |
| 8 | Smoke test pós-cutover | Claude (automatizado) | ✅ |
| 9 | Desligar recursos antigos | João (após 7d de retenção) | ⚠️ irreversível |

---

## FASE 0 — Preparação (15 min)

1. Criar conta Google: **`condoplayy@gmail.com`**.
   - Habilitar 2FA (Authenticator app, não SMS).
   - Senha forte, guardada no gerenciador.
2. Escolher gerenciador de senhas compartilhado (1Password Families, Bitwarden Organization free).
3. Adicionar o irmão como membro do gerenciador.
4. Decidir estrutura GitHub:
   - [ ] Opção A: Criar **GitHub Organization** `condoplay` (recomendado, permite adicionar o irmão como membro).
   - [ ] Opção B: Usar conta pessoal do irmão como host do repo.

---

## FASE 1 — Criar contas (30 min)

Tudo com login via Gmail novo. Habilitar 2FA em todas.

- [ ] Supabase → https://supabase.com → New Organization: "CondoPlay"
- [ ] Vercel → https://vercel.com → New Team: "CondoPlay"
- [ ] Anthropic Console → https://console.anthropic.com
- [ ] Groq Cloud → https://console.groq.com
- [ ] Google AI Studio (Gemini) → https://aistudio.google.com
- [ ] GitHub org (se opção A da Fase 0)

Avisar Claude ao terminar.

---

## FASE 2 — Exportar banco atual (10 min)

### 2.1 Pegar connection string do Supabase atual (conta Wash Me/João)

1. Dashboard Supabase atual → Project Settings → Database
2. Copiar **Connection String** (URI) em modo **Session** (porta 5432, não pooler).
3. Substituir `[YOUR-PASSWORD]` pela senha do banco.

### 2.2 Rodar export

```bash
cd "C:/Users/User/condoplay/crm"

# Cole a connection string aqui:
export SOURCE_DB_URL="postgresql://postgres:SUA_SENHA@db.XXX.supabase.co:5432/postgres"

bash scripts/export-supabase.sh
```

Saída esperada: 3 arquivos em `migration-dump/` (schema, data, full). Não commitar.

**Validação**:
```bash
head -50 migration-dump/schema_latest.sql  # deve mostrar CREATE TABLE leads ...
wc -l migration-dump/data_latest.sql       # numero de linhas deve bater com tamanho dos dados
```

---

## FASE 3 — Supabase novo (20 min)

### 3.1 Criar projeto
Logado em `condoplayy@gmail.com`:
- Supabase → org CondoPlay → New Project
- Name: `condoplay-crm`
- Region: **São Paulo** (mesma atual, reduz latência vs Vercel BR)
- DB Password: gerar forte, salvar no gerenciador
- Aguardar provisionamento (~2 min)

### 3.2 Importar dados

Pegar connection string do novo projeto (mesmo caminho, em modo Session).

```bash
export TARGET_DB_URL="postgresql://postgres:SENHA_NOVA@db.YYY.supabase.co:5432/postgres"

bash scripts/import-supabase.sh
```

O script vai pedir confirmação, aplicar schema, dados e migrations posteriores (inclui os índices de performance de `20260414_perf_indexes.sql`).

### 3.3 Validar

```bash
psql "$TARGET_DB_URL" <<EOF
SELECT count(*) FROM leads;
SELECT count(*) FROM conversations;
SELECT count(*) FROM messages;
SELECT count(*) FROM condos;
SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1;
EOF
```

Os números devem bater com o banco antigo. Anotar:

- [ ] `NEXT_PUBLIC_SUPABASE_URL` (Settings → API)
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_KEY`
- [ ] `DEFAULT_TENANT_ID` → `SELECT id FROM tenants LIMIT 1;`

---

## FASE 4 — Repositório GitHub (5 min)

### Opção A — Transferir repo existente
Se o repo já está no GitHub sob sua conta pessoal/Wash Me:
1. Repo → Settings → scroll até "Danger Zone" → **Transfer ownership**
2. Destino: org `condoplay` (ou conta do irmão)
3. Confirmar nome do repo
4. Issues, PRs, actions, history — tudo preservado

### Opção B — Criar repo novo e fazer push
Se o código ainda não está no GitHub:
```bash
cd "C:/Users/User/condoplay/crm"
git init  # se ainda não existir
git add .
git commit -m "chore: initial commit (post-migration)"

# Criar repo vazio na org condoplay pelo UI do GitHub, depois:
git remote add origin git@github.com:condoplay/condoplay-crm.git
git branch -M main
git push -u origin main
```

**CONFIRMAR**: `.gitignore` cobre `.env*`, `migration-dump/`, `node_modules/`.

---

## FASE 5 — Vercel (15 min)

### 5.1 Importar projeto
No Vercel novo (team CondoPlay):
- Add New → Project
- Import Git Repository → selecionar `condoplay/condoplay-crm`
- Framework preset: Next.js (detectado)
- Environment Variables: preencher conforme `.env.condoplay.example` (todos os campos com `<NOVA-...>`)

### 5.2 Preencher env vars
Usar os valores anotados:
- Supabase novos (Fase 3.3)
- LLM keys NOVAS (Fase 6, pode gerar antes do deploy)
- Evolution: em primeira rodada, deixar `NEXT_PUBLIC_EVOLUTION_API_URL=http://localhost:8080` (vai funcionar só em dev local; produção falha silenciosamente até Fase 7)

### 5.3 Deploy inicial
- Deploy → aguardar build
- URL gerada: `condoplay-crm-xxx.vercel.app`
- Não anexar domínio ainda — só após smoke test.

### 5.4 Cron
`vercel.json` já tem o cron do scheduler às 11:00 UTC (08:00 BRT, seg–sáb). Vai ser configurado automaticamente. Validar em Project → Settings → Cron Jobs.

---

## FASE 6 — Rotacionar API keys (15 min)

**IMPORTANTE**: não "transferir" — cada provider exige conta nova. As antigas (na conta Wash Me) só devem ser invalidadas **após** o CondoPlay novo estar rodando e validado.

| Provider | Onde gerar | Colar em |
|---|---|---|
| Anthropic | console.anthropic.com → Settings → API Keys → Create | Vercel env `ANTHROPIC_API_KEY` |
| Groq | console.groq.com → API Keys → Create | Vercel env `GROQ_API_KEY` |
| Google Gemini | aistudio.google.com → Get API key → Create API key | Vercel env `GEMINI_API_KEY` |

Após colar no Vercel, fazer **Redeploy** para aplicar.

---

## FASE 7 — Evolution API (WhatsApp) — OPCIONAL NO INÍCIO

Hoje está rodando em `localhost:8080` (dev local). Para produção, precisa de um servidor.

### Opção A — Adiar
Se o WhatsApp não é crítico no primeiro dia, adiar. O CRM funciona 100% sem WhatsApp (agentes ficam sem receber/enviar, resto OK).

### Opção B — Subir VPS próprio do CondoPlay
Recomendações (ordem de simplicidade):
1. **Railway** — `$5/mês`, subir docker-compose direto do repo evolution-api. Bom para MVP.
2. **DigitalOcean Droplet** — `$6/mês`, controle total, precisa configurar SSL com Caddy/Nginx.
3. **Hetzner** — `€4/mês`, mais barato, data center na Alemanha (latência +200ms).

Em qualquer opção:
1. Subir com `docker-compose up -d` a partir de `C:/Users/User/Claude Code/evolution-api/docker-compose.yaml`.
2. Gerar `EVOLUTION_API_KEY` forte (uuid ou senha 32 chars).
3. Criar instância: `curl POST /instance/create` com nome `condoplay-main`.
4. Scan QR code do WhatsApp (número do CondoPlay, NÃO do João).
5. Atualizar env vars no Vercel:
   - `NEXT_PUBLIC_EVOLUTION_API_URL=https://evolution.condoplay.seu-dominio.com`
   - `EVOLUTION_API_KEY=<a que você gerou>`
6. Configurar webhook no Evolution apontando para `https://condoplay-crm-xxx.vercel.app/api/webhook/evolution`.

**ATENÇÃO**: escanear QR em instância nova DESLOGA a sessão antiga. Fazer numa janela sem atividade.

---

## FASE 8 — Smoke test pós-cutover (10 min)

Ver arquivo separado: [SMOKE_TEST_CONDOPLAY.md](./SMOKE_TEST_CONDOPLAY.md).

Resumo: 10 checks que validam banco, auth, agents, UI e cron.

---

## FASE 9 — Desligar o antigo (após 7 dias em produção sem bugs)

**Ordem de desligamento**:
1. Vercel velho: Project → Settings → Delete (mantém log por 30d).
2. Supabase velho: Pause → 30d depois Delete.
3. API keys velhas na Wash Me: revogar uma a uma (Anthropic, Groq, Gemini). Agora as keys viram "zumbis" seguros.

**Backup final antes de deletar**: rodar export-supabase.sh no antigo uma última vez e arquivar `migration-dump/` em local seguro (Google Drive da conta CondoPlay, por exemplo).

---

## Se algo der errado

- **Import falha com "relation already exists"**: o projeto Supabase novo já tem tabelas. Criar OUTRO projeto Supabase limpo.
- **RLS bloqueando queries após import**: service_role key não respeita RLS — usar para debug. Policies devem ter vindo no schema.sql; validar com `SELECT * FROM pg_policies;`.
- **Vercel deploy quebra por falta de env var**: faltou configurar uma. Ver Build Logs, adicionar no Project Settings e redeploy.
- **Agent scheduler não dispara**: validar cron em Vercel → Cron Jobs. Timezone: schedule é UTC. `0 11 * * 1-6` = 08:00 BRT seg–sáb.

---

## Checklist final

- [ ] Fase 0: Gmail + 2FA criados
- [ ] Fase 1: contas em Supabase/Vercel/Anthropic/Groq/Gemini
- [ ] Fase 2: export Supabase concluído
- [ ] Fase 3: Supabase novo com dados importados e contagens validadas
- [ ] Fase 4: repo transferido
- [ ] Fase 5: Vercel com build verde
- [ ] Fase 6: todas as keys novas no Vercel
- [ ] Fase 7: Evolution decidido (adiado ou VPS)
- [ ] Fase 8: smoke test passou em todos os 10 checks
- [ ] Fase 9: antigos desligados (após 7d)
