import assert from "node:assert/strict"
import test from "node:test"
import {
  buildPrompt,
  forkCut,
  inflightTextOf,
  latestModelSelection,
  pinReadOnly,
} from "../lib/core.js"

function event(seq, type, data = {}) {
  return { seq, type, data }
}

test("forkCut ends after completed-turn interstitial events and before the in-flight turn", () => {
  const events = [
    event(0, "turn/start"),
    event(1, "user/message"),
    event(2, "turn/end"),
    event(3, "sandbox/mode", { mode: "workspace-write" }),
    event(4, "agent-preset/selected", { agentPreset: "minimal" }),
    event(5, "turn/start"),
    event(6, "user/message", { content: [{ type: "text", text: "ongoing work" }] }),
    event(7, "assistant/chunk"),
  ]
  assert.deepEqual(forkCut(events), { lastTurnEndIndex: 2, cut: 5 })
  assert.equal(inflightTextOf(events, 2), "ongoing work")
})

test("forkCut refuses a session without a completed turn", () => {
  assert.equal(forkCut([event(0, "turn/start"), event(1, "user/message")]), undefined)
})

test("latest model selection preserves the logged route and reasoning effort", () => {
  const selected = latestModelSelection([
    event(0, "request/header", { header: { config: { provider: "p", model: "m", reasoningEffort: "high" } } }),
  ], { provider: "fallback", model: "fallback" })
  assert.deepEqual(selected, { provider: "p", model: "m", reasoningEffort: "high" })
})

test("BTW prompt identifies the busy-parent task but never claims write capability", () => {
  const prompt = buildPrompt("why?", "implement feature")
  assert.match(prompt, /\[BTW 旁路问答\]/)
  assert.match(prompt, /主会话正在进行中的任务：implement feature/)
  assert.match(prompt, /本会话已被钉为只读问答/)
  assert.doesNotMatch(prompt, /可以写文件/)
})

test("pinReadOnly uses the four-argument command API and verifies both projections", async () => {
  const calls = []
  const session = { id: "child" }
  const child = { session }
  const signal = new AbortController().signal
  const ctx = {
    commands: {
      async execute(...args) {
        calls.push(args)
        return { result: { kind: "success", text: "preset read-only" } }
      },
    },
    get(name) {
      if (name === "approval") return { overrideOf() { return "never" }, config: {} }
      if (name === "permissionPresets") {
        return {
          resolve(value) { assert.equal(value, "read-only"); return { sandbox: "read-only", approval: "never" } },
          current(value) { assert.equal(value, session); return "read-only" },
        }
      }
      if (name === "sandboxPolicy") {
        return { resolve({ session: value }) { assert.equal(value, session); return { mode: "read-only" } } }
      }
      return undefined
    },
  }
  await pinReadOnly(ctx, child, signal)
  assert.deepEqual(calls, [[child, "/permission read-only", [], signal]])
})

test("pinReadOnly fails closed when the permission command is missing", async () => {
  const child = { session: { id: "child" } }
  const ctx = {
    commands: { async execute() { return undefined } },
    get(name) {
      if (name === "permissionPresets") return { resolve() { return { sandbox: "read-only", approval: "never" } }, current() { return "read-only" } }
      if (name === "sandboxPolicy") return { resolve() { return { mode: "read-only" } } }
      return undefined
    },
  }
  await assert.rejects(pinReadOnly(ctx, child, new AbortController().signal), /command is unavailable/)
})

test("pinReadOnly fails closed when the effective sandbox is not read-only", async () => {
  let delivered = false
  const child = { session: { id: "child" }, followup() { delivered = true } }
  const ctx = {
    commands: { async execute() { return { result: { kind: "success", text: "preset read-only" } } } },
    get(name) {
      if (name === "permissionPresets") return { resolve() { return { sandbox: "read-only", approval: "never" } }, current() { return "read-only" } }
      if (name === "sandboxPolicy") return { resolve() { return { mode: "workspace-write" } } }
      return undefined
    },
  }
  await assert.rejects(pinReadOnly(ctx, child, new AbortController().signal), /expected read-only/)
  assert.equal(delivered, false)
})
