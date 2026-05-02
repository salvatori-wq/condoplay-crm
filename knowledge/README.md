---
title: Knowledge base — CondoPlay
domain: condoplay
category: index
status: active
version: 1.0
tags: [rag, index, condoplay]
last_review: 2026-04-15
---

# Knowledge base — CondoPlay

Estrutura de conhecimento para RAG e consulta humana. Cada documento deve ter frontmatter YAML com `title`, `domain` (sempre `condoplay`), `category`, `status`, `version`, `tags`, `last_review`.

## Categorias

- `01_negocio/` — modelo de franquia, ICP condominios, parceria com irmao, unit economics
- `02_produto/` — Arena, Armario, kits de jogos, protocolos de operacao no condominio
- `03_marketing/` — aquisicao de condominios, criativos, copy, canais
- `04_comercial/` — pipeline sindicos, playbook, contratos, precos
- `05_dados/` — relatorios, metricas, dashboards (nao commitar PII)
- `_exports/` — derivados (PDF, PPTX, DOCX) de documentos-fonte em markdown

## Convencoes

- Nomes de arquivo: `kebab-case-descritivo.md`
- Fonte da verdade: markdown com frontmatter. PDFs sao derivados.
- Datas em `YYYY-MM-DD`.
- Atualizar `last_review` quando revisar.
