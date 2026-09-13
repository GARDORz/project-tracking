#!/bin/sh
set -e

envsubst '${PORT} ${BACKEND_PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

PORT=3001 npx prisma migrate deploy

# Free-tier hosts here give no shell access to seed manually, and seed.ts is
# documented as idempotent/safe to re-run — so seed on every boot to
# guarantee the demo always has working login credentials.
PORT=3001 npx tsx prisma/seed.ts

PORT=3001 node dist/index.js &

exec nginx -g 'daemon off;'
