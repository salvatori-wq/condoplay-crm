# ISOLATION — CondoPlay workspace

**Regra absoluta**: este workspace e o workspace Wash Me (`C:\Users\User\washme\`) sao 100% isolados.

## O que isolamento significa aqui

- NUNCA importar codigo, modulos, tipos, schemas ou utils do workspace Wash Me.
- NUNCA reusar API keys (Anthropic, Groq, Gemini, Supabase, Vercel) entre os dois.
- NUNCA apontar este projeto para o Supabase/Vercel/banco da Wash Me, nem o contrario.
- NUNCA compartilhar `.env*`, credenciais ou tokens entre os dois.
- Contas: CondoPlay usa `condoplayy@gmail.com`. Wash Me usa a conta do Joao.

## Limites fisicos

- Este workspace vive em `C:\Users\User\condoplay\crm\`.
- Wash Me vive em outro root, em outra conta, em outra infra.
- Glob/grep/RAG devem rodar com root fixado neste diretorio.

## Se voce (Claude) notar contaminacao

Parar imediatamente e avisar o usuario. Exemplos:
- Import cross-workspace
- Email `@washme.com.br` aparecendo em codigo CondoPlay (ja foi limpo em loki/respond/route.ts)
- Key rotacionada numa conta sendo colada na outra
- Schema/tabela de um negocio referenciada no outro

## Decisoes historicas

- 2026-04-15: Evolution API removida — CondoPlay nao usa mais essa integracao.
- Migracao planejada: `MIGRATION_CONDOPLAY.md` — mover infra para conta `condoplayy@gmail.com`.
