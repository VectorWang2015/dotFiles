# dsh-workspace-open

本地 DSH Web 插件。在会话头部显示「打开工作区」按钮，使用宿主系统的默认文件管理器打开当前会话的 cwd。

## 兼容与行为

- 版本 `1.1.1`，适配 DSH `0.1.2-rc.1`；不适用于旧 `0.1.1-rc.2`。
- Host half 不提供工具、不读取或修改文件。
- Client 使用 `conversation.session.header.actions` 槽及标准 `useSessions` / `sessionId` props，通过 `ctx.connection.rpc.call('/api', 'session/openWorkspacePath', {args:{request:{path}}})` 调用同一个公开 Host Remote。Connection 保留认证和请求关联，不依赖旧 `dsh-client-runtime` 或 `workspaces.openPath`。
- 直接使用认证 transport 是为了保留「原生文件管理器打开」语义：Better Sidebar 0.18 会接管 `ctx.remote.session.openWorkspacePath` 并将目录误当文件预览；本按钮不关闭或修改侧栏的正常预览设置。
- 没有 cwd 时不显示按钮；请求期间禁止重复提交；Remote 业务错误和连接异常在按钮中显示。
- 只打开宿主文件管理器，不是浏览器所在另一台机器的目录；浏览器需要已经通过 DSH 登录。
- 不增加模型消息、工具或 token 开销。

## 测试

```sh
node --test tests/*.test.mjs
```

测试执行实际发布的 client factory，覆盖新 Remote 调用、选中会话目录、错误显示、防重复请求和槽移除。真实装配验收仍需构建后的 DSH Web 页面，确认注册可见及认证成功。

## 部署

此目录是 dotFiles 源备份；复制到 `~/.dsh/plugins/dsh-workspace-open`，通过 profile 的 `file:../../plugins/dsh-workspace-open` 依赖安装。安装的是副本，编辑 dotFiles 不会自动刷新已安装包。更新后重新安装匹配版本的 profile 依赖，再重启使用该 profile 的 DSH。
