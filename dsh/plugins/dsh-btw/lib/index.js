/**
 * dsh-btw — btw 旁路问答（实时 fork）
 *
 * Host-only plugin. Registers the `/btw <question>` human command and a
 * system-prompt announcement section. The command handler replicates the
 * host's `sessions.fork` boundary logic (omitted-atSeq cut = the source's
 * last completed turn) without acquiring the source Agent, so it works even
 * while the source agent is busy; it then pins the child read-only by
 * default and delivers the question as the child's first user message.
 * The child is an ordinary session (fork lineage terminates subagent
 * propagation) with the source's full committed context, cwd, workspace
 * attachment, agent preset, and model target — it appears in the session
 * list and answers in parallel, leaving the busy parent undisturbed.
 */
import { randomUUID } from "node:crypto"
import { createUserMessage } from "@deepseek-ai/dsh-llm"
import { resolveSessionPreset } from "@deepseek-ai/dsh-agent-presets"
import { installModelSelection } from "@deepseek-ai/dsh-agent"

/** Model-facing announcement: plugin presence, capability, and limits. */
export const BTW_GUIDANCE =
  "本机已安装 dsh-btw 插件（btw 旁路问答）：用户可以在主会话 agent 忙碌时输入 /btw <问题>，" +
  "harness 会实时 fork 出一个继承当前会话完整上下文的子会话（默认只读权限）并行回答问题，" +
  "不打断、不排队进主会话。btw 子会话的第一条消息带 [BTW 旁路问答] 标记并附有「主会话正在进行中的任务」说明：" +
  "请只回答用户的问题，不要写文件、不要执行破坏性操作、不要自称主会话或继续主会话的任务。" +
  "并行开发请使用 fork（消息上的 fork 按钮）或 subagent，不要用 btw。用户提到「btw / 旁路问答 / 顺便问」时即指本功能。"

/** Order of the announcement section within the tool-guidance band. */
const SECTION_ORDER = 200

/** Config knobs (patch-row config; no schema for the MVP). */
export const ConfigDefaults = {
  /** Pin the btw child to the read-only permission preset before its first turn. */
  pinReadOnly: true,
  /** Cap for the btw question text admitted into the child (chars). */
  maxQuestionChars: 4000,
  /** Title truncation (chars) for `btw: …`. */
  maxTitleChars: 40,
}

/** Concatenated text-block content of one session event. */
function textOf(event) {
  const content = event?.data?.content
  if (!Array.isArray(content)) return ""
  return content
    .filter((block) => block?.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim()
}

function truncate(text, max) {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

/** Handle one /btw invocation: fork + pin + deliver, never throw. */
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
  const source = agent.session
  const events = source.events

  // Mirror the fork RPC boundary: omitted atSeq → cut at the last completed
  // turn, seed = everything through the inter-turn events before the next
  // turn/start. The live events array is seq-indexed (same assumption the
  // host fork handler makes).
  const lastTurnEnd = events.findLast((event) => event.type === "turn/end")
  if (lastTurnEnd === undefined) {
    return {
      kind: "error",
      text: `会话 ${source.id} 还没有已完成的回合，无法 fork；先正常对话一轮后再试。`,
    }
  }
  let cut = lastTurnEnd.seq + 1
  while (cut < events.length && events[cut]?.type !== "turn/start") cut += 1
  const seed = events.slice(0, cut)

  // In-flight request framing: the running turn's own user/message sits after
  // its turn/start, so the fork seed excludes it — quote it into the prompt
  // instead (the parent's partial assistant output stays out on purpose).
  const inflightText = (() => {
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index]
      if (event.type !== "user/message") continue
      const text = textOf(event)
      if (text !== "" && event.seq > lastTurnEnd.seq) return text
      return undefined
    }
    return undefined
  })()

  // Model target: the source's latest logged request/header, else the
  // deployment default ("latest logged model target" fork semantics).
  let headerConfig
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index].type === "request/header") {
      headerConfig = events[index]?.data?.config
      break
    }
  }
  const defaults = ctx.get("agentDefaultModel")
  const fallback = defaults?.currentSelection()
  const picked =
    headerConfig?.provider !== undefined && headerConfig?.model !== undefined
      ? {
          provider: headerConfig.provider,
          model: headerConfig.model,
          ...(headerConfig.reasoningEffort === undefined ? {} : { reasoningEffort: headerConfig.reasoningEffort }),
        }
      : fallback
  if (picked === undefined) {
    return { kind: "error", text: "无法确定模型选择：源会话没有已记录的请求头，且部署没有默认模型。" }
  }
  const selectionRef = { current: picked, assembled: undefined }

  // Preset composition, mirroring the host fork handler (composeAgent).
  const presets = ctx.get("agentPresets")
  const presetId = resolveSessionPreset({ header: source.header, events })
  let resolvedPreset
  if (presets !== undefined) {
    try {
      resolvedPreset = await presets.resolve(presetId)
    } catch {
      resolvedPreset = undefined
    }
  }

  // Fork: create the child session + agent with the completed-turn seed.
  const childId = `session-${randomUUID()}`
  let handle
  try {
    handle = await ctx.agents.create({
      sessionId: childId,
      seed,
      meta: {
        ...(source.header.cwd === undefined ? {} : { cwd: source.header.cwd }),
        parentSession: source.id,
        seedLength: cut,
        ...(resolvedPreset?.id === undefined ? {} : { agentPreset: resolvedPreset.id }),
      },
      agentOptions: { provider: picked.provider, model: picked.model },
      signal,
      setup: async (agentCtx) => {
        installModelSelection(agentCtx, selectionRef)
        if (presets !== undefined && resolvedPreset !== undefined) {
          await presets.mount(agentCtx, resolvedPreset.id)
        }
      },
    })
  } catch (error) {
    return {
      kind: "error",
      text: `btw 子会话创建失败：${error instanceof Error ? error.message : String(error)}`,
    }
  }
  const child = handle.agent

  // Workspace attachment (best effort): direct ownership, then lineage trace
  // when the source is itself a subagent (mirrors forkWorkspace).
  try {
    const registry = ctx.get("workspaceRegistry")
    const workspaces = registry?.list() ?? []
    let workspace = workspaces.find((candidate) => candidate.sessionIds.includes(source.id))
    if (workspace === undefined && source.header.origin === "subagent") {
      const query = ctx.get("sessionQuery")
      if (query !== undefined) {
        const lineage = await query.traceSession(source.id)
        for (const ancestor of lineage.ancestors ?? []) {
          const found = workspaces.find((candidate) => candidate.sessionIds.includes(ancestor.header.id))
          if (found !== undefined) {
            workspace = found
            break
          }
        }
      }
    }
    if (workspace !== undefined) await workspace.attachSession(childId).catch(() => {})
  } catch {
    // best effort — the child still works without a workspace group
  }

  // Read-only pin (default on): run the /permission command against the child
  // agent before its first turn. Q&A children must not write over files the
  // busy parent may be modifying. Best effort: without the presets plugin the
  // command simply does not resolve.
  const pinReadOnly = config?.pinReadOnly ?? ConfigDefaults.pinReadOnly
  if (pinReadOnly) {
    try {
      await ctx.commands.execute(child, "/permission read-only", new AbortController().signal)
    } catch {
      // permission command unavailable — child keeps inherited permissions
    }
  }

  // Cosmetic rename so the child is recognizable in the session list.
  try {
    const titles = ctx.get("sessionTitle")
    if (titles !== undefined) {
      titles.rename(child.session, `btw: ${truncate(question, config?.maxTitleChars ?? ConfigDefaults.maxTitleChars)}`)
    }
  } catch {
    // cosmetic
  }

  // Deliver the question as the child's first user message.
  const framing = [
    "[BTW 旁路问答] 你是从主会话 fork 出的 btw 子会话，负责及时回答用户的旁路问题。",
    pinReadOnly
      ? "本会话是只读问答：不要写文件、不要执行破坏性操作；主会话可能正在并发修改工作区。"
      : "请优先只回答问题；主会话可能正在并发修改工作区，避免写入。",
    "不要自称主会话，不要继续主会话的任务。",
  ]
  if (inflightText !== undefined) framing.push(`主会话正在进行中的任务：${inflightText}`)
  framing.push(`问题：${question}`)
  const message = createUserMessage({
    content: [{ type: "text", text: framing.join("\n\n") }],
    source: { kind: "user" },
  })
  try {
    child.followup(message)
  } catch (error) {
    return {
      kind: "error",
      text: `btw 问题投递失败：${error instanceof Error ? error.message : String(error)}`,
    }
  }
  return {
    kind: "success",
    text: `已 fork btw 子会话「btw: ${truncate(question, 24)}」并开始回答，主会话不受影响。完成后在会话列表中点击它查看答案。`,
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
      description: "旁路问答：fork 一个继承当前会话上下文的子会话立即回答，不打断当前 agent",
      input: { hint: "要问的问题" },
      handler: (invocation) => handleBtw(ctx, invocation, config),
    }),
  )
}
