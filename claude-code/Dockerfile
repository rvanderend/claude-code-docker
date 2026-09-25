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
    && rm -rf /var/lib/apt/lists/*

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
