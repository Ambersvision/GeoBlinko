# Build Stage
FROM oven/bun:1.2.8 AS builder

# Add Build Arguments
ARG USE_MIRROR=false

WORKDIR /app

# Set Sharp environment variables to speed up ARM installation
ENV SHARP_IGNORE_GLOBAL_LIBVIPS=1
ENV npm_config_sharp_binary_host="https://npmmirror.com/mirrors/sharp"
ENV npm_config_sharp_libvips_binary_host="https://npmmirror.com/mirrors/sharp-libvips"

# Set Prisma environment variables to optimize installation
ENV PRISMA_ENGINES_MIRROR="https://registry.npmmirror.com/-/binary/prisma"
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true

# Copy dependency files first for better caching
COPY package.json bun.lock turbo.json tsconfig.json ./

# Copy workspace directories needed for bun install
COPY app/package.json app/
COPY server/package.json server/
COPY shared/package.json shared/
COPY app/tauri-plugin-blinko app/tauri-plugin-blinko/

# Configure Mirror Based on USE_MIRROR Parameter
RUN if [ "$USE_MIRROR" = "true" ]; then \
        echo "Using Taobao Mirror to Install Dependencies" && \
        echo "registry=https://registry.npmmirror.com" > .npmrc; \
    else \
        echo "Using Default Mirror to Install Dependencies"; \
    fi

# Install Dependencies (Cached Layer)
RUN bun install --unsafe-perm --ignore-scripts || true

# Cache breaker for source code changes
ARG CACHEBUST=1

# Invalidate cache for source code
RUN test "$CACHEBUST" = "1" || echo "Cache bust: $CACHEBUST"

# Copy Source Code (This layer changes when source code changes)
COPY . .

# Clean Turborepo cache when CACHEBUST is not 1
RUN if [ "$CACHEBUST" != "1" ]; then rm -rf node_modules/.cache; fi

# Generate Prisma Client
RUN bunx prisma generate

# Build App (These layers will be rebuilt when source code changes)
RUN if [ "$CACHEBUST" != "1" ]; then \
        NODE_OPTIONS="--max-old-space-size=8192" TURBO_CACHE_DISABLED=true bun run build:web; \
    else \
        NODE_OPTIONS="--max-old-space-size=8192" bun run build:web; \
    fi

# Build seed
RUN bun run build:seed


FROM node:20-alpine as init-downloader

WORKDIR /app

RUN wget -qO /app/dumb-init https://github.com/Yelp/dumb-init/releases/download/v1.2.5/dumb-init_1.2.5_$(uname -m) && \
    chmod +x /app/dumb-init && \
    rm -rf /var/cache/apk/*


# Runtime Stage - Using Alpine as required
FROM node:20-alpine AS runner

# Add Build Arguments
ARG USE_MIRROR=false

WORKDIR /app

# Environment Variables
ENV NODE_ENV=production
# If there is a proxy or load balancer behind HTTPS, you may need to disable secure cookies
ENV DISABLE_SECURE_COOKIE=false
# Set Trust Proxy
ENV TRUST_PROXY=1
# Set Sharp environment variables
ENV SHARP_IGNORE_GLOBAL_LIBVIPS=1
ENV npm_config_sharp_binary_host="https://npmmirror.com/mirrors/sharp"
ENV npm_config_sharp_libvips_binary_host="https://npmmirror.com/mirrors/sharp-libvips"

RUN apk add --no-cache openssl vips-dev python3 py3-setuptools make g++ gcc libc-dev linux-headers && \
    if [ "$USE_MIRROR" = "true" ]; then \
        echo "Using Taobao Mirror to Install Dependencies" && \
        npm config set registry https://registry.npmmirror.com; \
    else \
        echo "Using Default Mirror to Install Dependencies"; \
    fi

# Copy Build Artifacts and Necessary Files
COPY --from=builder /app/dist ./server
COPY --from=builder /app/server/lute.min.js ./server/lute.min.js
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma/client ./node_modules/.prisma/client
COPY start.sh ./
COPY --from=init-downloader /app/dumb-init /usr/local/bin/dumb-init

RUN chmod +x ./start.sh && \
    ls -la start.sh

RUN if [ "$(uname -m)" = "aarch64" ] || [ "$(uname -m)" = "arm64" ]; then \
        echo "Detected ARM architecture, installing sharp platform-specific dependencies..." && \
        mkdir -p /tmp/sharp-cache && \
        export SHARP_CACHE_DIRECTORY=/tmp/sharp-cache && \
        npm install --platform=linux --arch=arm64 sharp@0.34.1 --no-save --unsafe-perm || \
        npm install --force @img/sharp-linux-arm64 --no-save; \
    fi

# Install dependencies with --ignore-scripts to skip native compilation
RUN echo "Installing additional dependencies..." && \
    npm install @node-rs/crc32 lightningcss sharp@0.34.1 prisma@5.21.1 && \
    npm install -g prisma@5.21.1 && \
    npm install sqlite3@5.1.7 && \
    npm install llamaindex @langchain/community@0.3.40 && \
    npm install @libsql/client @libsql/core && \
    npx prisma generate && \
    # find / -type d -name "onnxruntime-*" -exec rm -rf {} + 2>/dev/null || true && \
    # npm cache clean --force && \
    rm -rf /tmp/* && \
    apk del python3 py3-setuptools make g++ gcc libc-dev linux-headers && \
    rm -rf /var/cache/apk/* /root/.npm /root/.cache

# Expose Port (Adjust According to Actual Application)
EXPOSE 1111

CMD ["/usr/local/bin/dumb-init", "--", "/bin/sh", "-c", "./start.sh"]
