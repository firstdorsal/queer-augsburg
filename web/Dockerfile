# 0. build stage
FROM node:24-alpine AS build-stage
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
# corepack installs exactly the pnpm version (and hash) pinned in package.json's packageManager.
RUN corepack enable pnpm
# sharp and its musl binary are regular dependencies; the frozen lockfile makes the image
# use exactly the reviewed dependency versions.
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# 1. execution stage
FROM pektin/feoco
COPY --from=build-stage --chown=feoco /app/dist/ /public/
COPY server/config.yml /
EXPOSE 80
