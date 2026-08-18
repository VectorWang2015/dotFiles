# DSH (DeepSeek Harness) 配置备份

本目录备份 `~/.dsh/` 下的持久化配置，供新机器直接参照部署。

## 目录镜像

| Repo | System destination |
|------|-------------------|
| `plugins/dsh-workspace-open/` | `~/.dsh/plugins/dsh-workspace-open/` |
| `plugins/dsh-btw/` | `~/.dsh/plugins/dsh-btw/` |
| `profiles/web/cordis.patch.yml` | `~/.dsh/profiles/web/cordis.patch.yml` |
| `profiles/web/cordis.yml` | `~/.dsh/profiles/web/cordis.yml` |
| `profiles/web/package.json` | `~/.dsh/profiles/web/package.json` |
| `profiles/web/pnpm-workspace.yaml` | `~/.dsh/profiles/web/pnpm-workspace.yaml` |
| `profiles/web/pnpm-lock.yaml` | `~/.dsh/profiles/web/pnpm-lock.yaml` |
| `cordis.patch.yml` | `~/.dsh/cordis.patch.yml`（home 层 patch，皮肤选择） |
| `settings.yaml` | `~/.dsh/settings.yaml` |
| `pets/jingzhenen/` | `~/.codex/pets/jingzhenen/` |

部署方式：**手动复制**（与其他 dotFiles 条目一致，复制而非 symlink）。

## 包含的改动

### 1. `dsh-workspace-open` 插件（本地 bundle 插件）

在会话头部加一个「📂 打开工作区」按钮，用系统默认文件管理器打开当前会话所属工作区目录。

- 纯 Client 插件（`lib/index.js` 的 host half 为空 `apply`）。
- `lib/client.js` 是构建产物格式（`window.__ModuleLoader__.load`），注册到
  `conversation.session.header.actions` slot，读取 `useSessions().byId[id].cwd`
  后调用 `ctx.workspaces.openPath(cwd)`。
- 依赖 `dsh.client.inject: ["@deepseek-ai/dsh-client-runtime", "@deepseek-ai/dsh-client-ui-slots"]`。

### 2. `profiles/web/cordis.patch.yml`

用户 patch 层，两处 id-targeted override：

- `deepeye-vision`：把视觉调用路由到 Zhipu GLM-4.6V（付费）。
  **API key 不在此文件内**——它来自 `~/.dsh/.env` 的 `$DEEPEYE_API_KEY`，
  该 `.env` 是敏感文件，**切勿提交**（见下）。
- `dsh-ads`：`disabled: true`，关闭广告插件。

### 3. `profiles/web/package.json`

声明依赖 + `dsh.profile.bundles` 列表，新增了 `dsh-workspace-open`。

### 4. `dsh-btw` 插件（btw 旁路问答 = 实时 fork）

主 agent **忙碌时**输入 `/btw <问题>`，实时 fork 出一个继承当前会话完整上下文的子会话
并行回答，不打断、不排队进主会话（并行开发请用 fork / subagent，不要用 btw）。

- **机制**：注册 dsh-commands 人类命令（`/btw`），handler 复刻 fork RPC 的切点逻辑
  （seed = 源会话全部已完成回合 + 回合间状态事件，不获取源 Agent，因此 busy 时可用）；
  子会话继承 cwd / 工作区挂接 / 模型选择 / agent 预设，标题 `btw: <摘要>`；
  进行中回合的 user 请求作为「主会话正在进行中的任务」附注拼进子会话首条消息。
- **只读默认**：先对子会话执行 `/permission read-only` 钉只读（问答定位，避免写冲突）；
  失败则回退继承源会话权限。
- **cordis 陷阱**：直接访问 `ctx.agents` 等服务属性必须在插件 `inject` 中声明
  （本插件 `["commands", "systemPrompt", "agents"]`），否则运行时抛
  `cannot get property "agents" without inject`；可选服务一律用 `ctx.get(...)` 软查找。
- **改代码后**：file: 依赖按版本快照复制，需升版本号 → 
  `cd ~/.dsh/profiles/web && rm -rf node_modules/dsh-btw node_modules/.pnpm/dsh-btw* && pnpm install`
  → 重启 `dsh web`。

### 5. `pets/jingzhenen/`

dsh-pet 自定义宠物「鲸震恩」（蓝色鲸鱼），两个文件缺一不可：

- `pet.json`：宠物清单（id / displayName / cell / 每行帧数 / 各 track 节奏）。
- `spritesheet.webp`：9 行动画图集（1536×1872，透明背景）。

dsh-pet 的 registry 会自动扫描 `~/.codex/pets/*/`，放进目录后重启 `dsh web`，
在宠物设置里选「鲸震恩」即可。

## 新机器部署步骤

1. 安装 DSH（`npm exec @deepseek-ai/dsh ...` 或等效方式），确保 `~/.dsh/` 已初始化。

2. 复制插件包：
   ```bash
   mkdir -p ~/.dsh/plugins
   cp -r dsh/plugins/dsh-workspace-open ~/.dsh/plugins/
   cp -r dsh/plugins/dsh-btw ~/.dsh/plugins/
   ```

3. 复制 profile 配置与 home 层状态：
   ```bash
   cp dsh/profiles/web/cordis.patch.yml ~/.dsh/profiles/web/cordis.patch.yml
   cp dsh/profiles/web/cordis.yml ~/.dsh/profiles/web/cordis.yml
   cp dsh/profiles/web/package.json ~/.dsh/profiles/web/package.json
   cp dsh/profiles/web/pnpm-workspace.yaml ~/.dsh/profiles/web/pnpm-workspace.yaml
   cp dsh/profiles/web/pnpm-lock.yaml ~/.dsh/profiles/web/pnpm-lock.yaml
   cp dsh/cordis.patch.yml ~/.dsh/cordis.patch.yml
   cp dsh/settings.yaml ~/.dsh/settings.yaml
   ```

4. 复制宠物：
   ```bash
   mkdir -p ~/.codex/pets
   cp -r dsh/pets/jingzhenen ~/.codex/pets/
   ```

5. **调整 `~/.dsh/profiles/web/package.json` 里的 file: 路径**（机器相关）：
   ```json
   "dsh-workspace-open": "file:/home/vectorwang/.dsh/plugins/dsh-workspace-open",
   "dsh-btw": "file:/home/vectorwang/.dsh/plugins/dsh-btw"
   ```
   把 `/home/vectorwang/` 改成新机器的实际 home，或改用相对路径。

6. 在 `~/.dsh/profiles/web/` 下重装依赖（lockfile 已在 repo，直接 `pnpm install` 复现）：
   ```bash
   cd ~/.dsh/profiles/web && pnpm install
   ```

7. 确认 `dsh.profile.bundles` 列表包含 `dsh-workspace-open` 与 `dsh-btw`
   （`pnpm install` 不会自动 reconcile bundle 列表——那需要 `dsh plugin` 命令；
   保险起见手动核对）。

8. 配置 `~/.dsh/.env`（**敏感，不备份**）：
   ```bash
   echo 'DEEPEYE_API_KEY="<你的智谱 key>"' > ~/.dsh/.env
   ```

9. 重启 `dsh web` 服务（bundle 列表是启动时扫描的，热重载不覆盖新增 bundle）。

## 关键约定

- **`.env` 永不备份**：`~/.dsh/.env` 含明文 API key，属机器私有，不在本仓库。
- **bundle 列表手动同步**：直接 `pnpm add file:...` 不会把包名加进
  `dsh.profile.bundles`（reconcile 只在 `dsh plugin` 包装下发生）；新增/删除
  本地 bundle 后必须手动编辑 `package.json` 的 `bundles` 数组。
- **重启才生效**：`watchUserPatches` 只热重载 `cordis.patch.yml` 与 home patch，
  不重载 bundle 层。改动 bundle 列表后需重启 `dsh web`。
