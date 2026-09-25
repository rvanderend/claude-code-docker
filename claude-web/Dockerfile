FROM debian:bookworm-slim

# fzf voor het menu, git voor 'Nieuw project aanmaken'
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl git fzf \
    && rm -rf /var/lib/apt/lists/*

# ttyd: terminal in de browser
RUN curl -fsSL https://github.com/tsl0922/ttyd/releases/download/1.7.7/ttyd.x86_64 \
      -o /usr/local/lib/ttyd && chmod +x /usr/local/lib/ttyd

# De ingebouwde pagina van ttyd mist een viewport-tag. Een telefoon toont hem dan als verkleinde
# desktoppagina: piepkleine tekst en evenveel kolommen als op een laptop. Haal die pagina op,
# voeg de tag toe en laat 'ttyd' (een wrapper) hem altijd gebruiken. Zo werkt ook een eigen
# 'command:' in docker-compose zonder aanpassing.
RUN /usr/local/lib/ttyd -p 7999 -i lo true & P=$!; \
    curl -fsS --compressed --retry 10 --retry-connrefused --retry-delay 1 \
      http://127.0.0.1:7999/ -o /usr/local/share/ttyd-index.html; \
    kill $P; \
    sed -i 's|<head>|<head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">|' \
      /usr/local/share/ttyd-index.html \
 && grep -q 'name="viewport"' /usr/local/share/ttyd-index.html \
 && printf '#!/bin/sh\nexec /usr/local/lib/ttyd -I /usr/local/share/ttyd-index.html "$@"\n' > /usr/local/bin/ttyd \
 && chmod +x /usr/local/bin/ttyd

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
