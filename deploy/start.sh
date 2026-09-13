#!/bin/sh
set -e

envsubst '${PORT} ${BACKEND_PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

PORT=3001 npx prisma migrate deploy

PORT=3001 node dist/index.js &

exec nginx -g 'daemon off;'
