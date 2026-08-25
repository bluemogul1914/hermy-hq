# Hermy HQ — Coolify Dockerfile (Next.js 16, build then run)
FROM node:22-alpine
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# install ALL deps (devDeps needed for prisma + next build).
# prisma/ must be present first: npm ci runs the postinstall script
# (`prisma generate`), which needs prisma/schema.prisma to exist.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

# generate Prisma client + build
COPY . .
RUN npx prisma generate && npm run build

# trim to production deps for a lean runtime image
ENV NODE_ENV=production
RUN npm prune --omit=dev

EXPOSE 3000
CMD ["npm", "start"]