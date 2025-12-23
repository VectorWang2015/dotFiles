#!/usr/bin/env bash
set -e

###############################################################################
# CONFIG (你只需要改这里)
###############################################################################

# 你已经写好的、可用的工作脚本
LABOR_SCRIPT="$HOME/Workspace/000000_scripts/start_labor.sh"

# 传给该脚本的 workspace 路径
LABOR_WS_PATH="$HOME/Workspace/ROS_CONTROL_WS"

# 主 workspace session 名
MAIN_SESSION="workspace"

###############################################################################
# Start terminal + tmux
###############################################################################

# 如果 tmux server 还没起，创建主 session
if ! tmux has-session -t "$MAIN_SESSION" 2>/dev/null; then
  tmux new-session -d -s "$MAIN_SESSION" -c "$HOME/Workspace"

  # 在主 session 中做最基础的初始化
  tmux send-keys -t "$MAIN_SESSION" "cd $HOME/Workspace" C-m
  tmux send-keys -t "$MAIN_SESSION" C-l
  #tmux send-keys -t "$MAIN_SESSION" "neofetch" C-m
fi

###############################################################################
# 调用你的工作区启动脚本（创建 AILabor session）
###############################################################################

if [[ -x "$LABOR_SCRIPT" ]]; then
  "$LABOR_SCRIPT" -p "$LABOR_WS_PATH"
else
  tmux send-keys -t "$MAIN_SESSION" \
    "echo '[WARN] Labor script not found or not executable: $LABOR_SCRIPT'" C-m
fi

###############################################################################
# 打开系统 terminal 并 attach 到 workspace session
###############################################################################
# Swap session order once (simulate {})
tmux run-shell "~/.config/tmux/scripts/move_session.sh right"

tmux attach -t 2

