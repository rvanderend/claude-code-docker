# Claude Code in Docker

[Claude Code](https://docs.claude.com/en/docs/claude-code) in een eigen container op je server. Je werkt ermee vanuit de browserconsole van je Docker-beheertool (Portainer, Dockge, …) of met `docker exec`.

Elke console komt automatisch in dezelfde **tmux**-sessie terecht. Sluit je de browser, dan draait Claude gewoon door. Open je de console opnieuw, dan ben je terug waar je was. Met Remote Control kun je de sessie ondertussen ook vanaf een ander apparaat volgen.

## Wat zit erin

| Bestand | Doel |
|---|---|
| `Dockerfile` | `node:22-slim` met Claude Code, git, GitHub CLI, tmux, procps en Docker CLI |
| `tmux.conf` | Wordt `/etc/tmux.conf`: muis aan, 50k regels scrollback, 256 kleuren |
| `tmux-autoattach.sh` | Wordt toegevoegd aan `/etc/bash.bashrc`: interactieve shells gaan automatisch naar tmux-sessie `main` |
| `docker-compose.yml` | De service, met herstart na reboot en blijvende home-map |
| `.env.example` | Paden en gebruiker, kopieer naar `.env` |

## Installatie

```bash
git clone https://github.com/rvanderend/claude-code-docker.git
cd claude-code-docker
cp .env.example .env
nano .env                      # PROJECTS_DIR, CLAUDE_HOME, PUID/PGID invullen

# Mappen vooraf aanmaken, anders maakt Docker ze aan als root
mkdir -p /pad/naar/projects /pad/naar/claude-home

docker compose up -d --build
```

Open daarna een console in de container. Kies in je beheertool `/bin/bash` als shell, of gebruik:

```bash
docker exec -it claude-code bash
```

Onderaan zie je de tmux-balk met `main`. Start `claude` en log de eerste keer in. Login, instellingen en gesprekken komen in `CLAUDE_HOME` en blijven bewaard als je de container opnieuw bouwt.

## Dagelijks gebruik

- **Browser dicht** laat alles doordraaien. **Console weer open** brengt je terug in dezelfde sessie.
- **Na een rebuild of herstart** haal je het laatste gesprek terug met `claude --continue`, of kies je een eerder gesprek met `claude --resume`.
- **Remote Control**: typ `/remote-control` in Claude. Daarna volg en stuur je de sessie ook via claude.ai of de app.

tmux-toetsen:

| Toets | Actie |
|---|---|
| `Ctrl-b c` | Nieuw venster |
| `Ctrl-b n` / `Ctrl-b p` | Volgend / vorig venster |
| `Ctrl-b d` | Loskoppelen (sessie blijft draaien) |
| muiswiel | Scrollen |

Een shell zonder tmux start je met `NOTMUX=1 bash`.

## Updaten

Claude Code is via npm in het image geïnstalleerd. Een nieuwe versie krijg je door opnieuw te bouwen:

```bash
docker compose build --pull --no-cache
docker compose up -d
```

Bij `up -d` wordt de container vervangen en sluiten open sessies. Ga daarna verder met `claude --continue`.

## Docker-socket (optioneel)

Wil je dat Claude andere containers kan bekijken of aansturen, bijvoorbeeld om logs te lezen of met `docker exec` iets in een andere container te doen? Haal dan in `docker-compose.yml` het commentaar weg bij de socket-mount en `group_add`, en zet `DOCKER_GID` in `.env`:

```bash
getent group docker | cut -d: -f3
```

**Let op:** met de socket heeft de container in feite root-toegang tot de host. Zet dit alleen aan als je dat bewust wilt.

## In een bestaande compose-stack

Heb je al een grote `docker-compose.yml`? Neem dan de service `claude-code` over en zet `build.context` op de map met deze `Dockerfile`, `tmux.conf` en `tmux-autoattach.sh`.

Gebruik je profiles, geef dan bij `build` en `up` het juiste profiel mee. Zijn er services die van elkaar afhangen, dan kan compose anders klagen over ontbrekende services:

```bash
docker compose --profile all build claude-code
docker compose --profile all up -d --no-deps claude-code
```
