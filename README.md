# Claude Code in Docker

[Claude Code](https://docs.claude.com/en/docs/claude-code) op je eigen server, te bedienen vanuit de browser:

- **Projectmenu in de browser**: kies een project en ga verder met je laatste gesprek, start een nieuw gesprek of kies een eerder gesprek.
- **Blijft draaien als je de browser sluit.** Elk project draait in een eigen tmux-sessie. Open je de pagina opnieuw, dan zie je met 🟢 welke projecten nog draaien en koppel je er weer aan.
- **Blijvende home-map**: login, instellingen en gesprekken blijven bewaard als je de container opnieuw bouwt.

## Opbouw

Er zijn twee containers:

| Container | Wat | Map |
|---|---|---|
| `claude-code` | De werkomgeving: Claude Code, git, GitHub CLI, tmux. Hier draaien je gesprekken en staan je projecten (`/workspace`). | `claude-code/` |
| `claude-web` | De browserterminal ([ttyd](https://github.com/tsl0922/ttyd)) met het projectmenu (`claude-menu.sh`, met fzf). Via `docker exec` start of opent hij Claude in `claude-code`. | `claude-web/` |

```
browser ──► claude-web (ttyd :7681, menu) ──docker exec──► claude-code (tmux ► claude)
```

Door die splitsing heeft alleen `claude-web` de Docker-socket nodig. Claude zelf heeft er geen toegang toe, tenzij je dat [bewust aanzet](#docker-socket-voor-claude-code-optioneel).

## Installatie

```bash
git clone https://github.com/rvanderend/claude-code-docker.git
cd claude-code-docker
cp .env.example .env
nano .env        # paden, PUID/PGID, DOCKER_GID, inlog voor de webterminal

# Mappen vooraf aanmaken, anders maakt Docker ze aan als root
mkdir -p /pad/naar/projects /pad/naar/claude-home

docker compose up -d --build
```

Handige waarden voor `.env`:

```bash
id -u; id -g                            # PUID / PGID
getent group docker | cut -d: -f3       # DOCKER_GID
```

Open daarna **http://localhost:7681** en log in met `WEB_USER` en `WEB_PASSWORD`. Draait de server ergens anders, lees dan eerst [Bereikbaar maken](#bereikbaar-maken).

De eerste keer: kies **🐚 Shell**, start `claude` en log in bij Anthropic. Daarna werkt het menu voor alle projecten.

## Het menu

Typ om te zoeken, Enter om te kiezen.

| Keuze | Wat er gebeurt |
|---|---|
| 📁 *project* | Git-repo in `/workspace`, er draait nu niets |
| 🟢 *project* | Er draait al een tmux-sessie voor dit project |
| ➕ Nieuw project aanmaken | Maakt `/workspace/<naam>` met `git init` en start Claude daarin |
| 🐚 Shell (/workspace) | Gewone shell in tmux-sessie `main` |
| ⏻ Sluiten | Menu afsluiten |

Na het kiezen van een project:

- **Er draait nog niets**: *Verdergaan (laatste gesprek)*, *Nieuwe sessie* of *Kies een eerder gesprek*.
- **Er draait al iets (🟢)**: *Open lopende sessie*. Of start een extra gesprek of een eerder gesprek in een nieuw venster van dezelfde sessie.

In een sessie:

| Toets | Actie |
|---|---|
| `Ctrl-b d` | Terug naar het menu (Claude draait door) |
| `Ctrl-b n` / `Ctrl-b p` | Volgend / vorig venster (gesprek) |
| `Ctrl-b c` | Nieuw venster met een shell |
| muiswiel | Scrollen |
| `Shift` + slepen | Tekst selecteren om te kopiëren |

De muis staat in tmux aan, voor scrollen en het wisselen van vensters. Daardoor selecteert gewoon slepen in de browser niets. Houd daarom `Shift` ingedrukt terwijl je selecteert.

Sluit je Claude af (`/exit`), dan sluit dat venster. Was het het laatste venster, dan stopt de sessie en kom je terug in het menu.

## Bereikbaar maken

De webterminal geeft volledige toegang tot je projecten. Via de Docker-socket kan hij in feite ook bij de hele host. **Zet hem nooit onbeveiligd open naar internet.**

Standaard luistert hij alleen op `127.0.0.1:7681`, met inlog via `WEB_USER` en `WEB_PASSWORD`. Van daaruit heb je drie opties:

- **SSH-tunnel** (eenvoudigst): `ssh -L 7681:localhost:7681 gebruiker@server`, en open daarna http://localhost:7681.
- **Thuis- of kantoornetwerk**: zet `WEB_BIND=0.0.0.0` in `.env`. Alleen doen als het netwerk te vertrouwen is.
- **Reverse proxy met HTTPS en login** (bv. Traefik + Authelia): haal `ports:` weg en hang `claude-web` aan het netwerk van je proxy. Laat de proxy doorsturen naar poort `7681`. Voorbeeld voor Traefik:

  ```yaml
  claude-web:
    networks: [proxy]
    labels:
      - traefik.enable=true
      - traefik.http.routers.claude-web.rule=Host(`claude.example.com`)
      - traefik.http.routers.claude-web.entrypoints=https
      - traefik.http.routers.claude-web.middlewares=chain-authelia@file
      - traefik.http.services.claude-web.loadbalancer.server.port=7681
  ```

  Doet de proxy de login al, dan kun je `-c ${WEB_USER}:${WEB_PASSWORD}` uit `command:` halen.

## Zonder browser: console of `docker exec`

Je kunt ook direct in `claude-code`, via de console van Portainer of Dockge (kies `/bin/bash`) of met:

```bash
docker exec -it claude-code bash
```

Elke interactieve shell gaat automatisch naar tmux-sessie `main`. Een shell zonder tmux start je met `NOTMUX=1 bash`.

## Na een rebuild of herstart

Bij het vervangen van de container stoppen alle tmux-sessies. De gesprekken zelf staan in de home-map en blijven bewaard. Kies in het menu **Verdergaan** of **Kies een eerder gesprek**, of gebruik in een shell `claude --continue` / `claude --resume`.

Met **Remote Control** (`/remote-control` in Claude) volg en stuur je een lopende sessie ook via claude.ai of de app.

## Updaten

Claude Code is via npm in het image geïnstalleerd. Een nieuwe versie krijg je door opnieuw te bouwen:

```bash
docker compose build --pull --no-cache claude-code
docker compose up -d
```

## Docker-socket voor claude-code (optioneel)

Wil je dat Claude zelf andere containers kan bekijken of aansturen, bijvoorbeeld om logs te lezen? Haal dan bij `claude-code` in `docker-compose.yml` het commentaar weg bij de socket-mount en `group_add`.

**Let op:** Claude heeft dan in feite root-toegang tot de host.

## In een bestaande compose-stack

Neem de services `claude-code` en `claude-web` over in je eigen `docker-compose.yml`. Zet `build:` op de mappen `claude-code/` en `claude-web/` van deze repo.

Gebruik je profiles en hangen services van elkaar af? Geef dan het profiel mee dat alles omvat, en gebruik `--no-deps` om alleen deze service te vervangen:

```bash
docker compose --profile all build claude-code
docker compose --profile all up -d --no-deps claude-code
```

Heet de werkcontainer bij jou anders dan `claude-code`, geef `claude-web` dan `CLAUDE_CONTAINER=<naam>` mee als environment.

## Beperkingen

- `claude-web` downloadt ttyd en de Docker CLI voor **x86_64**. Voor ARM (bv. Raspberry Pi) pas je de download-URL's in `claude-web/Dockerfile` aan.
- Het menu toont alleen mappen die een git-repo zijn.
