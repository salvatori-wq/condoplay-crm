# Smoke Test — CondoPlay CRM pós-migração

10 checks para validar que o ambiente novo está funcional antes de apontar domínio e desligar o antigo.

**Pré-requisito**: Fases 1–6 do `MIGRATION_CONDOPLAY.md` concluídas. URL do deploy novo: `https://condoplay-crm-xxx.vercel.app`.

---

## 1. Build e deploy
- [ ] Vercel → Project → Deployments → último deploy com status **Ready**.
- [ ] Build Logs sem erro de TypeScript ou missing env var.

## 2. Conexão Supabase
Abrir o deploy → qualquer página com data (ex: `/pipeline`).
- [ ] Página carrega sem erro 500.
- [ ] Leads aparecem (mesma quantidade que no antigo).
- [ ] Console do navegador sem erro `Invalid API key` ou `CORS`.

## 3. Contagem de dados bate com o antigo
```sql
-- rodar no Supabase novo:
SELECT 'leads' AS t, count(*) FROM leads
UNION ALL SELECT 'conversations', count(*) FROM conversations
UNION ALL SELECT 'messages', count(*) FROM messages
UNION ALL SELECT 'condos', count(*) FROM condos
UNION ALL SELECT 'agent_logs', count(*) FROM agent_logs;
```
- [ ] Números **idênticos** ao banco antigo (tolerância zero).

## 4. RLS policies ativas
```sql
SELECT schemaname, tablename, policyname FROM pg_policies ORDER BY 1,2;
```
- [ ] Policies presentes para `leads`, `conversations`, `messages`, `condos`.

## 5. Índices de performance aplicados
```sql
SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname LIKE 'idx_%';
```
- [ ] Deve listar pelo menos: `idx_leads_tenant_status_created`, `idx_leads_phone`, `idx_conversations_tenant_agent_status_updated`, `idx_messages_conv_created`, `idx_agent_logs_tenant_created`.

## 6. Agents: HAWKEYE (prospecção)
```bash
curl -X POST https://condoplay-crm-xxx.vercel.app/api/agents/hawkeye/run \
  -H "content-type: application/json"
```
- [ ] Retorna JSON com `ok: true`.
- [ ] Tabela `search_logs` ganhou 1 linha nova.
- [ ] Sem erro de `ANTHROPIC_API_KEY not configured` ou similar.

## 7. Agents: LOKI (intent classification)
```bash
curl -X POST https://condoplay-crm-xxx.vercel.app/api/agents/loki/respond \
  -H "content-type: application/json" \
  -d '{"conversationId":"<id-de-conversa-existente>","message":"quero saber mais sobre os jogos"}'
```
Substituir `<id-de-conversa-existente>` por um UUID real do `SELECT id FROM conversations LIMIT 1;`.
- [ ] Retorna `ok: true`, `intent` classificado.
- [ ] Agent logs gravaram a ação.

## 8. Scheduler cron
Vercel → Project → Settings → Cron Jobs.
- [ ] Cron `/api/agents/scheduler` configurado, schedule `0 11 * * 1-6`.
- [ ] Botão "Run manually" retorna 200.

## 9. Webhook Evolution (se Fase 7 feita)
- [ ] URL `https://condoplay-crm-xxx.vercel.app/api/webhook/evolution` aceita POST.
- [ ] Enviar mensagem ao WhatsApp do CondoPlay → aparece em `conversations` / `messages`.

Se Fase 7 adiada: **pular este check**. Marcar como N/A.

## 10. Keys novas realmente em uso (não as antigas)
No Vercel → Project → Settings → Environment Variables:
- [ ] Todos os valores preenchidos.
- [ ] Comparar os **últimos 4 chars** de cada key com os que estão no gerenciador de senha da conta condoplayy@gmail.com — devem bater.
- [ ] As keys antigas (da conta Wash Me) **não estão** aqui.

---

## Se 10/10 passaram

✅ Ambiente novo saudável. Pode:
1. Anexar domínio próprio (se for usar).
2. Começar contagem regressiva de 7 dias antes da Fase 9 (desligar antigo).

## Se algum check falhou

⛔ **NÃO desligar o antigo**. Manter os dois em paralelo até resolver.

Reportar qual check falhou — Claude ajuda a debugar.
