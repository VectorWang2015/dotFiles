# DSH 配置与本地插件备份

本目录维护源码构建的 DSH `0.1.7-rc.2` 配套配置与本地插件。文件手动复制部署，不使用部署 symlink；不包含凭据、用户会话、运行日志或 node_modules。这里是可重建的配置基线，不等于已完成线上切换；本机实际升级结果以 `~/dsh-upgrade-2026-09-25/result.json` 和 `STATE.md` 为准。

## 固定版本和来源

| 组件 | 版本／性质 |
|---|---|
| DSH | 官方 tag `dsh-v0.1.7-rc.2`，SHA `477b4f420553e8a52c2fbccc464d7561b239c443`，另加本目录记录的本地补丁 |
| 目标源码 | `~/Workspace/deepseek-harness-0.1.7-rc.2` |
| 回滚源码 | 保留 `~/Workspace/deepseek-harness-0.1.2-rc.1` 原构建及匹配的数据/profile |
| UI 全家桶 | 第三方 `@linxin666/dsh-web-all@0.4.2` |
| Better Sidebar | 第三方 `dsh-better-sidebar@0.21.1`，独立安装，新全家桶不再代装 |
| Session ID | 第三方 `@linxin666/dsh-client-ui-session-id@0.4.2` |
| 梁神 | 全家桶带入 0.4.2，使用 [精确启动依赖补丁](liangshen-local/README.md) 修复 registry 启动竞态 |
| DeepEye | 第三方 `dsh-plugin-deepeye@0.2.0`，查询时最新版本未变 |
| ARIS | 第三方上游 0.1.1 + 本地隔离改造 `0.1.1-local.2`，见 [可复现维护目录](aris-local/README.md) |
| BTW／打开工作区 | 本地自研 `dsh-btw@0.3.0`／`dsh-workspace-open@1.2.0` |
| Ego Browser | 第三方 `dsh-ego-browser@0.8.5`，继续禁用，不称为本机自研 |
| Ads | 第三方 Git 依赖固定 `7cbc5e5c937a8eb22c6e0169b61ff3298ab0fb58`，继续禁用 |

这里选择精确的 npm `next` 对应版本，不把 `latest` 当统一升级渠道：核查时 CLI latest 是 0.1.5-rc.3，而 UI 0.4.2 要求 DSH >=0.1.7-rc.2。官方版本仍是预发布。核心 workspace 包按同一 checkout 的 lockfile 安装，不逐包升级 `@latest`。

## 构建与数据迁移

使用目标 checkout 声明的 Node `^22.19.0 || >=24.0.0` 和 pnpm `11.7.0`：`pnpm install --frozen-lockfile`，再 `pnpm run build`。Linux 源码部署还需安装 musl-gcc 并执行 `pnpm --dir native/system run build:native`：根 build 只构建 host addon，不生成 Landlock launcher；不要把全部 skipped 的沙箱测试误报通过。构建包含 Host/Client/Web，不要把独立 Vite 页面当作 DSH 应用。实际启动仍是源码入口 `pnpm dsh web --port 3080`。没有同 checkout 的 dev watcher 时，源码改动不保证自动进入现有 GUI；验收应重启并刷新实际 URL。

Session 格式从 0 升到 4，旧 generation 虽保留，但新版优先选择新 generation，不能靠切换代码实现安全降级。官方原版拒绝部分旧 descriptor2 以及本机历史精确 instruction-hint 来源；本地补丁只做严格的有限转换，不删除消息或泛化未知来源。全量迁移必须先在完整 sessions root 副本演练，父子会话不可拆开。正式切换必须有冷备份；回滚恢复匹配的旧代码、profile、插件和完整旧数据。

模型流错误的 `internal server error`／明确 Responses websocket 提前结束文本在原版 rc.2 仍可能被归为不可重试错误。本地补丁将精确的已知文本归入受限重试类别，不对全部未知错误启用无限重试。它不能保证上游接口不再故障。

## 部署文件与私有配置

| Repo | 本机部署位置／用途 |
|---|---|
| `plugins/dsh-btw/` | `~/.dsh/plugins/dsh-btw/`，包含源码及测试 |
| `plugins/dsh-workspace-open/` | `~/.dsh/plugins/dsh-workspace-open/`，包含版本化 releases |
| `aris-local/` | 从固定上游包重建私有 ARIS；不重复保存上游技能全集 |
| `profiles/web/*` | 经过审查的 Web profile 基线，按项合并，不覆盖机器私有模型配置 |
| `core-patches/` | 与精确官方 tag 配套的局部修复和测试 |
| `../scripts/start_workspace_on_boot.sh` | `~/workspace.sh` 与 `~/Workspace/000000_scripts/start_workspace_on_boot.sh` |
| `pets/jingzhenen/` | `~/.codex/pets/jingzhenen/` |

profile 使用 `nodeLinker: hoisted`、`autoInstallPeers: false`，不另装一份 DSH/Cordis。BTW 用 `file:../../plugins/dsh-btw`；workspace-open 与 ARIS 使用版本化的相对 `file:` tarball 路径。ARIS tgz 从 `aris-local/rebuild.py` 构建，不提交约2MB的上游内容副本；安装前应在本机生成对应 releases 文件。`pnpm install` 不更新 bundle 清单，manifest、bundle 与 lockfile 必须一起维护。目录 `file:` 安装可能使用硬链接或保留旧副本，必须核对实际安装版本和内容，不能在运行中的源码目录原位构建。

新 DSH 首次启动把机器上的 `settings.yaml` 尝试导入 profile 配置后改名为 `settings.yaml.imported`，拒绝导入的节需要人工核对。这里保留的旧 `settings.yaml` 只是历史公开基线，**不是新版活跃设置文件**；不得从机器生成的完整 profile 直接提交凭据、token 或私有模型配置。升级验收核对真实 provider/model，ARIS 不覆盖默认模型。

## 自研插件与 ARIS 隔离

### BTW

`/btw <问题>` 在主会话忙碌时按完整已提交历史分叉，继承模型、preset 和工作区。0.3.0 使用 Session format 4 的逻辑快照及官方 fork seed，拒绝把持久化 packed row 索引当作逻辑序号，也不携带当前未完成工作。

投递前执行四参 `/permission read-only` 并核对权限、sandbox 和 approval，失败关闭子 Agent，不投递。部署必须覆盖 **`id: permission`** 的 presets，令 `read-only` 为 `{sandbox: read-only, approval: never}`；默认 bundle 中该 preset 的 approval 是 ask，不能直接依赖默认值。文件安全仅承诺适用 DSH sandboxPolicy 的执行面，不承诺约束任意绕过该策略的第三方 Node/远端代码。见 [BTW README](plugins/dsh-btw/README.md)。

### 打开工作区

头部槽通过新版 session-scoped 注入取得 cwd，使用认证 Connection RPC 调用 `session/openWorkspacePath` 打开宿主文件管理器，保留绕过 Better Sidebar 文件预览接管的语义。不依赖已删除的 client-runtime 或 workspaces.openPath。见 [插件 README](plugins/dsh-workspace-open/README.md)。

### ARIS

宿主只安装 runtime，83 个技能仅在 Research preset 及其子作用域可用。Research 改为新式 bundle 声明，不再依赖旧 `.agent-presets` 扫描。Standard 和 Research 均保留本机 Copilot Chat 早压缩策略（thresholdRatio 0.3／retainRatio 0.08）和原已启用的 Ralph，使用新版 workflow-ptc。

ARIS 0.1.1 改用上游 Python stdlib Codex exec MCP 桥。认证和真实审稿需独立验收；旧原生 MCP 参数集合和桥接会话状态不能假定完全兼容。不得同时挂旧的 `aris-runtime` file-URL 行与新 bundle runtime。旧安装内指向 rc.1 的手工 skill-filesystem 链接已不应沿用。

## 聚焦测试

```sh
node --test dsh/plugins/dsh-btw/test/*.test.js
DSH_CHECKOUT="$HOME/Workspace/deepseek-harness-0.1.7-rc.2" node dsh/plugins/dsh-btw/integration/run.mjs
node --test dsh/plugins/dsh-workspace-open/tests/*.test.mjs
DSH_CHECKOUT="$HOME/Workspace/deepseek-harness-0.1.7-rc.2" node dsh/plugins/dsh-workspace-open/integration/run.mjs
bash -n scripts/start_workspace_on_boot.sh
```

ARIS 重建和38项离线测试步骤见其维护说明。BTW组合测试使用真实 Loader、权限服务和文件沙箱，workspace组合测试使用真实 SlotRegistry、React 与 Connection；它们不替代真实 Web 登录、UI 加载、旧历史、宿主打开行为和模型调用验收。

## 有意保留的行为

- DeepEye 继续使用 GLM-4.6V，8192输出上限、120秒超时，凭据只存本机。
- Ads 与 Ego 继续禁用；不恢复已经移除的自制硬删除插件。
- UI 0.4.2 默认关闭的 SSH、梁神、技能中心按旧部署保持启用。
- 使用官方 JSONL 持久化，不增加第三方数据库后端。
- 归档不等于删除；物理删除需单独确认，不能在真实历史上做升级测试。
- 原 `.agent-presets` 目录保留供回滚，但新 core 不扫描它。实际使用的 Research 和梁神已分别由新 bundle 恢复；未发现历史会话显式选择的旧第三方 Anchored 实验预设未自动启用，也未删除其文件。

## 启动与回滚

日常入口仍由 workspace.sh/tmux 所有，不新建常驻 supervisor。脚本在 `dsh-web` 窗口运行 `pnpm dsh web --port 3080`；端口已占用时不重复启动。独立升级事务可临时使用 systemd user transient unit 执行停机、冷备份、迁移、健康检查与失败回滚，但不改变日常启动所有权。

本机升级目录只对本人开放，保存完整备份、日志、恢复步骤和结果。浏览器使用新进程打印的登录 URL；token 不进入 dotFiles。回滚必须使用匹配的冷备份，不让旧版写新版数据。`.env`、SSH/Codex 凭据、会话、截图及运行日志一律不提交。

用户授权对其要求的 dotFiles 修改正常 commit/push；提交前检查范围和敏感内容，不夹带无关改动、不擅自新建分支或强推。
