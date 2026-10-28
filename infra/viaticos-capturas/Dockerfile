# Servicio de capturas y cotizaciones para el modulo de viaticos.
# Chats de Playwright MCP + Chromium headless + ClickBus.
FROM node:22-bookworm-slim

ARG INSTALAR_OPENCODE=true
ARG PLAYWRIGHT_MCP_VERSION=0.0.83

ENV NODE_ENV=production \
    PORT=8099 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    HOME=/data/home \
    DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

# Volumen de datos (capturas, cache, HOME de OpenCode).
RUN mkdir -p /data/capturas /data/cache /data/home \
  && chown -R node:node /data

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Chromium + dependencias del sistema (corre como root durante el build).
RUN npx playwright install --with-deps chromium

# OpenCode opcional (modo agentico). Binario oficial en /opt/opencode/.opencode/bin.
RUN if [ "$INSTALAR_OPENCODE" = "true" ]; then \
      mkdir -p /opt/opencode \
      && HOME=/opt/opencode bash -c 'curl -fsSL https://opencode.ai/install | bash' \
      && chmod -R 755 /opt/opencode; \
    fi
ENV PATH="/opt/opencode/.opencode/bin:${PATH}"

# Playwright MCP para que OpenCode pueda navegar/capturar (modo agentico).
RUN npm install -g @playwright/mcp@${PLAYWRIGHT_MCP_VERSION} --no-audit --no-fund

COPY server.js ./
COPY lib ./lib

RUN mkdir -p /data/capturas /data/cache /data/home \
  && chown -R node:node /data /app
USER node

EXPOSE 8099
HEALTHCHECK --interval=30s --timeout=10s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8099/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
