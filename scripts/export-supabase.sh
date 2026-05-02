#!/usr/bin/env bash
# ═══ EXPORT do banco Supabase atual do CondoPlay ═══
#
# Gera 3 arquivos em ./migration-dump/:
#   - schema.sql   → estrutura (tables, views, functions, policies, indexes)
#   - data.sql     → só os dados (INSERTs)
#   - full.sql     → schema + dados, roles, owners (fallback)
#
# Uso:
#   1) Pegar connection string do Supabase atual:
#      Dashboard → Project Settings → Database → Connection string → URI (transaction mode)
#      Formato: postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:6543/postgres
#   2) Exportar como env var:
#      export SOURCE_DB_URL="postgresql://..."
#   3) Rodar:
#      bash scripts/export-supabase.sh
#
# Requer: pg_dump (vem com postgresql-client). Testar: which pg_dump
#         Se faltar: https://www.postgresql.org/download/
#
set -euo pipefail

if [[ -z "${SOURCE_DB_URL:-}" ]]; then
  echo "ERRO: defina SOURCE_DB_URL antes de rodar."
  echo 'Ex: export SOURCE_DB_URL="postgresql://postgres.xxx:senha@host:6543/postgres"'
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERRO: pg_dump nao encontrado no PATH. Instale postgresql-client."
  exit 1
fi

OUT_DIR="./migration-dump"
mkdir -p "$OUT_DIR"

TS=$(date +%Y%m%d_%H%M%S)

echo "→ Exportando SCHEMA (estrutura somente)..."
pg_dump "$SOURCE_DB_URL" \
  --schema-only \
  --no-owner --no-privileges \
  --schema=public \
  --schema=auth \
  --file="$OUT_DIR/schema_${TS}.sql"

echo "→ Exportando DADOS (INSERTs somente)..."
pg_dump "$SOURCE_DB_URL" \
  --data-only \
  --no-owner --no-privileges \
  --schema=public \
  --column-inserts \
  --file="$OUT_DIR/data_${TS}.sql"

echo "→ Exportando FULL (fallback completo)..."
pg_dump "$SOURCE_DB_URL" \
  --no-owner --no-privileges \
  --schema=public \
  --schema=auth \
  --file="$OUT_DIR/full_${TS}.sql"

# Links "latest" para o import pegar sempre o mais recente
ln -sf "schema_${TS}.sql" "$OUT_DIR/schema_latest.sql" 2>/dev/null || cp "$OUT_DIR/schema_${TS}.sql" "$OUT_DIR/schema_latest.sql"
ln -sf "data_${TS}.sql"   "$OUT_DIR/data_latest.sql"   2>/dev/null || cp "$OUT_DIR/data_${TS}.sql"   "$OUT_DIR/data_latest.sql"
ln -sf "full_${TS}.sql"   "$OUT_DIR/full_latest.sql"   2>/dev/null || cp "$OUT_DIR/full_${TS}.sql"   "$OUT_DIR/full_latest.sql"

echo ""
echo "✅ Export concluido em $OUT_DIR/"
ls -lh "$OUT_DIR/"*_${TS}.sql
echo ""
echo "Proximos passos:"
echo "  1) Verifique tamanho e sanidade dos arquivos (head schema_${TS}.sql)."
echo "  2) NAO commite este diretorio (ja esta no .gitignore)."
echo "  3) Rode scripts/import-supabase.sh com TARGET_DB_URL do Supabase novo."
