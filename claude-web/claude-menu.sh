#!/usr/bin/env bash
# Projectmenu voor de browserterminal (ttyd). Draait in claude-web en start Claude in de
# claude-code-container, altijd binnen tmux: één tmux-sessie per project, één venster per gesprek.
# Browser dicht = alleen loskoppelen; Claude draait door en je koppelt later weer aan.
set -uo pipefail
WS="/workspace"
CODE="${CLAUDE_CONTAINER:-claude-code}"

code()    { docker exec "$CODE" "$@"; }
code_it() { docker exec -it "$CODE" "$@"; }

# tmux-sessienaam voor een projectmap (tmux staat geen . en : toe)
session_name() {
  local rel="${1#"$WS"}"; rel="${rel#/}"
  [ -z "$rel" ] && rel="root"
  printf '%s' "$rel" | tr '/.:' '___'
}
has_session()  { code tmux has-session -t "=$1" 2>/dev/null; }
running_list() { code tmux list-sessions -F '#{session_name}' 2>/dev/null; }

attach() {
  code_it tmux -u attach-session -t "=$1" \
    || { echo "Sessie '$1' is al gestopt."; sleep 2; }
}

# Start claude (met extra argumenten) in een nieuw venster van de projectsessie en koppel aan
launch() {
  local dir="$1" args="${2:-}" s
  s="$(session_name "$dir")"
  if has_session "$s"; then
    code tmux new-window -t "=$s:" -c "$dir" bash -lc "claude $args"
  else
    code tmux new-session -d -s "$s" -c "$dir" bash -lc "claude $args"
  fi
  attach "$s"
}

open_shell() { code_it tmux -u new-session -A -s main -c "$1"; }

find_repos() {
  find "$WS" -type d -name node_modules -prune -o \
             -type d -name vendor -prune -o \
             -type d -name .git -print 2>/dev/null \
    | sed 's:/\.git$::' | sort
}

new_project() {
  local name dir
  printf '\n'
  read -rp "Naam nieuw project (a-z, 0-9, - _): " name
  name="$(printf '%s' "$name" | tr -cd 'A-Za-z0-9._-')"
  [ -z "$name" ] && { echo "Ongeldige naam."; sleep 1; return; }
  dir="$WS/$name"
  [ -e "$dir" ] && { echo "Bestaat al: $dir"; sleep 1; return; }
  mkdir -p "$dir" && git -C "$dir" init -q
  echo "Aangemaakt: $dir"; sleep 1
  launch "$dir" ""
}

action_menu() {
  local dir="$1" s act items=()
  s="$(session_name "$dir")"
  if has_session "$s"; then
    items+=("🔗 Open lopende sessie" "✨ Extra gesprek (nieuw venster)" "📜 Kies een eerder gesprek (nieuw venster)")
  else
    items+=("▶ Verdergaan (laatste gesprek)" "✨ Nieuwe sessie" "📜 Kies een eerder gesprek")
  fi
  items+=("↩ Terug")
  act=$(printf '%s\n' "${items[@]}" \
    | fzf --prompt "Actie voor $(basename "$dir") > " --height=45% --reverse --border)
  case "$act" in
    "🔗"*) attach "$s" ;;
    "▶"*)  launch "$dir" "--continue" ;;
    "✨"*) launch "$dir" "" ;;
    "📜"*) launch "$dir" "--resume" ;;
    *) : ;;
  esac
}

while true; do
  declare -A MAP=()
  items=()
  running=" $(running_list | tr '\n' ' ') "
  while IFS= read -r d; do
    [ -z "$d" ] && continue
    rel="${d#"$WS"/}"
    [ "$d" = "$WS" ] && rel="(root)"
    icon="📁"
    [[ "$running" == *" $(session_name "$d") "* ]] && icon="🟢"
    label="$icon $rel"
    items+=("$label")
    MAP["$label"]="$d"
  done < <(find_repos)

  items+=("➕ Nieuw project aanmaken")
  items+=("🐚 Shell (/workspace)")
  items+=("⏻ Sluiten")

  sel=$(printf '%s\n' "${items[@]}" \
    | fzf --prompt "Kies een project > " --height=70% --reverse --border \
          --header "Enter=kiezen · typ om te zoeken · 🟢=draait · in sessie: Ctrl-b d = terug naar menu")
  [ -z "${sel:-}" ] && continue

  case "$sel" in
    "➕"*)  new_project ;;
    "🐚"*) open_shell "$WS" ;;
    "⏻"*)  clear; echo "Tot ziens!"; exit 0 ;;
    *) dir="${MAP[$sel]:-}"; [ -n "$dir" ] && action_menu "$dir" ;;
  esac
  unset MAP
done
