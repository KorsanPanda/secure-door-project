#!/bin/sh
set -e

echo "Backend startup islemleri baslatiliyor..."

PRISMA_BIN="/app/node_modules/.bin/prisma"
MIGRATIONS_DIR="/app/prisma/migrations"

if [ -x "$PRISMA_BIN" ] &&
   [ -d "$MIGRATIONS_DIR" ] &&
   [ "$(ls -A "$MIGRATIONS_DIR" 2>/dev/null)" ]; then

  echo "Prisma migrationlari uygulaniyor..."
  "$PRISMA_BIN" migrate deploy
  echo "Baslangic verileri dogrulaniyor..."
  node /app/prisma/seed.js
else
  echo "Prisma paketi veya migration bulunamadi."
  echo "Migration adimi simdilik atlaniyor."
fi

echo "Backend baslatiliyor..."
exec npm start
