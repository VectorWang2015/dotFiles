# DSH (DeepSeek Harness) 配置备份

本目录备份 `~/.dsh/` 下的持久化配置，供新机器直接参照部署。

## 目录镜像

| Repo | System destination |
|------|-------------------|
| `plugins/dsh-workspace-open/` | `~/.dsh/plugins/dsh-workspace-open/` |
| `profiles/web/cordis.patch.yml` | `~/.dsh/profiles/web/cordis.patch.yml` |
| `profiles/web/package.json` | `~/.dsh/profiles/web/package.json` |

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

## 新机器部署步骤

1. 安装 DSH（`npm exec @deepseek-ai/dsh ...` 或等效方式），确保 `~/.dsh/` 已初始化。

2. 复制插件包：
   ```bash
   mkdir -p ~/.dsh/plugins
   cp -r dsh/plugins/dsh-workspace-open ~/.dsh/plugins/
   ```

3. 复制 profile 配置：
   ```bash
   cp dsh/profiles/web/cordis.patch.yml ~/.dsh/profiles/web/cordis.patch.yml
   cp dsh/profiles/web/package.json ~/.dsh/profiles/web/package.json
   ```

4. **调整 `~/.dsh/profiles/web/package.json` 里的 file: 路径**（机器相关）：
   ```json
   "dsh-workspace-open": "file:/home/vectorwang/.dsh/plugins/dsh-workspace-open"
   ```
   把 `/home/vectorwang/` 改成新机器的实际 home，或改用相对路径。

5. 在 `~/.dsh/profiles/web/` 下重装依赖，让 symlink 与 lockfile 落地：
   ```bash
   cd ~/.dsh/profiles/web && pnpm install
   ```

6. 确认 `dsh.profile.bundles` 列表包含 `dsh-workspace-open`（`pnpm install` 不会自动
   reconcile bundle 列表——那需要 `dsh plugin` 命令；保险起见手动核对）。

7. 配置 `~/.dsh/.env`（**敏感，不备份**）：
   ```bash
   echo 'DEEPEYE_API_KEY="<你的智谱 key>"' > ~/.dsh/.env
   ```

8. 重启 `dsh web` 服务（bundle 列表是启动时扫描的，热重载不覆盖新增 bundle）。

## 关键约定

- **`.env` 永不备份**：`~/.dsh/.env` 含明文 API key，属机器私有，不在本仓库。
- **bundle 列表手动同步**：直接 `pnpm add file:...` 不会把包名加进
  `dsh.profile.bundles`（reconcile 只在 `dsh plugin` 包装下发生）；新增/删除
  本地 bundle 后必须手动编辑 `package.json` 的 `bundles` 数组。
- **重启才生效**：`watchUserPatches` 只热重载 `cordis.patch.yml` 与 home patch，
  不重载 bundle 层。改动 bundle 列表后需重启 `dsh web`。
