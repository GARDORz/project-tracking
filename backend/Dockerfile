FROM node:22-slim AS builder
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build


FROM node:22-slim
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
# Full install (devDependencies included) so `npx tsx prisma/seed.ts` works
# inside the running container — convenient for UAT, where seeding sample
# data on demand matters more than a lean image. NODE_ENV is set *after* this
# step: npm treats NODE_ENV=production as an implicit --omit=dev and would
# otherwise skip tsx even without that flag passed explicitly.
RUN npm ci
ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

RUN mkdir -p uploads

EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
