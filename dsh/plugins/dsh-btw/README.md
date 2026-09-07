# dsh-btw

`/btw <问题>` 在主 agent 忙碌时创建旁路问答子会话：它继承主会话截至最近已完成回合的上下文，在验证真实只读策略后并行回答，不打断、不 steer、也不排队进主会话。

## 兼容目标

- 插件版本：**0.2.0**
- 目标 DSH：**0.1.2-rc.1**
- 本版本不兼容旧的 `Session.events` / `seedLength` / `resolveSessionPreset` 路径；已改用 rc1 的 `snapshotEvents()`、`inheritedEventCount`、`meta.isSeeded` 与 `agentPreset` projection。

## 行为和安全保证

- fork seed 仅包含源会话的**全部已完成回合**及其后的回合间事件，止于下一个 `turn/start` 之前；进行中回合的半成品 assistant 输出不会进入 seed。
- 进行中回合的最新 user 文本仅作为“主会话正在进行中的任务”提示加入子会话第一条消息。
- 子会话继承 cwd、工作区挂接、当前 agent preset、模型路由及 fork 血缘。
- 创建元数据使用 rc1 的 `meta: { parentSession, isSeeded: true }`，精确切点使用顶层 `inheritedEventCount`，不手写旧持久化字段。
- 子会话在投递问题前执行正确的四参数命令调用：`commands.execute(child, '/permission read-only', [], signal)`。
- 随后同时核实 `permissionPresets.current(child.session) === 'read-only'` 和 `sandboxPolicy.resolve({ session }).mode === 'read-only'`。
- 任一权限服务、命令、projection、sandbox policy、工作区挂接或投递步骤失败时，插件 **fail closed**：不投递问题，并通过持有的 `AgentHandle.dispose()` 回滚子会话；已挂接工作区也会先尝试 detach。
- 子会话是普通 fork 会话，显示为 `btw: <问题摘要>`，可在会话列表查看并继续追问。

## 使用

1. 主会话正在执行任务时，在 composer 输入 `/btw <问题>`。
2. 收到成功提示后，在会话列表打开 `btw: ...`。
3. 若只读能力无法验证，会收到失败提示；该问题不会投递。

## 配置

```yaml
- id: dsh-btw
  config:
    maxQuestionChars: 4000 # 问题长度上限
    maxTitleChars: 40      # 子会话标题截断长度
```

0.2.0 不再提供关闭只读钉住的 `pinReadOnly` 开关；BTW 的问答定位要求始终 fail-closed read-only。

## 本地测试

```bash
cd /home/vectorwang/Workspace/dotFiles/dsh/plugins/dsh-btw
node --test test/*.test.js
```

核心单元测试不依赖完整 DSH build，覆盖 fork cut、进行中任务 framing、模型继承、四参数 permission 调用及 sandbox policy 验证。完整 rc1 集成验证仍应在父任务准备的 `/home/vectorwang/Workspace/deepseek-harness-0.1.2-rc.1` 构建产物上完成。

## 部署边界

此目录是 dotFiles 源副本，部署目标为 `~/.dsh/plugins/dsh-btw`。本次实现不修改 live 插件、不启动服务；备份与复制部署由主 agent 负责。

## 剩余限制

- 完整历史前缀会随长会话增长，这是 fork 语义的固有成本。
- 只读保证依赖目标 profile 正确组合 `permissionPresets`、`sandboxPolicy` 和真正执行 confinement 的工具后端；本插件验证 projection/policy，但无法把未沙箱化的第三方工具变成安全工具。
- 仅 Web GUI 人类命令路径可用。
