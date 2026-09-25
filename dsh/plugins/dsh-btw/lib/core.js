export const ConfigDefaults = {
  maxQuestionChars: 4000,
  maxTitleChars: 40,
}

export function truncate(text, max) {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

export function textOf(event) {
  const content = event?.data?.content
  if (!Array.isArray(content)) return ""
  return content
    .filter((block) => block?.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim()
}

export function forkCut(events) {
  const lastTurnEndIndex = events.findLastIndex((event) => event.type === "turn/end")
  if (lastTurnEndIndex < 0) return undefined
  let cut = lastTurnEndIndex + 1
  while (cut < events.length) {
    const next = events[cut]
    // A newly admitted user message can precede turn/start in format 4.
    if (next.type === "turn/start" || next.type === "agent/inbox/spliced"
      || (next.type === "user/message" && next.surfaceOp === "append")) break
    cut += 1
  }
  return { lastTurnEndIndex, cut }
}

export function inflightTextOf(events, lastCompletedIndex) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event.type !== "user/message") continue
    const text = textOf(event)
    if (text !== "" && index > lastCompletedIndex) return text
    return undefined
  }
  return undefined
}

export function latestModelSelection(events, fallback) {
  let pending
  let lastUsed
  for (const event of events) {
    if (event.type === "model/selection") pending = event.data
    if (event.type !== "request/header") continue
    const header = event.data.header
    const config = header.config
    lastUsed = {
      provider: config.provider,
      model: config.model,
      ...(config.reasoningEffort === undefined || header.adapterDefaults?.reasoningEffort === true
        ? {} : { reasoningEffort: config.reasoningEffort }),
    }
    if (pending?.provider === config.provider && pending?.model === config.model
      && pending?.reasoningEffort === config.reasoningEffort) pending = undefined
  }
  return pending ?? lastUsed ?? fallback
}

export function buildPrompt(question, inflightText) {
  const framing = [
    "[BTW 旁路问答] 你是从主会话 fork 出的 btw 子会话，负责及时回答用户的旁路问题。",
    "本会话已被钉为只读问答：不要写文件、不要执行破坏性操作；主会话可能正在并发修改工作区。",
    "不要自称主会话，不要继续主会话的任务。",
  ]
  if (inflightText !== undefined) framing.push(`主会话正在进行中的任务：${inflightText}`)
  framing.push(`问题：${question}`)
  return framing.join("\n\n")
}

export async function pinReadOnly(ctx, child, signal) {
  const presets = ctx.get("permissionPresets")
  if (presets === undefined) throw new Error("permissionPresets service is unavailable")
  const spec = presets.resolve("read-only")
  if (spec.sandbox !== "read-only" || spec.approval !== "never") {
    throw new Error("read-only preset must enforce sandbox read-only and approval never")
  }
  const execution = await ctx.commands.execute(child, "/permission read-only", [], signal)
  if (execution === undefined) throw new Error("/permission command is unavailable")
  if (execution.result?.kind !== "success") {
    throw new Error(`/permission read-only was rejected: ${execution.result?.text ?? "unknown result"}`)
  }
  const selected = presets.current(child.session)
  const policy = ctx.get("sandboxPolicy")
  const effectiveMode = policy?.resolve({ session: child.session })?.mode
  if (selected !== "read-only") {
    throw new Error(`permission projection reports ${String(selected)}, expected read-only`)
  }
  if (effectiveMode !== "read-only") {
    throw new Error(`sandbox policy reports ${String(effectiveMode)}, expected read-only`)
  }
  const approval = ctx.get("approval")
  const approvalPolicy = approval?.overrideOf(child.session) ?? approval?.config.policy
  if (approvalPolicy !== "never") {
    throw new Error(`approval policy reports ${String(approvalPolicy)}, expected never`)
  }
}
