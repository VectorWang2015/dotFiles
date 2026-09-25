# dsh-workspace-open

本地 DSH Web 插件。在会话头部显示「打开工作区」按钮，使用宿主系统的默认文件管理器打开当前会话的 cwd。

## 兼容与行为

- 版本 **1.2.0**，目标 DSH **0.1.7-rc.2**；不承诺旧版本或未经验证的新版本兼容。
- Host half 不提供工具，不读取或修改文件，也不添加 session 事件。
- Client 使用 `conversation.session.header.actions` 槽及框架提供的 `useSessions` / `sessionId` props；`openPath` 通过注册项的 `inject` callback 提供，组件不接触 ctx。
- 通过 `ctx.connection.rpc.call('/api', 'session/openWorkspacePath', {args:{request:{path}}})` 调用公开 Host Remote。Connection 保留同源浏览器认证与 rpcId 关联，不依赖旧 `dsh-client-runtime` 或 `workspaces.openPath`。
- 直接走认证 transport 是为保留原生文件管理器语义：旧 Better Sidebar 0.18 会把 `ctx.remote.session.openWorkspacePath` 接管成文件预览。本插件仍绕过这一可被覆盖的便捷方法，不修改侧栏设置，也不绕过 Host 验证。新宿主会验证路径的 Host filesystem 映射及桌面可用性。
- 没有 cwd 时隐藏按钮；请求中禁止重复提交；业务错误、401 和关联/连接异常显示在按钮中，不回退到未认证调用或文件预览。
- 使用 `slots.inject` 等待父槽声明，父槽消失/重建及插件卸载都会清理注册项。
- 打开的是宿主目录，不是远端浏览器机器的目录。无模型消息、工具或 token 开销。

## 测试

```sh
node --test tests/*.test.mjs
DSH_CHECKOUT=/absolute/path/to/deepseek-harness-0.1.7-rc.2 node integration/run.mjs
```

单元测试执行实际 client factory，覆盖选中会话、隐藏、错误、防重复与槽移除。集成 runner 使用指定 checkout 已安装的 tsx/source paths、真实新版 SlotRegistry、React/jsdom 和 Connection RPC；验证父槽后到/重建、所选 cwd、请求 envelope、401、错误关联、业务错误及卸载。只有 HTTP 响应是替身，不调用系统文件管理器，也不启动服务。

这些测试不代替真实页面认证与桌面打开验收。部署后仍需在既有 DSH Web URL 刷新确认按钮、原生打开和新侧栏共存。

## 打包与部署

原生 JS，无构建步骤。发布 `lib/`、`cordis.patch.yml`、package/README；tests/integration 留在源仓库。用 `pnpm pack` 生成独立的版本化 tgz，profile 同时更新依赖 pin 和 lockfile，避免沿用旧 `dsh-workspace-open-1.1.1.tgz`。此说明不自动执行安装。

本目录是 dotFiles 维护源，部署目标为 `~/.dsh/plugins/dsh-workspace-open`；编辑源不会自动更新既有安装。保留旧 tgz 与测试源供回退，勿假定 `file:` 安装与源文件完全隔离（安装器可能使用硬链接）。由主部署流程安装匹配发行包、重新装配宿主并验收现有 URL。
