/**
 * dsh-btw — busy-parent side-channel Q&A for DSH 0.1.7-rc.2.
 *
 * The plugin snapshots only a completed-turn prefix, creates an ordinary
 * fork-lineage child without acquiring or interrupting the source Agent,
 * verifies a real read-only permission/policy projection, then admits the
 * question. Any safety setup failure disposes the unpublished Q&A child and
 * fails closed without delivery.
 */
import { randomUUID } from "node:crypto"
import { createUserMessage } from "@deepseek-ai/dsh-llm"
import { installModelSelection } from "@deepseek-ai/dsh-agent"
import { buildForkSeed } from "@deepseek-ai/dsh-session/fork"
import {
  ConfigDefaults,
  buildPrompt,
  forkCut,
  inflightTextOf,
  latestModelSelection,
  pinReadOnly,
  truncate,
} from "./core.js"

export { ConfigDefaults } from "./core.js"

export const BTW_GUIDANCE =
  "本机已安装 dsh-btw 插件（btw 旁路问答）：用户可以在主会话 agent 忙碌时输入 /btw <问题>，" +
  "harness 会实时 fork 出一个继承当前会话完整已提交上下文的子会话，并在确认真正只读后并行回答，" +
  "不打断、不排队进主会话。btw 子会话的第一条消息带 [BTW 旁路问答] 标记并附有「主会话正在进行中的任务」说明：" +
  "请只回答用户的问题，不要写文件、不要执行破坏性操作、不要自称主会话或继续主会话的任务。" +
  "并行开发请使用 fork（消息上的 fork 按钮）或 subagent，不要用 btw。用户提到「btw / 旁路问答 / 顺便问」时即指本功能。"

const SECTION_ORDER = 200

function errorText(error) {
  return error instanceof Error ? error.message : String(error)
}

function presetFor(observation) {
  if (observation.projections === undefined) {
    throw new Error("projected Session observation is unavailable; cannot preserve the active agent preset")
  }
  return observation.projections.values.agentPreset ?? undefined
}

async function forkWorkspace(ctx, source) {
  const registry = ctx.get("workspaceRegistry")
  if (registry === undefined) return undefined
  const workspaces = registry.list()
  const direct = workspaces.find((workspace) => workspace.sessionIds.includes(source.id))
  if (direct !== undefined || source.header.origin !== "subagent") return direct
  const query = ctx.get("sessionQuery")
  if (query === undefined) throw new Error("sessionQuery service is unavailable for subagent workspace lineage")
  const lineage = await query.traceSession(source.id)
  for (const ancestor of lineage.ancestors) {
    const workspace = workspaces.find((candidate) => candidate.sessionIds.includes(ancestor.header.id))
    if (workspace !== undefined) return workspace
  }
  return undefined
}

async function rollback(handle, workspace, childId) {
  if (workspace !== undefined) {
    try {
      await workspace.detachSession(childId)
    } catch {
      // Agent disposal remains the authoritative lifecycle rollback.
    }
  }
  try {
    await handle.dispose()
  } catch {
    // Preserve the original setup/delivery failure for the user-facing error.
  }
}

/** Handle one /btw invocation: fork, verify read-only, then deliver. */
export async function handleBtw(ctx, invocation, config) {
  const { agent, rawInput, signal } = invocation
  const question = rawInput.trim()
  const maxQuestionChars = config?.maxQuestionChars ?? ConfigDefaults.maxQuestionChars
  if (question === "") {
    return { kind: "error", text: "用法：/btw <问题>，例如 /btw 这个报错是什么原因？" }
  }
  if (question.length > maxQuestionChars) {
    return { kind: "error", text: `btw 问题过长（${question.length} 字符），请精简到 ${maxQuestionChars} 字符以内。` }
  }

  let observation
  try {
    const query = ctx.get("sessionQuery")
    if (query === undefined) throw new Error("sessionQuery service is unavailable")
    observation = await query.observeSession(agent.session.id, { signal, projectionMode: "all" })
    return await forkObserved(ctx, invocation, config, question, observation)
  } catch (error) {
    return { kind: "error", text: `btw 无法读取或继承会话：${errorText(error)}` }
  } finally {
    observation?.[Symbol.dispose]()
  }
}

async function forkObserved(ctx, invocation, config, question, observation) {
  const { agent, signal } = invocation
  const source = agent.session
  const events = observation.events
  const boundary = forkCut(events)
  if (boundary === undefined) {
    return {
      kind: "error",
      text: `会话 ${source.id} 还没有已完成的回合，无法 fork；先正常对话一轮后再试。`,
    }
  }
  const { lastTurnEndIndex, cut } = boundary
  const inflightText = inflightTextOf(events, lastTurnEndIndex)
  // Observations expose logical, unpacked events. Never apply this cut to
  // persisted chunk rows, whose physical array indexes are not event seqs.
  if (events.some((event, index) => event.seq !== index)) {
    throw new Error("fork requires a contiguous logical Session observation")
  }
  const seed = buildForkSeed(events, events[cut - 1].seq)

  const fallback = ctx.get("agentDefaultModel")?.currentSelection()
  const picked = latestModelSelection(events, fallback)
  if (picked === undefined) {
    return { kind: "error", text: "无法确定模型选择：源会话没有已记录的请求头，且部署没有默认模型。" }
  }
  const selectionRef = { current: picked, assembled: undefined }

  const presets = ctx.get("agentPresets")
  let preset
  try {
    const presetId = presetFor(observation)
    if (presets !== undefined) preset = await presets.resolve(presetId)
    else if (presetId !== undefined) throw new Error("agentPresets service is unavailable")
  } catch (error) {
    return { kind: "error", text: `btw 无法继承 agent preset：${errorText(error)}` }
  }

  let workspace
  try {
    workspace = await forkWorkspace(ctx, source)
  } catch (error) {
    return { kind: "error", text: `btw 无法继承工作区：${errorText(error)}` }
  }

  const childId = `session-${randomUUID()}`
  let handle
  try {
    handle = await ctx.agents.create({
      sessionId: childId,
      seed,
      inheritedEventCount: cut,
      meta: {
        ...(source.header.cwd === undefined ? {} : { cwd: source.header.cwd }),
        parentSession: source.id,
        isSeeded: true,
        ...(preset?.id === undefined ? {} : { agentPreset: preset.id }),
      },
      agentOptions: { provider: picked.provider, model: picked.model },
      signal,
      setup: async (agentCtx) => {
        installModelSelection(agentCtx, selectionRef)
        if (presets !== undefined && preset !== undefined) await presets.mount(agentCtx, preset.id)
      },
    })
  } catch (error) {
    return { kind: "error", text: `btw 子会话创建失败：${errorText(error)}` }
  }

  const child = handle.agent
  let attached = false
  try {
    signal?.throwIfAborted()
    if (workspace !== undefined) {
      await workspace.attachSession(childId)
      attached = true
    }
    await pinReadOnly(ctx, child, signal ?? new AbortController().signal)

    const titles = ctx.get("sessionTitle")
    if (titles !== undefined) {
      titles.rename(child.session, `btw: ${truncate(question, config?.maxTitleChars ?? ConfigDefaults.maxTitleChars)}`)
    }

    signal?.throwIfAborted()
    child.followup(createUserMessage({
      content: [{ type: "text", text: buildPrompt(question, inflightText) }],
      source: { kind: "user" },
    }))
  } catch (error) {
    await rollback(handle, attached ? workspace : undefined, childId)
    return {
      kind: "error",
      text: `btw 安全设置或问题投递失败（未投递，子会话已回滚）：${errorText(error)}`,
    }
  }

  return {
    kind: "success",
    text: `已 fork 只读 btw 子会话「btw: ${truncate(question, 24)}」并开始回答，主会话不受影响。完成后在会话列表中点击它查看答案。`,
  }
}

export const inject = ["commands", "systemPrompt", "agents"]

export function apply(ctx, config) {
  ctx.effect(() =>
    ctx.systemPrompt.section({
      name: "plugin:btw",
      order: SECTION_ORDER,
      text: BTW_GUIDANCE,
    }),
  )
  ctx.effect(() =>
    ctx.commands.register({
      name: "btw",
      description: "旁路问答：fork 一个继承当前会话上下文的只读子会话立即回答，不打断当前 agent",
      input: { hint: "要问的问题" },
      handler: (invocation) => handleBtw(ctx, invocation, config),
    }),
  )
}
