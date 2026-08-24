# syntax=docker/dockerfile:1

# ============================================================
# Build stage: install all deps, compile web + server
# ============================================================
FROM node:22-bookworm AS build

RUN npm install -g pnpm@10

WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/

RUN pnpm install --frozen-lockfile

# Copy sources and build (web -> packages/web/dist, server -> packages/server/dist)
COPY packages ./packages
RUN pnpm build


# ============================================================
# Runtime stage
#
# NOTE on base image: node-pty does NOT ship Linux prebuilds,
# so it compiles from source via node-gyp during pnpm install.
# The full (non-slim) bookworm image includes python3/make/g++.
# ============================================================
FROM node:22-bookworm

RUN npm install -g pnpm@10

# Install the Pi CLI — this is what the web terminal attaches to.
# Pin a version for reproducibility: docker build --build-arg PI_VERSION=x.y.z
ARG PI_VERSION=latest
RUN npm install -g @earendil-works/pi-coding-agent@${PI_VERSION}

WORKDIR /app

# Production-only install of the server workspace
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/
RUN pnpm install --prod --frozen-lockfile

# Built artifacts. Server resolves the frontend at ../../web/dist
# relative to packages/server/dist/index.js — keep this layout intact.
COPY --from=build /app/packages/server/dist packages/server/dist
COPY --from=build /app/packages/web/dist packages/web/dist

ENV NODE_ENV=production
ENV PORT=3000

# Pi sessions run with cwd=/workspace. Mount your project here:
#   docker run -v /path/to/project:/workspace ...
WORKDIR /workspace

# Pi auth & session persistence — either mount the agent dir:
#   -v pi-agent-data:/root/.pi/agent
# or pass API keys as env vars:
#   -e ANTHROPIC_API_KEY=...  -e OPENAI_API_KEY=...

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "/app/packages/server/dist/index.js"]
