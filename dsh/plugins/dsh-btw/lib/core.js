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
  const lastTurnEnd = events.findLast((event) => event.type === "turn/end")
  if (lastTurnEnd === undefined) return undefined
  let cut = lastTurnEnd.seq + 1
  while (cut < events.length && events[cut]?.type !== "turn/start") cut += 1
  return { lastTurnEnd, cut }
}

export function inflightTextOf(events, lastCompletedSeq) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event.type !== "user/message") continue
    const text = textOf(event)
    if (text !== "" && event.seq > lastCompletedSeq) return text
    return undefined
  }
  return undefined
}

export function latestModelSelection(events, fallback) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event.type !== "request/header") continue
    const config = event?.data?.config
    if (config?.provider === undefined || config?.model === undefined) break
    return {
      provider: config.provider,
      model: config.model,
      ...(config.reasoningEffort === undefined ? {} : { reasoningEffort: config.reasoningEffort }),
    }
  }
  return fallback
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
  presets.resolve("read-only")
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
}
