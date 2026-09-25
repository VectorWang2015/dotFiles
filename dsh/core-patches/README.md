# DSH 0.1.7-rc.2 本地补丁

基线为官方 tag `dsh-v0.1.7-rc.2`，SHA `477b4f420553e8a52c2fbccc464d7561b239c443`（MIT）。`0.1.7-rc.2-local.patch` 保存本机升级所需的局部修复、人工回归 fixtures 和对应说明，不包含用户历史、凭据或生成的构建产物。

在新的、干净的对应 checkout 中执行 `git apply --check /path/to/0.1.7-rc.2-local.patch`，再 `git apply`；不要重复套到已修改源码，不要强行移植到任意更新版本。安装 frozen lockfile 后运行聚焦测试及完整构建。

## 修复范围

- released V0 中的子 agent descriptor2 经严格字段检查后仅提升为 descriptor3，不合成 reasoning effort，仍执行目标严格校验。未知版本/字段、无效值继续拒绝。
- 历史 user/message 中恰好 `{kind: 'instruction-hint', plugin: 'anchored-tool-bootstrap'}` 的来源被原样保留；不泛化未知 source，不改为人类消息来源，不删除消息。
- pi-ai 中精确的 `internal server error` 与 Responses websocket 无终止响应文本分别归类为 SERVER/TRANSPORT；保留原错误文本以及认证、额度、限流、请求体错误的优先级。provider 配置控制有界重试，不对未知错误无限重试。

## 已执行验证

- 格式目录、V2→V3、持久化新用例及多代发布：16 files / 601 tests 通过。
- V0→V1 和 V1→V2 现有阶段测试：8 files / 256 tests 通过。
- pi-ai convert/adapter/Loader：185 tests 通过；随后新增的本地 HTTP Loader 回归单独通过。
- 迁移包 noEmit 类型检查、修改 TS 的 lint、双语文档配对、diff whitespace 检查通过。
- 官方完整构建及补丁后的 Host 增量构建通过。
- 在私有完整历史副本演练：152 个先前拒绝的会话成功迁移，其余211个（含测试空会话）可读，failed=0/skipped=0。该统计不是公开测试fixture，真实历史没有进入此仓库。

未执行全仓覆盖率或新增顶层 recorded-session snapshot；实际 provider 分类经 Loader + 本地 HTTP 测试，不调用付费模型。真实部署和完整旧数据仍须独立备份及验证，不能仅凭此补丁允许原地无备份迁移。
