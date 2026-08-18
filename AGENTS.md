# dotFiles

Personal dotfiles backup. No build, test, lint, or CI. Files are manually deployed (copied, not symlinked) to system destinations.

## Deployment paths

| Repo | System destination |
|------|-------------------|
| `.tmux.conf` | `~/.tmux.conf` |
| `.zshrc` | `~/.zshrc` |
| `.vimrc` | `~/.vimrc` |
| `init.vim` | `~/.config/nvim/init.vim` |
| `tmux/` (entire tree) | `~/.config/tmux/` |
| `i3/` | `~/.config/i3/` |
| `rofi/` | `~/.config/rofi/` |
| `ranger/` | `~/.config/ranger/` |
| `scripts/` | `~/scripts/` |
| `dsh/plugins/dsh-workspace-open/` | `~/.dsh/plugins/dsh-workspace-open/` |
| `dsh/plugins/dsh-btw/` | `~/.dsh/plugins/dsh-btw/` |
| `dsh/profiles/web/cordis.patch.yml` | `~/.dsh/profiles/web/cordis.patch.yml` |
| `dsh/profiles/web/cordis.yml` | `~/.dsh/profiles/web/cordis.yml` |
| `dsh/profiles/web/package.json` | `~/.dsh/profiles/web/package.json` |
| `dsh/profiles/web/pnpm-workspace.yaml` | `~/.dsh/profiles/web/pnpm-workspace.yaml` |
| `dsh/profiles/web/pnpm-lock.yaml` | `~/.dsh/profiles/web/pnpm-lock.yaml` |
| `dsh/cordis.patch.yml` | `~/.dsh/cordis.patch.yml` |
| `dsh/settings.yaml` | `~/.dsh/settings.yaml` |

## Tmux specifics

- **Prefix is `C-s`** (not `C-b`). Unbind/reload is `prefix + r`.
- Window/pane navigation: **no prefix**, use `Alt + h/j/k/l` for panes, `Alt + 1-9` for windows, `Alt + o/u` for prev/next window.
- Pane resize: `Alt + Shift + H/J/K/L`.
- Copy mode: `Alt + v` enters, `v` begins selection, `y` copies to buffer + system clipboard, `Y` copies end-of-line.
- New window: `Alt + W`; kill pane: `Alt + Q`.
- Session switch: `prefix + 1-9` or `F1-F5`.
- All tmux scripts use `set -euo pipefail` — silent failures happen if a command returns non-zero.

### Clipboard copy flow (known gotcha)

`copy_to_clipboard.sh` is piped the selection via `copy-pipe-and-cancel`. It sets the tmux buffer AND the system clipboard. The clipboard tool selection checks **`XDG_SESSION_TYPE`** first:
- `wayland` → `wl-copy`
- `x11` → `xclip`, fallback `xsel`
- otherwise → `pbcopy` (macOS), then generic fallback

**Do not reorder the tool priority without considering `XDG_SESSION_TYPE`**, otherwise `wl-copy` on X11 silently fails.

### Known gaps

- `toggle_scratchpad.sh` is bound to `Alt + s` but **missing from the repo**.
- `agent-tracker` (`~/.config/agent-tracker/bin/tracker-client`) is an external project; bindings are guarded with `test -x && … || true`.
- `move_window_to_session.sh` bindings are commented out in `.tmux.conf`.

## .zshrc specifics

- Built on **Oh My Zsh** (`robbyrussell` theme).
- Plugins: `git`, `extract`, `zsh-syntax-highlighting`, `zsh-autosuggestions`, `universalarchive`. The last four are **external** and must be installed separately; a fresh machine without them will error on shell startup.
- `y()` function: yazi wrapper that `cd`s the shell to yazi's last directory on exit.
- **Machine-generated blocks are intentionally NOT tracked.** Tool installers (`pipx`, `conda init`) append their own PATH/init blocks to the live `~/.zshrc`. Do **not** add pipx PATH or conda init blocks back into the repo copy — they regenerate on install and are machine-specific.
- The live `~/.zshrc` will therefore always have extra trailing blocks (pipx, conda, mamba, etc.) that the repo copy lacks; this drift is expected.

## Script conventions

- Shebang: `#!/usr/bin/env bash` (except `start_labor.sh` which requires zsh).
- All tmux scripts under `tmux/scripts/` use `set -euo pipefail`.
- Scripts called by tmux via `run-shell` must be **executable** and at the system path `~/.config/tmux/scripts/`.

## Git conventions

From `opencode/AGENTS.md`: conventional commits `type(scope): subject`, branch naming `<type>/<description>`, default mode is analysis-only. Agent must ask before committing, pushing, or branching.

## Hardcoded paths (not portable)

Machine-specific paths under `/home/vectorwang/` in `i3/config` (wallpaper), and a Windows path `C:\Users\VectorWang\...` in vim configs. The `.zshrc` no longer carries hardcoded conda/pipx paths — those are left to the installers (see [.zshrc specifics](#zshrc-specifics)).
