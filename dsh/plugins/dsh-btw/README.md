# dsh-btw

`/btw <问题>` 在主 agent 忙碌时创建旁路问答子会话：继承截至最近已完成回合的上下文，在验证真实只读策略后并行回答，不打断、不 steer、也不排队进主会话。

## 兼容目标

- 插件 **0.3.0**，目标 DSH **0.1.7-rc.2 / Session format 4**。不支持旧 rc.1 的请求头格式；不承诺未经验证的后续版本兼容。
- 使用 `sessionQuery.observeSession(..., {projectionMode: 'all'})` 获取同一切点的逻辑事件与 preset projection，并释放 observation。不会把 JSONL 压缩行索引当成逻辑事件 seq。
- 通过宿主 `@deepseek-ai/dsh-session/fork` 的 `buildForkSeed()` 生成继承标记；`inheritedEventCount` 只计复制的父事件，不计新增 `session/end-seed`。
- Host 依赖由 DSH 提供：`dsh-llm`、`dsh-agent`、`dsh-session/fork`，以及 commands、agents、sessionQuery、agentPresets、permissionPresets、approval、sandboxPolicy 等服务。不捆绑另一份宿主单例。

## 行为与安全

- seed 包含源会话的全部已完成回合和其后回合间事件；遇到下一个 `turn/start`、`user/message` 的 `surfaceOp: append` 或 `agent/inbox/spliced` 停止。进行中 assistant 半成品不会进入 seed。
- 最新进行中 user 文本只作为“主会话正在进行中的任务”提示加入第一条问题。继承 cwd、工作区挂接、preset、模型选择及 fork 血缘。
- 模型选择读取新 `request/header.data.header.config`，保留未消费的 `model/selection`；adapter 默认的 reasoning effort 不误当用户选择。
- 等待异步 `agents.create()` 和 preset mount 完成后，才执行四参数 `commands.execute(child, '/permission read-only', [], signal)`。
- `read-only` preset 必须同时配置 `sandbox: read-only`、`approval: never`。投递前核实 preset projection、实际 sandbox policy、实际 approval policy；允许审批升级的“只读”配置也会拒绝。
- 任一只读设置、preset、挂接、取消或投递步骤失败时不继续投递，通过 `AgentHandle.dispose()` 回滚；已挂接工作区先尝试 detach。
- 子会话是普通 fork，会话标题为 `btw: <问题摘要>`。宿主会在插件卸载时释放该插件创建的活跃 Agent scope，因此不要在旁路问答执行中热卸载插件。

## 配置

```yaml
- id: dsh-btw
  config:
    maxQuestionChars: 4000
    maxTitleChars: 40
```

宿主 0.1.7-rc.2 的 base bundle 权限行 id 是 `permission`，其中 `read-only` 默认搭配 `approval: ask`；BTW 要求改为 `never`。部署时在这行的完整 `presets` 表中合入以下条目，保留其它已有 preset，不能用这个局部片段覆盖整个表：

```yaml
presets:
  read-only:
    sandbox: read-only
    approval: never
```

不存在关闭只读验证的开关。缺少配置时命令明确失败，不回退为普通可写 fork。

## 测试

```sh
node --test test/*.test.js
DSH_CHECKOUT=/absolute/path/to/deepseek-harness-0.1.7-rc.2 node integration/run.mjs
```

单元测试覆盖逻辑 cut、先于 turn/start 的消息 admission、模型选择、权限接口与错误分支。集成 runner 使用指定 checkout 已安装的 tsx 和 source paths，不安装依赖或构建。`integration/cordis.yml` 通过真实 Loader 装配 AgentLoop、Session、preset registry、权限命令和 filesystem sandbox；仅 LLM/工作区挂接/未调用的 shell 外部能力使用替身。测试实际创建忙碌父会话和子会话，检查继承/提示/只读、真实 `FS_SANDBOX_DENIED`、缺失 preset 时回滚、插件卸载清理。

测试只创建并清理独占临时目录，不读取真实会话、凭据，不启动 Web 服务。它不证明 shell 的内核沙箱、未受控第三方工具、真实模型或最终 GUI 部署已验收。

## 打包与部署

原生 ESM，无构建步骤。发布内容为 `lib/`、`cordis.patch.yml`、package/README；测试留在源仓库。可用 `pnpm pack` 生成固定版本 tgz 后交由 profile 安装，或按现有目录 `file:` 方式部署。必须保留源测试和既有发行包，不能只保留 node_modules。

本目录是 dotFiles 维护源；live 目标为 `~/.dsh/plugins/dsh-btw`。源改动不会自动部署。安装器可能硬链接本地文件，升级应使用独立 staging/tgz，不在运行副本上原位修改。宿主重新装配与既有 Web URL 验收由部署流程负责。

## 限制

完整历史 seed 随长会话增长。只读保证依赖真实工具后端执行 confinement；本插件不能把绕过 DSH 沙箱的第三方工具变成安全工具。仅提供人类命令路径，不供模型自行启动旁路工作。
