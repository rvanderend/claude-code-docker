FROM node:22-slim

# Basisgereedschap. tmux houdt de console in leven als de browser sluit; procps levert ps/top.
# docker.io levert de Docker CLI, alleen nodig als je de Docker-socket mount (zie docker-compose.yml).
RUN apt-get update && apt-get install -y --no-install-recommends \
    docker.io \
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
    && rm -rf /var/lib/apt/lists/*

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

# tmux-config voor iedereen, en elke interactieve console automatisch in tmux-sessie 'main'
COPY tmux.conf /etc/tmux.conf
COPY tmux-autoattach.sh /etc/tmux-autoattach.sh
RUN cat /etc/tmux-autoattach.sh >> /etc/bash.bashrc

# UTF-8, anders vervangt tmux emoji en kaderlijnen door _
ENV LANG=C.UTF-8

WORKDIR /workspace

CMD ["sleep", "infinity"]
