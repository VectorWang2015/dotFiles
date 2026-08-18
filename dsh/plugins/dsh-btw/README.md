# dsh-btw

btw 旁路问答（实时 fork）：主 agent **忙碌时**，在 composer 输入 `/btw <问题>`，
立即 fork 一个继承当前会话完整上下文的子会话并行回答，不打断、不排队进主会话。

## 行为

- 子会话 seed = 源会话**全部已完成回合** + 回合间状态事件（权限/预设/标题等），
  并继承 cwd、工作区挂接、模型选择、agent 预设、fork 血缘；
- 正在进行的回合的半成品输出**不会**带入子会话；其 user 请求会作为
  「主会话正在进行中的任务」附注拼进子会话第一条消息；
- 子会话默认执行 `/permission read-only` 钉住只读权限（问答定位，避免与主会话写冲突）；
- 子会话标题为 `btw: <问题摘要>`，出现在会话列表中，可继续追问；
- 主会话完全不受影响（不 steer、不 queue）。

## 使用

1. 主会话正在跑任务时，在输入框输入 `/` 打开命令菜单，输入 `btw <问题>` 回车；
2. 看到成功提示后，去会话列表点击 `btw: ...` 子会话查看答案。

## 配置（profile 的 cordis.patch.yml 中可覆盖）

```yaml
- id: dsh-btw
  config:
    pinReadOnly: true      # 默认 true：fork 后先钉只读权限
    maxQuestionChars: 4000 # btw 问题长度上限
    maxTitleChars: 40      # 子会话标题截断长度
```

## 安装（本机已装）

- 源码：`~/.dsh/plugins/dsh-btw`（file: 依赖安装到 web profile）
- 修改代码后：`cd ~/.dsh/profiles/web && rm -rf node_modules/dsh-btw node_modules/.pnpm/dsh-btw* && pnpm install`，然后重启 `dsh web`

## 已知限制（v0.1）

- 子会话 seed 为完整历史前缀：长会话时每次 btw 的 token 成本随历史增长（fork 语义固有）；
- 只读钉住依赖 `/permission` 命令存在；不存在时子会话继承源会话权限；
- 仅 Web GUI 可用（`/btw` 是人类命令，CLI 未接入）。
