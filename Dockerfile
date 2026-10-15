FROM node:22-bookworm AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim

# None of this is needed to run the app. It is here because looking at what is
# going on inside a pod without these is not fun.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      wget \
      jq \
      less \
      vim-tiny \
      procps \
      psmisc \
      lsof \
      strace \
      net-tools \
      iputils-ping \
      dnsutils \
      telnet \
      openssl \
      git \
      unzip \
      tzdata \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

RUN useradd --create-home --shell /bin/bash app \
 && mkdir -p /app/state /app/tickets \
 && chown -R app:app /app

USER app
EXPOSE 3000

CMD ["node", "dist/index.js"]
