FROM debian:bookworm-slim

# fzf voor het menu, git voor 'Nieuw project aanmaken'
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl git fzf \
    && rm -rf /var/lib/apt/lists/*

# ttyd: terminal in de browser
RUN curl -fsSL https://github.com/tsl0922/ttyd/releases/download/1.7.7/ttyd.x86_64 \
      -o /usr/local/bin/ttyd && chmod +x /usr/local/bin/ttyd

# Docker CLI (alleen de client), om via de socket in claude-code te komen
RUN curl -fsSL https://download.docker.com/linux/static/stable/x86_64/docker-27.3.1.tgz \
      -o /tmp/docker.tgz \
 && tar -xzf /tmp/docker.tgz -C /tmp \
 && cp /tmp/docker/docker /usr/local/bin/docker && chmod +x /usr/local/bin/docker \
 && rm -rf /tmp/docker /tmp/docker.tgz

COPY claude-menu.sh /usr/local/bin/claude-menu.sh
RUN chmod +x /usr/local/bin/claude-menu.sh

EXPOSE 7681
CMD ["ttyd", "-W", "-p", "7681", "/usr/local/bin/claude-menu.sh"]
