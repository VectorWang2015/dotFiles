# DSH 配置与本地插件

本目录维护 **DSH 0.2.0-rc.2 升级候选**及可复现的本地定制。2026-10-03 已通过隔离构建、384 个历史副本读取和 Web 组合验收；正式切换须先确认两个 Agent 桌面的照片窗口已保存、可关闭。Git 中的候选版本不等于当前 live 已切换，不能在活动桌面存在时盲目复制配置并重启。

## 候选版本

| 项目 | 版本与来源 |
|---|---|
| DSH | 官方 dsh-v0.2.0-rc.2，639ed015397290b3745d163aafe02ffee4aa3f84，加 [有限本地修复](core-patches/0.2.0-rc.2.README.md) |
| UI 全家桶／Session ID | @linxin666/dsh-web-all、dsh-client-ui-session-id 0.4.4，要求 DSH >=0.2.0-rc.1 |
| Better Sidebar | 0.24.1 |
| Ego Browser | 0.8.6，保留启用，含上游登录态导入和设置兼容修复 |
| ARIS / Research | 0.1.1-local.3，83 个专属技能，精确适配 DSH 0.2.0-rc.2 |
| 自研 Agent Desktop | 0.2.1，精确适配 DSH 0.2.0-rc.2，代码源在独立 dsh-agent-desktop 仓库 |
| 自研工作区打开 | 1.2.0，代码不变，在新 DSH 下组合测试通过 |
| 旧自研 BTW、梁神、DeepEye、Ads | 保持停用；安装/历史文件保留，不恢复其功能 |

新版自动附带的 web-ui-update 行明确禁用，防止形成另一套与源码启动入口冲突的更新流程。旧梁神 0.4.2 补丁保留为历史维护材料，但不再应用到新版停用的 0.4.4 包。Ads/DeepEye 的旧 peer 不支持 0.2，因此保留安装记录但从激活 bundle 列表移除；不是忽略版本检查。

## 主启动入口

**`~/workspace.sh` 仍是 DSH 的主启动入口。** 仓库源为 [start_workspace_on_boot.sh](../scripts/start_workspace_on_boot.sh)，同时部署到 `~/Workspace/000000_scripts/start_workspace_on_boot.sh`。

```sh
~/workspace.sh             # 原完整工作区启动行为不变
~/workspace.sh --dsh-only  # 只启动 DSH，不启动 labor 工具、不 attach tmux
```

两种方式都在已有 workspace tmux 会话中启动 `pnpm dsh web --port 3080`，端口被占用时不重复启动、不杀已有进程。升级事务也应调用这个入口，不另建常驻 systemd supervisor。正式切换前，live 脚本仍指旧 0.1.7；切换成功后才部署候选脚本指向 `~/Workspace/deepseek-harness-0.2.0-rc.2`。

启动器验证：`bash -n scripts/start_workspace_on_boot.sh`、`python3 scripts/tests/test_workspace_start.py`。测试用临时 HOME、stub ss/tmux，不启动真实终端或其他用户工具。

## 构建、历史与回滚

Node 22.23.2、pnpm 11.7.0 满足目标要求。新源码独立目录安装 frozen lockfile 后完整 `pnpm run build`，Linux 再 `pnpm --dir native/system run build:native` 生成实际 Landlock launcher。不能把全部 skipped 的 confinement 测试当作成功，也不能用单独 Vite 页面替代 DSH Web。

0.2.0-rc.2 writer **仍是 Session V4**，384 个完整历史副本只读打开均成功，无格式升级、失败或跳过。历史 V0 前代仍保留；三项旧本地修复（descriptor2、精确 instruction-hint、明确模型瞬态错误分类）在上游未解决，已基于新 tag 保留并测试。详情见 core-patches 的新 README；不是将未知来源/错误全部放行。

正式切换必须：确认无人类接管/活动桌面/其他运行任务，停止旧服务，做完整冷备份（数据、profile、插件、启动脚本），装配已验证候选，检查实际 3080 PID/cwd、认证、插件与历史。失败恢复匹配的代码/profile/数据；不要让旧版本写新版本使用过的数据，不覆盖升级后新消息。冷备份与恢复记录为私有运行资料，不提交 Git。

**Agent Desktop 的窗口不会跨 Host 重启保留。** 即使 Agent 空闲，仍需确认 Local Looks、Feica Fotos 等窗口是否已保存。当前桌面插件是 live link，不能在它运行时原位更新其源码；候选改为固定 tgz，保留 `runtimeRoot: /home/vectorwang/Workspace/agent-desktop-lab/.runtime` 复用已有 native/venv，不迁移或覆盖运行中的 runtime。

## ARIS 定制

[aris-local](aris-local/README.md) 从固定 npm0.1.1 runtime + 精确上游主分支2132036060e03e8d0df69a4b21e5971819c0c2d6资源 + 最小本地overlay重建，不复制整个上游仓库进dotFiles。

- runtime-only宿主与Research-only技能分离，Stable id为research；Standard不暴露ARIS provider。
- 83技能名称集合不变；更新9个原生SKILL、4个镜像、共享资料、7个helper。包含文献待核验/406/S2重试、HTTPS和watchdog锁；不能笼统称CVE安全更新。
- Python Codex exec bridge及本地runtime/client逻辑不变，不重置默认模型、Reviewer设置或压缩策略；保留Ralph配置。
- 重构脚本严格校验来源哈希/提取路径，测试独立HOME、阻断真实网络/外部执行。38兼容、113helper、8重构安全测试通过；两次重构生成相同tgz。

## 版本化插件部署

profile保持`nodeLinker: hoisted`、`autoInstallPeers: false`，避免私带第二套宿主单例。Agent Desktop、workspace-open、ARIS固定相对file: tarball；ARIS完整包在本机按维护脚本重建，不提交上游技能全集。Agent Desktop的小型公开发行tgz随本目录保留，其真正源码在独立GitHub仓库。目录file:可能保留旧安装副本，因此必须核对node_modules实际版本及关键runtime哈希。

profile文件是经审查的公开配置基线，不覆盖机器私有模型/凭据配置。升级候选以实际live patch为基线按项更新；当前导入后的设置不再以旧settings.yaml作为权威。所有`.env`、认证/launch token、SSH/Codex凭据、用户会话与截图日志禁止进入Git。

## 本次验证边界

- DSH本地修复22文件/834测试，相关leaf noEmit/lint/配对文档验证通过。
- 完整core与native构建、384历史副本读取、workspace-open4项、实际Landlock5项通过。
- Desktop新core下118JS、6标准库Python、55worker mock、typecheck/build/packagecheck通过；5GUI opt-in明确未运行，未控制现有桌面。
- 完整隔离Web认证、活跃插件、task-board、model catalog、Research preset、普通/子会话history通过。旧已删除会话ID不作为新历史验收目标。
- 尚需正式切换及真实3080最终验收，不能把Git发布等同于上线。

临时下载、脚本和诊断使用`/tmp`，不再需要时清理。正式源码、可复现维护源、发行物及必要冷备份例外保留。用户授权正常commit/push，禁止夹带lunaria等既有未提交文件或强推。
