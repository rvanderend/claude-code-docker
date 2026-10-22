FROM node:22-slim

# Extra apt-pakketten voor je eigen werk, bv. in docker-compose:
#   build: { context: ..., args: { EXTRA_PACKAGES: "ffmpeg mkvtoolnix" } }
ARG EXTRA_PACKAGES=""

# Basisgereedschap. tmux houdt de console in leven als de browser sluit; procps levert ps/top.
RUN apt-get update && apt-get install -y --no-install-recommends \
    tmux \
    procps \
    git \
    curl \
    ca-certificates \
    # Hulpprogramma's waar Claude vaak naar grijpt
    jq \
    unzip \
    zip \
    file \
    xxd \
    bsdextrautils \
    dnsutils \
    iproute2 \
    less \
    nano \
    poppler-utils \
    # Python, voor de document-skills (pdf, docx, xlsx, pptx)
    python3 \
    python3-pip \
    python3-venv \
    $EXTRA_PACKAGES \
    && rm -rf /var/lib/apt/lists/*

# Docker CLI (alleen de client), alleen nodig als je de Docker-socket mount (zie docker-compose.yml).
# Statische build i.p.v. Debians docker.io: die is 20.10 (API 1.41) en Docker 29 eist minimaal 1.44.
RUN curl -fsSL https://download.docker.com/linux/static/stable/x86_64/docker-29.8.2.tgz \
      -o /tmp/docker.tgz \
 && tar -xzf /tmp/docker.tgz -C /tmp \
 && cp /tmp/docker/docker /usr/local/bin/docker && chmod +x /usr/local/bin/docker \
 && rm -rf /tmp/docker /tmp/docker.tgz

# Python-bibliotheken voor de document-skills. Systeembreed, zodat ze ook werken met
# de gemounte home-map; --break-system-packages mag hier, het is een wegwerp-image.
RUN pip3 install --no-cache-dir --break-system-packages \
    python-docx \
    python-pptx \
    openpyxl \
    pypdf \
    pdfplumber \
    reportlab \
    pillow

# GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
 && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
 && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      > /etc/apt/sources.list.d/github-cli.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends gh \
 && rm -rf /var/lib/apt/lists/*

RUN npm install -g @anthropic-ai/claude-code

# Optioneel: Playwright met Chromium en WebKit (Safari-engine) plus de Playwright MCP-server,
# zodat Claude in elk project websites kan openen, testen en screenshotten (ook als iPhone).
# Aanzetten met build-arg WITH_PLAYWRIGHT=1 (maakt het image ~1 GB groter).
# Eén versie: de algemene playwright krijgt exact de versie die de MCP-server gebruikt,
# zodat beide dezelfde browsers delen. Scripts: require('playwright') (CommonJS, via NODE_PATH).
ARG WITH_PLAYWRIGHT=0
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    NODE_PATH=/usr/local/lib/node_modules
RUN if [ "$WITH_PLAYWRIGHT" = "1" ]; then \
      npm install -g @playwright/mcp \
   && PW_VERSION=$(node -p "require('/usr/local/lib/node_modules/@playwright/mcp/package.json').dependencies.playwright") \
   && npm install -g "playwright@$PW_VERSION" \
   && playwright install --with-deps chromium webkit \
   && chmod -R a+rX "$PLAYWRIGHT_BROWSERS_PATH" \
   && rm -rf /var/lib/apt/lists/* /root/.npm /root/.cache; \
    fi

# tmux-config voor iedereen, en elke interactieve console automatisch in tmux-sessie 'main'
COPY tmux.conf /etc/tmux.conf
COPY tmux-autoattach.sh /etc/tmux-autoattach.sh
RUN cat /etc/tmux-autoattach.sh >> /etc/bash.bashrc

# UTF-8, anders vervangt tmux emoji en kaderlijnen door _
ENV LANG=C.UTF-8

WORKDIR /workspace

CMD ["sleep", "infinity"]
