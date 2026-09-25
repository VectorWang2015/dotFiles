#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# CONFIG
###############################################################################

LABOR_SCRIPT="$HOME/Workspace/000000_scripts/start_labor.sh"
#LABOR_WS_PATH="$HOME/Workspace/USVWidgets"
#LABOR_WS_PATH="$HOME/Workspace/MarineVesselModels"
#LABOR_WS_PATH="$HOME/Workspace/ROS1_wit"
LABOR_WS_PATH="$HOME/Workspace/navigation2_ws"
MAIN_SESSION="workspace"

# Run the tested source checkout directly in an interactive tmux window.
DSH_REPO="$HOME/Workspace/deepseek-harness-0.1.7-rc.2"
DSH_PORT=3080

usage() {
  cat <<'EOF'
Usage:
  start_workspace_on_boot.sh [-p workspace_path]

Options:
  -p workspace_path   Workspace path to pass to labor script. Overrides config.
  -h                  Show this help message.
EOF
}

while getopts ":p:h" opt; do
  case "$opt" in
    p) LABOR_WS_PATH="$OPTARG" ;;
    h) usage; exit 0 ;;
    \?) echo "错误：未知选项 -$OPTARG" >&2; usage; exit 2 ;;
    :)  echo "错误：选项 -$OPTARG 需要一个参数。" >&2; usage; exit 2 ;;
  esac
done
shift $((OPTIND-1))

# Session ordering hooks rename workspace to names such as 1-workspace.
# Keep the stable session id so later renames do not retarget commands.
main_target=""
while read -r session_id session_name; do
  if [[ "$session_name" == "$MAIN_SESSION" ]] || {
    [[ "${session_name%%-*}" =~ ^[0-9]+$ ]] &&
    [[ "${session_name#*-}" == "$MAIN_SESSION" ]]
  }; then
    main_target="$session_id"
    break
  fi
done < <(tmux list-sessions -F '#{session_id} #{session_name}' 2>/dev/null || true)

if [[ -z "$main_target" ]]; then
  main_target="$(tmux new-session -d -P -F '#{session_id}' -s "$MAIN_SESSION" -c "$HOME/Workspace")"
  printf -v workspace_cd 'cd %q' "$HOME/Workspace"
  tmux send-keys -t "$main_target" "$workspace_cd" C-m
  tmux send-keys -t "$main_target" C-l
  tmux send-keys -t "$main_target" "task next" C-m
fi

# Also start DSH when the workspace exists but its previous DSH process exited.
# Never interrupt an existing listener or launch a second instance onto its port.
dsh_listener="$(ss -H -ltn "sport = :$DSH_PORT")"
if [[ -n "$dsh_listener" ]]; then
  printf '[INFO] Port %s is already in use; skipping another DSH launch.\n' "$DSH_PORT"
else
  if [[ ! -d "$DSH_REPO" ]]; then
    printf '[ERROR] DSH checkout not found: %s\n' "$DSH_REPO" >&2
    exit 1
  fi
  dsh_window="$(tmux new-window -d -P -F '#{window_id}' -t "$main_target" -n dsh-web -c "$DSH_REPO")"
  # Interactive shell initialization supplies the user's normal Node/pnpm PATH.
  printf -v dsh_start 'pnpm dsh web --port %q' "$DSH_PORT"
  tmux send-keys -t "$dsh_window" "$dsh_start" C-m
fi

if [[ -x "$LABOR_SCRIPT" ]]; then
  "$LABOR_SCRIPT" -p "$LABOR_WS_PATH"
else
  tmux send-keys -t "$main_target" \
    "echo '[WARN] Labor script not found or not executable: $LABOR_SCRIPT'" C-m
fi

tmux run-shell "~/.config/tmux/scripts/move_session.sh right"
tmux attach -t 2
