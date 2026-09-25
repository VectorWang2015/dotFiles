# ARIS 本地隔离发行版

`0.1.1-local.2` 面向 DSH `0.1.7-rc.2`，基于上游 npm `dsh-aris@0.1.1` 合入完整语料、辅助工具和 Codex exec 桥，同时保留本机的 runtime-only / Research-only 定制。详见 [LOCAL-CHANGES.md](LOCAL-CHANGES.md) 与 [English](README.md)。

- 默认入口只提供 `ARIS_REPO`、Codex continuation 元信息与只读 ARIS 面板；不会在宿主注册科研技能。
- Research 的稳定 id 为 `research`。通过包内 `presets/research.patch.yml` 的 `@deepseek-ai/dsh-agent-preset` 声明注册，不再扫描旧 `.agent-presets` 目录。
- Research 采用 rc.2 Standard 插件清单，加本机 `copilot-chat / claude-opus-5-5` 压缩策略（thresholdRatio 0.3 / retainRatio 0.08），显式 `tool-ralph.disabled: false` 保留旧版可用性（独立 Standard override 同样保留），最后追加 scoped `dsh-aris/skills`；工作流仍采用新版 workflow-ptc。
- 上游实际有 **83** 个一级技能（新增 `research-implement-feature`）。仅 Research 及继承它的子会话可见；Standard 保留普通用户/项目技能，不暴露 ARIS provider。
- 不覆盖当前默认模型和模式。旧的第二 runtime/file-URL overlay 不能与新包入口重复启用。
- Python 标准库 Codex 桥替代 `codex mcp-server`，仍保留 20 分钟超时；不强制模型或推理档位。它不提供旧 `approval-policy`、`base-instructions`、`developer-instructions`、`compact-prompt` 参数；从旧桥创建的线程没有新桥保存的 options 元数据。
- 当前只验证本机 Codex 0.153.4 和 Python 3.13.12 版本及离线 MCP 握手，没有读取凭据、调用模型或验证实际审稿。桥启动不要求鉴权成功，首次真实审稿仍可能失败。

必须打包并固定本地 tarball；直接升级 `dsh-aris@latest` 会丢失这些定制。`node --test tests/*.test.mjs` 为离线针对性测试，不能替代主装配后的 Web 模式选择、历史恢复、实际 Reviewer 验收。会话 V0→V4 的迁移另由 DSH 负责，本包不修改会话日志。
