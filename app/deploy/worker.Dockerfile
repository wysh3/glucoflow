# Railway worker container.
#
# The worker needs the PDF canvas adapter (native), Sharp (native) and the Tesseract
# language data. This image is the required native-module smoke test target: build it
# and run `node -e "require('@napi-rs/canvas'); require('sharp')"` style checks before
# trusting PDF rendering in production.
FROM node:22.12-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@12.5.1 --activate
WORKDIR /app

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
RUN pnpm install --frozen-lockfile

FROM deps AS worker
# Fonts and image libraries the PDF and OCR stages rely on.
RUN apt-get update \
 && apt-get install -y --no-install-recommends fonts-dejavu-core ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY tsconfig.base.json tsconfig.node.json ./
COPY packages ./packages
COPY apps/worker ./apps/worker
COPY scripts ./scripts
RUN pnpm --filter @glucoflow/worker build
ENV NODE_ENV=production
ENV OCR_ENABLED=true
ENV TMP_ROOT=/tmp/sutra-worker
# The page renderer and the export writer need a writable temporary directory owned by
# the unprivileged runtime user.
RUN mkdir -p /tmp/sutra-worker && chown node:node /tmp/sutra-worker
USER node
# No inbound route is exposed: the worker only leases database jobs.
CMD ["node", "apps/worker/dist/worker.mjs"]
