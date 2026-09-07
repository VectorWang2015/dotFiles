# DSH 配置与本地插件备份

本目录保存源码构建的 DSH `0.1.2-rc.1` 配套配置。文件手动复制部署，不使用 symlink；不包含凭据、用户会话或 node_modules。实际切换结果以本机 `~/dsh-upgrade-2026-09-05/result.json` 和 `DEPLOYMENT-RESULT.md` 为准。

## 固定版本

| 组件 | 版本/位置 |
|---|---|
| DSH | tag `dsh-v0.1.2-rc.1`，SHA `a66e4702047846cdaa10c66c9d3df3951f5ea70d` |
| 活跃源码目标 | `~/Workspace/deepseek-harness-0.1.2-rc.1` |
| 回滚源码 | `~/Workspace/deepseek-harness`，保留 `0.1.1-rc.2` 原构建 |
| UI 全家桶 | `@linxin666/dsh-web-all@0.3.16`，不要混装旧 `dsh-web-ui-all` |
| Better Sidebar | 新全家桶带入 `0.18.0` |
| Session ID | 独立保留 `@linxin666/dsh-client-ui-session-id@0.3.16` |
| DeepEye / ARIS | `dsh-plugin-deepeye@0.2.0` / `dsh-aris@0.1.0` |
| 自制 BTW / 打开工作区 | `dsh-btw@0.2.0` / `dsh-workspace-open@1.1.1` |

主程序使用目标 checkout 的 pnpm `11.7.0` 与 frozen lockfile 构建，包括 Web artifacts。修改源码或插件之后，必须验证实际安装副本并重启；单纯编辑 dotFiles 不会改变运行中的 GUI。

## 部署镜像

这里的 profile 是已审查的升级基线，不是对本机全部后续实验配置的自动镜像。工作区打开插件、BTW 与启动脚本已和本机核对；本机另行安装的 ARIS 隔离版、浏览器实验插件及其临时热加载覆盖未纳入这份 profile。恢复到已有环境时应按项合并，不要用本目录整体覆盖较新的本机配置。

| Repo | 本机部署位置 |
|---|---|
| `plugins/*` | `~/.dsh/plugins/*` |
| `profiles/web/*` | `~/.dsh/profiles/web/*` |
| `cordis.patch.yml` | `~/.dsh/cordis.patch.yml` |
| `settings.yaml` | `~/.dsh/settings.yaml`（只含配置及凭据环境变量名） |
| `pets/jingzhenen/` | `~/.codex/pets/jingzhenen/` |
| `../scripts/start_workspace_on_boot.sh` | `~/workspace.sh` 与 `~/Workspace/000000_scripts/start_workspace_on_boot.sh` |

BTW 使用 `file:../../plugins/dsh-btw`；workspace-open 使用带版本与完整性校验的 `file:../../plugins/dsh-workspace-open/releases/dsh-workspace-open-1.1.1.tgz`，因此复制整个 `~/.dsh` 后仍可解析。`pnpm install` 不负责更新 `dsh.profile.bundles`；聚合 bundle 的名称和列表必须与 manifest 一致。profile 使用 `nodeLinker: hoisted`、`autoInstallPeers: false`，避免重复安装另一份 DSH/Cordis。

对自制插件改版，必须检查 node_modules 的实际版本和文件内容，不能只看安装命令成功。hoisted 模式下目录型 file 依赖可能保留旧副本；workspace-open 因此打成版本化 tarball。后续修改它时升版本、在插件目录执行 `pnpm pack --pack-destination releases`、修改 profile 的 tarball 路径并重新安装；源码、tarball、profile 和 lockfile 一起备份。

## 自制插件

### BTW

主会话忙碌时 `/btw <问题>` 从已完成回合边界分叉，继承模型、preset 和工作区，在独立会话回答。实现使用 rc.1 的 Session snapshot、继承长度和 preset 接口。

投递前调用四参数 `commands.execute(child, '/permission read-only', [], signal)`，并核实 permission preset 与 sandbox policy 都为只读；失败不投递并清理子 Agent/工作区挂接。只读安全覆盖遵守 DSH sandboxPolicy 的工具，不承诺能约束绕过该策略直接使用 Node/远程服务的第三方代码。详见 [BTW README](plugins/dsh-btw/README.md)。

测试：`node --test plugins/dsh-btw/test/*.test.js`。真实部署验收还必须检查忙碌父会话、fork lineage、子会话回答与实际写文件拒绝，而非仅检查 prompt 文本。

### 打开工作区

会话头部按钮从标准 `useSessions` / `sessionId` 取得当前 cwd，通过已认证的 Connection RPC 调用 `session/openWorkspacePath` 打开宿主文件管理器，避免 Better Sidebar 对 Remote proxy 的文件预览接管。不依赖已删除的 client-runtime 或 workspaces.openPath。详见 [插件 README](plugins/dsh-workspace-open/README.md)。

测试：`node --test plugins/dsh-workspace-open/tests/*.test.mjs`。

### 会话归档与删除

会话管理统一使用全家桶中的 `@linxin666/dsh-session-archive`，入口是「设置 → 会话归档管理」。旧的自制硬删除插件已移除，不再维护第二套直接删除目录的接口。归档不等于删除；物理删除需要单独确认，并注意可能包含子孙会话。

## 有意保留的配置

- DeepEye 路由保持 Zhipu GLM-4.6V、maxTokens 8192、requestTimeout 120000；API key 来自机器私有 `.env`。
- `web-ui-describe-image` 禁用，避免与 DeepEye 重复；必须使用聚合行的 `web-ui-` 前缀。
- 广告插件保持禁用，Git 依赖固定原有 commit。
- `web-ui-doctor` 禁用：通过 workspace.sh/tmux 手动启动，不让插件另外部署后台 supervisor。
- 使用官方 JSONL 持久化，不启用旧 Better Session / 第三方 RDB / perf 持久化覆盖。
- 新全家桶不携带旧 chat-recovery、AionUI 面板和 desktop-launcher；归档改用新 session-archive，Session ID 独立保留。
- v0.3.16 对禁用家族行仍可能显示设置入口；doctor/status 和 CLI 不提供的 update/status 的 404 不代表 DSH 核心不可用。其他资源失败应调查，不能一概忽略。

## 启动与维护

日常入口是 `~/workspace.sh`（等同于 `~/Workspace/000000_scripts/start_workspace_on_boot.sh`）。它在工作区的 `dsh-web` tmux 窗口中直接运行 `pnpm dsh web --port 3080`，不调用 systemd，也不读取升级事务的结果文件来决定启动方式。

- 新建工作区时创建 DSH 窗口；已有 `workspace` / `1-workspace` 等会话时，如果 DSH 已退出，也可以重新启动它。
- 3080 已被占用时跳过重复启动，不主动中断正在使用该端口的进程。
- 日志直接显示在 DSH 的 tmux 窗口中；在该窗口按 Ctrl+C 会结束 DSH，关闭承载它的 pane 也会影响服务。
- 只启动 DSH 时，也可在新 checkout 的终端中直接运行 `pnpm dsh web --port 3080`。
- 本仓库不再分发 systemd unit。按用户选择，2026-09-06 调整时没有重启现有实例；该临时旧 unit 已禁用自动启动和自动重启，保留当前进程至退出。

完整升级/回滚备份仍保存在 `~/dsh-upgrade-2026-09-05/`（私有目录，不提交）；旧升级报告记录的是当时的切换方式，未来启动以本节为准。过渡中的当前实例仍将日志写入旧日志位置，因此暂时保留该目录。浏览器登录使用当前 DSH 启动时显示的 launch URL；token 不放入 dotFiles 或公开报告。

启动脚本修改后运行 `bash -n` 检查语法。重启前确认没有需要保留的活动任务；若回滚，源码、插件/profile 和数据必须成套恢复，并相应调整 `DSH_REPO`。

## 凭据与备份边界

- `.env`、SSH 凭据、Codex 凭据、launch token、会话与测试日志**不进入 dotFiles**。
- 本机升级事务的私有冷备份可以包含这些数据，目录必须仅本用户可读，不能上传到 Git。
- 用户已授权对其要求的 dotFiles 改动自主 commit 和正常 push；提交前审查差异、运行相关检查并排除敏感信息。不自动包含无关改动，不擅自新建分支或强推。
