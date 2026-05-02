#!/usr/bin/env bash
# ═══ IMPORT no novo Supabase do CondoPlay ═══
#
# Aplica schema + dados exportados por export-supabase.sh.
#
# Uso:
#   1) Pegar connection string do Supabase NOVO (conta condoplayy@gmail.com):
#      Dashboard → Project Settings → Database → Connection string → URI (session mode)
#   2) Exportar env var:
#      export TARGET_DB_URL="postgresql://..."
#   3) Rodar:
#      bash scripts/import-supabase.sh
#
# Ordem de aplicacao:
#   a) schema_latest.sql         → cria tables/policies/indexes
#   b) data_latest.sql           → insere registros
#   c) migrations/*.sql          → aplica migrations posteriores (idempotente)
#
# Requer: psql (postgresql-client).
#
set -euo pipefail

if [[ -z "${TARGET_DB_URL:-}" ]]; then
  echo "ERRO: defina TARGET_DB_URL antes de rodar."
  echo 'Ex: export TARGET_DB_URL="postgresql://postgres.yyy:senha@host:5432/postgres"'
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "ERRO: psql nao encontrado. Instale postgresql-client."
  exit 1
fi

DUMP_DIR="./migration-dump"
if [[ ! -f "$DUMP_DIR/schema_latest.sql" ]]; then
  echo "ERRO: $DUMP_DIR/schema_latest.sql nao encontrado."
  echo "Rode scripts/export-supabase.sh primeiro."
  exit 1
fi

echo "⚠️  ATENCAO: vou aplicar schema + dados em TARGET_DB_URL."
echo "   URL: $(echo $TARGET_DB_URL | sed 's/:[^:@]*@/:***@/')"
read -p "Confirma? (yes/no) " confirm
if [[ "$confirm" != "yes" ]]; then
  echo "Cancelado."
  exit 0
fi

echo ""
echo "→ [1/3] Aplicando SCHEMA..."
psql "$TARGET_DB_URL" \
  --set ON_ERROR_STOP=on \
  --single-transaction \
  -f "$DUMP_DIR/schema_latest.sql"

echo ""
echo "→ [2/3] Aplicando DADOS..."
psql "$TARGET_DB_URL" \
  --set ON_ERROR_STOP=on \
  --single-transaction \
  -f "$DUMP_DIR/data_latest.sql"

echo ""
echo "→ [3/3] Aplicando migrations posteriores (supabase/migrations/)..."
if [[ -d "./supabase/migrations" ]]; then
  for f in ./supabase/migrations/*.sql; do
    [[ -f "$f" ]] || continue
    echo "   • $f"
    # migrations usam CREATE INDEX CONCURRENTLY, NAO envolver em transacao
    psql "$TARGET_DB_URL" --set ON_ERROR_STOP=on -f "$f" || {
      echo "   ⚠️  falha em $f — revise manualmente."
    }
  done
fi

echo ""
echo "✅ Import concluido."
echo ""
echo "Valide rapidamente:"
echo "  psql \"\$TARGET_DB_URL\" -c \"select table_name from information_schema.tables where table_schema='public' order by 1;\""
echo "  psql \"\$TARGET_DB_URL\" -c \"select count(*) from leads; select count(*) from conversations;\""
