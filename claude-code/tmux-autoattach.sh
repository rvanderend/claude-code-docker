
# Browserconsole automatisch in vaste tmux-sessie 'main' (overleeft het sluiten van de browser).
# Overslaan: NOTMUX=1 bash
if [ -z "$TMUX" ] && [ -z "$CLAUDECODE" ] && [ -z "$NOTMUX" ] && [[ $- == *i* ]] && [ -t 0 ] && command -v tmux >/dev/null; then
  exec tmux new-session -A -s main
fi
