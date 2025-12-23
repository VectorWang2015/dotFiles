#!/usr/bin/env zsh
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  start_labor_min.sh [-p ws_path] [-e env_name]

Options:
  -p ws_path   Workspace path (relative OK). Default: ~/Workspace
  -e env_name  Conda environment name. Default: ros_env
EOF
}

ws_path="~/Workspace"
env_name="ros_env"

while getopts ":p:e:h" opt; do
  case "$opt" in
    p) ws_path="$OPTARG" ;;
    e) env_name="$OPTARG" ;;
    h) usage; exit 0 ;;
    \?) echo "Unknown option: -$OPTARG" >&2; usage; exit 2 ;;
    :)  echo "Option -$OPTARG requires an argument." >&2; usage; exit 2 ;;
  esac
done

# Resolve path
ws_path="${ws_path/#\~/$HOME}"
ws_path="${ws_path:A}"

if [[ ! -d "$ws_path" ]]; then
  echo "Error: ws_path does not exist or is not a directory: $ws_path" >&2
  exit 1
fi

if ! command -v tmux >/dev/null 2>&1; then
  echo "Error: tmux is not installed or not in PATH." >&2
  exit 1
fi

# Pick a unique session name: AILabor1, AILabor2, ...
session_name="AILabor"

# Create session and capture immutable session_id (sid)
sid="$(tmux new-session -d -P -F '#{session_id}' -s "$session_name" -c "$ws_path")"

# Rename session explicitly (in case any config renames it)
tmux rename-session -t "$sid" "$session_name" 2>/dev/null || true

# Get the first window id
wid="$(tmux list-windows -t "$sid" -F '#{window_id}' | head -n 1)"
# Rename the window
tmux rename-window -t "$wid" "labor_window"


# Split into two panes (left/right), both start in ws_path
tmux split-window -h -t "$wid" -c "$ws_path"
tmux select-layout -t "$wid" even-horizontal

# Optional: show a tmux message so you know it ran
tmux display-message -t "$sid" "Created ${session_name} at ${ws_path} (sid=$sid)"

# Get pane ids (left/right)
left_pane="$(tmux list-panes -t "$wid" -F '#{pane_id}' | sed -n '1p')"
right_pane="$(tmux list-panes -t "$wid" -F '#{pane_id}' | sed -n '2p')"

# 先 cd（虽然 -c 已经做了，但显式做一次不亏）
tmux send-keys -t "$left_pane"  "cd ${(qq)ws_path}" C-m
tmux send-keys -t "$right_pane" "cd ${(qq)ws_path}" C-m

# 直接激活 conda env
tmux send-keys -t "$left_pane"  "conda activate ${(qq)env_name}" C-m
tmux send-keys -t "$right_pane" "conda activate ${(qq)env_name}" C-m

# 清屏（Ctrl-l）
tmux send-keys -t "$left_pane"  C-l
tmux send-keys -t "$right_pane" C-l

# 左 pane 启动 opencode
tmux send-keys -t "$left_pane"  "opencode" C-m

# 右 pane 启动 neofetch
tmux send-keys -t "$right_pane" "neofetch" C-m

# Attach / switch
#if [[ -n "${TMUX-}" ]]; then
  #tmux switch-client -t "$sid"
#else
  #tmux attach -t "$sid"
#fi

