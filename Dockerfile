# Hermy HQ — Coolify Dockerfile (Next.js 16, build then run)
FROM node:22-alpine
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Runtime env vars (set via --build-arg for build-time inlining by Turbopack,
# and also set as ENV so they persist into the runtime `next start` process).
# Turbopack inlines process.env.* at build time, so these MUST be available
# during `npm run build`, not just at runtime via docker -e.
ARG MC_URL="http://172.18.0.1:8899"
ARG MC_AUTH_TOKEN
ARG TERMINAL_PASSWORD="changeme"
ARG DATABASE_URL
ARG NEXTAUTH_URL
ARG NEXTAUTH_SECRET
ARG GOOGLE_CLIENT_ID
ARG GOOGLE_CLIENT_SECRET
ARG GITHUB_ID
ARG GITHUB_SECRET
ARG EMAIL_SERVER
ARG EMAIL_FROM
ARG NEXT_PUBLIC_BASE_URL

ENV MC_URL=${MC_URL}
ENV MC_AUTH_TOKEN=${MC_AUTH_TOKEN}
ENV TERMINAL_PASSWORD=${TERMINAL_PASSWORD}
ENV DATABASE_URL=${DATABASE_URL}
ENV NEXTAUTH_URL=${NEXTAUTH_URL}
ENV NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
ENV GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
ENV GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
ENV GITHUB_ID=${GITHUB_ID}
ENV GITHUB_SECRET=${GITHUB_SECRET}
ENV EMAIL_SERVER=${EMAIL_SERVER}
ENV EMAIL_FROM=${EMAIL_FROM}
ENV NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}

# install ALL deps (devDeps needed for prisma + next build).
# prisma/ must be present first: npm ci runs the postinstall script
# (`prisma generate`), which needs prisma/schema.prisma to exist.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund --legacy-peer-deps

# generate Prisma client + build
COPY . .
RUN npx prisma generate && npm run build

# Keep dev deps — Next.js needs TypeScript at runtime for next.config.ts
ENV NODE_ENV=production

EXPOSE 3000
CMD ["npm", "start"]
