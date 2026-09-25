
# Browserconsole automatisch in vaste tmux-sessie 'main' (overleeft het sluiten van de browser).
# Overslaan: NOTMUX=1 bash
if [ -z "$TMUX" ] && [ -z "$CLAUDECODE" ] && [ -z "$NOTMUX" ] && [[ $- == *i* ]] && [ -t 0 ] && command -v tmux >/dev/null; then
  # De console van Portainer geeft geen TERM mee, en zonder TERM start tmux niet
  case "${TERM:-dumb}" in dumb|unknown) export TERM=xterm-256color ;; esac
  # Lukt tmux toch niet, dan blijft er een gewone shell over in plaats van een gesloten verbinding
  tmux -u new-session -A -s main && exit
fi
