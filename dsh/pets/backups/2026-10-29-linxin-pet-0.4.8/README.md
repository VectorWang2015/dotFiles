# Pet 切换前备份（2026-10-29）

从 `@linxin666/dsh-pet@0.4.8`（由 `@linxin666/dsh-web-all@0.4.8` 提供）切换到 [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet) 前的在线快照。仅备份宠物数据，不包含 DSH 会话、聊天转写、凭据或完整机器配置。

## 内容

- [pet-state.json](pet-state.json)：原 `$DSH_HOME/pet.json`，保存当前角色、好感度、小鱼干和显示位置。拍摄快照时为鲸震恩、6876 好感度、19 条小鱼干；运行中的旧插件仍会继续更新原存档。
- [web-ui-pet.patch.yml](web-ui-pet.patch.yml)：仅提取旧插件的用户层配置，不是完整 Web profile。
- [manifest.json](manifest.json)：快照时间、插件版本和文件 SHA-256。
- [鲸震恩素材](../../jingzhenen/) 与 [舵獭素材](../../duota/)：原 `${CODEX_HOME:-~/.codex}/pets/` 中的两套自定义角色。素材原有 `Proprietary` 声明保留；本备份不授予额外再分发权。

## 切换安排

2026-10-30 00:28（Asia/Shanghai），独立的 systemd 用户级一次性任务核对原 DSH 进程身份后，发送正常停止信号。不开第二个 Web 服务，不自动重启，不强杀；进程已更换或正常停止超时则不改插件配置。通过预检后，停服阶段才启用新插件并禁用 `web-ui-pet`；旧套装和存档不卸载、不删除。新插件默认仅网页显示，关闭自动碎碎念与余额查询。

执行脚本、预装包、完整私有配置快照与停服后的最终 Pet 快照存放于本机 `~/.dsh/pet-migration-20261029/`，不提交完整 profile、运行日志或下载包。停服后的最终快照优先于这里的在线快照。脚本只发送正常停止请求，宿主的退出超时仍由 DSH 自身处理，不将进程退出等同于全部插件清理成功。

## 预装与验证

新插件固定为 `dsh-pet@0.3.8`，版本、下载校验值与验证范围见 [replacement.json](replacement.json)。安装在本机 `~/.dsh/plugins/dsh-pet-0.3.8/`，自带依赖隔离安装，DSH/React peer 复用当前宿主；没有对运行中的 Web profile 执行依赖重装。

19 项临时目录测试覆盖切换、回退、配置防覆盖、写入失败及中断恢复。另通过无副作用的模块导入、实际 DSH 兼容性判定、106 个 WebM 文件头、客户端模块注册、配置合并、候选 YAML 和离线 frozen-lockfile 检查。没有启动第二个 DSH，没有调用模型、余额或 Electron；实际页面渲染、动画解码和跨插件运行集成仍需下次启动后验证。

新插件不使用 Cordis config；专用用户配置在停服后先写入 `$DSH_HOME/dsh-pet/main-config.jsonc`，再启用 bundle。自动碎碎念和余额查询关闭，工作状态显示开启；手动聊天/碎碎念仍会调用模型。不要直接恢复默认配置或添加未审查的 pet pack，它们可能重新打开自动调用和桌面显示。

明早通过原启动入口恢复 DSH：

```sh
~/workspace.sh --dsh-only
```

任务排查与取消（执行前）：

```sh
systemctl --user status dsh-pet-cutover-20261030.timer
systemctl --user stop dsh-pet-cutover-20261030.timer
journalctl --user -u dsh-pet-cutover-20261030.service
```

## 回退旧 Pet

必须先让 DSH 正常停止，防止内存中的存档覆盖恢复结果。

1. 优先使用本机 `~/.dsh/pet-migration-20261029/rollback.py --apply`，它只撤销本次新增的 Pet bundle、依赖声明、链接和禁用项，不覆盖其他插件配置；本次切换未发生时不运行。
2. 原 `$DSH_HOME/pet.json` 和两套角色目录均保留，不需要恢复本快照。只有原存档丢失或损坏时，才从停服后的本机最终快照恢复；仍不可用时，再用这里的 `pet-state.json`。
3. 如需跨机恢复，先安装相同版本的旧套装；将两套素材目录复制到 `${CODEX_HOME:-~/.codex}/pets/`，将本快照复制到 `$DSH_HOME/pet.json`，合并旧插件配置片段，再启动 DSH。

不要用这个 Pet 备份覆盖整个 Web profile，也不要将旧积分直接写入新插件不同格式的配置。
