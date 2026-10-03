# Railway API container.
# Build context is the repository root, so the worker shares the same image recipe.
FROM node:22.12-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@12.5.1 --activate
WORKDIR /app

# ---------------------------------------------------------------------------
# Dependencies (cached layer)
# ---------------------------------------------------------------------------
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/client/package.json apps/client/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/data/package.json packages/data/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/extraction/package.json packages/extraction/package.json
COPY packages/ui/package.json packages/ui/package.json
# The API and worker never need the client's browser dependencies at runtime, but a
# single lockfile install keeps the image reproducible.
RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# API runtime
# ---------------------------------------------------------------------------
FROM deps AS api
COPY tsconfig.base.json tsconfig.node.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm --filter @sutra/api build
ENV NODE_ENV=production
# The container runs as a non-root user.
USER node
EXPOSE 8787
CMD ["node", "apps/api/dist/server.mjs"]
